# ADR 0022 — Anillos del Mes con CSS, sin librería ni SVG

- Fecha: 2026-11-15
- Estado: aceptada
- Fase / spec: 1 / 033-detalle-del-gasto-y-mes

## Contexto

La 033 separa el Mes en dos bolsas, "En el plan" y "Sin asignar", y la
clarificación eligió mostrar cada una con un anillo que se llena con lo
gastado (decisión 4 de la spec). Hasta ahora todos los gráficos de la web
eran barras o columnas hechas con `<div>` y CSS (ADR 0016 y 0017).

Restricciones, las mismas de esos ADR:

- **La CSP de la 011** no deja estilos en línea en el HTML; sí deja cambiar
  una propiedad desde un script propio.
- **Sin `npm` ni compilación** (ADR 0015, principio 2).
- **Accesibilidad**: el color nunca es la única pista y el lector de
  pantalla lee las cifras (RF-13 y RF-21 de la 033).
- **Diseño de la 011**: renglones y no tarjetas, sin degradados decorativos.

## Decisión

1. **El anillo es un `<div>` con
   [`conic-gradient`](https://developer.mozilla.org/es/docs/Web/CSS/gradient/conic-gradient)
   de corte seco**: tinta desde 0 hasta `--fill` vueltas y el gris de
   renglón después. No hay transición entre los dos colores, así que no se
   ve como un degradado. Un círculo de papel encima (`::before`) deja el
   hueco.
2. **`--fill` llega desde JavaScript con `style.setProperty`**, igual que
   `--fill` en los medidores de los rubros. `dashboard.js` calcula la
   fracción sin DOM y se prueba con `node --test`.
3. **Las cifras van escritas debajo** ("queda", "gastado … de …") y el
   anillo lleva `aria-hidden="true"`. Una bolsa excedida pinta el anillo
   entero en rojo y escribe "excedido" con el monto.
4. **Los colores son los de los medidores** (tinta o rojo sobre `--rule`),
   cuyos pares ya comprueba `contrast.test.js` a 3:1 en los dos temas.
5. **Solo arriba hay anillos.** Los rubros siguen con barras: en una lista
   de muchos renglones se comparan mejor de un vistazo.

## Alternativas descartadas

- **SVG con `stroke-dasharray`**: dibuja el mismo anillo, pero `h()` no
  crea elementos SVG (necesitan su espacio de nombres) y habría que añadir
  un ayudante solo para esto. CSS lo resuelve en unas 25 líneas.
- **Barras también arriba** (la "propuesta A" del prototipo): más compacta
  y sin técnica nueva. El usuario eligió los anillos al comparar las dos.
- **Una librería de gráficos**: las mismas razones del ADR 0016, y para
  dos anillos.

## Consecuencias

- Ninguna dependencia nueva. El dibujo son unas 25 líneas de CSS; lo que se
  prueba es la fracción que calcula `dashboard.js`.
- `conic-gradient` lo soportan Chrome, Safari y Firefox desde 2020-2021. En
  un navegador que no lo entienda no se ve el anillo, pero las cifras
  siguen ahí, que son el dato.
- Un anillo no muestra bien "cuánto me pasé": por eso lo excedido se dice
  con la palabra y el monto, no con el dibujo.
- Aprendí que un degradado con dos paradas en el mismo punto es un corte
  seco, y que así se dibuja un gráfico de torta o de anillo sin SVG.
