# Imagen de la web de gastito (etapa 014, ADR 0020).
#
# Se construye con `services/web` como contexto:
#   docker build -t gastito-web services/web
#
# Empaqueta `serve.py`, el servidor de la fase 1, que solo usa la biblioteca
# estándar: por eso no hay `pip install`. En la fase 3 lo reemplaza Nginx.
# Desplegada en Render, la web no usa esta imagen: va como sitio estático
# (render.yaml). Esta es para el stack local de `make up`.
FROM python:3.12-slim

# Ver services/api/Dockerfile para el porqué de cada variable.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /web

COPY serve.py ./
COPY public ./public

RUN useradd --system --no-create-home gastito
USER gastito

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8080\")}/', timeout=2)"

# `serve.py` exige la variable API_URL: sin ella termina con un mensaje.
CMD ["sh", "-c", "exec python serve.py --host 0.0.0.0 --port ${PORT:-8080}"]
