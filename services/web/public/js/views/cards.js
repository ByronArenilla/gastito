// Tarjetas (spec 012, RF-19 a RF-23): la lista de las activas, añadir y
// editar, el estado de una tarjeta, pagar todo y eliminar.
import { cardForm, cardLine, payoffResult, payoffText, purchaseMeta } from "../cards.js";
import { h } from "../dom.js";
import { formatPesos, monthName } from "../format.js";
import { field, formError, nameConflict, OFFLINE_SAVE, setBusy, showErrors } from "./form.js";

const MISSING_MESSAGES = {
  name: "Escribe el nombre de la tarjeta.",
  cutoff_day: "Escribe el día de corte, de 1 a 31.",
  due_day: "Escribe el día límite de pago, de 1 a 31.",
};

const base = (app) => `/spaces/${app.space.id}`;

/** La pestaña Tarjetas (RF-19): las activas con su saldo y lo de este mes. */
export async function renderCards(main, app) {
  const cards = await app.api.get(`${base(app)}/cards`);
  const statuses = await Promise.all(cards.map((card) => app.api.get(`${base(app)}/cards/${card.id}/status`)));
  const add = h("a", { class: "button button--quiet", href: "/tarjetas/nueva" }, "Añadir tarjeta");

  const list = cards.length
    ? h(
        "div",
        { class: "rows" },
        statuses.map((status) => {
          const thisMonth = status.months[0];
          return h(
            "a",
            { class: "entry", href: `/tarjetas/${status.card.id}` },
            h("span", {}, status.card.name),
            h("span", { class: "figure" }, formatPesos(status.balance)),
            h(
              "span",
              { class: "entry__meta" },
              `${cardLine(status.card)} · ${
                thisMonth ? `a pagar en ${monthName(thisMonth.period)} ${formatPesos(thisMonth.to_pay)}` : "nada por pagar"
              }`,
            ),
          );
        }),
      )
    : h(
        "p",
        { class: "empty" },
        "Este espacio todavía no tiene tarjetas. ",
        h("a", { href: "/tarjetas/nueva" }, "Añade la primera"),
        " para registrar compras a crédito.",
      );

  main.append(
    h(
      "div",
      { class: "screen" },
      h("div", { class: "screen__head" }, h("h1", {}, "Tarjetas"), add),
      list,
      cards.length > 0 && h("p", { class: "muted" }, "El número de la derecha es el saldo pendiente de cada tarjeta."),
    ),
  );
}

/** Añadir o editar una tarjeta (RF-20). `card` es `null` al añadir. */
function cardFormView(main, app, card) {
  const name = h("input", { class: "input", name: "name", autocomplete: "off", maxlength: 50, value: card?.name ?? "" });
  const cutoff = h("input", {
    class: "input",
    name: "cutoff_day",
    inputmode: "numeric",
    autocomplete: "off",
    value: card ? String(card.cutoff_day) : "",
  });
  const due = h("input", {
    class: "input",
    name: "due_day",
    inputmode: "numeric",
    autocomplete: "off",
    value: card ? String(card.due_day) : "",
  });
  const rate = h("input", {
    class: "input",
    name: "monthly_rate",
    inputmode: "decimal",
    autocomplete: "off",
    value: card?.monthly_rate == null ? "" : String(card.monthly_rate).replace(".", ","),
  });
  const busyLabel = "Guardando…";
  const submit = h(
    "button",
    { class: "button button--block", type: "submit", "data-sends": true },
    card ? "Guardar cambios" : "Añadir tarjeta",
  );
  const back = card ? `/tarjetas/${card.id}` : "/tarjetas";

  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
        const { body, missing } = cardForm({ name: name.value, cutoffDay: cutoff.value, dueDay: due.value, rate: rate.value });
        if (missing.length) {
          const fields = Object.fromEntries(missing.map((key) => [key, MISSING_MESSAGES[key]]));
          return showErrors(form, { message: Object.values(fields)[0], fields });
        }
        setBusy(submit, true, busyLabel);
        try {
          const saved = card
            ? await app.api.patch(`${base(app)}/cards/${card.id}`, body)
            : await app.api.post(`${base(app)}/cards`, body);
          app.notices.show({ text: `Tarjeta «${saved.name}» guardada.`, seconds: 6 });
          app.navigate(`/tarjetas/${saved.id}`);
        } catch (error) {
          showErrors(form, nameConflict(error));
          setBusy(submit, false, busyLabel);
        }
      },
    },
    formError(),
    h(
      "div",
      { class: "rows" },
      field({ id: "card-name", label: "Nombre", control: name }),
      field({ id: "card-cutoff", label: "Corte", control: cutoff, hint: "Día del mes en que cierra el extracto." }),
      field({ id: "card-due", label: "Pago", control: due, hint: "Día límite para pagarla." }),
      field({ id: "card-rate", label: "Tasa", control: rate, hint: "Mensual, en porcentaje. Opcional; por ejemplo 1,89." }),
    ),
    h("div", { class: "submit" }, submit),
  );

  main.append(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "screen__head" },
        h("h1", {}, card ? `Editar «${card.name}»` : "Añadir tarjeta"),
        h("a", { class: "button button--link", href: back }, "Volver"),
      ),
      !card &&
        h(
          "p",
          { class: "muted" },
          "Si la tarjeta estaba eliminada, crearla con el mismo nombre la restaura con sus días y su tasa de antes.",
        ),
      form,
    ),
  );
  name.focus();
}

export async function renderCardNew(main, app) {
  cardFormView(main, app, null);
}

export async function renderCardEdit(main, app, { id }) {
  const status = await app.api.get(`${base(app)}/cards/${id}/status`);
  cardFormView(main, app, status.card);
}

/** El estado de una tarjeta (RF-21), pagar todo (RF-23) y eliminar (RF-22).
 * También abre una archivada (decisión 18). */
export async function renderCard(main, app, { id }) {
  const path = `${base(app)}/cards/${id}`;
  const [status, summary] = await Promise.all([app.api.get(`${path}/status`), app.api.get(`${base(app)}/summary`)]);
  const { card } = status;
  // El mes actual en `TZ` lo da la API (decisión 10).
  const current = summary.period;

  const months = status.months.length
    ? h(
        "ul",
        { class: "ledger" },
        status.months.map((month) =>
          h(
            "li",
            { class: "ledger__row" },
            h(
              "span",
              {},
              monthName(month.period),
              month.statement !== null && h("span", { class: "label" }, " · extracto"),
              month.prepayments > 0 && h("span", { class: "muted" }, ` · con abonos de ${formatPesos(month.prepayments)}`),
            ),
            h("span", { class: "figure" }, formatPesos(month.to_pay)),
          ),
        ),
      )
    : h("p", { class: "empty" }, "No hay nada por pagar desde este mes.");

  const purchases = status.purchases.length
    ? h(
        "div",
        { class: "rows" },
        status.purchases.map((purchase) =>
          h(
            "a",
            { class: "entry", href: `/compras/${purchase.expense_id}` },
            h("span", {}, purchase.name),
            h("span", { class: "figure" }, formatPesos(purchase.amount)),
            h("span", { class: "entry__meta" }, purchaseMeta(purchase)),
          ),
        ),
      )
    : h("p", { class: "empty" }, "No hay compras con cuotas pendientes.");

  const payoff = h(
    "button",
    {
      type: "button",
      class: "button button--quiet button--block",
      "data-sends": true,
      onClick: async () => {
        if (!app.connection.online()) return;
        const confirmed = await app.confirm({
          title: `¿Pagar todo «${card.name}» en ${monthName(current)}?`,
          body: payoffText(card, current),
          confirmLabel: "Pagar todo",
        });
        if (!confirmed) return;
        payoff.disabled = true;
        try {
          const result = await app.api.post(`${path}/payoff`, { period: current });
          app.notices.show({ text: payoffResult(card, result), seconds: 0 });
          app.navigate(`/tarjetas/${card.id}`, { replace: true });
        } catch (error) {
          payoff.disabled = false;
          app.notices.show({ text: error.message, kind: "error", seconds: 0 });
        }
      },
    },
    `Pagar todo en ${monthName(current)}`,
  );

  const remove =
    !card.deleted &&
    h(
      "button",
      {
        type: "button",
        class: "button button--danger button--block",
        "data-sends": true,
        onClick: async () => {
          if (!app.connection.online()) return;
          const confirmed = await app.confirm({
            title: `¿Eliminar «${card.name}»?`,
            body: "Sus compras, cuotas, abonos y extractos no se borran: las cuotas pendientes siguen llegando a Deudas.",
            confirmLabel: "Eliminar tarjeta",
            danger: true,
          });
          if (!confirmed) return;
          try {
            const result = await app.api.del(path);
            // El mensaje de la API dice qué pasa y cómo restaurarla (decisión 19).
            app.notices.show({ text: result.message, seconds: 0 });
            app.navigate("/tarjetas");
          } catch (error) {
            app.notices.show({ text: error.message, kind: "error", seconds: 0 });
          }
        },
      },
      "Eliminar tarjeta",
    );

  main.append(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "screen__head" },
        h("h1", {}, card.name, card.deleted && h("span", { class: "label" }, " · eliminada")),
        h("a", { class: "button button--link", href: "/tarjetas" }, "Volver a Tarjetas"),
      ),
      h("p", { class: "muted" }, cardLine(card)),
      card.deleted &&
        h(
          "p",
          { class: "muted" },
          "Esta tarjeta está eliminada: sus cuotas siguen llegando. Para usarla en compras nuevas, créala de nuevo con el mismo nombre.",
        ),
      h(
        "ul",
        { class: "ledger" },
        h(
          "li",
          { class: "ledger__row ledger__row--total" },
          h("span", {}, "Saldo pendiente"),
          h("span", { class: "figure" }, formatPesos(status.balance)),
        ),
      ),
      h("section", { class: "stack", "aria-labelledby": "card-months" }, h("h2", { class: "label", id: "card-months" }, "A pagar"), months),
      h(
        "section",
        { class: "stack", "aria-labelledby": "card-purchases" },
        h("h2", { class: "label", id: "card-purchases" }, "Compras con cuotas pendientes"),
        purchases,
      ),
      h(
        "div",
        { class: "stack" },
        payoff,
        h("a", { class: "button button--quiet button--block", href: `/tarjetas/${card.id}/editar` }, "Editar tarjeta"),
        remove,
      ),
    ),
  );
}
