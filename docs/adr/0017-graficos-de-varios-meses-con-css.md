# ADR 0017 — Gráficos de varios meses con columnas de CSS

- Fecha: 2026-11-10
- Estado: aceptada
- Fase / spec: 1 / 013-reportes

## Contexto

La 013 trae tres reportes con gráficos. "¿En qué se me va la plata?" son
barras horizontales y "¿Planeo bien?", barras divergentes desde un cero, que
caben en el enfoque del ADR 0016. "¿Estoy ahorrando?" con 3, 6 o 12 meses
necesita lo que ese ADR dejó para esta spec: un gráfico de tiempo, con una
columna por mes, dos partes apiladas y valores negativos bajo una línea de
cero.

Restricciones:

- **La CSP de la 011** no deja estilos en línea en el HTML (ADR 0015); sí
  deja cambiar propiedades desde un script propio (ADR 0016).
- **Sin `npm` ni compilación** (ADR 0015, principio 2).
- **Accesibilidad** (RF-25 a RF-27 de la 013): contraste de 3:1, el color
  nunca como única pista, las cifras para el lector de pantalla, nada de
  animación con `prefers-reduced-motion`.
- **En el celular**, 12 meses tienen que caber sin desbordar la página y con
  el mes más reciente a la vista.

## Decisión

1. **Los gráficos de tiempo también son `<div>` con CSS**, como las barras
   del Mes. `charts.js` calcula las fracciones sin DOM (la línea de cero,
   el alto de cada columna, las partes de una pila) y la vista las pasa a
   CSS con `style.setProperty` (`--zero`, `--size`, `--part`). Cada mes es
   una columna de una cuadrícula (`grid-auto-flow: column`) de al menos 44
   px; en el celular, el contenedor se desplaza a lo ancho y empieza en el
   último mes.
2. **Las cifras están en la frase y en "Ver cifras"**, una tabla dentro de
   un `<details>` que se abre con teclado. El gráfico va con
   `aria-hidden="true"`. Tocar o pasar el puntero sobre una columna escribe
   su mes y su cifra en un renglón encima del gráfico.
3. **Las categorías se distinguen con seis "tintas de libro"** con su test
   de contraste y de separación con daltonismo simulado (Machado, Oliveira y
   Fernandes, 2009), y con el nombre siempre escrito.
4. **El movimiento** es un `@keyframes` de 200 ms dentro de
   `@media (prefers-reduced-motion: no-preference)`: sin esa preferencia
   no se anima nada.

## Alternativas descartadas

- **SVG generado desde JavaScript**: permite curvas y áreas, pero el texto
  escala con el `viewBox` (o hay que medir el contenedor y redibujar), y
  ningún reporte necesita una curva: el ahorro cambia una vez al mes, así
  que las columnas dicen la verdad. Es más código para el mismo dibujo.
- **Chart.js**: unos 200 KB servidos desde la web y actualizados a mano;
  su `<canvas>` no se lee con un lector de pantalla sin trabajo extra, y su
  estética no es la del Libro auxiliar.
- **`<canvas>` propio**: hay que dibujar el texto, medirlo y repetir el
  dibujo al cambiar el tamaño o el tema; nada de eso hace falta con CSS.

## Consecuencias

- Ninguna dependencia nueva. Lo que se prueba es la geometría de
  `charts.js` (`node --test`) y las frases de `reports.js`, no el dibujo;
  el dibujo se verifica a mano (`specs/013-reportes/verificacion.md`).
- Si un día hace falta un gráfico con curvas o muchos puntos, este enfoque
  no alcanza y se decide en su spec con otro ADR.
- Aprendí a medir la separación entre colores en OKLab, a simular el
  daltonismo para comprobarla y que un `-0` aparece cuando se escribe
  `-min` con `min` en 0.
