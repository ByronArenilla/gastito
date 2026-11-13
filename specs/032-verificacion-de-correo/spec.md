# Spec 032 — Verificación de correo y recuperación de contraseña

- Fase: 1 — Aplicación y SDD (añadida tras el despliegue provisional)
- Estado: aprobada (2026-11-13): la persona pidió implementarla con Brevo
  y respondió la clarificación
- Base: spec 001 (cuentas, sesiones e invitaciones), spec 031 (nombre),
  ADR 0021 (correo con Brevo)
- Cambia: el registro de la 001 y la 031. `POST /auth/register` ya no crea
  la cuenta: la crea confirmar el enlace del correo.

## Por qué

Una cuenta se crea con cualquier correo y nadie comprueba que sea de quien
la crea. Un correo mal escrito queda así para siempre, y quien olvida su
contraseña pierde la cuenta.

## Qué entra

- Una cuenta nueva solo se crea después de confirmar el correo.
- Las cuentas que ya existen confirman el suyo con un enlace.
- A una cuenta que ya existe y no lo ha confirmado se le bloquea compartir.
- "Olvidé mi contraseña": un enlace por correo para escribir una nueva.

## Qué NO entra

- Cambiar el correo de una cuenta.
- Límite de peticiones por IP: es de la etapa 015 (reverse proxy).
- Entrar con Google.
- Avisar por correo de otras cosas (invitaciones, gastos).

## Decisiones de clarificación (2026-11-13)

1. **Una cuenta nueva no existe hasta confirmar el correo.** "Crear cuenta"
   guarda la solicitud y envía un enlace; la cuenta, su espacio y sus
   categorías se crean al confirmarlo, ya con el correo comprobado. Hasta
   entonces no se puede entrar. Se descartó crear la cuenta y dejarla sin
   confirmar: la persona pidió que no se cree.
2. **A las cuentas que ya existen también se les pide.** Quedan "sin
   confirmar", ven un aviso con "Enviar enlace" y siguen usando la app. Se
   descartó darlas por confirmadas: un correo mal escrito de antes se
   quedaría así.
3. **A una cuenta que ya existe y está sin confirmar solo se le bloquea
   compartir:** crear una invitación a un espacio y unirse al de otra
   persona. Planear, registrar y todo lo propio siguen igual. Se
   descartaron bloquearle toda la app y dejar solo un aviso.

Decididas al redactar la spec:

4. **Los enlaces de crear cuenta y de confirmar duran 24 horas; el de la
   contraseña, 1 hora.** Son de un solo uso, y pedir uno nuevo anula el
   anterior.
5. **Abrir el enlace no hace nada: hay que tocar un botón.** Igual que las
   invitaciones (ADR 0005): los filtros de correo y las vistas previas
   abren los enlaces y no deben confirmar por nadie.
6. **Confirmar la cuenta nueva no inicia sesión.** Lleva a "Entrar": así un
   enlace que llegue a manos de otra persona no le da acceso, porque no
   sabe la contraseña.
7. **Como mucho un correo por minuto** por correo y por tipo. Protege el
   cupo diario de Brevo y la bandeja de la persona.
8. **Si el correo de crear cuenta no se puede enviar, "Crear cuenta" lo
   dice** y no guarda nada: sin correo no hay forma de terminar.
9. **"Olvidé mi contraseña" responde siempre lo mismo**, exista o no la
   cuenta, y tarda lo mismo: no delata qué correos están registrados (como
   RF-9 de la 001).
10. **Cambiar la contraseña con el enlace cierra todas las sesiones** de la
    cuenta y deja el correo confirmado: quien abrió el enlace demostró que
    el correo es suyo.

## Requisitos funcionales

### Crear la cuenta

- **RF-1** `POST /auth/register` DEBE validar nombre, correo y contraseña
  como antes, guardar la solicitud con la contraseña ya cifrada y enviar al
  correo un enlace `<WEB_BASE_URL>/confirmar-cuenta/<token>`. DEBE responder
  `202` y NO DEBE crear usuario, espacio ni categorías (decisión 1).
- **RF-2** SI ya existe una cuenta con ese correo, ENTONCES `409`, como
  antes. SI se envió otro enlace a ese correo hace menos de un minuto,
  ENTONCES `429`. SI el envío falla, ENTONCES `502` y no queda ninguna
  solicitud (decisión 8). Una solicitud nueva reemplaza la anterior del
  mismo correo.
- **RF-3** `POST /auth/register/confirm` DEBE crear, en una transacción, el
  usuario con el correo confirmado, su espacio "Espacio de <nombre>", la
  membresía y las categorías predefinidas, y borrar la solicitud. SI el
  token no existe, ya se usó o caducó, ENTONCES `404`. NO DEBE iniciar
  sesión (decisión 6).
- **RF-4** MIENTRAS la cuenta no se haya confirmado, entrar con ese correo
  DEBE responder igual que con un correo que no existe.

### Cuentas que ya existen

- **RF-5** `GET /me` DEBE devolver `email_verified`. En una cuenta anterior
  a esta spec es `false` (decisión 2).
- **RF-6** `POST /me/email-verification` DEBE enviar al correo de la sesión
  un enlace `<WEB_BASE_URL>/verificar/<token>` y anular los anteriores. SI
  el correo ya está confirmado, ENTONCES `409`. SI se envió otro hace menos
  de un minuto, ENTONCES `429`. SI el envío falla, ENTONCES `502` y no
  queda ningún enlace nuevo.
- **RF-7** `POST /auth/email-verification/confirm` DEBE confirmar el correo
  de la cuenta del token, sin exigir sesión. SI el token no es válido,
  ENTONCES `404` con el mismo mensaje exista, se haya usado o haya caducado.
- **RF-8** MIENTRAS el correo no esté confirmado, crear una invitación y
  canjear una invitación DEBEN responder `403` con un mensaje que diga cómo
  confirmarlo (decisión 3). Lo demás NO DEBE cambiar.

### Contraseña

- **RF-9** `POST /auth/password-reset` DEBE responder `202` con el mismo
  mensaje exista o no la cuenta. SI existe y no se le envió otro hace menos
  de un minuto, ENTONCES DEBE enviarle `<WEB_BASE_URL>/restablecer/<token>`,
  después de responder (decisión 9).
- **RF-10** `POST /auth/password-reset/confirm` DEBE guardar la contraseña
  nueva con las reglas de la 001 (al menos 12 caracteres). SI el token no
  es válido, ENTONCES `404`; SI la contraseña no cumple, ENTONCES `422` y el
  token sigue sirviendo.
- **RF-11** CUANDO la contraseña cambia con el enlace, la API DEBE borrar
  todas las sesiones de la cuenta y dejar su correo confirmado
  (decisión 10).

### Envío y configuración

- **RF-12** La base de datos DEBE guardar solo el hash de cada token.
- **RF-13** `EMAIL_PROVIDER` es obligatoria: `console` (no envía; escribe
  el correo en la salida del proceso, para desarrollo) o `brevo`. SI falta
  o tiene otro valor, ENTONCES la API NO DEBE arrancar. Con `brevo`, SI
  falta `BREVO_API_KEY` o `EMAIL_FROM`, ENTONCES tampoco, y DEBE nombrar la
  que falta.
- **RF-14** Los tests NUNCA DEBEN enviar correos ni llamar a Brevo.

### Web

- **RF-15** "Crear cuenta" DEBE terminar en "Revisa tu correo", con el
  correo al que se envió, el aviso de mirar en spam y "Enviar otra vez".
- **RF-16** `/confirmar-cuenta/<token>` DEBE crear la cuenta al tocar un
  botón y llevar a "Entrar" con el correo ya escrito (decisiones 5 y 6).
- **RF-17** MIENTRAS el correo de una cuenta no esté confirmado, la web
  DEBE mostrar un aviso con "Enviar enlace"; "Mi cuenta" DEBE decir el
  estado del correo y "Compartir" DEBE explicar el bloqueo.
- **RF-18** `/verificar/<token>` DEBE confirmar el correo al tocar un botón,
  con o sin sesión.
- **RF-19** "Entrar" DEBE enlazar a "¿Olvidaste tu contraseña?", que pide el
  correo y muestra el mismo mensaje exista o no la cuenta.
- **RF-20** `/restablecer/<token>` DEBE pedir la contraseña nueva y, al
  guardarla, llevar a "Entrar".
- **RF-21** CON una API anterior a esta spec, la web DEBE seguir
  funcionando: si crear la cuenta responde con la cuenta ya creada, entra
  con ella como antes; si `/me` no trae `email_verified`, no muestra el
  aviso.

## Criterios de validación

1. Tests de la API por cada RF-1 a RF-14, incluidos: enlace caducado, usado
   y reemplazado por uno nuevo; el minuto de espera; el envío que falla.
2. Un test comprueba que, tras `POST /auth/register`, no existe ningún
   usuario, espacio ni categoría, y que no se puede entrar.
3. Un test comprueba que `POST /auth/password-reset` responde igual para un
   correo que existe y para uno que no.
4. Un test de migraciones: una base de la 031 con cuentas conserva sus filas
   y las deja sin confirmar.
5. El proveedor de Brevo se prueba con una conexión simulada: URL, cabecera
   `api-key` y cuerpo.
6. `make test` y `make lint` en verde.

## Requisitos para el despliegue

- `EMAIL_PROVIDER`, `BREVO_API_KEY` y `EMAIL_FROM` deben estar en el panel
  de Render **antes** de desplegar: sin `EMAIL_PROVIDER` la API nueva no
  arranca y Render deja corriendo la anterior (RF-13, RF-21).
