// El tablero del Mes a partir del resumen y los gastos de la API (spec 012,
// RF-5 a RF-9; spec 033, RF-11 a RF-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboard, copyNotice } from "../public/js/dashboard.js";

// El resumen de noviembre 2026 tal como lo da la API con los datos de ejemplo
// de la spec: Gasolina excedida y $ 120.000 sin rubro en Comida.
function november() {
  return {
    period: "2026-11",
    incomes: [
      { id: 1, name: "Salario", amount: 6000000 },
      { id: 2, name: "Arriendo apto", amount: 500000 },
    ],
    budget_items: [
      { id: 1, name: "Arriendo", category_id: 1, planned: 1800000, spent: 1800000, remaining: 0 },
      { id: 2, name: "Servicios", category_id: 1, planned: 400000, spent: 300000, remaining: 100000 },
      { id: 3, name: "Mercado", category_id: 2, planned: 900000, spent: 520000, remaining: 380000 },
      { id: 4, name: "Gasolina", category_id: 3, planned: 300000, spent: 340000, remaining: -40000 },
      { id: 5, name: "Salidas", category_id: 6, planned: 200000, spent: 80000, remaining: 120000 },
    ],
    categories: [
      { category_id: 1, name: "Hogar", planned: 2200000, spent: 2100000, deleted: false },
      { category_id: 2, name: "Comida", planned: 900000, spent: 640000, deleted: false },
      { category_id: 3, name: "Transporte", planned: 300000, spent: 340000, deleted: false },
      { category_id: 4, name: "Salud", planned: 0, spent: 0, deleted: false },
      { category_id: 6, name: "Ocio", planned: 200000, spent: 80000, deleted: false },
    ],
    debts: [
      {
        card_id: 1,
        name: "Visa",
        deleted: false,
        installments: [
          { expense_id: 8, name: "Llantas", number: 1, count: 3, capital: 200000, interest: 11340, amount: 211340 },
        ],
        prepayments: [],
        estimated: 211340,
        statement: null,
        amount: 211340,
        month_expenses: [{ expense_id: 9, name: "Mercado", amount: 150000 }],
        to_pay: 361340,
      },
    ],
    total: {
      income: 6500000,
      planned: 3811340,
      debts: 211340,
      cards_to_pay: 361340,
      spent_planned: 3040000,
      spent_unplanned: 120000,
      spent: 3371340,
      unassigned: 2688660,
      balance: 3128660,
      // Spec 033: las dos bolsas, que suman el balance.
      plan_spent: 3251340,
      plan_remaining: 560000,
      unassigned_remaining: 2568660,
    },
  };
}

// Los gastos de noviembre como los da `GET /expenses`: del más reciente al
// más antiguo, cada uno con su `kind`.
const EXPENSES = [
  { id: 21, amount: 320000, spent_on: "2026-11-10", category_id: 2, budget_item_id: 3, description: "Fruver", kind: "item" },
  { id: 22, amount: 75000, spent_on: "2026-11-09", category_id: 2, budget_item_id: null, description: "Domicilio pizza", kind: "unplanned" },
  { id: 24, amount: 600000, spent_on: "2026-11-06", category_id: 3, budget_item_id: null, description: "Llantas", kind: "debt" },
  { id: 23, amount: 45000, spent_on: "2026-11-04", category_id: 2, budget_item_id: null, description: null, kind: "unplanned" },
  { id: 20, amount: 200000, spent_on: "2026-11-03", category_id: 2, budget_item_id: 3, description: null, kind: "item" },
];

test("los totales del mes y lo que hay que pagar a las tarjetas", () => {
  const { totals } = buildDashboard(november());

  assert.deepEqual(totals, {
    income: 6500000,
    planned: 3811340,
    debts: 211340,
    spent: 3371340,
    unassigned: 2688660,
    balance: 3128660,
    cardsToPay: 361340,
  });
});

// --- Las dos bolsas (spec 033, RF-12) ---

test("las dos bolsas: asignado, gastado, lo que queda y cuánto llenan", () => {
  const [plan, free] = buildDashboard(november()).buckets;

  assert.deepEqual(
    [plan.key, plan.assigned, plan.spent, plan.remaining, plan.exceeded],
    ["plan", 3811340, 3251340, 560000, false],
  );
  assert.ok(Math.abs(plan.fill - 3251340 / 3811340) < 1e-9);
  assert.deepEqual(
    [free.key, free.assigned, free.spent, free.remaining, free.exceeded],
    ["free", 2688660, 120000, 2568660, false],
  );
  assert.ok(Math.abs(free.fill - 120000 / 2688660) < 1e-9);
});

test("las bolsas suman lo que queda en el mes", () => {
  const { buckets, totals } = buildDashboard(november());

  assert.equal(buckets[0].remaining + buckets[1].remaining, totals.balance);
});

test("una bolsa excedida se llena entera", () => {
  const summary = november();
  summary.total = { ...summary.total, spent_unplanned: 2700000, unassigned_remaining: -11340 };

  const free = buildDashboard(summary).buckets[1];

  assert.equal(free.exceeded, true);
  assert.equal(free.fill, 1);
  assert.equal(free.remaining, -11340);
});

test("un plan que supera el ingreso dice por cuánto y deja lo sin asignar excedido", () => {
  const summary = november();
  summary.total = { ...summary.total, planned: 7000000, unassigned: -500000, unassigned_remaining: -620000 };

  const board = buildDashboard(summary);

  assert.equal(board.overPlanned, 500000);
  assert.equal(board.buckets[1].exceeded, true);
  assert.equal(board.buckets[1].fill, 1);
  assert.equal(buildDashboard(november()).overPlanned, 0);
});

test("un mes sin plan ni gastos deja las bolsas vacías", () => {
  const summary = november();
  summary.total = {
    ...summary.total,
    planned: 0,
    unassigned: 0,
    spent_unplanned: 0,
    plan_spent: 0,
    plan_remaining: 0,
    unassigned_remaining: 0,
  };

  assert.ok(buildDashboard(summary).buckets.every((bucket) => bucket.fill === 0 && !bucket.exceeded));
});

test("con una API anterior a la 033 no hay bolsas ni fuera del plan", () => {
  // La web puede llegar a producción minutos antes que la API: no calcula
  // las bolsas por su cuenta (principio 10).
  const summary = november();
  delete summary.total.plan_spent;
  delete summary.total.plan_remaining;
  delete summary.total.unassigned_remaining;
  const old = EXPENSES.map(({ kind, ...expense }) => expense);

  const board = buildDashboard(summary, old);

  assert.equal(board.buckets, null);
  assert.equal(board.unplanned, null);
  assert.equal(board.totals.balance, 3128660);
  assert.ok(board.categories.flatMap((c) => c.items).every((item) => item.expenses.length === 0));
});

// --- Los rubros (spec 033, RF-14 a RF-16) ---

test("cada rubro trae su medidor, lo que queda y su estado", () => {
  const { categories } = buildDashboard(november());
  const items = Object.fromEntries(categories.flatMap((c) => c.items).map((i) => [i.name, i]));

  assert.ok(Math.abs(items.Mercado.fill - 520000 / 900000) < 1e-9);
  assert.equal(items.Mercado.remaining, 380000);
  assert.equal(items.Mercado.status, "left");
  assert.equal(items.Arriendo.fill, 1);
  assert.equal(items.Arriendo.status, "done");
  assert.equal(items.Gasolina.fill, 1);
  assert.equal(items.Gasolina.status, "over");
  assert.equal(items.Gasolina.remaining, -40000);
});

test("un rubro con planeado 0 y gasto se ve excedido", () => {
  const summary = november();
  summary.budget_items[4] = { ...summary.budget_items[4], planned: 0, remaining: -80000 };

  const salidas = buildDashboard(summary)
    .categories.flatMap((c) => c.items)
    .find((item) => item.name === "Salidas");

  assert.equal(salidas.fill, 1);
  assert.equal(salidas.status, "over");
});

test("las categorías con rubros, en el orden de la API y sin cifras propias", () => {
  const { categories } = buildDashboard(november());

  // Salud no tiene rubros en el mes: no sale.
  assert.deepEqual(
    categories.map((c) => c.name),
    ["Hogar", "Comida", "Transporte", "Ocio"],
  );
  assert.deepEqual(
    categories[0].items.map((i) => i.name),
    ["Arriendo", "Servicios"],
  );
  // Decisión 3: la categoría es solo un rótulo.
  assert.deepEqual(Object.keys(categories[0]).sort(), ["deleted", "id", "items", "name", "withdrawn"]);
});

test("una categoría con gastos pero sin rubros no sale entre los rubros", () => {
  const summary = november();
  summary.categories.push({ category_id: 9, name: "Mascotas", planned: 0, spent: 45000, deleted: true });

  assert.equal(buildDashboard(summary).categories.some((c) => c.name === "Mascotas"), false);
});

test("una categoría eliminada con rubros sale marcada", () => {
  const summary = november();
  summary.categories[4] = { ...summary.categories[4], deleted: true };

  assert.equal(buildDashboard(summary).categories.at(-1).deleted, true);
});

test("cada rubro trae sus gastos del mes, con el detalle si lo tienen", () => {
  const { categories } = buildDashboard(november(), EXPENSES);
  const items = Object.fromEntries(categories.flatMap((c) => c.items).map((i) => [i.name, i]));

  assert.deepEqual(items.Mercado.expenses, [
    { id: 21, day: "2026-11-10", detail: "Fruver", amount: 320000 },
    { id: 20, day: "2026-11-03", detail: "", amount: 200000 },
  ]);
  assert.deepEqual(items.Arriendo.expenses, []);
});

// --- Fuera del plan (spec 033, RF-17 y RF-18) ---

test("fuera del plan: los gastos sin rubro del mes, con su total y lo sin asignar", () => {
  const { unplanned } = buildDashboard(november(), EXPENSES);

  assert.equal(unplanned.spent, 120000);
  assert.equal(unplanned.assigned, 2688660);
  assert.deepEqual(unplanned.rows, [
    { id: 22, name: "Domicilio pizza", category: "Comida", day: "2026-11-09", amount: 75000 },
    // Sin descripción, el nombre es la categoría.
    { id: 23, name: "Comida", category: "Comida", day: "2026-11-04", amount: 45000 },
  ]);
});

test("las deudas de tarjeta no van fuera del plan", () => {
  const { unplanned } = buildDashboard(november(), EXPENSES);

  assert.equal(unplanned.rows.some((row) => row.name === "Llantas"), false);
});

test("un mes sin gastos fuera del plan tiene la lista vacía", () => {
  const summary = november();
  summary.total = { ...summary.total, spent_unplanned: 0, unassigned_remaining: 2688660 };

  const { unplanned } = buildDashboard(summary, EXPENSES.filter((e) => e.kind !== "unplanned"));

  assert.deepEqual(unplanned.rows, []);
  assert.equal(unplanned.spent, 0);
});

test("cada tarjeta con lo que hay que pagarle, su deuda y sus gastos del mes", () => {
  const [visa] = buildDashboard(november()).cards;

  assert.equal(visa.id, 1);
  assert.equal(visa.name, "Visa");
  assert.equal(visa.toPay, 361340);
  assert.equal(visa.debt, 211340);
  assert.equal(visa.monthExpenses, 150000);
  assert.equal(visa.hasStatement, false);
  assert.equal(visa.deleted, false);
});

test("una tarjeta con extracto y una archivada", () => {
  const summary = november();
  summary.debts[0].statement = 400000;
  summary.debts.push({ ...summary.debts[0], card_id: 2, name: "Master", deleted: true, statement: null });

  const [visa, master] = buildDashboard(summary).cards;

  assert.equal(visa.hasStatement, true);
  assert.equal(master.deleted, true);
});

test("un mes sin rubros ni ingresos está vacío", () => {
  const summary = november();
  assert.equal(buildDashboard(summary).empty, false);

  summary.incomes = [];
  summary.budget_items = [];
  assert.equal(buildDashboard(summary).empty, true);
});

test("al copiar el plan, el aviso dice qué rubros se omitieron y por qué", () => {
  assert.equal(copyNotice("2026-12", []), "Se copió el plan de noviembre a diciembre.");
  assert.equal(
    copyNotice("2026-12", [{ name: "Veterinario", category: "Mascotas" }]),
    "Se copió el plan de noviembre a diciembre. No se copió «Veterinario»: su categoría «Mascotas» está eliminada.",
  );
  assert.equal(
    copyNotice("2027-01", [
      { name: "Veterinario", category: "Mascotas" },
      { name: "Comida gato", category: "Mascotas" },
    ]),
    "Se copió el plan de diciembre a enero. No se copiaron «Veterinario» y «Comida gato»: sus categorías están eliminadas.",
  );
});

// --- Ahorro y lo retirado (spec 013, RF-36; spec 033, RF-20) ---

test("un rubro de Ahorro está apartado; lo retirado va aparte en su categoría", () => {
  // Agosto: rubro Ahorro de 500.000 apartado entero y 200.000 retirados.
  const summary = november();
  summary.budget_items.push({ id: 9, name: "Ahorro", category_id: 8, planned: 500000, spent: 500000, remaining: 0 });
  summary.categories.push({ category_id: 8, name: "Ahorro", planned: 500000, spent: 300000, deleted: false, withdrawn: 200000 });

  const byName = Object.fromEntries(buildDashboard(summary).categories.map((c) => [c.name, c]));

  assert.equal(byName.Ahorro.withdrawn, 200000);
  assert.equal(byName.Ahorro.items[0].status, "saved");
  assert.equal(byName.Ahorro.items[0].spent, 500000);
  assert.equal(byName.Comida.withdrawn, 0);
});
