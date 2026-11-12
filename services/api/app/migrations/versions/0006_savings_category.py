"""Categoría "Ahorro" en los espacios que ya existen (spec 013, RF-30).

Revisión: 0006
Anterior: 0005

Desde la 013, "Ahorro" es una categoría predefinida (decisión 21). Los
espacios nuevos la reciben al crearse; esta migración se la da a los que ya
existen, para que nadie tenga que crearla a mano (principio 14).

Solo añade filas: un espacio que ya tiene una categoría con la clave
`ahorro`, activa o archivada, no se toca. Si está archivada, quien la
archivó decidió no usarla, y crearla de nuevo la restaura (spec 002). Así
tampoco choca con el índice único de nombres activos.

Se escribe en SQL y no con los modelos: una migración queda fija aunque el
modelo cambie después (plan 008).
"""

from collections.abc import Sequence
from datetime import UTC, datetime

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Copiados y no importados de `app.models`: la clave es la que da
# `category_key("Ahorro")` (spec 002, decisión 4).
NAME = "Ahorro"
NAME_KEY = "ahorro"


def upgrade() -> None:
    # INSERT ... SELECT: una fila por espacio sin la categoría, en una sola
    # sentencia. `created_at` va como parámetro en UTC y sin zona, como lo
    # guarda `UTCDateTime`; `CURRENT_TIMESTAMP` dependería de la zona de la
    # sesión en PostgreSQL. El tipo del parámetro hace que lo convierta
    # SQLAlchemy y no el adaptador de sqlite3, obsoleto desde Python 3.12.
    #
    # Los textos también llevan tipo: `:name_key` aparece dos veces, y sin él
    # PostgreSQL deduce `text` en el SELECT y `varchar` en la comparación, y
    # rechaza la sentencia por tipos inconsistentes (etapa 014). En SQLite no
    # cambia nada.
    op.get_bind().execute(
        sa.text(
            """
            INSERT INTO categories (space_id, name, name_key, created_at)
            SELECT s.id, :name, :name_key, :now
            FROM spaces AS s
            WHERE NOT EXISTS (
                SELECT 1 FROM categories AS c
                WHERE c.space_id = s.id AND c.name_key = :name_key
            )
            ORDER BY s.id
            """
        ).bindparams(
            sa.bindparam("name", type_=sa.String()),
            sa.bindparam("name_key", type_=sa.String()),
            sa.bindparam("now", type_=sa.DateTime()),
        ),
        {
            "name": NAME,
            "name_key": NAME_KEY,
            "now": datetime.now(UTC).replace(tzinfo=None),
        },
    )


def downgrade() -> None:
    # Las migraciones no se deshacen: la vuelta atrás es restaurar la copia de
    # la base de datos (spec 008, RF-38; ADR 0011).
    raise NotImplementedError("Restaura la copia de la base de datos.")
