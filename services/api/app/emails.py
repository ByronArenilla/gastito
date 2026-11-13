"""Los correos que envía gastito (spec 032): su texto y su HTML mínimo.

El HTML es deliberadamente simple (un párrafo y un enlace): muchos clientes
de correo quitan estilos, y un correo corto con poco formato cae menos en
spam. Todo lo que viene del usuario se escapa.
"""

from html import escape

from app.mailer import Email

SPAM_NOTE = "Si no pediste esto, ignora este correo: no pasa nada."


def _build(
    to: str, subject: str, paragraphs: list[str], link: str, label: str
) -> Email:
    text = "\n\n".join([*paragraphs, f"{label}:\n{link}", SPAM_NOTE])
    html = "".join(
        [
            *(f"<p>{escape(paragraph)}</p>" for paragraph in paragraphs),
            f'<p><a href="{escape(link, quote=True)}">{escape(label)}</a></p>',
            f"<p>Si el botón no abre, copia este enlace:<br>{escape(link)}</p>",
            f"<p>{escape(SPAM_NOTE)}</p>",
        ]
    )
    return Email(to=to, subject=subject, text=text, html=html)


def registration_email(to: str, name: str, link: str) -> Email:
    """Para terminar de crear una cuenta nueva (RF-1)."""
    return _build(
        to,
        "Termina de crear tu cuenta de Gastito",
        [
            f"Hola, {name}.",
            "Falta un paso para crear tu cuenta de Gastito: confirmar que este "
            "correo es tuyo. El enlace sirve una sola vez y caduca en 24 horas.",
        ],
        link,
        "Crear mi cuenta",
    )


def verification_email(to: str, name: str | None, link: str) -> Email:
    """Para confirmar el correo de una cuenta que ya existe (RF-6)."""
    return _build(
        to,
        "Confirma tu correo de Gastito",
        [
            f"Hola, {name}." if name else "Hola.",
            "Confirma que este correo es tuyo para poder compartir espacios en "
            "Gastito. El enlace sirve una sola vez y caduca en 24 horas.",
        ],
        link,
        "Confirmar mi correo",
    )


def password_reset_email(to: str, name: str | None, link: str) -> Email:
    """Para escribir una contraseña nueva (RF-9)."""
    return _build(
        to,
        "Cambia tu contraseña de Gastito",
        [
            f"Hola, {name}." if name else "Hola.",
            "Pediste cambiar tu contraseña de Gastito. El enlace sirve una sola "
            "vez y caduca en 1 hora.",
        ],
        link,
        "Escribir una contraseña nueva",
    )
