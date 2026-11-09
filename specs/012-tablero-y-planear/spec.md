# Spec 012 — Tablero y planear

- Fase: 1 — Aplicación y SDD
- Estado: aprobada (2026-11-09)
- Base: spec 002 (categorías), spec 008 (rubros, ingresos, plan y
  resumen), spec 009 (tarjetas, cuotas, abonos, extracto y pagar todo),
  spec 010 (gasto del mes con tarjeta o deuda), spec 011 (la web y su
  diseño), ADR 0012, ADR 0013, ADR 0014, ADR 0015

## Por qué

Con la 011 los gastos se registran desde el celular, pero todo lo demás
sigue haciéndose con `curl`: planear el mes, ver cuánto va gastado frente a
lo planeado, escribir el valor del extracto, abonar a una compra o crear una
tarjeta. Para saber si el mes va bien hay que leer el JSON del resumen.

Esta spec trae a la web lo que falta para usar gastito sin la API a mano:
el tablero del mes, planear el mes en el computador, las tarjetas con sus
compras y abonos, y las categorías. La API ya hace todo esto (specs 008 a
010); el trabajo es de la web, que sigue siendo una capa fina (principio
10).

## Qué entra

- **Mes**: el tablero de un mes, con los totales, una barra que reparte el
  ingreso y una barra por rubro, agrupados por categoría, y las tarjetas con
  lo que hay que pagarles.
- **Planear**: el mismo Mes en modo edición. Rubros, ingresos y el valor real
  del extracto de cada tarjeta se editan en el sitio. Copiar el plan del mes
  anterior a un mes vacío.
- **Tarjetas**: crear, editar y eliminar tarjetas; su estado (saldo, compras
  con cuotas pendientes y los próximos meses); pagar todo.
- **Compras con tarjeta**: el plan de cuotas de una compra, abonar, y borrar
  un abono.
- **Categorías**: verlas, crearlas y eliminarlas, en la pestaña Espacio.
- La navegación pasa a cinco secciones y la pantalla de inicio depende del
  dispositivo.
- Los cambios en lo que hizo la 011 que esto pide: el ícono fijado abre la
  pantalla de inicio, el crédito sin tarjetas enlaza a Tarjetas, y una
  compra con abonos enlaza a sus abonos.

## Qué NO entra

- Cambiar la API. Ninguna ruta nueva ni cambio de reglas: la web usa las
  que ya existen. Lo que la API no tenga se anota como pedido para otra
  spec.
- Simular un abono antes de guardarlo: se guarda y se puede deshacer
  (decisión 7).
- Renombrar una categoría: la API no lo permite (spec 002).
- Ver las tarjetas archivadas en la lista de Tarjetas: la API solo lista las
  activas. Una archivada con deuda aparece en el Mes (decisión 18).
- Copiar el plan desde un mes que no sea el anterior, o solo una parte (spec
  008).
- Gráficos de varios meses, comparaciones entre meses, el ritmo del gasto día
  a día y exportar datos.
- Presupuestos por persona o permisos distintos entre miembros.
- Editar un abono: se borra y se crea de nuevo (decisión 18 de la 009).
- Lo que ya dejó fuera la 011: sin conexión, notificaciones, HTTPS (019).

## Conceptos

- **Mes**: la sección del tablero. Muestra el resumen de un periodo.
- **Modo Planear**: el Mes con sus renglones convertidos en campos. Se entra
  con "Planear" y se sale con "Listo".
- **Mes elegido**: el periodo que muestran Mes, Planear y Gastos. Se
  comparte entre las tres: cambiarlo en una lo cambia en las otras.
- **Medidor**: la barra de un rubro. Se llena con lo gastado sobre lo
  planeado; lo excedido se marca en rojo y con palabra.
- **Barra del ingreso**: una barra delgada que reparte el ingreso del mes en
  rubros, deudas y lo que queda sin asignar.
- **Estado de una tarjeta**: saldo pendiente, compras con cuotas pendientes y
  lo que hay que pagar en los próximos meses (RF-40 de la 009).

## Decisiones de clarificación (2026-11-09)

1. **Alcance: todo en la 012**, como dicen el roadmap y la 011: tablero,
   planear, tarjetas y categorías. Se descartó dividirla en dos specs: no
   quita trabajo y añade un ciclo de spec y PR antes de la fase 2.
2. **La navegación tiene cinco secciones**: Mes, Registrar, Gastos, Tarjetas
   y Espacio, todas a la vista. Planear es el Mes en modo edición, y
   Categorías va en Espacio. Se descartó "Mes, Registrar, Gastos y Más":
   las tarjetas quedaban a dos toques.
3. **La pantalla de inicio depende del dispositivo**: en el celular,
   Registrar, como hoy; desde 1024 px, el Mes. Se planea en el computador y
   se registra en el celular. Se descartaron "siempre Registrar" (un toque
   más para planear) y "siempre el Mes" (un toque más por cada gasto). Cambia
   la decisión 6 de la 011, que ya lo dejaba abierto.
4. **El tablero muestra cifras con barras**: los totales, la barra del
   ingreso y un medidor por rubro. Lo excedido sale en rojo y con la
   palabra. Se descartaron "solo cifras" (los excesos se leen peor) y añadir
   el ritmo del mes día a día (más gráfico y más lógica en la web para lo
   que se decide al planear).
5. **Planear es una tabla editable**: en modo Planear cada renglón es un
   grupo de campos, y se guarda al salir de él. Se descartó un formulario
   por rubro: planear quince rubros tomaría quince pantallas.
6. **El valor real del extracto se escribe en el Mes, al planear**, como dice
   la 009. Tarjetas lo muestra, pero no lo edita. Se descartó escribirlo en
   Tarjetas: el extracto se usa para decidir el plan del mes.
7. **Un abono se guarda y se puede deshacer**: el aviso dice su efecto
   ("Ahora termina en marzo, no en mayo") con "Deshacer" durante 10
   segundos, como al registrar un gasto. Se descartó simularlo antes de
   guardar: pedía una ruta nueva en la API.
8. **El tablero agrupa por categoría**: cada categoría con su subtotal, sus
   rubros dentro y un renglón "sin rubro" con lo no planeado. Se descartó
   poner lo no planeado aparte: lo de una categoría quedaba en dos lugares.

## Decisiones tomadas al redactar la spec

9. **Mes, Planear y Gastos comparten el mes elegido**, en memoria. Por
   defecto es el actual. Al abrir la app vuelve al actual.
10. **La web no calcula el mes actual**: lo toma del resumen sin periodo,
    que la API calcula en `TZ` (decisión 12 de la 011, principio 7).
11. **El ícono fijado abre `/`**, que lleva a la pantalla de inicio del
    dispositivo. Cambia `start_url` del manifiesto (RF-28 de la 011): así el
    computador abre el Mes y el celular, Registrar.
12. **Un mes sin plan lo dice y ofrece dos caminos**: "Copiar el plan de
    octubre" y "Planear en blanco". Si octubre tampoco tiene plan, la API lo
    rechaza y la web muestra su mensaje. Al copiar, la web dice qué rubros
    se omitieron por tener la categoría eliminada (RF-13 de la 008).
13. **En modo Planear, un renglón nuevo se crea cuando tiene todo lo que
    pide** (nombre, categoría y monto en un rubro; nombre y monto en un
    ingreso) y el foco sale de él. Uno a medias no se envía y dice qué le
    falta. Un error de la API se muestra junto al campo y el renglón
    conserva lo escrito.
14. **Quitar un rubro que ya tiene gastos pide confirmación**, diciendo que
    sus gastos no se borran y quedan sin rubro en su categoría (RF-8 de la
    008). Un rubro sin gastos, un ingreso y un extracto se quitan sin
    diálogo: no se pierde ningún gasto (principio 8).
15. **Las barras son SVG y CSS propios**, sin librería de gráficos. Las cifras
    van siempre escritas junto a la barra: la barra ayuda a ver, la cifra es
    el dato. Así un lector de pantalla lee las cifras y la barra se oculta.
    El roadmap dejaba entrar Chart.js solo si la spec lo justificaba; para
    barras horizontales no hace falta.
16. **Abonar se hace desde la compra**: Tarjetas → la tarjeta → la compra, o
    desde el gasto en Gastos con "Ver cuotas y abonos". El mes del abono se
    elige entre los meses con cuota de la compra posteriores a su último
    abono (decisión 18 de la 009); la API valida el resto.
17. **Pagar todo pide confirmación** con lo que va a pasar: salda con abonos
    las compras del extracto del mes, y las posteriores al corte siguen
    llegando (RF-29 y RF-30 de la 009). No tiene "Deshacer": crea varios
    abonos, y cada uno se puede borrar desde su compra.
18. **Tarjetas lista las activas**, que son las que da la API. Una tarjeta
    archivada con cuotas en el mes aparece en el Mes con la marca
    "eliminada", y desde ahí se abre su estado, que la API sí da. Volver a
    crearla con el mismo nombre la restaura (spec 009).
19. **Eliminar una tarjeta o una categoría pide confirmación** y después
    muestra el mensaje de la API, que dice qué pasa con lo que ya la usa y
    cómo restaurarla.
20. **Cambios a la 011**: sin tarjetas, el crédito enlaza a "Añadir tarjeta"
    en lugar de decir que se crean con la API (decisión 21 de la 011); y una
    compra con abonos enlaza a sus abonos en la razón del bloqueo y en
    "Borrar gasto" deshabilitado (decisión 24 de la 011).

## Requisitos funcionales

### Navegación e inicio

- **RF-1** La web DEBE tener cinco secciones, en este orden: Mes, Registrar,
  Gastos, Tarjetas y Espacio, abajo en el celular y al costado desde
  1024 px, con su nombre completo y sin íconos (decisión 2).
- **RF-2** CUANDO se abre `/` con sesión, o se entra sin una ruta pendiente,
  la web DEBE abrir el Mes si la ventana mide al menos 1024 px de ancho y
  Registrar si mide menos (decisión 3).
- **RF-3** El manifiesto DEBE tener `start_url: "/"` (decisión 11).
- **RF-4** Mes, Planear y Gastos DEBEN mostrar el mismo mes elegido, con
  flechas para cambiarlo, y el encabezado DEBE decir cuál es (decisión 9).

### Mes (tablero)

- **RF-5** El Mes DEBE mostrar, del mes elegido y con el resumen de la API:
  ingresos, planeado, gastado, sin asignar y balance, y aparte lo que hay que
  pagar a las tarjetas (decisión 4).
- **RF-6** El Mes DEBE mostrar la barra del ingreso, repartida en rubros,
  deudas y sin asignar, con cada parte nombrada y con su monto escrito al
  lado. SI lo planeado supera el ingreso, ENTONCES DEBE decir por cuánto
  ("Planeas $ 200.000 más de lo que ingresa") en rojo y con palabras.
- **RF-7** El Mes DEBE listar las categorías del mes con su gastado y su
  planeado y, dentro de cada una, sus rubros con un medidor, lo gastado, lo
  planeado y lo que queda, y un renglón "sin rubro" con lo no planeado si lo
  hay (decisión 8). Una categoría eliminada DEBE marcarse como tal.
- **RF-8** SI un rubro gastó más de lo planeado, ENTONCES su medidor DEBE
  verse lleno en rojo y decir "excedido" con el monto en negativo
  ("excedido −40.000"), no solo con color.
- **RF-9** El Mes DEBE mostrar cada tarjeta con algo en el mes: lo que hay que
  pagarle, si es estimado o el valor real del extracto, y sus cuotas, abonos
  y gastos del mes. Una tarjeta archivada DEBE marcarse "eliminada" y
  enlazar a su estado (decisión 18).
- **RF-10** SI el mes elegido no tiene rubros ni ingresos, ENTONCES el Mes
  DEBE decirlo y ofrecer "Copiar el plan de <mes anterior>" y "Planear en
  blanco" (decisión 12).
- **RF-11** CUANDO se copia el plan, la web DEBE pedirlo a la API, mostrar el
  mes copiado y decir qué rubros se omitieron y por qué. SI la API lo
  rechaza, ENTONCES DEBE mostrar su mensaje.

### Planear

- **RF-12** CUANDO se pulsa "Planear", el Mes DEBE mostrar los ingresos, los
  rubros y los extractos del mes como campos editables, y volver al tablero
  con "Listo" (decisión 5).
- **RF-13** CUANDO el foco sale de un renglón existente con cambios, la web
  DEBE enviar solo lo que cambió y decir "Guardado". SI la API lo rechaza,
  ENTONCES DEBE mostrar su mensaje junto al campo y conservar lo escrito.
- **RF-14** CUANDO el foco sale de un renglón nuevo completo, la web DEBE
  crearlo en el mes elegido. SI está incompleto, ENTONCES NO DEBE enviarlo y
  DEBE decir qué le falta (decisión 13).
- **RF-15** Un rubro DEBE pedir nombre, categoría (de las activas) y monto; un
  ingreso, nombre y monto. Los montos siguen las reglas de RF-7 de la 011.
- **RF-16** CUANDO se quita un rubro con gastos, la web DEBE pedir
  confirmación diciendo que sus gastos quedan sin rubro en su categoría.
  Quitar un rubro sin gastos o un ingreso NO DEBE pedirla (decisión 14).
- **RF-17** En modo Planear, cada tarjeta activa y cada archivada con algo en
  el mes DEBE mostrar lo estimado y un campo "Extracto real". CUANDO se
  escribe un valor, la web DEBE guardarlo; CUANDO se quita, DEBE borrarlo y
  volver a lo estimado (decisión 6).
- **RF-18** Mientras se guarda un renglón, sus campos DEBEN quedar sin
  editar, para que dos envíos no creen dos rubros.

### Tarjetas

- **RF-19** La pestaña Tarjetas DEBE listar las tarjetas activas con su día
  de corte, su día de pago, su tasa si la tiene, su saldo pendiente y lo que
  hay que pagarle en el mes actual. SI no hay ninguna, ENTONCES DEBE decirlo
  y ofrecer añadir una.
- **RF-20** CUANDO se añade o edita una tarjeta, la web DEBE pedir nombre, día
  de corte, día límite de pago y tasa mensual opcional, y mostrar los
  mensajes de la API junto a cada campo. Volver a crear una tarjeta
  eliminada con el mismo nombre la restaura (spec 009).
- **RF-21** CUANDO se abre una tarjeta, la web DEBE mostrar su estado: saldo
  pendiente, compras con cuotas pendientes (nombre, saldo, cuota siguiente y
  si es deuda o gasto del mes) y lo que hay que pagar en cada mes próximo,
  con el valor del extracto si lo hay.
- **RF-22** CUANDO se elimina una tarjeta, la web DEBE pedir confirmación,
  archivarla y mostrar el mensaje de la API (decisión 19).
- **RF-23** CUANDO se pide "Pagar todo" de una tarjeta en un mes (por
  defecto el actual), la web DEBE pedir confirmación diciendo qué va a pasar,
  pedirlo a la API y decir cuántos abonos creó y la deuda que queda en ese
  mes. SI la API lo rechaza, ENTONCES DEBE mostrar su mensaje (decisión 17).

### Compras con tarjeta y abonos

- **RF-24** CUANDO se abre una compra con tarjeta, la web DEBE mostrar su
  descripción, monto, fecha y tarjeta, su plan de cuotas (mes, número,
  capital, interés estimado, total y saldo) y sus abonos.
- **RF-25** CUANDO se abona, la web DEBE pedir monto, mes (entre los meses con
  cuota posteriores al último abono) y si baja la cuota o el plazo, y
  guardarlo. DEBE decir el efecto comparando el plan de antes y el de
  después ("Ahora termina en marzo, no en mayo" o "Ahora la cuota es
  $ 200.000, no $ 300.000") con "Deshacer" durante 10 segundos (decisión
  7). CUANDO se pulsa "Deshacer", DEBE borrar ese abono.
- **RF-26** CUANDO se borra un abono, la web DEBE pedir confirmación con su
  monto y su mes, borrarlo y mostrar el plan recalculado.
- **RF-27** Desde un gasto con tarjeta en Gastos, la web DEBE enlazar a "Ver
  cuotas y abonos". En una compra con abonos, la razón del bloqueo DEBE
  enlazar a esos abonos (decisión 20).

### Categorías

- **RF-28** La pestaña Espacio DEBE listar las categorías activas del espacio
  y dejar crear una. SI el nombre ya existe o no es válido, ENTONCES DEBE
  mostrar el mensaje de la API junto al campo. Crear una eliminada la
  restaura (spec 008).
- **RF-29** CUANDO se elimina una categoría, la web DEBE pedir confirmación,
  eliminarla y mostrar el mensaje de la API (decisión 19).

### Cambios en lo de la 011

- **RF-30** SI el espacio no tiene tarjetas, ENTONCES Registrar a crédito DEBE
  enlazar a añadir una en Tarjetas (cambia la decisión 21 de la 011).
- **RF-31** Todo lo de esta spec DEBE cumplir los requisitos de diseño y
  accesibilidad de la 011 (RF-31 a RF-35), el aviso sin conexión (RF-30 de
  la 011) y mostrar los errores de la API tal cual.

## Diseño

Sigue la sección "Diseño" de la 011 (Libro auxiliar): renglones, cifras
monoespaciadas a la derecha, la tinta como único color de acción y el rojo
solo para lo que significa algo. Esta sección añade lo nuevo.

### Mes

- Arriba, los totales como renglones de cifras: ingresos, planeado, gastado,
  sin asignar y balance. "Sin asignar" o "balance" negativos llevan el signo
  menos y van en rojo.
- Debajo, la barra del ingreso: delgada (8 px), sin texto, con un espacio de
  2 px entre partes. Rubros en tinta, deudas en `--rule-strong` y sin asignar
  como el fondo de la barra. Debajo, una leyenda con cada parte, su muestra
  de color y su monto, en el mismo orden que la barra.
- Las categorías como bloques de renglones: el nombre en rótulo
  (mayúsculas espaciadas) con "gastado de planeado" a la derecha, y sus
  rubros debajo.
- Cada rubro: nombre a la izquierda, gastado a la derecha y, en la línea de
  abajo, el medidor (6 px de alto) y "queda $ 380.000" o
  "excedido −40.000". El medidor se llena en tinta sobre un fondo
  `--rule`; excedido, se llena entero en rojo.
- Las tarjetas al final, con "a pagar" en la doble raya roja de los totales.
- En el computador, el contenido llega a 720 px.

### Planear

- La misma página, con "PLANEAR" junto al mes y el botón "Listo" arriba.
- Cada renglón es una fila de campos: nombre, categoría (solo en rubros) y
  monto, y la acción "Quitar". En el celular, los campos de un renglón se
  apilan.
- "Añadir ingreso" y "Añadir rubro" al final de cada bloque abren un renglón
  vacío con el foco en el nombre.
- "Guardado" aparece junto al renglón y se va solo; un error, en rojo debajo
  del campo.

### Tarjetas y compras

- La lista de tarjetas como renglones: nombre, "corte 25 · paga el 10" y la
  tasa en la segunda línea, y a la derecha el saldo y lo de este mes.
- La tarjeta: un renglón por mes próximo con lo que hay que pagar (y
  "extracto" si es el valor real), y un renglón por compra con su saldo y
  "cuota 2 de 6". Las acciones (editar, pagar todo, eliminar) al final.
- La compra: el plan de cuotas como tabla de cifras; las cuotas ya pagadas
  en el texto secundario; los abonos con su mes y "baja el plazo" o "baja la
  cuota"; el formulario de abonar debajo.

### Accesibilidad de las barras

- Las barras se ocultan al lector de pantalla (`aria-hidden`): las cifras
  escritas al lado dicen lo mismo.
- Las partes de la barra del ingreso y el fondo de los medidores tienen
  contraste de al menos 3:1 con el papel, menos el fondo, que es la parte
  vacía ([WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Lo excedido nunca es solo rojo: lleva la palabra y el signo.

## Criterios de validación

La spec se da por cumplida cuando, además de los tests por requisito:

1. `node --test` prueba sin navegador: los números del tablero a partir de un
   resumen de ejemplo (la barra del ingreso, los medidores, lo excedido, el
   renglón "sin rubro" de cada categoría y un plan que supera el ingreso);
   la pantalla de inicio según el ancho; qué envía cada renglón de Planear
   (solo lo cambiado; nada si está incompleto, con lo que falta); cuándo
   quitar un rubro pide confirmación; los meses que se ofrecen para abonar;
   el texto del efecto de un abono (plazo y cuota); y las rutas nuevas (RF-1
   a RF-29).
2. El test de contraste comprueba las partes de la barra del ingreso y los
   medidores en los dos temas.
3. pytest prueba que el manifiesto tiene `start_url: "/"` y que las rutas
   nuevas devuelven la página.
4. Verificación a mano en Chrome del computador, con la lista del plan: ver
   el tablero de un mes con un rubro excedido y lo no planeado; copiar el
   plan a un mes vacío; planear un mes con ingresos, rubros y un extracto;
   quitar un rubro con gastos; crear, editar y eliminar una tarjeta; pagar
   todo; abonar y deshacer; borrar un abono; crear y eliminar una categoría;
   las cinco secciones a 360 px y a 1280 px; tema oscuro y teclado. La
   verificación en Android y en iPhone se hace con la de la 011, cuando la
   app esté desplegada (019).
5. `make test` y `make lint` pasan en verde.

## Requisitos para otras specs y documentos

- **Spec 011:** cambian la decisión 6 y RF-2 (pantalla de inicio), RF-28
  (`start_url`), la decisión 21 (sin tarjetas) y la decisión 24 (el
  bloqueo enlaza a los abonos). La 011 queda como historia; estos cambios
  viven aquí.
- **019-https-dominio:** la verificación en el celular incluye las pantallas
  de esta spec.
- **Pedidos para la API, sin spec todavía:** listar las tarjetas archivadas
  con deuda, renombrar una categoría y simular un abono. Ninguno es
  necesario para esta spec.
- **AGENTS.md:** el glosario no cambia.
- **README:** "Plan del mes" y "Tarjetas" pasan a explicar la web en lugar de
  `curl`.
