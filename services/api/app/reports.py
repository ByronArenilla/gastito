"""Reportes de un mes elegido (spec 013).

"¿En qué se me va la plata?" y "¿Planeo bien?" miran el mes elegido;
"¿Estoy ahorrando?", la ventana de 1, 3, 6 o 12 meses que termina en él.
Todo sale del resumen de cada mes (`build_summary`), que ya aplica las reglas
de las specs 008 a 010: aquí no se repiten (spec, "Qué NO entra").

Funciones sin HTTP (principio 10). Las consultas filtran por `space_id`.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import dates
from app.models import BudgetItem, Expense, Income
from app.savings import savings_category_ids
from app.schemas import (
    PlanningOut,
    ReportsOut,
    SavingsAverageOut,
    SavingsMonthOut,
    SavingsOut,
    SpendingLineOut,
    SpendingOut,
    SummaryOut,
    WindowOut,
)
from app.summary import build_summary

# --- Cuentas con enteros (RF-6) ---


def window_periods(period: str, months: int) -> list[str]:
    """Los `months` meses que terminan en `period`, del más antiguo al más
    reciente."""
    return [dates.shift_period(period, offset) for offset in range(1 - months, 1)]


def rounded_div(a: int, b: int) -> int:
    """`a / b` redondeado al entero, con el medio alejándose de cero: 5/2 es 3
    y −5/2 es −3. Solo con enteros (principio 6)."""
    quotient, rest = divmod(abs(a), abs(b))
    if 2 * rest >= abs(b):
        quotient += 1
    return quotient if (a >= 0) == (b > 0) else -quotient


def percent(part: int, whole: int) -> int | None:
    """`part` como porcentaje entero de `whole`; `None` si `whole` es 0."""
    return rounded_div(part * 100, whole) if whole else None


def split_percent(amounts: list[int]) -> list[int]:
    """Porcentajes enteros de cada monto sobre el total, que suman 100: el
    método del resto mayor. Los puntos que faltan van a los restos más
    grandes; a igual resto, al primero. Con total 0, todos 0."""
    total = sum(amounts)
    if not total:
        return [0] * len(amounts)
    floors = [amount * 100 // total for amount in amounts]
    rests = [amount * 100 % total for amount in amounts]
    order = sorted(range(len(amounts)), key=lambda index: (-rests[index], index))
    for index in order[: 100 - sum(floors)]:
        floors[index] += 1
    return floors


# --- Datos del espacio ---


def incomes_by_period(db: Session, space_id: int) -> dict[str, int]:
    """Ingresos planeados de cada mes del espacio que tiene alguno."""
    rows = db.execute(
        select(Income.period_start, func.sum(Income.amount))
        .where(Income.space_id == space_id)
        .group_by(Income.period_start)
    )
    return {dates.period_of(start): int(total) for start, total in rows}


def reference_income(by_period: dict[str, int], period: str) -> tuple[int, bool] | None:
    """Ingreso de referencia del mes y si es estimado: el del mes o, si no
    tiene, el del último mes anterior con ingresos. `None` si no hay."""
    if by_period.get(period):
        return by_period[period], False
    earlier = [key for key, total in by_period.items() if key < period and total]
    if not earlier:
        return None
    return by_period[max(earlier)], True


def first_period(db: Session, space_id: int) -> str | None:
    """Primer mes con un ingreso, un rubro o un gasto (RF-3)."""
    firsts = [
        db.scalar(
            select(func.min(Income.period_start)).where(Income.space_id == space_id)
        ),
        db.scalar(
            select(func.min(BudgetItem.period_start)).where(
                BudgetItem.space_id == space_id
            )
        ),
        db.scalar(
            select(func.min(Expense.spent_on)).where(Expense.space_id == space_id)
        ),
    ]
    found = [day for day in firsts if day is not None]
    return dates.period_of(min(found)) if found else None


def has_data(summary: SummaryOut) -> bool:
    """Si el mes tiene ingresos o gastos (decisión 14). Se mira lo gastado
    antes de descontar retiros: un mes que retiró todo lo apartado tiene
    datos aunque su gastado dé 0."""
    total = summary.total
    return bool(
        total.income or total.spent_planned or total.spent_unplanned or total.debts
    )


def saved_of(summary: SummaryOut, savings_ids: set[int]) -> int:
    """Lo apartado en Ahorro en el mes, sin descontar retiros."""
    return sum(
        row.spent + row.withdrawn
        for row in summary.categories
        if row.category_id in savings_ids
    )


# --- Los reportes ---


def unplanned_by_category(summary: SummaryOut) -> dict[int, int]:
    """Lo gastado sin rubro en cada categoría del mes: lo gastado en ella
    menos lo gastado en sus rubros, como el "sin rubro" del Mes de la 012.
    En Ahorro se mide antes de descontar lo retirado (decisión 19)."""
    in_items: dict[int, int] = {}
    for item in summary.budget_items:
        in_items[item.category_id] = in_items.get(item.category_id, 0) + item.spent
    return {
        row.category_id: row.spent + row.withdrawn - in_items.get(row.category_id, 0)
        for row in summary.categories
    }


def spending_report(summary: SummaryOut, savings_ids: set[int]) -> SpendingOut:
    """¿En qué se me va la plata? en el mes: lo gastado por categoría y en
    "Cuotas de tarjetas", de mayor a menor, con su parte del total. Ahorro no
    es gasto: va aparte (RF-14, RF-15, RF-31; decisiones 12 y 22)."""
    lines = [
        SpendingLineOut(
            kind="category",
            category_id=row.category_id,
            name=row.name,
            deleted=row.deleted,
            total=row.spent,
            share=0,
        )
        for row in summary.categories
        if row.spent and row.category_id not in savings_ids
    ]
    if summary.total.debts:
        lines.append(
            SpendingLineOut(
                kind="debts",
                category_id=None,
                name="Cuotas de tarjetas",
                deleted=False,
                total=summary.total.debts,
                share=0,
            )
        )
    # De mayor a menor; a igual monto, por nombre, para que el orden no
    # dependa de la base.
    lines.sort(key=lambda line: (-line.total, line.name))
    for line, share in zip(
        lines, split_percent([line.total for line in lines]), strict=True
    ):
        line.share = share

    total = sum(line.total for line in lines)
    unplanned = sum(
        amount
        for category_id, amount in unplanned_by_category(summary).items()
        if category_id not in savings_ids
    )
    return SpendingOut(
        total=total,
        unplanned=unplanned,
        unplanned_share=percent(unplanned, total),
        saved=saved_of(summary, savings_ids),
        withdrawn=summary.total.withdrawn,
        lines=lines,
    )


def planning_report(summary: SummaryOut, savings_ids: set[int]) -> PlanningOut:
    """¿Planeo bien? (T8)."""
    return PlanningOut(items=[])


def savings_report(
    summaries: list[SummaryOut], incomes: dict[str, int], savings_ids: set[int]
) -> SavingsOut:
    """¿Estoy ahorrando? en la ventana: lo apartado, lo retirado, lo que quedó
    sin gastar y lo ahorrado de cada mes (RF-21 a RF-23, decisión 24)."""
    months = []
    for summary in summaries:
        reference = reference_income(incomes, summary.period)
        income, estimated = reference or (0, False)
        saved = saved_of(summary, savings_ids)
        withdrawn = summary.total.withdrawn
        # `total.spent` ya incluye lo apartado y descuenta lo retirado.
        left = income - summary.total.spent
        total = saved - withdrawn + left
        empty = not has_data(summary)
        months.append(
            SavingsMonthOut(
                period=summary.period,
                empty=empty,
                income=0 if empty else income,
                income_estimated=estimated and not empty,
                saved=saved,
                withdrawn=withdrawn,
                saved_planned=sum(
                    item.planned
                    for item in summary.budget_items
                    if item.category_id in savings_ids
                ),
                left=0 if empty else left,
                total=0 if empty else total,
                share=None if empty or reference is None else percent(total, income),
            )
        )

    full = [month for month in months if not month.empty]
    average = best = worst = None
    if len(full) >= 2:
        total = sum(month.total for month in full)
        average = SavingsAverageOut(
            total=rounded_div(total, len(full)),
            share=percent(total, sum(month.income for month in full)),
        )
        # A igual cifra, el primero.
        best = max(full, key=lambda month: month.total).period
        worst = min(full, key=lambda month: month.total).period
    planned = [month for month in full if month.saved_planned]
    return SavingsOut(
        window=WindowOut(months=len(months), periods=[m.period for m in months]),
        months=months,
        average=average,
        best=best,
        worst=worst,
        planned_months=len(planned),
        met_months=sum(month.saved >= month.saved_planned for month in planned),
    )


def build_reports(db: Session, space_id: int, period: str, months: int) -> ReportsOut:
    """Los tres reportes del mes `period` y la ventana de `months` meses que
    termina en él. `period` y `months` deben venir validados."""
    summaries = [build_summary(db, space_id, p) for p in window_periods(period, months)]
    chosen = summaries[-1]
    savings_ids = savings_category_ids(db, space_id)
    return ReportsOut(
        current=dates.period_of(dates.today()),
        period=period,
        first_period=first_period(db, space_id),
        has_data=has_data(chosen),
        spending=spending_report(chosen, savings_ids),
        planning=planning_report(chosen, savings_ids),
        savings=savings_report(summaries, incomes_by_period(db, space_id), savings_ids),
    )
