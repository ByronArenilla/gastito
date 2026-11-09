// Qué envía cada renglón de Planear, sin DOM (spec 012, RF-13 a RF-17,
// decisiones 5, 13 y 14). Un renglón se guarda al salir de él: aquí se decide
// si se crea, si se cambia solo lo que cambió, o si no se envía y qué falta.
import { parseAmount } from "./format.js";

const NOTHING = { action: "none", body: null, missing: [] };

/** Lo escrito en un renglón, limpio: nombre sin espacios alrededor, la
 * categoría como número y el monto como entero de pesos (o `null`). */
function clean(kind, row) {
  const values = { name: row.name.trim(), amount: parseAmount(row.amount) };
  if (kind === "item") values.categoryId = row.categoryId ? Number(row.categoryId) : null;
  return values;
}

function missingOf(kind, values) {
  return [
    !values.name && "nombre",
    kind === "item" && values.categoryId === null && "categoría",
    values.amount === null && "monto",
  ].filter(Boolean);
}

/** `kind` es "item" (rubro) o "income" (ingreso). `original` es `null` en un
 * renglón nuevo, o `{ id, name, categoryId, amount }` en uno guardado. */
export function rowRequest(kind, original, row, period) {
  const values = clean(kind, row);
  const missing = missingOf(kind, values);
  const blank = !values.name && values.amount === null && !values.categoryId;

  if (original === null) {
    // Un renglón nuevo que sigue vacío no es un error: solo no se crea.
    if (blank) return NOTHING;
    if (missing.length) return { action: "none", body: null, missing };
    const body = { period, name: values.name, amount: values.amount };
    if (kind === "item") body.category_id = values.categoryId;
    return { action: "create", body: orderedBody(kind, body), missing: [] };
  }

  // Un campo vaciado en un renglón guardado no se envía: la API lo rechazaría.
  if (missing.length) return { action: "none", body: null, missing };
  const body = {};
  if (values.name !== original.name) body.name = values.name;
  if (kind === "item" && values.categoryId !== original.categoryId) {
    body.category_id = values.categoryId;
  }
  if (values.amount !== original.amount) body.amount = values.amount;
  if (!Object.keys(body).length) return NOTHING;
  return { action: "update", body, missing: [] };
}

function orderedBody(kind, body) {
  const { period, name, amount } = body;
  return kind === "item" ? { period, name, category_id: body.category_id, amount } : { period, name, amount };
}

/** "Falta: categoría y monto. No se ha guardado." (decisión 13). */
export function missingText(missing) {
  const list =
    missing.length > 1 ? `${missing.slice(0, -1).join(", ")} y ${missing.at(-1)}` : missing[0];
  return `Falta: ${list}. No se ha guardado.`;
}

/** Quitar un rubro que ya tiene gastos pide confirmación: sus gastos quedan
 * sin rubro (decisión 14; RF-8 de la 008). */
export function needsConfirm(item) {
  return item.spent > 0;
}

/** El valor real del extracto de una tarjeta en el mes (RF-17): escrito se
 * guarda; vacío, si había uno, se quita; igual al guardado, nada. `saved` es
 * el valor guardado o `null`. */
export function statementRequest(saved, text) {
  const value = parseAmount(text);
  if (value === null) return saved === null ? { action: "none", body: null } : { action: "delete", body: null };
  if (value === saved) return { action: "none", body: null };
  return { action: "put", body: { amount: value } };
}
