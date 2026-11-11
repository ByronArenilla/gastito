// Contraste de los tokens de color en los dos temas (spec 011, RF-32 y
// criterio 2). Lee `tokens.css` tal cual está: si alguien cambia un color y
// baja del mínimo de WCAG 2.2 AA, este test falla.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/css/tokens.css", import.meta.url), "utf8");

/** Variables `--nombre: #rrggbb` de un bloque de CSS. */
function colors(block) {
  const found = {};
  for (const [, name, hex] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    found[name] = hex;
  }
  return found;
}

/** El primer bloque `:root { ... }` (tema claro) y el de `prefers-color-scheme: dark`. */
function themes() {
  const light = css.match(/^:root\s*\{([^}]*)\}/m)[1];
  const darkMedia = css.slice(css.indexOf("prefers-color-scheme: dark"));
  const dark = darkMedia.match(/:root[^{]*\{([^}]*)\}/)[1];
  return { claro: colors(light), oscuro: colors(dark) };
}

// https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Texto: 4,5:1. Bordes de controles y foco: 3:1.
const TEXT = [
  ["ink", "paper"],
  ["ink", "field"],
  ["muted", "paper"],
  ["muted", "field"],
  ["red", "paper"],
  ["red", "field"],
  ["paper", "ink"], // texto del botón principal
];
const NON_TEXT = [
  ["rule-strong", "paper"],
  ["rule-strong", "field"],
  ["focus", "paper"],
  ["focus", "field"],
];

for (const [name, tokens] of Object.entries(themes())) {
  test(`tema ${name}: los tokens existen`, () => {
    for (const token of ["paper", "field", "ink", "rule", "rule-strong", "red", "muted", "focus"]) {
      assert.ok(tokens[token], `falta --${token}`);
    }
  });

  for (const [fg, bg] of TEXT) {
    test(`tema ${name}: --${fg} sobre --${bg} pasa 4,5:1`, () => {
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1`);
    });
  }

  for (const [fg, bg] of NON_TEXT) {
    test(`tema ${name}: --${fg} sobre --${bg} pasa 3:1`, () => {
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`);
    });
  }
}

// Barras del Mes (spec 012, sección "Accesibilidad de las barras"). Las partes
// llenas de la barra del ingreso tocan el papel (la separación de 2 px es
// papel), y el relleno de un medidor toca su fondo (`--rule`): todos pasan
// 3:1 (WCAG 1.4.11). La parte "sin asignar" y el fondo del medidor son lo
// vacío y no lo necesitan.
const BARS = [
  ["ink", "paper"], // rubros y relleno del medidor
  ["rule-strong", "paper"], // deudas
  ["red", "paper"], // medidor excedido
  ["ink", "rule"], // relleno del medidor sobre su fondo
  ["red", "rule"], // relleno excedido sobre su fondo
];

for (const [name, tokens] of Object.entries(themes())) {
  for (const [fg, bg] of BARS) {
    test(`tema ${name}: barra --${fg} sobre --${bg} pasa 3:1`, () => {
      const ratio = contrast(tokens[fg], tokens[bg]);
      assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`);
    });
  }
}

// Tintas de libro (spec 013, RF-17 y RF-25). Seis tintas para categorías y
// "Otras", en un orden fijo. Cada una pasa 3:1 contra el papel y el campo, y
// las vecinas se distinguen también para quien no ve bien los colores: la
// distancia en OKLab ×100 es de al menos 15 con visión normal y de al menos 8
// con protanopía y deuteranopía simuladas. Son los umbrales del validador con
// el que se eligieron las tintas en el prototipo (plan 013, "Tests").
const TINTS = ["tint-1", "tint-2", "tint-3", "tint-4", "tint-5", "tint-6", "tint-other"];
const NORMAL_MIN = 15;
const CVD_MIN = 8;

// Simulación de Machado, Oliveira y Fernandes (2009), severidad 1, sobre RGB
// lineal. Los umbrales están calibrados con este modelo: cambiarlo cambiaría
// qué pares pasan.
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
const CVD = {
  protanopía: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopía: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

function linearRgb(hex) {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
}

// https://bottosson.github.io/posts/oklab/
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function simulate(rgb, matrix) {
  const clamp = (c) => Math.min(1, Math.max(0, c));
  return matrix.map((row) => clamp(row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]));
}

/** Distancia en OKLab ×100 entre dos colores, vistos con `matrix` o sin ella. */
function distance(a, b, matrix = null) {
  const see = (hex) => oklab(matrix ? simulate(linearRgb(hex), matrix) : linearRgb(hex));
  const [x, y] = [see(a), see(b)];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

for (const [name, tokens] of Object.entries(themes())) {
  test(`tema ${name}: las tintas de libro existen`, () => {
    for (const token of TINTS) assert.ok(tokens[token], `falta --${token}`);
  });

  for (const tint of TINTS) {
    for (const bg of ["paper", "field"]) {
      test(`tema ${name}: --${tint} sobre --${bg} pasa 3:1`, () => {
        const ratio = contrast(tokens[tint], tokens[bg]);
        assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1`);
      });
    }
  }

  for (let i = 0; i + 1 < TINTS.length; i++) {
    const [a, b] = [TINTS[i], TINTS[i + 1]];
    test(`tema ${name}: --${a} y --${b} se distinguen`, () => {
      const normal = distance(tokens[a], tokens[b]);
      assert.ok(normal >= NORMAL_MIN, `visión normal: ${normal.toFixed(1)}`);
      for (const [kind, matrix] of Object.entries(CVD)) {
        const seen = distance(tokens[a], tokens[b], matrix);
        assert.ok(seen >= CVD_MIN, `${kind}: ${seen.toFixed(1)}`);
      }
    });
  }
}
