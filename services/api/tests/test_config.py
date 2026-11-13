import os
import subprocess
import sys

import pytest

from app.config import (
    InvalidSettingError,
    MissingSettingError,
    Settings,
    load_settings,
)

VALID_ENV = {
    "DATABASE_URL": "sqlite://",
    "TZ": "America/Bogota",
    "WEB_BASE_URL": "http://localhost:8080",
    "EMAIL_PROVIDER": "console",
}
BREVO_ENV = {
    **VALID_ENV,
    "EMAIL_PROVIDER": "brevo",
    "BREVO_API_KEY": "llave-de-prueba",
    "EMAIL_FROM": "gastito@example.com",
}

# Variables del bot retirado (spec 007) que un `.env` viejo puede tener.
RETIRED_BOT_ENV = {"BOT_API_KEY": "k" * 32, "TELEGRAM_BOT_TOKEN": "123:abc"}


def import_config_with(env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    """Importa la configuración en un proceso nuevo con el entorno indicado."""
    known = {*BREVO_ENV, *RETIRED_BOT_ENV, "EMAIL_FROM_NAME"}
    base = {key: value for key, value in os.environ.items() if key not in known}
    return subprocess.run(
        [sys.executable, "-c", "import app.config"],
        env={**base, **env},
        capture_output=True,
        text=True,
    )


def test_import_fails_without_database_url() -> None:
    env = {key: value for key, value in VALID_ENV.items() if key != "DATABASE_URL"}
    result = import_config_with(env)

    assert result.returncode != 0
    assert "DATABASE_URL" in result.stderr


def test_import_succeeds_with_required_variables() -> None:
    result = import_config_with(VALID_ENV)

    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    "missing", ["DATABASE_URL", "TZ", "WEB_BASE_URL", "EMAIL_PROVIDER"]
)
def test_missing_variable_is_named(missing: str) -> None:
    env = {key: value for key, value in VALID_ENV.items() if key != missing}

    with pytest.raises(MissingSettingError, match=missing):
        load_settings(env)


def test_all_missing_variables_are_named() -> None:
    with pytest.raises(MissingSettingError) as error:
        load_settings({})

    assert "DATABASE_URL" in str(error.value)
    assert "TZ" in str(error.value)
    assert "WEB_BASE_URL" in str(error.value)


@pytest.mark.parametrize("value", ["", "   "])
def test_empty_value_counts_as_missing(value: str) -> None:
    with pytest.raises(MissingSettingError, match="DATABASE_URL"):
        load_settings({**VALID_ENV, "DATABASE_URL": value})


def test_settings_are_read_from_environment() -> None:
    settings = load_settings(VALID_ENV)

    assert settings == Settings(
        database_url="sqlite://",
        tz="America/Bogota",
        web_base_url="http://localhost:8080",
        email_provider="console",
    )


@pytest.mark.parametrize("value", ["Marte/Olimpo", "../Marte"])
def test_invalid_time_zone_is_named(value: str) -> None:
    # Sin esta comprobación la API arrancaría y cada petición de gastos
    # fallaría con 500 al calcular "hoy" (plan 003).
    with pytest.raises(InvalidSettingError, match="TZ"):
        load_settings({**VALID_ENV, "TZ": value})


def test_import_fails_with_invalid_time_zone() -> None:
    result = import_config_with({**VALID_ENV, "TZ": "Marte/Olimpo"})

    assert result.returncode != 0
    assert "TZ" in result.stderr


@pytest.mark.parametrize("value", ["http://localhost:8080/", "http://localhost:8080//"])
def test_trailing_slash_is_removed_from_web_base_url(value: str) -> None:
    # Sin esto, el enlace de invitación saldría con `//unirse` (RF-15).
    settings = load_settings({**VALID_ENV, "WEB_BASE_URL": value})

    assert settings.web_base_url == "http://localhost:8080"


# --- Bot retirado (spec 007) ---


def test_bot_variables_are_no_longer_required() -> None:
    # RF-2: VALID_ENV no tiene BOT_API_KEY y la configuración carga.
    assert "BOT_API_KEY" not in VALID_ENV
    assert load_settings(VALID_ENV).web_base_url == "http://localhost:8080"


def test_leftover_bot_variables_are_ignored() -> None:
    # Decisión 2: un `.env` viejo con las variables del bot no impide arrancar.
    settings = load_settings({**VALID_ENV, **RETIRED_BOT_ENV})

    assert settings == load_settings(VALID_ENV)


@pytest.mark.parametrize("value", ["", "corta"])
def test_leftover_bot_key_of_any_length_is_ignored(value: str) -> None:
    # Antes, una llave vacía o corta impedía arrancar (spec 005).
    settings = load_settings({**VALID_ENV, "BOT_API_KEY": value})

    assert settings == load_settings(VALID_ENV)


def test_import_succeeds_with_leftover_bot_variables() -> None:
    result = import_config_with({**VALID_ENV, **RETIRED_BOT_ENV})

    assert result.returncode == 0, result.stderr


# --- Proveedor de correo (spec 032, RF-13) ---


def test_console_needs_nothing_else() -> None:
    settings = load_settings(VALID_ENV)

    assert settings.email_provider == "console"
    assert (settings.brevo_api_key, settings.email_from) == (None, None)


def test_brevo_reads_its_key_and_sender() -> None:
    settings = load_settings({**BREVO_ENV, "EMAIL_FROM_NAME": "Gastito de Byron"})

    assert settings.email_provider == "brevo"
    assert settings.brevo_api_key == "llave-de-prueba"
    assert settings.email_from == "gastito@example.com"
    assert settings.email_from_name == "Gastito de Byron"


def test_the_sender_name_defaults_to_gastito() -> None:
    assert load_settings(BREVO_ENV).email_from_name == "Gastito"


@pytest.mark.parametrize("missing", ["BREVO_API_KEY", "EMAIL_FROM"])
def test_brevo_names_what_it_lacks(missing: str) -> None:
    env = {key: value for key, value in BREVO_ENV.items() if key != missing}

    with pytest.raises(MissingSettingError, match=missing):
        load_settings(env)


def test_an_unknown_provider_is_rejected() -> None:
    with pytest.raises(InvalidSettingError, match="EMAIL_PROVIDER"):
        load_settings({**VALID_ENV, "EMAIL_PROVIDER": "paloma-mensajera"})


def test_the_provider_ignores_case_and_spaces() -> None:
    assert load_settings(
        {**VALID_ENV, "EMAIL_PROVIDER": " Console "}
    ).email_provider == ("console")


def test_import_fails_without_an_email_provider() -> None:
    # Sin proveedor la API no arranca: en producción, Render deja corriendo
    # la versión anterior en vez de aceptar cuentas que nadie podría
    # confirmar (ADR 0021).
    env = {key: value for key, value in VALID_ENV.items() if key != "EMAIL_PROVIDER"}
    result = import_config_with(env)

    assert result.returncode != 0
    assert "EMAIL_PROVIDER" in result.stderr
