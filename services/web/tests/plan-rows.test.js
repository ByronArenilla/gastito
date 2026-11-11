// Qué envía cada renglón de Planear (spec 012, RF-13 a RF-17).
import { test } from "node:test";
import assert from "node:assert/strict";
import { missingText, needsConfirm, rowRequest, statementRequest } from "../public/js/plan-rows.js";

const MERCADO = { id: 3, name: "Mercado", categoryId: 2, amount: 900000 };

test("un rubro nuevo completo se crea en el mes elegido", () => {
  const row = { name: " Gimnasio ", categoryId: "6", amount: "120.000" };

  assert.deepEqual(rowRequest("item", null, row, "2026-11"), {
    action: "create",
    body: { period: "2026-11", name: "Gimnasio", category_id: 6, amount: 120000 },
    missing: [],
  });
});

test("un rubro nuevo a medias no se envía y dice qué le falta", () => {
  const row = { name: "Gimnasio", categoryId: "", amount: "" };

  const request = rowRequest("item", null, row, "2026-11");

  assert.equal(request.action, "none");
  assert.deepEqual(request.missing, ["categoría", "monto"]);
  assert.equal(missingText(request.missing), "Falta: categoría y monto. No se ha guardado.");
});

test("un renglón nuevo vacío no se envía ni avisa", () => {
  const request = rowRequest("item", null, { name: "", categoryId: "", amount: "" }, "2026-11");

  assert.deepEqual(request, { action: "none", body: null, missing: [] });
});

test("un rubro existente envía solo lo que cambió", () => {
  const row = { name: "Mercado", categoryId: "2", amount: "1.000.000" };

  assert.deepEqual(rowRequest("item", MERCADO, row, "2026-11"), {
    action: "update",
    body: { amount: 1000000 },
    missing: [],
  });
});

test("cambiar nombre y categoría de un rubro existente", () => {
  const row = { name: "Mercado del mes", categoryId: "1", amount: "900.000" };

  assert.deepEqual(rowRequest("item", MERCADO, row, "2026-11").body, {
    name: "Mercado del mes",
    category_id: 1,
  });
});

test("un rubro existente sin cambios no envía nada", () => {
  const row = { name: "Mercado ", categoryId: "2", amount: "$ 900.000" };

  assert.deepEqual(rowRequest("item", MERCADO, row, "2026-11"), {
    action: "none",
    body: null,
    missing: [],
  });
});

test("un rubro existente al que se le borra el monto no se envía", () => {
  const row = { name: "Mercado", categoryId: "2", amount: "" };

  const request = rowRequest("item", MERCADO, row, "2026-11");

  assert.equal(request.action, "none");
  assert.deepEqual(request.missing, ["monto"]);
});

test("un ingreso usa las mismas reglas, sin categoría", () => {
  const salario = { id: 1, name: "Salario", amount: 6000000 };

  assert.deepEqual(rowRequest("income", null, { name: "Prima", amount: "3.000.000" }, "2026-12"), {
    action: "create",
    body: { period: "2026-12", name: "Prima", amount: 3000000 },
    missing: [],
  });
  assert.deepEqual(rowRequest("income", salario, { name: "Salario", amount: "6.200.000" }, "2026-11").body, {
    amount: 6200000,
  });
  assert.deepEqual(rowRequest("income", null, { name: "", amount: "100" }, "2026-11").missing, ["nombre"]);
});

test("quitar un rubro con gastos pide confirmación; sin gastos, no (decisión 14)", () => {
  assert.equal(needsConfirm({ spent: 520000 }), true);
  assert.equal(needsConfirm({ spent: 0 }), false);
});

test("quitar un rubro de Ahorro no pide confirmación: no tiene gastos (spec 013, decisión 29)", () => {
  // El resumen lo cuenta gastado por lo planeado, pero no tiene gastos.
  const savings = new Set([9]);

  assert.equal(needsConfirm({ categoryId: 9, spent: 500000 }, savings), false);
  assert.equal(needsConfirm({ categoryId: 2, spent: 520000 }, savings), true);
});

test("el extracto: escrito se guarda, vacío se quita, igual no se envía", () => {
  assert.deepEqual(statementRequest(null, "1.020.000"), { action: "put", body: { amount: 1020000 } });
  assert.deepEqual(statementRequest(990000, "1.020.000"), { action: "put", body: { amount: 1020000 } });
  assert.deepEqual(statementRequest(1020000, ""), { action: "delete", body: null });
  assert.deepEqual(statementRequest(1020000, "1.020.000"), { action: "none", body: null });
  assert.deepEqual(statementRequest(null, ""), { action: "none", body: null });
  // Una tarjeta que no cobró nada ese mes: 0 vale (decisión 20 de la 009).
  assert.deepEqual(statementRequest(null, "0"), { action: "put", body: { amount: 0 } });
});
