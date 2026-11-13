import os
import re
from collections.abc import Callable, Iterator

import pytest

# La configuración se lee al importar `app`, así que el entorno de pruebas se
# fija antes de cualquier import de la app. Se sobrescribe a propósito: los
# tests nunca deben depender del `.env` local ni tocar una base de datos real.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["TZ"] = "America/Bogota"
WEB_BASE_URL = "http://web.test"
os.environ["WEB_BASE_URL"] = WEB_BASE_URL
# Los tests nunca envían correos (spec 032, RF-14): el proveedor es `console`
# y, además, el fixture `client` lo cambia por un buzón en memoria.
os.environ["EMAIL_PROVIDER"] = "console"
# El bot se retiró (spec 007): si el entorno de quien corre los tests aún
# tiene su llave, se quita para probar la API tal como arranca ahora.
os.environ.pop("BOT_API_KEY", None)
# Opcional: correr la misma suite contra otra base, por ejemplo el PostgreSQL
# de `make up` (README, "Contenedores"). Sin ella, SQLite en memoria.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "sqlite://")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db import build_engine, get_db  # noqa: E402
from app.mailer import Email, MailError, get_mailer  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


class Outbox:
    """El proveedor de correo de los tests: guarda lo "enviado" en una lista
    y nunca sale a la red (spec 032, RF-14). Con `failing = True` se comporta
    como un Brevo caído."""

    def __init__(self) -> None:
        self.sent: list[Email] = []
        self.failing = False

    def send(self, email: Email) -> None:
        if self.failing:
            raise MailError("fallo simulado")
        self.sent.append(email)


@pytest.fixture
def engine() -> Iterator[Engine]:
    """Base de datos nueva y vacía para cada test: SQLite en memoria, o la de
    `TEST_DATABASE_URL`, a la que se le borran las tablas al terminar.

    Se crea desde los modelos y no con las migraciones, que harían mucho más
    lentos los tests. `test_migrations.py` comprueba que los dos caminos dan
    el mismo esquema (plan 008).
    """
    engine = build_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(engine)
    yield engine
    if engine.dialect.name != "sqlite":
        # La base en memoria desaparece sola; una de verdad hay que vaciarla
        # para que el siguiente test no vea estas filas.
        Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine: Engine) -> Iterator[TestClient]:
    """Cliente HTTP de la API conectado a la base de datos en memoria del test."""

    def override_get_db() -> Iterator[Session]:
        with Session(engine) as db:
            yield db

    outbox = Outbox()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_mailer] = lambda: outbox
    test_client = TestClient(app)
    # El buzón viaja con el cliente: los ayudantes que crean cuentas leen de
    # ahí el enlace del correo.
    test_client.outbox = outbox
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def outbox(client: TestClient) -> Outbox:
    """El buzón del `client` de este test."""
    return client.outbox


PASSWORD = "una-contraseña-larga"


def name_from(email: str) -> str:
    """El nombre con el que los tests crean una cuenta: "ana@example.com" →
    "Ana". Su espacio por defecto es "Espacio de Ana" (spec 031)."""
    return email.strip().split("@")[0].capitalize() or "Ana"


def token_from(url: str) -> str:
    """Token de un enlace de invitación `<WEB_BASE_URL>/unirse/<token>`."""
    return url.rsplit("/", 1)[1]


def link_in(email: Email) -> str:
    """El enlace de un correo de los tests."""
    return re.search(rf"{re.escape(WEB_BASE_URL)}/\S+", email.text).group()


def last_token(client: TestClient, to: str | None = None) -> str:
    """El token del último correo enviado (a `to`, si se indica)."""
    emails = [email for email in client.outbox.sent if to in (None, email.to)]
    return token_from(link_in(emails[-1]))


def sign_up(client: TestClient, email: str = "ana@example.com", **changes: object):
    """Crea una cuenta por el camino completo (spec 032): la solicitud y el
    enlace del correo. Devuelve la respuesta de confirmar, o la de la
    solicitud si esa no pasó (`409`, `422`...)."""
    body = {"email": email, "password": PASSWORD, "name": name_from(email)}
    response = client.post("/auth/register", json=body | changes)
    if response.status_code != 202:
        return response
    token = last_token(client, to=response.json()["email"])
    return client.post("/auth/register/confirm", json={"token": token})


@pytest.fixture
def login(client: TestClient) -> Callable[[str], dict[str, str]]:
    """Crea una cuenta (con su correo confirmado, como toda cuenta nueva),
    inicia su sesión y devuelve la cabecera con el token.

    El registro es abierto (RF-1): cada usuario se registra sin código.
    """

    def _login(email: str = "ana@example.com") -> dict[str, str]:
        body = {"email": email, "password": PASSWORD}
        sign_up(client, email).raise_for_status()
        response = client.post("/auth/login", json=body)
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    return _login


@pytest.fixture
def shared_space(
    client: TestClient, login: Callable[[str], dict[str, str]]
) -> tuple[int, dict[str, str], dict[str, str]]:
    """Espacio "Casa" con dos miembros, Ana y Bea: (id, cabecera Ana, cabecera Bea)."""
    ana, bea = login("ana@example.com"), login("bea@example.com")
    space_id = client.post("/spaces", json={"name": "Casa"}, headers=ana).json()["id"]
    url = client.post(f"/spaces/{space_id}/invitations", headers=ana).json()["url"]
    token = token_from(url)
    client.post(f"/invitations/{token}/redeem", headers=bea).raise_for_status()
    return space_id, ana, bea
