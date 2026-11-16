# Tareas 033 — Detalle del gasto con rubro y Mes más claro

- Spec: `spec.md` (aprobada) · Plan: `plan.md`
- Regla: primero los tests y luego el código. Se hicieron seguidas por
  petición explícita (2026-11-15).

## [x] T1 — API: el detalle de un gasto con rubro
Tests que fijan lo que la API ya hace; código solo si alguno falla.

- Test primero (`test_expenses.py`): registrar con rubro y `description` a
  débito y con tarjeta a 1 cuota en el plan; cambiar el detalle; quitarlo
  con `null` sin perder el rubro; quitar el rubro conserva la descripción.
- Hecho cuando: esos tests pasan y el resto de la API sigue en verde.
- RF: RF-1, RF-2, RF-6.

## [x] T2 — API: las dos bolsas en el resumen
`plan_spent`, `plan_remaining` y `unassigned_remaining` en
`TotalSummaryOut`, calculados en `build_summary`.

- Test primero (`test_summary.py`, sin HTTP): cada campo por separado; el
  caso combinado (rubro excedido, gasto sin rubro, deuda de tarjeta y
  retiro de ahorro) donde las dos bolsas suman el `balance`; un mes sin
  plan da ceros; un retiro mayor que lo apartado en el mes.
- Hecho cuando: los tests pasan y ningún campo anterior del resumen cambia.
- RF: RF-3, RF-4, RF-6.

## [x] T3 — API: la clase de cada gasto
`kind` en `ExpenseOut` (`"item"`, `"unplanned"`, `"debt"`), con una función
sin HTTP.

- Test primero (`test_expenses.py`): un gasto de cada clase, incluido uno a
  crédito sin tarjeta de antes de la 009; la suma de los `"unplanned"` del
  mes es `spent_unplanned` del resumen.
- Hecho cuando: `GET /expenses` trae `kind` en cada gasto.
- RF: da los datos de RF-16 y RF-17 (principio 10).

## [x] T4 — API: el nombre con detalle de un gasto del mes con tarjeta
`purchase_name` devuelve "<rubro> · <detalle>".

- Test primero (`test_summary.py`): con rubro y detalle, solo rubro, solo
  descripción y solo categoría.
- RF: RF-5.

## [x] T5 — Web: "Detalle" en Registrar y al editar
`expense-form.js` (`detail` en el estado, `buildExpense`,
`formFromExpense`, `buildChanges`, `afterRecord`) y el renglón en
`views/record.js`.

- Test primero (`expense-form.test.js`): se envía solo con rubro; soltar el
  rubro lo deja de enviar; editar lo cambia y lo quita con `null`.
- Hecho cuando: al elegir "Viaje" aparece "Detalle", y sin rubro el
  formulario se ve como hoy.
- RF: RF-7, RF-8, RF-9.

## [x] T6 — Web: "Rubro · Detalle" donde se nombra el gasto
`describeExpense` en `expenses-list.js`, y el aviso "Gasto registrado" y el
título al editar en `views/record.js`.

- Test primero (`expenses-list.test.js`).
- RF: RF-10 (con la corrección del plan: Gastos y el aviso, no Inicio).

## [x] T7 — Prototipo definitivo del Mes
No se hizo como prototipo aparte: al pedirse todas las tareas seguidas, el
diseño final (anillos sin recuadros, rubros desplegables, "Fuera del plan"
y una bolsa excedida) se revisó directamente en la app, en local, en claro
y en oscuro, a ancho de celular y de computador.

- Pendiente: que el usuario lo vea y pida ajustes si hacen falta.
- RF: prepara RF-11 a RF-21.

## [x] T8 — Web: el Mes sin DOM
`buildDashboard(summary, expenses)` en `dashboard.js`: cifra principal,
bolsas, categorías sin cifras, rubros con estado y gastos, y "Fuera del
plan". Sale `incomeBar`.

- Test primero (`dashboard.test.js`), incluido el resumen de una API
  anterior, sin los campos nuevos.
- RF: RF-11, RF-12, RF-14 a RF-19.

## [x] T9 — Web: la vista del Mes y los anillos
`views/month.js`, `app.css` y el ADR 0022 (anillos con CSS).

- Hecho cuando: el Mes se ve como el prototipo de T7; un rubro se
  despliega con teclado; el lector de pantalla lee las cifras y no los
  gráficos; Tarjetas, el mes sin plan y Planear siguen igual.
- RF: RF-11 a RF-21.

## [x] T10 — Web: la frase de Inicio
`homeStatus` en `home.js`.

- Test primero (`home.test.js`): con saldo, con saldo negativo y sin plan.
- RF: RF-22.

## [x] T11 — Cierre
README (Mes, Registrar, Inicio y el resumen), roadmap, la corrección de la
spec (decisión 10 y RF-10) y el recorrido a mano del criterio 3.

- Hecho: `make test` y `make lint` en verde y el recorrido en Chromium, en
  local y con datos de ejemplo, a ancho de celular y de computador, en
  claro y en oscuro.
- Falta: probarlo con los datos reales, en la app desplegada y en el
  celular.
