// Escalas de los gráficos de los reportes, sin DOM (spec 013, ADR 0017): qué
// fracción del alto o del ancho mide cada barra. Las vistas pasan estas
// fracciones a CSS como propiedades (`--size`, `--zero`, `--part`), igual que
// las barras del Mes (ADR 0016). Nunca se divide por cero.

/** Columnas desde una línea de cero. `zero` es la altura de esa línea desde
 * abajo (0 si no hay negativos) y cada tamaño, la fracción del alto total,
 * con el signo del valor. */
export function columnScale(values) {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min;
  return {
    // `0 - min` y no `-min`: con `min` en 0 daría -0.
    zero: span ? (0 - min) / span : 0,
    sizes: values.map((value) => (span ? value / span : 0)),
  };
}

/** Pilas: el alto de cada una sobre la más alta y sus partes como fracción
 * de su propia pila. */
export function stackScale(stacks) {
  const totals = stacks.map((parts) => parts.reduce((sum, part) => sum + part, 0));
  const max = Math.max(0, ...totals);
  return stacks.map((parts, index) => ({
    size: max ? totals[index] / max : 0,
    parts: parts.map((part) => (totals[index] ? part / totals[index] : 0)),
  }));
}

/** Barras divergentes (RF-19): lo que se pasa y lo que sobra se miden con el
 * mismo máximo, para que una barra de un lado y otra del otro se comparen. */
export function divergentScale(values) {
  const max = Math.max(0, ...values.map(Math.abs));
  return values.map((value) => ({
    side: value > 0 ? "over" : value < 0 ? "under" : "zero",
    size: max ? Math.abs(value) / max : 0,
  }));
}

/** Barras horizontales: cada una sobre la mayor. */
export function barScale(values) {
  const max = Math.max(0, ...values);
  return values.map((value) => (max ? value / max : 0));
}
