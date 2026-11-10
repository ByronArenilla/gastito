// Escalas de los gráficos de los reportes, sin DOM (spec 013, RF-19, RF-22).
import { test } from "node:test";
import assert from "node:assert/strict";
import { barScale, columnScale, divergentScale, stackScale } from "../public/js/charts.js";

test("columnas positivas: la mayor mide 1 y el cero está abajo", () => {
  const { zero, sizes } = columnScale([300, 600, 150]);

  assert.equal(zero, 0);
  assert.deepEqual(sizes, [0.5, 1, 0.25]);
});

test("con negativos, el cero queda entre los dos y los tamaños llevan signo", () => {
  const { zero, sizes } = columnScale([600, -200]);

  assert.equal(zero, 0.25);
  assert.deepEqual(sizes, [0.75, -0.25]);
});

test("todo en cero: tamaños 0, sin dividir por cero", () => {
  const { zero, sizes } = columnScale([0, 0]);

  assert.equal(zero, 0);
  assert.deepEqual(sizes, [0, 0]);
  assert.deepEqual(columnScale([]), { zero: 0, sizes: [] });
});

test("pilas: la más alta mide 1 y sus partes conservan la proporción", () => {
  assert.deepEqual(stackScale([[300, 100], [100, 100], []]), [
    { size: 1, parts: [0.75, 0.25] },
    { size: 0.5, parts: [0.5, 0.5] },
    { size: 0, parts: [] },
  ]);
});

test("divergentes: el mismo máximo para lo que se pasa y lo que sobra", () => {
  assert.deepEqual(divergentScale([150, -50, 0]), [
    { side: "over", size: 1 },
    { side: "under", size: 1 / 3 },
    { side: "zero", size: 0 },
  ]);
  assert.deepEqual(divergentScale([0]), [{ side: "zero", size: 0 }]);
});

test("barras: cada una sobre la mayor", () => {
  assert.deepEqual(barScale([200, 50]), [1, 0.25]);
  assert.deepEqual(barScale([0]), [0]);
});
