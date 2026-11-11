// El tablero del Mes a partir del resumen de la API (spec 012, RF-5 a RF-9).
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
    },
  };
}

test("los totales del mes y lo que hay que pagar a las tarjetas", () => {
  const { totals } = buildDashboard(november());

  assert.deepEqual(totals, {
    income: 6500000,
    planned: 3811340,
    spent: 3371340,
    unassigned: 2688660,
    balance: 3128660,
    cardsToPay: 361340,
  });
});

test("la barra del ingreso reparte rubros, deudas y sin asignar", () => {
  const { incomeBar } = buildDashboard(november());

  assert.deepEqual(
    incomeBar.parts.map(({ key, amount }) => [key, amount]),
    [
      ["items", 3600000],
      ["debts", 211340],
      ["free", 2688660],
    ],
  );
  const sum = incomeBar.parts.reduce((total, part) => total + part.amount, 0);
  assert.equal(sum, 6500000);
  assert.equal(incomeBar.over, 0);
  assert.ok(Math.abs(incomeBar.parts[0].share - 3600000 / 6500000) < 1e-9);
});

test("un plan que supera el ingreso dice por cuánto y no tiene parte libre", () => {
  const summary = november();
  summary.total.planned = 7000000;
  summary.total.unassigned = -500000;

  const { incomeBar } = buildDashboard(summary);

  assert.equal(incomeBar.over, 500000);
  assert.equal(incomeBar.parts.find((part) => part.key === "free").amount, 0);
  // Las partes se reparten sobre lo planeado, que es lo más grande.
  const shares = incomeBar.parts.reduce((total, part) => total + part.share, 0);
  assert.ok(Math.abs(shares - 1) < 1e-9);
});

test("un mes sin ingresos ni plan deja la barra vacía", () => {
  const summary = november();
  summary.total = { ...summary.total, income: 0, planned: 0, debts: 0, unassigned: 0 };

  const { incomeBar } = buildDashboard(summary);

  assert.ok(incomeBar.parts.every((part) => part.share === 0));
});

test("cada rubro trae su medidor, lo que queda y si se excedió", () => {
  const { categories } = buildDashboard(november());
  const items = Object.fromEntries(categories.flatMap((c) => c.items).map((i) => [i.name, i]));

  assert.ok(Math.abs(items.Mercado.fill - 520000 / 900000) < 1e-9);
  assert.equal(items.Mercado.remaining, 380000);
  assert.equal(items.Mercado.exceeded, false);
  assert.equal(items.Arriendo.fill, 1);
  assert.equal(items.Arriendo.exceeded, false);
  assert.equal(items.Gasolina.fill, 1);
  assert.equal(items.Gasolina.exceeded, true);
  assert.equal(items.Gasolina.remaining, -40000);
});

test("un rubro con planeado 0 y gasto se ve excedido", () => {
  const summary = november();
  summary.budget_items[4] = { ...summary.budget_items[4], planned: 0, remaining: -80000 };

  const salidas = buildDashboard(summary)
    .categories.flatMap((c) => c.items)
    .find((item) => item.name === "Salidas");

  assert.equal(salidas.fill, 1);
  assert.equal(salidas.exceeded, true);
});

test("las categorías del mes, en el orden de la API, con sus rubros dentro", () => {
  const { categories } = buildDashboard(november());

  // Salud no tiene rubros ni gastos en el mes: no sale.
  assert.deepEqual(
    categories.map((c) => c.name),
    ["Hogar", "Comida", "Transporte", "Ocio"],
  );
  assert.deepEqual(
    categories[0].items.map((i) => i.name),
    ["Arriendo", "Servicios"],
  );
  assert.equal(categories[2].exceeded, true);
  assert.equal(categories[0].exceeded, false);
});

test("lo no planeado es el renglón sin rubro de su categoría", () => {
  const { categories } = buildDashboard(november());
  const byName = Object.fromEntries(categories.map((c) => [c.name, c]));

  assert.equal(byName.Comida.unplanned, 120000);
  assert.equal(byName.Hogar.unplanned, 0);
});

test("una categoría eliminada con gastos sale marcada", () => {
  const summary = november();
  summary.categories.push({ category_id: 9, name: "Mascotas", planned: 0, spent: 45000, deleted: true });

  const mascotas = buildDashboard(summary).categories.at(-1);

  assert.equal(mascotas.name, "Mascotas");
  assert.equal(mascotas.deleted, true);
  assert.equal(mascotas.unplanned, 45000);
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

// --- Lo retirado del ahorro (spec 013, RF-36) ---

test("Ahorro muestra lo neto y lo retirado aparte; las demás, nada retirado", () => {
  // Agosto: rubro Ahorro de 500.000 apartado entero y 200.000 retirados. El
  // resumen ya trae Ahorro neto (300.000) y lo retirado.
  const summary = november();
  summary.budget_items.push({ id: 9, name: "Ahorro", category_id: 8, planned: 500000, spent: 500000, remaining: 0 });
  summary.categories.push({ category_id: 8, name: "Ahorro", planned: 500000, spent: 300000, deleted: false, withdrawn: 200000 });

  const byName = Object.fromEntries(buildDashboard(summary).categories.map((c) => [c.name, c]));

  assert.equal(byName.Ahorro.spent, 300000);
  assert.equal(byName.Ahorro.withdrawn, 200000);
  // El retiro no es "sin rubro": lo apartado está todo en su rubro.
  assert.equal(byName.Ahorro.unplanned, 0);
  assert.equal(byName.Ahorro.items[0].spent, 500000);
  assert.equal(byName.Comida.withdrawn, 0);
});

test("todo lo apartado retirado: Ahorro sigue en el Mes por su rubro", () => {
  const summary = november();
  summary.budget_items.push({ id: 9, name: "Ahorro", category_id: 8, planned: 500000, spent: 500000, remaining: 0 });
  summary.categories.push({ category_id: 8, name: "Ahorro", planned: 500000, spent: 0, deleted: false, withdrawn: 500000 });

  const ahorro = buildDashboard(summary).categories.find((c) => c.name === "Ahorro");

  assert.equal(ahorro.spent, 0);
  assert.equal(ahorro.withdrawn, 500000);
});
