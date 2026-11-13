// Las pantallas de los enlaces que llegan por correo (spec 032): terminar de
// crear la cuenta, confirmar el correo de una cuenta que ya existe, pedir el
// enlace de la contraseña y escribir la nueva.
//
// Abrir un enlace nunca hace nada por sí solo: siempre hay que tocar un botón
// (decisión 5, como las invitaciones del ADR 0005). Los filtros de correo y
// las vistas previas abren los enlaces y no deben confirmar por nadie.
import { confirmAccount, confirmEmail, requestPasswordReset, resetPassword } from "../account.js";
import { h, logo, replace } from "../dom.js";
import { OFFLINE_SAVE, field, formError, setBusy, showErrors } from "./form.js";

/** El marco de estas pantallas. Sin sesión no hay encabezado, así que llevan
 * el nombre de la app arriba, como Entrar. */
function frame(main, app) {
  const wrap = h("section", { class: "auth" });
  if (!app.session.isLoggedIn()) {
    wrap.append(h("p", { class: "wordmark brand", "aria-hidden": "true" }, logo(), "Gastito"));
  }
  main.append(wrap);
  return wrap;
}

/** Deja en Entrar una buena noticia y, si se sabe, el correo ya escrito. */
function goToLogin(app, { success, email = null }) {
  app.drafts.set("auth-success", success);
  if (email) app.drafts.set("auth-email", email);
  app.navigate("/entrar", { replace: true });
}

/** Un botón que hace lo del enlace al tocarlo. Si la API lo rechaza (el
 * enlace caducó, ya se usó o se reemplazó), muestra su mensaje y `recover`,
 * la forma de pedir uno nuevo. */
function linkAction(app, { label, busyLabel, action, onDone, recover }) {
  const status = h("p", { role: "alert", class: "error", hidden: true });
  const help = h("p", { class: "muted", hidden: true }, recover);
  const button = h(
    "button",
    {
      type: "button",
      class: "button button--block",
      "data-sends": true,
      onClick: async () => {
        status.hidden = true;
        help.hidden = true;
        if (!app.connection.online()) {
          status.textContent = OFFLINE_SAVE;
          status.hidden = false;
          return;
        }
        setBusy(button, true, busyLabel);
        try {
          await onDone(await action());
        } catch (error) {
          status.textContent = error.message;
          status.hidden = false;
          // Sin conexión el enlace sigue sirviendo: no hace falta otro.
          help.hidden = Boolean(error.offline);
          setBusy(button, false, busyLabel);
        }
      },
    },
    label,
  );
  return [status, help, h("div", { class: "submit" }, button)];
}

/** `/confirmar-cuenta/<token>` (RF-16): crea la cuenta y lleva a Entrar con
 * el correo ya escrito. No inicia sesión (decisión 6). */
export function renderConfirmAccount(main, app, { token }) {
  const wrap = frame(main, app);
  wrap.append(
    h("h1", {}, "Termina de crear tu cuenta"),
    h(
      "p",
      { class: "muted" },
      "Con este toque se crea tu cuenta de Gastito. Después entras con tu correo y la contraseña que escribiste.",
    ),
    ...linkAction(app, {
      label: "Crear mi cuenta",
      busyLabel: "Creando…",
      action: () => confirmAccount(app, token),
      onDone: (account) => {
        const success = "Tu cuenta quedó creada. Entra con tu contraseña.";
        if (!app.session.isLoggedIn()) return goToLogin(app, { success, email: account.email });
        // Este dispositivo tiene abierta la sesión de otra cuenta: no se
        // cierra sola.
        replace(
          wrap,
          h("h1", {}, "Cuenta creada"),
          h("p", { class: "info", role: "status" }, "La cuenta de ", h("b", {}, account.email), " ya existe."),
          h("p", { class: "muted" }, "En este dispositivo hay otra sesión abierta. Para entrar con la cuenta nueva, cierra esta."),
          h(
            "div",
            { class: "submit" },
            h(
              "button",
              {
                type: "button",
                class: "button button--quiet",
                onClick: () => {
                  // Antes de salir: Entrar los lee al pintarse.
                  app.drafts.set("auth-success", success);
                  app.drafts.set("auth-email", account.email);
                  app.signOut();
                },
              },
              "Cerrar sesión y entrar",
            ),
          ),
        );
      },
      recover: ["Si el enlace caducó, ", h("a", { href: "/crear-cuenta" }, "crea la cuenta otra vez"), " y te enviamos uno nuevo. Si ya la creaste, ", h("a", { href: "/entrar" }, "entra"), "."],
    }),
  );
}

/** `/verificar/<token>` (RF-18): confirma el correo de una cuenta que ya
 * existe, con o sin sesión. */
export function renderVerifyEmail(main, app, { token }) {
  const wrap = frame(main, app);
  wrap.append(
    h("h1", {}, "Confirma tu correo"),
    h("p", { class: "muted" }, "Con este toque queda confirmado que este correo es tuyo, y podrás compartir tus espacios."),
    ...linkAction(app, {
      label: "Confirmar mi correo",
      busyLabel: "Confirmando…",
      action: () => confirmEmail(app, token),
      onDone: async ({ email }) => {
        const success = `Listo: ${email} quedó confirmado.`;
        if (!app.session.isLoggedIn()) return goToLogin(app, { success, email });
        // Pone al día la cuenta: así se va el aviso de "confirma tu correo".
        await app.loadAccount();
        app.navigate(app.home(), { replace: true });
        app.notices.show({ text: success, seconds: 8 });
      },
      recover: ["Pide un enlace nuevo en ", h("a", { href: "/cuenta" }, "Mi cuenta"), "."],
    }),
  );
}

/** `/olvide-mi-contrasena` (RF-19): pide el correo. La respuesta es la misma
 * exista o no la cuenta, así que la pantalla tampoco lo delata. */
export function renderForgot(main, app) {
  const wrap = frame(main, app);
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
  const busyLabel = "Enviando…";
  const submit = h("button", { class: "button button--block", type: "submit", "data-sends": true }, "Enviar enlace");
  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
        if (!email.value.trim()) {
          const message = "Escribe tu correo.";
          return showErrors(form, { message, fields: { email: message } });
        }
        setBusy(submit, true, busyLabel);
        try {
          const result = await requestPasswordReset(app, email.value);
          replace(
            wrap,
            h("p", { class: "wordmark brand", "aria-hidden": "true" }, logo(), "Gastito"),
            h("h1", {}, "Revisa tu correo"),
            h("p", { class: "info", role: "status" }, result.detail),
            h("p", { class: "muted" }, "El enlace sirve una sola vez y caduca en 1 hora."),
            h("p", {}, h("a", { href: "/entrar" }, "Volver a Entrar")),
          );
        } catch (error) {
          // Una API anterior a la spec 032 no tiene esta ruta (durante un
          // despliegue): su "Not Found" no le dice nada a nadie.
          const message =
            error.status === 404 || error.status === 405
              ? "Esto todavía no está disponible. Inténtalo de nuevo en unos minutos."
              : null;
          showErrors(form, message ? { message } : error);
          setBusy(submit, false, busyLabel);
        }
      },
    },
    formError(),
    h("div", { class: "rows" }, field({ id: "forgot-email", label: "Correo", control: email, block: true })),
    h("div", { class: "submit" }, submit),
  );
  wrap.append(
    h("h1", {}, "¿Olvidaste tu contraseña?"),
    h("p", { class: "muted" }, "Escribe el correo de tu cuenta y te enviamos un enlace para poner una contraseña nueva."),
    form,
    h("p", { class: "muted" }, "¿Ya la recordaste? ", h("a", { href: "/entrar" }, "Entrar")),
  );
  email.focus();
}

/** `/restablecer/<token>` (RF-20): pide la contraseña nueva y lleva a Entrar.
 * La API cierra todas las sesiones de la cuenta (decisión 10). */
export function renderReset(main, app, { token }) {
  const wrap = frame(main, app);
  const password = h("input", {
    class: "input",
    name: "password",
    type: "password",
    autocomplete: "new-password",
    required: true,
  });
  const busyLabel = "Guardando…";
  const submit = h("button", { class: "button button--block", type: "submit", "data-sends": true }, "Guardar contraseña");
  const help = h(
    "p",
    { class: "muted", hidden: true },
    "Si el enlace caducó o ya se usó, ",
    h("a", { href: "/olvide-mi-contrasena" }, "pide uno nuevo"),
    ".",
  );
  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        help.hidden = true;
        if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
        setBusy(submit, true, busyLabel);
        try {
          const result = await resetPassword(app, { token, password: password.value });
          // La sesión de este dispositivo, si la había, ya no sirve en la
          // API: se borra aquí sin llamarla.
          if (app.session.isLoggedIn()) {
            app.session.clear();
            app.me = null;
            app.drafts.clear("record");
          }
          goToLogin(app, { success: result.detail });
        } catch (error) {
          showErrors(form, error);
          // Una contraseña corta (422) no gasta el enlace; un 404 sí pide otro.
          help.hidden = error.status !== 404;
          setBusy(submit, false, busyLabel);
        }
      },
    },
    formError(),
    h(
      "div",
      { class: "rows" },
      field({
        id: "reset-password",
        label: "Contraseña nueva",
        control: password,
        hint: "Al menos 12 caracteres. Una frase que recuerdes sirve.",
        block: true,
      }),
    ),
    h("div", { class: "submit" }, submit),
  );
  wrap.append(
    h("h1", {}, "Escribe tu contraseña nueva"),
    h("p", { class: "muted" }, "Al guardarla se cierran las sesiones abiertas de tu cuenta en todos los dispositivos."),
    form,
    help,
  );
  password.focus();
}
