"""Registro y sesión: entrar, identificarse y salir (RF-1 a RF-12), y el
nombre de la cuenta (spec 031)."""

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts import (
    claim_pending_registration,
    create_account,
    find_pending_registration,
    request_registration,
    set_user_name,
)
from app.config import settings
from app.db import get_db
from app.deps import current_session, current_user
from app.emails import registration_email
from app.mailer import Mailer, MailError, get_mailer
from app.models import Session as SessionRow
from app.models import User
from app.schemas import (
    LinkTokenIn,
    LoginIn,
    ProfileIn,
    RegisterIn,
    RegisterOut,
    RegistrationPendingOut,
    SpaceOut,
    TokenOut,
    UserOut,
)
from app.security import (
    SESSION_LIFETIME,
    generate_session_token,
    hash_password,
    hash_token,
    verify_password,
)

EMAIL_TAKEN = "Ya existe una cuenta con ese correo."

# Los mensajes de los enlaces que van por correo (spec 032). Los comparte
# `routers/email.py`.
REGISTRATION_SENT = (
    "Te enviamos un enlace para terminar de crear tu cuenta. "
    "Si no lo ves, revisa la carpeta de spam."
)
TOO_SOON = "Acabamos de enviarte un correo. Espera un minuto antes de pedir otro."
MAIL_FAILED = "No pudimos enviar el correo. Inténtalo de nuevo en unos minutos."
# El mismo si el enlace no existe, ya se usó o caducó.
LINK_INVALID = "Este enlace no es válido, ya se usó o caducó. Pide uno nuevo."

# Mismo mensaje falle el correo o la contraseña (RF-9).
BAD_CREDENTIALS = "Correo o contraseña incorrectos."

# Hash de una contraseña que nadie usa. Cuando el correo no existe se verifica
# igualmente contra él, para que la respuesta tarde lo mismo que con una
# contraseña equivocada y el tiempo no delate qué correos están registrados.
_DUMMY_HASH = hash_password("contraseña-que-nadie-usa")

router = APIRouter(tags=["auth"])


@router.post("/auth/register", status_code=status.HTTP_202_ACCEPTED)
def register(
    data: RegisterIn,
    db: Annotated[Session, Depends(get_db)],
    mailer: Annotated[Mailer, Depends(get_mailer)],
) -> RegistrationPendingOut:
    """Guarda la solicitud de una cuenta nueva y envía el enlace para
    terminarla. No crea nada más: la cuenta nace al confirmar el correo
    (spec 032, RF-1 y RF-2).

    El registro es abierto y no sabe nada de invitaciones (RF-1 de la 001,
    ADR 0005): quien llega por un enlace se registra y después canjea la
    invitación.
    """
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, EMAIL_TAKEN)

    try:
        token = request_registration(
            db,
            email=data.email,
            name=data.name,
            password_hash=hash_password(data.password),
            now=datetime.now(UTC),
        )
    except IntegrityError:
        # Dos solicitudes del mismo correo a la vez: una ya envió su enlace.
        db.rollback()
        token = None
    if token is None:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, TOO_SOON)

    link = f"{settings.web_base_url}/confirmar-cuenta/{token}"
    try:
        # Dentro de la petición, y antes del `commit`: si el correo no sale,
        # no queda una solicitud que nadie podría terminar (decisión 8).
        mailer.send(registration_email(data.email, data.name, link))
    except MailError:
        db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, MAIL_FAILED) from None
    db.commit()
    return RegistrationPendingOut(email=data.email, detail=REGISTRATION_SENT)


@router.post("/auth/register/confirm", status_code=status.HTTP_201_CREATED)
def confirm_registration(
    data: LinkTokenIn, db: Annotated[Session, Depends(get_db)]
) -> RegisterOut:
    """Crea la cuenta de una solicitud confirmada: usuario, espacio personal,
    membresía y categorías predefinidas en una sola transacción (RF-3 de la
    001, RF-1 de la 002; spec 032, RF-3). No inicia sesión (decisión 6)."""
    now = datetime.now(UTC)
    pending = find_pending_registration(db, data.token, now)
    if pending is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, LINK_INVALID)
    email, name, password_hash = pending.email, pending.name, pending.password_hash
    try:
        if not claim_pending_registration(db, pending):
            db.rollback()
            raise HTTPException(status.HTTP_404_NOT_FOUND, LINK_INVALID)
        user, space = create_account(
            db, email=email, name=name, password_hash=password_hash, now=now
        )
        db.commit()
    except IntegrityError:
        # Ese correo ya tiene cuenta (otra solicitud se confirmó antes): el
        # índice único lo frena y el rollback no deja nada a medias.
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, EMAIL_TAKEN) from None

    return RegisterOut(
        id=user.id,
        email=user.email,
        name=name,
        personal_space=SpaceOut.model_validate(space),
    )


def create_session(db: Session, user_id: int, lifetime: timedelta) -> TokenOut:
    """Crea una sesión que caduca tras `lifetime` y entrega su token; guarda
    solo el hash (RF-8). La usa el inicio de sesión (90 días); la duración
    sigue siendo un parámetro aunque el bot que pedía una hora se retiró
    (spec 007, decisión 4)."""
    token = generate_session_token()
    session = SessionRow(
        token_hash=hash_token(token),
        user_id=user_id,
        expires_at=datetime.now(UTC) + lifetime,
    )
    db.add(session)
    db.commit()
    return TokenOut(access_token=token, expires_at=session.expires_at)


@router.post("/auth/login")
def login(data: LoginIn, db: Annotated[Session, Depends(get_db)]) -> TokenOut:
    """Crea una sesión de 15 días y entrega su token; guarda solo el hash (RF-8)."""
    email = data.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    password_hash = user.password_hash if user else _DUMMY_HASH
    if not verify_password(password_hash, data.password) or user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, BAD_CREDENTIALS)

    return create_session(db, user.id, SESSION_LIFETIME)


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    session: Annotated[SessionRow, Depends(current_session)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    """Borra la sesión actual: el token deja de servir desde ya (RF-12)."""
    db.delete(session)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me")
def me(user: Annotated[User, Depends(current_user)]) -> UserOut:
    """Quién soy, según el token de la petición (RF-10)."""
    return UserOut.model_validate(user)


@router.patch("/me")
def update_me(
    data: ProfileIn,
    user: Annotated[User, Depends(current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> UserOut:
    """Cambia el nombre de quien llama (spec 031, RF-4). La primera vez que
    una cuenta de antes lo escribe, su espacio "Personal" toma el nombre
    nuevo (RF-5): la regla está en `app.accounts`."""
    set_user_name(db, user, data.name)
    db.commit()
    return UserOut.model_validate(user)
