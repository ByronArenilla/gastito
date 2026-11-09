// Compras con tarjeta sin DOM (spec 012, RF-24 a RF-26): qué meses se ofrecen
// para abonar y cómo se dice el efecto de un abono. Las cuotas las calcula la
// API; aquí solo se comparan el plan de antes y el de después (decisión 7).
import { formatMonth, formatPesos, monthName } from "./format.js";

/** Los meses con cuota y saldo después de ella (decisión 19 de la 009),
 * posteriores al último abono (decisión 18 de la 009). La API valida igual;
 * esta lista evita ofrecer meses que siempre fallan (decisión 16). */
export function prepaymentMonths(schedule) {
  const last = schedule.prepayments.map((row) => row.period).sort().at(-1) ?? "";
  return schedule.installments
    .filter((row) => row.balance_after > 0 && row.period > last)
    .map((row) => row.period);
}

/** "marzo", o "marzo 2027" si los dos meses que se comparan son de años
 * distintos. */
function pair(a, b) {
  const sameYear = a.slice(0, 4) === b.slice(0, 4);
  const name = (period) => (sameYear ? monthName(period) : formatMonth(period));
  return [name(a), name(b)];
}

/** El efecto de un abono, comparando el plan de antes con el de después
 * (RF-25): con "plazo", en qué mes termina; con "cuota", la cuota siguiente. */
export function prepaymentEffect(before, after, prepayment) {
  const later = after.installments.filter((row) => row.period > prepayment.period);
  if (!later.length) return `La compra queda saldada en ${monthName(prepayment.period)}.`;

  if (prepayment.reduces === "term") {
    const [now, was] = pair(after.installments.at(-1).period, before.installments.at(-1).period);
    return `Ahora termina en ${now}, no en ${was}.`;
  }
  const next = later[0];
  const previous = before.installments.find((row) => row.period === next.period);
  return `Ahora la cuota de ${monthName(next.period)} es ${formatPesos(next.amount)}, no ${formatPesos(previous.amount)}.`;
}
