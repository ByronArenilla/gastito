// El inicio guiado, sin DOM: qué dice del mes y de las tarjetas a partir del
// resumen de la API. Solo reordena cifras que la API ya calculó.
import { formatPesos, monthName } from "./format.js";

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `summary` es el resumen del mes actual, o `null` si no se pudo pedir: el
 * inicio se muestra igual, sin estas frases. `start` marca el Mes como el
 * primer paso cuando todavía no tiene plan. */
export function homeStatus(summary) {
  if (!summary) return { start: false, month: null, cards: null };
  const name = monthName(summary.period);
  const { total } = summary;
  const empty = summary.incomes.length === 0 && summary.budget_items.length === 0;
  return {
    start: empty,
    month: empty
      ? `${capitalize(name)} todavía no tiene plan.`
      : `Llevas ${formatPesos(total.spent)} de ${formatPesos(total.planned)} planeados en ${name}.`,
    cards: total.cards_to_pay > 0 ? `A pagar en ${name}: ${formatPesos(total.cards_to_pay)}.` : null,
  };
}
