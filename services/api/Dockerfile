# Imagen de la API de gastito (etapa 014, ADR 0020).
#
# Se construye con `services/api` como contexto:
#   docker build -t gastito-api services/api
# https://docs.docker.com/reference/dockerfile/

# `slim` es Debian sin herramientas de compilación: pesa unas cinco veces
# menos que la imagen completa. La versión de Python es la del stack
# (AGENTS.md). Se fija 3.12 y no `latest` para que la imagen no cambie sola.
FROM python:3.12-slim

# PYTHONDONTWRITEBYTECODE: no escribe archivos .pyc (el usuario de abajo no
# puede escribir en /app, y en un contenedor no ahorran nada).
# PYTHONUNBUFFERED: cada línea de log sale al instante, no cuando se llena un
# búfer; si el proceso muere, el último mensaje no se pierde.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Las dependencias van ANTES que el código. Docker guarda cada instrucción
# como una capa y la reutiliza si sus archivos no cambiaron: así, al cambiar
# solo el código, esta capa (la lenta) sale de la caché.
# https://docs.docker.com/build/cache/
#
# `pip install .` lee las dependencias de pyproject.toml. La carpeta `app`
# vacía solo está para que setuptools no falle al buscar el paquete: el
# código de verdad se copia después y se importa desde /app.
COPY pyproject.toml ./
RUN mkdir app \
    && pip install --no-cache-dir . \
    && rm -rf app build *.egg-info

COPY app ./app

# Por defecto un contenedor corre como root. Con un usuario sin privilegios,
# quien logre ejecutar código dentro no puede modificar la aplicación ni
# instalar nada.
RUN useradd --system --no-create-home gastito
USER gastito

# Solo documenta el puerto; no lo publica (eso lo hace `-p` o Compose).
EXPOSE 8000

# Docker marca el contenedor como "unhealthy" si /health deja de responder.
# Con Python porque la imagen slim no trae curl. Render no usa esta
# instrucción: allá el chequeo es `healthCheckPath` en render.yaml.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/health', timeout=2)"

# 0.0.0.0: dentro de un contenedor, 127.0.0.1 solo se alcanza desde el propio
# contenedor.
# ${PORT:-8000}: Render asigna el puerto en la variable PORT; en local, 8000.
# Hace falta un shell para leer la variable, y `exec` reemplaza ese shell por
# uvicorn: así uvicorn es el proceso 1 y recibe la señal de apagado (SIGTERM)
# de `docker stop`, en vez de morir a la fuerza a los 10 segundos.
# Sin --reload: es solo para desarrollo. Las migraciones corren al arrancar.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
