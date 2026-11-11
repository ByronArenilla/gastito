// El tablero del Mes a partir del resumen de la API, sin DOM (spec 012, RF-5 a
// RF-9). Solo reorganiza lo que la API ya calculó: totales, la barra del
// ingreso, un medidor por rubro y las tarjetas. Ninguna regla de negocio vive
// aquí (principio 10).

import { monthName, shiftPeriod } from "./format.js";

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

/** Rubros, deudas y sin asignar como partes de una barra (RF-6). Si lo
 * planeado supera el ingreso, `over` dice por cuánto y las partes se reparten
 * sobre lo planeado. */
function incomeBar(total) {
  const items = total.planned - total.debts;
  const free = Math.max(total.unassigned, 0);
  const whole = Math.max(total.income, total.planned);
  const share = (amount) => (whole > 0 ? amount / whole : 0);
  return {
    parts: [
      { key: "items", amount: items, share: share(items) },
      { key: "debts", amount: total.debts, share: share(total.debts) },
      { key: "free", amount: free, share: share(free) },
    ],
    over: Math.max(total.planned - total.income, 0),
  };
}

/** Un rubro con su medidor (RF-8): lleno con lo gastado sobre lo planeado;
 * excedido si gastó más. Con planeado 0 y gasto, lleno y excedido. */
function item(row) {
  const exceeded = row.spent > row.planned;
  const fill = row.planned > 0 ? Math.min(row.spent / row.planned, 1) : row.spent > 0 ? 1 : 0;
  return {
    id: row.id,
    name: row.name,
    planned: row.planned,
    spent: row.spent,
    remaining: row.remaining,
    fill,
    exceeded,
  };
}

/** Las categorías del mes con sus rubros dentro y lo no planeado como "sin
 * rubro" (RF-7, decisión 8). Las que no tienen rubros ni gastos no salen.
 * En Ahorro, `spent` ya descuenta lo retirado del ahorro, que va aparte en
 * `withdrawn` (spec 013, RF-36); lo sin rubro se mide antes de descontarlo. */
function categories(summary) {
  return summary.categories
    .map((category) => {
      const items = summary.budget_items
        .filter((row) => row.category_id === category.category_id)
        .map(item);
      return {
        id: category.category_id,
        name: category.name,
        deleted: category.deleted,
        planned: category.planned,
        spent: category.spent,
        exceeded: category.spent > category.planned,
        items,
        withdrawn: category.withdrawn ?? 0,
        unplanned: Math.max(
          category.spent + (category.withdrawn ?? 0) - sum(items, (row) => row.spent),
          0,
        ),
      };
    })
    .filter((category) => category.items.length > 0 || category.spent > 0);
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

export function buildDashboard(summary) {
  const { total } = summary;
  return {
    period: summary.period,
    totals: {
      income: total.income,
      planned: total.planned,
      spent: total.spent,
      unassigned: total.unassigned,
      balance: total.balance,
      cardsToPay: total.cards_to_pay,
    },
    incomeBar: incomeBar(total),
    categories: categories(summary),
    cards: cards(summary),
    empty: summary.incomes.length === 0 && summary.budget_items.length === 0,
  };
}
