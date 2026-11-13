// "¿Cómo te llamas?" (spec 031, RF-9): una cuenta que todavía no tiene
// nombre lo escribe aquí, una sola vez, antes de seguir a donde iba. Las
// cuentas nuevas no la ven: dan su nombre al crearse.
import { saveName } from "../account.js";
import { h, logo } from "../dom.js";
import { nameRequest } from "../profile.js";
import { OFFLINE_SAVE, field, formError, setBusy, showErrors } from "./form.js";

export function renderName(main, app) {
  const name = h("input", {
    class: "input",
    name: "name",
    autocomplete: "name",
    autocapitalize: "words",
    maxlength: 50,
    required: true,
  });
  const busyLabel = "Guardando…";
  const submit = h("button", { class: "button button--block", type: "submit", "data-sends": true }, "Guardar y seguir");
  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
        const request = nameRequest(name.value);
        if (request.missing.length) {
          const message = "Escribe tu nombre.";
          return showErrors(form, { message, fields: { name: message } });
        }
        setBusy(submit, true, busyLabel);
        try {
          await saveName(app, request.body.name);
          // La cuenta y los espacios: el "Personal" pudo cambiar de nombre.
          await app.loadAccount();
          app.navigate(app.session.takeNext() ?? app.home(), { replace: true });
        } catch (error) {
          showErrors(form, error);
          setBusy(submit, false, busyLabel);
        }
      },
    },
    formError(),
    h("div", { class: "rows" }, field({ id: "your-name", label: "Nombre", control: name, block: true })),
    h("div", { class: "submit" }, submit),
  );

  main.append(
    h(
      "section",
      { class: "auth" },
      h("p", { class: "wordmark brand", "aria-hidden": "true" }, logo(), "Gastito"),
      h("h1", {}, "¿Cómo te llamas?"),
      h(
        "p",
        { class: "muted" },
        "Así te verán quienes compartan un espacio contigo. Si tu espacio todavía se llama «Personal», pasará a llamarse «Espacio de» y tu nombre.",
      ),
      form,
      h(
        "p",
        { class: "muted" },
        `Entraste como ${app.me.email}. `,
        h("button", { type: "button", class: "button button--link", onClick: () => app.signOut() }, "Cerrar sesión"),
      ),
    ),
  );
  name.focus();
}
