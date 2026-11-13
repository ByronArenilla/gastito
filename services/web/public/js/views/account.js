// Mi cuenta (`/cuenta`): el nombre (spec 031, RF-10), el correo, cómo fijar
// la app (spec 011, RF-29) y cerrar sesión (decisión 22 de la 011).
import { requestVerification, saveName } from "../account.js";
import { h } from "../dom.js";
import { pinGuide } from "../platform.js";
import { nameRequest, needsVerification } from "../profile.js";
import { OFFLINE_SAVE, clearErrors, field, formError, setBusy, showErrors } from "./form.js";

function nameSection(app) {
  const name = h("input", {
    class: "input",
    name: "name",
    autocomplete: "name",
    autocapitalize: "words",
    maxlength: 50,
    value: app.me.name ?? "",
  });
  const busyLabel = "Guardando…";
  const submit = h("button", { class: "button button--quiet", type: "submit", "data-sends": true }, "Guardar nombre");
  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      "aria-labelledby": "name-title",
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
          const me = await saveName(app, request.body.name);
          clearErrors(form);
          await app.loadAccount();
          name.value = me.name;
          app.notices.show({ text: `Listo: ahora apareces como «${me.name}».`, seconds: 6 });
        } catch (error) {
          showErrors(form, error);
        } finally {
          setBusy(submit, false, busyLabel);
        }
      },
    },
    h("h2", { id: "name-title" }, "Tu nombre"),
    h("p", { class: "muted" }, "Así apareces en tu perfil. Cambiarlo no le cambia el nombre a ningún espacio."),
    formError(),
    h("div", { class: "rows" }, field({ id: "account-name", label: "Nombre", control: name })),
    h("div", {}, submit),
  );
  return form;
}

/** El correo y si está confirmado (spec 032, RF-17). Una API anterior a la
 * spec no dice el estado: entonces solo se muestra el correo (RF-21). */
function emailSection(app) {
  const pending = needsVerification(app.me);
  const status = h("p", { class: "muted", "aria-live": "polite" });
  const busyLabel = "Enviando…";
  const send = h(
    "button",
    {
      type: "button",
      class: "button button--quiet",
      "data-sends": true,
      onClick: async () => {
        if (!app.connection.online()) {
          status.textContent = OFFLINE_SAVE;
          return;
        }
        setBusy(send, true, busyLabel);
        try {
          status.textContent = (await requestVerification(app)).detail;
        } catch (error) {
          status.textContent = error.message;
        } finally {
          setBusy(send, false, busyLabel);
        }
      },
    },
    "Enviar enlace de confirmación",
  );
  return h(
    "section",
    { class: "stack", "aria-labelledby": "email-title" },
    h("h2", { id: "email-title" }, "Correo"),
    h("p", {}, app.me.email),
    h("p", { class: "muted" }, "Con este correo entras a Gastito."),
    app.me.email_verified === true && h("p", { class: "label" }, "Confirmado"),
    pending && [
      h("p", { class: "label over" }, "Sin confirmar"),
      h(
        "p",
        { class: "muted" },
        "Te enviamos un enlace a este correo y lo abres. Mientras no lo confirmes no puedes compartir tus espacios ni unirte a otros; lo demás funciona igual.",
      ),
      h("div", {}, send),
      status,
    ],
  );
}

/** Los pasos para fijar la app en este navegador; nada si ya está fijada
 * (RF-29, decisión 20). */
function pinSection() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const guide = pinGuide(navigator.userAgent, { standalone });
  if (!guide) return null;
  return h(
    "section",
    { class: "stack", "aria-labelledby": "pin-title" },
    h("h2", { id: "pin-title" }, "Fijar en la pantalla de inicio"),
    h(
      "p",
      { class: "muted" },
      "Así Gastito se abre como una aplicación, sin buscarla en el navegador. No se descarga nada.",
    ),
    h("p", { class: "label" }, guide.title),
    guide.steps.length > 0 && h("ol", { class: "steps" }, guide.steps.map((step) => h("li", {}, step))),
    guide.note && h("p", { class: "muted" }, guide.note),
  );
}

export async function renderAccount(main, app) {
  // El nombre pudo cambiarse en otro dispositivo.
  await app.loadAccount();
  main.append(
    h(
      "div",
      { class: "screen spaced" },
      h("h1", {}, "Mi cuenta"),
      nameSection(app),
      emailSection(app),
      pinSection(),
      h(
        "section",
        { class: "stack", "aria-labelledby": "logout-title" },
        h("h2", { id: "logout-title" }, "Sesión"),
        h(
          "div",
          {},
          h("button", { type: "button", class: "button button--quiet", onClick: () => app.signOut() }, "Cerrar sesión"),
        ),
      ),
    ),
  );
}
