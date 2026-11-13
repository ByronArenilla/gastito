# Plan 032 — Verificación de correo y recuperación de contraseña

- Spec: `spec.md` (aprobada el 2026-11-13) · ADR 0021
- Dependencias nuevas: ninguna. Servicio nuevo: Brevo (ADR 0021).

## API

- **Configuración (RF-13).** `config.py` lee `EMAIL_PROVIDER`
  (obligatoria), `BREVO_API_KEY`, `EMAIL_FROM` y `EMAIL_FROM_NAME` (por
  defecto "Gastito"). Las de Brevo solo son obligatorias con `brevo`.
- **Envío (`app/mailer.py`).** Una interfaz `Mailer.send(email)` con dos
  proveedores: `ConsoleMailer` (escribe el correo en la salida del proceso)
  y `BrevoMailer` (`urllib` contra la API de Brevo, 10 s de espera; lanza
  `MailError`). `get_mailer` es una dependencia de FastAPI: los tests la
  reemplazan por una lista en memoria (RF-14).
- **Textos (`app/emails.py`).** Los tres correos (crear cuenta, confirmar
  y contraseña), en texto y en HTML mínimo.
- **Modelo y migración `0009` (RF-5, RF-12).** Solo añade:
  - `users.email_verified_at`, nula;
  - `pending_registrations`: la solicitud de una cuenta nueva (correo
    único, nombre, hash de la contraseña, hash del token y caducidad);
  - `email_tokens`: enlaces de una cuenta que ya existe (usuario, propósito
    `verify` o `reset`, hash del token, creación, caducidad y uso).
- **Reglas sin HTTP (principio 10).**
  - `app/email_tokens.py`: emitir (con el minuto de espera y anulando los
    anteriores), buscar uno vigente y marcarlo usado en una sola sentencia,
    como las invitaciones.
  - `app/accounts.py`: `create_account` (usuario, espacio, membresía y
    categorías; antes estaba dentro de la ruta) y la solicitud pendiente.
- **Rutas.** `POST /auth/register` y su `confirm` en `routers/auth.py`
  (RF-1 a RF-3); las otras cuatro en `routers/email.py` (RF-6, RF-7, RF-9,
  RF-10). El envío de RF-1 y RF-6 ocurre dentro de la petición, para poder
  decir que falló. El de RF-9 va en una tarea de fondo de FastAPI
  (`BackgroundTasks`), que corre después de responder: así la respuesta no
  tarda distinto si la cuenta existe (decisión 9).
- **Bloqueo (RF-8).** Una dependencia `verified_user` en `deps.py`, usada
  en crear y canjear invitaciones.

## Web

- `account.js`: `signUp` ya no entra; devuelve si quedó pendiente (o, con
  una API anterior, entra como antes: RF-21). Además confirmar la cuenta,
  pedir el enlace, confirmar el correo, y pedir y guardar la contraseña.
- `profile.js`: `needsVerification(me)`, verdadero solo con
  `email_verified === false` (RF-21).
- "Crear cuenta" pasa a "Revisa tu correo" (RF-15).
- Aviso de "confirma tu correo" en el contenedor de avisos (RF-17).
- Pantallas `/confirmar-cuenta/<token>`, `/verificar/<token>`,
  `/olvide-mi-contrasena` y `/restablecer/<token>` (RF-16, RF-18 a RF-20).
- "Mi cuenta" muestra el estado y el botón; "Compartir" explica el bloqueo.

## Tests

- `test_email_verification.py`, `test_password_reset.py`, `test_mailer.py`,
  `test_config.py` y `test_migrations.py`.
- `conftest.py`: un buzón en memoria (`outbox`). `login()` hace el camino
  completo: solicitud, enlace del buzón, confirmar y entrar. Los tests de
  cuentas anteriores a la spec les quitan la confirmación en la base.
- Web: `account.test.js`, `profile.test.js`, `routes.test.js`.

## Riesgos

- **Brevo no acepta el remitente gratuito por API** (ADR 0021): se sabrá al
  configurar la cuenta. El código no cambia; cambia el remitente.
- **El correo cae en spam:** las pantallas lo avisan.
- **El enlace llega a otro dispositivo:** confirmar no exige sesión.
- **Quien llega por una invitación y crea su cuenta** ya no vuelve solo a
  la invitación: confirma, entra y abre otra vez el enlace que le
  compartieron.
- **La web nueva con la API vieja** durante un despliegue: RF-21. **La API
  nueva sin `EMAIL_PROVIDER`** no arranca y Render deja la anterior.
- **Token en la URL:** la web ya envía `Referrer-Policy: no-referrer`, y el
  enmascarado en los logs del proxy es de la etapa 015.
