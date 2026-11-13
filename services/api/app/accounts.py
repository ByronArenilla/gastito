"""Reglas de la cuenta que no dependen de HTTP (specs 031 y 032;
principio 10).

El nombre del usuario y cómo nombra su espacio por defecto, y el camino de
una cuenta nueva: primero una solicitud pendiente y, al confirmar el enlace
del correo, la cuenta de verdad.
"""

from datetime import datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.email_tokens import COOLDOWN
from app.models import Membership, PendingRegistration, Space, User
from app.routers.categories import add_default_categories
from app.security import generate_email_token, hash_token

# Lo que dura el enlace para terminar de crear la cuenta (spec 032,
# decisión 4).
REGISTRATION_LIFETIME = timedelta(hours=24)

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


# --- Cuenta nueva (spec 032) ---


def request_registration(
    db: Session, *, email: str, name: str, password_hash: str, now: datetime
) -> str | None:
    """Guarda la solicitud de una cuenta nueva y devuelve el token de su
    enlace, que no se vuelve a ver. `None` si a ese correo se le envió otro
    hace menos de un minuto (decisión 7). No hace `commit`.

    Una solicitud nueva reemplaza la anterior del mismo correo, con su nombre,
    su contraseña y su enlace (RF-2): quien se equivocó al escribir vuelve a
    llenar el formulario.
    """
    # De paso se limpian las que caducaron: nadie las va a confirmar.
    db.execute(delete(PendingRegistration).where(PendingRegistration.expires_at <= now))
    pending = db.scalar(
        select(PendingRegistration).where(PendingRegistration.email == email)
    )
    if pending is not None and now - pending.created_at < COOLDOWN:
        return None
    token = generate_email_token()
    if pending is None:
        pending = PendingRegistration(email=email)
        db.add(pending)
    pending.name = name
    pending.password_hash = password_hash
    pending.token_hash = hash_token(token)
    pending.created_at = now
    pending.expires_at = now + REGISTRATION_LIFETIME
    db.flush()
    return token


def find_pending_registration(
    db: Session, token: str, now: datetime
) -> PendingRegistration | None:
    """La solicitud vigente que corresponde al token, o `None`."""
    pending = db.scalar(
        select(PendingRegistration).where(
            PendingRegistration.token_hash == hash_token(token)
        )
    )
    if pending is None or pending.expires_at <= now:
        return None
    return pending


def claim_pending_registration(db: Session, pending: PendingRegistration) -> bool:
    """Borra la solicitud; `False` si otra petición la confirmó antes. Borrar
    es la marca de "usada": dos confirmaciones a la vez no crean dos cuentas."""
    result = db.execute(
        delete(PendingRegistration).where(PendingRegistration.id == pending.id)
    )
    return result.rowcount == 1


def create_account(
    db: Session, *, email: str, name: str, password_hash: str, now: datetime
) -> tuple[User, Space]:
    """Crea el usuario, su espacio "Espacio de <nombre>", la membresía y las
    categorías predefinidas (RF-3 de la 001, RF-1 de la 002, RF-2 de la 031).
    Nace con el correo confirmado: solo se llega aquí por el enlace del
    correo (spec 032, RF-3). No hace `commit`: todo o nada lo decide la ruta.
    """
    user = User(
        email=email, password_hash=password_hash, name=name, email_verified_at=now
    )
    space = Space(name=default_space_name(name))
    db.add_all([user, space])
    db.flush()
    db.add(Membership(user_id=user.id, space_id=space.id))
    add_default_categories(db, space.id)
    return user, space
