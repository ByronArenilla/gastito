// Retiros de ahorro, sin DOM (spec 013, RF-32, RF-33 y RF-35): el cuerpo que
// se envía, lo que se puede retirar en un mes y lo que cambió al editar. La
// regla del límite la aplica la API; aquí solo se avisa antes.
import { formatPesos, monthName, parseAmount } from "./format.js";

/** "Ahorro" con la comparación de nombres de la spec 002: mayúsculas, tildes
 * y espacios alrededor no cuentan. */
export function isSavingsName(name) {
  return name.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase() === "ahorro";
}

function amountOf(value) {
  return typeof value === "number" ? value : parseAmount(value ?? "");
}

/** Lo escrito (`amount`, `date` AAAA-MM-DD o `null`, `note`) → cuerpo de
 * `POST savings-withdrawals` y lo que falta. Sin fecha, la API usa hoy. */
export function withdrawalRequest(form) {
  const amount = amountOf(form.amount);
  const body = { amount };
  if (form.date) body.spent_on = form.date;
  const note = (form.note ?? "").trim();
  if (note) body.description = note;
  return { body, missing: amount === null ? ["Escribe el monto del retiro."] : [] };
}

/** Lo apartado, lo retirado y lo que queda por retirar en el mes del
 * resumen, con la frase que lo dice. El resumen ya descuenta lo retirado de
 * Ahorro (RF-36), así que lo apartado es `spent + withdrawn`. */
export function withdrawalRoom(summary) {
  const row = summary.categories.find((category) => isSavingsName(category.name));
  const withdrawn = row?.withdrawn ?? 0;
  const saved = row ? row.spent + withdrawn : 0;
  const room = Math.max(saved - withdrawn, 0);
  const month = monthName(summary.period);
  let text;
  if (!saved) {
    text = `En ${month} no has apartado nada en Ahorro: no hay de dónde retirar.`;
  } else if (!withdrawn) {
    text = `En ${month} apartaste ${formatPesos(saved)} y no has retirado nada: puedes retirar hasta ${formatPesos(room)}.`;
  } else {
    text = `En ${month} apartaste ${formatPesos(saved)} y ya retiraste ${formatPesos(withdrawn)}: puedes retirar hasta ${formatPesos(room)}.`;
  }
  return { saved, withdrawn, room, text };
}

/** Solo lo que cambió de un retiro, para `PATCH` (como al editar un gasto). */
export function withdrawalChanges(original, form) {
  const changes = {};
  const amount = amountOf(form.amount);
  if (amount !== original.amount) changes.amount = amount;
  if (form.date && form.date !== original.spent_on) changes.spent_on = form.date;
  const note = (form.note ?? "").trim() || null;
  if (note !== original.description) changes.description = note;
  return changes;
}
