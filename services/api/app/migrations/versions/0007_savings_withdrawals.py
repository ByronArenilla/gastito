"""Retiros de ahorro (spec 013, RF-32).

Revisión: 0007
Anterior: 0006

Crea `savings_withdrawals`: la plata que se saca de lo apartado en Ahorro en
un mes. Es una tabla propia y no una forma de gasto (ADR 0018). Solo añade:
no toca ninguna fila.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "savings_withdrawals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "space_id",
            sa.Integer(),
            sa.ForeignKey("spaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("spent_on", sa.Date(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("description", sa.String(200), nullable=True),
        sa.Column(
            "created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False
        ),
        # `UTCDateTime` es `DateTime` en la base: la zona la pone el modelo.
        sa.Column("created_at", sa.DateTime(), nullable=False),
        # Última defensa si algo salta la validación de la API.
        sa.CheckConstraint("amount > 0", name="ck_savings_withdrawals_amount_positive"),
    )
    op.create_index(
        "ix_savings_withdrawals_space_id_spent_on",
        "savings_withdrawals",
        ["space_id", "spent_on"],
    )


def downgrade() -> None:
    # Las migraciones no se deshacen: la vuelta atrás es restaurar la copia de
    # la base de datos (spec 008, RF-38; ADR 0011).
    raise NotImplementedError("Restaura la copia de la base de datos.")
