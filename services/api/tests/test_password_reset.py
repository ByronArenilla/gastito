"""Recuperar la contraseña con un enlace por correo (spec 032, RF-9 a
RF-11)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select, update
from sqlalchemy.orm import Session

from app.models import EmailToken
from app.models import Session as SessionRow
from tests.conftest import (
    PASSWORD,
    WEB_BASE_URL,
    Outbox,
    last_token,
    link_in,
    sign_up,
)
from tests.test_email_verification import unverify

Login = Callable[..., dict[str, str]]
NEW_PASSWORD = "otra-contraseña-larga"


def ask(client: TestClient, email: str = "ana@example.com"):
    return client.post("/auth/password-reset", json={"email": email})


def reset(client: TestClient, token: str, password: str = NEW_PASSWORD):
    body = {"token": token, "password": password}
    return client.post("/auth/password-reset/confirm", json=body)


def log_in(client: TestClient, password: str, email: str = "ana@example.com"):
    return client.post("/auth/login", json={"email": email, "password": password})


def age_tokens(engine: Engine, **changes: datetime) -> None:
    with Session(engine) as db:
        db.execute(update(EmailToken).values(**changes))
        db.commit()


# --- Pedir el enlace (RF-9) ---


def test_asking_sends_the_link_to_an_existing_account(
    client: TestClient, outbox: Outbox
) -> None:
    sign_up(client)
    outbox.sent.clear()

    response = ask(client, "  Ana@Example.com ")

    assert response.status_code == 202
    [email] = outbox.sent
    assert email.to == "ana@example.com"
    assert link_in(email).startswith(f"{WEB_BASE_URL}/restablecer/")


def test_the_answer_is_the_same_whether_the_account_exists_or_not(
    client: TestClient, outbox: Outbox
) -> None:
    sign_up(client)
    outbox.sent.clear()

    known = ask(client, "ana@example.com")
    unknown = ask(client, "nadie@example.com")
    nonsense = ask(client, "esto no es un correo")

    assert known.status_code == unknown.status_code == nonsense.status_code == 202
    assert known.json() == unknown.json() == nonsense.json()
    assert [email.to for email in outbox.sent] == ["ana@example.com"]


def test_asking_twice_within_a_minute_sends_only_one(
    client: TestClient, outbox: Outbox
) -> None:
    sign_up(client)
    outbox.sent.clear()

    first, second = ask(client), ask(client)

    # La segunda responde igual: tampoco el minuto de espera delata nada.
    assert first.json() == second.json()
    assert len(outbox.sent) == 1


def test_a_failed_send_still_answers_the_same(
    client: TestClient, outbox: Outbox
) -> None:
    sign_up(client)
    outbox.failing = True

    response = ask(client)

    assert response.status_code == 202


# --- Cambiar la contraseña (RF-10, RF-11) ---


def test_the_link_sets_the_new_password(client: TestClient) -> None:
    sign_up(client)
    ask(client)

    response = reset(client, last_token(client))

    assert response.status_code == 200
    assert log_in(client, NEW_PASSWORD).status_code == 200
    assert log_in(client, PASSWORD).status_code == 401


def test_changing_the_password_closes_every_session(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login("ana@example.com")
    bea = login("bea@example.com")
    log_in(client, PASSWORD)  # una segunda sesión de Ana, en otro dispositivo
    ask(client)

    reset(client, last_token(client, to="ana@example.com"))

    assert client.get("/me", headers=ana).status_code == 401
    assert client.get("/me", headers=bea).status_code == 200
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(SessionRow)) == 1


def test_changing_the_password_verifies_an_old_account(
    client: TestClient, engine: Engine
) -> None:
    sign_up(client)
    unverify(engine)
    ask(client)

    reset(client, last_token(client))

    token = log_in(client, NEW_PASSWORD).json()["access_token"]
    me = client.get("/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email_verified"] is True


def test_the_link_works_only_once(client: TestClient) -> None:
    sign_up(client)
    ask(client)
    token = last_token(client)
    reset(client, token)

    again = reset(client, token, "una-tercera-contraseña")

    assert again.status_code == 404
    assert log_in(client, NEW_PASSWORD).status_code == 200


def test_the_link_lasts_one_hour(client: TestClient, engine: Engine) -> None:
    sign_up(client)
    ask(client)
    with Session(engine) as db:
        row = db.scalars(select(EmailToken)).one()
    assert row.expires_at - row.created_at == timedelta(hours=1)
    age_tokens(engine, expires_at=datetime.now(UTC) - timedelta(seconds=1))

    response = reset(client, last_token(client))

    assert response.status_code == 404
    assert log_in(client, PASSWORD).status_code == 200


def test_a_short_password_is_422_and_keeps_the_link(client: TestClient) -> None:
    sign_up(client)
    ask(client)
    token = last_token(client)

    short = reset(client, token, "corta")

    assert short.status_code == 422
    assert "12 caracteres" in short.text
    assert reset(client, token).status_code == 200


def test_a_verification_link_cannot_change_the_password(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login()
    unverify(engine)
    client.post("/me/email-verification", headers=ana)

    response = reset(client, last_token(client))

    assert response.status_code == 404
    assert log_in(client, PASSWORD).status_code == 200


def test_an_unknown_link_is_404(client: TestClient) -> None:
    assert reset(client, "no-existe").status_code == 404
