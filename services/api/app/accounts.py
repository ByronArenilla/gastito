"""Reglas de la cuenta que no dependen de HTTP (spec 031; principio 10).

El nombre del usuario y cómo nombra su espacio por defecto.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Membership, Space, User

# El nombre fijo que tenía el espacio de cada cuenta antes de la spec 031
# (spec 001, decisión 7). Ya no se crea ninguno así.
LEGACY_SPACE_NAME = "Personal"


def default_space_name(name: str) -> str:
    """El espacio con el que nace una cuenta: "Espacio de Byron" (RF-2)."""
    return f"Espacio de {name}"


def set_user_name(db: Session, user: User, name: str) -> None:
    """Guarda el nombre de `user`. No hace `commit`: lo decide quien llama.

    La primera vez que una cuenta anterior a la spec escribe su nombre, su
    espacio "Personal" pasa a llamarse "Espacio de <nombre>" (RF-5): solo si
    es su único miembro, y solo el más antiguo si tiene varios. Un espacio
    compartido no se toca, porque su nombre también es de los demás.
    Cambiar el nombre después no renombra nada (RF-6).
    """
    first_time = user.name is None
    user.name = name
    if not first_time:
        return
    members = (
        select(func.count())
        .where(Membership.space_id == Space.id)
        .correlate(Space)
        .scalar_subquery()
    )
    space = db.scalars(
        select(Space)
        .join(Membership, Membership.space_id == Space.id)
        .where(
            Membership.user_id == user.id,
            Space.name == LEGACY_SPACE_NAME,
            members == 1,
        )
        .order_by(Space.id)
        .limit(1)
    ).first()
    if space is not None:
        space.name = default_space_name(name)
