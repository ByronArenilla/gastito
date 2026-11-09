// Compras con tarjeta sin navegador: los meses que se ofrecen para abonar y
// el efecto de un abono (spec 012, RF-25, decisiones 7 y 16).
import { test } from "node:test";
import assert from "node:assert/strict";
import { prepaymentEffect, prepaymentMonths } from "../public/js/purchases.js";

const cuota = (number, count, period, amount, balanceAfter) => ({
  number,
  count,
  period,
  capital: 300000,
  interest: amount - 300000,
  amount,
  balance_after: balanceAfter,
});

// La "Compra TV": $ 1.800.000 a 6 cuotas desde diciembre, sin abonos.
const TV = {
  expense_id: 7,
  card_id: 1,
  installments: [
    cuota(1, 6, "2026-12", 334020, 1500000),
    cuota(2, 6, "2027-01", 328350, 1200000),
    cuota(3, 6, "2027-02", 322680, 900000),
    cuota(4, 6, "2027-03", 317010, 600000),
    cuota(5, 6, "2027-04", 311340, 300000),
    cuota(6, 6, "2027-05", 305670, 0),
  ],
  prepayments: [],
};

// Con un abono de $ 600.000 en enero que baja el plazo: termina en marzo.
const TV_TERM = {
  ...TV,
  installments: [
    cuota(1, 4, "2026-12", 334020, 1500000),
    cuota(2, 4, "2027-01", 328350, 600000),
    cuota(3, 4, "2027-02", 311340, 300000),
    cuota(4, 4, "2027-03", 305670, 0),
  ],
  prepayments: [{ id: 1, expense_id: 7, period: "2027-01", amount: 600000, reduces: "term" }],
};

// El mismo abono bajando la cuota: sigue hasta mayo con cuotas menores.
const TV_INSTALLMENT = {
  ...TV,
  installments: [
    cuota(1, 6, "2026-12", 334020, 1500000),
    cuota(2, 6, "2027-01", 328350, 600000),
    { ...cuota(3, 6, "2027-02", 161340, 450000), capital: 150000 },
    { ...cuota(4, 6, "2027-03", 158505, 300000), capital: 150000 },
    { ...cuota(5, 6, "2027-04", 155670, 150000), capital: 150000 },
    { ...cuota(6, 6, "2027-05", 152835, 0), capital: 150000 },
  ],
  prepayments: [{ id: 1, expense_id: 7, period: "2027-01", amount: 600000, reduces: "installment" }],
};

test("sin abonos, se ofrecen los meses con cuota y saldo después (decisión 19 de la 009)", () => {
  assert.deepEqual(prepaymentMonths(TV), ["2026-12", "2027-01", "2027-02", "2027-03", "2027-04"]);
});

test("con un abono en enero, solo los meses posteriores (decisión 18 de la 009)", () => {
  assert.deepEqual(prepaymentMonths(TV_TERM), ["2027-02"]);
});

test("una compra saldada no ofrece meses", () => {
  const paid = { ...TV, installments: [cuota(1, 1, "2026-12", 300000, 0)] };
  assert.deepEqual(prepaymentMonths(paid), []);
});

test("un abono que baja el plazo dice en qué mes termina ahora", () => {
  assert.equal(prepaymentEffect(TV, TV_TERM, { period: "2027-01", reduces: "term" }), "Ahora termina en marzo, no en mayo.");
});

test("un abono que baja la cuota dice la cuota nueva", () => {
  assert.equal(
    prepaymentEffect(TV, TV_INSTALLMENT, { period: "2027-01", reduces: "installment" }),
    "Ahora la cuota de febrero es $ 161.340, no $ 322.680.",
  );
});

test("un abono por todo el saldo dice que la compra queda saldada", () => {
  const settled = { ...TV, installments: TV.installments.slice(0, 2).map((row, index) => ({ ...row, balance_after: index ? 0 : row.balance_after })) };
  assert.equal(
    prepaymentEffect(TV, settled, { period: "2027-01", reduces: "term" }),
    "La compra queda saldada en enero.",
  );
});

test("si el plan termina en otro año, el mes lleva el año", () => {
  const long = { ...TV, installments: [...TV.installments, cuota(7, 7, "2028-01", 300000, 0)] };
  assert.equal(prepaymentEffect(long, TV_TERM, { period: "2027-01", reduces: "term" }), "Ahora termina en marzo 2027, no en enero 2028.");
});
