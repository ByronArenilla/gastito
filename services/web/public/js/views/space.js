// Pestaña Espacio (spec 011, RF-23 a RF-26, RF-29): el espacio actual y cómo
// cambiarlo, compartirlo, crear otro, salir de uno compartido, la cuenta con
// cerrar sesión (decisión 22) y la guía para fijar la app (T11).
import { logOut } from "../account.js";
import { categoryRequest } from "../categories.js";
import { h } from "../dom.js";
import { pinGuide } from "../platform.js";
import { createSpace, leaveSpace, shareInvitation } from "../spaces.js";
import { OFFLINE_SAVE, clearErrors, field, formError, nameConflict, setBusy, showErrors } from "./form.js";

/** Al cambiar de espacio, lo escrito en Registrar y el mes de Gastos eran del
 * espacio anterior. */
function switchTo(app, space, message) {
  app.useSpace(space);
  app.drafts.clear("record");
  app.drafts.clear("period");
  app.navigate("/espacio", { replace: true });
  if (message) app.notices.show({ text: message, seconds: 6 });
}

function currentSection(app) {
  const others = app.spaces.filter((space) => space.id !== app.space.id);
  return h(
    "section",
    { class: "stack", "aria-labelledby": "space-title" },
    h("p", { class: "label" }, "Espacio actual"),
    h("h2", { id: "space-title" }, app.space.name),
    others.length > 0 &&
      h(
        "div",
        { class: "rows" },
        others.map((space) =>
          h(
            "div",
            { class: "row" },
            h("span", { class: "label" }, "Otro"),
            h(
              "button",
              {
                type: "button",
                class: "button button--link",
                onClick: () => switchTo(app, space, `Ahora estás en «${space.name}».`),
              },
              `Pasar a «${space.name}»`,
            ),
          ),
        ),
      ),
  );
}

function shareSection(app) {
  const status = h("p", { class: "muted", "aria-live": "polite" });
  const manual = h("input", { class: "input", readonly: true, hidden: true, "aria-label": "Enlace de invitación" });
  const button = h(
    "button",
    {
      type: "button",
      class: "button",
      "data-sends": true,
      onClick: async () => {
        if (!app.connection.online()) {
          status.textContent = OFFLINE_SAVE;
          return;
        }
        setBusy(button, true, "Preparando el enlace…");
        try {
          const { how, url } = await shareInvitation(app, app.space, {
            share: navigator.share ? (data) => navigator.share(data) : null,
            copy: (text) => navigator.clipboard.writeText(text),
          });
          manual.hidden = how !== "manual";
          manual.value = url;
          status.textContent = {
            shared: "Enlace compartido. Es de un solo uso y caduca en 24 horas.",
            copied: "Enlace copiado. Pégalo en un mensaje: es de un solo uso y caduca en 24 horas.",
            cancelled: "No se compartió. El enlace que se preparó caduca solo en 24 horas.",
            manual: "Copia este enlace y envíalo: es de un solo uso y caduca en 24 horas.",
          }[how];
          if (how === "manual") manual.select();
        } catch (error) {
          status.textContent = error.message;
        } finally {
          setBusy(button, false, "Preparando el enlace…");
        }
      },
    },
    `Compartir «${app.space.name}»`,
  );
  return h(
    "section",
    { class: "stack", "aria-labelledby": "share-title" },
    h("h2", { id: "share-title" }, "Compartir"),
    h(
      "p",
      { class: "muted" },
      "Quien abra el enlace verá el nombre del espacio y podrá unirse con su cuenta. Los miembros comparten el presupuesto.",
    ),
    h("div", {}, button),
    manual,
    status,
  );
}

function createSection(app) {
  const name = h("input", { class: "input", name: "name", autocomplete: "off", maxlength: 100 });
  const submit = h("button", { class: "button button--quiet", type: "submit", "data-sends": true }, "Crear espacio");
  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
        setBusy(submit, true, "Creando…");
        try {
          const space = await createSpace(app, name.value.trim());
          app.spaces = [...app.spaces, space];
          switchTo(app, space, `Creaste «${space.name}» y ahora estás en él.`);
        } catch (error) {
          showErrors(form, error);
          setBusy(submit, false, "Creando…");
        }
      },
    },
    h("h2", {}, "Crear otro espacio"),
    h("p", { class: "muted" }, "Para un presupuesto aparte: un viaje, la casa de alguien más."),
    formError(),
    h("div", { class: "rows" }, field({ id: "space-name-input", label: "Nombre", control: name })),
    h("div", {}, submit),
  );
  return form;
}

function leaveSection(app) {
  const button = h(
    "button",
    {
      type: "button",
      class: "button button--danger",
      "data-sends": true,
      onClick: async () => {
        const space = app.space;
        const confirmed = await app.confirm({
          title: `¿Salir de «${space.name}»?`,
          body: "Lo que registraste se queda en el espacio. Para volver, alguien tendrá que compartirte un enlace nuevo.",
          confirmLabel: `Salir de «${space.name}»`,
          danger: true,
        });
        if (!confirmed) return;
        try {
          const next = await leaveSpace(app, space, app.spaces);
          app.spaces = app.spaces.filter((candidate) => candidate.id !== space.id);
          switchTo(app, next, `Saliste de «${space.name}». Ahora estás en «${next.name}».`);
        } catch (error) {
          app.notices.show({ text: error.message, kind: "error", seconds: 0 });
        }
      },
    },
    `Salir de «${app.space.name}»`,
  );
  return h(
    "section",
    { class: "stack", "aria-labelledby": "leave-title" },
    h("h2", { id: "leave-title" }, "Salir del espacio"),
    h("div", {}, button),
  );
}

function accountSection(app) {
  const button = h(
    "button",
    {
      type: "button",
      class: "button button--quiet",
      onClick: async () => {
        button.disabled = true;
        const notice = await logOut(app).catch((error) => error.message);
        app.me = null;
        app.drafts.clear("record");
        app.navigate("/entrar", { replace: true });
        if (notice) app.notices.show({ text: notice, seconds: 0 });
      },
    },
    "Cerrar sesión",
  );
  return h(
    "section",
    { class: "stack", "aria-labelledby": "account-title" },
    h("h2", { id: "account-title" }, "Tu cuenta"),
    h("p", { class: "muted" }, app.me.email),
    h("div", {}, button),
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

/** Las categorías del espacio: verlas, crear y eliminar (spec 012, RF-28 y
 * RF-29). Eliminar archiva: lo que ya la tiene la conserva, y crearla de
 * nuevo con el mismo nombre la restaura (spec 008). */
function categoriesSection(app, { back = null } = {}) {
  const base = `/spaces/${app.space.id}/categories`;
  // Quien llegó desde la lista de categorías de un gasto vuelve con un toque.
  const goBack = back && {
    label: back === "/registrar" ? "Volver a Registrar" : "Volver al gasto",
    onClick: () => app.navigate(back),
  };
  const list = h("ul", { class: "rows", "aria-label": "Categorías" }, h("li", { class: "loading", "aria-hidden": "true" }));
  const name = h("input", { class: "input", name: "name", autocomplete: "off", maxlength: 50 });
  const busyLabel = "Creando…";
  const submit = h("button", { class: "button button--quiet", type: "submit", "data-sends": true }, "Crear categoría");

  async function load() {
    try {
      const categories = await app.api.get(base);
      list.replaceChildren(
        ...categories.map((category) =>
          h(
            "li",
            { class: "entry" },
            h("span", {}, category.name),
            h(
              "button",
              {
                type: "button",
                class: "button button--link",
                "data-sends": true,
                "aria-label": `Eliminar «${category.name}»`,
                onClick: () => remove(category),
              },
              "Eliminar",
            ),
          ),
        ),
      );
      app.refreshSending();
    } catch (error) {
      list.replaceChildren(h("li", { class: "error", role: "alert" }, error.message));
    }
  }

  async function remove(category) {
    if (!app.connection.online()) return;
    const confirmed = await app.confirm({
      title: `¿Eliminar «${category.name}»?`,
      body: "Los rubros y los gastos que ya la tienen la conservan. Para usarla de nuevo, créala con el mismo nombre.",
      confirmLabel: "Eliminar categoría",
      danger: true,
    });
    if (!confirmed) return;
    try {
      const result = await app.api.del(`${base}/${category.id}`);
      // El mensaje de la API dice qué pasa con sus rubros (decisión 19).
      app.notices.show({ text: result.message, seconds: 0 });
      await load();
    } catch (error) {
      app.notices.show({ text: error.message, kind: "error", seconds: 0 });
    }
  }

  const form = h(
    "form",
    {
      class: "stack",
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        if (!app.connection.online()) return showErrors(form, { message: OFFLINE_SAVE });
        const request = categoryRequest(name.value);
        if (request.missing.length) {
          const message = "Escribe el nombre de la categoría.";
          return showErrors(form, { message, fields: { name: message } });
        }
        setBusy(submit, true, busyLabel);
        try {
          const category = await app.api.post(base, request.body);
          app.notices.show({
            text: `Categoría «${category.name}» lista para usar.`,
            seconds: goBack ? 15 : 6,
            action: goBack,
          });
          clearErrors(form);
          name.value = "";
          await load();
        } catch (error) {
          showErrors(form, nameConflict(error));
        } finally {
          setBusy(submit, false, busyLabel);
        }
      },
    },
    formError(),
    h("div", { class: "rows" }, field({ id: "category-name", label: "Nueva", control: name })),
    h("div", {}, submit),
  );

  load();
  return h(
    "section",
    { class: "stack", "aria-labelledby": "categories-title" },
    h("h2", { id: "categories-title" }, "Categorías"),
    h("p", { class: "muted" }, "Agrupan los rubros y los gastos del espacio."),
    list,
    form,
  );
}

export async function renderSpace(main, app) {
  // La lista de espacios puede haber cambiado en otro dispositivo.
  await app.loadAccount();
  // "Crear categoría" en la lista de un gasto trae aquí, directo al campo.
  const focus = app.drafts.get("space-focus");
  app.drafts.clear("space-focus");
  const toCategories = focus?.section === "categories";
  main.append(
    h(
      "div",
      { class: "screen spaced" },
      h("h1", { class: "sr-only" }, "Espacio"),
      currentSection(app),
      categoriesSection(app, { back: toCategories ? focus.back : null }),
      shareSection(app),
      createSection(app),
      app.spaces.length > 1 && leaveSection(app),
      pinSection(),
      accountSection(app),
    ),
  );
  if (toCategories) {
    const name = main.querySelector("#category-name");
    name?.scrollIntoView({ block: "center" });
    name?.focus({ preventScroll: true });
  }
}
