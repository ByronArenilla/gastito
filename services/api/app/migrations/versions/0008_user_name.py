"""Nombre de usuario (spec 031, RF-7).

Revisión: 0008
Anterior: 0007

Añade `users.name`, nula. Las cuentas que ya existen quedan sin nombre: la
web se lo pide la próxima vez que entren (decisión 1). No se rellena con el
correo, porque un nombre inventado no se distinguiría de uno escrito. Solo
añade: no toca ninguna fila.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Una columna nula sin más: SQLite la añade sin copiar la tabla.
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("name", sa.String(50), nullable=True))


def downgrade() -> None:
    # Las migraciones no se deshacen: la vuelta atrás es restaurar la copia de
    # la base de datos (spec 008, RF-38; ADR 0011).
    raise NotImplementedError("Restaura la copia de la base de datos.")
