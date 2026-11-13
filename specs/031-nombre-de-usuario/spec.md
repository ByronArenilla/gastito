# Spec 031 — Nombre de usuario y espacio por defecto

- Fase: 1 — Aplicación y SDD (añadida tras el despliegue provisional)
- Estado: aprobada (2026-11-13)
- Base: spec 001 (usuarios y espacios), spec 011 (app web)
- Número: el siguiente libre; del 014 al 030 son etapas del roadmap.

## Por qué

Hoy una cuenta es solo un correo y su espacio se llama siempre "Personal".
En la app nada dice quién eres, y dos personas que comparten un espacio ven
el mismo "Personal" en su lista. Con un nombre, el perfil muestra a la
persona y el espacio por defecto pasa a ser "Espacio de Byron".

## Qué entra

- Guardar un nombre por usuario.
- Pedirlo al crear la cuenta.
- Pedirlo una vez a las cuentas que ya existen.
- Cambiarlo desde "Mi cuenta".
- Nombrar el espacio por defecto "Espacio de <nombre>".

## Qué NO entra

- Verificar el correo ni recuperar la contraseña (otra spec, con su ADR).
- Renombrar un espacio a mano.
- Mostrar el nombre de quien registró cada gasto.
- La navegación nueva y el perfil: son solo de la web y van sin spec.

## Decisiones de clarificación (2026-11-13)

1. **A las cuentas que ya existen se les pide el nombre una vez**, al
   entrar, en una pantalla "¿Cómo te llamas?". Hasta que lo guarden no
   pasan a otra pantalla. Se descartó dejarlo opcional en "Mi cuenta": el
   perfil quedaría mostrando solo el correo.
2. **El espacio "Personal" que ya existe se renombra solo** a "Espacio de
   <nombre>" la primera vez que el usuario guarda su nombre, y solo si
   todavía se llama "Personal" y el usuario es su único miembro. Un espacio
   compartido o con otro nombre no se toca. Se descartó dejarlo como
   "Personal": hoy no hay forma de renombrar un espacio a mano.

Decididas al redactar la spec:

3. **El nombre es obligatorio al crear la cuenta**, de 1 a 50 caracteres
   sin contar espacios alrededor.
4. **Cambiar el nombre después no renombra ningún espacio.** El renombrado
   de la decisión 2 ocurre una sola vez, cuando el nombre pasa de vacío a
   escrito.
5. **Es un solo campo**, "Nombre". Lo que se escriba va tal cual en el
   espacio: "Byron" da "Espacio de Byron".

## Requisitos funcionales

### API

- **RF-1** CUANDO se crea una cuenta, la API DEBE exigir `name` (decisión
  3). SI falta, está vacío o pasa de 50 caracteres, ENTONCES DEBE responder
  `422` con el mensaje junto al campo.
- **RF-2** CUANDO se crea una cuenta, el espacio por defecto DEBE llamarse
  "Espacio de <nombre>".
- **RF-3** `GET /me` DEBE devolver `name`, que es `null` en una cuenta
  anterior a esta spec que aún no lo ha escrito.
- **RF-4** `PATCH /me` DEBE guardar el nombre del usuario de la sesión, con
  las mismas reglas de RF-1.
- **RF-5** CUANDO `PATCH /me` guarda el nombre de un usuario que no tenía,
  la API DEBE renombrar a "Espacio de <nombre>" su espacio llamado
  "Personal" del que es el único miembro. SI tiene varios así, ENTONCES
  solo el más antiguo (decisión 2).
- **RF-6** CUANDO el usuario ya tenía nombre, `PATCH /me` NO DEBE cambiar
  el nombre de ningún espacio (decisión 4).
- **RF-7** La migración DEBE añadir la columna sin tocar ninguna fila: las
  cuentas que existen quedan con el nombre vacío (principio 8).

### Web

- **RF-8** "Crear cuenta" DEBE pedir el nombre antes del correo.
- **RF-9** MIENTRAS la cuenta no tenga nombre, la web DEBE mostrar "¿Cómo
  te llamas?" en lugar de cualquier otra pantalla con sesión, y al guardar
  DEBE seguir a donde iba (decisión 1).
- **RF-10** "Mi cuenta" DEBE permitir cambiar el nombre.

## Criterios de validación

1. Tests de la API por cada RF-1 a RF-6, incluidos los casos de RF-5: un
   espacio "Personal" compartido y uno con otro nombre no cambian.
2. Un test de migraciones: una base de la 013 con usuarios conserva sus
   filas y el esquema coincide con los modelos (RF-7).
3. Los demás tests de la API pasan; solo cambian los que crean cuentas
   (ahora envían `name`) y los que esperaban "Personal" en una cuenta
   nueva.
4. `make test` y `make lint` en verde.
