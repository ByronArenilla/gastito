# Tareas 031 — Nombre de usuario y espacio por defecto

- Spec: `spec.md` (aprobada) · Plan: `plan.md`
- Regla: primero los tests y luego el código. Las tres se hicieron seguidas
  por petición explícita.

## [x] T1 — API: nombre al crear la cuenta y en `/me`
Modelo, migración `0008`, `app/accounts.py`, esquemas y rutas.

- Test primero (`test_accounts.py`, `test_migrations.py`).
- Hecho cuando: los tests nuevos pasan y el resto de la API sigue en verde
  enviando `name` al crear cuentas.
- RF: RF-1 a RF-7.

## [x] T2 — Web: nombre en "Crear cuenta" y "¿Cómo te llamas?"
Campo en el formulario, ruta `/tu-nombre` y el desvío en `main.js`.

- Test primero (`account.test.js`, `routes.test.js`).
- Hecho cuando: una cuenta nueva nace con su nombre y una cuenta sin nombre
  no pasa de "¿Cómo te llamas?" hasta guardarlo.
- RF: RF-8, RF-9.

## [x] T3 — Web: cambiar el nombre en "Mi cuenta"
- Hecho cuando: el nombre se cambia desde `/cuenta` y el perfil lo muestra.
- RF: RF-10.
