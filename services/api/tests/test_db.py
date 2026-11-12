"""El motor según `DATABASE_URL` (etapa 014, ADR 0020).

Los tests del motor no se conectan: `create_engine` no abre conexiones hasta
que se usa. El de las migraciones solo corre con `TEST_DATABASE_URL`
apuntando a un PostgreSQL (README, "Contenedores").
"""

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import text

from app.db import build_engine, run_migrations
from app.models import Base
from tests.conftest import TEST_DATABASE_URL


@pytest.mark.parametrize(
    "database_url",
    [
        # La que entregan Neon y casi todo proveedor de PostgreSQL.
        "postgresql://ana:secreto@db.example.com/gastito?sslmode=require",
        # El nombre corto, que SQLAlchemy ya no reconoce por sí solo.
        "postgres://ana:secreto@db.example.com/gastito",
        "postgresql+psycopg://ana:secreto@db.example.com/gastito",
    ],
)
def test_a_postgres_url_uses_the_psycopg_driver(database_url: str):
    engine = build_engine(database_url)

    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.url.host == "db.example.com"
    assert engine.url.database == "gastito"


def test_a_postgres_url_keeps_its_query_parameters():
    engine = build_engine(
        "postgresql://ana:secreto@db.example.com/gastito?sslmode=require"
    )

    assert engine.url.query == {"sslmode": "require"}


def test_a_postgres_engine_checks_each_connection_before_using_it():
    # Neon cierra las conexiones inactivas al suspenderse: sin esta
    # comprobación, la primera petición tras una pausa fallaría.
    engine = build_engine("postgresql://ana:secreto@db.example.com/gastito")

    assert engine.pool._pre_ping is True


def test_a_sqlite_url_is_left_as_it_is():
    engine = build_engine("sqlite://")

    assert engine.url.drivername == "sqlite"


@pytest.mark.skipif(
    not TEST_DATABASE_URL.startswith("postgres"),
    reason="Necesita TEST_DATABASE_URL con un PostgreSQL.",
)
def test_the_migrations_run_on_postgres_and_end_with_the_schema_of_the_models():
    # `test_migrations.py` prueba cada migración a fondo, pero en SQLite. Este
    # comprueba que todas corren también en PostgreSQL, que es más estricto
    # con los tipos (la 0006 falló ahí la primera vez), y que el resultado es
    # el esquema de los modelos.
    engine = build_engine(TEST_DATABASE_URL)
    try:
        run_migrations(engine)

        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            assert compare_metadata(context, Base.metadata) == []
    finally:
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        engine.dispose()
