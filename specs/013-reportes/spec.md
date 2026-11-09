# Spec 013 — Reportes para decidir

- Fase: 1 — Aplicación y SDD
- Estado: borrador (2026-11-09)
- Base: spec 008 (rubros, ingresos y resumen), spec 009 (tarjetas, cuotas,
  abonos y simulación), spec 010 (gasto del mes o deuda), spec 011 (la web y
  su diseño), spec 012 (Mes y barras), ADR 0013, ADR 0014, ADR 0016

## Por qué

El Mes de la 012 dice cómo va el mes. No dice si el mes va mejor o peor que
los anteriores, cuánto del sueldo de los próximos meses ya está comprometido
en cuotas, ni cuándo se termina de pagar la Visa. Esas son las preguntas con
las que se toman decisiones: comprar o no a cuotas, abonar a una deuda,
recortar un rubro.

Esta spec trae cinco reportes, uno por pregunta. Cada uno responde en una
frase, la muestra en un gráfico y deja ver las cifras. Tienen que leerse de
un vistazo en el celular y en el computador, en tema claro y en oscuro.

## Qué entra

Cinco reportes en el Mes, bajo "Reportes":

1. **¿Puedo con otra compra a cuotas?** Cuánto del ingreso de cada mes
   próximo ya está comprometido en cuotas, con un simulador para probar una
   compra antes de hacerla.
2. **¿Cuándo salgo de deudas?** En qué mes se termina de pagar cada tarjeta,
   cuánto falta y cuánto se pagará en intereses.
3. **¿En qué se me va la plata?** El gasto por categoría en los meses
   elegidos, cuánto fue no planeado y cuánto se fue en cuotas de deudas.
4. **¿Planeo bien?** Qué rubros se pasan de lo planeado y cuáles sobran, mes
   tras mes.
5. **¿Estoy ahorrando?** Ingreso, gastado y lo que quedó cada mes, y qué
   parte del ingreso fue.

Y lo que los hace posibles:

- En la API, los cálculos de los reportes sobre varios meses.
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
- Proyectar gastos futuros que no son cuotas.
- Cambiar las reglas de las specs 008 a 010: los reportes leen los mismos
  datos con las mismas reglas.

## Conceptos

- **Reporte**: una pregunta, su respuesta en una frase, un gráfico y sus
  cifras.
- **Ventana**: los meses completos que miran hacia atrás los reportes 3, 4
  y 5. Por defecto, el mes anterior al actual; se puede elegir 3, 6 o 12
  meses. El mes en curso no entra: está a medias, y ya lo muestra "Este
  mes".
- **Cuotas comprometidas**: la deuda de las tarjetas en un mes futuro, es
  decir, la suma de la deuda del mes de cada tarjeta (RF-7 de la 010): cuotas
  con intereses estimados, o el extracto menos los gastos del mes, más los
  abonos. Los gastos del mes con tarjeta no cuentan: ya están en el plan.
- **Ingreso de referencia**: el ingreso planeado de un mes. Si ese mes no
  tiene ingresos planeados, el del último mes que sí los tiene.
- **Parte del ingreso**: un monto dividido por el ingreso de referencia del
  mes, en porcentaje.
- **Simulación**: una compra que no se guarda, calculada por la API como en
  RF-41 de la 009.
- **Tintas de libro**: la paleta de colores apagados para distinguir
  categorías y tarjetas en los gráficos, con una versión para cada tema.

## Decisiones de clarificación (2026-11-09)

1. **Los cinco reportes son las cinco preguntas**: comprometido en cuotas,
   salir de deudas, en qué se va la plata, si se planea bien y si se ahorra.
   Las eligió la persona entre las que se propusieron.
2. **Los reportes viven dentro del Mes**, con un selector "Este mes |
   Reportes" arriba. La barra sigue con cinco secciones. Se descartó una
   sexta sección: seis palabras no caben en 360 px sin bajar a 11 px.
3. **La ventana se elige: mes anterior, 3, 6 o 12 meses; por defecto, el mes
   anterior.** La eligió así la persona: el mes recién cerrado es el que
   más se mira. Se descartó una ventana fija de 6 meses.
4. **"¿Puedo con otra compra?" tiene simulador**: monto, tarjeta y cuotas, y
   el gráfico suma esa compra a lo ya comprometido sin guardar nada. Se
   descartó mostrar solo lo comprometido.
5. **La dirección visual es "tintas de libro"**: el Libro auxiliar de la
   011 con una paleta de tintas apagadas para distinguir categorías y
   tarjetas, una para el tema claro y otra para el oscuro, con contraste
   comprobado por un test. Se descartaron el monocromo (sobrio, pero menos
   atractivo) y una paleta viva de dashboard (rompe con el estilo de la
   app).
6. **El diseño se aprueba en un prototipo antes del código**, como en la 011
   y la 012, en celular y computador y en los dos temas. La persona pidió
   que en los dos temas haya atractivo visual.

## Decisiones tomadas al redactar la spec

7. **Cada reporte empieza por su respuesta en una frase**, con la cifra que
   importa en grande ("Diciembre compromete el 8 % de tu ingreso en
   cuotas"). Debajo, el gráfico; debajo, las cifras. Es lo que hace que un
   reporte se lea de un vistazo.
8. **Los reportes dicen hechos, no consejos.** Ninguna regla del tipo "no
   pases del 30 %": la app no sabe la situación de cada persona. Se resalta
   lo extremo (el mes más cargado, el rubro que más se pasa), sin juzgarlo.
9. **Los cálculos van en la API** (principio 10), en una consulta por
   ventana. La web solo los dibuja. La única suma de la web es la de la
   simulación sobre lo comprometido, que es presentación de dos respuestas
   de la API, como el efecto de un abono en la 012.
10. **Los reportes 1 y 2 miran hacia adelante**, desde el mes actual hasta el
    último mes con cuotas, y no dependen de la ventana. Incluyen las
    tarjetas archivadas con saldo (decisión 21 de la 009).
11. **Un rubro es el mismo en varios meses si se llama igual**, con la
    comparación de nombres de las categorías (mayúsculas y tildes no
    cuentan). Copiar el plan conserva los nombres, así que "Mercado" de
    octubre y "Mercado" de noviembre son el mismo rubro.
12. **En "¿En qué se me va la plata?", las cuotas de deudas son una línea
    aparte, "Cuotas de tarjetas"**, como en el resumen (spec 009): una compra
    a cuotas no cuenta en su categoría el día de la compra, sino en Deudas
    cuando se paga. Los gastos del mes con tarjeta sí van en su categoría.
13. **El ingreso de los reportes es el planeado.** gastito no registra el
    ingreso real; el reporte lo dice ("ingreso planeado").
14. **Un mes de la ventana sin ingresos ni gastos no cuenta en los
    promedios** y se muestra vacío, con la razón. Si ningún mes tiene datos,
    el reporte lo dice y ofrece ir a planear.
15. **Cada gráfico tiene sus cifras a la vista o a un toque** ("Ver
    cifras", con una tabla), para leerlo con lector de pantalla o con
    precisión. Al tocar o pasar el puntero sobre una barra, muestra su mes y
    su cifra.
16. **Gráficos propios, sin librería**, como las barras de la 012 (ADR
    0016). Los de tiempo (columnas por mes, el saldo que baja) pueden usar
    SVG generado por la web; el plan lo decide con su ADR.
17. **En el computador, los reportes usan más ancho** que el Mes: dos
    columnas de reportes desde 1280 px. En el celular, uno debajo de otro.

## Requisitos funcionales

### Acceso y ventana

- **RF-1** El Mes DEBE tener un selector "Este mes | Reportes". CUANDO se
  elige "Reportes", la web DEBE mostrar los cinco reportes en `/mes/reportes`
  (decisión 2).
- **RF-2** Los reportes DEBEN tener un selector de ventana: "Mes anterior",
  "3 meses", "6 meses" y "12 meses", con "Mes anterior" por defecto. La
  ventana elegida DEBE recordarse mientras la app esté abierta (decisión 3).
- **RF-3** La ventana DEBE estar hecha de meses completos que terminan en el
  mes anterior al actual en `TZ`; el mes actual NO DEBE entrar (principio 7).
- **RF-4** Cada reporte DEBE empezar con su respuesta en una frase y su cifra
  principal, seguir con el gráfico y ofrecer sus cifras en una tabla
  (decisiones 7 y 15).

### API

- **RF-5** La API DEBE dar, para un espacio y una ventana de 1, 3, 6 o 12
  meses, los datos de los cinco reportes, calculados con las reglas de las
  specs 008 a 010. Solo un miembro del espacio DEBE poder pedirlos
  (principio 13). SI la ventana no es una de esas, ENTONCES DEBE responder
  `422` con un mensaje en español.
- **RF-6** Todos los montos DEBEN ser enteros de pesos (principio 6), y los
  porcentajes, enteros redondeados. El reparto de un total DEBE sumar el
  total exacto.

### 1. ¿Puedo con otra compra a cuotas?

- **RF-7** El reporte DEBE mostrar, para cada mes desde el actual hasta el
  último con cuotas, las cuotas comprometidas, el ingreso de referencia y
  la parte del ingreso, con el mes más cargado resaltado.
- **RF-8** SI un mes futuro no tiene ingresos planeados, ENTONCES el reporte
  DEBE usar el del último mes que sí los tiene y marcarlo como estimado. SI
  ningún mes tiene ingresos, ENTONCES DEBE mostrar los montos sin la parte
  del ingreso y decirlo.
- **RF-9** CUANDO se escriben monto, tarjeta y cuotas en el simulador, la web
  DEBE pedir la simulación a la API y sumar sus cuotas a las de cada mes,
  diferenciadas en el gráfico, y la frase DEBE decir cómo queda el mes más
  cargado con esa compra. NADA DEBE guardarse (decisión 4).
- **RF-10** SI no hay cuotas comprometidas, ENTONCES el reporte DEBE decirlo
  ("No tienes cuotas pendientes") y dejar usar el simulador.

### 2. ¿Cuándo salgo de deudas?

- **RF-11** El reporte DEBE mostrar el mes en que se paga la última cuota de
  todas las tarjetas y, por tarjeta (también archivada con saldo): el saldo
  de capital pendiente, el mes de su última cuota y los intereses estimados
  que faltan por pagar desde el mes actual.
- **RF-12** El gráfico DEBE mostrar cómo baja el saldo pendiente mes a mes
  hasta cero, por tarjeta. Los abonos ya registrados DEBEN contar.
- **RF-13** SI no hay deudas, ENTONCES el reporte DEBE decirlo ("No tienes
  deudas con tarjetas").

### 3. ¿En qué se me va la plata?

- **RF-14** El reporte DEBE mostrar, en la ventana, lo gastado en cada
  categoría y en "Cuotas de tarjetas", ordenado de mayor a menor, con su
  parte del total (decisión 12).
- **RF-15** El reporte DEBE decir qué parte del gasto de la ventana fue no
  planeado (gastos sin rubro).
- **RF-16** CUANDO la ventana tiene más de un mes, el reporte DEBE mostrar
  además lo gastado en cada mes repartido por categoría, y el promedio
  mensual de cada categoría.
- **RF-17** Las categorías DEBEN distinguirse con las tintas de libro en un
  orden fijo, y llevar su nombre escrito: el color nunca es la única pista.
  Más de seis categorías se agrupan en "Otras" (decisión 5).

### 4. ¿Planeo bien?

- **RF-18** El reporte DEBE mostrar, para cada rubro de la ventana
  (decisión 11), en cuántos de sus meses se pasó de lo planeado y la
  diferencia promedio entre lo gastado y lo planeado.
- **RF-19** El gráfico DEBE mostrar esa diferencia como barras a partir de
  cero: hacia un lado lo que se pasa, en rojo y con signo, y hacia el otro
  lo que sobra. Los rubros se ordenan de lo que más se pasa a lo que más
  sobra.
- **RF-20** La frase DEBE nombrar el rubro que más se pasa y en cuántos meses
  ("Mercado se pasó en 5 de 6 meses, $ 85.000 en promedio"). SI ningún rubro
  se pasó, ENTONCES DEBE decirlo.

### 5. ¿Estoy ahorrando?

- **RF-21** El reporte DEBE mostrar, por mes de la ventana, el ingreso
  planeado, lo gastado (con las deudas, como en el resumen) y lo que quedó,
  con su parte del ingreso (decisión 13).
- **RF-22** El gráfico DEBE mostrar lo que quedó cada mes: positivo en tinta
  y negativo en rojo con signo menos. CUANDO la ventana tiene más de un mes,
  DEBE mostrar también el promedio, el mejor mes y el peor.
- **RF-23** CUANDO la ventana es un mes, el reporte DEBE mostrar lo que
  quedó en grande, con su parte del ingreso.

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
  app (RF-30 de la 011), y el simulador NO DEBE pedir simulaciones.

## Diseño

Sigue el Libro auxiliar (011) y las barras del Mes (012). Esta sección
añade lo de los reportes; los detalles visuales se cierran en el prototipo
(decisión 6).

### Tintas de libro

- Seis tintas apagadas para categorías y tarjetas, en un orden fijo: azul
  de Prusia, verde botella, ocre, óxido, ciruela y pizarra. Una séptima
  posición es "Otras", en el gris de los renglones.
- **Dos versiones**: en el tema claro, tintas oscuras sobre el papel; en el
  oscuro, las mismas tintas aclaradas para el papel azul tinta, no
  invertidas. Las dos se comprueban: contraste de 3:1 contra el papel y
  separación suficiente entre tintas vecinas para quien no distingue bien
  los colores.
- El rojo de la 011 sigue reservado para lo que se pasa y lo negativo. Ni
  las categorías ni las tarjetas lo usan.
- Las tintas son tokens en `tokens.css`, como el resto de colores.

### Un reporte

- **Encabezado**: la pregunta como rótulo ("¿PUEDO CON OTRA COMPRA?").
- **Respuesta**: una frase en texto grande con la cifra principal en
  monoespaciada (por ejemplo, "Diciembre compromete el **8 %** de tu
  ingreso en cuotas").
- **Gráfico**: delgado y sin adornos, con los meses abajo, sin rejilla
  pesada y con etiquetas directas en lo importante.
- **Cifras**: "Ver cifras" abre la tabla, con las cifras a la derecha.
- Entre reportes, la doble raya roja de los totales, como capítulos del
  libro.

### Gráficos por reporte

1. **Comprometido**: columnas por mes, lo ya comprometido en tinta y la
   compra simulada encima con trama, y la parte del ingreso escrita sobre
   cada columna. El mes más cargado, con su cifra.
2. **Salir de deudas**: el saldo que baja mes a mes, apilado por tarjeta con
   sus tintas, hasta llegar a cero; la fecha final marcada.
3. **En qué se va**: barras horizontales ordenadas por categoría con su
   tinta y su monto; con más de un mes, columnas por mes apiladas por
   categoría.
4. **Planeo bien**: barras divergentes desde una línea de cero: lo que se
   pasa hacia la derecha en rojo, lo que sobra hacia la izquierda en tinta.
5. **Ahorro**: columnas por mes de lo que quedó, positivas en tinta y
   negativas en rojo bajo la línea de cero; con un mes, la cifra en grande.

### Celular y computador

- **Celular**: un reporte debajo de otro, a todo el ancho; los gráficos de
  12 meses se desplazan a lo ancho sin desbordar la página, con el mes más
  reciente a la vista.
- **Computador**: desde 1280 px, dos columnas de reportes y hasta 1040 px
  de ancho (decisión 17).

### Movimiento

Las barras pueden crecer al aparecer (200 ms). Con `prefers-reduced-motion`,
ninguna animación (RF-27).

## Criterios de validación

La spec se da por cumplida cuando, además de los tests por requisito:

1. pytest prueba en la API, con un espacio de datos de ejemplo de varios
   meses: lo comprometido por mes, con tarjetas archivadas y abonos; el
   ingreso de referencia de un mes sin plan; el mes de salida de deudas y
   los intereses que faltan; el gasto por categoría con "Cuotas de
   tarjetas" y lo no planeado; los rubros que se pasan y sobran, uniendo
   meses por nombre; lo que quedó por mes y su parte del ingreso; la
   ventana sin el mes actual; un mes sin datos fuera de los promedios; que
   los repartos suman el total; que otro espacio no ve nada; y el `422` de
   una ventana inválida (RF-5 a RF-23).
2. `node --test` prueba sin navegador las frases de cada reporte, la suma
   de la simulación sobre lo comprometido, las escalas de los gráficos y la
   agrupación en "Otras" (RF-4, RF-9, RF-17).
3. El test de contraste comprueba la paleta de tintas en los dos temas
   (RF-25).
4. Verificación a mano en Chrome del computador, con la lista del plan: los
   cinco reportes con cada ventana, el simulador, los estados vacíos, el
   teclado y "Ver cifras", 320 y 1280 px y los dos temas. Android e iPhone,
   con la 011 y la 012 en la 020.
5. `make test` y `make lint` pasan en verde.

## Requisitos para otras specs y documentos

- **020-https-dominio:** la verificación en el celular incluye los
  reportes.
- **README:** una sección "Reportes" con las cinco preguntas y la ruta de
  la API.
- **AGENTS.md:** el glosario puede añadir "reporte" y "ventana" si la persona
  lo pide; esta spec no lo cambia.
