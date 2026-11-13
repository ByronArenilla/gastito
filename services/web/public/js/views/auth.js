// Entrar y crear cuenta (spec 011, RF-1 y RF-2). Se entra una sola vez: la
// sesión se renueva sola con el uso (decisión 9).
import { logIn, signUp } from "../account.js";
import { h, logo } from "../dom.js";
import { OFFLINE_SAVE, field, formError, setBusy, showErrors } from "./form.js";

function credentials({ newPassword }) {
  const email = h("input", {
    class: "input",
    name: "email",
    type: "email",
    autocomplete: "username",
    inputmode: "email",
    autocapitalize: "none",
    spellcheck: "false",
    required: true,
  });
  const password = h("input", {
    class: "input",
    name: "password",
    type: "password",
    autocomplete: newPassword ? "new-password" : "current-password",
    required: true,
  });
  return { email, password };
}

function screen({ title, form, footer, message, success }) {
  return h(
    "section",
    { class: "auth" },
    h("p", { class: "wordmark brand", "aria-hidden": "true" }, logo(), "Gastito"),
    h("h1", {}, title),
    message && h("p", { class: "error", role: "alert" }, message),
    // Una buena noticia que trae a Entrar: cuenta creada o contraseña cambiada.
    success && h("p", { class: "info", role: "status" }, success),
    form,
    footer,
  );
}

function authForm(app, { submitLabel, busyLabel, controls, rows, action }) {
  const submit = h(
    "button",
    { class: "button button--block", type: "submit", "data-sends": true },
    submitLabel,
  );
  const errors = formError();
  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!app.connection.online()) {
          return showErrors(form, { message: OFFLINE_SAVE });
        }
        setBusy(submit, true, busyLabel);
        try {
          const destination = await action({
            name: controls.name?.value.trim(),
            email: controls.email.value,
            password: controls.password.value,
          });
          // Sin destino, la propia pantalla ya mostró qué sigue ("Revisa tu
          // correo", al crear una cuenta).
          if (!destination) return;
          app.me = null;
          app.navigate(destination, { replace: true });
        } catch (error) {
          showErrors(form, error);
          setBusy(submit, false, busyLabel);
        }
      },
    },
    errors,
    h("div", { class: "rows" }, rows),
    h("div", { class: "submit" }, submit),
  );
  return form;
}

export function renderLogin(main, app) {
  // El aviso de una sesión que caducó o se cerró en otro lado (RF-3).
  const message = app.drafts.get("auth-message");
  app.drafts.clear("auth-message");
  // Lo que deja un enlace del correo: "cuenta creada" y su correo ya escrito.
  const success = app.drafts.get("auth-success");
  const knownEmail = app.drafts.get("auth-email");
  app.drafts.clear("auth-success");
  app.drafts.clear("auth-email");
  const controls = credentials({ newPassword: false });
  if (knownEmail) controls.email.value = knownEmail;
  const form = authForm(app, {
    submitLabel: "Entrar",
    busyLabel: "Entrando…",
    controls,
    rows: [
      field({ id: "login-email", label: "Correo", control: controls.email, block: true }),
      field({ id: "login-password", label: "Contraseña", control: controls.password, block: true }),
    ],
    action: (values) => logIn(app, values),
  });
  main.append(
    screen({
      title: "Entrar",
      message,
      success,
      form,
      footer: h(
        "div",
        { class: "stack" },
        h("p", {}, h("a", { href: "/olvide-mi-contrasena" }, "¿Olvidaste tu contraseña?")),
        h("p", { class: "muted" }, "¿No tienes cuenta? ", h("a", { href: "/crear-cuenta" }, "Crear cuenta")),
      ),
    }),
  );
  (knownEmail ? controls.password : controls.email).focus();
}

/** "Revisa tu correo" (spec 032, RF-15): la cuenta todavía no existe; nace
 * al abrir el enlace. `values` es lo que se escribió, para poder pedir el
 * enlace otra vez sin volver a llenar el formulario. */
function checkYourEmail(main, app, result, values) {
  const status = h("p", { class: "muted", "aria-live": "polite" });
  const again = h(
    "button",
    {
      type: "button",
      class: "button button--quiet button--block",
      "data-sends": true,
      onClick: async () => {
        if (!app.connection.online()) {
          status.textContent = OFFLINE_SAVE;
          return;
        }
        setBusy(again, true, "Enviando…");
        try {
          await signUp(app, values);
          status.textContent = "Listo, te enviamos otro enlace. El anterior ya no sirve.";
        } catch (error) {
          // Por ejemplo, el minuto de espera entre un correo y otro.
          status.textContent = error.message;
        } finally {
          setBusy(again, false, "Enviando…");
        }
      },
    },
    "Enviar otra vez",
  );
  main.replaceChildren(
    h(
      "section",
      { class: "auth" },
      h("p", { class: "wordmark brand", "aria-hidden": "true" }, logo(), "Gastito"),
      h("h1", {}, "Revisa tu correo"),
      h(
        "p",
        { class: "info", role: "status" },
        "Te enviamos un enlace a ",
        h("b", {}, result.email),
        ". Ábrelo para terminar de crear tu cuenta: sirve una sola vez y caduca en 24 horas.",
      ),
      h("p", { class: "muted" }, "Si no lo ves en unos minutos, mira en la carpeta de spam. Tu cuenta todavía no existe: se crea cuando abras el enlace."),
      h("div", { class: "submit stack" }, again, status),
      h(
        "p",
        { class: "muted" },
        "¿Te equivocaste de correo? ",
        h("a", { href: "/crear-cuenta", onClick: (event) => {
          event.preventDefault();
          main.replaceChildren();
          renderRegister(main, app);
        } }, "Corrígelo"),
        " · ",
        h("a", { href: "/entrar" }, "Entrar"),
      ),
    ),
  );
  app.refreshSending();
}

export function renderRegister(main, app) {
  const controls = credentials({ newPassword: true });
  // El nombre va primero (spec 031, RF-8): con él se nombra el espacio.
  controls.name = h("input", {
    class: "input",
    name: "name",
    autocomplete: "name",
    autocapitalize: "words",
    maxlength: 50,
    required: true,
  });
  const form = authForm(app, {
    submitLabel: "Crear cuenta",
    busyLabel: "Creando…",
    controls,
    rows: [
      field({
        id: "register-name",
        label: "Nombre",
        control: controls.name,
        hint: "Tu espacio se llamará «Espacio de» y tu nombre.",
        block: true,
      }),
      field({ id: "register-email", label: "Correo", control: controls.email, block: true }),
      field({
        id: "register-password",
        label: "Contraseña",
        control: controls.password,
        hint: "Al menos 12 caracteres. Una frase que recuerdes sirve.",
        block: true,
      }),
    ],
    action: async (values) => {
      const result = await signUp(app, values);
      // Con una API anterior a la spec 032 la cuenta ya existe: se entra.
      if (!result.pending) return result.destination;
      checkYourEmail(main, app, result, values);
      return null;
    },
  });
  main.append(
    screen({
      title: "Crear cuenta",
      form,
      footer: h("p", { class: "muted" }, "¿Ya tienes cuenta? ", h("a", { href: "/entrar" }, "Entrar")),
    }),
  );
  controls.name.focus();
}
