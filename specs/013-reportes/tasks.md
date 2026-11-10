# Tareas 013 — Reportes para decidir

- Spec: `spec.md` (aprobada; decisiones 18 a 28 tras el prototipo) · Plan:
  `plan.md` (aprobado)
- Regla: una tarea por vez, primero los tests y luego el código. Al
  terminarla, marcarla, ejecutar `make test` y `make lint`, y detenerse.
- Orden: primero el prototipo (T1), que puede cambiar la spec y el plan, y
  las tintas (T2). Luego la API, de los datos a los reportes: la categoría
  Ahorro (T3), los retiros (T4), el resumen con los retiros (T5) y los
  reportes (T6 a T8). Después la web: los retiros en Registrar, Gastos y el
  Mes (T9, T10), y los reportes (T11 a T14). Al final, la revisión de
  diseño (T15), los ADR (T16) y el cierre (T17).
- Lo que se verifica a mano va en `verificacion.md`, que crea T9.
- 2026-11-10, al revisar el prototipo: se quitaron dos reportes (decisión
  18), los reportes miran un mes elegido (20), Ahorro es una categoría
  (21 a 24) y se registran retiros de ahorro (25 a 28). Las tareas se
  rehicieron.

## [x] T1 — Prototipo de los reportes
Una página HTML desechable con datos de ejemplo de varios meses, con los
tokens y las fuentes de la 011, a 360 y a 1280 px y en los dos temas.

- Test primero: no aplica, es un prototipo y no entra al repositorio.
- Muestra: "Este mes | Reportes" y el selector de mes; los tres reportes
  con frase, gráfico y "Ver cifras"; la ventana de "¿Estoy ahorrando?";
  los estados vacíos; 12 meses en el celular; el retiro de ahorro en
  Registrar, Gastos y el Mes.
- Se publica para verlo en el navegador y elegir. Lo que cambie se anota en
  la spec y el plan antes de T2.
- Hecho cuando: el usuario aprueba el prototipo y los cambios están en la
  spec y el plan.
- RF: RF-1 a RF-4, RF-14 a RF-23, RF-24 (diseño), RF-32, RF-35, RF-36
  (forma).
- Estado (2026-11-10): versión 5 publicada
  (https://claude.ai/artifact/LNaj8VevPTdJZr6zYrtv7a), con las decisiones
  18 a 28 anotadas en la spec y el plan. Aprobado por el usuario el
  2026-11-10.

## [x] T2 — Tintas de libro
Las tintas del prototipo en `tokens.css`, claro y oscuro, y las clases
`.tint-*` en `app.css`.

- Test primero (`contrast.test.js`):
  - Las tintas `--tint-1` a `--tint-6` y `--tint-other` existen en los dos
    temas.
  - Cada una contra `--paper` y `--field`: al menos 3:1.
  - Separación en OKLab ×100 entre vecinas: al menos 15 con visión normal y
    8 con deuteranopía y protanopía simuladas.
- Hecho cuando: los tests pasan con los valores del prototipo.
- RF: RF-17, RF-25.
- Estado (2026-11-10): siete tintas en `tokens.css` (claro y oscuro) y las
  clases `.tint-1` a `.tint-6`, `.tint-other` y `.tint-debts` en `app.css`.
  `contrast.test.js` comprueba 3:1 sobre papel y campo y la separación entre
  vecinas con las matrices de Machado, Oliveira y Fernandes (2009). El par
  más justo es ciruela–pizarra en el tema oscuro (8,2 con protanopía).

## [x] T3 — API: categoría Ahorro
"Ahorro" al final de `DEFAULT_CATEGORIES` y la migración
`0006_savings_category`.

- Test primero:
  - `test_categories.py`: un espacio nuevo trae "Ahorro" al final.
  - `test_migrations.py`: la 0006 crea "Ahorro" en un espacio sin ella; no
    la duplica si ya hay "ahorro" activa; no restaura una archivada;
    migrar dos veces no cambia nada.
- Hecho cuando: los tests pasan.
- RF: RF-29, RF-30.
- Estado (2026-11-10): hecha. Los tests de migraciones que comparaban toda
  la tabla `categories` ahora comparan las filas que ya existían (`kept`):
  la 0006 añade una. El test de nombres que chocan usa "Mascotas", porque
  "Ahorro" ya es predefinida.

## [x] T4 — API: retiros de ahorro
Modelo `SavingsWithdrawal`, migración `0007_savings_withdrawals`,
`app/savings.py` (categoría Ahorro, apartado, retirado, límite y guarda),
`routers/savings_withdrawals.py` y la guarda en `PATCH` y `DELETE` de
gastos.

- Test primero (`test_savings_withdrawals.py`, `test_migrations.py`):
  - Crear, listar por mes, editar y borrar; quién lo registró; monto, fecha
    y nota con los mensajes de un gasto.
  - Límite (`422` con el texto del plan): $ 500.000 apartados → $ 500.000
    sí, $ 500.001 no; dos retiros que juntos pasan; editar uno por encima;
    moverlo a un mes sin nada apartado; sin categoría Ahorro, nada.
  - Guarda (`409`, nada cambia): borrar el gasto de Ahorro de un mes con
    retiros; bajar su monto; cambiarle categoría o fecha. Un gasto de otra
    categoría no se ve afectado.
  - Otro espacio: `404`.
  - La 0007 crea la tabla con su `CHECK` y la base queda igual a los
    modelos.
- Hecho cuando: los tests pasan.
- RF: RF-32 a RF-34, RF-37.
- Estado (2026-11-10): hecha. La fecha usa el mismo formato que un gasto
  con su propio mensaje ("La fecha del retiro no puede ser posterior a
  hoy."). Retiros y cambios de lo apartado bloquean la fila del espacio
  (`FOR UPDATE`) mientras deciden. `dates.month_label` da "agosto de 2026"
  para los mensajes.

## [ ] T5 — API: el resumen con los retiros
`withdrawn` en `CategorySummaryOut` y `TotalSummaryOut`, y el descuento en
`build_summary`.

- Test primero (`test_summary.py`): Ahorro con `spent` neto ($ 300.000 de
  $ 500.000 apartados y $ 200.000 retirados) y `withdrawn`; `total.spent` y
  `balance` descuentan lo retirado; `spent_unplanned` no cambia; un mes sin
  retiros queda igual que antes (los tests de la 008 a la 010 siguen en
  verde).
- Hecho cuando: los tests pasan.
- RF: RF-36 (datos).

## [ ] T6 — API: ruta, mes, ventana y "¿Estoy ahorrando?"
`requested_report_period` y `requested_window` en `deps.py`;
`app/reports.py` con `window_periods`, `rounded_div`, `percent`,
`reference_income`, `incomes_by_period`, `first_period` y el reporte de
ahorro; `ReportsOut` en `schemas.py` (con las otras partes vacías hasta su
tarea); `routers/reports.py` y su registro en `main.py`.

- Test primero (`test_reports.py`, con el espacio de ejemplo del plan):
  - Sin `period`, el mes anterior; el mes actual, uno futuro o uno mal
    escrito → `422`; `?months=2` y `?months=abc` → `422`; sin sesión →
    `401`; un espacio ajeno → `404`.
  - `first_period` con ingresos, rubros o gastos; `null` en un espacio
    vacío.
  - `window_periods("2026-10", 6)` es mayo a octubre; cruza el año.
  - Ahorro: apartado, planeado, retirado, lo que quedó y lo ahorrado en
    cada mes; un mes negativo; mayo vacío y fuera del promedio; mejor y
    peor mes; meses en que se apartó lo planeado; con un mes, `average`
    nulo; ingreso de referencia estimado; sin ingresos, `share` nulo.
  - `rounded_div` con el medio exacto, positivo y negativo.
- Hecho cuando: los tests pasan.
- RF: RF-3, RF-5, RF-6, RF-21 a RF-23.

## [ ] T7 — API: "¿En qué se me va la plata?"
`spending_report` y `split_percent`.

- Test primero (`test_reports.py`):
  - Lo gastado en el mes por categoría, con la categoría archivada, y
    "Cuotas de tarjetas"; ordenado de mayor a menor.
  - Ahorro no está en la lista ni en el total; `saved` y `withdrawn`
    aparte.
  - El gasto del mes con la Visa cuenta en Comida; la compra a cuotas, en
    "Cuotas de tarjetas".
  - Lo no planeado y su parte; las líneas suman el total y los
    porcentajes, 100.
  - `split_percent` con empates, con una sola parte y con total 0.
- Hecho cuando: los tests pasan.
- RF: RF-6, RF-14, RF-15, RF-31.

## [ ] T8 — API: "¿Planeo bien?" y tope de consultas
`planning_report` y la medición del rendimiento del plan ("Riesgos").

- Test primero (`test_reports.py`):
  - Los rubros del mes con planeado, gastado y diferencia; las filas sin
    rubro de Comida y de Ropa (que no tiene rubros), con planeado 0; nada
    de Ahorro; orden de lo que más se pasa a lo que más sobra.
  - Un gasto del mes con tarjeta en un rubro no cuenta como sin rubro, y
    una compra a cuotas tampoco.
  - Tope de consultas: `?months=12` con el espacio de ejemplo hace como
    mucho 300 consultas, contadas con `before_cursor_execute`.
- Medición a mano: el tiempo de `?months=12` contra la base local, anotado
  en el estado de esta tarea. Si pasa de 300 ms, se hace aquí la
  optimización del plan, con los tests de la 009 y la 010 en verde.
- Hecho cuando: los tests pasan y la medición está anotada.
- RF: RF-18 a RF-20 (datos). El tope de consultas y la medición vienen del
  plan, no de un RF.

## [ ] T9 — Web: registrar, ver y editar un retiro
`withdrawals.js`; "Gasto | Retiro de ahorro" en `views/record.js`; retiros
en `expenses-list.js` y `views/expenses.js`; `views/withdrawal.js` en
`/retiros/<id>`; `specs/013-reportes/verificacion.md` con la lista del
criterio 4.

- Test primero:
  - `withdrawals.test.js`: monto con puntos; sin monto, lo que falta; lo
    que se puede retirar con y sin retiros previos.
  - `expenses-list.test.js`: retiros y gastos mezclados por fecha; el
    retiro con "+".
  - `routes.test.js` y `test_serve.py`: `/retiros/12`.
- Verificación a mano: registrar un retiro de $ 200.000 en agosto; uno por
  encima muestra el mensaje de la API; verlo en Gastos, editarlo y
  borrarlo con confirmación; borrar lo apartado con un retiro muestra el
  mensaje del `409`; sin conexión lo avisa.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-32, RF-33, RF-35 (y RF-34 en la web).

## [ ] T10 — Web: el Mes con lo retirado
La línea "Retirado del ahorro" en la categoría Ahorro (`dashboard.js` y
`views/month.js`).

- Test primero (`dashboard.test.js`): la línea en Ahorro con su monto y no
  en otras categorías; la cifra de Ahorro es la neta.
- Verificación a mano: agosto con el retiro muestra Ahorro $ 300.000 de
  $ 500.000 y la línea; el balance del mes cambia en lo retirado.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-36.

## [ ] T11 — Web: navegación, mes y ventana
`/mes/reportes` en `routes.js`; el selector "Este mes | Reportes" en el
Mes; `views/reports.js` con el selector de mes, la ventana de ahorro
(recordados en `app.drafts`), la petición y los estados de carga, error y
sin conexión; `monthBounds` y `SAVINGS_WINDOWS` en `reports.js`.

- Test primero:
  - `routes.test.js`: `/mes/reportes` abre la vista de reportes.
  - `reports.test.js`: `monthBounds` en el primer mes con datos (sin
    anterior) y en el mes anterior al actual (sin siguiente);
    `SAVINGS_WINDOWS` con "1 mes" primero.
  - `test_serve.py`: `/mes/reportes` devuelve `index.html`.
- Verificación a mano: del Mes a Reportes y de vuelta con teclado; las
  flechas se detienen en los límites; cambiar a agosto y a 6 meses, ir a
  Gastos y volver los conserva; recargar vuelve al mes anterior y a 1 mes;
  sin conexión lo avisa.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-1 a RF-3, RF-28.

## [ ] T12 — Web: escalas y piezas de gráfico
`charts.js` con `columnScale`, `stackScale` y `divergentScale`; en
`views/reports.js`, las piezas comunes (columnas, pilas, barras divergentes,
lectura al tocar, "Ver cifras") y su CSS en `app.css`, con la animación
condicionada a `prefers-reduced-motion`.

- Test primero (`charts.test.js`):
  - Columnas positivas: la mayor mide 1 y la línea de cero está abajo.
  - Con negativos: la línea de cero entre los dos y tamaños con signo.
  - Todo en 0: tamaños 0, sin `NaN`.
  - Pilas: la más alta mide 1 y las partes conservan su proporción.
  - Divergentes: el mismo máximo a los dos lados.
- Hecho cuando: los tests pasan.
- RF: RF-24, RF-26, RF-27 (piezas).

## [ ] T13 — Web: "¿En qué se me va la plata?" y "¿Planeo bien?"
`spendingReport`, `groupLines` y `planningReport` en `reports.js`, y sus
secciones en la vista.

- Test primero (`reports.test.js`):
  - Gasto: la frase con la categoría más grande, lo no planeado y lo
    apartado y retirado aparte; ocho categorías → seis, "Cuotas de
    tarjetas" y "Otras", con la misma suma y la tinta de cada una.
  - Planeo bien: la frase con Mercado y con "En Comida gastaste… sin
    rubro" cuando va primera; el nombre "Comida · sin rubro"; nada que se
    pase; las barras en orden con lo que se pasa en rojo y con "+".
  - Mes sin datos: el texto que ofrece planear.
- Verificación a mano: los dos reportes en octubre y en agosto; "Ver
  cifras" con teclado; los nombres largos no desbordan a 320 px.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-4, RF-14, RF-15, RF-17 a RF-20, RF-31.

## [ ] T14 — Web: "¿Estoy ahorrando?"
`savingsReport` en `reports.js` y su sección con la ventana.

- Test primero (`reports.test.js`): con un mes, la frase y el desglose,
  también con un retiro; con varios, promedio, meses en que se apartó lo
  planeado, mejor y peor; un mes negativo con "−"; mes vacío con su razón.
- Verificación a mano: 1, 3, 6 y 12 meses; tocar una columna muestra su
  mes y su cifra; 12 meses a 360 px se desplazan con el último mes a la
  vista.
- Hecho cuando: los tests pasan y la verificación está marcada.
- RF: RF-4, RF-21 a RF-23.

## [ ] T15 — Revisión de diseño y accesibilidad
Pasada completa con la sección "Diseño" de esta spec y las de la 011 y la
012, sobre Reportes, Registrar, Gastos y el Mes.

- Test primero: `contrast.test.js` sigue en verde con los valores finales.
- Verificación a mano, en los dos temas, en Chrome del computador: los
  tres reportes en varios meses a 320, 390 y 1280 px; el reparto en dos
  columnas desde 1280 px; todo con teclado y foco visible; zoom al 200 %;
  los gráficos ocultos al lector de pantalla y la tabla leída; sin
  animación con `prefers-reduced-motion`; ningún emoji, sombra ni
  degradado; cifras a la derecha.
- Hecho cuando: la columna C de `verificacion.md` está completa.
- RF: RF-24 a RF-27.

## [ ] T16 — ADR 0017 y 0018
- `docs/adr/0017-graficos-de-varios-meses-con-css.md`: columnas y pilas de
  CSS con propiedades fijadas desde JavaScript, la lectura al tocar y "Ver
  cifras". Alternativas descartadas: SVG generado, Chart.js y `<canvas>`.
- `docs/adr/0018-retiros-de-ahorro-en-su-propia-tabla.md`: tabla aparte,
  límite por mes y guarda en los gastos. Alternativas descartadas: un gasto
  con monto negativo, una marca en `expenses` y no registrar el retiro.

- Test primero: no aplica, es documentación.
- Hecho cuando: los ADR existen con la plantilla y el plan los cita.
- RF: ninguno; principio 4.

## [ ] T17 — Cierre: README y validación
- `README.md`: sección "Reportes" con las tres preguntas y la ruta de la
  API; "Ahorro" en las predefinidas; cómo registrar un retiro de ahorro.
- `docs/roadmap.md`: marcar `013-reportes` como terminada y dejar
  `014-contenedores` como spec activa, con la fase 2. En la 020, añadir los
  reportes y los retiros a la verificación en el celular.
- Repasar los cinco criterios de validación de la spec.

- Test primero: no aplica, es documentación y validación.
- Hecho cuando: `make test` y `make lint` están en verde y la columna C de
  la verificación está completa.
- RF: cierra la spec.
