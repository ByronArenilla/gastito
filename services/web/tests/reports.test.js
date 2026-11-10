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

// --- ¿En qué se me va la plata? y ¿Planeo bien? (RF-14 a RF-20, RF-31) ---

import { formatPesos } from "../public/js/format.js";
import { answerText, groupLines, planningReport, spendingReport } from "../public/js/reports.js";

/** La respuesta de la API para octubre de 2026 (la de `test_reports.py`). */
function october() {
  return {
    current: "2026-11",
    period: "2026-10",
    first_period: "2026-06",
    has_data: true,
    spending: {
      total: 3780360,
      unplanned: 270000,
      unplanned_share: 7,
      saved: 500000,
      withdrawn: 0,
      lines: [
        { kind: "category", category_id: 1, name: "Hogar", deleted: false, total: 1800000, share: 48 },
        { kind: "category", category_id: 2, name: "Comida", deleted: false, total: 1105000, share: 29 },
        { kind: "debts", category_id: null, name: "Cuotas de tarjetas", deleted: false, total: 445360, share: 12 },
        { kind: "category", category_id: 3, name: "Transporte", deleted: false, total: 280000, share: 7 },
        { kind: "category", category_id: 10, name: "Viajes", deleted: true, total: 150000, share: 4 },
      ],
    },
    planning: {
      items: [
        { kind: "unplanned", name: "Viajes", category: "Viajes", category_id: 10, planned: 0, spent: 150000, diff: 150000 },
        { kind: "unplanned", name: "Comida", category: "Comida", category_id: 2, planned: 0, spent: 120000, diff: 120000 },
        { kind: "item", name: "Mercado", category: "Comida", category_id: 2, planned: 900000, spent: 985000, diff: 85000 },
        { kind: "item", name: "Arriendo", category: "Hogar", category_id: 1, planned: 1800000, spent: 1800000, diff: 0 },
        { kind: "item", name: "Gasolina", category: "Transporte", category_id: 3, planned: 300000, spent: 280000, diff: -20000 },
      ],
    },
    savings: { window: { months: 1, periods: ["2026-10"] }, months: [], average: null, best: null, worst: null, planned_months: 0, met_months: 0 },
  };
}

test("la frase de en qué se va la plata nombra la categoría más grande", () => {
  const report = spendingReport(october());

  assert.equal(answerText(report.answer), "En octubre, Hogar se lleva el 48 % de lo que gastaste.");
  assert.deepEqual(report.answer[1], { figure: "48 %" });
  assert.equal(
    report.sub,
    `${formatPesos(3780360)} gastados. El 7 % fue no planeado: ${formatPesos(270000)}. Además, apartaste ${formatPesos(500000)} en Ahorro.`,
  );
});

test("lo retirado se nombra junto a lo apartado", () => {
  const august = october();
  august.period = "2026-08";
  august.spending.withdrawn = 200000;

  assert.match(spendingReport(august).sub, /apartaste .* en Ahorro y retiraste .*200\.000\.$/);
});

test("las cuotas de tarjetas pueden ser lo más grande", () => {
  const month = october();
  month.spending.lines = [month.spending.lines[2], month.spending.lines[0]];

  assert.equal(answerText(spendingReport(month).answer), "En octubre, las cuotas de tarjetas se llevan el 12 % de lo que gastaste.");
});

test("las filas llevan su tinta; una eliminada lo dice", () => {
  const { rows } = spendingReport(october());

  assert.deepEqual(
    rows.map((row) => [row.name, row.tint, row.share]),
    [
      ["Hogar", "tint-1", "48 %"],
      ["Comida", "tint-2", "29 %"],
      ["Cuotas de tarjetas", "tint-debts", "12 %"],
      ["Transporte", "tint-3", "7 %"],
      ["Viajes (eliminada)", "tint-4", "4 %"],
    ],
  );
});

test("ocho categorías: seis con tinta, el resto en Otras, con la misma suma", () => {
  const lines = [800, 700, 600, 500, 400, 300, 200, 100].map((total, index) => ({
    kind: "category",
    category_id: index + 1,
    name: `C${index + 1}`,
    deleted: false,
    total,
    share: total / 40,
  }));
  lines.splice(2, 0, { kind: "debts", category_id: null, name: "Cuotas de tarjetas", deleted: false, total: 650, share: 16 });

  const grouped = groupLines(lines);

  assert.deepEqual(
    grouped.map((row) => [row.name, row.tint, row.total]),
    [
      ["C1", "tint-1", 800],
      ["C2", "tint-2", 700],
      ["Cuotas de tarjetas", "tint-debts", 650],
      ["C3", "tint-3", 600],
      ["C4", "tint-4", 500],
      ["C5", "tint-5", 400],
      ["C6", "tint-6", 300],
      ["Otras (2)", "tint-other", 300],
    ],
  );
  const sum = (rows) => rows.reduce((total, row) => total + row.total, 0);
  assert.equal(sum(grouped), sum(lines));
});

test("un mes sin datos ofrece planear", () => {
  const empty = october();
  empty.has_data = false;
  empty.spending.lines = [];
  empty.planning.items = [];

  assert.equal(spendingReport(empty).empty, "Octubre no tiene datos.");
  assert.equal(planningReport(empty).empty, "Octubre no tiene datos.");
});

test("planeo bien: la fila sin rubro que más se pasó va primera", () => {
  const report = planningReport(october());

  assert.equal(answerText(report.answer), `En Viajes gastaste ${formatPesos(150000)} sin rubro.`);
  assert.equal(report.sub, "1 de 3 rubros se pasó; 1 sobró. Hubo gastos sin rubro en 2 categorías.");
  assert.deepEqual(
    report.rows.map((row) => [row.name, row.unplanned, row.figure, row.value]),
    [
      ["Viajes", true, `+${formatPesos(150000)}`, 150000],
      ["Comida", true, `+${formatPesos(120000)}`, 120000],
      ["Mercado", false, `+${formatPesos(85000)}`, 85000],
      ["Arriendo", false, "justo", 0],
      ["Gasolina", false, formatPesos(-20000), -20000],
    ],
  );
});

test("planeo bien: un rubro que se pasó, sin gastos sin rubro", () => {
  const month = october();
  month.planning.items = month.planning.items.filter((row) => row.kind === "item");

  const report = planningReport(month);

  assert.equal(answerText(report.answer), `Mercado se pasó ${formatPesos(85000)} de lo planeado.`);
  assert.equal(report.sub, "1 de 3 rubros se pasó; 1 sobró.");
});

test("planeo bien: nada se pasó", () => {
  const month = october();
  month.planning.items = month.planning.items.filter((row) => row.diff <= 0);

  assert.equal(answerText(planningReport(month).answer), "Ningún rubro se pasó de lo planeado.");
});

// --- ¿Estoy ahorrando? (RF-21 a RF-23) ---

import { savingsReport } from "../public/js/reports.js";

const month = (period, values = {}) => ({
  period,
  empty: false,
  income: 6500000,
  income_estimated: false,
  saved: 500000,
  withdrawn: 0,
  saved_planned: 500000,
  left: 118640,
  total: 618640,
  share: 10,
  ...values,
});

function withSavings(months, extra = {}) {
  const reports = october();
  reports.savings = {
    window: { months: months.length, periods: months.map((m) => m.period) },
    months,
    average: null,
    best: null,
    worst: null,
    planned_months: 0,
    met_months: 0,
    ...extra,
  };
  return reports;
}

test("con un mes: lo ahorrado en grande y su desglose", () => {
  const report = savingsReport(withSavings([month("2026-10")]));

  assert.equal(answerText(report.answer), `En octubre ahorraste ${formatPesos(618640)}, el 10 % del ingreso.`);
  assert.equal(report.sub, `Apartaste ${formatPesos(500000)} en Ahorro, lo planeado, y quedaron ${formatPesos(118640)} sin gastar.`);
  assert.equal(report.single.total, 618640);
});

test("con un retiro, el desglose lo nombra", () => {
  const august = month("2026-08", { withdrawn: 200000, left: 2945000, total: 3245000, share: 50 });

  assert.equal(
    savingsReport(withSavings([august])).sub,
    `Apartaste ${formatPesos(500000)} en Ahorro, lo planeado, retiraste ${formatPesos(200000)} y quedaron ${formatPesos(2945000)} sin gastar.`,
  );
});

test("un mes que gastó más de lo que entró lo dice con −", () => {
  const report = savingsReport(withSavings([month("2026-10", { saved: 300000, left: -780360, total: -480360, share: -7 })]));

  assert.equal(answerText(report.answer), `En octubre gastaste ${formatPesos(480360)} más de lo que entró.`);
  assert.match(report.sub, /de .*500\.000 planeados, y faltaron .*780\.360 para cubrir los gastos\.$/);
});

test("sin ingreso no hay parte del ingreso", () => {
  const report = savingsReport(withSavings([month("2026-10", { income: 0, share: null, saved: 0, saved_planned: 0, left: -70000, total: -70000 })]));

  assert.equal(answerText(report.answer), `En octubre gastaste ${formatPesos(70000)} más de lo que entró.`);
});

test("con varios meses: promedio, meses con lo planeado, mejor, peor y el mes sin datos", () => {
  const months = [
    month("2026-05", { empty: true, income: 0, saved: 0, saved_planned: 0, left: 0, total: 0, share: null }),
    month("2026-06", { left: 2890000, total: 3390000, share: 52 }),
    month("2026-09", { saved: 0, left: 3530000, total: 3530000, share: 54, income_estimated: true }),
    month("2026-10"),
  ];
  const report = savingsReport(
    withSavings(months, { average: { total: 2512880, share: 39 }, best: "2026-09", worst: "2026-10", planned_months: 3, met_months: 2 }),
  );

  assert.equal(answerText(report.answer), `En promedio ahorras ${formatPesos(2512880)} al mes, el 39 % del ingreso.`);
  assert.equal(
    report.sub,
    "Apartaste lo planeado en 2 de 3 meses. El mejor mes fue septiembre y el peor, octubre. Un mes no tiene datos y no cuenta.",
  );
  assert.deepEqual(
    report.columns.map((c) => [c.period, c.empty, c.top, c.up.map((p) => p.amount), c.down]),
    [
      ["2026-05", true, "", [0, 0], 0],
      ["2026-06", false, "", [500000, 2890000], 0],
      ["2026-09", false, "mejor", [0, 3530000], 0],
      ["2026-10", false, "peor", [500000, 118640], 0],
    ],
  );
});

test("en las columnas, lo retirado baja lo apartado y lo que faltó va bajo el cero", () => {
  const months = [
    month("2026-08", { withdrawn: 200000, left: 2945000, total: 3245000 }),
    month("2026-10", { left: -780360, total: -280360 }),
  ];
  const report = savingsReport(withSavings(months, { average: { total: 1482320, share: 23 }, best: "2026-08", worst: "2026-10" }));

  assert.deepEqual(
    report.columns.map((c) => [c.up.map((p) => p.amount), c.down]),
    [
      [[300000, 2945000], 0],
      [[500000, 0], 780360],
    ],
  );
});

test("sin ningún mes con datos", () => {
  const empty = month("2026-10", { empty: true, income: 0, saved: 0, saved_planned: 0, left: 0, total: 0, share: null });

  assert.equal(savingsReport(withSavings([empty])).empty, "Todavía no hay meses con datos.");
});
