// Retiro de ahorro (spec 013, RF-32 a RF-35): el formulario que usan
// Registrar ("Gasto | Retiro de ahorro") y la edición en `/retiros/<id>`. La
// lógica vive en `withdrawals.js`; aquí solo se arma el DOM y se llama a la
// API.
import { h } from "../dom.js";
import { formatDay, formatNumber, formatPesos, parseAmount, periodOf } from "../format.js";
import { withdrawalChanges, withdrawalRequest, withdrawalRoom } from "../withdrawals.js";
import { OFFLINE_SAVE, clearErrors, field, formError, setBusy, showErrors } from "./form.js";

/** El día de hoy en el dispositivo, `AAAA-MM-DD`. La API valida con `TZ`. */
function today() {
  return new Date().toLocaleDateString("en-CA");
}

/**
 * Monto, fecha y nota. `showRoom` pide el resumen del mes de la fecha y dice
 * cuánto se puede retirar (solo al registrar: al editar, el propio retiro ya
 * está descontado y la API decide).
 */
export function buildWithdrawalForm(app, { initial, submitLabel, busyLabel, showRoom, onSubmit }) {
  const base = `/spaces/${app.space.id}`;
  let form = { amount: "", date: today(), note: "", ...initial };
  let roomCount = 0;

  const amount = h("input", {
    class: "amount__input",
    name: "amount",
    inputmode: "numeric",
    autocomplete: "off",
    "aria-label": "Monto del retiro en pesos",
    placeholder: "0",
    value: form.amount,
    onInput: () => {
      const value = parseAmount(amount.value);
      amount.value = value === null ? "" : formatNumber(value);
      form = { ...form, amount: amount.value };
    },
  });
  const amountField = h(
    "div",
    { dataset: { field: "amount" } },
    h("div", { class: "amount" }, h("span", { class: "amount__currency", "aria-hidden": "true" }, "$"), amount),
    h("p", { class: "row__error", hidden: true }),
  );

  const date = h("input", {
    class: "input",
    type: "date",
    name: "spent_on",
    // Solo una ayuda: la regla de no aceptar fechas futuras es de la API.
    max: today(),
    value: form.date,
    onChange: () => {
      form = { ...form, date: date.value || null };
      paintRoom();
    },
  });
  const note = h("input", {
    class: "input",
    name: "description",
    autocomplete: "off",
    placeholder: "Opcional",
    value: form.note,
    onInput: () => {
      form = { ...form, note: note.value };
    },
  });
  const room = h("p", { class: "note", "aria-live": "polite", hidden: true });

  const errors = formError();
  const submit = h("button", { class: "button button--block", type: "submit", "data-sends": true }, submitLabel);
  const element = h(
    "form",
    {
      class: "screen record",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        clearErrors(element);
        if (!app.connection.online()) return showErrors(element, { message: OFFLINE_SAVE });
        const { missing } = withdrawalRequest(form);
        if (missing.length) return showErrors(element, { message: missing.join(" "), fields: { amount: missing[0] } });
        setBusy(submit, true, busyLabel);
        try {
          await onSubmit(form, controller);
        } catch (error) {
          showErrors(element, error);
        } finally {
          setBusy(submit, false, busyLabel);
        }
      },
    },
    errors,
    amountField,
    h(
      "div",
      { class: "rows" },
      field({ id: "withdrawal-date", label: "Fecha", control: date }),
      field({ id: "withdrawal-note", label: "Nota", control: note }),
    ),
    room,
    h("div", { class: "submit" }, submit),
  );

  async function paintRoom() {
    // El encabezado dice el mes del retiro, como en un gasto.
    if (form.date) app.setMonth(periodOf(form.date));
    if (!showRoom || !form.date) {
      room.hidden = true;
      return;
    }
    const count = ++roomCount;
    try {
      const summary = await app.api.get(`${base}/summary`, { period: periodOf(form.date) });
      if (count !== roomCount) return;
      room.textContent = withdrawalRoom(summary).text;
      room.hidden = false;
    } catch {
      // Es una ayuda: si no llega, la API igual dice cuánto se puede retirar.
      room.hidden = true;
    }
  }

  const controller = {
    element,
    focus: () => amount.focus(),
    get form() {
      return form;
    },
    reset(next) {
      form = { amount: "", date: today(), note: "", ...next };
      amount.value = form.amount;
      date.value = form.date;
      note.value = form.note;
      paintRoom();
    },
    paintRoom,
  };
  paintRoom();
  return controller;
}

/** Registrar un retiro: "Registrado" con "Deshacer", como un gasto. */
export function buildNewWithdrawal(app, { onDone } = {}) {
  const base = `/spaces/${app.space.id}`;
  const controller = buildWithdrawalForm(app, {
    initial: app.drafts.get("withdrawal") ?? {},
    submitLabel: "Registrar retiro",
    busyLabel: "Registrando…",
    showRoom: true,
    onSubmit: async (form) => {
      const withdrawal = await app.api.post(`${base}/savings-withdrawals`, withdrawalRequest(form).body);
      app.notices.show({
        text: `Registrado: retiro de ahorro · ${formatPesos(withdrawal.amount)}`,
        seconds: 10,
        action: {
          label: "Deshacer",
          onClick: async () => {
            try {
              await app.api.del(`${base}/savings-withdrawals/${withdrawal.id}`, { confirm: "true" });
              app.notices.show({ text: "Borrado: retiro de ahorro.", seconds: 6 });
              controller.paintRoom();
            } catch (error) {
              app.notices.show({ text: error.message, kind: "error", seconds: 0 });
            }
          },
        },
      });
      controller.reset({ date: form.date });
      app.drafts.clear("withdrawal");
      controller.focus();
      onDone?.(withdrawal);
    },
  });
  controller.element.addEventListener("input", () => app.drafts.set("withdrawal", controller.form));
  return controller;
}

/** `/retiros/<id>`: editar (solo lo que cambió) y borrar con confirmación
 * (RF-35, principio 8). */
export async function renderWithdrawal(main, app, { id }) {
  const base = `/spaces/${app.space.id}`;
  const url = `${base}/savings-withdrawals/${id}`;
  const withdrawal = await app.api.get(url);
  app.setMonth(periodOf(withdrawal.spent_on));
  const backToList = () => {
    app.drafts.set("period", periodOf(withdrawal.spent_on));
    app.navigate("/gastos");
  };

  const controller = buildWithdrawalForm(app, {
    initial: {
      amount: formatNumber(withdrawal.amount),
      date: withdrawal.spent_on,
      note: withdrawal.description ?? "",
    },
    submitLabel: "Guardar cambios",
    busyLabel: "Guardando…",
    showRoom: false,
    onSubmit: async (form) => {
      const changes = withdrawalChanges(withdrawal, form);
      if (Object.keys(changes).length) {
        await app.api.patch(url, changes);
        app.notices.show({ text: "Cambios guardados.", seconds: 6 });
      }
      backToList();
    },
  });

  const remove = h(
    "button",
    {
      type: "button",
      class: "button button--danger button--block",
      "data-sends": true,
      onClick: async () => {
        const confirmed = await app.confirm({
          title: "¿Borrar este retiro?",
          body: `Retiro de ahorro · ${formatPesos(withdrawal.amount)} · ${formatDay(withdrawal.spent_on)}. No se puede deshacer.`,
          confirmLabel: "Borrar retiro",
          danger: true,
        });
        if (!confirmed) return;
        try {
          await app.api.del(url, { confirm: "true" });
          app.notices.show({ text: "Borrado: retiro de ahorro.", seconds: 6 });
          backToList();
        } catch (error) {
          app.notices.show({ text: error.message, kind: "error", seconds: 0 });
        }
      },
    },
    "Borrar retiro",
  );

  main.append(
    h(
      "div",
      { class: "screen__head edit-head" },
      h("h1", {}, "Editar retiro"),
      h(
        "a",
        {
          class: "button button--link",
          href: "/gastos",
          onClick: () => app.drafts.set("period", periodOf(withdrawal.spent_on)),
        },
        "Volver a Gastos",
      ),
    ),
    controller.element,
    h("div", { class: "submit stack" }, remove),
  );
  controller.focus();
}
