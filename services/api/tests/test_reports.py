"""Reportes de un mes elegido (spec 013, RF-3, RF-5, RF-6, RF-14 a RF-23 y
RF-31).

Espacio de ejemplo de Ana, con hoy el 15 de noviembre de 2026 (las cifras
están calculadas a mano en cada test):

- Mayo de 2026: sin ingresos ni gastos.
- Sueldo 6.500.000 en junio, julio, agosto y octubre. Septiembre tiene
  gastos pero no ingresos planeados: usa los de agosto, estimados.
- Rubros de junio a octubre: Arriendo 1.800.000 (justo), Mercado 900.000
  y Gasolina 300.000. Ahorro se aparta al planearlo (decisión 29): un rubro
  de 500.000, salvo en julio (300.000) y septiembre (ninguno).
- Sin rubro: Ropa 280.000 en julio (Ropa no tiene rubros); Comida 120.000 y
  Viajes 150.000 en octubre (Viajes está archivada).
- Agosto: una urgencia de 200.000 en Salud, cubierta con un retiro de
  200.000.
- Visa (corte 25, pago 10, 1,89 %): la "Compra TV" de 2.400.000 a 6 cuotas
  del 20 de septiembre, con primera cuota en octubre (400.000 + 45.360), y
  un gasto del mes de 85.000 en Mercado de octubre.
- Bea tiene su propio espacio con datos.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session

from app import dates
from app.models import (
    BudgetItem,
    Card,
    Category,
    Expense,
    Income,
    SavingsWithdrawal,
    utc_now,
)
from app.reports import percent, rounded_div, split_percent, window_periods

Login = Callable[..., dict[str, str]]

# 15 de noviembre de 2026 a mediodía en Bogotá.
NOVEMBER_15 = datetime(2026, 11, 15, 17, 0, tzinfo=UTC)

MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]
MERCADO = [1_040_000, 990_000, 1_005_000, 880_000, 900_000]  # + 85.000 en octubre
GASOLINA = [270_000, 260_000, 250_000, 290_000, 280_000]
AHORRO = [500_000, 300_000, 500_000, 0, 500_000]


class Casa:
    def __init__(self, client: TestClient, headers: dict[str, str]) -> None:
        self.client, self.headers = client, headers
        self.id = client.get("/spaces", headers=headers).json()[0]["id"]
        self.base = f"/spaces/{self.id}"
        self.user_id = client.get("/me", headers=headers).json()["id"]
        listed = client.get(f"{self.base}/categories", headers=headers).json()
        self.categories = {c["name"]: c["id"] for c in listed}

    def reports(self, **params: object) -> Response:
        return self.client.get(
            f"{self.base}/reports", params=params, headers=self.headers
        )

    def fill(self, engine: Engine) -> None:
        with Session(engine) as db:
            self._fill(db)
            db.commit()

    def _fill(self, db: Session) -> None:
        def category(name: str, archived: bool = False) -> int:
            row = Category(space_id=self.id, name=name)
            if archived:
                row.deleted_at = utc_now()
            db.add(row)
            db.flush()
            return row.id

        self.categories["Ropa"] = category("Ropa")
        self.categories["Viajes"] = category("Viajes", archived=True)

        def expense(amount: int, day: date, name: str, **fields: object) -> None:
            db.add(
                Expense(
                    space_id=self.id,
                    category_id=self.categories[name],
                    created_by=self.user_id,
                    amount=amount,
                    payment_type=fields.pop("payment_type", "debit"),
                    spent_on=day,
                    **fields,
                )
            )

        for index, period in enumerate(MONTHS):
            start = dates.period_bounds(period)[0]
            if period != "2026-09":
                db.add(
                    Income(
                        space_id=self.id,
                        period_start=start,
                        name="Sueldo",
                        amount=6_500_000,
                    )
                )
            items = {}
            for name, category_name, amount in [
                ("Arriendo", "Hogar", 1_800_000),
                ("Mercado", "Comida", 900_000),
                ("Gasolina", "Transporte", 300_000),
                ("Ahorro", "Ahorro", AHORRO[index]),
            ]:
                if not amount:
                    continue
                item = BudgetItem(
                    space_id=self.id,
                    period_start=start,
                    name=name,
                    category_id=self.categories[category_name],
                    amount=amount,
                )
                db.add(item)
                db.flush()
                items[name] = item
            day = start.replace(day=5)
            for name, amount in [
                ("Arriendo", 1_800_000),
                ("Mercado", MERCADO[index]),
                ("Gasolina", GASOLINA[index]),
            ]:
                db.add(
                    Expense(
                        space_id=self.id,
                        category_id=items[name].category_id,
                        budget_item_id=items[name].id,
                        created_by=self.user_id,
                        amount=amount,
                        payment_type="debit",
                        spent_on=day,
                    )
                )
            self.items = items

        expense(280_000, date(2026, 7, 12), "Ropa")
        expense(200_000, date(2026, 8, 14), "Salud")
        db.add(
            SavingsWithdrawal(
                space_id=self.id,
                spent_on=date(2026, 8, 14),
                amount=200_000,
                description="Urgencia médica",
                created_by=self.user_id,
            )
        )
        expense(120_000, date(2026, 10, 20), "Comida")
        expense(150_000, date(2026, 10, 22), "Viajes")

        visa = Card(
            space_id=self.id,
            name="Visa",
            cutoff_day=25,
            due_day=10,
            monthly_rate_bp=189,
        )
        db.add(visa)
        db.flush()
        # Deuda: llega a "Cuotas de tarjetas" desde octubre.
        expense(
            2_400_000,
            date(2026, 9, 20),
            "Hogar",
            payment_type="credit",
            card_id=visa.id,
            installments=6,
            first_due_start=date(2026, 10, 1),
            is_debt=True,
            description="Compra TV",
        )
        # Gasto del mes con la Visa en el rubro Mercado de octubre: cuenta
        # en Comida en octubre, como un débito (spec 010).
        db.add(
            Expense(
                space_id=self.id,
                category_id=self.categories["Comida"],
                budget_item_id=self.items["Mercado"].id,
                created_by=self.user_id,
                amount=85_000,
                payment_type="credit",
                spent_on=date(2026, 10, 18),
                card_id=visa.id,
                installments=1,
                first_due_start=date(2026, 11, 1),
                is_debt=False,
            )
        )


@pytest.fixture
def casa(
    client: TestClient, login: Login, engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> Casa:
    monkeypatch.setattr(dates, "now", lambda: NOVEMBER_15)
    casa = Casa(client, login("ana@example.com"))
    casa.fill(engine)
    return casa


def detail(response: Response) -> str:
    body = response.json()["detail"]
    return body if isinstance(body, str) else body[0]["msg"]


# --- Funciones puras (RF-6) ---


def test_window_periods_end_in_the_chosen_month() -> None:
    assert window_periods("2026-10", 1) == ["2026-10"]
    assert window_periods("2026-10", 6) == [
        "2026-05",
        "2026-06",
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
    ]
    assert window_periods("2026-02", 3) == ["2025-12", "2026-01", "2026-02"]


@pytest.mark.parametrize(
    ("a", "b", "expected"),
    [(5, 2, 3), (-5, 2, -3), (7, 2, 4), (4, 3, 1), (-4, 3, -1), (0, 3, 0)],
)
def test_rounded_div_rounds_half_away_from_zero(a: int, b: int, expected: int) -> None:
    assert rounded_div(a, b) == expected


def test_percent_of_nothing_is_none() -> None:
    assert percent(618_640, 6_500_000) == 10
    assert percent(-280_360, 6_500_000) == -4
    assert percent(1, 0) is None


# --- Ruta, mes y ventana (RF-3, RF-5) ---


def test_by_default_the_previous_month_and_one_month(casa: Casa) -> None:
    body = casa.reports().json()

    assert body["current"] == "2026-11"
    assert body["period"] == "2026-10"
    assert body["has_data"] is True
    assert body["savings"]["window"] == {"months": 1, "periods": ["2026-10"]}


def test_first_period_is_the_first_month_with_data(casa: Casa) -> None:
    assert casa.reports().json()["first_period"] == "2026-06"


def test_an_empty_space_has_no_first_period(
    client: TestClient, login: Login, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(dates, "now", lambda: NOVEMBER_15)
    empty = Casa(client, login("bea@example.com"))

    body = empty.reports().json()

    assert body["first_period"] is None
    assert body["has_data"] is False


@pytest.mark.parametrize("period", ["2026-11", "2026-12", "2027-01"])
def test_the_current_month_and_later_cannot_be_chosen(casa: Casa, period: str) -> None:
    response = casa.reports(period=period)

    assert response.status_code == 422
    assert detail(response) == "Elige un mes ya cerrado."


def test_a_badly_written_month_is_rejected(casa: Casa) -> None:
    response = casa.reports(period="octubre")

    assert response.status_code == 422
    assert "AAAA-MM" in detail(response)


@pytest.mark.parametrize("months", ["2", "abc", "0", "24"])
def test_the_window_is_1_3_6_or_12(casa: Casa, months: str) -> None:
    response = casa.reports(months=months)

    assert response.status_code == 422
    assert detail(response) == "La ventana debe ser de 1, 3, 6 o 12 meses."


def test_without_a_session_or_in_another_space(
    casa: Casa, client: TestClient, login: Login
) -> None:
    bea = login("bea@example.com")

    anonymous = client.get(f"{casa.base}/reports")
    foreign = client.get(f"{casa.base}/reports", headers=bea)

    assert anonymous.status_code == 401
    assert foreign.status_code == 404


def test_another_space_sees_only_its_own_data(
    casa: Casa, client: TestClient, login: Login
) -> None:
    bea = Casa(client, login("bea@example.com"))
    bea_spends = client.post(
        f"{bea.base}/expenses",
        json={
            "amount": 70_000,
            "payment_type": "debit",
            "category_id": bea.categories["Comida"],
            "spent_on": "2026-10-03",
        },
        headers=bea.headers,
    )

    body = bea.reports().json()

    assert bea_spends.status_code == 201
    assert body["savings"]["months"][0]["left"] == -70_000
    assert casa.reports().json()["savings"]["months"][0]["left"] == 2_219_640


# --- ¿Estoy ahorrando? (RF-21 a RF-23) ---


def savings_rows(body: dict) -> list[tuple]:
    return [
        (
            m["period"],
            m["empty"],
            m["income"],
            m["income_estimated"],
            m["saved"],
            m["withdrawn"],
            m["left"],
            m["total"],
            m["share"],
        )
        for m in body["savings"]["months"]
    ]


def test_savings_of_one_month(casa: Casa) -> None:
    # Octubre: gastado 1.800.000 + 1.105.000 + 280.000 + 150.000 + 500.000
    # (Ahorro) + 445.360 (cuotas) = 4.280.360; quedan 2.219.640 y, con lo
    # apartado, se ahorran 2.719.640, el 42 %.
    body = casa.reports().json()

    assert savings_rows(body) == [
        (
            "2026-10",
            False,
            6_500_000,
            False,
            500_000,
            0,
            2_219_640,
            2_719_640,
            42,
        )
    ]
    assert body["savings"]["average"] is None
    assert body["savings"]["best"] is None


def test_savings_of_six_months(casa: Casa) -> None:
    body = casa.reports(months=6).json()
    savings = body["savings"]

    assert savings["window"]["periods"] == ["2026-05", *MONTHS]
    assert savings_rows(body) == [
        ("2026-05", True, 0, False, 0, 0, 0, 0, None),
        # 6.500.000 − 3.610.000 = 2.890.000 + 500.000 apartados.
        (
            "2026-06",
            False,
            6_500_000,
            False,
            500_000,
            0,
            2_890_000,
            3_390_000,
            52,
        ),
        # Con Ropa (280.000) y 300.000 apartados.
        (
            "2026-07",
            False,
            6_500_000,
            False,
            300_000,
            0,
            2_870_000,
            3_170_000,
            49,
        ),
        # La urgencia (200.000) y el retiro (200.000) se compensan en lo
        # gastado; lo ahorrado baja en lo retirado.
        (
            "2026-08",
            False,
            6_500_000,
            False,
            500_000,
            200_000,
            2_945_000,
            3_245_000,
            50,
        ),
        # Sin ingresos planeados: los de agosto, estimados. Nada apartado.
        ("2026-09", False, 6_500_000, True, 0, 0, 3_530_000, 3_530_000, 54),
        (
            "2026-10",
            False,
            6_500_000,
            False,
            500_000,
            0,
            2_219_640,
            2_719_640,
            42,
        ),
    ]
    # Mayo no cuenta: (3.390.000 + 3.170.000 + 3.245.000 + 3.530.000 +
    # 2.719.640) / 5 = 3.210.928, el 49 % de 32.500.000.
    assert savings["average"] == {"total": 3_210_928, "share": 49}
    assert (savings["best"], savings["worst"]) == ("2026-09", "2026-10")
    # Se apartó algo en junio, julio, agosto y octubre, y no se retiró nada
    # en junio, julio y octubre (decisión 29).
    assert (savings["planned_months"], savings["untouched_months"]) == (4, 3)


def test_the_window_ends_in_the_chosen_month(casa: Casa) -> None:
    body = casa.reports(period="2026-08", months=3).json()

    assert body["period"] == "2026-08"
    assert body["savings"]["window"]["periods"] == ["2026-06", "2026-07", "2026-08"]


def test_a_month_that_spent_more_than_it_had(casa: Casa, engine: Engine) -> None:
    with Session(engine) as db:
        db.add(
            Expense(
                space_id=casa.id,
                category_id=casa.categories["Hogar"],
                created_by=casa.user_id,
                amount=3_000_000,
                payment_type="debit",
                spent_on=date(2026, 10, 25),
            )
        )
        db.commit()

    month = casa.reports().json()["savings"]["months"][0]

    # 2.219.640 − 3.000.000 = −780.360; con lo apartado, −280.360.
    assert (month["left"], month["total"], month["share"]) == (-780_360, -280_360, -4)


def test_without_any_income_the_share_is_none(
    client: TestClient, login: Login, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(dates, "now", lambda: NOVEMBER_15)
    bea = Casa(client, login("bea@example.com"))
    client.post(
        f"{bea.base}/expenses",
        json={
            "amount": 70_000,
            "payment_type": "debit",
            "category_id": bea.categories["Comida"],
            "spent_on": "2026-10-03",
        },
        headers=bea.headers,
    )

    month = bea.reports().json()["savings"]["months"][0]

    assert (month["income"], month["left"], month["share"]) == (0, -70_000, None)


# --- ¿En qué se me va la plata? (RF-14, RF-15, RF-31) ---


def spending_lines(body: dict) -> list[tuple]:
    return [
        (line["kind"], line["name"], line["deleted"], line["total"], line["share"])
        for line in body["spending"]["lines"]
    ]


def test_spending_of_october(casa: Casa) -> None:
    body = casa.reports().json()
    spending = body["spending"]

    # Comida: 900.000 + 85.000 (gasto del mes con la Visa) + 120.000 sin
    # rubro. La Compra TV no está en Hogar: es "Cuotas de tarjetas". Ahorro
    # no está en la lista.
    assert spending_lines(body) == [
        ("category", "Hogar", False, 1_800_000, 48),
        ("category", "Comida", False, 1_105_000, 29),
        ("debts", "Cuotas de tarjetas", False, 445_360, 12),
        ("category", "Transporte", False, 280_000, 7),
        ("category", "Viajes", True, 150_000, 4),
    ]
    assert spending["total"] == 3_780_360
    assert sum(line["total"] for line in spending["lines"]) == spending["total"]
    assert sum(line["share"] for line in spending["lines"]) == 100
    # Comida sin rubro y Viajes.
    assert (spending["unplanned"], spending["unplanned_share"]) == (270_000, 7)
    assert (spending["saved"], spending["withdrawn"]) == (500_000, 0)
    assert spending["lines"][2]["category_id"] is None


def test_spending_of_august_names_the_withdrawal_apart(casa: Casa) -> None:
    spending = casa.reports(period="2026-08").json()["spending"]

    assert [line["name"] for line in spending["lines"]] == [
        "Hogar",
        "Comida",
        "Transporte",
        "Salud",
    ]
    assert spending["total"] == 3_255_000
    assert (spending["saved"], spending["withdrawn"]) == (500_000, 200_000)
    assert spending["unplanned"] == 200_000


def test_spending_of_a_month_without_data(casa: Casa) -> None:
    body = casa.reports(period="2026-05").json()

    assert body["has_data"] is False
    assert body["spending"]["lines"] == []
    assert body["spending"]["total"] == 0
    assert body["spending"]["unplanned_share"] is None


@pytest.mark.parametrize(
    ("amounts", "expected"),
    [
        ([1, 1, 1], [34, 33, 33]),
        ([5], [100]),
        ([0, 0], [0, 0]),
        ([1_800_000, 1_105_000, 445_360, 280_000, 150_000], [48, 29, 12, 7, 4]),
    ],
)
def test_split_percent_adds_up_to_100(amounts: list[int], expected: list[int]) -> None:
    assert split_percent(amounts) == expected


# --- ¿Planeo bien? (RF-18 a RF-20) ---


def planning_rows(body: dict) -> list[tuple]:
    return [
        (
            row["kind"],
            row["name"],
            row["category"],
            row["planned"],
            row["spent"],
            row["diff"],
        )
        for row in body["planning"]["items"]
    ]


def test_planning_of_october(casa: Casa) -> None:
    body = casa.reports().json()

    # El gasto del mes con la Visa cuenta en el rubro Mercado; la Compra TV
    # (deuda) no aparece; Ahorro no entra (decisión 23).
    assert planning_rows(body) == [
        ("unplanned", "Viajes", "Viajes", 0, 150_000, 150_000),
        ("unplanned", "Comida", "Comida", 0, 120_000, 120_000),
        ("item", "Mercado", "Comida", 900_000, 985_000, 85_000),
        ("item", "Arriendo", "Hogar", 1_800_000, 1_800_000, 0),
        ("item", "Gasolina", "Transporte", 300_000, 280_000, -20_000),
    ]
    viajes = body["planning"]["items"][0]
    assert viajes["category_id"] == casa.categories["Viajes"]


def test_a_category_without_items_is_all_unplanned(casa: Casa) -> None:
    body = casa.reports(period="2026-07").json()

    rows = planning_rows(body)
    assert rows[0] == ("unplanned", "Ropa", "Ropa", 0, 280_000, 280_000)
    assert ("item", "Mercado", "Comida", 900_000, 990_000, 90_000) in rows
    assert all(row[2] != "Ahorro" for row in rows)


def test_a_withdrawal_is_not_an_unplanned_expense(casa: Casa) -> None:
    rows = planning_rows(casa.reports(period="2026-08").json())

    assert ("unplanned", "Salud", "Salud", 0, 200_000, 200_000) in rows
    assert [row[1] for row in rows if row[0] == "unplanned"] == ["Salud"]


def test_planning_of_a_month_without_data(casa: Casa) -> None:
    assert casa.reports(period="2026-05").json()["planning"]["items"] == []


# --- Tope de consultas (plan, "Riesgos") ---


def test_twelve_months_stay_under_300_queries(casa: Casa, engine: Engine) -> None:
    # No mide velocidad, que depende de la máquina: avisa si una consulta
    # termina dentro de un bucle (N+1).
    queries = []

    def count(*_args: object) -> None:
        queries.append(1)

    event.listen(engine, "before_cursor_execute", count)
    try:
        response = casa.reports(months=12)
    finally:
        event.remove(engine, "before_cursor_execute", count)

    assert response.status_code == 200
    assert len(queries) <= 300, len(queries)
