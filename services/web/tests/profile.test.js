// El perfil sin DOM: nombre a mostrar, iniciales y lo que se envía (spec 031).
import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName, initials, nameRequest, needsName } from "../public/js/profile.js";

test("se muestra el nombre; sin nombre, el correo", () => {
  assert.equal(displayName({ name: "Byron", email: "byron@example.com" }), "Byron");
  assert.equal(displayName({ name: null, email: "byron@example.com" }), "byron@example.com");
  assert.equal(displayName(null), "");
});

test("las iniciales salen del nombre y, si no hay, del correo", () => {
  assert.equal(initials({ name: "Byron Arenilla" }), "BA");
  assert.equal(initials({ name: "Byron" }), "B");
  assert.equal(initials({ name: " ana maría  pérez " }), "AP");
  assert.equal(initials({ name: null, email: "laura@example.com" }), "L");
  assert.equal(initials(null), "?");
});

test("el nombre se envía sin espacios alrededor y vacío no se envía", () => {
  assert.deepEqual(nameRequest("  Byron "), { body: { name: "Byron" }, missing: [] });
  assert.deepEqual(nameRequest("   "), { body: null, missing: ["name"] });
});

test("el nombre se pide solo si la API dice que falta", () => {
  assert.equal(needsName({ email: "ana@example.com", name: null }), true);
  assert.equal(needsName({ email: "ana@example.com", name: "Ana" }), false);
});

test("con una API anterior a la spec 031, que no envía el nombre, no se pide", () => {
  // Durante un despliegue la web nueva puede hablar unos minutos con la API
  // vieja: pedir el nombre ahí daría un error al guardarlo.
  assert.equal(needsName({ id: 1, email: "ana@example.com" }), false);
  assert.equal(needsName(null), false);
});
