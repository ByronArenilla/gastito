"""Confirmar el correo de una cuenta que ya existía (spec 032, RF-5 a RF-8)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import Engine, select, update
from sqlalchemy.orm import Session

from app.email_tokens import RESET, VERIFY, issue_token
from app.models import EmailToken, User
from app.security import hash_token
from tests.conftest import WEB_BASE_URL, Outbox, last_token, link_in, token_from

Login = Callable[..., dict[str, str]]


def unverify(engine: Engine, email: str = "ana@example.com") -> None:
    """Deja la cuenta como una anterior a la spec: sin confirmar."""
    with Session(engine) as db:
        db.execute(
            update(User).where(User.email == email).values(email_verified_at=None)
        )
        db.commit()


def old_account(login: Login, engine: Engine, email: str = "ana@example.com"):
    headers = login(email)
    unverify(engine, email)
    return headers


def ask(client: TestClient, headers: dict[str, str]):
    return client.post("/me/email-verification", headers=headers)


def confirm(client: TestClient, token: str):
    return client.post("/auth/email-verification/confirm", json={"token": token})


def age_tokens(engine: Engine, **changes: datetime) -> None:
    with Session(engine) as db:
        db.execute(update(EmailToken).values(**changes))
        db.commit()


# --- /me (RF-5) ---


def test_an_account_from_before_is_not_verified(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)

    assert client.get("/me", headers=ana).json()["email_verified"] is False


def test_a_new_account_is_verified(client: TestClient, login: Login) -> None:
    assert client.get("/me", headers=login()).json()["email_verified"] is True


# --- Pedir el enlace (RF-6) ---


def test_asking_sends_a_link_to_the_account_email(
    client: TestClient, engine: Engine, login: Login, outbox: Outbox
) -> None:
    ana = old_account(login, engine)
    outbox.sent.clear()

    response = ask(client, ana)

    assert response.status_code == 202
    [email] = outbox.sent
    assert email.to == "ana@example.com"
    assert link_in(email).startswith(f"{WEB_BASE_URL}/verificar/")
    with Session(engine) as db:
        stored = db.scalars(select(EmailToken)).one()
    assert stored.token_hash == hash_token(token_from(link_in(email)))
    assert stored.purpose == VERIFY


def test_asking_needs_a_session(client: TestClient) -> None:
    assert client.post("/me/email-verification").status_code == 401


def test_a_verified_account_gets_409(
    client: TestClient, login: Login, outbox: Outbox
) -> None:
    ana = login()
    outbox.sent.clear()

    assert ask(client, ana).status_code == 409
    assert outbox.sent == []


def test_asking_twice_within_a_minute_is_429(
    client: TestClient, engine: Engine, login: Login, outbox: Outbox
) -> None:
    ana = old_account(login, engine)
    outbox.sent.clear()
    ask(client, ana)

    response = ask(client, ana)

    assert response.status_code == 429
    assert len(outbox.sent) == 1


def test_a_new_link_cancels_the_previous_one(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)
    ask(client, ana)
    first = last_token(client)
    age_tokens(engine, created_at=datetime.now(UTC) - timedelta(minutes=2))

    assert ask(client, ana).status_code == 202

    assert confirm(client, first).status_code == 404
    assert confirm(client, last_token(client)).status_code == 200


def test_if_the_email_cannot_be_sent_the_previous_link_still_works(
    client: TestClient, engine: Engine, login: Login, outbox: Outbox
) -> None:
    ana = old_account(login, engine)
    ask(client, ana)
    first = last_token(client)
    age_tokens(engine, created_at=datetime.now(UTC) - timedelta(minutes=2))
    outbox.failing = True

    response = ask(client, ana)

    assert response.status_code == 502
    assert confirm(client, first).status_code == 200


# --- Confirmar (RF-7) ---


def test_confirming_needs_no_session_and_verifies_the_account(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)
    ask(client, ana)

    response = confirm(client, last_token(client))

    assert response.status_code == 200
    assert response.json() == {"email": "ana@example.com"}
    assert client.get("/me", headers=ana).json()["email_verified"] is True


def test_the_link_works_only_once(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)
    ask(client, ana)
    token = last_token(client)
    confirm(client, token)

    assert confirm(client, token).status_code == 404


def test_expired_used_and_unknown_links_answer_the_same(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)
    ask(client, ana)
    token = last_token(client)
    age_tokens(engine, expires_at=datetime.now(UTC) - timedelta(seconds=1))

    expired = confirm(client, token)
    unknown = confirm(client, "no-existe")

    assert expired.status_code == unknown.status_code == 404
    assert expired.json() == unknown.json()
    assert client.get("/me", headers=ana).json()["email_verified"] is False


def test_a_password_link_does_not_verify_here(
    client: TestClient, engine: Engine, login: Login
) -> None:
    # Cada enlace sirve solo para lo suyo.
    ana = old_account(login, engine)
    with Session(engine) as db:
        user_id = db.scalars(select(User.id)).one()
        token = issue_token(db, user_id, RESET, datetime.now(UTC))
        db.commit()

    assert confirm(client, token).status_code == 404
    assert client.get("/me", headers=ana).json()["email_verified"] is False


def test_only_that_account_is_verified(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine, "ana@example.com")
    bea = old_account(login, engine, "bea@example.com")
    ask(client, ana)

    confirm(client, last_token(client, to="ana@example.com"))

    assert client.get("/me", headers=bea).json()["email_verified"] is False


# --- Sin confirmar no se comparte (RF-8) ---


def test_an_unverified_account_cannot_invite(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)
    [space] = client.get("/spaces", headers=ana).json()

    response = client.post(f"/spaces/{space['id']}/invitations", headers=ana)

    assert response.status_code == 403
    assert "Confirma tu correo" in response.json()["detail"]


def test_an_unverified_account_cannot_join(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = login("ana@example.com")
    bea = old_account(login, engine, "bea@example.com")
    [space] = client.get("/spaces", headers=ana).json()
    url = client.post(f"/spaces/{space['id']}/invitations", headers=ana).json()["url"]

    response = client.post(f"/invitations/{token_from(url)}/redeem", headers=bea)

    assert response.status_code == 403
    assert "Confirma tu correo" in response.json()["detail"]
    assert len(client.get("/spaces", headers=bea).json()) == 1
    # La invitación no se gastó: sirve cuando confirme.
    ask(client, bea)
    confirm(client, last_token(client, to="bea@example.com"))
    redeemed = client.post(f"/invitations/{token_from(url)}/redeem", headers=bea)
    assert redeemed.status_code == 200


def test_everything_else_still_works_unverified(
    client: TestClient, engine: Engine, login: Login
) -> None:
    ana = old_account(login, engine)
    [space] = client.get("/spaces", headers=ana).json()
    base = f"/spaces/{space['id']}"

    assert client.get(f"{base}/summary", headers=ana).status_code == 200
    assert client.get(f"{base}/categories", headers=ana).status_code == 200
    assert (
        client.post("/spaces", json={"name": "Viaje"}, headers=ana).status_code == 201
    )
