// Una compra con tarjeta (spec 012, RF-24 a RF-26): su plan de cuotas, sus
// abonos, abonar con "Deshacer" y borrar un abono con confirmación.
import { h } from "../dom.js";
import { formatDay, formatMonth, formatNumber, formatPesos, monthName, parseAmount } from "../format.js";
import { prepaymentEffect, prepaymentMonths } from "../purchases.js";
import { field, formError, OFFLINE_SAVE, setBusy, showErrors } from "./form.js";

const REDUCES = { term: "baja el plazo", installment: "baja la cuota" };

const short = (period) => monthName(period).slice(0, 3);

/** El plan de cuotas como tabla de cifras (RF-24): las cuotas de meses ya
 * pasados en el texto secundario y cada abono debajo de la cuota de su mes. */
function scheduleTable(schedule, current) {
  const rows = [];
  for (const row of schedule.installments) {
    rows.push(
      h(
        "tr",
        { class: row.period < current ? "is-past" : null },
        h("td", {}, `${short(row.period)} ${row.period.slice(2, 4)}`),
        h("td", {}, `${row.number}/${row.count}`),
        h("td", {}, formatNumber(row.capital)),
        h("td", {}, formatNumber(row.interest)),
        h("td", {}, formatNumber(row.amount)),
        h("td", {}, formatNumber(row.balance_after)),
      ),
    );
    for (const prepayment of schedule.prepayments.filter((item) => item.period === row.period)) {
      rows.push(
        h(
          "tr",
          { class: "is-prepayment" },
          h("td", {}, `${short(prepayment.period)} ${prepayment.period.slice(2, 4)}`),
          h("td", {}, "abono"),
          h("td", {}, formatNumber(prepayment.amount)),
          h("td", {}, ""),
          h("td", {}, formatNumber(prepayment.amount)),
          h("td", {}, ""),
        ),
      );
    }
  }
  return h(
    "div",
    { class: "scroll-x" },
    h(
      "table",
      { class: "schedule" },
      h("caption", { class: "sr-only" }, "Plan de cuotas"),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ["Mes", "Cuota", "Capital", "Interés", "Total", "Saldo"].map((title) => h("th", { scope: "col" }, title)),
        ),
      ),
      h("tbody", {}, rows),
    ),
  );
}

export async function renderPurchase(main, app, { id }) {
  const base = `/spaces/${app.space.id}`;
  const path = `${base}/expenses/${id}`;
  const [expense, summary] = await Promise.all([app.api.get(path), app.api.get(`${base}/summary`)]);
  // El nombre de la tarjeta también si está archivada: su estado sí lo da.
  const status = await app.api.get(`${base}/cards/${expense.card_id}/status`);
  const card = status.card;
  const current = summary.period;
  const name = expense.description ?? "Compra";
  const body = h("div", { class: "screen" });

  main.append(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "screen__head" },
        h("h1", {}, name),
        h("a", { class: "button button--link", href: `/tarjetas/${card.id}` }, `Volver a ${card.name}`),
      ),
      body,
    ),
  );

  async function load() {
    const schedule = await app.api.get(`${path}/installments`);
    paint(schedule);
    app.refreshSending();
  }

  /** Borra un abono con `confirm=true` (decisión 18 de la 009). */
  async function deletePrepayment(prepayment) {
    await app.api.del(`${path}/prepayments/${prepayment.id}`, { confirm: "true" });
  }

  function paint(schedule) {
    const count = schedule.installments.at(-1)?.count ?? expense.installments;
    const kind = expense.is_debt ? "deuda" : "gasto del mes";

    const prepayments = schedule.prepayments.length
      ? h(
          "div",
          {},
          schedule.prepayments.map((prepayment) =>
            h(
              "div",
              { class: "item" },
              h("span", {}, `${formatMonth(prepayment.period)} · ${REDUCES[prepayment.reduces]}`),
              h("span", { class: "figure" }, formatPesos(prepayment.amount)),
              h(
                "div",
                { class: "item__note" },
                h("span", {}),
                h(
                  "button",
                  {
                    type: "button",
                    class: "button button--link",
                    "data-sends": true,
                    onClick: async () => {
                      if (!app.connection.online()) return;
                      // Un abono es plata que salió: se borra solo al confirmar
                      // (RF-26, principio 8).
                      const confirmed = await app.confirm({
                        title: "¿Borrar este abono?",
                        body: `${formatPesos(prepayment.amount)} en ${formatMonth(prepayment.period)}. Las cuotas de «${name}» se recalculan sin él.`,
                        confirmLabel: "Borrar abono",
                        danger: true,
                      });
                      if (!confirmed) return;
                      try {
                        await deletePrepayment(prepayment);
                        app.notices.show({ text: "Abono borrado. El plan de cuotas se recalculó.", seconds: 6 });
                        await load();
                      } catch (error) {
                        app.notices.show({ text: error.message, kind: "error", seconds: 0 });
                      }
                    },
                  },
                  "Borrar abono",
                ),
              ),
            ),
          ),
        )
      : h("p", { class: "empty" }, "Esta compra no tiene abonos.");

    body.replaceChildren(
      h(
        "ul",
        { class: "ledger" },
        h("li", { class: "ledger__row" }, h("span", {}, "Monto"), h("span", { class: "figure" }, formatPesos(expense.amount))),
        h("li", { class: "ledger__row" }, h("span", {}, "Fecha"), h("span", { class: "figure" }, formatDay(expense.spent_on))),
        h(
          "li",
          { class: "ledger__row" },
          h("span", {}, "Tarjeta"),
          h("span", {}, `${card.name} · ${count} ${count === 1 ? "cuota" : "cuotas"} · ${kind}`),
        ),
      ),
      h("section", { class: "stack", "aria-labelledby": "purchase-plan" }, h("h2", { class: "label", id: "purchase-plan" }, "Plan de cuotas"), scheduleTable(schedule, current)),
      h("section", { class: "stack", "aria-labelledby": "purchase-prepayments" }, h("h2", { class: "label", id: "purchase-prepayments" }, "Abonos"), prepayments),
      prepaymentForm(schedule),
    );
  }

  /** Abonar (RF-25): monto, mes y si baja la cuota o el plazo. Se guarda y el
   * aviso dice el efecto, con "Deshacer" (decisión 7). */
  function prepaymentForm(schedule) {
    const months = prepaymentMonths(schedule);
    if (!months.length) {
      return h("p", { class: "muted" }, "No quedan meses con saldo para abonar a esta compra.");
    }
    const amount = h("input", {
      class: "input figure-input",
      name: "amount",
      inputmode: "numeric",
      autocomplete: "off",
      placeholder: "$ 0",
      onInput: () => {
        const value = parseAmount(amount.value);
        amount.value = value === null ? "" : formatNumber(value);
      },
    });
    const month = h(
      "select",
      { class: "select", name: "period" },
      months.map((period) => h("option", { value: period }, formatMonth(period))),
    );
    let reduces = "term";
    const choice = (value, text) =>
      h(
        "button",
        {
          type: "button",
          "aria-pressed": String(value === reduces),
          onClick: (event) => {
            reduces = value;
            for (const button of event.currentTarget.parentElement.children) {
              button.setAttribute("aria-pressed", String(button === event.currentTarget));
            }
          },
        },
        text,
      );
    const reducesRow = h(
      "div",
      { class: "row", dataset: { field: "reduces" } },
      h("span", { class: "label", id: "reduces-label" }, "Baja"),
      h("div", { class: "seg", role: "group", "aria-labelledby": "reduces-label" }, choice("term", "el plazo"), choice("installment", "la cuota")),
      h("p", { class: "row__error", hidden: true }),
    );
    const busyLabel = "Abonando…";
    const submit = h("button", { class: "button button--block", type: "submit", "data-sends": true }, "Abonar");

    const form = h(
      "form",
      {
        class: "stack",
        novalidate: true,
        "aria-labelledby": "purchase-pay",
        onSubmit: async (event) => {
          event.preventDefault();
          if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
          const value = parseAmount(amount.value);
          if (value === null) {
            return showErrors(form, { message: "Escribe el monto del abono.", fields: { amount: "Escribe el monto del abono." } });
          }
          setBusy(submit, true, busyLabel);
          try {
            const result = await app.api.post(`${path}/prepayments`, { amount: value, period: month.value, reduces });
            const effect = prepaymentEffect(schedule, result.schedule, result.prepayment);
            app.notices.show({
              text: `Abono de ${formatPesos(value)} en ${monthName(result.prepayment.period)}. ${effect}`,
              action: {
                label: "Deshacer",
                // Pulsar "Deshacer" es la confirmación explícita del borrado,
                // como al registrar un gasto (decisión 13 de la 011).
                onClick: async () => {
                  try {
                    await deletePrepayment(result.prepayment);
                    app.notices.show({ text: "Abono deshecho.", seconds: 6 });
                    await load();
                  } catch (error) {
                    app.notices.show({ text: error.message, kind: "error", seconds: 0 });
                  }
                },
              },
            });
            paint(result.schedule);
            app.refreshSending();
          } catch (error) {
            showErrors(form, error);
            setBusy(submit, false, busyLabel);
          }
        },
      },
      h("h2", { class: "label", id: "purchase-pay" }, "Abonar"),
      formError(),
      h(
        "div",
        { class: "rows" },
        field({ id: "prepayment-amount", label: "Monto", control: amount }),
        field({ id: "prepayment-period", label: "Mes", control: month }),
        reducesRow,
      ),
      h("p", { class: "muted" }, "Solo se ofrecen los meses con cuota después del último abono y con saldo después de la cuota."),
      h("div", {}, submit),
    );
    return form;
  }

  await load();
}
