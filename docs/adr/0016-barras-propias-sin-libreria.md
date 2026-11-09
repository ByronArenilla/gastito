# ADR 0016 — Barras propias con CSS, sin librería de gráficos

- Fecha: 2026-11-09
- Estado: aceptada
- Fase / spec: 1 / 012-tablero-y-planear

## Contexto

El tablero del Mes de la 012 necesita dos gráficos: una barra que reparte el
ingreso en rubros, deudas y sin asignar, y un medidor por rubro con lo
gastado sobre lo planeado (decisiones 4 y 15 de la spec). El roadmap dejaba
entrar Chart.js solo si la spec lo justificaba.

Restricciones:

- **La CSP de la 011** solo deja cargar scripts, estilos y fuentes propios
  (`style-src 'self'`), sin estilos en línea en el HTML (ADR 0015). Una
  librería tendría que servirse desde la propia web (RF-39 de la 011).
- **La web no tiene `npm` ni compilación** (ADR 0015, principio 2): una
  dependencia es un archivo más que se descarga a mano y se actualiza a
  mano.
- **Accesibilidad** (RF-31 a RF-35 de la 011): el lector de pantalla tiene
  que poder leer lo mismo que se ve, y el color no puede ser la única pista
  (lo excedido lleva palabra y signo).

## Decisión

1. **Las barras son `<div>` con CSS propio.** El ancho de cada parte llega
   como una propiedad personalizada (`--grow`, `--fill`) que la vista fija
   con `element.style.setProperty`, y el CSS la usa en `flex-grow` o en
   `inline-size: calc(var(--fill) * 100%)`. La CSP permite cambiar estilos
   así desde un módulo propio; lo que bloquea es el atributo `style` escrito
   en el HTML.
2. **Las cifras van siempre escritas junto a la barra**, y las barras se
   ocultan al lector de pantalla con `aria-hidden="true"`. La barra ayuda a
   ver; la cifra es el dato. La leyenda de la barra del ingreso tiene una
   muestra, el nombre y el monto de cada parte.
3. **El contraste de las barras lo comprueba `contrast.test.js`**: cada
   parte llena contra lo que toca pasa 3:1 en los dos temas
   ([WCAG 1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
   Por eso la separación de 2 px entre partes es papel y no el fondo de la
   barra: en el tema oscuro, tinta contra `--rule-strong` daba 2,9:1.

## Alternativas descartadas

- **Chart.js**: unos 200 KB para dibujar rectángulos horizontales de una
  sola medida, sin ejes. Habría que servirlo desde la web y actualizarlo a
  mano, y su `<canvas>` no se lee con un lector de pantalla sin trabajo
  extra.
- **SVG generado desde JavaScript**: permite formas más libres, pero para
  barras horizontales es más código que dos reglas de CSS y no añade nada.
  Queda como opción si una spec futura pide gráficos de varios meses.
- **Solo cifras, sin barras** (opción "solo cifras" de la clarificación):
  lo más simple, pero los excesos se leen peor de un vistazo.

## Consecuencias

- Ninguna dependencia nueva: las barras son unas 60 líneas de CSS y una
  función de 3 líneas. Lo que se prueba es la lógica de `dashboard.js` (qué
  parte mide cuánto), no el dibujo.
- Un gráfico de tiempo (el ritmo del mes, varios meses) no cabe en este
  enfoque. Si llega, se decide en su spec con otro ADR.
- Aprendí que la CSP distingue entre el atributo `style` (bloqueado sin
  `'unsafe-inline'`) y la propiedad `style` cambiada desde un script propio
  (permitida), y a medir el contraste de lo que no es texto.
