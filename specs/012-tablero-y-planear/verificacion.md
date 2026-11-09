# Verificación a mano — 012 Tablero y planear

Lista del criterio 4 de la spec. Se marca cada paso en cada navegador.
Las marcas de **C** se comprueban con Chromium sin interfaz, conducido por
su protocolo de depuración, a 390 y 1280 px y en los dos temas, contra una
API con datos de ejemplo. Las columnas **A** e **I** se marcan junto con las
de la 011, cuando la app esté desplegada con HTTPS (019 en
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
| Una tarjeta del mes enlaza a su estado; una archivada dice "eliminada". | [ ] | [ ] | [ ] |

## Planear (T6)

| Paso | A | I | C |
|---|---|---|---|
| Planear un mes en blanco con dos ingresos y tres rubros solo con teclado. | — | — | [ ] |
| Cambiar el monto de un rubro y ver "Guardado". | [ ] | [ ] | [ ] |
| Un renglón a medias dice qué le falta y no se crea. | [ ] | [ ] | [ ] |
| Un nombre repetido muestra el mensaje de la API junto al campo. | [ ] | [ ] | [ ] |
| Quitar un rubro con gastos pide confirmación; sus gastos quedan sin rubro. | [ ] | [ ] | [ ] |
| Escribir y quitar el extracto de la Visa. | [ ] | [ ] | [ ] |
| "Listo" guarda el renglón abierto. | [ ] | [ ] | [ ] |

## Tarjetas (T7 y T8)

| Paso | A | I | C |
|---|---|---|---|
| Añadir la Visa; un día 32 muestra el mensaje de la API junto al campo. | [ ] | [ ] | [ ] |
| Editar la tasa. | [ ] | [ ] | [ ] |
| Eliminar pide confirmación y muestra el mensaje de la API; crearla de nuevo la restaura. | [ ] | [ ] | [ ] |
| Sin tarjetas, Registrar a crédito enlaza a añadir una. | [ ] | [ ] | [ ] |
| El estado de la Visa muestra sus compras y sus meses, con el extracto marcado. | [ ] | [ ] | [ ] |
| Pagar todo pide confirmación, crea los abonos y lo dice. | [ ] | [ ] | [ ] |
| Pagar todo sin compras muestra el mensaje de la API. | [ ] | [ ] | [ ] |

## Compras y abonos (T9)

| Paso | A | I | C |
|---|---|---|---|
| Abonar a la "Compra TV" bajando el plazo dice el efecto ("termina en …"). | [ ] | [ ] | [ ] |
| "Deshacer" borra el abono. | [ ] | [ ] | [ ] |
| Abonar bajando la cuota dice la cuota nueva. | [ ] | [ ] | [ ] |
| Borrar un abono pide confirmación y recalcula el plan. | [ ] | [ ] | [ ] |
| Desde el gasto en Gastos, "Ver cuotas y abonos" abre la compra; el bloqueo enlaza a ella. | [ ] | [ ] | [ ] |

## Categorías (T10)

| Paso | A | I | C |
|---|---|---|---|
| Crear "Mascotas"; un nombre repetido muestra el mensaje de la API. | [ ] | [ ] | [ ] |
| Eliminarla pide confirmación y muestra el mensaje de la API. | [ ] | [ ] | [ ] |
| Crearla de nuevo la restaura. | [ ] | [ ] | [ ] |

## Diseño y accesibilidad (T11)

| Paso | A | I | C |
|---|---|---|---|
| Todo con teclado y foco visible en las pantallas nuevas. | — | — | [ ] |
| Zoom al 200 % (*reflow* a 320 px) sin perder contenido. | [ ] | [ ] | [ ] |
| Objetivos de al menos 44 px. | [ ] | [ ] | [ ] |
| Estados de carga, vacío, error y sin conexión en cada pantalla nueva. | [ ] | [ ] | [ ] |
| Las barras no se leen con el lector de pantalla; las cifras sí. | [ ] | [ ] | [ ] |
| Tema oscuro en todas las pantallas nuevas. | [ ] | [ ] | [ ] |
| Ningún emoji, sombra ni degradado; cifras alineadas a la derecha. | [ ] | [ ] | [ ] |
