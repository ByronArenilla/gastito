// Categorías sin navegador (spec 012, RF-28).
import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryRequest } from "../public/js/categories.js";

test("el nombre se envía sin espacios alrededor", () => {
  assert.deepEqual(categoryRequest("  Mascotas "), { body: { name: "Mascotas" }, missing: [] });
});

test("un nombre vacío dice que falta y no se envía", () => {
  assert.deepEqual(categoryRequest("   "), { body: null, missing: ["name"] });
});
