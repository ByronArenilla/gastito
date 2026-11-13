# ADR 0021 — Correo transaccional con Brevo, por su API HTTP

- Fecha: 2026-11-13
- Estado: aceptada
- Fase / spec: 1 / 032-verificacion-de-correo
- Cambia: el roadmap gana un servicio externo que no estaba en ninguna fase
  (principio 2)

## Contexto

Con la app desplegada (ADR 0020), una cuenta es un correo que nadie ha
comprobado: se puede crear con un correo ajeno o mal escrito, y quien olvida
la contraseña no tiene cómo recuperarla. Verificar el correo y recuperar la
contraseña exigen enviar correos, y gastito no envía ninguno.

Restricciones:

- **Sin gastar dinero** y **sin dominio propio**: el dominio llega con la
  etapa 020.
- La API corre en el plan gratuito de Render, que **bloquea la salida a los
  puertos SMTP** (25, 465 y 587) desde septiembre de 2025.
- El principio 2 prohíbe adelantar tecnología y los límites del proyecto,
  añadir servicios que no estén en el plan.

## Decisión

1. **Los correos se envían con Brevo, por su API HTTP**
   (`POST https://api.brevo.com/v3/smtp/email`), en su plan gratuito: 300
   correos al día. Va por HTTPS, que Render no bloquea.
2. **El remitente es una dirección verificada por código en Brevo**, sin
   dominio propio. Brevo reemplaza la dirección "De" por una suya cuando el
   remitente es de un proveedor gratuito: el correo sale, pero puede caer en
   spam. Se acepta hasta la 020.
3. **Sin dependencias nuevas.** La llamada se hace con `urllib`, de la
   biblioteca estándar.
4. **El proveedor se elige por entorno** con `EMAIL_PROVIDER`
   (principio 11), que es obligatoria:
   - `console`: no envía; escribe el correo en la salida del proceso. Es
     para desarrollo: el enlace se copia de la terminal.
   - `brevo`: exige `BREVO_API_KEY` y `EMAIL_FROM`; si falta alguna, la API
     no arranca y dice cuál.

   No tiene valor por defecto a propósito. Desde la spec 032 una cuenta
   nueva solo se crea al confirmar el enlace del correo: una API en
   producción que se quedara en `console` por olvido aceptaría solicitudes
   que nadie podría terminar. Es preferible que no arranque: Render deja
   corriendo la versión anterior.
5. **La llave de Brevo es un secreto** (principio 12): se pega en el panel
   de Render, nunca en el repositorio.
6. **Se adelanta respecto al roadmap** porque no es infraestructura de una
   fase: es un requisito de la aplicación ya desplegada. Queda anotado en el
   roadmap junto a la spec 032.

## Alternativas descartadas

- **Resend:** 3.000 correos al mes, pero sin un dominio verificado solo
  envía al correo del dueño de la cuenta. Es la opción natural cuando haya
  dominio.
- **Gmail por SMTP con contraseña de aplicación:** gratis y sin dominio,
  pero Render bloquea los puertos SMTP en el plan gratuito.
- **"Continuar con Google":** verifica sin enviar nada, pero solo a quien
  entra por ese botón. Las cuentas con contraseña seguirían sin comprobar y
  sin forma de recuperar la contraseña.
- **Amazon SES:** llega con la fase 5; hoy no hay cuenta de AWS.

## Consecuencias

- **Un servicio externo más**, con su cuenta y su llave. Si Brevo falla o
  se acaba el cupo del día (300), no se pueden crear cuentas nuevas ni
  recuperar contraseñas hasta que vuelva. Quien ya tiene cuenta sigue
  usando la app sin notarlo.
- **Los correos pueden caer en spam** mientras no haya dominio propio. Las
  pantallas lo dicen.
- **Cambiar de proveedor es acotado:** todo el envío pasa por una sola
  interfaz (`app/mailer.py`). Con dominio propio basta autenticarlo en
  Brevo, o escribir otro proveedor de la misma forma.
- **En los tests no se envía nada:** un proveedor en memoria guarda los
  correos para leer sus enlaces.
- **Pendiente de comprobar al configurar la cuenta:** que Brevo acepte un
  remitente de proveedor gratuito en los envíos por API. Si no, la
  alternativa es adelantar el dominio.
