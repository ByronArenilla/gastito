"""Ahorro: la categoría, lo apartado y lo retirado en un mes (spec 013).

Lo apartado en un mes es lo planeado en sus rubros de Ahorro: el ahorro se
aparta al planearlo y no se registra como gasto (decisión 29, RF-38). Un
retiro nunca pasa de lo apartado en su mes menos lo ya retirado (RF-33), y
por eso un rubro de Ahorro no puede bajar ni borrarse si deja lo retirado
por encima (RF-34).

Funciones sin HTTP, que se prueban con una sesión de base de datos
(principio 10). Todas las consultas filtran por `space_id` (principio 13).
"""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import dates
from app.models import BudgetItem, Category, SavingsWithdrawal, Space
from app.schemas import format_pesos

# La clave de "Ahorro" con la comparación de nombres de la 002: también es
# Ahorro una categoría llamada "ahorro" o "AHORRO" (concepto de la spec).
SAVINGS_KEY = "ahorro"


def savings_category_ids(db: Session, space_id: int) -> set[int]:
    """La categoría Ahorro del espacio, activa o archivada; vacío si no hay."""
    return set(
        db.scalars(
            select(Category.id).where(
                Category.space_id == space_id, Category.name_key == SAVINGS_KEY
            )
        )
    )


def is_savings_category(db: Session, space_id: int, category_id: int) -> bool:
    """Si la categoría es Ahorro: un gasto no puede ir en ella (RF-38)."""
    return category_id in savings_category_ids(db, space_id)


def saved_in(db: Session, space_id: int, period: str) -> int:
    """Lo apartado en Ahorro en el mes: lo planeado en sus rubros."""
    savings_ids = savings_category_ids(db, space_id)
    if not savings_ids:
        return 0
    start, _ = dates.period_bounds(period)
    total = db.scalar(
        select(func.coalesce(func.sum(BudgetItem.amount), 0)).where(
            BudgetItem.space_id == space_id,
            BudgetItem.category_id.in_(savings_ids),
            BudgetItem.period_start == start,
        )
    )
    # `int()`: en PostgreSQL, `SUM` de un `bigint` llega como `Decimal`.
    return int(total)


def withdrawn_in(
    db: Session, space_id: int, period: str, exclude_id: int | None = None
) -> int:
    """Lo retirado del ahorro en el mes, sin el retiro `exclude_id` (el que se
    está editando)."""
    start, end = dates.period_bounds(period)
    query = select(func.coalesce(func.sum(SavingsWithdrawal.amount), 0)).where(
        SavingsWithdrawal.space_id == space_id,
        SavingsWithdrawal.spent_on >= start,
        SavingsWithdrawal.spent_on < end,
    )
    if exclude_id is not None:
        query = query.where(SavingsWithdrawal.id != exclude_id)
    return int(db.scalar(query))


def lock_space(db: Session, space_id: int) -> None:
    """Bloquea el espacio hasta el `commit`: dos retiros a la vez, o un retiro
    y un cambio de lo apartado, no pasan el límite entre los dos. En SQLite
    `FOR UPDATE` no hace nada; en PostgreSQL espera a la otra transacción."""
    db.execute(select(Space.id).where(Space.id == space_id).with_for_update())


class WithdrawalTooLarge(Exception):
    """El retiro pasa de lo apartado en su mes menos lo ya retirado (RF-33)."""

    def __init__(self, period: str, saved: int, withdrawn: int) -> None:
        super().__init__(period)
        self.period, self.saved, self.withdrawn = period, saved, withdrawn

    def message(self) -> str:
        month = dates.month_label(self.period)
        if self.saved == 0:
            return f"En {month} no apartaste nada en Ahorro: no hay de dónde retirar."
        room = max(self.saved - self.withdrawn, 0)
        done = (
            f"ya retiraste $ {format_pesos(self.withdrawn)}"
            if self.withdrawn
            else "no has retirado nada"
        )
        return (
            f"En {month} apartaste $ {format_pesos(self.saved)} y {done}: "
            f"puedes retirar hasta $ {format_pesos(room)}."
        )


class SavedBelowWithdrawn(Exception):
    """Un cambio en un rubro deja lo apartado de un mes por debajo de lo
    retirado (RF-34)."""

    def __init__(self, period: str, withdrawn: int, saved_after: int) -> None:
        super().__init__(period)
        self.period, self.withdrawn, self.saved_after = period, withdrawn, saved_after

    def message(self) -> str:
        return (
            f"En {dates.month_label(self.period)} retiraste "
            f"$ {format_pesos(self.withdrawn)} del ahorro; con este cambio, lo "
            f"apartado quedaría en $ {format_pesos(max(self.saved_after, 0))}. "
            "Cambia o borra el retiro primero."
        )


def check_withdrawal(
    db: Session,
    space_id: int,
    spent_on: date,
    amount: int,
    exclude_id: int | None = None,
) -> None:
    """Lanza `WithdrawalTooLarge` si el retiro no cabe en su mes. Bloquea el
    espacio antes de medir; el `commit` lo hace la ruta."""
    lock_space(db, space_id)
    period = dates.period_of(spent_on)
    saved = saved_in(db, space_id, period)
    withdrawn = withdrawn_in(db, space_id, period, exclude_id)
    if amount > saved - withdrawn:
        raise WithdrawalTooLarge(period, saved, withdrawn)


def check_item_change(db: Session, item: BudgetItem, after: dict | None) -> None:
    """Lanza `SavedBelowWithdrawn` si cambiar el rubro a `after` (o borrarlo,
    con `None`) deja lo apartado de su mes por debajo de lo retirado.

    Se mide antes de escribir: lo guardado aún tiene los valores viejos. Un
    rubro no cambia de mes (decisión 12 de la 008), así que solo mira el
    suyo. Un rubro que no es de Ahorro no consulta nada más.
    """
    savings_ids = savings_category_ids(db, item.space_id)
    if item.category_id not in savings_ids:
        # Lo apartado solo puede subir: nada que comprobar.
        return

    new_amount = 0
    if after is not None:
        values = {"category_id": item.category_id, "amount": item.amount} | after
        if values["category_id"] in savings_ids:
            new_amount = values["amount"]
    delta = new_amount - item.amount
    if delta >= 0:
        return

    lock_space(db, item.space_id)
    period = dates.period_of(item.period_start)
    withdrawn = withdrawn_in(db, item.space_id, period)
    if not withdrawn:
        return
    saved_after = saved_in(db, item.space_id, period) + delta
    if saved_after < withdrawn:
        raise SavedBelowWithdrawn(period, withdrawn, saved_after)
