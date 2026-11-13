"""Configuración de la API, leída del entorno una sola vez al importar (RF-33).

Si falta una variable obligatoria el proceso no arranca: es preferible un
error claro al inicio que un valor por defecto silencioso que falle después.
"""

import os
from collections.abc import Mapping
from dataclasses import dataclass
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

# Solo se leen estas variables: las que sobran, como `BOT_API_KEY` en un
# `.env` de antes de la spec 007, se ignoran sin error.
REQUIRED_VARIABLES = ("DATABASE_URL", "TZ", "WEB_BASE_URL", "EMAIL_PROVIDER")

# Cómo salen los correos (spec 032, ADR 0021). `console` no envía: escribe el
# correo en la salida del proceso, para desarrollo. `brevo` envía de verdad.
EMAIL_PROVIDERS = ("console", "brevo")
# Lo que además exige cada proveedor.
PROVIDER_VARIABLES = {"console": (), "brevo": ("BREVO_API_KEY", "EMAIL_FROM")}
DEFAULT_EMAIL_FROM_NAME = "Gastito"


class MissingSettingError(RuntimeError):
    """Falta al menos una variable de entorno obligatoria."""


class InvalidSettingError(RuntimeError):
    """Una variable de entorno tiene un valor que la API no puede usar."""


@dataclass(frozen=True)
class Settings:
    database_url: str
    tz: str
    # URL pública de la web; con ella se arma el enlace de invitación (RF-15).
    web_base_url: str
    # Proveedor de correo y lo suyo (spec 032, RF-13). La llave y el
    # remitente solo existen con `brevo`.
    email_provider: str = "console"
    brevo_api_key: str | None = None
    email_from: str | None = None
    email_from_name: str = DEFAULT_EMAIL_FROM_NAME


def load_settings(environ: Mapping[str, str]) -> Settings:
    """Construye la configuración o falla nombrando cada variable que falta.

    Un valor vacío cuenta como ausente: `DATABASE_URL=` en un `.env` es un
    olvido, no una configuración válida.
    """
    missing = [name for name in REQUIRED_VARIABLES if not environ.get(name, "").strip()]
    if missing:
        names = ", ".join(missing)
        raise MissingSettingError(
            f"Faltan variables de entorno obligatorias: {names}. "
            "Defínelas en .env (copia .env.example) o en el entorno."
        )
    # Una zona mal escrita dejaría arrancar la API y cada cálculo de "hoy"
    # fallaría después (plan 003). `ValueError` cubre nombres con forma de
    # ruta, como `../Marte`, que `ZoneInfo` rechaza antes de buscarlos.
    try:
        ZoneInfo(environ["TZ"])
    except (ZoneInfoNotFoundError, ValueError) as error:
        raise InvalidSettingError(
            f"TZ no es una zona horaria válida: {environ['TZ']!r}. "
            "Usa un nombre de la base de datos IANA, por ejemplo America/Bogota."
        ) from error
    # Sin valor por defecto a propósito: una cuenta nueva solo se crea al
    # confirmar el enlace del correo, así que una API desplegada que se
    # quedara en `console` por olvido aceptaría solicitudes que nadie podría
    # terminar (ADR 0021).
    provider = environ["EMAIL_PROVIDER"].strip().lower()
    if provider not in EMAIL_PROVIDERS:
        raise InvalidSettingError(
            f"EMAIL_PROVIDER no es un proveedor de correo conocido: {provider!r}. "
            f"Usa uno de: {', '.join(EMAIL_PROVIDERS)}."
        )
    missing = [
        name
        for name in PROVIDER_VARIABLES[provider]
        if not environ.get(name, "").strip()
    ]
    if missing:
        raise MissingSettingError(
            f"Con EMAIL_PROVIDER={provider} faltan variables de entorno: "
            f"{', '.join(missing)}. Defínelas en .env o en el entorno."
        )
    return Settings(
        database_url=environ["DATABASE_URL"],
        tz=environ["TZ"],
        # Sin la `/` final: el enlace se arma como `<web_base_url>/unirse/...`
        # y no debe salir con `//unirse`.
        web_base_url=environ["WEB_BASE_URL"].strip().rstrip("/"),
        email_provider=provider,
        brevo_api_key=environ.get("BREVO_API_KEY", "").strip() or None,
        email_from=environ.get("EMAIL_FROM", "").strip() or None,
        email_from_name=environ.get("EMAIL_FROM_NAME", "").strip()
        or DEFAULT_EMAIL_FROM_NAME,
    )


settings = load_settings(os.environ)
