// El perfil: quién eres, tus espacios y a dónde ir desde ahí. En el
// computador es un menú que se abre desde abajo a la izquierda; en el
// celular, la pantalla "Tú" (`/perfil`). Los dos muestran lo mismo.
import { h, replace } from "../dom.js";
import { displayName, initials } from "../profile.js";

/** Los espacios del usuario como botones; el actual va marcado. */
function spaceOptions(app, { onPick, className }) {
  const here = app.space?.id;
  return app.spaces.map((space) =>
    h(
      "button",
      {
        type: "button",
        class: className,
        "aria-current": space.id === here ? "true" : null,
        onClick: () => onPick(space),
      },
      h("span", { class: "menu__name" }, space.name),
      space.id === here && h("span", { class: "menu__here" }, "actual"),
    ),
  );
}

/** El menú del perfil en el computador. La lista se arma cada vez que se
 * abre, con lo último que se sabe de la cuenta. */
export function createProfileMenu({ root, button, menu, app }) {
  function outside(event) {
    if (!root.contains(event.target)) close();
  }

  function close({ focus = false } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside);
    if (focus) button.focus();
  }

  function open() {
    replace(
      menu,
      h("p", { class: "menu__who" }, h("b", {}, displayName(app.me)), app.me?.name && h("span", {}, app.me.email)),
      h("p", { class: "label menu__title" }, "Tus espacios"),
      spaceOptions(app, {
        className: "menu__option",
        onPick: (space) => {
          close({ focus: true });
          if (space.id !== app.space?.id) app.switchSpace(space);
        },
      }),
      h(
        "div",
        { class: "menu__links" },
        h("a", { class: "menu__option", href: "/espacio", onClick: () => close() }, "Ajustes del espacio"),
        h("a", { class: "menu__option", href: "/cuenta", onClick: () => close() }, "Mi cuenta"),
        h(
          "button",
          {
            type: "button",
            class: "menu__option",
            onClick: () => {
              close();
              app.signOut();
            },
          },
          "Cerrar sesión",
        ),
      ),
    );
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    // Un toque fuera lo cierra, como un menú del sistema.
    document.addEventListener("pointerdown", outside);
  }

  button.addEventListener("click", () => (menu.hidden ? open() : close()));
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close({ focus: true });
  });

  return { close };
}

/** La pantalla "Tú" del celular: lo mismo que el menú, con sitio. */
export function renderProfile(main, app) {
  main.append(
    h(
      "div",
      { class: "screen spaced" },
      h(
        "div",
        { class: "who" },
        h("span", { class: "avatar avatar--big", "aria-hidden": "true" }, initials(app.me)),
        h(
          "div",
          { class: "who__text" },
          h("h1", {}, displayName(app.me)),
          app.me.name && h("p", { class: "muted" }, app.me.email),
        ),
      ),
      h(
        "section",
        { class: "stack", "aria-labelledby": "profile-spaces" },
        h("h2", { class: "label", id: "profile-spaces" }, "Tus espacios"),
        h(
          "div",
          { class: "rows" },
          spaceOptions(app, {
            className: "entry entry--button",
            onPick: (space) => {
              if (space.id !== app.space?.id) app.switchSpace(space);
            },
          }),
        ),
        h("p", { class: "muted" }, "Toca un espacio para pasar a él. Cada uno tiene su propio presupuesto."),
      ),
      h(
        "nav",
        { class: "tiles", "aria-label": "Ajustes" },
        h(
          "a",
          { class: "tile", href: "/espacio" },
          h("span", { class: "tile__title" }, "Ajustes del espacio"),
          h("span", { class: "tile__text" }, `Las categorías de «${app.space.name}», invitar a alguien, crear otro espacio o salir.`),
          h("span", { class: "tile__arrow", "aria-hidden": "true" }, "›"),
        ),
        h(
          "a",
          { class: "tile", href: "/cuenta" },
          h("span", { class: "tile__title" }, "Mi cuenta"),
          h("span", { class: "tile__text" }, "Tu nombre, tu correo y cómo fijar Gastito en la pantalla de inicio."),
          h("span", { class: "tile__arrow", "aria-hidden": "true" }, "›"),
        ),
      ),
      h(
        "div",
        {},
        h("button", { type: "button", class: "button button--quiet", onClick: () => app.signOut() }, "Cerrar sesión"),
      ),
    ),
  );
}
