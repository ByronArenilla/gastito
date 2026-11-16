// El inicio guiado, sin DOM: qué dice del mes y de las tarjetas a partir del
// resumen de la API. Solo reordena cifras que la API ya calculó.
import { formatPesos, monthName } from "./format.js";

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Lo que queda en el mes, la misma cifra principal del Mes (spec 033,
 * RF-22). Si se gastó más de lo que ingresa, se dice con palabras y no solo
 * con el signo. */
function leftText(balance, name) {
  return balance < 0
    ? `Te pasaste por ${formatPesos(-balance)} en ${name}.`
    : `Te quedan ${formatPesos(balance)} en ${name}.`;
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
      : leftText(total.balance, name),
    cards: total.cards_to_pay > 0 ? `A pagar en ${name}: ${formatPesos(total.cards_to_pay)}.` : null,
  };
}
