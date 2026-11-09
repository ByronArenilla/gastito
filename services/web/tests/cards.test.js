// Tarjetas sin navegador: formulario, cómo se describe una tarjeta y una
// compra, y los textos de pagar todo (spec 012, RF-19 a RF-23).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardForm, cardLine, payoffResult, payoffText, purchaseMeta } from "../public/js/cards.js";

test("el formulario envía días enteros y la tasa con coma como número", () => {
  const form = cardForm({ name: " Visa ", cutoffDay: "25", dueDay: "10", rate: "1,89" });

  assert.deepEqual(form, {
    body: { name: "Visa", cutoff_day: 25, due_day: 10, monthly_rate: 1.89 },
    missing: [],
  });
});

test("sin tasa se envía null: la tasa es opcional", () => {
  assert.equal(cardForm({ name: "Master", cutoffDay: "5", dueDay: "20", rate: " " }).body.monthly_rate, null);
});

test("los días fuera de rango se envían tal cual: los valida la API", () => {
  assert.equal(cardForm({ name: "Visa", cutoffDay: "32", dueDay: "10", rate: "" }).body.cutoff_day, 32);
});

test("una tasa que no es número llega tal cual, para que la API diga por qué", () => {
  assert.equal(cardForm({ name: "Visa", cutoffDay: "25", dueDay: "10", rate: "uno" }).body.monthly_rate, "uno");
});

test("sin nombre ni días, el formulario dice qué falta", () => {
  assert.deepEqual(cardForm({ name: "", cutoffDay: "", dueDay: "10", rate: "" }).missing, [
    "name",
    "cutoff_day",
  ]);
});

test("la línea de una tarjeta: corte, pago y tasa", () => {
  assert.equal(
    cardLine({ cutoff_day: 25, due_day: 10, monthly_rate: 1.89 }),
    "corte 25 · paga el 10 · 1,89 % mensual",
  );
  assert.equal(cardLine({ cutoff_day: 5, due_day: 20, monthly_rate: null }), "corte 5 · paga el 20 · sin tasa");
  assert.equal(cardLine({ cutoff_day: 5, due_day: 20, monthly_rate: 2 }), "corte 5 · paga el 20 · 2 % mensual");
});

test("una compra pendiente: deuda o del mes, cuota siguiente y saldo", () => {
  assert.equal(
    purchaseMeta({ is_debt: true, next_number: 1, count: 6, balance: 1800000 }),
    "deuda · cuota 1 de 6 · saldo $ 1.800.000",
  );
  assert.equal(
    purchaseMeta({ is_debt: false, next_number: 1, count: 1, balance: 150000 }),
    "gasto del mes · cuota 1 de 1 · saldo $ 150.000",
  );
});

test("pagar todo dice qué va a pasar antes de confirmar (decisión 17)", () => {
  const text = payoffText({ name: "Visa" }, "2026-11");

  assert.match(text, /«Visa»/);
  assert.match(text, /noviembre/);
  assert.match(text, /abono/);
  assert.match(text, /siguen llegando/);
});

test("pagar todo dice cuántos abonos creó y la deuda que queda", () => {
  assert.equal(
    payoffResult({ name: "Visa" }, { period: "2026-11", prepayments: [{}, {}], debt: 2011340 }),
    "Pagaste todo «Visa» en noviembre con 2 abonos. Deuda de noviembre: $ 2.011.340.",
  );
  assert.equal(
    payoffResult({ name: "Visa" }, { period: "2026-11", prepayments: [{}], debt: 0 }),
    "Pagaste todo «Visa» en noviembre con 1 abono. Deuda de noviembre: $ 0.",
  );
});
