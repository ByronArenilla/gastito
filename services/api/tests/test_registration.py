"""Una cuenta nueva solo se crea al confirmar el correo (spec 032, RF-1 a
RF-4 y RF-12)."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.models import Category, Membership, PendingRegistration, Space, User
from app.security import hash_token, verify_password
from tests.conftest import PASSWORD, WEB_BASE_URL, Outbox, last_token, link_in

BODY = {"name": "Ana", "email": "ana@example.com", "password": PASSWORD}


def request(client: TestClient, **changes: object):
    return client.post("/auth/register", json=BODY | changes)


def confirm(client: TestClient, token: str):
    return client.post("/auth/register/confirm", json={"token": token})


def count(engine: Engine, model: type) -> int:
    with Session(engine) as db:
        return db.scalar(select(func.count()).select_from(model))


def age_pending(engine: Engine, **changes: datetime) -> None:
    """Mueve las fechas de la solicitud, como si hubiera pasado el tiempo."""
    with Session(engine) as db:
        pending = db.scalars(select(PendingRegistration)).one()
        for field, value in changes.items():
            setattr(pending, field, value)
        db.commit()


# --- La solicitud (RF-1, RF-2, RF-12) ---


def test_asking_for_an_account_creates_nothing_yet(
    client: TestClient, engine: Engine
) -> None:
    response = request(client)

    assert response.status_code == 202
    assert response.json()["email"] == "ana@example.com"
    assert "spam" in response.json()["detail"]
    for model in (User, Space, Membership, Category):
        assert count(engine, model) == 0, model.__name__
    assert count(engine, PendingRegistration) == 1


def test_the_email_carries_the_link_to_finish(
    client: TestClient, outbox: Outbox
) -> None:
    request(client)

    [email] = outbox.sent
    assert email.to == "ana@example.com"
    assert link_in(email).startswith(f"{WEB_BASE_URL}/confirmar-cuenta/")
    assert "Ana" in email.text


def test_only_hashes_are_stored(client: TestClient, engine: Engine) -> None:
    request(client)

    token = last_token(client)
    with Session(engine) as db:
        pending = db.scalars(select(PendingRegistration)).one()
    assert pending.token_hash == hash_token(token)
    assert token not in (pending.token_hash, pending.password_hash)
    assert pending.password_hash != PASSWORD
    assert verify_password(pending.password_hash, PASSWORD)


def test_one_cannot_log_in_before_confirming(client: TestClient) -> None:
    # RF-4: igual que con un correo que no existe.
    request(client)
    body = {"email": "ana@example.com", "password": PASSWORD}

    pending = client.post("/auth/login", json=body)
    unknown = client.post("/auth/login", json=body | {"email": "nadie@example.com"})

    assert pending.status_code == unknown.status_code == 401
    assert pending.json() == unknown.json()


def test_an_email_with_an_account_is_rejected(
    client: TestClient, engine: Engine, outbox: Outbox
) -> None:
    request(client)
    confirm(client, last_token(client))
    sent = len(outbox.sent)

    response = request(client)

    assert response.status_code == 409
    assert len(outbox.sent) == sent
    assert count(engine, PendingRegistration) == 0


def test_asking_again_within_a_minute_is_429(
    client: TestClient, outbox: Outbox
) -> None:
    request(client)

    response = request(client)

    assert response.status_code == 429
    assert "minuto" in response.json()["detail"]
    assert len(outbox.sent) == 1


def test_a_new_request_replaces_the_previous_one(
    client: TestClient, engine: Engine
) -> None:
    request(client, name="Anna")
    old_token = last_token(client)
    age_pending(engine, created_at=datetime.now(UTC) - timedelta(minutes=2))

    assert request(client, name="Ana").status_code == 202

    assert count(engine, PendingRegistration) == 1
    assert confirm(client, old_token).status_code == 404
    created = confirm(client, last_token(client))
    assert created.json()["name"] == "Ana"


def test_if_the_email_cannot_be_sent_nothing_is_kept(
    client: TestClient, engine: Engine, outbox: Outbox
) -> None:
    outbox.failing = True

    response = request(client)

    assert response.status_code == 502
    assert "correo" in response.json()["detail"]
    assert count(engine, PendingRegistration) == 0
    # Y se puede volver a intentar enseguida: no cuenta para el minuto.
    outbox.failing = False
    assert request(client).status_code == 202


@pytest.mark.parametrize(
    "changes", [{"name": ""}, {"email": "ana"}, {"password": "corta"}]
)
def test_a_bad_form_sends_nothing(
    client: TestClient, engine: Engine, outbox: Outbox, changes: dict[str, str]
) -> None:
    assert request(client, **changes).status_code == 422
    assert outbox.sent == []
    assert count(engine, PendingRegistration) == 0


# --- Confirmar (RF-3) ---


def test_confirming_creates_the_account_with_its_email_verified(
    client: TestClient, engine: Engine
) -> None:
    request(client)

    response = confirm(client, last_token(client))

    assert response.status_code == 201
    body = response.json()
    assert (body["email"], body["name"]) == ("ana@example.com", "Ana")
    assert body["personal_space"]["name"] == "Espacio de Ana"
    assert "access_token" not in body
    with Session(engine) as db:
        user = db.scalars(select(User)).one()
    assert user.email_verified
    assert verify_password(user.password_hash, PASSWORD)
    assert count(engine, PendingRegistration) == 0
    assert count(engine, Category) > 0


def test_after_confirming_one_can_log_in(client: TestClient) -> None:
    request(client)
    confirm(client, last_token(client))

    login = client.post(
        "/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
    )

    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/me", headers=headers).json()["email_verified"] is True


def test_the_link_works_only_once(client: TestClient, engine: Engine) -> None:
    request(client)
    token = last_token(client)
    confirm(client, token)

    again = confirm(client, token)

    assert again.status_code == 404
    assert count(engine, User) == 1


def test_an_expired_link_creates_nothing(client: TestClient, engine: Engine) -> None:
    request(client)
    age_pending(engine, expires_at=datetime.now(UTC) - timedelta(seconds=1))

    response = confirm(client, last_token(client))

    assert response.status_code == 404
    assert count(engine, User) == 0


def test_every_bad_link_gets_the_same_answer(
    client: TestClient, engine: Engine
) -> None:
    request(client)
    token = last_token(client)
    age_pending(engine, expires_at=datetime.now(UTC) - timedelta(seconds=1))

    expired = confirm(client, token)
    unknown = confirm(client, "no-existe")

    assert expired.status_code == unknown.status_code == 404
    assert expired.json() == unknown.json()


def test_expired_requests_are_cleaned_up_by_the_next_one(
    client: TestClient, engine: Engine
) -> None:
    request(client)
    age_pending(engine, expires_at=datetime.now(UTC) - timedelta(seconds=1))

    request(client, email="bea@example.com", name="Bea")

    with Session(engine) as db:
        emails = db.scalars(select(PendingRegistration.email)).all()
    assert emails == ["bea@example.com"]
