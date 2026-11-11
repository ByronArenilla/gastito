# Verificación a mano — 012 Tablero y planear

Lista del criterio 4 de la spec. Se marca cada paso en cada navegador.
Las marcas de **C** se comprueban con Chromium sin interfaz, conducido por
su protocolo de depuración, a 390 y 1280 px y en los dos temas, contra una
API con datos de ejemplo. Las columnas **A** e **I** se marcan junto con las
de la 011, cuando la app esté desplegada con HTTPS (020 en
`docs/roadmap.md`).

Columnas:
**A** = Chrome en Android, **I** = Safari en iPhone, **C** = Chrome en el
computador. Antes de empezar:

- `make run-api` y `make run-web` corriendo.
- Un espacio con el plan de noviembre (ingresos y rubros), gastos con y sin
  rubro, un rubro excedido, la Visa con una compra a 6 cuotas y otra a 1
  cuota del mes. Todo se crea desde la web (README, "Plan del mes" y
  "Tarjetas").

## Navegación e inicio (T2)

| Paso | A | I | C |
|---|---|---|---|
| Cinco secciones a 360 px, sin cortar ninguna palabra. | [ ] | [ ] | [x] |
| A 1280 px, las cinco al costado, apiladas arriba. | — | — | [x] |
| `/` abre el Mes a 1280 px y Registrar a 390 px. | [ ] | [ ] | [x] |
| Cambiar de mes en Gastos y abrir el Mes muestra el mismo mes. | [ ] | [ ] | [x] |

## Mes (T4)

| Paso | A | I | C |
|---|---|---|---|
| El tablero de noviembre muestra totales, la barra del ingreso con su leyenda y las categorías con sus rubros. | [ ] | [ ] | [x] |
| Un rubro excedido dice "excedido −…" en rojo y su medidor se llena en rojo. | [ ] | [ ] | [x] |
| Lo no planeado sale como "Sin rubro" en su categoría. | [ ] | [ ] | [x] |
| Un plan que supera el ingreso lo dice con el monto. | [ ] | [ ] | [x] |
| Un mes vacío ofrece copiar el plan y planear en blanco. | [ ] | [ ] | [x] |
| Copiar trae el plan y dice qué rubros omitió. | [ ] | [ ] | [x] |
| Copiar sin plan en el mes anterior muestra el mensaje de la API. | [ ] | [ ] | [x] |
| Una tarjeta del mes enlaza a su estado; una archivada dice "eliminada". | [ ] | [ ] | [x] |

## Planear (T6)

| Paso | A | I | C |
|---|---|---|---|
| Planear un mes en blanco con dos ingresos y tres rubros solo con teclado. | — | — | [x] |
| Cambiar el monto de un rubro y ver "Guardado". | [ ] | [ ] | [x] |
| Un renglón a medias dice qué le falta y no se crea. | [ ] | [ ] | [x] |
| Un nombre repetido muestra el mensaje de la API junto al campo. | [ ] | [ ] | [x] |
| Quitar un rubro con gastos pide confirmación; sus gastos quedan sin rubro. | [ ] | [ ] | [x] |
| Escribir y quitar el extracto de la Visa. | [ ] | [ ] | [x] |
| "Listo" guarda el renglón abierto. | [ ] | [ ] | [x] |

## Tarjetas (T7 y T8)

| Paso | A | I | C |
|---|---|---|---|
| Añadir la Visa; un día 32 muestra el mensaje de la API junto al campo. | [ ] | [ ] | [x] |
| Editar la tasa. | [ ] | [ ] | [x] |
| Eliminar pide confirmación y muestra el mensaje de la API; crearla de nuevo la restaura. | [ ] | [ ] | [x] |
| Sin tarjetas, Registrar a crédito enlaza a añadir una. | [ ] | [ ] | [x] |
| El estado de la Visa muestra sus compras y sus meses, con el extracto marcado. | [ ] | [ ] | [x] |
| Pagar todo pide confirmación, crea los abonos y lo dice. | [ ] | [ ] | [x] |
| Pagar todo sin compras muestra el mensaje de la API. | [ ] | [ ] | [x] |

## Compras y abonos (T9)

| Paso | A | I | C |
|---|---|---|---|
| Abonar a la "Compra TV" bajando el plazo dice el efecto ("termina en …"). | [ ] | [ ] | [x] |
| "Deshacer" borra el abono. | [ ] | [ ] | [x] |
| Abonar bajando la cuota dice la cuota nueva. | [ ] | [ ] | [x] |
| Borrar un abono pide confirmación y recalcula el plan. | [ ] | [ ] | [x] |
| Desde el gasto en Gastos, "Ver cuotas y abonos" abre la compra; el bloqueo enlaza a ella. | [ ] | [ ] | [x] |

## Categorías (T10)

| Paso | A | I | C |
|---|---|---|---|
| Crear "Mascotas"; un nombre repetido muestra el mensaje de la API. | [ ] | [ ] | [x] |
| Eliminarla pide confirmación y muestra el mensaje de la API. | [ ] | [ ] | [x] |
| Crearla de nuevo la restaura. | [ ] | [ ] | [x] |

## Diseño y accesibilidad (T11)

| Paso | A | I | C |
|---|---|---|---|
| Todo con teclado y foco visible en las pantallas nuevas. | — | — | [x] |
| Zoom al 200 % (*reflow* a 320 px) sin perder contenido. | [ ] | [ ] | [x] |
| Objetivos de al menos 44 px. | [ ] | [ ] | [x] |
| Estados de carga, vacío, error y sin conexión en cada pantalla nueva. | [ ] | [ ] | [x] |
| Las barras no se leen con el lector de pantalla; las cifras sí. | [ ] | [ ] | [x] |
| Tema oscuro en todas las pantallas nuevas. | [ ] | [ ] | [x] |
| Ningún emoji, sombra ni degradado; cifras alineadas a la derecha. | [ ] | [ ] | [x] |
