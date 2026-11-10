# Spec 013 — Reportes para decidir

- Fase: 1 — Aplicación y SDD
- Estado: aprobada (2026-11-10); cambiada el mismo día al revisar el
  prototipo: tres reportes (decisión 18), un mes elegido (decisión 20),
  Ahorro como categoría (decisiones 21 a 24) y retiros de ahorro
  (decisiones 25 a 28)
- Base: spec 002 (categorías predefinidas), spec 008 (rubros, ingresos y
  resumen), spec 009 (tarjetas y cuotas), spec 010 (gasto del mes o deuda),
  spec 011 (la web y su diseño), spec 012 (Mes y barras), ADR 0011, ADR
  0013, ADR 0014, ADR 0016

## Por qué

El Mes de la 012 dice cómo va el mes en curso. No dice cómo terminó un mes
ya cerrado: en qué se fue la plata, qué rubros se pasaron o qué se gastó sin
planearlo, ni si se está ahorrando mes tras mes. Esas son las preguntas con
las que se toman decisiones: recortar un rubro, añadir uno que falta,
apartar más para ahorro.

Esta spec trae tres reportes, uno por pregunta. Cada uno responde en una
frase, la muestra en un gráfico y deja ver las cifras. Tienen que leerse de
un vistazo en el celular y en el computador, en tema claro y en oscuro.

## Qué entra

Tres reportes en el Mes, bajo "Reportes", sobre un mes elegido:

1. **¿En qué se me va la plata?** Lo gastado por categoría en el mes,
   cuánto fue no planeado y cuánto se fue en cuotas de deudas. Lo apartado
   en Ahorro se nombra aparte.
2. **¿Planeo bien?** Qué rubros del mes se pasaron de lo planeado y cuáles
   sobraron, y cuánto se gastó sin rubro en cada categoría.
3. **¿Estoy ahorrando?** Lo apartado en Ahorro y lo que quedó sin gastar,
   en el mes o en los 3, 6 o 12 meses que terminan en él.

Y lo que los hace posibles:

- **"Ahorro" como categoría predefinida**, también en los espacios que ya
  existen.
- **Retiros de ahorro**: registrar que se sacó plata de lo apartado en el
  mes, verlo en Gastos y en el Mes, y que el reporte lo cuente.
- En la API, los cálculos de los reportes.
- En la web, gráficos propios con una paleta de "tintas de libro" para
  claro y oscuro.

## Qué NO entra

- Exportar los reportes (PDF, CSV) o enviarlos por correo.
- Alertas o recomendaciones automáticas ("deberías gastar menos en…"): los
  reportes muestran hechos, la decisión es de la persona.
- Metas de ahorro, presupuestos por persona o comparar espacios.
- Registrar el ingreso real: el ingreso de los reportes es el planeado
  (decisión 13).
- Reportes de un rango de fechas libre: los periodos son meses completos.
- Mirar hacia adelante: ni las cuotas comprometidas de los meses que vienen,
  ni cuándo se termina de pagar cada tarjeta, ni simular una compra
  (decisión 18). El saldo y la deuda de cada mes por tarjeta siguen en
  Tarjetas (spec 012).
- Llevar el saldo total del ahorro (cuánto hay ahorrado sumando todos los
  meses) o retirar de lo apartado en meses anteriores (decisión 28).
- Cambiar cómo el Mes de la 012 muestra la categoría Ahorro, salvo lo
  retirado: apartar más de lo planeado se sigue viendo como excedido.
- Cambiar las reglas de las specs 008 a 010, salvo una: lo retirado resta
  de Ahorro en el resumen (RF-36). Los reportes leen los mismos datos con
  las mismas reglas.

## Conceptos

- **Reporte**: una pregunta, su respuesta en una frase, un gráfico y sus
  cifras.
- **Mes elegido**: el mes ya cerrado que miran los reportes. Por defecto, el
  mes anterior al actual. El mes en curso no se elige: está a medias, y ya
  lo muestra "Este mes".
- **Ventana**: los meses que mira "¿Estoy ahorrando?": 1, 3, 6 o 12, que
  terminan en el mes elegido.
- **Categoría Ahorro**: la categoría del espacio cuyo nombre es "Ahorro",
  con la comparación de nombres de la spec 002 (mayúsculas y tildes no
  cuentan), activa o archivada.
- **Apartado**: lo registrado en la categoría Ahorro en un mes, con rubro o
  sin él.
- **Retiro de ahorro**: plata que se saca de lo apartado en un mes, para
  cubrir gastos de ese mes. Tiene monto, fecha, nota opcional y quién lo
  registró.
- **Quedó sin gastar**: el ingreso de referencia del mes menos todo lo
  gastado, como en el resumen. Lo apartado ya cuenta en lo gastado, y lo
  retirado ya lo descuenta.
- **Ahorrado**: lo apartado, menos lo retirado, más lo que quedó sin gastar.
- **Ingreso de referencia**: el ingreso planeado de un mes. Si ese mes no
  tiene ingresos planeados, el del último mes anterior que sí los tiene.
- **Parte del ingreso**: un monto dividido por el ingreso de referencia del
  mes, en porcentaje.
- **Tintas de libro**: la paleta de colores apagados para distinguir
  categorías en los gráficos, con una versión para cada tema.

## Decisiones de clarificación (2026-11-09)

1. **Los reportes responden tres preguntas**: en qué se va la plata, si se
   planea bien y si se ahorra. En la clarificación se eligieron cinco; dos
   se quitaron al revisar el prototipo (decisión 18).
2. **Los reportes viven dentro del Mes**, con un selector "Este mes |
   Reportes" arriba. La barra sigue con cinco secciones. Se descartó una
   sexta sección: seis palabras no caben en 360 px sin bajar a 11 px.
3. *(Cambiada por la decisión 20.)* Todos los reportes miraban una ventana
   de mes anterior, 3, 6 o 12 meses.
4. *(Retirada por la decisión 18.)* "¿Puedo con otra compra?" tenía un
   simulador de compras.
5. **La dirección visual es "tintas de libro"**: el Libro auxiliar de la
   011 con una paleta de tintas apagadas para distinguir categorías, una
   para el tema claro y otra para el oscuro, con contraste comprobado por
   un test. Se descartaron el monocromo (sobrio, pero menos atractivo) y una
   paleta viva de dashboard (rompe con el estilo de la app).
6. **El diseño se aprueba en un prototipo antes del código**, como en la 011
   y la 012, en celular y computador y en los dos temas. La persona pidió
   que en los dos temas haya atractivo visual.

## Decisiones tomadas al redactar la spec

7. **Cada reporte empieza por su respuesta en una frase**, con la cifra que
   importa en grande ("En octubre ahorraste **$ 618.640**, el 10 % del
   ingreso"). Debajo, el gráfico; debajo, las cifras. Es lo que hace que un
   reporte se lea de un vistazo.
8. **Los reportes dicen hechos, no consejos.** Ninguna regla del tipo "no
   pases del 30 %": la app no sabe la situación de cada persona. Se resalta
   lo extremo (el mejor y el peor mes, el rubro que más se pasó), sin
   juzgarlo.
9. **Los cálculos van en la API** (principio 10), en una consulta por mes
   elegido y ventana. La web solo los dibuja y agrupa en "Otras" las
   categorías que no caben, sin cambiar ningún monto.
10. *(Retirada por la decisión 18.)* Los reportes de cuotas y deudas miraban
    hacia adelante, desde el mes actual.
11. *(Retirada por la decisión 20.)* Un rubro de varios meses se unía por su
    nombre.
12. **En "¿En qué se me va la plata?", las cuotas de deudas son una línea
    aparte, "Cuotas de tarjetas"**, como en el resumen (spec 009): una compra
    a cuotas no cuenta en su categoría el día de la compra, sino en Deudas
    cuando se paga. Los gastos del mes con tarjeta sí van en su categoría.
13. **El ingreso de los reportes es el planeado.** gastito no registra el
    ingreso real; el reporte lo dice ("ingreso planeado").
14. **En "¿Estoy ahorrando?", un mes de la ventana sin ingresos ni gastos no
    cuenta en los promedios** y se muestra vacío, con la razón. Si el mes
    elegido no tiene datos, cada reporte lo dice y ofrece ir a planear.
15. **Cada gráfico tiene sus cifras a la vista o a un toque** ("Ver
    cifras", con una tabla), para leerlo con lector de pantalla o con
    precisión. Al tocar o pasar el puntero sobre una columna, muestra su mes
    y su cifra.
16. **Gráficos propios, sin librería**, como las barras de la 012 (ADR
    0016). Los de tiempo (columnas por mes) pueden usar SVG generado por la
    web; el plan lo decide con su ADR.
17. **En el computador, los reportes usan más ancho** que el Mes: desde
    1280 px, "¿En qué se me va la plata?" y "¿Planeo bien?" lado a lado, y
    "¿Estoy ahorrando?" a todo el ancho debajo. En el celular, uno debajo
    de otro.

## Decisiones al revisar el prototipo (2026-11-10)

18. **Se quitan "¿Puedo con otra compra a cuotas?", con su simulador, y
    "¿Cuándo salgo de deudas?".** Lo decidió la persona al ver el
    prototipo. Los reportes miran solo meses cerrados. Los requisitos RF-7 a
    RF-13 quedan retirados con su número, para no cambiar las referencias
    del resto.
19. **"¿Planeo bien?" muestra lo gastado sin rubro**, con una fila por
    categoría ("Comida · sin rubro"). Su planeado es 0, así que siempre
    aparece como algo que se pasa, y dice qué rubro conviene añadir al plan.
    Lo pidió la persona: sin esa fila, un gasto registrado como no planeado
    no se veía en este reporte. Una compra con tarjeta que no estaba en el
    plan es deuda (spec 010) y no entra aquí: va en "Cuotas de tarjetas".
20. **Los reportes miran un mes elegido.** Un selector "‹ octubre 2026 ›",
    como el de Gastos, elige cualquier mes ya cerrado, desde el primero con
    datos del espacio; por defecto, el mes anterior. "¿En qué se me va la
    plata?" y "¿Planeo bien?" muestran solo ese mes, sin promedios: así cada
    cifra es de un mes real. "¿Estoy ahorrando?" conserva su ventana de 1,
    3, 6 o 12 meses, que termina en el mes elegido, porque el ahorro se
    entiende en el tiempo. Lo pidió la persona: los promedios de varios
    meses en "¿Planeo bien?" se entendían mal.
21. **"Ahorro" es una categoría predefinida.** Se añade al final de la
    lista de la spec 002 (después de "Otros") y una migración la crea en
    cada espacio que no tenga ya una categoría con ese nombre, activa o
    archivada. Lo pidió la persona: el ahorro se planea como un rubro y se
    registra como un gasto, en su categoría. Cambia la decisión 1 de la
    spec 002; la 002 no se edita.
22. **En "¿En qué se me va la plata?", lo apartado en Ahorro no cuenta como
    gasto**: no está en la lista ni en los porcentajes, y la frase lo
    nombra aparte ("Además, apartaste $ 500.000 en Ahorro").
23. **"¿Planeo bien?" no incluye la categoría Ahorro.** Para un rubro de
    ahorro, gastar menos de lo planeado es apartar menos, al revés que los
    demás rubros. Lo mide "¿Estoy ahorrando?".
24. **"¿Estoy ahorrando?" suma lo apartado y lo que quedó sin gastar.** Un
    mes en que se apartaron $ 500.000 y quedaron $ 118.640 se ahorraron
    $ 618.640. Lo apartado se compara con lo planeado en la categoría
    Ahorro.
25. **Se puede registrar un retiro de ahorro**, en Registrar ("Gasto |
    Retiro de ahorro"), con monto, fecha y nota opcional; no lleva
    categoría, rubro ni tipo de pago: siempre sale de Ahorro. Lo pidió la
    persona: apartar $ 200.000 y tener que sacar $ 100.000 para una
    urgencia es un caso real, y el reporte debe decirlo. Se descartó no
    registrarlo y dejar que se viera como "faltó".
26. **El retiro resta de Ahorro también en el Mes.** La categoría Ahorro
    muestra lo apartado menos lo retirado ($ 100.000 de $ 200.000
    planeados) y una línea "Retirado del ahorro". Como el retiro cubrió un
    gasto del mes, el balance no baja por ese gasto. Así el Mes y el
    reporte dicen lo mismo.
27. **El retiro sale en Gastos y se edita o se borra como un gasto**, con
    su fecha, "Retiro de ahorro", su nota y el monto con "+". Borrar pide
    confirmación (principio 8).
28. **Un retiro no puede pasar de lo apartado en su mes**, menos lo ya
    retirado ese mes. La persona lo eligió así: es más fácil de leer, y
    gastito no lleva el saldo total del ahorro. Como consecuencia, tampoco
    se puede borrar o cambiar lo apartado si eso deja lo retirado por
    encima: la app lo impide y dice por qué.

## Requisitos funcionales

### Acceso, mes y ventana

- **RF-1** El Mes DEBE tener un selector "Este mes | Reportes". CUANDO se
  elige "Reportes", la web DEBE mostrar los tres reportes en `/mes/reportes`
  (decisión 2).
- **RF-2** Los reportes DEBEN tener un selector de mes, con el mes anterior
  por defecto. "¿Estoy ahorrando?" DEBE tener además una ventana de 1, 3, 6
  o 12 meses que termina en el mes elegido, con 1 por defecto. El mes y la
  ventana DEBEN recordarse mientras la app esté abierta (decisión 20).
- **RF-3** El mes elegido DEBE ser un mes ya cerrado en `TZ`: el mes actual y
  los siguientes NO DEBEN poder elegirse (principio 7). El selector NO DEBE
  ir antes del primer mes con ingresos, rubros o gastos del espacio.
- **RF-4** Cada reporte DEBE empezar con su respuesta en una frase y su cifra
  principal, seguir con el gráfico y ofrecer sus cifras en una tabla
  (decisiones 7 y 15).

### API

- **RF-5** La API DEBE dar, para un espacio, un mes cerrado y una ventana de
  1, 3, 6 o 12 meses, los datos de los tres reportes y el primer mes con
  datos, calculados con las reglas de las specs 008 a 010. Solo un miembro
  del espacio DEBE poder pedirlos (principio 13). SI el mes no es un mes
  cerrado o la ventana no es una de esas, ENTONCES DEBE responder `422` con
  un mensaje en español.
- **RF-6** Todos los montos DEBEN ser enteros de pesos (principio 6), y los
  porcentajes, enteros redondeados. El reparto de un total DEBE sumar el
  total exacto.

### Categoría Ahorro

- **RF-29** Al crear un espacio, sus categorías predefinidas DEBEN incluir
  "Ahorro", al final de la lista (decisión 21).
- **RF-30** Una migración DEBE crear la categoría "Ahorro" en cada espacio
  que no tenga una con ese nombre, activa o archivada, sin cambiar nada más
  (principio 8).

### Retiros de ahorro

- **RF-32** Registrar DEBE ofrecer "Gasto | Retiro de ahorro". Un retiro
  DEBE pedir monto y fecha, con las mismas reglas que un gasto (monto entero
  mayor que 0, fecha por defecto hoy en `TZ`), y una nota opcional. DEBE
  guardar quién lo registró (decisión 25).
- **RF-33** SI un retiro, al crearlo o editarlo, pasa de lo apartado en
  Ahorro en su mes menos lo ya retirado ese mes, ENTONCES la API DEBE
  rechazarlo con `422` y decir cuánto se puede retirar ("En agosto
  apartaste $ 500.000 y ya retiraste $ 200.000: puedes retirar hasta
  $ 300.000.") (decisión 28).
- **RF-34** SI editar o borrar un gasto deja lo retirado de un mes por
  encima de lo apartado en ese mes, ENTONCES la API DEBE rechazarlo con
  `409`, sin cambiar nada, y decir por qué (decisión 28).
- **RF-35** Gastos DEBE listar los retiros del mes con su fecha, "Retiro de
  ahorro", su nota y el monto con "+". Un retiro DEBE poder editarse y
  borrarse; borrar DEBE pedir confirmación (decisión 27).
- **RF-36** El resumen del mes (spec 008) DEBE mostrar en la categoría
  Ahorro lo apartado menos lo retirado, con lo retirado aparte. Lo
  retirado NO DEBE contar como no planeado, y lo gastado y el balance del
  mes DEBEN descontarlo. El Mes DEBE mostrar la línea "Retirado del
  ahorro" en la categoría Ahorro (decisión 26).
- **RF-37** Los retiros DEBEN pertenecer a un espacio: solo sus miembros
  DEBEN poder crearlos, verlos, editarlos y borrarlos, y uno de otro
  espacio DEBE responder `404` (principio 13).

### Retirados

- **RF-7 a RF-13** "¿Puedo con otra compra a cuotas?" (cuotas
  comprometidas, ingreso estimado, simulador y estado vacío) y "¿Cuándo salgo
  de deudas?" (mes final, saldo por tarjeta y estado vacío). Retirados el
  2026-11-10 (decisión 18).
- **RF-16** Las columnas por mes de "¿En qué se me va la plata?" y su
  promedio mensual. Retirado el 2026-11-10 (decisión 20).

### 1. ¿En qué se me va la plata?

- **RF-14** El reporte DEBE mostrar lo gastado en el mes elegido en cada
  categoría y en "Cuotas de tarjetas", ordenado de mayor a menor, con su
  parte del total (decisión 12).
- **RF-15** El reporte DEBE decir qué parte de lo gastado en el mes fue no
  planeado (gastos sin rubro).
- **RF-31** Lo apartado en la categoría Ahorro NO DEBE contar en lo gastado
  ni en las partes del reporte. CUANDO el mes tiene algo apartado, la frase
  DEBE nombrarlo aparte, con lo retirado si hubo (decisión 22).
- **RF-17** Las categorías DEBEN distinguirse con las tintas de libro en un
  orden fijo, y llevar su nombre escrito: el color nunca es la única pista.
  Más de seis categorías se agrupan en "Otras" (decisión 5).

### 2. ¿Planeo bien?

- **RF-18** El reporte DEBE mostrar, para cada rubro del mes elegido, lo
  planeado, lo gastado y la diferencia. DEBE mostrar además, para cada
  categoría con gastos sin rubro en el mes, una fila "sin rubro" con
  planeado 0 (decisión 19). Los rubros y los gastos de la categoría Ahorro
  NO DEBEN entrar (decisión 23).
- **RF-19** El gráfico DEBE mostrar la diferencia como barras a partir de
  cero: hacia un lado lo que se pasa, en rojo y con signo, y hacia el otro
  lo que sobra. Los rubros y las filas sin rubro se ordenan juntos, de lo
  que más se pasa a lo que más sobra.
- **RF-20** La frase DEBE nombrar el rubro o la fila sin rubro que más se
  pasó ("Mercado se pasó $ 85.000 de lo planeado"; "En Comida gastaste
  $ 120.000 sin rubro"). SI nada se pasó, ENTONCES DEBE decirlo.

### 3. ¿Estoy ahorrando?

- **RF-21** El reporte DEBE mostrar, por mes de la ventana, lo apartado y lo
  planeado en la categoría Ahorro, lo retirado, lo que quedó sin gastar y
  lo ahorrado, con su parte del ingreso de referencia (decisiones 13, 24 y
  25).
- **RF-22** El gráfico DEBE mostrar, por mes, lo apartado menos lo
  retirado y lo que quedó sin gastar en una misma columna; lo que quedó, en rojo y bajo la línea de
  cero cuando es negativo. CUANDO la ventana tiene más de un mes, DEBE
  mostrar también el promedio de lo ahorrado, el mejor mes, el peor y en
  cuántos meses se apartó lo planeado.
- **RF-23** CUANDO la ventana es un mes, el reporte DEBE mostrar lo ahorrado
  en grande, con lo apartado, lo retirado, lo que quedó y su parte del
  ingreso.

### Diseño y accesibilidad

- **RF-24** Los reportes DEBEN seguir la sección "Diseño" de esta spec y las
  de la 011 y la 012, en los dos temas y de 320 a 1440 px de ancho.
- **RF-25** Cada parte llena de un gráfico DEBE tener contraste de al menos
  3:1 con lo que la rodea, y todo texto, 4,5:1, en los dos temas (WCAG 2.2
  AA). Un test DEBE comprobar la paleta de tintas en los dos temas.
- **RF-26** Los gráficos DEBEN ocultarse al lector de pantalla cuando la
  frase y la tabla de cifras dicen lo mismo, y la tabla DEBE poder abrirse
  con teclado (decisión 15).
- **RF-27** Con `prefers-reduced-motion`, los gráficos NO DEBEN animarse.
- **RF-28** Sin conexión, los reportes DEBEN avisarlo como el resto de la
  app (RF-30 de la 011).

## Diseño

Sigue el Libro auxiliar (011) y las barras del Mes (012). Esta sección
añade lo de los reportes; los detalles visuales se cierran en el prototipo
(decisión 6).

### Tintas de libro

- Seis tintas apagadas para categorías, en un orden fijo: azul de Prusia,
  verde botella, ocre, óxido, ciruela y pizarra. Una séptima posición es
  "Otras", en el gris de los renglones.
- **Dos versiones**: en el tema claro, tintas oscuras sobre el papel; en el
  oscuro, las mismas tintas aclaradas para el papel azul tinta, no
  invertidas. Las dos se comprueban: contraste de 3:1 contra el papel y
  separación suficiente entre tintas vecinas para quien no distingue bien
  los colores.
- El rojo de la 011 sigue reservado para lo que se pasa y lo negativo. Las
  categorías no lo usan.
- Las tintas son tokens en `tokens.css`, como el resto de colores.

### Un reporte

- **Encabezado**: la pregunta como rótulo ("¿EN QUÉ SE ME VA LA PLATA?") y
  el mes o la ventana que mira.
- **Respuesta**: una frase en texto grande con la cifra principal en
  monoespaciada (por ejemplo, "Hogar se lleva el **38 %** de lo que
  gastaste").
- **Gráfico**: delgado y sin adornos, sin rejilla pesada y con etiquetas
  directas en lo importante.
- **Cifras**: "Ver cifras" abre la tabla, con las cifras a la derecha.
- Entre reportes, la doble raya roja de los totales, como capítulos del
  libro.

### Gráficos por reporte

1. **En qué se va**: barras horizontales ordenadas por categoría con su
   tinta y su monto.
2. **Planeo bien**: barras divergentes desde una línea de cero: lo que se
   pasa hacia la derecha en rojo, lo que sobra hacia la izquierda en tinta.
3. **Ahorro**: columnas por mes con lo apartado menos lo retirado en tinta
   y lo que quedó encima en gris; lo que faltó, en rojo bajo la línea de cero; con un mes,
   la cifra en grande con su desglose.

### Celular y computador

- **Celular**: arriba, "Este mes | Reportes" y el selector de mes; un
  reporte debajo de otro, a todo el ancho; los gráficos de 12 meses se
  desplazan a lo ancho sin desbordar la página, con el mes más reciente a
  la vista.
- **Computador**: desde 1280 px, hasta 1040 px de ancho, con el reparto de
  la decisión 17.

### Movimiento

Las barras pueden crecer al aparecer (200 ms). Con `prefers-reduced-motion`,
ninguna animación (RF-27).

## Criterios de validación

La spec se da por cumplida cuando, además de los tests por requisito:

1. pytest prueba en la API, con un espacio de datos de ejemplo de varios
   meses: "Ahorro" en las predefinidas y la migración que la crea sin
   duplicarla; los retiros de ahorro con su límite, el `409` al borrar lo
   apartado y su efecto en el resumen; el gasto del mes por categoría con "Cuotas de tarjetas", lo
   no planeado y lo apartado aparte; los rubros del mes que se pasan y
   sobran y las filas sin rubro, sin Ahorro; lo apartado, lo que quedó y lo
   ahorrado por mes, con el ingreso de referencia de un mes sin ingresos; la
   ventana que termina en el mes elegido; un mes sin datos fuera de los
   promedios; que los repartos suman el total; que otro espacio no ve nada;
   y el `422` de un mes no cerrado o una ventana inválida (RF-5, RF-6, RF-14
   a RF-23, RF-29 a RF-37).
2. `node --test` prueba sin navegador las frases de cada reporte, las
   escalas de los gráficos, la agrupación en "Otras" y los límites del
   selector de mes (RF-3, RF-4, RF-17).
3. El test de contraste comprueba la paleta de tintas en los dos temas
   (RF-25).
4. Verificación a mano en Chrome del computador, con la lista del plan: los
   tres reportes en varios meses, la ventana de "¿Estoy ahorrando?",
   registrar, editar y borrar un retiro y verlo en Gastos y en el Mes, los
   estados vacíos, el teclado y "Ver cifras", 320 y 1280 px y los dos
   temas. Android e iPhone, con la 011 y la 012 en la 020.
5. `make test` y `make lint` pasan en verde.

## Requisitos para otras specs y documentos

- **020-https-dominio:** la verificación en el celular incluye los
  reportes.
- **README:** una sección "Reportes" con las tres preguntas y la ruta de la
  API; "Ahorro" en la lista de categorías predefinidas, y cómo registrar un
  retiro de ahorro.
- **AGENTS.md:** el glosario puede añadir "reporte", "mes elegido" y
  "ahorro" y "retiro de ahorro" si la persona lo pide; esta spec no lo
  cambia.
