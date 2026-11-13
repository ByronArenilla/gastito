"""Envío de correos (spec 032, RF-13 y RF-14): nada sale a la red."""

import io
import json
import urllib.error

import pytest

from app.config import Settings
from app.emails import password_reset_email, registration_email, verification_email
from app.mailer import (
    BREVO_URL,
    BrevoMailer,
    ConsoleMailer,
    Email,
    MailError,
    build_mailer,
)

EMAIL = Email(
    to="ana@example.com",
    subject="Confirma tu correo",
    text="Abre https://web.test/verificar/abc",
    html="<p>Abre el enlace</p>",
)


class FakeResponse:
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None


def settings(**changes: object) -> Settings:
    base = {
        "database_url": "sqlite://",
        "tz": "America/Bogota",
        "web_base_url": "http://web.test",
    }
    return Settings(**(base | changes))


def test_brevo_posts_the_email_with_its_key() -> None:
    calls = []

    def urlopen(request, timeout):
        calls.append((request, timeout))
        return FakeResponse()

    BrevoMailer("llave", "gastito@example.com", "Gastito", urlopen=urlopen).send(EMAIL)

    [(request, timeout)] = calls
    assert request.full_url == BREVO_URL
    assert request.get_method() == "POST"
    assert request.get_header("Api-key") == "llave"
    assert timeout > 0
    assert json.loads(request.data) == {
        "sender": {"email": "gastito@example.com", "name": "Gastito"},
        "to": [{"email": "ana@example.com"}],
        "subject": "Confirma tu correo",
        "textContent": "Abre https://web.test/verificar/abc",
        "htmlContent": "<p>Abre el enlace</p>",
    }


def test_a_rejection_from_brevo_is_a_mail_error_without_the_body() -> None:
    def urlopen(request, timeout):
        body = io.BytesIO(b'{"message": "ana@example.com no permitido"}')
        raise urllib.error.HTTPError(BREVO_URL, 401, "Unauthorized", {}, body)

    with pytest.raises(MailError) as error:
        BrevoMailer("mala", "gastito@example.com", "Gastito", urlopen=urlopen).send(
            EMAIL
        )

    assert "401" in str(error.value)
    assert "ana@example.com" not in str(error.value)


@pytest.mark.parametrize(
    "failure", [urllib.error.URLError("sin red"), TimeoutError(), OSError("caída")]
)
def test_a_network_failure_is_a_mail_error(failure: Exception) -> None:
    def urlopen(request, timeout):
        raise failure

    with pytest.raises(MailError):
        BrevoMailer("llave", "gastito@example.com", "Gastito", urlopen=urlopen).send(
            EMAIL
        )


def test_the_console_mailer_prints_the_link(capsys: pytest.CaptureFixture[str]) -> None:
    ConsoleMailer().send(EMAIL)

    printed = capsys.readouterr().err
    assert "ana@example.com" in printed
    assert "https://web.test/verificar/abc" in printed


def test_the_provider_comes_from_the_settings() -> None:
    assert isinstance(build_mailer(settings()), ConsoleMailer)
    brevo = settings(
        email_provider="brevo", brevo_api_key="llave", email_from="gastito@example.com"
    )
    assert isinstance(build_mailer(brevo), BrevoMailer)


# --- Los textos ---


@pytest.mark.parametrize(
    "build", [registration_email, verification_email, password_reset_email]
)
def test_every_email_carries_its_link_in_text_and_html(build) -> None:
    link = "http://web.test/enlace/abc-123"

    email = build("ana@example.com", "Ana", link)

    assert email.to == "ana@example.com"
    assert link in email.text
    assert f'href="{link}"' in email.html
    assert "Ana" in email.text


def test_the_name_is_escaped_in_the_html() -> None:
    email = registration_email("ana@example.com", "<b>Ana</b>", "http://web.test/x")

    assert "<b>Ana</b>" not in email.html
    assert "&lt;b&gt;Ana&lt;/b&gt;" in email.html


def test_an_account_without_a_name_gets_a_plain_greeting() -> None:
    email = verification_email("ana@example.com", None, "http://web.test/x")

    assert email.text.startswith("Hola.")
    assert "None" not in email.text
