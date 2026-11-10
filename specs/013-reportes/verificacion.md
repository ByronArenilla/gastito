# Verificación a mano — 013 Reportes para decidir

Lista del criterio 4 de la spec. Se marca cada paso en cada navegador.
Las marcas de **C** se comprueban con Chromium sin interfaz, conducido por
su protocolo de depuración, a 320, 390 y 1280 px y en los dos temas, contra
una API temporal con los datos de ejemplo del prototipo (noviembre de 2025 a
noviembre de 2026, sembrados por la API). Las columnas **A** e **I** se
marcan con las de la 011 y la 012, cuando la app esté desplegada con HTTPS
(020 en `docs/roadmap.md`).

Columnas:
**A** = Chrome en Android, **I** = Safari en iPhone, **C** = Chrome en el
computador. Antes de empezar:

- `make run-api` y `make run-web` corriendo.
- Un espacio con varios meses de plan y gastos, un rubro Ahorro, la Visa
  con una compra a cuotas, un mes sin datos y un retiro de ahorro. Todo se
  crea desde la web (README, "Plan del mes", "Tarjetas" y "Reportes").

## Retiros de ahorro (T9)

| Paso | A | I | C |
|---|---|---|---|
| Registrar → "Retiro de ahorro" muestra monto, fecha, nota y cuánto se puede retirar en el mes de la fecha. | [ ] | [ ] | [x] |
| Un retiro por encima de lo que se puede muestra el mensaje de la API. | [ ] | [ ] | [x] |
| Un retiro válido dice "Registrado" con "Deshacer", y lo que se puede retirar baja. | [ ] | [ ] | [x] |
| En Gastos, el retiro sale en su día con "+" y su nota, y debajo del total, "Retirado del ahorro". | [ ] | [ ] | [x] |
| Abrir el retiro permite editarlo; borrarlo pide confirmación y vuelve a Gastos. | [ ] | [ ] | [x] |
| Borrar lo apartado de un mes con retiros muestra el mensaje del `409` y no borra nada. | [ ] | [ ] | [x] |
| Sin conexión, registrar un retiro lo avisa y no envía nada. | [ ] | [ ] | [x] |

## Mes con lo retirado (T10)

| Paso | A | I | C |
|---|---|---|---|
| Agosto muestra Ahorro con lo neto y la línea "Retirado del ahorro". | [ ] | [ ] | [ ] |
| El balance del mes descuenta lo retirado. | [ ] | [ ] | [ ] |

## Navegación, mes y ventana (T11)

| Paso | A | I | C |
|---|---|---|---|
| Del Mes a Reportes y de vuelta con "Este mes \| Reportes", también con teclado. | [ ] | [ ] | [ ] |
| Por defecto, el mes anterior; las flechas se detienen en el primer mes con datos y en el mes anterior al actual. | [ ] | [ ] | [ ] |
| Cambiar a agosto y a 6 meses, ir a Gastos y volver los conserva; recargar vuelve al mes anterior y a 1 mes. | [ ] | [ ] | [ ] |
| Sin conexión, Reportes lo avisa como el resto de la app. | [ ] | [ ] | [ ] |

## Reportes (T13, T14)

| Paso | A | I | C |
|---|---|---|---|
| "¿En qué se me va la plata?" en octubre: frase, barras con tintas, "Otras" y "Cuotas de tarjetas"; lo apartado aparte. | [ ] | [ ] | [ ] |
| En agosto, la frase nombra lo apartado y lo retirado. | [ ] | [ ] | [ ] |
| "¿Planeo bien?": las filas sin rubro y los rubros en orden, lo que se pasa en rojo con "+". | [ ] | [ ] | [ ] |
| "¿Estoy ahorrando?" con 1 mes: la cifra en grande con su desglose. | [ ] | [ ] | [ ] |
| Con 3, 6 y 12 meses: columnas, promedio, mejor y peor; el mes sin datos dice "sin datos". | [ ] | [ ] | [ ] |
| Tocar una columna muestra su mes y su cifra. | [ ] | [ ] | [ ] |
| "Ver cifras" se abre con teclado y muestra la tabla. | [ ] | [ ] | [ ] |
| Un mes sin datos muestra el estado vacío con "Planear". | [ ] | [ ] | [ ] |
| 12 meses a 360 px se desplazan a lo ancho con el último mes a la vista. | [ ] | [ ] | [ ] |
| Los nombres largos no desbordan a 320 px. | [ ] | [ ] | [ ] |

## Diseño y accesibilidad (T15)

| Paso | A | I | C |
|---|---|---|---|
| Desde 1280 px: "¿En qué se me va la plata?" y "¿Planeo bien?" lado a lado, "¿Estoy ahorrando?" a todo el ancho. | — | — | [ ] |
| Todo con teclado y foco visible. | [ ] | [ ] | [ ] |
| Zoom al 200 % (*reflow* a 320 px) sin desbordar. | — | — | [ ] |
| Los gráficos están ocultos al lector de pantalla y la tabla se lee. | [ ] | [ ] | [ ] |
| Con `prefers-reduced-motion`, nada se anima. | [ ] | [ ] | [ ] |
| Los dos temas: tintas, rojo y tinta legibles. | [ ] | [ ] | [ ] |
| Ningún emoji, sombra ni degradado; cifras a la derecha. | [ ] | [ ] | [ ] |
