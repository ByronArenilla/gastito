// El inicio guiado: las frases del mes y de las tarjetas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPesos } from "../public/js/format.js";
import { homeStatus } from "../public/js/home.js";

const summary = (changes = {}) => ({
  period: "2026-11",
  incomes: [{ id: 1, name: "Salario", amount: 4000000 }],
  budget_items: [{ id: 1, name: "Mercado", planned: 900000, spent: 52000 }],
  total: { spent: 52000, planned: 900000, balance: 3948000, cards_to_pay: 0 },
  ...changes,
});

test("un mes con plan dice cuánto queda (spec 033, RF-22)", () => {
  assert.deepEqual(homeStatus(summary()), {
    start: false,
    month: `Te quedan ${formatPesos(3948000)} en noviembre.`,
    cards: null,
  });
});

test("si se gastó más de lo que ingresa, lo dice con palabras", () => {
  const status = homeStatus(summary({ total: { spent: 4120000, planned: 900000, balance: -120000, cards_to_pay: 0 } }));

  assert.equal(status.month, `Te pasaste por ${formatPesos(120000)} en noviembre.`);
});

test("con el saldo en cero, no queda nada", () => {
  const status = homeStatus(summary({ total: { spent: 4000000, planned: 900000, balance: 0, cards_to_pay: 0 } }));

  assert.equal(status.month, `Te quedan ${formatPesos(0)} en noviembre.`);
});

test("un mes sin ingresos ni rubros es el primer paso", () => {
  const status = homeStatus(summary({ incomes: [], budget_items: [] }));

  assert.equal(status.start, true);
  assert.equal(status.month, "Noviembre todavía no tiene plan.");
});

test("si hay que pagarle a las tarjetas, lo dice", () => {
  const status = homeStatus(summary({ total: { spent: 0, planned: 0, balance: 0, cards_to_pay: 310000 } }));

  assert.equal(status.cards, `A pagar en noviembre: ${formatPesos(310000)}.`);
});

test("sin resumen, el inicio se muestra sin frases", () => {
  assert.deepEqual(homeStatus(null), { start: false, month: null, cards: null });
});
