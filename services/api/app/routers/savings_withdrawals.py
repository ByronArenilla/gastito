"""Retiros de ahorro de un espacio: registrar, listar, ver, editar y borrar
(spec 013, RF-32 a RF-35 y RF-37).

Las reglas viven en `app/savings.py` (principio 10). Las rutas reciben el
espacio por `member_space`, nunca consultando por `space_id` directamente.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import dates
from app.db import get_db
from app.deps import current_user, member_space, requested_period
from app.models import SavingsWithdrawal, Space, User
from app.savings import WithdrawalTooLarge, check_withdrawal
from app.schemas import WithdrawalIn, WithdrawalOut, WithdrawalPatch

router = APIRouter(
    prefix="/spaces/{space_id}/savings-withdrawals", tags=["savings-withdrawals"]
)

WITHDRAWAL_NOT_FOUND = HTTPException(status.HTTP_404_NOT_FOUND, "Retiro no encontrado.")
UNCONFIRMED_DELETE = HTTPException(
    status.HTTP_400_BAD_REQUEST, "Para borrar el retiro, confirma con confirm=true."
)


def too_large(error: WithdrawalTooLarge) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error.message())


def space_withdrawal(
    withdrawal_id: int,
    space: Annotated[Space, Depends(member_space)],
    db: Annotated[Session, Depends(get_db)],
) -> SavingsWithdrawal:
    """Retiro de la ruta, solo si es del espacio: uno de otro espacio responde
    igual que uno inexistente (RF-37)."""
    withdrawal = db.scalar(
        select(SavingsWithdrawal).where(
            SavingsWithdrawal.id == withdrawal_id,
            SavingsWithdrawal.space_id == space.id,
        )
    )
    if withdrawal is None:
        raise WITHDRAWAL_NOT_FOUND
    return withdrawal


@router.post("", status_code=status.HTTP_201_CREATED)
def create_withdrawal(
    data: WithdrawalIn,
    space: Annotated[Space, Depends(member_space)],
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> WithdrawalOut:
    """Registra un retiro de lo apartado en su mes, si cabe (RF-32, RF-33)."""
    try:
        check_withdrawal(db, space.id, data.spent_on, data.amount)
    except WithdrawalTooLarge as error:
        raise too_large(error) from None
    withdrawal = SavingsWithdrawal(
        space_id=space.id,
        spent_on=data.spent_on,
        amount=data.amount,
        description=data.description,
        created_by=user.id,
    )
    db.add(withdrawal)
    db.commit()
    return WithdrawalOut.model_validate(withdrawal)


@router.get("")
def list_withdrawals(
    space: Annotated[Space, Depends(member_space)],
    db: Annotated[Session, Depends(get_db)],
    period: Annotated[str, Depends(requested_period)],
) -> list[WithdrawalOut]:
    """Retiros del mes `YYYY-MM`, por defecto el actual, del más reciente al
    más antiguo, como los gastos (RF-35)."""
    start, end = dates.period_bounds(period)
    withdrawals = db.scalars(
        select(SavingsWithdrawal)
        .where(
            SavingsWithdrawal.space_id == space.id,
            SavingsWithdrawal.spent_on >= start,
            SavingsWithdrawal.spent_on < end,
        )
        .order_by(SavingsWithdrawal.spent_on.desc(), SavingsWithdrawal.id.desc())
    )
    return [WithdrawalOut.model_validate(withdrawal) for withdrawal in withdrawals]


@router.get("/{withdrawal_id}")
def read_withdrawal(
    withdrawal: Annotated[SavingsWithdrawal, Depends(space_withdrawal)],
) -> WithdrawalOut:
    return WithdrawalOut.model_validate(withdrawal)


@router.patch("/{withdrawal_id}")
def update_withdrawal(
    data: WithdrawalPatch,
    withdrawal: Annotated[SavingsWithdrawal, Depends(space_withdrawal)],
    db: Annotated[Session, Depends(get_db)],
) -> WithdrawalOut:
    """Cambia solo lo enviado. Un cambio de monto o de fecha se mide contra
    su mes, sin contar el propio retiro (RF-33)."""
    changes = data.model_dump(exclude_unset=True)
    if "amount" in changes or "spent_on" in changes:
        try:
            check_withdrawal(
                db,
                withdrawal.space_id,
                changes.get("spent_on", withdrawal.spent_on),
                changes.get("amount", withdrawal.amount),
                exclude_id=withdrawal.id,
            )
        except WithdrawalTooLarge as error:
            raise too_large(error) from None
    for field, value in changes.items():
        setattr(withdrawal, field, value)
    db.commit()
    return WithdrawalOut.model_validate(withdrawal)


@router.delete("/{withdrawal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_withdrawal(
    withdrawal: Annotated[SavingsWithdrawal, Depends(space_withdrawal)],
    db: Annotated[Session, Depends(get_db)],
    confirm: str | None = None,
) -> Response:
    """Borra el retiro, solo con `confirm=true`, como un gasto (RF-35,
    principio 8). Borrarlo nunca deja nada por encima de un límite."""
    if confirm != "true":
        raise UNCONFIRMED_DELETE
    db.execute(
        delete(SavingsWithdrawal).where(
            SavingsWithdrawal.id == withdrawal.id,
            SavingsWithdrawal.space_id == withdrawal.space_id,
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
