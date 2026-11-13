// El inicio guiado: las frases del mes y de las tarjetas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPesos } from "../public/js/format.js";
import { homeStatus } from "../public/js/home.js";

const summary = (changes = {}) => ({
  period: "2026-11",
  incomes: [{ id: 1, name: "Salario", amount: 4000000 }],
  budget_items: [{ id: 1, name: "Mercado", planned: 900000, spent: 52000 }],
  total: { spent: 52000, planned: 900000, cards_to_pay: 0 },
  ...changes,
});

test("un mes con plan dice cuánto se lleva gastado de lo planeado", () => {
  assert.deepEqual(homeStatus(summary()), {
    start: false,
    month: `Llevas ${formatPesos(52000)} de ${formatPesos(900000)} planeados en noviembre.`,
    cards: null,
  });
});

test("un mes sin ingresos ni rubros es el primer paso", () => {
  const status = homeStatus(summary({ incomes: [], budget_items: [] }));

  assert.equal(status.start, true);
  assert.equal(status.month, "Noviembre todavía no tiene plan.");
});

test("si hay que pagarle a las tarjetas, lo dice", () => {
  const status = homeStatus(summary({ total: { spent: 0, planned: 0, cards_to_pay: 310000 } }));

  assert.equal(status.cards, `A pagar en noviembre: ${formatPesos(310000)}.`);
});

test("sin resumen, el inicio se muestra sin frases", () => {
  assert.deepEqual(homeStatus(null), { start: false, month: null, cards: null });
});
