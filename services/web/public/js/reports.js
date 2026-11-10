// Reportes, sin DOM (spec 013): el mes elegido, la ventana de "¿Estoy
// ahorrando?" y lo que dice y dibuja cada reporte. Todo sale de la respuesta
// de `GET reports`: aquí no se calcula ninguna regla de negocio (principio
// 10), solo frases, orden de las tintas y escalas.
import { formatPesos, monthName, shiftPeriod } from "./format.js";

/** Ventanas de "¿Estoy ahorrando?", que terminan en el mes elegido (RF-2). */
export const SAVINGS_WINDOWS = [
  { months: 1, label: "1 mes" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "12 meses" },
];

/** Si se puede ir al mes anterior y al siguiente: nunca antes del primer mes
 * con datos ni al mes en curso, que está a medias (RF-3). */
export function monthBounds(period, firstPeriod, current) {
  return {
    previous: firstPeriod !== null && period > firstPeriod,
    next: firstPeriod !== null && shiftPeriod(period, 1) < current,
  };
}

// --- Frases y filas ---


/** "48 %", con espacio duro: la cifra y el signo no se separan. */
export function percentText(value) {
  return value === null || value === undefined ? "—" : `${value < 0 ? "−" : ""}${Math.abs(value)} %`;
}

/** "+$ 85.000", "−$ 20.000" o "justo". */
function signedPesos(value) {
  if (value === 0) return "justo";
  return value > 0 ? `+${formatPesos(value)}` : formatPesos(value);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** La frase como texto, para el lector de pantalla y los tests: las partes
 * `{ figure }` son la cifra que la vista pone en monoespaciada (RF-4). */
export function answerText(parts) {
  return parts.map((part) => (typeof part === "string" ? part : part.figure)).join("");
}

function emptyMonth(period) {
  return `${capitalize(monthName(period))} no tiene datos.`;
}

/** Las seis categorías con más gasto toman las tintas 1 a 6 por ese orden;
 * el resto se suma en "Otras". "Cuotas de tarjetas" va en la tinta del
 * texto (RF-17, plan 013). Ningún monto cambia: solo se agrupan. */
export function groupLines(lines) {
  const categories = lines.filter((line) => line.kind === "category");
  const named = new Set(categories.slice(0, 6));
  const rest = categories.slice(6);
  const rows = [];
  for (const line of lines) {
    if (line.kind === "debts") rows.push({ ...line, tint: "tint-debts" });
    else if (named.has(line)) rows.push({ ...line, tint: `tint-${rows.filter((row) => row.kind === "category").length + 1}` });
  }
  if (rest.length) {
    rows.push({
      kind: "other",
      name: `Otras (${rest.length})`,
      total: rest.reduce((sum, line) => sum + line.total, 0),
      share: rest.reduce((sum, line) => sum + line.share, 0),
      tint: "tint-other",
    });
  }
  return rows;
}

/** ¿En qué se me va la plata? en el mes (RF-14, RF-15, RF-31). */
export function spendingReport(reports) {
  const data = reports.spending;
  if (!reports.has_data || !data.lines.length) return { empty: emptyMonth(reports.period) };
  const top = data.lines[0];
  const who = top.kind === "debts" ? "las cuotas de tarjetas se llevan" : `${top.name} se lleva`;
  const unplanned = data.unplanned
    ? ` El ${percentText(data.unplanned_share)} fue no planeado: ${formatPesos(data.unplanned)}.`
    : " Todo estuvo planeado.";
  const saved = data.saved
    ? ` Además, apartaste ${formatPesos(data.saved)} en Ahorro${data.withdrawn ? ` y retiraste ${formatPesos(data.withdrawn)}` : ""}.`
    : "";
  return {
    empty: null,
    answer: [`En ${monthName(reports.period)}, ${who} el `, { figure: percentText(top.share) }, " de lo que gastaste."],
    sub: `${formatPesos(data.total)} gastados.${unplanned}${saved}`,
    rows: groupLines(data.lines).map((line) => ({
      name: line.deleted ? `${line.name} (eliminada)` : line.name,
      amount: line.total,
      figure: formatPesos(line.total),
      share: percentText(line.share),
      tint: line.tint,
    })),
  };
}

/** ¿Planeo bien? en el mes (RF-18 a RF-20). */
export function planningReport(reports) {
  const items = reports.planning.items;
  if (!reports.has_data || !items.length) return { empty: emptyMonth(reports.period) };
  const rubros = items.filter((row) => row.kind === "item");
  const unplanned = items.filter((row) => row.kind === "unplanned");
  const over = rubros.filter((row) => row.diff > 0).length;
  const under = rubros.filter((row) => row.diff < 0).length;
  const sub = [
    `${over} de ${rubros.length} rubros ${over === 1 ? "se pasó" : "se pasaron"}; ${under} ${under === 1 ? "sobró" : "sobraron"}.`,
    unplanned.length
      ? ` Hubo gastos sin rubro en ${unplanned.length} ${unplanned.length === 1 ? "categoría" : "categorías"}.`
      : "",
  ].join("");
  const top = items[0];
  let answer;
  if (top.diff <= 0) answer = ["Ningún rubro se pasó de lo planeado."];
  else if (top.kind === "unplanned") answer = [`En ${top.name} gastaste `, { figure: formatPesos(top.diff) }, " sin rubro."];
  else answer = [`${top.name} se pasó `, { figure: formatPesos(top.diff) }, " de lo planeado."];
  return {
    empty: null,
    answer,
    sub,
    rows: items.map((row) => ({
      name: row.name,
      category: row.category,
      unplanned: row.kind === "unplanned",
      planned: row.planned,
      spent: row.spent,
      value: row.diff,
      figure: signedPesos(row.diff),
    })),
  };
}
