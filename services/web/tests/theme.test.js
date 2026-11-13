// Tema claro u oscuro: manda el sistema hasta que se elige con el botón.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  THEME_COLORS,
  THEME_KEY,
  activeTheme,
  otherTheme,
  saveTheme,
  storedTheme,
  themeLabel,
} from "../public/js/theme.js";

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("sin elección, manda el sistema", () => {
  assert.equal(storedTheme(memory()), null);
  assert.equal(activeTheme(null, true), "dark");
  assert.equal(activeTheme(null, false), "light");
});

test("lo elegido se recuerda y le gana al sistema", () => {
  const storage = memory();

  saveTheme(storage, "light");

  assert.equal(storedTheme(storage), "light");
  assert.equal(activeTheme("light", true), "light");
});

test("un valor raro guardado no cuenta como elección", () => {
  assert.equal(storedTheme(memory({ [THEME_KEY]: "morado" })), null);
});

test("si el almacenamiento falla, el tema sigue funcionando", () => {
  const broken = {
    getItem() {
      throw new Error("bloqueado");
    },
    setItem() {
      throw new Error("bloqueado");
    },
  };

  assert.equal(storedTheme(broken), null);
  assert.doesNotThrow(() => saveTheme(broken, "dark"));
});

test("el botón cambia al otro tema y lo dice", () => {
  assert.equal(otherTheme("dark"), "light");
  assert.equal(otherTheme("light"), "dark");
  assert.equal(themeLabel("dark"), "Cambiar a modo claro");
  assert.equal(themeLabel("light"), "Cambiar a modo oscuro");
});

test("los colores de la barra del navegador son el papel de cada tema", () => {
  const css = readFileSync(new URL("../public/css/tokens.css", import.meta.url), "utf8");
  const light = css.match(/^:root\s*\{([^}]*)\}/m)[1];
  const dark = css.match(/^:root\[data-theme="dark"\]\s*\{([^}]*)\}/m)[1];

  assert.ok(light.includes(`--paper: ${THEME_COLORS.light}`));
  assert.ok(dark.includes(`--paper: ${THEME_COLORS.dark}`));
});

test("el arranque usa la misma clave que theme.js", () => {
  const boot = readFileSync(new URL("../public/js/theme-boot.js", import.meta.url), "utf8");

  assert.ok(boot.includes(`"${THEME_KEY}"`));
});
