// Errores de formulario sin navegador (spec 012, RF-20 y RF-28).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../public/js/api.js";
import { nameConflict } from "../public/js/views/form.js";

test("un nombre repetido (409) se muestra junto al campo del nombre", () => {
  const error = new ApiError({ status: 409, message: "Ya existe la tarjeta «Visa»." });

  assert.deepEqual(nameConflict(error), {
    message: "Ya existe la tarjeta «Visa».",
    fields: { name: "Ya existe la tarjeta «Visa»." },
  });
});

test("otros errores pasan tal cual", () => {
  const error = new ApiError({ status: 422, message: "x", fields: { cutoff_day: "x" } });

  assert.equal(nameConflict(error), error);
});
