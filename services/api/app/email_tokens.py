"""Enlaces de un solo uso que van por correo, sin HTTP (spec 032;
principio 10).

Sirven para confirmar el correo de una cuenta que ya existe (`VERIFY`) y para
cambiar su contraseña (`RESET`). La solicitud de una cuenta nueva tiene su
propia tabla y vive en `app.accounts`.
"""

from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import EmailToken
from app.security import generate_email_token, hash_token

VERIFY = "verify"
RESET = "reset"

# Cuánto dura cada enlace (decisión 4).
LIFETIMES = {VERIFY: timedelta(hours=24), RESET: timedelta(hours=1)}

# Como mucho un correo por minuto por cuenta y por tipo (decisión 7).
COOLDOWN = timedelta(minutes=1)


def issue_token(db: Session, user_id: int, purpose: str, now: datetime) -> str | None:
    """Emite un enlace nuevo y anula los anteriores del mismo tipo. Devuelve
    el token en claro, que no se vuelve a ver, o `None` si a esa cuenta se le
    emitió otro hace menos de un minuto. No hace `commit`."""
    same = (EmailToken.user_id == user_id, EmailToken.purpose == purpose)
    last = db.scalar(
        select(EmailToken.created_at)
        .where(*same)
        .order_by(EmailToken.created_at.desc())
        .limit(1)
    )
    if last is not None and now - last < COOLDOWN:
        return None
    # Solo el último enlace sirve: pedir otro anula el que quedó en el correo.
    db.execute(
        update(EmailToken)
        .where(*same, EmailToken.used_at.is_(None))
        .values(used_at=now)
    )
    token = generate_email_token()
    db.add(
        EmailToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=hash_token(token),
            created_at=now,
            expires_at=now + LIFETIMES[purpose],
        )
    )
    db.flush()
    return token


def find_valid_token(
    db: Session, token: str, purpose: str, now: datetime
) -> EmailToken | None:
    """El enlace sin usar y sin caducar que corresponde al token, o `None`."""
    row = db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == hash_token(token), EmailToken.purpose == purpose
        )
    )
    if row is None or row.used_at is not None or row.expires_at <= now:
        return None
    return row


def claim_token(db: Session, row: EmailToken, now: datetime) -> bool:
    """Marca el enlace como usado; `False` si otra petición lo usó antes. La
    comprobación y la marca son una sola sentencia, como en las invitaciones."""
    result = db.execute(
        update(EmailToken)
        .where(EmailToken.id == row.id, EmailToken.used_at.is_(None))
        .values(used_at=now)
    )
    return result.rowcount == 1
