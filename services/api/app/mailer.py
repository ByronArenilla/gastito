"""Envío de correos (spec 032, ADR 0021).

Todo correo sale por un `Mailer`. Hay dos: uno que no envía y escribe el
correo en la salida del proceso (desarrollo), y el de Brevo, que llama a su
API por HTTPS con la biblioteca estándar. Las rutas lo reciben como
dependencia de FastAPI, así los tests lo cambian por uno en memoria y nunca
llaman a Brevo (RF-14).
"""

import json
import sys
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from app.config import Settings, settings

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
# Segundos que se espera a Brevo antes de dar el envío por fallido.
TIMEOUT = 10


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str
    html: str


class MailError(RuntimeError):
    """El correo no se pudo entregar al proveedor."""


class Mailer(Protocol):
    def send(self, email: Email) -> None:
        """Entrega el correo o lanza `MailError`."""


class ConsoleMailer:
    """No envía nada: escribe el correo en la salida del proceso.

    Para desarrollo: el enlace se copia de la terminal de `make run-api`.
    """

    def send(self, email: Email) -> None:
        print(
            f"--- Correo (no se envía: EMAIL_PROVIDER=console) ---\n"
            f"Para: {email.to}\nAsunto: {email.subject}\n\n{email.text}\n---",
            file=sys.stderr,
            flush=True,
        )


class BrevoMailer:
    """Envía con la API de correo transaccional de Brevo.

    https://developers.brevo.com/reference/send-transac-email
    """

    def __init__(
        self,
        api_key: str,
        sender_email: str,
        sender_name: str,
        urlopen: Callable[..., object] = urllib.request.urlopen,
    ) -> None:
        self._api_key = api_key
        self._sender = {"email": sender_email, "name": sender_name}
        # Se recibe para poder probar la petición sin salir a la red.
        self._urlopen = urlopen

    def send(self, email: Email) -> None:
        body = {
            "sender": self._sender,
            "to": [{"email": email.to}],
            "subject": email.subject,
            "textContent": email.text,
            "htmlContent": email.html,
        }
        request = urllib.request.Request(
            BREVO_URL,
            data=json.dumps(body).encode(),
            headers={
                "api-key": self._api_key,
                "content-type": "application/json",
                "accept": "application/json",
            },
            method="POST",
        )
        try:
            # `urlopen` lanza `HTTPError` con cualquier respuesta 4xx o 5xx.
            with self._urlopen(request, timeout=TIMEOUT):
                pass
        except urllib.error.HTTPError as error:
            # Solo el código: el cuerpo de Brevo puede repetir el destinatario.
            raise MailError(f"Brevo respondió {error.code}.") from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise MailError("No se pudo conectar con Brevo.") from error


def build_mailer(config: Settings) -> Mailer:
    """El proveedor que dice `EMAIL_PROVIDER` (RF-13). La configuración ya
    comprobó que `brevo` trae su llave y su remitente."""
    if config.email_provider == "brevo":
        return BrevoMailer(
            api_key=config.brevo_api_key or "",
            sender_email=config.email_from or "",
            sender_name=config.email_from_name,
        )
    return ConsoleMailer()


@lru_cache
def get_mailer() -> Mailer:
    """Dependencia de FastAPI: un solo `Mailer` para todo el proceso."""
    return build_mailer(settings)
