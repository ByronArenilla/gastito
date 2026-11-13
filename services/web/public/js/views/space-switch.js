// El espacio actual en el encabezado: un botón que despliega los espacios del
// usuario para pasar a otro sin ir a la pestaña Espacio. La lista se arma
// cada vez que se abre, con lo último que se sabe de la cuenta.
import { h, replace } from "../dom.js";

export function createSpaceSwitch({ root, button, menu, spaces, current, onPick }) {
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
    const here = current()?.id;
    replace(
      menu,
      h("p", { class: "label space-switch__title" }, "Cambiar de espacio"),
      spaces().map((space) =>
        h(
          "button",
          {
            type: "button",
            class: "space-switch__option",
            "aria-current": space.id === here ? "true" : null,
            onClick: () => {
              close({ focus: true });
              if (space.id !== here) onPick(space);
            },
          },
          h("span", { class: "space-switch__option-name" }, space.name),
          space.id === here && h("span", { class: "space-switch__here" }, "actual"),
        ),
      ),
      h("a", { class: "space-switch__manage", href: "/espacio", onClick: () => close() }, "Crear o administrar espacios"),
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
