// Mes y Planear (spec 012). El Mes es el tablero de un periodo: totales, la
// barra del ingreso, las categorías con sus rubros y las tarjetas (RF-5 a
// RF-9). Un mes sin plan ofrece copiar el del mes anterior o planear en blanco
// (RF-10, RF-11). Planear es el mismo mes en modo edición (RF-12 a RF-18).
import { buildDashboard, copyNotice } from "../dashboard.js";
import { h } from "../dom.js";
import { formatMonth, formatNumber, formatPesos, monthName, parseAmount, shiftPeriod } from "../format.js";
import { missingText, needsConfirm, rowRequest, statementRequest } from "../plan-rows.js";
import { OFFLINE_SAVE } from "./form.js";

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
    // Lo retirado del ahorro en el mes (spec 013, RF-36): la cifra de la
    // categoría ya lo descuenta.
    category.withdrawn > 0 &&
      h(
        "div",
        { class: "item" },
        h("span", { class: "muted" }, "Retirado del ahorro"),
        h("span", { class: "figure" }, formatPesos(-category.withdrawn)),
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

// --- Planear (RF-12 a RF-18) ---

const FIELD_OF = { name: "name", category_id: "categoryId", amount: "amount" };

/** Cuánto dura "Guardado" junto al renglón. */
const SAVED_SECONDS = 4;

/** Un renglón de Planear: un `<fieldset>` que se guarda cuando el foco sale
 * de él (decisión 5). `original` es `null` en uno nuevo. */
function planRow(ctx, kind, original, { categories = [] } = {}) {
  const { app, base, period, pending } = ctx;
  const isItem = kind === "item";
  const noun = isItem ? "Rubro" : "Ingreso";
  const legend = h("legend", { class: "sr-only" }, original ? `${noun} ${original.name}` : `${noun} nuevo`);
  const name = h("input", {
    class: "input",
    name: "name",
    autocomplete: "off",
    placeholder: isItem ? "Nombre del rubro" : "Nombre del ingreso",
    value: original?.name ?? "",
  });
  const category =
    isItem &&
    h(
      "select",
      { class: "select", name: "categoryId" },
      h("option", { value: "" }, "Categoría"),
      categories.map((option) =>
        h("option", { value: String(option.id), selected: option.id === original?.categoryId }, option.name),
      ),
    );
  const amount = h("input", {
    class: "input figure-input",
    name: "amount",
    inputmode: "numeric",
    autocomplete: "off",
    placeholder: "$ 0",
    value: original ? formatNumber(original.amount) : "",
    onInput: () => {
      const value = parseAmount(amount.value);
      amount.value = value === null ? "" : formatNumber(value);
    },
  });
  const status = h("span", { class: "plan-row__status", "aria-live": "polite" });
  const remove = h("button", { type: "button", class: "button button--link", onClick: () => quit() }, "Quitar");
  const label = (text, control, extra = "") => h("label", { class: extra }, h("span", { class: "sr-only" }, text), control);
  const row = h(
    "fieldset",
    { class: isItem ? "plan-row" : "plan-row plan-row--income" },
    legend,
    label("Nombre", name, "plan-row__name"),
    category && label("Categoría", category),
    label("Monto", amount),
    remove,
    status,
  );
  let saved = original;
  let timer = null;

  const controls = () => [name, category, amount].filter(Boolean);
  const values = () => ({ name: name.value, categoryId: category ? category.value : undefined, amount: amount.value });

  function say(text, error = false) {
    clearTimeout(timer);
    status.textContent = text;
    status.classList.toggle("plan-row__status--error", error);
    if (text && !error) timer = setTimeout(() => (status.textContent = ""), SAVED_SECONDS * 1000);
  }

  function markInvalid(fields) {
    for (const control of controls()) control.removeAttribute("aria-invalid");
    for (const field of fields) row.querySelector(`[name="${field}"]`)?.setAttribute("aria-invalid", "true");
  }

  async function save() {
    // Ya hay un envío de este renglón en curso: no se manda otro (RF-18).
    if (row.disabled) return;
    const request = rowRequest(kind, saved, values(), period);
    if (request.missing.length) {
      markInvalid(request.missing.map((word) => ({ nombre: "name", categoría: "categoryId", monto: "amount" })[word]));
      say(missingText(request.missing), true);
      return;
    }
    markInvalid([]);
    if (request.action === "none") return;
    if (!app.connection.online()) {
      say(OFFLINE_SAVE, true);
      return;
    }
    // Un envío por renglón a la vez (RF-18): dos salidas seguidas no crean
    // dos rubros.
    row.disabled = true;
    const path = `${base}/${isItem ? "budget-items" : "incomes"}`;
    try {
      const result =
        request.action === "create"
          ? await app.api.post(path, request.body)
          : await app.api.patch(`${path}/${saved.id}`, request.body);
      saved = {
        id: result.id,
        name: result.name,
        amount: result.amount,
        categoryId: result.category_id,
        spent: saved?.spent ?? 0,
      };
      legend.textContent = `${noun} ${saved.name}`;
      say("Guardado");
    } catch (error) {
      // El mensaje de la API junto al renglón; lo escrito se queda (RF-13).
      const fields = Object.keys(error.fields ?? {}).map((field) => FIELD_OF[field]).filter(Boolean);
      markInvalid(fields.length ? fields : error.status === 409 ? ["name"] : []);
      say(error.message, true);
    } finally {
      row.disabled = false;
    }
  }

  async function quit() {
    if (!saved) {
      row.remove();
      return;
    }
    if (!app.connection.online()) {
      say(OFFLINE_SAVE, true);
      return;
    }
    if (isItem && needsConfirm(saved)) {
      const confirmed = await app.confirm({
        title: `¿Quitar «${saved.name}»?`,
        body: `Sus gastos de ${monthName(period)} (${formatPesos(saved.spent)}) no se borran: quedan sin rubro, en su categoría.`,
        confirmLabel: "Quitar rubro",
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      await app.api.del(`${base}/${isItem ? "budget-items" : "incomes"}/${saved.id}`);
      row.remove();
      app.notices.show({ text: `Quitado: ${saved.name}.`, seconds: 6 });
    } catch (error) {
      say(error.message, true);
    }
  }

  row.addEventListener("focusout", (event) => {
    // Cambiar de campo dentro del mismo renglón no guarda a medias.
    if (row.contains(event.relatedTarget)) return;
    const saving = save();
    pending.add(saving);
    saving.finally(() => pending.delete(saving));
  });

  return { element: row, focus: () => name.focus(), hasError: () => status.classList.contains("plan-row__status--error") };
}

/** El extracto real de una tarjeta en el mes (RF-17, decisión 6). */
function statementRow(ctx, card) {
  const { app, base, period, pending } = ctx;
  let saved = card.statement;
  const input = h("input", {
    class: "input figure-input",
    id: `statement-${card.id}`,
    inputmode: "numeric",
    autocomplete: "off",
    placeholder: "Sin extracto",
    value: saved === null ? "" : formatNumber(saved),
    onInput: () => {
      const value = parseAmount(input.value);
      input.value = value === null ? "" : formatNumber(value);
    },
  });
  const status = h("span", { class: "plan-row__status", "aria-live": "polite" });
  const estimate = () =>
    saved === null
      ? `Estimado: ${formatPesos(card.estimated)}.`
      : `Reemplaza lo estimado (${formatPesos(card.estimated)}).`;
  status.textContent = estimate();
  const clear = h(
    "button",
    {
      type: "button",
      class: "button button--link",
      onClick: () => {
        input.value = "";
        send();
      },
    },
    "Quitar extracto",
  );
  const row = h(
    "fieldset",
    { class: "plan-row plan-row--income" },
    h("legend", { class: "sr-only" }, `Extracto de ${card.name}`),
    h(
      "label",
      { class: "plan-row__name", for: input.id },
      h("span", {}, card.name),
      card.deleted && h("span", { class: "muted" }, " · eliminada"),
      h("span", { class: "label" }, " · extracto real"),
    ),
    input,
    clear,
    status,
  );

  async function send() {
    // Deshabilitar el renglón le quita el foco al botón y dispara otro
    // `focusout`: sin esto, "Quitar extracto" se enviaría dos veces.
    if (row.disabled) return;
    const request = statementRequest(saved, input.value);
    if (request.action === "none") return;
    if (!app.connection.online()) {
      status.textContent = OFFLINE_SAVE;
      status.classList.add("plan-row__status--error");
      return;
    }
    row.disabled = true;
    const path = `${base}/cards/${card.id}/statements/${period}`;
    try {
      if (request.action === "put") saved = (await app.api.put(path, request.body)).amount;
      else {
        await app.api.del(path);
        saved = null;
      }
      status.classList.remove("plan-row__status--error");
      status.textContent = `Guardado. ${estimate()}`;
    } catch (error) {
      input.setAttribute("aria-invalid", "true");
      status.classList.add("plan-row__status--error");
      status.textContent = error.message;
    } finally {
      row.disabled = false;
    }
  }

  row.addEventListener("focusout", (event) => {
    if (row.contains(event.relatedTarget)) return;
    input.removeAttribute("aria-invalid");
    const saving = send();
    pending.add(saving);
    saving.finally(() => pending.delete(saving));
  });
  return row;
}

export async function renderPlan(main, app) {
  const base = `/spaces/${app.space.id}`;
  const [categories, cards] = await Promise.all([
    app.api.get(`${base}/categories`),
    app.api.get(`${base}/cards`),
  ]);
  const title = h("h1", { "aria-live": "polite" });
  const body = h("div", { class: "screen" });
  const pending = new Set();
  let rows = [];

  const done = h(
    "button",
    {
      type: "button",
      class: "button",
      onClick: async () => {
        // "Listo" espera lo que se esté guardando; si un renglón quedó con
        // error, se queda para corregirlo.
        if (main.contains(document.activeElement)) document.activeElement.blur();
        await Promise.allSettled([...pending]);
        const broken = rows.find((row) => row.hasError());
        if (broken) {
          broken.focus();
          return;
        }
        app.navigate("/mes");
      },
    },
    "Listo",
  );

  main.classList.add("main--wide");
  main.append(
    h(
      "div",
      { class: "screen" },
      monthHead(app, h("div", {}, h("p", { class: "label" }, "Planear"), title), load),
      h("div", { class: "cluster" }, done),
      h("p", { class: "muted" }, "Cada renglón se guarda al salir de él."),
      body,
    ),
  );

  function paint(summary) {
    const period = summary.period;
    title.textContent = capitalize(formatMonth(period));
    app.setMonth(period);
    const ctx = { app, base, period, pending };
    // Las categorías activas; la de un rubro cuya categoría se eliminó sigue
    // en su lista para no cambiarla sin querer (RF-42 de la 008).
    const options = categories.map((row) => ({ id: row.id, name: row.name }));
    for (const row of summary.categories) {
      if (row.deleted) options.push({ id: row.category_id, name: `${row.name} (eliminada)` });
    }
    rows = [];
    const make = (kind, original) => {
      const row = planRow(ctx, kind, original, { categories: options });
      rows.push(row);
      return row;
    };
    const incomes = h(
      "div",
      { class: "plan-rows" },
      summary.incomes.map((row) => make("income", { id: row.id, name: row.name, amount: row.amount }).element),
    );
    const items = h(
      "div",
      { class: "plan-rows" },
      summary.budget_items.map(
        (row) =>
          make("item", {
            id: row.id,
            name: row.name,
            categoryId: row.category_id,
            amount: row.planned,
            spent: row.spent,
          }).element,
      ),
    );
    const add = (kind, list, text) =>
      h(
        "button",
        {
          type: "button",
          class: "button button--link",
          onClick: () => {
            const row = make(kind, null);
            list.append(row.element);
            row.focus();
          },
        },
        text,
      );

    // Las tarjetas activas y las archivadas con algo en el mes (RF-17).
    const debts = new Map(summary.debts.map((debt) => [debt.card_id, debt]));
    const statementCards = [
      ...cards.map((card) => ({ id: card.id, name: card.name, deleted: false })),
      ...summary.debts.filter((debt) => debt.deleted).map((debt) => ({ id: debt.card_id, name: debt.name, deleted: true })),
    ].map((card) => ({
      ...card,
      estimated: debts.get(card.id)?.estimated ?? 0,
      statement: debts.get(card.id)?.statement ?? null,
    }));

    body.replaceChildren(
      h("section", { class: "stack", "aria-labelledby": "plan-incomes" }, h("h2", { class: "label", id: "plan-incomes" }, "Ingresos"), incomes, h("div", {}, add("income", incomes, "Añadir ingreso"))),
      h("section", { class: "stack", "aria-labelledby": "plan-items" }, h("h2", { class: "label", id: "plan-items" }, "Rubros"), items, h("div", {}, add("item", items, "Añadir rubro"))),
      statementCards.length > 0 &&
        h(
          "section",
          { class: "stack", "aria-labelledby": "plan-statements" },
          h("h2", { class: "label", id: "plan-statements" }, `Extractos de ${monthName(period)}`),
          statementCards.map((card) => statementRow(ctx, card)),
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
