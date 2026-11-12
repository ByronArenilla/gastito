# ADR 0020 — Despliegue provisional en Render y Neon, con PostgreSQL

- Fecha: 2026-11-12
- Estado: aceptada
- Fase / spec: 2 / 014-contenedores
- Cambia: el orden del roadmap (se despliega antes de la fase 5) y, para esta
  etapa, quién escribe la infraestructura (ADR 0019)

## Contexto

La aplicación está terminada (fase 1) y la persona quiere usarla ya, desde
el celular. El roadmap la desplegaba en la fase 5 (AWS), después de Docker,
Nginx y GitHub Actions: meses sin poder usarla.

Restricciones:

- **Sin gastar dinero** en este despliegue (más estricto que el principio
  16, que permite 15 USD/mes).
- Las fases 2 a 9 siguen: la app debe poder mudarse después a la
  infraestructura que la persona construya.
- SQLite no sirve en un servicio gratuito: el disco se borra en cada
  despliegue y los datos se perderían (principio 8).
- El principio 2 prohíbe adelantar tecnología, y el ADR 0019 dice que la
  infraestructura la escribe la persona.

## Decisión

1. **Despliegue provisional, todo en planes gratuitos:**
   - la API en Render, como contenedor construido desde
     `services/api/Dockerfile`;
   - la web en Render, como sitio estático (sin contenedor);
   - la base de datos en Neon (PostgreSQL).
2. **Todo queda como código** en `render.yaml` (principio 14). Lo único que
   no está en el repositorio es `DATABASE_URL`, que se pega en el panel de
   Render (principio 12).
3. **La API habla con PostgreSQL** con el driver `psycopg`. Acepta la URL tal
   cual la entrega el proveedor (`postgresql://...`) y comprueba cada
   conexión antes de usarla, porque Neon se suspende y cierra las inactivas.
   SQLite sigue siendo la base de desarrollo y de los tests.
4. **Los datos empiezan en limpio**: no se migra la base SQLite local.
5. **Excepción al modo guiado, por petición explícita:** los Dockerfile,
   `compose.yaml` y `render.yaml` los escribió el agente para desplegar
   pronto. La etapa 014 **sigue abierta**: la persona la recorre después con
   el ciclo del modo guiado (concepto, revisión, romper y arreglar,
   preguntas), sobre estos archivos.
6. **Excepción al principio 2:** Render y Neon entran sin fase propia. Son
   provisionales: se retiran cuando la app viva en la infraestructura de la
   fase 5 en adelante.

## Alternativas descartadas

- **Esperar a la fase 5**: respeta el roadmap, pero deja la app sin usar
  durante meses y sin datos reales con los que probar las fases siguientes.
- **Render sin contenedor** (runtime nativo de Python): más corto, pero la
  imagen es justo lo que después corre en AWS y Kubernetes. Con el
  Dockerfile, mudarse es llevar la misma imagen a otro sitio.
- **La web también como contenedor en Render**: se dormiría como la API, y
  abrir la app sumaría dos arranques en frío. El sitio estático no duerme.
- **PostgreSQL gratuito de Render**: caduca a los 30 días.
- **Supabase**: su plan gratuito pausa el proyecto tras varios días sin
  uso; Neon se suspende y despierta solo.
- **Firebase** (Hosting, Auth o Firestore): un proveedor más sin ganancia.
  Auth reemplazaría la autenticación propia (ADR 0002 y 0003) y Firestore
  rompe el principio 9 y el modelo relacional.
- **Dominio propio**: evitaría cambiar de dirección al mudarse, pero cuesta
  dinero. Llega con la 020.
- **Un plan de pago en Render** (sin arranque en frío): cabe en el
  principio 16, pero la persona pidió costo cero.

## Consecuencias

**Gana:**

- La app se usa desde ya, con HTTPS. Se puede completar la verificación en
  el celular pendiente de la 011, la 012 y la 013.
- La app queda probada en PostgreSQL. Hacerlo destapó dos errores que
  SQLite y Python 3.14 ocultaban: la migración `0006` (tipos de parámetros)
  y una anotación de la `0001` que Python 3.12 no acepta.
- `make up` levanta el stack completo con PostgreSQL, y los tests de la API
  pueden correr contra él con `TEST_DATABASE_URL`.
- La mudanza futura es corta: la base puede quedarse en Neon y solo se
  mueven la imagen y la web.

**Pierde o queda pendiente:**

- **Arranque en frío**: tras 15 minutos sin uso, la primera petición a la
  API tarda cerca de un minuto. Las 750 horas gratuitas al mes alcanzan
  para mantenerla despierta con un monitor externo que llame a `/health`,
  si molesta.
- **Sin límite de peticiones** en `/auth/register` y `/auth/login` hasta la
  015 (ADR 0005): con el registro abierto y la app en internet, es el
  riesgo principal de este despliegue.
- **La dirección cambiará** al mudarse (`*.onrender.com`): habrá que fijar
  el ícono y entrar de nuevo en cada celular.
- **Sin copias de seguridad propias** hasta la 029. Neon permite restaurar
  a un punto reciente, con el límite de su plan gratuito.
- Las reglas de la web están en dos sitios: `serve.py` y `render.yaml`. Un
  cambio en las cabeceras o en las rutas hay que hacerlo en ambos.
- Lo desplegado no es un laboratorio: los ejercicios de "romper y arreglar"
  se hacen en local con `make up`, no contra la app en uso.
- La persona no escribió los Dockerfile. Para no perder el aprendizaje, en
  la 014 reescribe al menos uno desde cero y lo compara con el de esta
  etapa.
