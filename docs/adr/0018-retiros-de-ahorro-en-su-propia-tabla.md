# ADR 0018 — Retiros de ahorro en su propia tabla

- Fecha: 2026-11-10
- Estado: aceptada
- Fase / spec: 1 / 013-reportes

## Contexto

Al revisar el prototipo de la 013, la persona decidió que "Ahorro" es una
categoría: lo apartado se planea como un rubro y se registra como un gasto
(decisión 21). Pidió además registrar cuándo se saca plata de lo apartado:
"separé $ 200.000 y en el mes tocó tomar $ 100.000" (decisiones 25 a 28).

Un retiro tiene monto, fecha, nota y quién lo registró, pero no categoría,
rubro ni tipo de pago: siempre sale de Ahorro. Resta de Ahorro en el Mes y
en los reportes, y nunca pasa de lo apartado en su mes.

## Decisión

1. **Los retiros van en una tabla propia**, `savings_withdrawals`, con sus
   rutas (`/spaces/{id}/savings-withdrawals`) y su migración (0007).
2. **El límite se comprueba en la API** (`app/savings.py`): un retiro no
   pasa de lo apartado en su mes menos lo ya retirado, y editar o borrar un
   gasto de Ahorro no puede dejar lo retirado por encima (`409`). Las dos
   comprobaciones bloquean la fila del espacio (`SELECT … FOR UPDATE`)
   hasta el `commit`, para que dos peticiones a la vez no pasen el límite.
3. **El resumen descuenta lo retirado** de la categoría Ahorro, de lo
   gastado y del balance, y lo da aparte (`withdrawn`). Lo no planeado se
   mide antes de descontarlo.

## Alternativas descartadas

- **Un gasto con monto negativo**: el resumen sumaría bien sin cambios,
  pero todas las reglas de gastos (monto mayor que 0, la `CHECK` de la
  base, tarjetas, rubros, la lista de Gastos) tendrían una excepción.
- **Una marca en `expenses`** (`kind = 'withdrawal'`): obligaría a volver
  nulas columnas que hoy son obligatorias (tipo de pago) y a cuidar en cada
  consulta de gastos que un "gasto" no sea un retiro. Un error ahí cambia
  los totales en silencio.
- **No registrar el retiro**: el reporte lo vería como "faltó" y el neto
  sería el mismo, pero no diría que la plata salió del ahorro. La persona
  lo descartó.

## Consecuencias

- Los gastos no cambian: ninguna regla de las specs 003 a 010 tiene una
  excepción. El precio es una ruta más y que Gastos pida dos listas y las
  mezcle por fecha.
- El límite ata lo apartado: para borrar un gasto de Ahorro de un mes con
  retiros hay que cambiar antes el retiro. El mensaje del `409` lo dice.
- gastito sigue sin llevar el saldo total del ahorro; por eso un retiro solo
  puede salir de lo apartado en su mes (decisión 28).
- Aprendí a bloquear una fila "padre" para proteger un límite que depende de
  varias filas, y que en SQLite `FOR UPDATE` no hace nada: el test prueba la
  regla, no la concurrencia.
