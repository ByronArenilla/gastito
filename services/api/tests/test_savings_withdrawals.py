"""Retiros de ahorro (spec 013, RF-32 a RF-35 y RF-37, decisiones 25 a 28).

Un retiro saca plata de lo apartado en la categoría Ahorro en su mes. Nunca
pasa de lo apartado menos lo ya retirado (RF-33), y por eso tampoco se puede
cambiar o borrar lo apartado si deja lo retirado por encima (RF-34).
"""

from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app import dates

Login = Callable[..., dict[str, str]]

# 20 de agosto de 2026 a mediodía en Bogotá.
AUGUST_20 = datetime(2026, 8, 20, 17, 0, tzinfo=UTC)


class Space:
    """Espacio de Ana con $ 500.000 apartados en Ahorro el 3 de agosto."""

    def __init__(self, client: TestClient, headers: dict[str, str]) -> None:
        self.client, self.headers = client, headers
        self.id = client.get("/spaces", headers=headers).json()[0]["id"]
        self.base = f"/spaces/{self.id}"
        listed = client.get(f"{self.base}/categories", headers=headers).json()
        self.categories = {c["name"]: c["id"] for c in listed}
        self.saved = self.expense(500000, "Ahorro", "2026-08-03").json()

    def request(self, method: str, path: str, **kwargs: object) -> Response:
        return self.client.request(
            method, f"{self.base}{path}", headers=self.headers, **kwargs
        )

    def expense(self, amount: int, category: str, spent_on: str) -> Response:
        body = {
            "amount": amount,
            "payment_type": "debit",
            "category_id": self.categories[category],
            "spent_on": spent_on,
        }
        return self.request("POST", "/expenses", json=body)

    def withdraw(self, amount: int, spent_on: str = "2026-08-14", **fields) -> Response:
        body = {"amount": amount, "spent_on": spent_on, **fields}
        return self.request("POST", "/savings-withdrawals", json=body)

    def withdrawals(self, period: str = "2026-08") -> list[dict]:
        return self.request("GET", f"/savings-withdrawals?period={period}").json()


@pytest.fixture
def space(client: TestClient, login: Login, monkeypatch: pytest.MonkeyPatch) -> Space:
    monkeypatch.setattr(dates, "now", lambda: AUGUST_20)
    return Space(client, login("ana@example.com"))


def detail(response: Response) -> str:
    """El mensaje de un error, venga de la ruta o de la validación."""
    body = response.json()["detail"]
    return body if isinstance(body, str) else body[0]["msg"]


# --- Registrar, listar y ver (RF-32, RF-35) ---


def test_a_withdrawal_is_registered_with_who_did_it(space: Space) -> None:
    response = space.withdraw(200000, description="  Urgencia médica  ")

    assert response.status_code == 201
    body = response.json()
    me = space.client.get("/me", headers=space.headers).json()
    assert body["amount"] == 200000
    assert body["spent_on"] == "2026-08-14"
    assert body["description"] == "Urgencia médica"
    assert body["created_by"] == me["id"]
    assert space.withdrawals() == [body]
    assert space.request("GET", f"/savings-withdrawals/{body['id']}").json() == body


def test_the_date_defaults_to_today_and_an_empty_note_is_none(space: Space) -> None:
    body = space.request(
        "POST", "/savings-withdrawals", json={"amount": 1000, "description": " "}
    ).json()

    assert body["spent_on"] == "2026-08-20"
    assert body["description"] is None


def test_the_list_is_by_month_newest_first(space: Space) -> None:
    space.expense(300000, "Ahorro", "2026-07-02")
    july = space.withdraw(100000, "2026-07-10").json()
    first = space.withdraw(50000, "2026-08-05").json()
    second = space.withdraw(70000, "2026-08-18").json()

    assert space.withdrawals("2026-08") == [second, first]
    assert space.withdrawals("2026-07") == [july]


def test_amount_and_date_follow_the_rules_of_an_expense(space: Space) -> None:
    decimal = space.withdraw(1000.5)
    zero = space.withdraw(0)
    future = space.withdraw(1000, "2026-08-21")

    assert decimal.status_code == 422
    assert "entero" in detail(decimal)
    assert zero.status_code == 422
    assert "mayor que cero" in detail(zero)
    assert future.status_code == 422
    assert detail(future) == "La fecha del retiro no puede ser posterior a hoy."


# --- Límite: no más de lo apartado en el mes (RF-33) ---


def test_up_to_what_was_saved_in_the_month(space: Space) -> None:
    over = space.withdraw(500001)
    exact = space.withdraw(500000)
    one_more = space.withdraw(1)

    assert over.status_code == 422
    assert detail(over) == (
        "En agosto de 2026 apartaste $ 500.000 y no has retirado nada: "
        "puedes retirar hasta $ 500.000."
    )
    assert exact.status_code == 201
    assert one_more.status_code == 422
    assert detail(one_more) == (
        "En agosto de 2026 apartaste $ 500.000 y ya retiraste $ 500.000: "
        "puedes retirar hasta $ 0."
    )


def test_two_withdrawals_cannot_pass_together(space: Space) -> None:
    first = space.withdraw(300000)
    second = space.withdraw(300000)

    assert first.status_code == 201
    assert second.status_code == 422
    assert "puedes retirar hasta $ 200.000" in detail(second)
    assert [w["amount"] for w in space.withdrawals()] == [300000]


def test_editing_a_withdrawal_is_measured_without_itself(space: Space) -> None:
    withdrawal = space.withdraw(300000).json()
    path = f"/savings-withdrawals/{withdrawal['id']}"

    up_to_all = space.request("PATCH", path, json={"amount": 500000})
    over = space.request("PATCH", path, json={"amount": 500001})

    assert up_to_all.status_code == 200
    assert up_to_all.json()["amount"] == 500000
    assert over.status_code == 422
    assert space.withdrawals()[0]["amount"] == 500000


def test_moving_a_withdrawal_to_a_month_without_savings_fails(space: Space) -> None:
    withdrawal = space.withdraw(100000).json()

    response = space.request(
        "PATCH",
        f"/savings-withdrawals/{withdrawal['id']}",
        json={"spent_on": "2026-07-10"},
    )

    assert response.status_code == 422
    assert detail(response) == (
        "En julio de 2026 no apartaste nada en Ahorro: no hay de dónde retirar."
    )


def test_a_card_debt_in_ahorro_is_not_saved_money(space: Space) -> None:
    # Una deuda con tarjeta no cuenta en su categoría el día de la compra
    # (spec 009): no es plata apartada.
    visa = space.request(
        "POST", "/cards", json={"name": "Visa", "cutoff_day": 25, "due_day": 10}
    ).json()
    debt = space.request(
        "POST",
        "/expenses",
        json={
            "amount": 600000,
            "payment_type": "credit",
            "card_id": visa["id"],
            "installments": 6,
            "category_id": space.categories["Ahorro"],
            "description": "CDT a cuotas",
            "spent_on": "2026-08-04",
        },
    )

    response = space.withdraw(500001)

    assert debt.status_code == 201
    assert response.status_code == 422


# --- Guarda: lo apartado no queda por debajo de lo retirado (RF-34) ---

GUARD = (
    "En agosto de 2026 retiraste $ 200.000 del ahorro; con este cambio, lo "
    "apartado quedaría en $ {left}. Cambia o borra el retiro primero."
)


def test_deleting_the_saved_money_with_a_withdrawal_fails(space: Space) -> None:
    space.withdraw(200000)

    response = space.request(
        "DELETE", f"/expenses/{space.saved['id']}", params={"confirm": "true"}
    )

    assert response.status_code == 409
    assert detail(response) == GUARD.format(left="0")
    assert space.request("GET", f"/expenses/{space.saved['id']}").status_code == 200


@pytest.mark.parametrize(
    ("change", "left"),
    [
        ({"amount": 150000}, "150.000"),
        ({"category_id": "Comida"}, "0"),
        ({"spent_on": "2026-07-31"}, "0"),
    ],
)
def test_changing_the_saved_money_below_the_withdrawal_fails(
    space: Space, change: dict, left: str
) -> None:
    space.withdraw(200000)
    if "category_id" in change:
        change = {"category_id": space.categories[change["category_id"]]}

    response = space.request("PATCH", f"/expenses/{space.saved['id']}", json=change)

    assert response.status_code == 409
    assert detail(response) == GUARD.format(left=left)
    saved = space.request("GET", f"/expenses/{space.saved['id']}").json()
    assert saved == space.saved


def test_changes_that_keep_enough_saved_money_are_allowed(space: Space) -> None:
    space.withdraw(200000)
    other = space.expense(80000, "Comida", "2026-08-05").json()

    lower = space.request(
        "PATCH", f"/expenses/{space.saved['id']}", json={"amount": 200000}
    )
    deleted = space.request(
        "DELETE", f"/expenses/{other['id']}", params={"confirm": "true"}
    )

    assert lower.status_code == 200
    assert deleted.status_code == 204


def test_without_withdrawals_the_saved_money_is_free_to_change(space: Space) -> None:
    response = space.request(
        "DELETE", f"/expenses/{space.saved['id']}", params={"confirm": "true"}
    )

    assert response.status_code == 204


# --- Editar y borrar (RF-35) ---


def test_a_withdrawal_is_edited_like_an_expense(space: Space) -> None:
    withdrawal = space.withdraw(100000, description="Urgencia").json()
    path = f"/savings-withdrawals/{withdrawal['id']}"

    noted = space.request("PATCH", path, json={"description": "Urgencia médica"})
    cleared = space.request("PATCH", path, json={"description": None})
    no_amount = space.request("PATCH", path, json={"amount": None})

    assert noted.json()["description"] == "Urgencia médica"
    assert cleared.json()["description"] is None
    assert no_amount.status_code == 422


def test_deleting_a_withdrawal_needs_confirmation(space: Space) -> None:
    withdrawal = space.withdraw(100000).json()
    path = f"/savings-withdrawals/{withdrawal['id']}"

    unconfirmed = space.request("DELETE", path)
    confirmed = space.request("DELETE", path, params={"confirm": "true"})

    assert unconfirmed.status_code == 400
    assert detail(unconfirmed) == "Para borrar el retiro, confirma con confirm=true."
    assert confirmed.status_code == 204
    assert space.withdrawals() == []


# --- Por espacio (RF-37) ---


def test_another_space_cannot_see_or_touch_a_withdrawal(
    space: Space, client: TestClient, login: Login
) -> None:
    withdrawal = space.withdraw(100000).json()
    bea = login("bea@example.com")
    path = f"{space.base}/savings-withdrawals/{withdrawal['id']}"

    listed = client.get(f"{space.base}/savings-withdrawals", headers=bea)
    read = client.get(path, headers=bea)
    changed = client.patch(path, json={"amount": 1}, headers=bea)
    deleted = client.delete(path, params={"confirm": "true"}, headers=bea)

    assert [r.status_code for r in (listed, read, changed, deleted)] == [404] * 4
    assert space.withdrawals() == [withdrawal]


def test_a_withdrawal_of_another_space_is_not_found_from_mine(
    space: Space, client: TestClient, login: Login
) -> None:
    withdrawal = space.withdraw(100000).json()
    bea = login("bea@example.com")
    bea_space = client.get("/spaces", headers=bea).json()[0]["id"]

    response = client.get(
        f"/spaces/{bea_space}/savings-withdrawals/{withdrawal['id']}", headers=bea
    )

    assert response.status_code == 404
    assert detail(response) == "Retiro no encontrado."


def test_without_a_session_nothing_is_listed(space: Space, client: TestClient) -> None:
    response = client.get(f"{space.base}/savings-withdrawals")

    assert response.status_code == 401
