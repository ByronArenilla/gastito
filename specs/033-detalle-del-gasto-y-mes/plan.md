# Plan 033 — Detalle del gasto con rubro y Mes más claro

- Spec: `spec.md` (aprobada el 2026-11-15)
- Sin dependencias, servicios ni migraciones nuevas.

## Corrección de la spec (2026-11-15)

La decisión 10 y RF-10 decían que "Rubro · Detalle" sale "en Gastos y en
Inicio". Inicio no lista gastos: fue un error al redactar. Se corrigieron,
con aprobación del usuario, a **Gastos** y el aviso **"Gasto registrado"**
de Registrar (y su título al editar). RF-22 (la frase de Inicio) no cambia.

## API

- **Detalle con rubro (RF-1, RF-2).** `ExpenseIn` y `ExpensePatch` ya
  aceptan `description` junto a `budget_item_id`, y la tabla no cambia. Lo
  nuevo son los tests que lo fijan: registrar a débito y con tarjeta a 1
  cuota en el plan, cambiar el detalle, y quitarlo con `null` sin que el
  gasto pierda su rubro. Si alguno falla, se corrige en
  `routers/expenses.py`.
- **Las dos bolsas en el resumen (RF-3, RF-4).** `build_summary`
  (`app/summary.py`) calcula y `TotalSummaryOut` entrega tres campos nuevos:
  - `plan_spent` = gastado en rubros + deudas del mes − retirado del
    ahorro (decisión 6);
  - `plan_remaining` = `planned` − `plan_spent` (un rubro excedido resta
    aquí, decisión 7);
  - `unassigned_remaining` = `unassigned` − `spent_unplanned`.

  Lo asignado a cada bolsa ya existe (`planned` y `unassigned`), y lo
  gastado sin asignar también (`spent_unplanned`). Ningún campo actual
  cambia de significado (RF-6). Con esas fórmulas,
  `plan_remaining + unassigned_remaining == balance` siempre; un test lo
  comprueba con un rubro excedido, un gasto sin rubro, una deuda y un
  retiro a la vez.
- **Qué clase de gasto es (RF-16, RF-17; principio 10).** `ExpenseOut` gana
  `kind`: `"item"` (tiene rubro), `"unplanned"` (gasto del mes sin rubro) o
  `"debt"` (deuda de tarjeta). Lo decide una función sin HTTP con la misma
  regla que ya usa `spent_by_category`. Así la web no repite la regla: solo
  agrupa lo que `GET /expenses` ya le da. Un test comprueba que la suma de
  los `"unplanned"` del mes es `spent_unplanned`. Se descartó meter las
  listas dentro del resumen: lo engorda y Gastos ya pide `GET /expenses`.
- **Nombre con detalle (RF-5).** `purchase_name` (`app/debts.py`) devuelve
  "<rubro> · <detalle>" si el gasto del mes tiene las dos cosas; lo demás,
  como hoy.

## Web

- **Formulario (RF-7 a RF-9), en `expense-form.js`, sin DOM.** El estado
  gana `detail`. `buildExpense` lo envía como `description` solo si hay
  rubro; soltar el rubro lo deja de enviar (decisión 11).
  `formFromExpense` separa el nombre del rubro ("Qué fue") del detalle, y
  `buildChanges` manda `description` cuando el detalle cambia (`null` para
  quitarlo). `afterRecord` lo limpia.
- **Registrar y editar (`views/record.js`).** Un renglón "Detalle" con
  `maxlength="200"` debajo de "Qué fue", visible solo con rubro elegido. El
  aviso "Gasto registrado" y el título al editar usan "Rubro · Detalle".
- **Gastos (RF-10), en `expenses-list.js`.** `describeExpense` une rubro y
  detalle.
- **El Mes sin DOM (`dashboard.js`).** `buildDashboard(summary, expenses)`
  arma:
  - la cifra principal (`balance`, ingresos y gastado; RF-11);
  - las dos bolsas con asignado, gastado, queda, fracción llena y si está
    excedida (RF-12);
  - las categorías con rubros, ya sin cifras propias ni "Sin rubro"; cada
    rubro con su estado (`queda`, `completo`, `excedido`) y sus gastos
    (RF-14 a RF-16);
  - "Fuera del plan" con sus renglones y su total (RF-17, RF-18).

  Sale `incomeBar`. No hay ninguna cuenta nueva en la web: todo viene del
  resumen o de agrupar por `kind` y `budget_item_id`.
- **La vista (`views/month.js`).** Pide el resumen y los gastos del mes.
  Bloques nuevos: cifra principal, anillos, "En el plan" y "Fuera del
  plan". Cada rubro con gastos es un botón con `aria-expanded` que despliega
  su lista
  ([patrón *disclosure*](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/));
  un rubro sin gastos, o de Ahorro, no es botón. Salen `totalsBlock` e
  `incomeBlock` (RF-19). Tarjetas, el mes sin plan y Planear no se tocan
  (RF-20).
- **Anillos (RF-12, RF-13, RF-21).** Un `<div>` con
  [`conic-gradient`](https://developer.mozilla.org/es/docs/Web/CSS/gradient/conic-gradient)
  de corte seco (tinta hasta `--fill`, renglón después) y un círculo de
  papel encima para el hueco. `--fill` se fija con `style.setProperty`,
  como las barras (ADR 0016): la CSP lo permite. Excedido: anillo entero en
  rojo y la palabra. Van con `aria-hidden`; las cifras están escritas al
  lado. Sin recuadros: dos columnas separadas por un filete (principio 1
  del diseño). Los colores son los pares que `contrast.test.js` ya
  comprueba para los medidores. Queda en el **ADR 0022**, con SVG y "barras
  también arriba" como alternativas descartadas.
- **Inicio (RF-22), en `home.js`.** "Te quedan $ X en noviembre." con
  `balance`; negativo, "Te pasaste por $ X en noviembre.".
- **CSS (`app.css`).** Estilos de lo nuevo con variables de `tokens.css`.
  Se borran los de la barra del ingreso solo si nada más los usa.

## Tests

- API: `test_expenses.py` (RF-1, RF-2, `kind`), `test_summary.py` (RF-3,
  RF-4, sin HTTP) y el test de `purchase_name` (RF-5).
- Web (`node --test`): `expense-form.test.js`, `expenses-list.test.js`,
  `dashboard.test.js` y `home.test.js`.
- A mano: el recorrido del criterio 3 de la spec.

## Riesgos

- **La web nueva llega antes que la API nueva** (Render tarda minutos con
  la imagen de la API). En ese rato el resumen no trae los campos de las
  bolsas ni `kind`: el Mes muestra la cifra principal y los rubros, y deja
  fuera los anillos y "Fuera del plan" hasta que la API responda con ellos.
  La web no calcula las bolsas por su cuenta.
- **Un retiro de ahorro mayor que lo apartado en el mes** deja
  `plan_spent` por debajo de lo gastado en rubros. La suma con el balance
  sigue cuadrando; T2 lo cubre con un test y, si la cifra confunde, se
  propone el cambio en la spec antes de seguir.
- **Editar un gasto sin rubro para ponerle uno** deja "Detalle" vacío: lo
  que tenía en "Qué fue" se reemplaza por el nombre del rubro. Se ve en el
  formulario antes de guardar.
- **Un mes con muchos gastos no planeados** alarga "Fuera del plan". Se
  muestran todos: son de un solo mes.
