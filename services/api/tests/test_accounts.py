"""Nombre de usuario y espacio por defecto (spec 031, RF-1 a RF-6)."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.accounts import default_space_name, set_user_name
from app.models import Membership, Space, User
from tests.conftest import PASSWORD, sign_up, token_from

Login = Callable[..., dict[str, str]]


def register(client: TestClient, **changes: object):
    """La cuenta ya creada: solicitud y confirmación (spec 032)."""
    return sign_up(client, "ana@example.com", **changes)


def space_names(client: TestClient, headers: dict[str, str]) -> list[str]:
    return [space["name"] for space in client.get("/spaces", headers=headers).json()]


def forget_name(engine: Engine, email: str, space_name: str = "Personal") -> None:
    """Deja la cuenta como una anterior a la spec: sin nombre y con su
    espacio por defecto llamado "Personal"."""
    with Session(engine) as db:
        user = db.scalars(select(User).where(User.email == email)).one()
        user.name = None
        space = db.scalars(
            select(Space)
            .join(Membership, Membership.space_id == Space.id)
            .where(Membership.user_id == user.id)
            .order_by(Space.id)
        ).first()
        space.name = space_name
        db.commit()


# --- Crear la cuenta (RF-1, RF-2) ---


def test_registering_saves_the_name_and_names_the_space_after_it(
    client: TestClient, engine: Engine
) -> None:
    response = register(client, name="  Byron  ")

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Byron"
    assert body["personal_space"]["name"] == "Espacio de Byron"
    with Session(engine) as db:
        assert db.scalars(select(User.name)).one() == "Byron"


@pytest.mark.parametrize("name", ["", "   ", "a" * 51])
def test_registering_needs_a_name_of_one_to_fifty_characters(
    client: TestClient, engine: Engine, name: str
) -> None:
    response = register(client, name=name)

    assert response.status_code == 422
    assert "nombre" in response.text
    with Session(engine) as db:
        assert db.scalars(select(User)).all() == []


def test_registering_without_a_name_gets_the_same_message(client: TestClient) -> None:
    body = {"email": "ana@example.com", "password": PASSWORD}

    response = client.post("/auth/register", json=body)

    assert response.status_code == 422
    assert "nombre" in response.text


def test_a_name_of_exactly_fifty_characters_is_accepted(client: TestClient) -> None:
    assert register(client, name="a" * 50).status_code == 201


# --- /me (RF-3, RF-4) ---


def test_me_returns_the_name(client: TestClient, login: Login) -> None:
    ana = login("ana@example.com")

    assert client.get("/me", headers=ana).json()["name"] == "Ana"


def test_an_account_from_before_has_no_name(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login("ana@example.com")
    forget_name(engine, "ana@example.com")

    assert client.get("/me", headers=ana).json()["name"] is None


def test_patch_me_changes_the_name(client: TestClient, login: Login) -> None:
    ana = login("ana@example.com")

    response = client.patch("/me", json={"name": " Ana María "}, headers=ana)

    assert response.status_code == 200
    assert response.json()["name"] == "Ana María"
    assert client.get("/me", headers=ana).json()["name"] == "Ana María"


@pytest.mark.parametrize("name", ["", "  ", "a" * 51])
def test_patch_me_rejects_a_bad_name(
    client: TestClient, login: Login, name: str
) -> None:
    ana = login("ana@example.com")

    response = client.patch("/me", json={"name": name}, headers=ana)

    assert response.status_code == 422
    assert client.get("/me", headers=ana).json()["name"] == "Ana"


def test_patch_me_needs_a_session(client: TestClient) -> None:
    assert client.patch("/me", json={"name": "Ana"}).status_code == 401


def test_patch_me_only_changes_who_calls(client: TestClient, login: Login) -> None:
    ana, bea = login("ana@example.com"), login("bea@example.com")

    client.patch("/me", json={"name": "Anita"}, headers=ana)

    assert client.get("/me", headers=bea).json()["name"] == "Bea"


# --- El espacio "Personal" de antes (RF-5, RF-6) ---


def test_the_first_name_renames_the_old_personal_space(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login("ana@example.com")
    forget_name(engine, "ana@example.com")
    assert space_names(client, ana) == ["Personal"]

    client.patch("/me", json={"name": "Ana"}, headers=ana).raise_for_status()

    assert space_names(client, ana) == ["Espacio de Ana"]


def test_a_shared_personal_space_keeps_its_name(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana, bea = login("ana@example.com"), login("bea@example.com")
    forget_name(engine, "ana@example.com")
    [personal] = client.get("/spaces", headers=ana).json()
    invitation = client.post(f"/spaces/{personal['id']}/invitations", headers=ana)
    token = token_from(invitation.json()["url"])
    client.post(f"/invitations/{token}/redeem", headers=bea).raise_for_status()

    client.patch("/me", json={"name": "Ana"}, headers=ana).raise_for_status()

    assert space_names(client, ana) == ["Personal"]


def test_a_space_with_another_name_is_not_renamed(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login("ana@example.com")
    forget_name(engine, "ana@example.com", space_name="Mis cuentas")

    client.patch("/me", json={"name": "Ana"}, headers=ana).raise_for_status()

    assert space_names(client, ana) == ["Mis cuentas"]


def test_only_the_oldest_personal_space_is_renamed(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login("ana@example.com")
    forget_name(engine, "ana@example.com")
    client.post("/spaces", json={"name": "Personal"}, headers=ana).raise_for_status()

    client.patch("/me", json={"name": "Ana"}, headers=ana).raise_for_status()

    assert space_names(client, ana) == ["Espacio de Ana", "Personal"]


def test_changing_the_name_later_renames_nothing(
    client: TestClient, login: Login
) -> None:
    ana = login("ana@example.com")
    client.post("/spaces", json={"name": "Personal"}, headers=ana).raise_for_status()

    client.patch("/me", json={"name": "Anita"}, headers=ana).raise_for_status()

    assert space_names(client, ana) == ["Espacio de Ana", "Personal"]


def test_another_users_personal_space_is_never_renamed(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana, bea = login("ana@example.com"), login("bea@example.com")
    forget_name(engine, "ana@example.com")
    forget_name(engine, "bea@example.com")

    client.patch("/me", json={"name": "Ana"}, headers=ana).raise_for_status()

    assert space_names(client, bea) == ["Personal"]


# --- Las reglas, sin HTTP (principio 10) ---


def test_default_space_name() -> None:
    assert default_space_name("Byron") == "Espacio de Byron"


def test_set_user_name_does_not_commit(session: Session) -> None:
    user = User(email="ana@example.com", password_hash="x")
    space = Space(name="Personal")
    session.add_all([user, space])
    session.flush()
    session.add(Membership(user_id=user.id, space_id=space.id))
    session.flush()

    set_user_name(session, user, "Ana")

    assert (user.name, space.name) == ("Ana", "Espacio de Ana")
    session.rollback()
    assert session.scalars(select(User)).all() == []
