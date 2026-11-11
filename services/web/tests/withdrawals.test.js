// Retiros de ahorro, sin DOM (spec 013, RF-32, RF-33 y RF-35).
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPesos } from "../public/js/format.js";
import {
  isSavingsName,
  withdrawalChanges,
  withdrawalRequest,
  withdrawalRoom,
} from "../public/js/withdrawals.js";

test("el monto se escribe con puntos y la nota sin espacios alrededor", () => {
  const { body, missing } = withdrawalRequest({ amount: "200.000", date: "2026-08-14", note: "  Urgencia  " });

  assert.deepEqual(body, { amount: 200000, spent_on: "2026-08-14", description: "Urgencia" });
  assert.deepEqual(missing, []);
});

test("sin monto, falta; sin fecha ni nota, no se envían", () => {
  const { body, missing } = withdrawalRequest({ amount: "", date: null, note: " " });

  assert.deepEqual(body, { amount: null });
  assert.deepEqual(missing, ["Escribe el monto del retiro."]);
});

test("Ahorro se reconoce sin importar mayúsculas ni tildes", () => {
  assert.ok(isSavingsName("Ahorro"));
  assert.ok(isSavingsName(" AHORRO "));
  assert.ok(isSavingsName("Ahórro"));
  assert.equal(isSavingsName("Ahorros"), false);
});

const AUGUST = (ahorro) => ({
  period: "2026-08",
  categories: [{ category_id: 1, name: "Hogar", spent: 1800000, withdrawn: 0 }, ...(ahorro ? [ahorro] : [])],
});

test("lo que se puede retirar sin retiros previos", () => {
  const room = withdrawalRoom(AUGUST({ category_id: 8, name: "Ahorro", spent: 500000, withdrawn: 0 }));

  assert.equal(room.room, 500000);
  assert.equal(
    room.text,
    `En agosto apartaste ${formatPesos(500000)} y no has retirado nada: puedes retirar hasta ${formatPesos(500000)}.`,
  );
});

test("lo que se puede retirar con un retiro previo", () => {
  // El resumen ya descuenta lo retirado de Ahorro: 500.000 − 200.000.
  const room = withdrawalRoom(AUGUST({ category_id: 8, name: "Ahorro", spent: 300000, withdrawn: 200000 }));

  assert.deepEqual([room.saved, room.withdrawn, room.room], [500000, 200000, 300000]);
  assert.match(room.text, /ya retiraste/);
});

test("sin nada apartado no hay de dónde retirar", () => {
  const room = withdrawalRoom(AUGUST(null));

  assert.equal(room.room, 0);
  assert.equal(room.text, "En agosto no has apartado nada en Ahorro: no hay de dónde retirar.");
});

test("al editar, solo se envía lo que cambió", () => {
  const original = { amount: 200000, spent_on: "2026-08-14", description: "Urgencia" };

  assert.deepEqual(withdrawalChanges(original, { amount: "200.000", date: "2026-08-14", note: "Urgencia" }), {});
  assert.deepEqual(withdrawalChanges(original, { amount: "150.000", date: "2026-08-14", note: "" }), {
    amount: 150000,
    description: null,
  });
  assert.deepEqual(withdrawalChanges(original, { amount: "200.000", date: "2026-08-10", note: "Urgencia" }), {
    spent_on: "2026-08-10",
  });
});
