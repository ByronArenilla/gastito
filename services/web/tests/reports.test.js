// Reportes, sin DOM (spec 013): el mes elegido, la ventana y lo que dice y
// dibuja cada reporte a partir de la respuesta de la API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SAVINGS_WINDOWS, monthBounds } from "../public/js/reports.js";

// --- Mes y ventana (RF-2, RF-3) ---

test("la ventana de ahorro empieza en 1 mes y llega a 12", () => {
  assert.deepEqual(
    SAVINGS_WINDOWS.map((w) => [w.months, w.label]),
    [
      [1, "1 mes"],
      [3, "3 meses"],
      [6, "6 meses"],
      [12, "12 meses"],
    ],
  );
});

test("las flechas se detienen en el primer mes con datos y antes del actual", () => {
  assert.deepEqual(monthBounds("2026-10", "2025-11", "2026-11"), { previous: true, next: false });
  assert.deepEqual(monthBounds("2025-11", "2025-11", "2026-11"), { previous: false, next: true });
  assert.deepEqual(monthBounds("2026-06", "2025-11", "2026-11"), { previous: true, next: true });
  // Sin datos, no hay adónde ir.
  assert.deepEqual(monthBounds("2026-10", null, "2026-11"), { previous: false, next: false });
});
