# Plan 013 — Reportes para decidir

- Spec: `spec.md` (estado: aprobada; tres reportes, mes elegido, Ahorro
  como categoría y retiros de ahorro, decisiones 18 a 28; el ahorro se
  aparta al planearlo, decisión 29)
- Servicios afectados: `services/api` (categoría Ahorro, retiros, resumen,
  migraciones y ruta de reportes) y `services/web` (Reportes dentro del
  Mes; Registrar, Gastos y Mes con los retiros).
- Estado: aprobado (2026-11-10); ajustado el mismo día con lo decidido al
  revisar el prototipo, y el 2026-11-11 con la decisión 29 (tarea T17)

La 013 sigue el camino de la 012. En la API, un módulo nuevo,
`app/reports.py`, arma los tres reportes **reutilizando** `build_summary`,
que ya aplica las reglas de las specs 008 a 010, sin copiarlas. "Ahorro"
entra en las categorías predefinidas y una migración de datos la crea en los
espacios que ya existen. Los retiros de ahorro tienen su propia tabla y sus
rutas, y el resumen los descuenta de Ahorro. En la web, dos módulos de lógica sin DOM probados
con `node --test` (`reports.js` y `charts.js`) y una vista que arma el DOM
con `h()`.

El plan tiene ocho partes:

1. **Prototipo**: una página desechable con los reportes y datos de ejemplo
   de varios meses, a 360 y 1280 px y en los dos temas, para aprobar el
   diseño antes del código (decisión 6). No entra al repositorio.
2. **Tintas de libro**: los tokens nuevos y su test de contraste y de
   separación.
3. **Categoría Ahorro**: la lista de predefinidas y la migración.
4. **Retiros de ahorro**: tabla, rutas, límite, guarda en los gastos y el
   resumen; en la web, Registrar, Gastos y el Mes.
5. **API de reportes**: el mes elegido, la ventana, la ruta y los tres
   reportes.
6. **Gráficos**: las escalas y las piezas de CSS comunes.
7. **Web de reportes**: el selector "Este mes | Reportes", el selector de
   mes, la ventana de "¿Estoy ahorrando?" y cada reporte.
8. **Cierre**: revisión de diseño, ADR 0017 y 0018, y README.

La forma de dibujar los gráficos de varios meses queda en el
[ADR 0017](../../docs/adr/0017-graficos-de-varios-meses-con-css.md) (el
ADR 0016 la dejó para esta spec): **columnas de CSS**, como las barras de
la 012, sin SVG ni librería. Los retiros de ahorro en su propia tabla, en
el [ADR 0018](../../docs/adr/0018-retiros-de-ahorro-en-su-propia-tabla.md).

## Decisiones técnicas

| Decisión | Elegido | Por qué |
|---|---|---|
| Ahorro en las predefinidas | `"Ahorro"` al final de `DEFAULT_CATEGORIES` en `routers/categories.py` | RF-29 y decisión 21. Al final, para que el orden sea el mismo en los espacios nuevos y en los que la reciben por la migración (la lista sale en orden de creación, decisión 5 de la 002). |
| Ahorro en los espacios existentes | Migración de Alembic `0006_savings_category`: por cada espacio sin una categoría de clave `ahorro` (activa o archivada), un `INSERT` con nombre `Ahorro`, clave `ahorro` y `created_at` actual. La clave va escrita en la migración, no importada de `app.models` | RF-30. Sin pasos a mano (principio 14). La clave copiada, como la CHECK de la 0005: una migración queda fija aunque el modelo cambie. Una archivada no se toca: el que la archivó decidió no usarla, y crearla de nuevo la restaura (002). `downgrade` lanza `NotImplementedError`, como las demás (ADR 0011). |
| Cuál es la categoría Ahorro | La del espacio con `name_key == "ahorro"`, activa o archivada | Concepto de la spec. Es la comparación de nombres de la 002; si alguien la llamó "ahorro" o "AHORRO", es la misma. |
| Dónde se guardan los retiros | Tabla nueva `savings_withdrawals` (`id`, `space_id`, `spent_on`, `amount`, `description`, `created_by`, `created_at`) con su migración `0007`, y `CHECK (amount > 0)` | ADR 0018. Un retiro no tiene categoría, rubro ni tipo de pago: meterlo en `expenses` obligaría a volver nulas columnas que hoy son obligatorias y a cuidar en cada regla de gastos (tarjetas, rubros, resumen) que un "gasto" no sea un retiro. |
| Rutas de los retiros | `POST`, `GET ?period=`, `PATCH /{id}` y `DELETE /{id}` bajo `/spaces/{space_id}/savings-withdrawals`, con `member_space` | RF-32, RF-35 y RF-37. Las mismas formas que los gastos; monto, fecha y nota usan los tipos `Amount`, `SpentOn` y `Description` de `schemas.py`, así que las reglas y los mensajes son los mismos (RF-32). |
| Límite del retiro | `withdrawal_room(db, space_id, period, exclude_id)` = lo apartado en Ahorro en el mes − lo retirado (sin el retiro que se edita). Crear o editar por encima → `422` con el mes, lo apartado, lo retirado y lo que se puede retirar | RF-33. Lo apartado es lo planeado en los rubros de Ahorro del mes (decisión 29). Editar la fecha de un retiro lo mide contra su mes nuevo. |
| Guarda al cambiar lo apartado | `PATCH` y `DELETE` de un rubro calculan, antes de guardar, lo apartado en su mes con el cambio y responden `409` si lo retirado queda por encima | RF-34 y decisión 29. Solo importa si el rubro es de Ahorro: bajarle el monto, cambiarle la categoría o borrarlo. Un rubro no cambia de mes (decisión 12 de la 008). |
| Ahorro no se registra | `PATCH` y `POST` de gastos responden `422` si el gasto queda en la categoría Ahorro (por la categoría enviada o por la de su rubro). Registrar no ofrece Ahorro ni sus rubros (`recordableCategories` y `recordableItems` en `expense-form.js`) | RF-38 y decisión 29. Un gasto viejo de Ahorro (solo pudo crearse en esta rama) se edita mientras no se le cambie la categoría. |
| Lo apartado en el resumen | Cada rubro de Ahorro tiene `spent` = `planned`; la categoría Ahorro, lo planeado menos lo retirado. `total.spent` y `spent_planned` suman lo apartado | RF-38. Así el Mes, el balance y "¿Estoy ahorrando?" siguen las fórmulas de antes: lo apartado cuenta en lo gastado y lo retirado lo descuenta. |
| Dos personas a la vez | La comprobación y el cambio van en la misma transacción, con `SELECT … FOR UPDATE` sobre los retiros del mes | Mismo patrón que los abonos de la 009. En SQLite (tests) `FOR UPDATE` no hace nada; en PostgreSQL evita que dos retiros simultáneos pasen el límite. |
| El resumen con los retiros | `CategorySummaryOut.withdrawn` (0 salvo en Ahorro) y `TotalSummaryOut.withdrawn`; `spent` de Ahorro = apartado − retirado; `total.spent` y `balance` descuentan lo retirado; `spent_unplanned` se calcula antes de descontarlo | RF-36. Si se descontara antes, la resta "lo gastado en categorías − lo gastado en rubros" daría un no planeado más pequeño de lo real. |
| El Mes con los retiros | `dashboard.js` añade en la categoría Ahorro una línea "Retirado del ahorro −$ 200.000", como la línea "sin rubro" | RF-36 y decisión 26. El medidor del rubro Ahorro sigue con lo apartado; la cifra de la categoría, con lo neto. |
| Registrar un retiro | Arriba de Registrar, `.seg--full` "Gasto \| Retiro de ahorro". El retiro muestra monto, fecha y nota, y debajo cuánto se puede retirar, con `GET summary?period=` (Ahorro `spent` y `withdrawn`) | RF-32 y decisión 25. Lo que se puede retirar es una ayuda; la regla la aplica la API (RF-33). |
| Gastos con los retiros | La lista pide `GET expenses?period=` y `GET savings-withdrawals?period=` y los mezcla por fecha; un retiro abre `/retiros/<id>` para editarlo o borrarlo | RF-35. Sin una ruta nueva que junte los dos: son dos peticiones en paralelo, como las tarjetas de la 012. |
| Una ruta para los tres reportes | `GET /spaces/{space_id}/reports?period=2026-10&months=6`; `period` por defecto el mes anterior al actual y `months` en 1, 3, 6 o 12, por defecto 1 | Decisión 9 y 20. `months` solo cambia "¿Estoy ahorrando?". |
| Validar mes y ventana | Dependencias `requested_report_period` y `requested_window` en `deps.py`, como `requested_period`: un mes mal escrito, el actual o uno futuro → `422` "Elige un mes ya cerrado."; una ventana que no es 1, 3, 6 o 12 → `422` "La ventana debe ser de 1, 3, 6 o 12 meses." | RF-3 y RF-5. Con `months: int`, FastAPI respondería a `?months=abc` con su mensaje en inglés. |
| Primer mes con datos | `first_period` en la respuesta: el menor mes con un ingreso, un rubro o un gasto del espacio (tres consultas con `MIN`), o `null` | RF-3: la web no deja ir antes. Sin él, se podría retroceder sin fin por meses vacíos. |
| Datos de cada mes | `build_summary(db, space_id, period)` por cada mes de la ventana (el mes elegido es el último) | Spec, "Qué NO entra": las mismas reglas. El resumen ya separa lo gastado por categoría, por rubro, las deudas del mes y lo no planeado. Son hasta 12 resúmenes; ver "Riesgos". |
| Lo gastado sin rubro por categoría | `spent` de la categoría en el resumen menos lo gastado en sus rubros | Decisión 19. Es la misma resta que hace el Mes de la 012 para su "sin rubro" (`dashboard.js`), ahora en la API. Las deudas no entran: el resumen ya las deja fuera de las categorías. |
| Ahorrado | Por mes: `saved` = lo apartado (Ahorro sin descontar retiros); `withdrawn` = lo retirado; `left` = ingreso de referencia − `total.spent`; `total` = `saved` − `withdrawn` + `left` | Decisiones 24 y 25. `total.spent` ya incluye lo apartado y descuenta lo retirado, así que nada se cuenta dos veces. |
| Ingreso de referencia | Una consulta: suma de ingresos por `period_start` del espacio. `reference_income(by_period, period)` toma el del mes o el del último mes anterior que tenga, y marca `estimated` | Concepto de la spec. |
| Porcentajes | Parte de un ingreso: entero redondeado con el medio hacia arriba. Partes de un total ("¿En qué se me va la plata?"): **método del resto mayor**, para que sumen 100 | RF-6. Redondear cada parte por separado puede sumar 99 o 101. |
| Promedios | División entera redondeada con el medio alejándose de cero (`rounded_div`), también para negativos | RF-6 y decisión 14: solo cuentan los meses con datos (ingresos o gastos). |
| Mejor y peor mes | Los calcula la API: `best` y `worst` (mayor y menor `total`), y `untouched_months` / `planned_months` (meses con algo apartado en que no se retiró nada; decisión 29) | Son hechos de los datos (decisión 8), no presentación. |
| "Otras" y tintas | La web: las seis categorías con más gasto toman las tintas 1 a 6 por ese orden, el resto se suma en "Otras". "Cuotas de tarjetas" va aparte, en `--ink` | RF-17. Agrupar no cambia ningún monto, y el criterio 2 lo prueba en `node --test`. En el prototipo, `--rule-strong` (el gris de las deudas del Mes) se confundía con la pizarra y con "Otras". |
| Gráficos | Columnas y barras de `<div>` con propiedades CSS fijadas desde JavaScript (`--size`, `--zero`, `--part`), como el ADR 0016. Sin SVG | Ver ADR 0017. El texto queda a su tamaño real y se ajusta al ancho solo con CSS. |
| Colores de "¿Estoy ahorrando?" | Apartado en `--ink`, lo que quedó encima en `--rule-strong`, lo que faltó en `--red` bajo la línea de cero | Decisión 24. Dos partes que se distinguen por luminosidad, con 2 px de papel entre ellas; el rojo solo para lo negativo (011). |
| Cifra al tocar una columna | Un renglón "lectura" encima del gráfico (`aria-hidden`) que cambia con `pointerover` y `click` en cada columna | Decisión 15. Las columnas no reciben foco: con teclado y lector de pantalla, las cifras están en la tabla. |
| Ver cifras | `<details>` con `<summary>Ver cifras</summary>` y una `<table>` | RF-26. Se abre con teclado sin JavaScript propio. |
| Gráficos ocultos al lector de pantalla | El gráfico con `aria-hidden="true"`; la frase y la tabla dicen lo mismo | RF-26 y ADR 0016. |
| 12 meses en el celular | Contenedor con `overflow-x: auto`, cada mes de al menos 44 px, y `scrollLeft = scrollWidth` al pintar | "Celular y computador": el mes más reciente a la vista sin desbordar la página. |
| Animación | `@keyframes` de `transform: scaleY(0)` a `1` en 200 ms, solo dentro de `@media (prefers-reduced-motion: no-preference)` | RF-27. Sin la media query, no hay animación. |
| Mes y ventana recordados | `app.drafts` con las claves `reports-period` y `reports-window` | RF-2: en memoria, como el mes elegido de la 012. El mes de Reportes es aparte del de Gastos y el Mes: allí se mira el mes en curso. |

## Dependencias

- **Ninguna dependencia nueva**, ni de Python ni de JavaScript.
- El prototipo es un archivo HTML suelto que se publica para verlo y no
  entra al repositorio.

## Estructura de archivos

    services/api/
      app/
        routers/categories.py      + "Ahorro" en DEFAULT_CATEGORIES           [RF-29]
        migrations/versions/
          0006_savings_category.py (nuevo) Ahorro en los espacios existentes  [RF-30]
          0007_savings_withdrawals.py (nuevo) tabla de retiros               [RF-32]
        models.py                  + SavingsWithdrawal                         [RF-32]
        savings.py        (nuevo)  categoría Ahorro, apartado, límite, guarda  [RF-33, RF-34]
        routers/savings_withdrawals.py (nuevo) crear, listar, editar, borrar [RF-32 a RF-35, RF-37]
        routers/expenses.py        + 422 a un gasto en Ahorro                  [RF-38]
        routers/budget_items.py    + guarda al bajar o borrar lo apartado      [RF-34]
        summary.py                 + lo retirado en Ahorro y en los totales    [RF-36]
        reports.py        (nuevo)  mes, ventana, ingreso de referencia, los tres reportes [RF-5, RF-6, RF-14 a RF-23, RF-31]
        routers/reports.py (nuevo) GET /spaces/{id}/reports                    [RF-5]
        deps.py                    + requested_report_period, requested_window [RF-3, RF-5]
        schemas.py                 + ReportsOut y sus partes                   [RF-5, RF-6]
        main.py                    + router de reportes
      tests/
        test_categories.py         + Ahorro al final de las predefinidas
        test_migrations.py         + la 0006 crea Ahorro sin duplicarla; la 0007 crea la tabla
        test_savings_withdrawals.py (nuevo) límite, guarda, aislamiento
        test_summary.py            + Ahorro con retiros
        test_reports.py   (nuevo)  espacio de ejemplo de varios meses          (criterio 1)
    services/web/
      public/
        css/tokens.css             + tintas de libro, claro y oscuro           [RF-25]
        css/app.css                + reportes, columnas, reparto en dos columnas [RF-24]
        js/
          routes.js                + /mes/reportes, /retiros/<id>              [RF-1, RF-35]
          withdrawals.js (nuevo)   formulario del retiro y lo que se puede retirar [RF-32, RF-33]
          dashboard.js             + "Retirado del ahorro" en Ahorro           [RF-36]
          expenses-list.js         + retiros mezclados por fecha               [RF-35]
          reports.js     (nuevo)   respuesta → frases, filas, "Otras", límites del mes [RF-3, RF-4, RF-14 a RF-23]
          charts.js      (nuevo)   escalas: tamaños, línea de cero, apilados   [RF-19, RF-22]
          main.js                  vista de reportes
          views/
            month.js               + selector "Este mes | Reportes"            [RF-1]
            reports.js   (nuevo)   mes, ventana y los tres reportes            [RF-1 a RF-4, RF-14 a RF-28]
            record.js              + "Gasto | Retiro de ahorro"                [RF-32]
            expenses.js            + retiros en la lista                       [RF-35]
            withdrawal.js (nuevo)  editar y borrar un retiro                   [RF-35]
      tests/
        reports.test.js, charts.test.js, withdrawals.test.js                  (criterio 2)
        dashboard.test.js          + Ahorro con lo retirado
        expenses-list.test.js      + retiros mezclados por fecha
        routes.test.js             + /mes/reportes
        contrast.test.js           + tintas: 3:1 y separación               (criterio 3)
        test_serve.py              + /mes/reportes
    docs/adr/0017-graficos-de-varios-meses-con-css.md
    docs/adr/0018-retiros-de-ahorro-en-su-propia-tabla.md
    specs/013-reportes/verificacion.md
    README.md                      sección "Reportes", Ahorro en las predefinidas y retiros

## API

### Ruta

`GET /spaces/{space_id}/reports?period=2026-10&months=6`, con sesión y
membresía (`member_space`), como el resumen. Respuesta, con `current` en
2026-11:

    {
      "current": "2026-11",
      "period": "2026-10",
      "first_period": "2025-11",                           // o null
      "has_data": true,

      "spending": {                                      // ¿En qué se me va la plata? (un mes)
        "total": 5881360, "unplanned": 120000, "unplanned_share": 2,
        "saved": 500000, "withdrawn": 0,
        "lines": [{ "kind": "category", "category_id": 1, "name": "Hogar",
                    "deleted": false, "total": 2236000, "share": 38 },
                  { "kind": "debts", "category_id": null,
                    "name": "Cuotas de tarjetas", "total": 545360,
                    "share": 9 }, ...]
      },

      "planning": {                                      // ¿Planeo bien? (un mes)
        "items": [{ "kind": "unplanned", "name": "Comida",
                    "category": "Comida", "category_id": 2,
                    "planned": 0, "spent": 120000, "diff": 120000 },
                  { "kind": "item", "name": "Mercado", "category": "Comida",
                    "category_id": 2, "planned": 900000, "spent": 985000,
                    "diff": 85000 }, ...]
      },

      "savings": {                                       // ¿Estoy ahorrando? (ventana)
        "window": { "months": 6, "periods": ["2026-05", ..., "2026-10"] },
        "months": [{ "period": "2026-10", "empty": false,
                     "income": 6500000, "income_estimated": false,
                     "saved": 500000, "withdrawn": 0,
                     "left": 118640,
                     "total": 618640, "share": 10 }, ...],
        "average": { "total": 1680728, "share": 24 },     // o null
        "best": "2026-06", "worst": "2026-10",            // o null
        "planned_months": 5, "untouched_months": 4
      }
    }

- `has_data` es `false` si el mes elegido no tiene ingresos ni gastos: la
  web muestra el estado vacío de los dos primeros reportes.
- `share` es `null` cuando no hay ingreso de referencia.
- `average`, `best` y `worst` son `null` con menos de dos meses con datos;
  con un mes, la web muestra lo ahorrado en grande (RF-23).
- Las listas siguen órdenes fijos: `lines` de mayor a menor total; `items`
  de mayor a menor `diff` y luego por nombre.

### `app/reports.py`

Funciones puras (sin base de datos), probadas aparte:

- `window_periods(period, months) -> list[str]`: los `months` meses que
  terminan en `period`.
- `rounded_div(a, b) -> int` y `percent(part, whole) -> int | None`.
- `split_percent(amounts) -> list[int]`: método del resto mayor; suma 100
  si el total no es 0.
- `reference_income(by_period, period) -> tuple[int, bool] | None`.

Funciones con sesión, todas filtradas por `space_id` (principio 13):

- `savings_category_ids(db, space_id) -> set[int]`.
- `incomes_by_period(db, space_id) -> dict[str, int]`.
- `first_period(db, space_id) -> str | None`.
- `spending_report(summary, savings_ids)` y `planning_report(summary,
  savings_ids)`: del resumen del mes elegido, sin más consultas.
- `savings_report(summaries, incomes, savings_ids)`.
- `build_reports(db, space_id, period, months) -> ReportsOut`.

### Retiros de ahorro

`POST /spaces/{space_id}/savings-withdrawals` con
`{ "amount": 200000, "spent_on": "2026-08-14", "description": "Urgencia médica" }`
→ `201` con el retiro. Pasar del límite → `422`:

    { "detail": "En agosto apartaste $ 500.000 y ya retiraste $ 400.000: puedes retirar hasta $ 100.000." }

Bajar o borrar un rubro de Ahorro que deja lo retirado por encima → `409`:

    { "detail": "En agosto retiraste $ 200.000 del ahorro; con este cambio, lo apartado quedaría en $ 0. Cambia o borra el retiro primero." }

Un gasto en Ahorro → `422`:

    { "detail": "El ahorro no se registra: se aparta al planear un rubro en Ahorro. Para sacar plata del ahorro, registra un retiro." }

`app/savings.py`, sin HTTP (principio 10): `savings_category_ids`,
`saved_in(db, space_id, period)`, `withdrawn_in(db, space_id, period,
exclude_id=None)`, `check_withdrawal(...)` y `check_item_change(db,
item, new_values)`.

## Web

### Pantallas y datos

| Ruta | Pantalla | Llamadas a la API |
|---|---|---|
| `/mes/reportes` | Reportes | `GET reports?period=&months=` |
| `/mes` | Mes + selector "Este mes \| Reportes" y "Retirado del ahorro" | `GET summary` (con `withdrawn`) |
| `/registrar` | + "Gasto \| Retiro de ahorro" | `POST savings-withdrawals`, `GET summary?period=` |
| `/gastos` | + retiros mezclados por fecha | `GET expenses?period=`, `GET savings-withdrawals?period=` |
| `/retiros/<id>` | Editar o borrar un retiro | `GET`, `PATCH`, `DELETE savings-withdrawals/{id}` |

### Lógica sin DOM

**`reports.js`** — una función por reporte que recibe la respuesta y
devuelve lo que pinta la vista:

    { answer: ["En octubre, Hogar se lleva el ", { figure: "38 %" }, " de lo que gastaste."],
      bars: [...],        // lo que dibuja el gráfico, ya escalado con charts.js
      table: { head: [...], rows: [[...]] },
      empty: null | "Octubre no tiene datos." }

- `spendingReport(data)`: "En octubre, Hogar se lleva el 38 % de lo que
  gastaste"; lo gastado, lo no planeado y "Además, apartaste $ 500.000 en
  Ahorro" si hay algo apartado; `groupLines(lines)` con las seis primeras,
  "Cuotas de tarjetas" y "Otras", con su clase de tinta.
- `planningReport(data)`: "Mercado se pasó $ 85.000 de lo planeado" o "En
  Comida gastaste $ 120.000 sin rubro"; debajo, cuántos rubros se pasaron y
  sobraron y en cuántas categorías hubo gastos sin rubro. Las filas sin
  rubro se escriben "Comida · sin rubro". Si nada se pasó, "Ningún rubro se
  pasó de lo planeado" (RF-20).
- `savingsReport(data)`: con un mes, "En octubre ahorraste $ 618.640, el
  10 % del ingreso" y el desglose ("Apartaste $ 500.000 en Ahorro, lo
  planeado, y quedaron $ 118.640 sin gastar"; con un retiro, "…, retiraste
  $ 200.000 y quedaron…"); con varios, el promedio, en
  cuántos meses se apartó lo planeado, el mejor y el peor; un mes negativo
  con "−" (RF-21 a RF-23).
- `monthBounds(period, firstPeriod, current)`: si se puede ir al mes
  anterior y al siguiente (RF-3).
- `SAVINGS_WINDOWS`: `[{ months: 1, label: "1 mes" }, { 3 }, { 6 }, { 12 }]`.

Los nombres de meses salen de `format.js` (`monthName`, `formatMonth`,
`formatMonthShort`); los montos, de `formatPesos`.

**`withdrawals.js`** — `withdrawalRequest(form)` (monto con
`parseAmount`, fecha y nota sin espacios alrededor, y lo que falta) y
`withdrawalRoom(summary)`: lo que se puede retirar en el mes, con el texto
"En agosto apartaste $ 500.000 y no has retirado nada: puedes retirar hasta
$ 500.000."

**`charts.js`** — geometría, sin DOM:

- `columnScale(values)`: `{ zero, sizes }`, con `zero` la posición de la
  línea de cero (0 si no hay negativos) y cada tamaño como fracción del
  alto, con signo. Todo en 0 → tamaños 0, sin dividir por 0.
- `stackScale(stacks)`: cada pila con sus partes como fracción de la pila
  más alta.
- `divergentScale(values)`: fracciones a cada lado de la línea de cero,
  con el mismo máximo para los dos lados (RF-19).

### Vista (`views/reports.js`)

- Arriba, "Este mes | Reportes" (dos enlaces con `aria-current`) y el
  selector de mes "‹ octubre 2026 ›" con la misma forma que el de Gastos
  (`.month-switch`), con las flechas deshabilitadas en los límites y el
  nombre del mes en una región `aria-live="polite"`.
- Cada reporte es una `<section>` con rótulo, mes o ventana, respuesta,
  gráfico y `<details>` de cifras. "¿Estoy ahorrando?" lleva sus cuatro
  botones de ventana (`aria-pressed`). Cambiar el mes o la ventana pide de
  nuevo la ruta y repinta los tres.
- Los nombres de categorías y rubros van con `textContent` (`h()`).
- Estados de carga, error y sin conexión con `screenError`, como la 012.

## Diseño (`tokens.css` y `app.css`)

- Tokens `--tint-1` a `--tint-6` (azul de Prusia, verde botella, ocre,
  óxido, ciruela y pizarra) y `--tint-other`, en el bloque claro y en el
  oscuro. Los valores salen del prototipo (T1).
- Clases `.tint-1` … `.tint-6`, `.tint-other` y `.tint-debts` (`--ink`),
  que fijan `background-color` de las barras.
- `.report`: rótulo en `--size-label`, respuesta en 1,25 rem con la cifra en
  `--font-figures`; entre reportes, la doble raya roja.
- `.columns`: `display: grid` con una columna por mes
  (`grid-auto-flow: column`), alto fijo, la línea de cero en
  `calc(var(--zero) * 100%)`; cada barra con
  `block-size: calc(var(--size) * 100%)` y 2 px de papel entre partes
  apiladas.
- `.divergent`: dos mitades por renglón; lo que se pasa a la derecha en
  `--red` con "+", lo que sobra a la izquierda en `--ink`.
- `.reports`: un reporte debajo de otro; desde 1280 px, dos columnas y
  `max-inline-size: 1040px`, con "¿Estoy ahorrando?" a todo el ancho
  (decisión 17).
- En el celular, los botones de la ventana en dos filas de dos.
- Sin sombras, sin emojis y sin degradados (011).

## Tests

**Categoría Ahorro**:

- `test_categories.py`: un espacio nuevo trae "Ahorro" al final de las
  predefinidas.
- `test_migrations.py`: la 0006 crea "Ahorro" en un espacio que no la tiene,
  no la duplica en uno que ya tiene "ahorro" activa, no restaura una
  archivada, y migrar dos veces no cambia nada; la 0007 crea
  `savings_withdrawals` con su `CHECK` y deja la base igual a los modelos.

**Retiros (`test_savings_withdrawals.py` y `test_summary.py`)**:

- Crear, listar por mes, editar y borrar un retiro; monto, fecha y nota con
  los mismos mensajes que un gasto; quién lo registró.
- Límite: con $ 500.000 apartados, retirar $ 500.000 sí y $ 500.001 no;
  dos retiros que juntos pasan; editar uno por encima; cambiar su fecha a
  un mes sin nada apartado; sin categoría Ahorro, nada que retirar.
- Guarda: borrar el rubro de Ahorro de un mes con retiros → `409` y nada
  cambia; bajar su monto o cambiarle la categoría, igual; un rubro de otra
  categoría no se ve afectado.
- Un gasto en Ahorro, con categoría o con rubro, al crearlo o editarlo →
  `422` (decisión 29).
- Resumen: Ahorro con `spent` neto y `withdrawn`; `total.spent` y
  `balance` descuentan lo retirado; `spent_unplanned` no cambia.
- Otro espacio: `404` al ver, editar o borrar un retiro ajeno.

**API (`test_reports.py`)**, con el reloj fijo el 2026-11-15 y un espacio
de ejemplo de mayo a noviembre de 2026:

- Mayo sin ingresos ni gastos; Sueldo $ 6.500.000 de junio a octubre, y un
  mes con gastos y sin ingresos planeados.
- Rubros Arriendo $ 1.800.000 (justo), Mercado $ 900.000 (se pasa),
  Gasolina $ 300.000 (sobra) y Ahorro $ 500.000 (en un mes se apartan
  $ 300.000 y en otro nada); gastos sin rubro en Comida y en Ropa, que no
  tiene rubros.
- Visa (corte 25, pago 10, 1,89 %) con una compra a 6 cuotas, que llega a
  "Cuotas de tarjetas" en los meses en que se paga, y un gasto del mes con
  la Visa en Mercado, que cuenta en Comida.
- Una categoría archivada con gastos en el mes.
- Otro espacio con datos propios.

Casos (criterio 1): sin `period`, el mes anterior; `?period=` del mes
actual, de uno futuro o mal escrito → `422`; `?months=2` y `?months=abc` →
`422`; `first_period`; gasto por categoría con "Cuotas de tarjetas", lo no
planeado y lo apartado fuera de la lista; rubros del mes y filas sin rubro,
sin Ahorro; lo apartado, lo que quedó y lo ahorrado, con el ingreso de
referencia marcado como estimado; la ventana que termina en el mes elegido;
mayo fuera de los promedios; mejor, peor y meses en que se apartó lo
planeado; repartos que suman el total y porcentajes que suman 100; otro
espacio no ve nada (`404`). Y las funciones puras con sus bordes
(`rounded_div` con negativos, `split_percent` con empates y total 0,
`window_periods` en enero).

**Web (`node --test`)**, con una respuesta de ejemplo igual a la de la API:

- `withdrawals.test.js`: monto escrito con puntos; sin monto, `missing`;
  lo que se puede retirar con y sin retiros previos.
- `dashboard.test.js`: la línea "Retirado del ahorro" en Ahorro y no en
  otras categorías.
- `expenses-list.test.js`: retiros y gastos mezclados por fecha, el retiro
  con "+".
- `reports.test.js`: la frase de cada reporte; lo apartado aparte; la fila
  sin rubro primera; ahorro con un mes y con varios, negativo y sin
  ingreso; ocho categorías → seis, "Cuotas de tarjetas" y "Otras", con
  sumas iguales; los textos de vacío; `monthBounds` en el primer mes con
  datos y en el mes anterior al actual.
- `charts.test.js`: columnas solo positivas, con negativos (línea de
  cero), todas en 0; pilas; divergentes con el mismo máximo a cada lado.
- `routes.test.js`: `/mes/reportes`.

**Contraste (`contrast.test.js`)**, en los dos temas (criterio 3), con el
método y los umbrales del validador de paletas usado en el prototipo:

- Cada tinta y `--tint-other` contra `--paper` y `--field`: al menos 3:1.
- Separación entre tintas vecinas (1-2, 2-3, … 6-otras): distancia en
  OKLab ×100 de al menos 15 con visión normal y de al menos 8 con
  deuteranopía y protanopía simuladas (Machado, Oliveira y Fernandes,
  2009).

**Servidor**: `test_serve.py` añade `/mes/reportes`.

**Verificación a mano**: `specs/013-reportes/verificacion.md` con la lista
del criterio 4, en Chrome del computador (columna C) y con las columnas A e
I para la 020.

## Riesgos y temas abiertos

- **Doce resúmenes por petición.** Con una ventana de 12 meses y tres
  tarjetas son unas 180 consultas pequeñas: unas 6 por resumen más 3 por
  tarjeta en `card_debts`. Con PostgreSQL en la misma máquina, menos de
  0,1 s. No se optimiza antes (principio 2), pero el riesgo queda medido en
  T6:
  - **Test de consultas**: `?months=12` con el espacio de ejemplo no pasa
    de 300 consultas, contadas con el evento
    [`before_cursor_execute`](https://docs.sqlalchemy.org/en/20/core/events.html#sqlalchemy.events.ConnectionEvents.before_cursor_execute)
    de SQLAlchemy. No mide velocidad, que depende de la máquina: detecta
    una consulta metida en un bucle
    ([N+1 consultas](https://docs.sqlalchemy.org/en/20/glossary.html#term-N-plus-one-problem)).
  - **Tiempo medido a mano**: `?months=12` contra la base local. Si pasa de
    300 ms, se optimiza en la misma tarea.
  - **La optimización, si hace falta**: leer una vez, para toda la ventana,
    las compras, abonos y extractos de cada tarjeta, y armar la deuda de
    cada mes en Python, en lugar de tres consultas por tarjeta y mes. Los
    tests de la 009 y la 010 vigilan que las reglas no cambien.
  - **Fase 7**: la latencia de `/reports`, el endpoint más pesado de la
    app, es el primer candidato para las métricas y los dashboards
    (specs 023 y 024).
- **El Mes de la 012 trata Ahorro como cualquier categoría**, salvo lo
  retirado y que sus rubros se ven apartados enteros desde que se planean
  (decisión 29).
- **El límite del retiro ata lo apartado.** Para bajar o borrar un rubro de
  Ahorro con retiros en su mes hay que cambiar antes el retiro. Es lo que pide la
  decisión 28; el mensaje del `409` dice qué hacer.
- **La 013 crece**: además de los reportes, toca Registrar, Gastos, el Mes
  y el resumen. Las tareas lo separan para que cada una quede pequeña.
- **Una categoría llamada distinto** ("Ahorros", "Inversión") no es la
  categoría Ahorro. Es lo que dice el concepto de la spec: una sola, por su
  nombre.
- **Seis tintas oscuras distinguibles con daltonismo** sobre un papel claro
  piden alternar claras y oscuras entre vecinas. El prototipo lo logró; si
  un ajuste posterior baja del umbral, el test lo dice, y lo apoyan el
  nombre escrito y 2 px de papel entre partes (RF-17).

## Conceptos nuevos

- [`SELECT … FOR UPDATE`](https://docs.sqlalchemy.org/en/20/orm/queryguide/query.html#sqlalchemy.orm.Query.with_for_update):
  bloquear filas mientras se decide, para que dos peticiones a la vez no
  pasen un límite.
- [Migraciones de datos con Alembic](https://alembic.sqlalchemy.org/en/latest/ops.html#alembic.operations.Operations.execute):
  una migración que cambia filas y no la estructura.
- [Método del resto mayor](https://es.wikipedia.org/wiki/M%C3%A9todo_del_resto_mayor):
  repartir porcentajes enteros que sumen 100.
- [OKLab](https://bottosson.github.io/posts/oklab/): un espacio de color
  donde la distancia entre dos colores se parece a la diferencia que se
  percibe.
- [Simulación de daltonismo (Machado, Oliveira y Fernandes, 2009)](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html):
  cómo ve los colores una persona con deuteranopía o protanopía.
- [`<details>` y `<summary>`](https://developer.mozilla.org/es/docs/Web/HTML/Element/details):
  contenido que se abre y se cierra sin JavaScript.
- [`prefers-reduced-motion`](https://developer.mozilla.org/es/docs/Web/CSS/@media/prefers-reduced-motion):
  respetar a quien pidió menos movimiento.
