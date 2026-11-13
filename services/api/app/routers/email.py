"""Enlaces por correo de una cuenta que ya existe (spec 032): confirmar el
correo (RF-6, RF-7) y cambiar la contraseña (RF-9 a RF-11).

Crear una cuenta nueva, que también pasa por un enlace, está en
`routers/auth.py`.
"""

import sys
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import current_user
from app.email_tokens import RESET, VERIFY, claim_token, find_valid_token, issue_token
from app.emails import password_reset_email, verification_email
from app.mailer import Email, Mailer, MailError, get_mailer
from app.models import Session as SessionRow
from app.models import User
from app.routers.auth import LINK_INVALID, MAIL_FAILED, TOO_SOON
from app.schemas import (
    EmailConfirmedOut,
    LinkTokenIn,
    MessageOut,
    PasswordResetIn,
    PasswordResetRequestIn,
)
from app.security import hash_password

ALREADY_VERIFIED = "Tu correo ya está confirmado."
VERIFICATION_SENT = (
    "Te enviamos un enlace para confirmar tu correo. "
    "Si no lo ves, revisa la carpeta de spam."
)
# El mismo exista o no la cuenta (decisión 9).
RESET_SENT = (
    "Si hay una cuenta con ese correo, le enviamos un enlace para cambiar la "
    "contraseña. Si no lo ves, revisa la carpeta de spam."
)
PASSWORD_CHANGED = "Contraseña cambiada. Ya puedes entrar con la nueva."

router = APIRouter(tags=["email"])


def send_quietly(mailer: Mailer, email: Email) -> None:
    """Envía después de responder. Si falla, queda en la salida del proceso y
    nada más: quien pidió el enlace ya recibió la misma respuesta de siempre
    (decisión 9). Nunca escribe el destinatario ni el enlace."""
    try:
        mailer.send(email)
    except MailError as error:
        print(f"No se pudo enviar un correo: {error}", file=sys.stderr, flush=True)


@router.post("/me/email-verification", status_code=status.HTTP_202_ACCEPTED)
def request_email_verification(
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
    mailer: Annotated[Mailer, Depends(get_mailer)],
) -> MessageOut:
    """Envía un enlace nuevo al correo de la sesión y anula los anteriores
    (RF-6)."""
    if user.email_verified:
        raise HTTPException(status.HTTP_409_CONFLICT, ALREADY_VERIFIED)
    token = issue_token(db, user.id, VERIFY, datetime.now(UTC))
    if token is None:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_SOON)
    link = f"{settings.web_base_url}/verificar/{token}"
    try:
        # Antes del `commit`: si el correo no sale, no queda un enlace que
        # nadie recibió y el anterior sigue sirviendo.
        mailer.send(verification_email(user.email, user.name, link))
    except MailError:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, MAIL_FAILED) from None
    db.commit()
    return MessageOut(detail=VERIFICATION_SENT)


@router.post("/auth/email-verification/confirm")
def confirm_email(
    data: LinkTokenIn, db: Annotated[Session, Depends(get_db)]
) -> EmailConfirmedOut:
    """Confirma el correo de la cuenta del enlace. Sin sesión: el correo se
    puede abrir en otro dispositivo (RF-7)."""
    now = datetime.now(UTC)
    row = find_valid_token(db, data.token, VERIFY, now)
    if row is None or not claim_token(db, row, now):
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, LINK_INVALID)
    user = db.get_one(User, row.user_id)
    if user.email_verified_at is None:
        user.email_verified_at = now
    db.commit()
    return EmailConfirmedOut(email=user.email)


@router.post("/auth/password-reset", status_code=status.HTTP_202_ACCEPTED)
def request_password_reset(
    data: PasswordResetRequestIn,
    background: BackgroundTasks,
    db: Annotated[Session, Depends(get_db)],
    mailer: Annotated[Mailer, Depends(get_mailer)],
) -> MessageOut:
    """Envía el enlace para cambiar la contraseña, si la cuenta existe. La
    respuesta es la misma en todos los casos (RF-9)."""
    email = data.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is not None:
        token = issue_token(db, user.id, RESET, datetime.now(UTC))
        if token is not None:
            db.commit()
            link = f"{settings.web_base_url}/restablecer/{token}"
            # Después de responder: hablar con Brevo tarda, y esa demora solo
            # ocurriría cuando la cuenta existe.
            background.add_task(
                send_quietly, mailer, password_reset_email(user.email, user.name, link)
            )
    return MessageOut(detail=RESET_SENT)


@router.post("/auth/password-reset/confirm")
def confirm_password_reset(
    data: PasswordResetIn, db: Annotated[Session, Depends(get_db)]
) -> MessageOut:
    """Guarda la contraseña nueva, cierra todas las sesiones de la cuenta y
    deja su correo confirmado (RF-10, RF-11). Una contraseña que no cumple
    responde `422` antes de llegar aquí, sin gastar el enlace."""
    now = datetime.now(UTC)
    row = find_valid_token(db, data.token, RESET, now)
    if row is None or not claim_token(db, row, now):
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, LINK_INVALID)
    user = db.get_one(User, row.user_id)
    user.password_hash = hash_password(data.password)
    # Quien abrió el enlace demostró que el correo es suyo (decisión 10).
    if user.email_verified_at is None:
        user.email_verified_at = now
    db.execute(delete(SessionRow).where(SessionRow.user_id == user.id))
    db.commit()
    return MessageOut(detail=PASSWORD_CHANGED)
