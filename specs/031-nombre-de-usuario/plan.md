# Plan 031 — Nombre de usuario y espacio por defecto

- Spec: `spec.md` (aprobada el 2026-11-13)
- Sin dependencias ni servicios nuevos.

## API

- **Modelo y migración (RF-3, RF-7).** `users.name`, `String(50)`, nula. La
  migración `0008` solo añade la columna: las cuentas que existen quedan
  con `NULL` y la web les pide el nombre. No se rellena con el correo: un
  nombre inventado no se distinguiría de uno escrito.
- **Reglas en `app/accounts.py`, sin HTTP (principio 10; RF-2, RF-5, RF-6).**
  - `default_space_name(name)` → `"Espacio de <nombre>"`.
  - `set_user_name(db, user, name)`: guarda el nombre y, solo si el usuario
    no tenía, renombra su espacio "Personal" más antiguo del que es el único
    miembro. No hace `commit`: lo hace la ruta.
- **Esquemas (RF-1, RF-4).** `RegisterIn` y `ProfileIn` validan `name` con
  la misma función: sin espacios alrededor, de 1 a 50 caracteres. En
  `RegisterIn` el valor por defecto es `""`, para que un cuerpo sin `name`
  reciba el mismo mensaje en español que uno vacío.
- **Rutas.** `POST /auth/register` guarda el nombre y nombra el espacio
  (RF-1, RF-2). `GET /me` devuelve `name` (RF-3). `PATCH /me` es nueva
  (RF-4 a RF-6).

## Web

- **Crear cuenta (RF-8).** Un campo "Nombre" antes del correo;
  `account.js` lo envía.
- **"¿Cómo te llamas?" (RF-9).** Ruta `/tu-nombre`. `main.js`, después de
  cargar la cuenta, lleva ahí cualquier pantalla con sesión mientras
  `me.name` sea `null`, y recuerda a dónde iba. Al guardar, vuelve a
  cargar la cuenta: el espacio pudo cambiar de nombre.
- **Mi cuenta (RF-10).** El nombre se edita en `/cuenta`, que nace con la
  navegación nueva (fuera de esta spec).

## Tests

- `test_accounts.py`: RF-1 a RF-6 por HTTP y `set_user_name` sin HTTP.
- `test_migrations.py`: una base con usuarios pasa a `0008` sin perder
  filas y coincide con los modelos (RF-7).
- Los tests que crean cuentas envían `name`; el ayudante `login` usa el
  nombre del correo ("ana@example.com" → "Ana"), así que su espacio es
  "Espacio de Ana".
- Web: `account.test.js` (se envía el nombre) y `routes.test.js`.

## Riesgos

- **Cuentas viejas sin nombre que entran por la API y no por la web:**
  siguen funcionando; `name` es `null` hasta que alguien llame `PATCH /me`.
- **La web nueva llega a producción antes que la API nueva.** Render
  despliega las dos con el mismo commit, pero el sitio estático termina en
  segundos y la imagen de la API tarda minutos. En ese rato `GET /me` no
  trae `name`: la web solo pide el nombre cuando la API responde
  `name: null` (`needsName`), así que con la API vieja no lo pide y todo lo
  demás funciona como antes.
- **Un usuario con dos espacios "Personal" propios:** se renombra solo el
  más antiguo (RF-5).
