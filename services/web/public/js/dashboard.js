// El tablero del Mes a partir del resumen y los gastos de la API, sin DOM
// (spec 012, RF-5 a RF-9; spec 033, RF-11 a RF-19). Solo reorganiza lo que la
// API ya calculó: totales, las dos bolsas, un medidor por rubro con sus
// gastos, lo que quedó fuera del plan y las tarjetas. Ninguna regla de
// negocio vive aquí (principio 10): qué se gastó de cada bolsa lo dice el
// resumen, y qué gasto es no planeado, el `kind` de cada gasto.

import { monthName, shiftPeriod } from "./format.js";
import { isSavingsName } from "./withdrawals.js";

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

/** Cuánto se llena un medidor o un anillo: lo gastado sobre lo asignado,
 * entre 0 y 1. Sin nada asignado y con gasto, lleno. */
function fillOf(spent, assigned) {
  if (assigned > 0) return Math.min(Math.max(spent / assigned, 0), 1);
  return spent > 0 ? 1 : 0;
}

/** Una bolsa del Mes (spec 033, RF-12): excedida si lo que queda es negativo,
 * y entonces se llena entera (decisión 8). */
function bucket(key, assigned, spent, remaining) {
  const exceeded = remaining < 0;
  return { key, assigned, spent, remaining, exceeded, fill: exceeded ? 1 : fillOf(spent, assigned) };
}

/** "En el plan" y "Sin asignar", con las cifras del resumen. `null` si la
 * API es anterior a la 033 y no las trae: la web no las calcula. */
function buckets(total) {
  if (total.plan_remaining === undefined || total.unassigned_remaining === undefined) return null;
  return [
    bucket("plan", total.planned, total.plan_spent, total.plan_remaining),
    bucket("free", total.unassigned, total.spent_unplanned, total.unassigned_remaining),
  ];
}

/** Un rubro con su medidor (RF-8 de la 012; RF-15 y RF-16 de la 033): lleno
 * con lo gastado sobre lo planeado. `status` dice qué se escribe a la
 * derecha: "left" (queda), "done" (completo), "over" (excedido) o "saved"
 * (un rubro de Ahorro, que se aparta al planear). */
function item(row, expenses, saved) {
  let status = "left";
  if (saved) status = "saved";
  else if (row.spent > row.planned) status = "over";
  else if (row.planned > 0 && row.spent === row.planned) status = "done";
  return {
    id: row.id,
    name: row.name,
    planned: row.planned,
    spent: row.spent,
    remaining: row.remaining,
    fill: fillOf(row.spent, row.planned),
    status,
    expenses: expenses
      .filter((expense) => expense.kind === "item" && expense.budget_item_id === row.id)
      .map((expense) => ({
        id: expense.id,
        day: expense.spent_on,
        detail: expense.description ?? "",
        amount: expense.amount,
      })),
  };
}

/** Las categorías que tienen rubros en el mes, como rótulos sin cifras
 * (spec 033, decisión 3). Lo no planeado ya no va aquí: sale en "Fuera del
 * plan". En Ahorro, lo retirado del mes va aparte en `withdrawn` (spec 013,
 * RF-36). */
function categories(summary, expenses) {
  return summary.categories
    .map((category) => ({
      id: category.category_id,
      name: category.name,
      deleted: category.deleted,
      withdrawn: category.withdrawn ?? 0,
      items: summary.budget_items
        .filter((row) => row.category_id === category.category_id)
        .map((row) => item(row, expenses, isSavingsName(category.name))),
    }))
    .filter((category) => category.items.length > 0);
}

/** Los gastos del mes sin rubro, en el orden de la API, con lo gastado y lo
 * que quedó sin asignar (spec 033, RF-17). Sin descripción, el nombre es la
 * categoría. */
function unplanned(summary, expenses) {
  const names = new Map(summary.categories.map((row) => [row.category_id, row.name]));
  return {
    spent: summary.total.spent_unplanned,
    assigned: summary.total.unassigned,
    rows: expenses
      .filter((expense) => expense.kind === "unplanned")
      .map((expense) => {
        const category = names.get(expense.category_id) ?? "Sin categoría";
        return {
          id: expense.id,
          name: expense.description || category,
          category,
          day: expense.spent_on,
          amount: expense.amount,
        };
      }),
  };
}

/** Cada tarjeta con algo en el mes (RF-9). */
function cards(summary) {
  return summary.debts.map((debt) => ({
    id: debt.card_id,
    name: debt.name,
    deleted: debt.deleted,
    toPay: debt.to_pay,
    debt: debt.amount,
    estimated: debt.estimated,
    statement: debt.statement,
    hasStatement: debt.statement !== null,
    monthExpenses: sum(debt.month_expenses, (row) => row.amount),
    installments: debt.installments,
    prepayments: debt.prepayments,
  }));
}

/** El aviso tras copiar el plan, con los rubros que la API omitió por tener
 * la categoría eliminada (RF-11; RF-13 de la 008). */
export function copyNotice(period, skipped) {
  const done = `Se copió el plan de ${monthName(shiftPeriod(period, -1))} a ${monthName(period)}.`;
  if (!skipped.length) return done;
  const names = skipped.map((row) => `«${row.name}»`);
  if (skipped.length === 1) {
    return `${done} No se copió ${names[0]}: su categoría «${skipped[0].category}» está eliminada.`;
  }
  const list = `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
  return `${done} No se copiaron ${list}: sus categorías están eliminadas.`;
}

/** `expenses` son los gastos del mes de `GET /expenses`. Con una API anterior
 * a la 033 (sin las bolsas en el resumen o sin `kind` en los gastos),
 * `buckets` y `unplanned` son `null` y los rubros salen sin sus gastos. */
export function buildDashboard(summary, expenses = []) {
  const { total } = summary;
  const bags = buckets(total);
  const known = bags !== null && expenses.every((expense) => expense.kind !== undefined);
  const listed = known ? expenses : [];
  return {
    period: summary.period,
    totals: {
      income: total.income,
      planned: total.planned,
      debts: total.debts,
      spent: total.spent,
      unassigned: total.unassigned,
      balance: total.balance,
      cardsToPay: total.cards_to_pay,
    },
    buckets: bags,
    // Lo planeado por encima del ingreso: se dice con palabras bajo los
    // anillos.
    overPlanned: Math.max(-total.unassigned, 0),
    categories: categories(summary, listed),
    unplanned: known ? unplanned(summary, listed) : null,
    cards: cards(summary),
    empty: summary.incomes.length === 0 && summary.budget_items.length === 0,
  };
}
