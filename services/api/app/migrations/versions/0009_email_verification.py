"""Verificación de correo y recuperación de contraseña (spec 032).

Revisión: 0009
Anterior: 0008

Solo añade, sin tocar ninguna fila:

- `users.email_verified_at`, nula: las cuentas que existen quedan sin
  confirmar y la web les pide hacerlo (decisión 2).
- `pending_registrations`: la solicitud de una cuenta nueva, hasta que se
  confirma el enlace del correo (decisión 1).
- `email_tokens`: los enlaces de confirmar el correo y de cambiar la
  contraseña de una cuenta que ya existe.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Una columna nula sin más: SQLite la añade sin copiar la tabla.
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("email_verified_at", sa.DateTime(), nullable=True))

    op.create_table(
        "pending_registrations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        # `UTCDateTime` es `DateTime` en la base: la zona la pone el modelo.
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("token_hash"),
    )

    op.create_table(
        "email_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("purpose", sa.String(16), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "ix_email_tokens_user_id_purpose", "email_tokens", ["user_id", "purpose"]
    )


def downgrade() -> None:
    # Las migraciones no se deshacen: la vuelta atrás es restaurar la copia de
    # la base de datos (spec 008, RF-38; ADR 0011).
    raise NotImplementedError("Restaura la copia de la base de datos.")
