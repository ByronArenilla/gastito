// Mes y Planear (spec 012). El Mes es el tablero de un periodo: totales, la
// barra del ingreso, las categorías con sus rubros y las tarjetas (RF-5 a
// RF-9). Un mes sin plan ofrece copiar el del mes anterior o planear en blanco
// (RF-10, RF-11). Planear (RF-12 a RF-18) se completa en T6.
import { buildDashboard, copyNotice } from "../dashboard.js";
import { h } from "../dom.js";
import { formatMonth, formatNumber, formatPesos, monthName, shiftPeriod } from "../format.js";

const PART_NAMES = { items: "Rubros", debts: "Deudas", free: "Sin asignar" };

/** Fija una propiedad CSS desde JavaScript: la CSP no deja escribir `style`
 * en el HTML, pero sí cambiarlo así (plan 012, "Barras"). */
function withVar(element, name, value) {
  element.style.setProperty(name, String(value));
  return element;
}

/** Un monto que puede ser negativo: en rojo y con el signo (principio 4). */
function signedFigure(amount) {
  return h("span", { class: amount < 0 ? "figure over" : "figure" }, formatPesos(amount));
}

/** El mes elegido, compartido con Planear y Gastos (decisión 9). Sin elegir,
 * el actual, que dice la API (decisión 10). */
async function loadSummary(app, base) {
  const period = app.drafts.get("period");
  const summary = await app.api.get(`${base}/summary`, period ? { period } : undefined);
  app.drafts.set("period", summary.period);
  return summary;
}

function monthHead(app, title, onMove) {
  const move = (months) => {
    app.drafts.set("period", shiftPeriod(app.drafts.get("period"), months));
    app.notices.dismiss();
    onMove();
  };
  return h(
    "div",
    { class: "screen__head" },
    title,
    h(
      "div",
      { class: "month-switch" },
      h("button", { type: "button", "aria-label": "Mes anterior", onClick: () => move(-1) }, "‹"),
      h("button", { type: "button", "aria-label": "Mes siguiente", onClick: () => move(1) }, "›"),
    ),
  );
}

function totalsBlock(board) {
  const { totals } = board;
  const row = (label, figure, extra = "") =>
    h("li", { class: `ledger__row${extra}` }, h("span", {}, label), figure);
  return h(
    "ul",
    { class: "ledger", "aria-label": "Totales del mes" },
    row("Ingresos", h("span", { class: "figure" }, formatPesos(totals.income))),
    row("Planeado", h("span", { class: "figure" }, formatPesos(totals.planned))),
    row("Gastado", h("span", { class: "figure" }, formatPesos(totals.spent))),
    row("Sin asignar", signedFigure(totals.unassigned)),
    row("Balance", signedFigure(totals.balance), " ledger__row--total"),
  );
}

/** La barra del ingreso (RF-6): oculta al lector de pantalla, porque la
 * leyenda de abajo dice lo mismo con cifras (decisión 15). */
function incomeBlock(board) {
  const { parts, over } = board.incomeBar;
  const bar = h(
    "div",
    { class: over > 0 ? "income-bar income-bar--over" : "income-bar", "aria-hidden": "true" },
    parts.map((part) =>
      withVar(h("span", { class: `income-bar__part income-bar__part--${part.key}` }), "--grow", part.share),
    ),
  );
  return h(
    "div",
    { class: "stack" },
    h("h2", { class: "label" }, "Cómo se reparte el ingreso"),
    bar,
    over > 0 &&
      h("p", { class: "over" }, `Planeas ${formatPesos(over)} más de lo que ingresa.`),
    h(
      "ul",
      { class: "legend" },
      parts.map((part) =>
        h(
          "li",
          {},
          h("span", { class: `swatch swatch--${part.key}`, "aria-hidden": "true" }),
          h("span", {}, PART_NAMES[part.key]),
          h("span", { class: "figure" }, formatPesos(part.amount)),
        ),
      ),
    ),
  );
}

/** Un rubro con su medidor (RF-8): lo excedido lleva palabra y signo. */
function itemRow(item) {
  const meter = h(
    "div",
    { class: item.exceeded ? "item__meter meter meter--over" : "item__meter meter", "aria-hidden": "true" },
    withVar(h("div", { class: "meter__fill" }), "--fill", item.fill),
  );
  const left = item.exceeded
    ? h("span", { class: "over" }, `excedido ${formatNumber(item.remaining)}`)
    : h("span", {}, `queda ${formatPesos(item.remaining)}`);
  return h(
    "div",
    { class: "item" },
    h("span", {}, item.name),
    h("span", { class: "figure" }, formatPesos(item.spent)),
    meter,
    h("div", { class: "item__note" }, h("span", {}, `de ${formatNumber(item.planned)}`), left),
  );
}

function categoryBlock(category) {
  return h(
    "section",
    { class: "category", "aria-label": category.name },
    h(
      "div",
      { class: "category__head" },
      h(
        "h3",
        { class: "label" },
        category.name,
        category.deleted && h("span", { class: "muted" }, " · eliminada"),
      ),
      h(
        "span",
        { class: category.exceeded ? "figure over" : "figure muted" },
        `${formatNumber(category.spent)} de ${formatNumber(category.planned)}`,
      ),
    ),
    category.items.map(itemRow),
    category.unplanned > 0 &&
      h(
        "div",
        { class: "item" },
        h("span", { class: "muted" }, "Sin rubro"),
        h("span", { class: "figure" }, formatPesos(category.unplanned)),
      ),
  );
}

/** Las tarjetas del mes con lo que hay que pagarles (RF-9). Una archivada
 * enlaza igual a su estado (decisión 18). */
function cardsBlock(board, dueDays) {
  if (!board.cards.length) return null;
  const month = monthName(board.period);
  return h(
    "section",
    { class: "category", "aria-label": "Tarjetas" },
    h(
      "div",
      { class: "category__head" },
      h("h3", { class: "label" }, "Tarjetas"),
      h("span", { class: "figure muted" }, `a pagar en ${month}`),
    ),
    board.cards.map((card) => {
      const parts = [
        card.deleted ? "eliminada" : dueDays.has(card.id) && `paga el ${dueDays.get(card.id)}`,
        card.hasStatement ? "extracto real" : "estimado",
        `deuda ${formatPesos(card.debt)}`,
        card.monthExpenses > 0 && `gastos del mes ${formatPesos(card.monthExpenses)}`,
      ].filter(Boolean);
      return h(
        "a",
        { class: "entry", href: `/tarjetas/${card.id}` },
        h("span", {}, card.name),
        h("span", { class: "figure" }, formatPesos(card.toPay)),
        h("span", { class: "entry__meta" }, parts.join(" · ")),
      );
    }),
    h(
      "div",
      { class: "total" },
      h("span", {}, "A pagar a tarjetas"),
      h("span", { class: "figure" }, formatPesos(board.totals.cardsToPay)),
    ),
  );
}

export async function renderMonth(main, app) {
  const base = `/spaces/${app.space.id}`;
  const cards = await app.api.get(`${base}/cards`);
  const dueDays = new Map(cards.map((card) => [card.id, card.due_day]));

  const title = h("h1", { "aria-live": "polite" });
  const body = h("div", { class: "screen" });
  main.classList.add("main--wide");
  main.append(h("div", { class: "screen" }, monthHead(app, title, load), body));

  function paint(summary) {
    const board = buildDashboard(summary);
    const name = monthName(summary.period);
    title.textContent = capitalize(formatMonth(summary.period));
    app.setMonth(summary.period);
    if (board.empty) {
      body.replaceChildren(emptyBlock(summary.period), cardsBlock(board, dueDays));
      return;
    }
    body.replaceChildren(
      h("a", { class: "button button--quiet", href: "/mes/planear" }, `Planear ${name}`),
      totalsBlock(board),
      incomeBlock(board),
      h("div", {}, board.categories.map(categoryBlock), cardsBlock(board, dueDays)),
    );
  }

  /** Un mes sin plan: copiar el anterior o planear en blanco (RF-10). */
  function emptyBlock(period) {
    const previous = monthName(shiftPeriod(period, -1));
    const copy = h(
      "button",
      {
        type: "button",
        class: "button button--block",
        "data-sends": true,
        onClick: async () => {
          if (!app.connection.online()) return;
          copy.disabled = true;
          try {
            const result = await app.api.post(`${base}/plan/copy`, { period });
            app.notices.show({ text: copyNotice(period, result.skipped), seconds: 0 });
            paint(result.summary);
          } catch (error) {
            copy.disabled = false;
            app.notices.show({ text: error.message, kind: "error", seconds: 0 });
          }
        },
      },
      `Copiar el plan de ${previous}`,
    );
    return h(
      "div",
      { class: "stack" },
      h("p", { class: "empty" }, `${capitalize(monthName(period))} todavía no tiene plan: ni ingresos ni rubros.`),
      copy,
      h("a", { class: "button button--quiet button--block", href: "/mes/planear" }, "Planear en blanco"),
      h(
        "p",
        { class: "muted" },
        `Copiar trae los ingresos y los rubros de ${previous} con sus montos. Los gastos y los extractos no se copian.`,
      ),
    );
  }

  async function load() {
    body.replaceChildren(h("div", { class: "loading", "aria-hidden": "true" }));
    try {
      paint(await loadSummary(app, base));
    } catch (error) {
      body.replaceChildren(h("p", { class: "error", role: "alert" }, error.message));
    }
    app.refreshSending();
  }

  await load();
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export async function renderPlan(main) {
  main.append(h("div", { class: "screen" }, h("h1", {}, "Planear")));
}
