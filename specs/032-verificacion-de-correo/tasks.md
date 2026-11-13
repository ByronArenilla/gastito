# Tareas 032 — Verificación de correo y recuperación de contraseña

- Spec: `spec.md` (aprobada) · Plan: `plan.md`
- Regla: primero los tests y luego el código. Se hicieron seguidas por
  petición explícita.

## [x] T1 — API: configuración y envío de correos
`config.py`, `app/mailer.py` y `app/emails.py`.

- Test primero (`test_config.py`, `test_mailer.py`).
- Hecho cuando: sin `EMAIL_PROVIDER` la configuración no carga, `brevo`
  exige su llave y su remitente, y el proveedor de Brevo arma bien la
  petición.
- RF: RF-13, RF-14.

## [x] T2 — API: la cuenta se crea al confirmar el correo
Migración `0009`, solicitud pendiente, `POST /auth/register` y su
`confirm`.

- Test primero (`test_registration.py`, `test_migrations.py`); los demás
  tests crean sus cuentas por el camino completo.
- RF: RF-1 a RF-4, RF-12.

## [x] T3 — API: confirmar el correo de una cuenta que ya existe
`app/email_tokens.py`, `routers/email.py` y el bloqueo de compartir.

- Test primero (`test_email_verification.py`).
- RF: RF-5 a RF-8.

## [x] T4 — API: recuperar la contraseña
- Test primero (`test_password_reset.py`).
- RF: RF-9 a RF-11.

## [x] T5 — Web: crear cuenta y confirmar
"Revisa tu correo", `/confirmar-cuenta/<token>`, el aviso, `/verificar/<token>`,
"Mi cuenta" y "Compartir".

- Test primero (`account.test.js`, `profile.test.js`, `routes.test.js`).
- RF: RF-15 a RF-18, RF-21.

## [x] T6 — Web: olvidé mi contraseña
`/olvide-mi-contrasena`, `/restablecer/<token>` y el enlace en "Entrar".

- RF: RF-19, RF-20.
