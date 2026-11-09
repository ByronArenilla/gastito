// Tarjetas sin DOM (spec 012, RF-19 a RF-23): lo que envía el formulario,
// cómo se describe una tarjeta y una compra, y los textos de pagar todo. Las
// reglas (días válidos, tasa, qué compras se saldan) son de la API.
import { formatPesos, monthName } from "./format.js";

/** Un día escrito como entero; `null` si no hay dígitos. Uno fuera de rango
 * se envía tal cual y la API dice por qué no vale. */
function day(text) {
  const digits = String(text).replace(/\D/g, "");
  return digits ? Number.parseInt(digits, 10) : null;
}

/** La tasa mensual en porcentaje: "1,89" → 1.89; vacía → `null` (es
 * opcional). Lo que no sea un número se envía tal cual, para que la API
 * responda con su mensaje (RF-3 de la 009). */
function rate(text) {
  const clean = String(text).trim();
  if (!clean) return null;
  const value = Number(clean.replace(",", "."));
  return Number.isFinite(value) ? value : clean;
}

/** `state` tiene lo escrito: `name`, `cutoffDay`, `dueDay` y `rate`.
 * `missing` usa los nombres de campo de la API, como los errores. */
export function cardForm(state) {
  const body = {
    name: state.name.trim(),
    cutoff_day: day(state.cutoffDay),
    due_day: day(state.dueDay),
    monthly_rate: rate(state.rate),
  };
  const missing = [
    !body.name && "name",
    body.cutoff_day === null && "cutoff_day",
    body.due_day === null && "due_day",
  ].filter(Boolean);
  return { body, missing };
}

/** "corte 25 · paga el 10 · 1,89 % mensual". */
export function cardLine(card) {
  const rateText =
    card.monthly_rate === null ? "sin tasa" : `${String(card.monthly_rate).replace(".", ",")} % mensual`;
  return `corte ${card.cutoff_day} · paga el ${card.due_day} · ${rateText}`;
}

/** Una compra con cuotas pendientes en el estado de la tarjeta (RF-21). */
export function purchaseMeta(purchase) {
  const kind = purchase.is_debt ? "deuda" : "gasto del mes";
  return `${kind} · cuota ${purchase.next_number} de ${purchase.count} · saldo ${formatPesos(purchase.balance)}`;
}

/** El diálogo de pagar todo: qué va a pasar (decisión 17; RF-29 y RF-30 de
 * la 009). */
export function payoffText(card, period) {
  const month = monthName(period);
  return (
    `Se crea un abono por todo el saldo de cada compra de «${card.name}» que ya está en ` +
    `el extracto de ${month}. Las compras posteriores al corte siguen llegando en su mes.`
  );
}

/** Lo que pasó después de pagar todo (RF-23). */
export function payoffResult(card, result) {
  const count = result.prepayments.length;
  const month = monthName(result.period);
  return (
    `Pagaste todo «${card.name}» en ${month} con ${count} ${count === 1 ? "abono" : "abonos"}. ` +
    `Deuda de ${month}: ${formatPesos(result.debt)}.`
  );
}
