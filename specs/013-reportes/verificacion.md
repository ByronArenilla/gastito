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
- Un espacio con varios meses de plan y gastos, un rubro Ahorro (lo
  apartado; decisión 29), la Visa
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
| Agosto muestra Ahorro con lo neto y la línea "Retirado del ahorro". | [ ] | [ ] | [x] |
| El balance del mes descuenta lo retirado. | [ ] | [ ] | [x] |

## Navegación, mes y ventana (T11)

| Paso | A | I | C |
|---|---|---|---|
| Del Mes a Reportes y de vuelta con "Este mes \| Reportes", también con teclado. | [ ] | [ ] | [x] |
| Por defecto, el mes anterior; las flechas se detienen en el primer mes con datos y en el mes anterior al actual. | [ ] | [ ] | [x] |
| Cambiar a agosto y a 6 meses, ir a Gastos y volver los conserva; recargar vuelve al mes anterior y a 1 mes. | [ ] | [ ] | [x] |
| Sin conexión, Reportes lo avisa como el resto de la app. | [ ] | [ ] | [x] |

## Reportes (T13, T14)

| Paso | A | I | C |
|---|---|---|---|
| "¿En qué se me va la plata?" en octubre: frase, barras con tintas, "Otras" y "Cuotas de tarjetas"; lo apartado aparte. | [ ] | [ ] | [x] |
| En agosto, la frase nombra lo apartado y lo retirado. | [ ] | [ ] | [x] |
| "¿Planeo bien?": las filas sin rubro y los rubros en orden, lo que se pasa en rojo con "+". | [ ] | [ ] | [x] |
| "¿Estoy ahorrando?" con 1 mes: la cifra en grande con su desglose. | [ ] | [ ] | [x] |
| Con 3, 6 y 12 meses: columnas, promedio, mejor y peor; el mes sin datos dice "sin datos". | [ ] | [ ] | [x] |
| Tocar una columna muestra su mes y su cifra. | [ ] | [ ] | [x] |
| "Ver cifras" se abre con teclado y muestra la tabla. | [ ] | [ ] | [x] |
| Un mes sin datos muestra el estado vacío con "Planear". | [ ] | [ ] | [x] |
| 12 meses a 360 px se desplazan a lo ancho con el último mes a la vista. | [ ] | [ ] | [x] |
| Los nombres largos no desbordan a 320 px. | [ ] | [ ] | [x] |

## El ahorro se aparta al planearlo (T17)

Con Chromium sin interfaz a 390 y 1280 px, contra una API temporal con
octubre y noviembre de 2026: Sueldo $ 6.500.000, Mercado $ 900.000 y un
rubro Ahorro de $ 500.000 en cada mes, y un retiro de $ 200.000 en
noviembre.

| Paso | A | I | C |
|---|---|---|---|
| Registrar no ofrece Ahorro entre las categorías ni sugiere el rubro Ahorro ("1 rubro de noviembre": Mercado). | [ ] | [ ] | [x] |
| Planear sí ofrece Ahorro como categoría de un rubro. | [ ] | [ ] | [x] |
| El Mes muestra Ahorro "300.000 de 500.000", el rubro Ahorro con $ 500.000 y "Retirado del ahorro −$ 200.000" sin registrar ningún gasto; Gastado $ 600.000 y Balance $ 5.900.000. | [ ] | [ ] | [x] |
| Un retiro cabe en lo planeado: con $ 200.000 retirados, $ 300.001 más responde "puedes retirar hasta $ 300.000". | [ ] | [ ] | [x] |
| Quitar el rubro Ahorro con un retiro no abre confirmación y el renglón muestra el mensaje del `409`; el rubro sigue. | [ ] | [ ] | [x] |
| "¿Estoy ahorrando?" de octubre: "Apartaste $ 500.000 en Ahorro y quedaron $ 5.050.000 sin gastar.", sin "lo planeado". | [ ] | [ ] | [x] |

## Diseño y accesibilidad (T15)

| Paso | A | I | C |
|---|---|---|---|
| Desde 1280 px: "¿En qué se me va la plata?" y "¿Planeo bien?" lado a lado, "¿Estoy ahorrando?" a todo el ancho. | — | — | [x] |
| Todo con teclado y foco visible. | [ ] | [ ] | [x] |
| Zoom al 200 % (*reflow* a 320 px) sin desbordar. | — | — | [x] |
| Los gráficos están ocultos al lector de pantalla y la tabla se lee. | [ ] | [ ] | [x] |
| Con `prefers-reduced-motion`, nada se anima. | [ ] | [ ] | [x] |
| Los dos temas: tintas, rojo y tinta legibles. | [ ] | [ ] | [x] |
| Ningún emoji, sombra ni degradado; cifras a la derecha. | [ ] | [ ] | [x] |
