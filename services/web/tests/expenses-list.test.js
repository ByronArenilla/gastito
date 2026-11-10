// Gastos del mes: agrupar por día, total, "solo los míos" y el texto de cada
// gasto (spec 011, RF-17 a RF-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeExpense, groupByDay, onlyMine, totalOf } from "../public/js/expenses-list.js";

// Como los devuelve la API: del día más reciente al más antiguo.
const EXPENSES = [
  { id: 4, amount: 38000, spent_on: "2026-11-06", created_by: 1, payment_type: "debit", category_id: 3, budget_item_id: null, description: "Taxi", card_id: null },
  { id: 3, amount: 1200000, spent_on: "2026-11-05", created_by: 2, payment_type: "credit", category_id: 1, budget_item_id: null, description: "Compra TV", card_id: 1, installments: 6, is_debt: true, first_due_period: "2026-12" },
  { id: 2, amount: 200000, spent_on: "2026-11-05", created_by: 1, payment_type: "credit", category_id: 2, budget_item_id: 1, description: null, card_id: 1, installments: 1, is_debt: false, first_due_period: "2026-12" },
  { id: 1, amount: 52000, spent_on: "2026-11-02", created_by: 1, payment_type: "debit", category_id: 2, budget_item_id: 1, description: null, card_id: null },
];

const NAMES = {
  items: new Map([[1, "Mercado"]]),
  categories: new Map([[1, "Hogar"], [2, "Comida"], [3, "Transporte"]]),
  cards: new Map([[1, "Visa"]]),
};

test("agrupa por día en el orden de la API", () => {
  const groups = groupByDay(EXPENSES);

  assert.deepEqual(
    groups.map((group) => [group.day, group.expenses.map((expense) => expense.id)]),
    [
      ["2026-11-06", [4]],
      ["2026-11-05", [3, 2]],
      ["2026-11-02", [1]],
    ],
  );
});

test("el total del mes listado", () => {
  assert.equal(totalOf(EXPENSES), 1490000);
  assert.equal(totalOf([]), 0);
});

test("solo los míos deja los que registró quien usa la app", () => {
  assert.deepEqual(
    onlyMine(EXPENSES, 1).map((expense) => expense.id),
    [4, 2, 1],
  );
});

test("el texto de cada gasto: nombre, categoría y cómo se pagó (RF-18)", () => {
  const [taxi, tv, mercadoVisa, mercado] = EXPENSES.map((expense) =>
    describeExpense(expense, NAMES, 1),
  );

  assert.deepEqual(taxi, { name: "Taxi", meta: "Transporte · Débito" });
  assert.deepEqual(tv, {
    name: "Compra TV",
    meta: "Hogar · Visa · deuda · 6 cuotas desde dic · registró otro miembro",
  });
  assert.deepEqual(mercadoVisa, { name: "Mercado", meta: "Comida · Visa · del mes · se paga en dic" });
  assert.deepEqual(mercado, { name: "Mercado", meta: "Comida · Débito" });
});

test("una deuda a 1 cuota y un crédito sin tarjeta de antes de la 009", () => {
  const oneDebt = { ...EXPENSES[1], installments: 1 };
  const legacy = { ...EXPENSES[0], payment_type: "credit" };

  assert.equal(
    describeExpense(oneDebt, NAMES, 2).meta,
    "Hogar · Visa · deuda · 1 cuota en dic",
  );
  assert.equal(describeExpense(legacy, NAMES, 1).meta, "Transporte · Crédito");
});

test("sin descripción ni rubro, el nombre es la categoría", () => {
  const plain = { ...EXPENSES[0], description: null };

  assert.equal(describeExpense(plain, NAMES, 1).name, "Transporte");
});

// --- Retiros de ahorro en la lista (spec 013, RF-35) ---

import { describeWithdrawal, mergeWithdrawals, withdrawnOf } from "../public/js/expenses-list.js";

const DATED = [
  { id: 7, amount: 200000, spent_on: "2026-08-14", created_at: "2026-08-14T15:00:00Z", created_by: 1 },
  { id: 6, amount: 500000, spent_on: "2026-08-03", created_at: "2026-08-03T12:00:00Z", created_by: 1 },
];
const WITHDRAWALS = [
  { id: 2, amount: 200000, spent_on: "2026-08-14", created_at: "2026-08-14T15:05:00Z", created_by: 2, description: "Urgencia médica" },
];

test("los retiros se mezclan con los gastos por fecha, el más reciente primero", () => {
  const rows = mergeWithdrawals(DATED, WITHDRAWALS);

  assert.deepEqual(
    rows.map((row) => [row.kind, row.id]),
    [
      ["withdrawal", 2],
      ["expense", 7],
      ["expense", 6],
    ],
  );
  assert.deepEqual(
    groupByDay(rows).map((group) => group.day),
    ["2026-08-14", "2026-08-03"],
  );
});

test("el total de gastos no cuenta los retiros, que se suman aparte", () => {
  const rows = mergeWithdrawals(DATED, WITHDRAWALS);

  assert.equal(totalOf(rows), 700000);
  assert.equal(withdrawnOf(rows), 200000);
});

test("un retiro se describe con su nota y quién lo registró", () => {
  assert.deepEqual(describeWithdrawal(WITHDRAWALS[0], 1), {
    name: "Retiro de ahorro",
    meta: "Urgencia médica · registró otro miembro",
  });
  assert.deepEqual(describeWithdrawal({ ...WITHDRAWALS[0], description: null }, 2), {
    name: "Retiro de ahorro",
    meta: "Ahorro",
  });
});
