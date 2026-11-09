# Tareas 012 — Tablero y planear

- Spec: `spec.md` (aprobada) · Plan: `plan.md` (aprobado)
- Regla: una tarea por vez, primero los tests y luego el código. Al
  terminarla, marcarla, ejecutar `make test` y `make lint`, y detenerse.
- Orden: primero el prototipo (T1), que puede cambiar la spec y el plan;
  luego la navegación (T2) y, para cada pantalla, su lógica sin DOM antes
  que su vista: Mes (T3, T4), Planear (T5, T6), Tarjetas (T7, T8), compras
  y abonos (T9) y categorías (T10). Al final, la revisión de diseño (T11),
  el ADR (T12) y el cierre (T13).
- Las pantallas se verifican a mano con `verificacion.md`, que crea T2.

## [x] T1 — Prototipo de Mes, Planear, Tarjetas y una compra
Una página HTML desechable con los datos de ejemplo de la spec (noviembre
2026: ingresos $ 6.500.000, Mercado $ 520.000 de $ 900.000, Gasolina
excedida en $ 40.000, $ 120.000 sin rubro en Comida, la Visa con
$ 1.020.000 a pagar y la "Compra TV" a 6 cuotas con un abono), con los
tokens y las fuentes de la 011, a 360 y a 1280 px y en los dos temas.

- Test primero: no aplica, es un prototipo y no entra al repositorio.
- Se publica para verlo en el navegador y elegir. Lo que cambie se anota en
  la spec y el plan antes de T2.
- Comprobar en el prototipo: que las cinco secciones caben a 360 px, que
  guardar al salir del renglón se entiende, y que la barra del ingreso y
  los medidores se leen en los dos temas.
- Hecho cuando: el usuario aprueba el prototipo y los cambios están en la
  spec y el plan.
- RF: RF-1, RF-5 a RF-9, RF-12, RF-19, RF-21, RF-24 (diseño).
- Estado (2026-11-09): aprobado por el usuario
  (https://claude.ai/artifact/383JYBEUT4FuALKPJnxWdB). Las cinco secciones
  caben en 360 px; el prototipo mostró que el menú lateral necesitaba
  volver a `flex-start`, y movió "Quitar" junto al monto en el celular.
  Anotado en el plan, sección "Diseño".

## [x] T2 — Navegación, inicio y mes compartido
`index.html` con Mes y Tarjetas; `routes.js` con las rutas nuevas y
`homePath()`; `main.js` con las secciones y el inicio por ancho;
`manifest.webmanifest` con `start_url: "/"`; el mes elegido como `period` en
`app.drafts`, usado por Gastos; vistas vacías de Mes y Tarjetas;
`specs/012-tablero-y-planear/verificacion.md` con la lista del criterio 4.

- Test primero:
  - `routes.test.js`: `/mes`, `/mes/planear`, `/tarjetas`, `/tarjetas/nueva`,
    `/tarjetas/3`, `/tarjetas/3/editar` y `/compras/12` con sus parámetros;
    `homePath(1280)` es `/mes`, `homePath(1024)` es `/mes` y `homePath(390)`
    es `/registrar`; una ruta desconocida va a `homePath`.
  - `test_serve.py`: `start_url` es `/`; las rutas nuevas devuelven
    `index.html`.
- Verificación a mano: cinco secciones a 360 px sin cortar palabras y al
  costado a 1280 px; `/` abre el Mes en el computador y Registrar a 390 px;
  cambiar de mes en Gastos y abrir el Mes muestra el mismo mes.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-1 a RF-4.

## [x] T3 — Lógica del tablero
`dashboard.js` con `buildDashboard(summary)`.

- Test primero (`dashboard.test.js`, con el resumen de ejemplo del plan):
  - Totales y lo que hay que pagar a las tarjetas.
  - La barra del ingreso: rubros, deudas y sin asignar suman el ingreso; con
    un plan que supera el ingreso, `over` es la diferencia.
  - Medidores: Mercado lleno al 58 % y queda $ 380.000; Gasolina llena,
    excedida y `remaining` −40.000; un rubro con planeado 0 y gasto,
    excedido.
  - "Sin rubro": $ 120.000 en Comida; Hogar no lo tiene.
  - Mes sin rubros ni ingresos: `empty`.
  - Tarjeta archivada con `deleted`.
- `contrast.test.js`: `--ink` y `--rule-strong` sobre `--paper` pasan 3:1 en
  los dos temas.
- Hecho cuando: los tests pasan.
- RF: RF-5 a RF-9.

## [x] T4 — Pantalla Mes
`views/month.js` (tablero), las barras, medidores y leyenda en `app.css`,
el mes vacío y copiar el plan.

- Test primero: lo cubre T3; si aparece lógica nueva (por ejemplo, el texto
  de los rubros omitidos al copiar), va a `dashboard.js` con su test.
- Verificación a mano: el tablero de noviembre con el ejemplo; Gasolina
  dice "excedido −40.000" en rojo; un plan que supera el ingreso lo dice;
  un mes vacío ofrece copiar y planear en blanco; copiar trae el plan y
  dice qué rubros omitió; copiar sin plan en el mes anterior muestra el
  mensaje de la API; una tarjeta archivada enlaza a su estado; tema oscuro.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-5 a RF-11.

## [ ] T5 — Lógica de Planear
`plan-rows.js`: `rowRequest`, `needsConfirm` y `statementRequest`.

- Test primero (`plan-rows.test.js`):
  - Rubro nuevo completo → `create` con `period`, nombre, categoría y monto
    como entero ("1.800.000" → 1800000).
  - Rubro nuevo sin categoría → `none` con `missing: ["categoría"]`.
  - Rubro existente con otro monto → `update` solo con `amount`; sin
    cambios → `none`.
  - Ingreso nuevo y existente, con las mismas reglas sin categoría.
  - `needsConfirm`: un rubro con gastos sí; uno sin gastos, no.
  - Extracto escrito → `put`; vacío con valor previo → `delete`; igual al
    guardado → `none`.
- Hecho cuando: los tests pasan.
- RF: RF-13 a RF-17.

## [ ] T6 — Pantalla Planear
Modo Planear en `views/month.js`: renglones como `<fieldset>`, guardado en
`focusout`, "Añadir ingreso", "Añadir rubro", "Quitar", extractos y
"Listo".

- Test primero: lo cubre T5.
- Verificación a mano: planear un mes en blanco con dos ingresos y tres
  rubros solo con teclado; cambiar el monto de un rubro y ver "Guardado";
  un renglón a medias dice qué falta y no se crea; un nombre repetido
  muestra el mensaje de la API junto al campo; quitar un rubro con gastos
  pide confirmación y sus gastos quedan sin rubro; escribir y quitar el
  extracto de la Visa; "Listo" guarda el renglón abierto; dos clics rápidos
  no crean dos rubros.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-12 a RF-18.

## [ ] T7 — Tarjetas: lista, añadir, editar y eliminar
`cards.js` (`cardForm`, `cardLine`) y `views/cards.js` con la lista, el
formulario y eliminar; el enlace de Registrar sin tarjetas.

- Test primero (`cards.test.js`):
  - `cardForm`: tasa "1,89" → 1.89; vacía → `null`; días como enteros;
    sin nombre, `missing`.
  - `cardLine`: "corte 25 · paga el 10 · 1,89 % mensual" y sin tasa.
- Verificación a mano: añadir la Visa; un día 32 muestra el mensaje de la
  API junto al campo; editar la tasa; eliminar pide confirmación y muestra
  el mensaje de la API; crearla de nuevo con el mismo nombre la restaura;
  sin tarjetas, Registrar a crédito enlaza a añadir una.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-19, RF-20, RF-22, RF-30.

## [ ] T8 — Estado de la tarjeta y pagar todo
La pantalla `/tarjetas/<id>` y "Pagar todo" con `payoffText`.

- Test primero (`cards.test.js`): `payoffText` dice la tarjeta, el mes y
  que las compras posteriores al corte siguen llegando.
- Verificación a mano: el estado de la Visa con sus compras y sus meses;
  un mes con extracto lo marca; pagar todo pide confirmación, crea los
  abonos y lo dice; pagar todo sin compras muestra el mensaje de la API; el
  estado de una tarjeta archivada se abre desde el Mes.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-21, RF-23.

## [ ] T9 — Compras con tarjeta y abonos
`purchases.js` y `views/purchase.js`: plan de cuotas, abonar con
"Deshacer", borrar un abono; "Ver cuotas y abonos" desde Gastos y el enlace
en el bloqueo de una compra con abonos.

- Test primero:
  - `purchases.test.js`: `prepaymentMonths` sin abonos (todos los meses con
    saldo después) y con un abono en enero (solo desde febrero);
    `prepaymentEffect` con plazo ("Ahora termina en marzo, no en mayo.") y
    con cuota ("Ahora la cuota es $ 200.000, no $ 300.000.").
  - `expense-form.test.js`: la razón del bloqueo trae el enlace a
    `/compras/<id>`.
- Verificación a mano: abonar $ 600.000 en enero a la "Compra TV" bajando
  el plazo y leer el efecto; "Deshacer" lo borra; abonar bajando la cuota;
  borrar un abono pide confirmación y recalcula el plan; desde el gasto en
  Gastos, "Ver cuotas y abonos" abre la compra.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-24 a RF-27.

## [ ] T10 — Categorías en Espacio
`categories.js` y el bloque de categorías en `views/space.js`.

- Test primero (`categories.test.js`): `categoryRequest` quita los espacios
  de alrededor y, vacío, dice que falta el nombre.
- Verificación a mano: crear "Mascotas"; un nombre repetido muestra el
  mensaje de la API; eliminarla pide confirmación y muestra el mensaje de
  la API; crearla de nuevo la restaura y vuelve a la lista.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-28, RF-29.

## [ ] T11 — Revisión de diseño y accesibilidad
Pasada completa con la sección "Diseño" de esta spec y la de la 011.

- Test primero: `contrast.test.js` sigue en verde con los valores finales.
- Verificación a mano, en los dos temas, en Chrome del computador: todo con
  teclado y foco visible; zoom al 200 % (*reflow* a 320 px); objetivos de
  44 px; estados de carga, vacío, error y sin conexión en cada pantalla
  nueva; las barras ocultas al lector de pantalla y las cifras leídas;
  ningún emoji, sombra ni degradado; cifras alineadas a la derecha.
- Hecho cuando: la columna C de `verificacion.md` está completa.
- RF: RF-31.

## [ ] T12 — ADR 0016
`docs/adr/0016-barras-propias-sin-libreria.md`: barras con CSS y
propiedades fijadas desde JavaScript, compatibles con la CSP, ocultas al
lector de pantalla con las cifras al lado. Alternativas descartadas:
Chart.js, SVG generado y solo cifras.

- Test primero: no aplica, es documentación.
- Hecho cuando: el ADR existe con la plantilla y el plan lo cita.
- RF: ninguno; principio 4.

## [ ] T13 — Cierre: README y validación
- `README.md`: "Plan del mes: rubros e ingresos" y "Tarjetas y compras a
  cuotas" explican la web primero y dejan `curl` como alternativa; "La web"
  con las cinco secciones y la pantalla de inicio.
- Repasar los cinco criterios de validación de la spec.
- `docs/roadmap.md`: marcar `012-tablero-y-planear` como terminada y dejar
  `013-contenedores` como spec activa, con la fase 2.

- Test primero: no aplica, es documentación y validación.
- Hecho cuando: `make test` y `make lint` están en verde y la columna C de
  la verificación está completa.
- RF: cierra la spec.
