# Plan 012 — Tablero y planear

- Spec: `spec.md` (estado: borrador)
- Servicios afectados: `services/web`. La API no cambia.
- Estado: borrador (2026-11-09)

La 012 sigue el camino de la 011: HTML, CSS y módulos de JavaScript
nativos, sin framework, sin `npm` y sin compilación. Cada pantalla nueva
tiene un módulo de lógica sin DOM, probado con `node --test`, y una vista
que arma el DOM con `h()` y llama a la API.

El plan tiene seis partes:

1. **Prototipo**: una página desechable con Mes, Planear, Tarjetas y una
   compra, con los datos de ejemplo de la spec, para elegir antes de
   escribir código (roadmap). No entra al repositorio.
2. **Navegación e inicio**: cinco secciones, la pantalla de inicio según el
   ancho, el mes elegido compartido y `start_url: "/"`.
3. **Mes**: el tablero y sus barras.
4. **Planear**: la tabla editable con guardado por renglón y copiar el plan.
5. **Tarjetas, compras y abonos**.
6. **Categorías** y los cambios en lo de la 011.

La decisión de no usar una librería de gráficos queda en el ADR 0016.

## Decisiones técnicas

| Decisión | Elegido | Por qué |
|---|---|---|
| Barras | `<div>` con `width` en porcentaje, que calcula `dashboard.js` y se aplica como propiedad CSS (`style.setProperty("--fill", "0.58")`), y CSS con `inline-size: calc(var(--fill) * 100%)` | Decisión 15. Son barras horizontales de una sola medida: no hacen falta ejes, escalas ni SVG. Con la CSP de la 011 (`style-src 'self'`), un atributo `style` escrito en el HTML se bloquea, pero `element.style.setProperty` desde un módulo propio sí está permitido ([MDN, `style-src`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src): los estilos fijados con la propiedad `style` del elemento no se restringen). Se descartó Chart.js: añade una dependencia de 200 KB que habría que servir desde la web (RF-39 de la 011) para dibujar rectángulos. |
| Accesibilidad de las barras | `aria-hidden="true"` en cada barra; las cifras escritas al lado son el dato | Decisión 15. Una barra no tiene texto que leer, y las cifras ya dicen lo mismo. Así no hace falta una tabla aparte para el lector de pantalla. |
| Colores de la barra del ingreso | Rubros `--ink`, deudas `--rule-strong`, sin asignar el fondo de la barra (`--rule`); 2 px de separación entre partes | Tres partes y tres tokens que ya existen. `contrast.test.js` comprueba que las partes llenas pasan 3:1 sobre el papel en los dos temas. La separación y la leyenda con montos evitan que el color sea la única pista. |
| Mes elegido compartido | `app.drafts` con la clave `period` (ya existe `expenses-period`, que pasa a llamarse `period`); `null` significa "el actual" | Decisión 9. En memoria, como el resto del estado de la 011: al abrir la app vuelve al mes actual. |
| Mes actual | `GET summary` sin `period` y se toma `summary.period` | Decisión 10. La web no calcula fechas propias; el mes anterior y el siguiente salen de `format.js` (`previousPeriod`, `nextPeriod`), que ya existen. |
| Pantalla de inicio | `homePath(width)` en `routes.js`: `/mes` si `width >= 1024`, si no `/registrar`. `main.js` la usa para `/`, para una ruta desconocida y después de entrar sin ruta pendiente | Decisión 3. El mismo punto de corte que la navegación lateral. Se lee `window.innerWidth` en ese momento: girar el celular después no cambia de pantalla. |
| Guardado por renglón | Cada renglón de Planear es un `<fieldset>`. El evento `focusout` con `relatedTarget` fuera del renglón dispara el guardado. `plan-rows.js` decide qué enviar comparando el renglón con el original | Decisión 5 y RF-13. `focusout` burbujea y `relatedTarget` dice adónde va el foco: así cambiar de campo dentro del mismo renglón no guarda a medias. Con el teclado, Tab hacia el renglón siguiente guarda; con el ratón, hacer clic fuera, también. "Listo" guarda el renglón abierto antes de salir. |
| Un envío por renglón a la vez | El renglón queda `disabled` mientras espera y se habilita con la respuesta | RF-18. Sin esto, dos `focusout` seguidos de un renglón nuevo crearían dos rubros. |
| Copiar el plan | `POST plan/copy {period}`; la respuesta trae el resumen nuevo, que se pinta sin otra petición, y `skipped` para el aviso | RF-11. La API ya rechaza un mes con plan o un mes anterior sin plan con su mensaje. |
| Extracto | `PUT cards/{id}/statements/{period} {amount}` al salir del campo con un valor; `DELETE` con "Quitar extracto" | RF-17 y decisión 20 de la 009: quitarlo no pide confirmación. |
| Efecto de un abono | Se pide `GET expenses/{id}/installments` antes de abonar; la respuesta del abono trae el plan nuevo. `purchases.js` compara los dos: con "plazo", el mes de la última cuota; con "cuota", la cuota siguiente al mes del abono | RF-25 y decisión 7. La comparación es lógica de presentación sobre dos respuestas de la API, no una regla de negocio (principio 10). |
| Meses para abonar | Las cuotas con `period` posterior al último abono y `balance_after > 0` | Decisiones 18 y 19 de la 009. La API valida igual: la lista solo evita ofrecer meses que siempre fallan. |
| Tarjetas archivadas en el Mes | Las de `summary.debts` con `deleted: true` enlazan a `/tarjetas/<id>`; `GET cards/{id}/status` funciona con una archivada | Decisión 18. Sin ruta nueva en la API. |
| Diálogos de confirmación | El `app.confirm()` de la 011 (`<dialog>`) | Decisiones 14, 17 y 19. Mismo componente, mismo comportamiento con Escape. |
| Lo que viene de la API | Los nombres de rubros, tarjetas y categorías van siempre con `textContent` (`h()`), como en la 011 | Un rubro llamado `<img onerror=…>` se ve como texto. |

## Dependencias

- **Ninguna dependencia nueva**, ni de Python ni de JavaScript.
- El prototipo es un archivo HTML suelto que se publica para verlo y no
  entra al repositorio.

## Estructura de archivos

    services/web/
      public/
        index.html                   + Mes y Tarjetas en la navegación   [RF-1]
        manifest.webmanifest         start_url "/"                       [RF-3]
        css/app.css                  + barras, medidores, Planear, tablas de cuotas
        js/
          routes.js                  + rutas nuevas, homePath()          [RF-1, RF-2]
          main.js                    secciones nuevas, inicio por ancho  [RF-2]
          dashboard.js     (nuevo)   resumen → lo que pinta el Mes       [RF-5 a RF-9]
          plan-rows.js     (nuevo)   renglón → qué enviar o qué falta    [RF-13 a RF-16]
          cards.js         (nuevo)   tarjeta: formulario, estado, pagar todo [RF-19 a RF-23]
          purchases.js     (nuevo)   meses para abonar, efecto del abono  [RF-25]
          categories.js    (nuevo)   formulario y orden de categorías     [RF-28]
          expense-form.js            enlace a abonos en el bloqueo        [RF-27]
          views/
            month.js       (nuevo)   Mes, Planear, copiar el plan        [RF-4 a RF-18]
            cards.js       (nuevo)   lista, tarjeta, formulario          [RF-19 a RF-23]
            purchase.js    (nuevo)   compra, abonar, borrar abono        [RF-24 a RF-26]
            space.js                 + categorías                        [RF-28, RF-29]
            record.js                sin tarjetas → enlace; "Ver cuotas y abonos" [RF-27, RF-30]
            expenses.js              mes elegido compartido              [RF-4]
      tests/
        dashboard.test.js, plan-rows.test.js, cards.test.js,
        purchases.test.js, categories.test.js                            (criterio 1)
        routes.test.js               + rutas nuevas y homePath()         (criterio 1)
        contrast.test.js             + partes de la barra y medidores    (criterio 2)
        test_serve.py                start_url "/" y rutas nuevas        (criterio 3)
    docs/adr/0016-barras-propias-sin-libreria.md
    specs/012-tablero-y-planear/verificacion.md
    README.md                        "Plan del mes" y "Tarjetas" con la web

## Pantallas y datos

| Ruta | Pantalla | Llamadas a la API |
|---|---|---|
| `/mes` | Mes (tablero) | `GET summary?period=`, `GET cards` (día de pago), `POST plan/copy` |
| `/mes/planear` | Planear | lo del Mes, `GET categories`, `POST`/`PATCH`/`DELETE budget-items`, `POST`/`PATCH`/`DELETE incomes`, `PUT`/`DELETE cards/{id}/statements/{period}` |
| `/tarjetas` | Tarjetas | `GET cards`, `GET cards/{id}/status` por tarjeta |
| `/tarjetas/nueva` | Añadir tarjeta | `POST cards` |
| `/tarjetas/<id>` | Estado de la tarjeta | `GET cards/{id}/status`, `POST cards/{id}/payoff`, `DELETE cards/{id}` |
| `/tarjetas/<id>/editar` | Editar tarjeta | `GET cards/{id}/status` (trae la tarjeta), `PATCH cards/{id}` |
| `/compras/<id>` | Compra con tarjeta | `GET expenses/{id}`, `GET expenses/{id}/installments`, `POST`/`DELETE expenses/{id}/prepayments` |
| `/espacio` | + Categorías | `GET`/`POST`/`DELETE categories` |
| `/` | — | Lleva a `homePath(window.innerWidth)` con sesión, o a `/entrar` |

Todas piden sesión. Las rutas de la API van bajo `/spaces/{space_id}`.

## Lógica sin DOM

**`dashboard.js`** — `buildDashboard(summary)` devuelve:

    totals:   { income, planned, spent, unassigned, balance, cardsToPay }
    incomeBar: { parts: [{ key: "items" | "debts" | "free", amount, share }],
                 over: 0 | monto en que lo planeado supera el ingreso }
    categories: [{ id, name, deleted, planned, spent,
                   items: [{ id, name, planned, spent, remaining, fill, exceeded }],
                   unplanned }]
    cards:    [{ id, name, deleted, toPay, estimated, statement, ... }]
    empty:    true si no hay rubros ni ingresos

- `items` del ingreso = `total.planned − total.debts`; `debts` =
  `total.debts`; `free` = `max(total.unassigned, 0)`. Las partes suman el
  ingreso; si lo planeado lo supera, `over = −total.unassigned` y las partes
  se escalan sobre lo planeado.
- `fill` del medidor = `min(spent / planned, 1)`; un rubro con `planned` 0 y
  gasto se trata como excedido.
- `unplanned` de una categoría = su `spent` menos lo gastado en sus rubros;
  solo sale si es mayor que 0.
- Las categorías y los rubros conservan el orden de la API.

**`plan-rows.js`**

    rowRequest(kind, original, row) ->
        { action: "create" | "update" | "none", body, missing: [campos] }

- `kind` es `"item"` o `"income"`. `original` es `null` en un renglón
  nuevo. El monto se limpia con `parseAmount` de `format.js`.
- Nuevo e incompleto → `none` con lo que falta ("nombre", "categoría",
  "monto"). Nuevo completo → `create` con `period`. Existente → `update`
  solo con lo que cambió; sin cambios → `none`.
- `needsConfirm(item)` → `true` si `item.spent > 0` (decisión 14).
- `statementRequest(card, value)` → `put`, `delete` o `none`.

**`cards.js`**

- `cardForm(state)` → cuerpo de `POST`/`PATCH` con los días como enteros y
  la tasa como número (`"1,89"` → `1.89`; vacío → `null`) y `missing`.
- `cardLine(card)` → "corte 25 · paga el 10 · 1,89 % mensual".
- `payoffText(card, period)` → el texto del diálogo de pagar todo.

**`purchases.js`**

- `prepaymentMonths(schedule)` → los periodos que se ofrecen (decisión 16).
- `prepaymentEffect(before, after, reduces)` → "Ahora termina en marzo, no
  en mayo." o "Ahora la cuota es $ 200.000, no $ 300.000.".

**`categories.js`** — `categoryRequest(name)` con el nombre sin espacios
alrededor y `missing` si queda vacío.

**`routes.js`** — las rutas nuevas y `homePath(width)`.

## Diseño (`app.css`)

- `.meter`: 6 px de alto, fondo `--rule`, relleno `--ink` con
  `inline-size: calc(var(--fill) * 100%)`; `.meter--over` rellena en `--red`.
- `.income-bar`: 8 px, `display: flex`, `gap: 2px`, cada parte con
  `flex-basis: calc(var(--share) * 100%)`.
- `.legend`: muestra cuadrada de 10 px, nombre y monto a la derecha.
- `.plan-row`: `display: grid` de tres columnas (nombre, categoría, monto) y
  la acción; bajo 640 px, una columna.
- `.schedule`: tabla con `font-variant-numeric: tabular-nums`, cifras a la
  derecha y las cuotas pasadas en `--muted`.
- La navegación inferior con cinco secciones: `flex: 1` por enlace y rótulos
  de 12 px; se comprueba a 360 px que no se corten.
- Sin transiciones nuevas, salvo las de 150 ms de color de la 011.

## Tests

**Lógica (`node --test`)**, con un resumen de ejemplo de noviembre 2026
(ingresos $ 6.500.000; Arriendo $ 1.800.000 de $ 1.800.000; Mercado
$ 520.000 de $ 900.000; Gasolina $ 340.000 de $ 300.000; $ 120.000 sin rubro
en Comida; Visa con $ 1.020.000 a pagar):

- `dashboard.test.js`: totales; partes de la barra del ingreso que suman el
  ingreso; plan que supera el ingreso; medidor lleno y excedido en Gasolina
  (`remaining` −40.000); "sin rubro" en Comida y no en Hogar; rubro con
  planeado 0 y gasto; mes vacío; tarjeta archivada marcada.
- `plan-rows.test.js`: renglón nuevo completo e incompleto (qué falta);
  existente con un solo cambio; sin cambios; monto escrito con puntos;
  confirmación al quitar un rubro con gastos y no sin ellos; extracto
  escrito, quitado y sin cambio.
- `cards.test.js`: formulario con tasa con coma y vacía, días fuera de rango
  enviados tal cual (los valida la API); texto de la línea y de pagar todo.
- `purchases.test.js`: meses para abonar con y sin abonos previos; efecto
  con plazo y con cuota.
- `categories.test.js`: nombre con espacios y vacío.
- `routes.test.js`: las rutas nuevas con sus parámetros; `homePath(1280)` es
  `/mes` y `homePath(390)`, `/registrar`.

**Contraste**: `contrast.test.js` añade `--ink` y `--rule-strong` sobre
`--paper` ≥ 3:1 (partes de la barra) en los dos temas.

**Servidor**: `test_serve.py` cambia `start_url` a `/` y añade `/mes`,
`/mes/planear`, `/tarjetas/3` y `/compras/12` a las rutas que devuelven
`index.html`.

**Verificación a mano**: `specs/012-tablero-y-planear/verificacion.md` con
la lista del criterio 4, en Chrome del computador (columna C) y con las
columnas A e I para cuando la app esté desplegada.

## Riesgos y temas abiertos

- **Dos miembros planeando a la vez.** Cada renglón se guarda solo, así que
  el último en guardar gana, renglón por renglón. Es aceptable para un
  espacio de pocas personas; la web no avisa de cambios ajenos hasta
  recargar.
- **Guardar al salir del renglón no tiene botón "Guardar".** Lo compensan el
  aviso "Guardado" en cada renglón y que "Listo" guarda el abierto. Si en el
  prototipo se ve confuso, se cambia ahí, antes del código.
- **Una petición de estado por tarjeta en Tarjetas.** Con 2 o 3 tarjetas son
  2 o 3 peticiones en paralelo. Si crece, se pide a la API una ruta que lo
  dé junto.
- **Cinco secciones en 360 px.** Los cinco rótulos caben a 12 px con
  `letter-spacing` reducido; si no, se acorta el espaciado y nunca la
  palabra. Se comprueba en el prototipo.
- **El tablero solo tiene sentido con datos.** La verificación a mano parte
  de un espacio con plan, gastos y una compra con abonos; el README dice
  cómo crearlos con la web.

## Conceptos nuevos

- [`focusout` y `relatedTarget`](https://developer.mozilla.org/es/docs/Web/API/Element/focusout_event):
  saber si el foco salió de un grupo de campos.
- [Propiedades personalizadas de CSS](https://developer.mozilla.org/es/docs/Web/CSS/Using_CSS_custom_properties)
  fijadas desde JavaScript con `style.setProperty`, compatibles con una CSP
  sin `'unsafe-inline'`.
- [Contraste de elementos no textuales (WCAG 1.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
