# Spec 033 — Detalle del gasto con rubro y Mes más claro

- Fase: 1 — Aplicación y SDD (añadida con la app ya en uso)
- Estado: aprobada (2026-11-15)
- Base: spec 008 (rubros e ingresos), spec 009 y 010 (tarjetas), spec 011
  (app web), spec 012 (tablero del Mes), spec 013 (ahorro)
- Número: el siguiente libre; del 014 al 030 son etapas del roadmap.

## Por qué

Usando la app aparecieron dos problemas:

1. **Un gasto con rubro no dice en qué se fue.** Planeo $ 600.000 para
   "Viaje" y registro $ 180.000 de pasajes y $ 240.000 de hospedaje: los
   dos quedan como "Viaje", sin más. La decisión 26 de la 009 dejó un solo
   campo para nombrar el gasto, y al elegir un rubro ya no se puede
   escribir nada.
2. **El Mes mezcla lo planeado con lo no planeado.** Un "Plomero" de
   $ 95.000 sin rubro se suma a la categoría Hogar y la pone en rojo
   ("1.475.000 de 1.450.000") aunque ninguno de sus rubros se pasó. "Sin
   asignar" es una cifra fija ($ 850.000) que nunca dice cuánto de eso ya
   se gastó. Y cada rubro muestra tres cifras del mismo peso, más dos del
   encabezado de su categoría.

## Qué entra

- Un campo "Detalle", opcional, al registrar o editar un gasto con rubro.
- Mostrar ese detalle donde se nombra el gasto.
- El Mes con una cifra principal ("Te queda este mes") y dos bolsas
  separadas: "En el plan" y "Sin asignar", cada una con lo gastado y lo
  que queda.
- Los rubros mostrando primero lo que les queda, y sus gastos al tocarlos.
- Una sección "Fuera del plan" con los gastos no planeados del mes.
- La frase del mes en Inicio, con lo que queda.

## Qué NO entra

- Cambiar cómo se registra un gasto sin rubro o una deuda: siguen igual.
- Mover plata entre rubros o cubrir un rubro excedido con otro.
- Cambiar Planear, Tarjetas o Reportes.
- Una columna nueva en la base: el detalle usa `description`, que ya
  existe.

## Decisiones de clarificación (2026-11-15)

Tomadas sobre un prototipo visual desechable, con cifras de ejemplo:

1. **El detalle es opcional y solo aparece con rubro.** Un gasto sin rubro
   se sigue nombrando con "Qué fue", que es justo su descripción.
2. **Lo no planeado se descuenta de "Sin asignar" y deja de sumarse a la
   categoría en el Mes.** Con el Plomero de $ 95.000, Hogar no cambia y
   "Sin asignar" pasa de 850.000 a "queda 755.000". Se descartó dejarlo en
   la categoría, como hoy: es lo que la hace ver excedida sin que ningún
   rubro lo esté.
3. **El encabezado de cada categoría es solo su nombre**, sin cifras. El
   total por categoría sigue en Reportes. Se descartó un subtotal de sus
   rubros: son más cifras en una pantalla que ya tenía demasiadas.
4. **El resumen de arriba usa dos anillos**, uno por bolsa; los rubros
   siguen con barras. Se descartó usar barras también arriba.

Decididas al redactar la spec (se revisan en la clarificación):

5. **La cifra principal es "Te queda este mes"**: ingresos menos gastado,
   el `balance` de hoy. Debajo, en pequeño, los ingresos y lo gastado.
6. **"En el plan" es lo que hoy se llama "Planeado"**: los rubros más las
   deudas del mes de las tarjetas. Lo gastado en el plan es lo gastado en
   rubros más esas deudas, menos lo retirado del ahorro. Así, lo que queda
   en el plan más lo que queda sin asignar da la cifra principal.
7. **Un rubro excedido resta dentro de "En el plan"** (confirmada el
   2026-11-15). Si Restaurantes se pasó $ 40.000, "En el plan" queda en
   615.000 y no en 655.000; "Sin asignar" no se toca. Se descartó
   descontarlo de "Sin asignar" (el plan quedaría en 655.000 y sin asignar
   en 632.000): "Sin asignar" mide solo lo que no se planeó.
8. **Una bolsa puede quedar excedida**: se muestra "excedido" con su monto,
   en rojo y con la palabra (principio 4 del diseño de la 011). Pasa con
   "Sin asignar" si lo no planeado supera lo que quedó sin asignar, o si se
   planeó más de lo que ingresa.
9. **El detalle se guarda en `description`**, con sus reglas de la 003:
   máximo 200 caracteres; vacío o solo espacios es "sin detalle".
10. **Un gasto con rubro y detalle se nombra "Rubro · Detalle"** ("Viaje ·
    Hospedaje") en Gastos, en el aviso "Gasto registrado" de Registrar y
    entre los gastos del mes de una tarjeta. Sin detalle, solo el rubro,
    como hoy. (Corregida el 2026-11-15: decía "en Inicio", que no lista
    gastos.)
11. **Soltar el rubro en el formulario esconde "Detalle"** y lo escrito
    ahí no se envía.
12. **Quitar un rubro en Planear no borra el detalle** de sus gastos: como
    ya quedan sin rubro, el detalle pasa a ser su descripción.
13. **Tocar un rubro en el Mes despliega sus gastos ahí mismo**: fecha,
    detalle y monto. Se descartó llevar a Gastos con un filtro: saca de la
    pantalla donde se está comparando.
14. **Salen del Mes** la lista de cinco totales y la barra "Cómo se reparte
    el ingreso": sus cifras quedan en la cifra principal y en los anillos.

Segunda ronda (2026-11-15):

15. **Inicio dice lo que queda**: "Te quedan $ 1.287.000 en noviembre", la
    misma cifra principal del Mes, en lugar de "Llevas $ 2.913.000 de
    $ 3.350.000 planeados", que mezclaba lo no planeado con el plan. Se
    descartó nombrar las dos bolsas: la frase quedaba larga para Inicio.
16. **Un gasto sin detalle, dentro de su rubro, muestra solo fecha y
    monto.** Se descartó escribir "sin detalle": repite en cada renglón un
    texto que no aporta.

## Requisitos funcionales

### API

- **RF-1** CUANDO se registra un gasto del mes con rubro (a débito, o con
  tarjeta a 1 cuota que estaba en el plan), la API DEBE aceptar una
  `description` opcional y guardarla (decisión 9). Hoy ya lo hace: esta
  spec lo fija con tests.
- **RF-2** CUANDO se edita un gasto con rubro, la API DEBE permitir
  cambiar su `description` y, con `null`, quitarla, sin tocar el rubro.
- **RF-3** El resumen del periodo DEBE entregar, para "En el plan" y para
  "Sin asignar", cuánto se asignó, cuánto se ha gastado y cuánto queda,
  calculados en la API (principio 10; decisiones 2, 6 y 7).
- **RF-4** Lo que queda en el plan más lo que queda sin asignar DEBE ser
  igual al `balance` del periodo, también con retiros de ahorro, deudas de
  tarjetas y rubros excedidos.
- **RF-5** El nombre de un gasto del mes con tarjeta que tiene rubro y
  detalle DEBE ser "<rubro> · <detalle>" (decisión 10). Cambia RF-10 de la
  010, que daba solo la descripción.
- **RF-6** Esta spec NO DEBE cambiar la estructura de la base ni ningún
  gasto existente (principio 8). Los campos que el resumen ya entrega se
  conservan.

### Web: Registrar y editar

- **RF-7** CUANDO se elige un rubro en "Qué fue", el formulario DEBE
  mostrar el campo "Detalle", opcional, con máximo 200 caracteres.
  MIENTRAS no haya un rubro elegido, NO DEBE mostrarlo (decisiones 1 y 11).
- **RF-8** CUANDO se registra un gasto con rubro y detalle, la web DEBE
  enviar el rubro y el detalle como `description`. Sin detalle, DEBE
  enviar solo el rubro, como hoy.
- **RF-9** Al editar un gasto con rubro, la web DEBE mostrar su detalle y
  permitir cambiarlo o quitarlo.
- **RF-10** Gastos y el aviso "Gasto registrado" DEBEN nombrar un gasto con
  rubro y detalle como "Rubro · Detalle" (decisión 10). Cambia RF-18 de la
  011.

### Web: Mes

- **RF-11** El Mes DEBE mostrar arriba "Te queda este mes" con su monto y,
  debajo, los ingresos y lo gastado (decisión 5). SI el monto es negativo,
  ENTONCES DEBE ir en rojo y con el signo.
- **RF-12** El Mes DEBE mostrar un anillo por bolsa, "En el plan" y "Sin
  asignar", cada uno con lo que queda, lo gastado y lo asignado (decisión
  4). SI la bolsa está excedida, ENTONCES DEBE decir "excedido" con el
  monto, en rojo (decisión 8).
- **RF-13** Los anillos NO DEBEN ser la única forma de leer el dato: las
  cifras van escritas y el gráfico se oculta al lector de pantalla, como
  las barras de la 012.
- **RF-14** La sección "En el plan" DEBE listar los rubros agrupados por
  categoría, con el nombre de la categoría como rótulo sin cifras
  (decisión 3).
- **RF-15** Cada rubro DEBE mostrar su nombre, lo que le queda como cifra
  principal, su barra y, en pequeño, lo gastado y lo planeado. SI gastó
  justo lo planeado, ENTONCES DEBE decir "completo". SI gastó más,
  ENTONCES DEBE decir "excedido" con el monto, en rojo.
- **RF-16** CUANDO se toca un rubro, el Mes DEBE desplegar sus gastos del
  mes con fecha, detalle y monto, y plegarlos al tocarlo otra vez
  (decisión 13). Un gasto sin detalle DEBE mostrar solo fecha y monto
  (decisión 16). Se DEBE poder hacer con teclado.
- **RF-17** La sección "Fuera del plan" DEBE listar los gastos del mes sin
  rubro, del más reciente al más antiguo, con su descripción (o su
  categoría si no tiene), su categoría, su fecha y su monto, y DEBE
  mostrar su total frente a lo que quedó sin asignar (decisión 2). Las
  deudas de tarjeta no van aquí: siguen en Tarjetas.
- **RF-18** SI el mes no tiene gastos sin rubro, ENTONCES "Fuera del plan"
  DEBE decirlo en una línea en lugar de mostrar una lista vacía.
- **RF-19** El Mes NO DEBE mostrar el renglón "Sin rubro" dentro de las
  categorías, ni la lista de cinco totales, ni la barra "Cómo se reparte
  el ingreso" (decisiones 2 y 14). Cambia RF-5 a RF-8 de la 012.
- **RF-20** Los rubros de Ahorro y lo retirado del ahorro DEBEN seguir
  como en la 013; Tarjetas, el mes sin plan y el botón de Planear, como en
  la 012.
- **RF-21** Lo nuevo DEBE cumplir el diseño de la 011: variables de
  `tokens.css`, tema claro y oscuro, contraste AA, uso con teclado y
  controles de al menos 44 px.

### Web: Inicio

- **RF-22** CUANDO el mes tiene plan, Inicio DEBE decir cuánto queda en el
  mes, con la misma cifra de RF-11 (decisión 15). SI esa cifra es
  negativa, ENTONCES DEBE decirlo con palabras ("Te pasaste por $ 120.000
  en noviembre"), no solo con el signo. El mes sin plan y la frase de las
  tarjetas siguen como hoy.

## Requisitos para el plan

- Los anillos se dibujan sin librería, como las barras (ADR 0016). Si la
  técnica cambia (SVG en lugar de solo CSS), el plan lo deja en un ADR.
- Los anillos respetan "Renglones, no tarjetas" (principio 1 del diseño de
  la 011): el prototipo los puso en recuadros y el definitivo los ajusta.
- El plan decide si la lista de "Fuera del plan" y los gastos de cada
  rubro salen de `GET /expenses` o del resumen, sin poner reglas de
  negocio en la web (principio 10).
- Prototipo visual antes del código, como en la 011 a la 013. El de la
  clarificación es desechable y no entra al repositorio.

## Criterios de validación

1. Tests de la API por cada RF-1 a RF-5, con un caso de RF-4 que combine
   un rubro excedido, un gasto sin rubro, una deuda de tarjeta y un retiro
   de ahorro.
2. Tests de la lógica de la web (`node --test`) para RF-7 a RF-10 y para
   lo que el Mes e Inicio arman a partir del resumen (RF-11 a RF-19 y
   RF-22).
3. Recorrido a mano en Chrome, a ancho de celular y de computador, en
   claro y en oscuro, con el ejemplo de esta spec: "Viaje" con "Pasajes" y
   "Hospedaje", y un "Plomero" sin rubro que no pone Hogar en rojo.
4. `make test` y `make lint` en verde.
