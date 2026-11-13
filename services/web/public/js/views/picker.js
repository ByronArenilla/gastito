// La lista de categorías de Registrar. Un `<select>` del sistema no se puede
// diseñar, así que es un botón que despliega las categorías como casillas
// (cada una con su inicial), en el flujo de la hoja, igual que las
// sugerencias de rubros. Son botones de verdad con `aria-pressed`, como el
// tipo de pago: se recorren con Tab y se eligen con Enter o Espacio.
import { h } from "../dom.js";

const PLACEHOLDER = "Elige la categoría";

function initial(name) {
  return name.trim().charAt(0).toUpperCase();
}

/**
 * `options` son `{ id, name }`; `nameOf(id)` da el nombre de una categoría
 * que ya no está entre ellas (eliminada); `create` es el enlace del final,
 * `{ href, label, onClick }`. Devuelve el botón y la lista, que van en el
 * mismo renglón, y `set(id)` / `close()`.
 */
export function categoryPicker({ id, labelId, options, nameOf, onPick, create = null }) {
  const mark = h("span", { class: "picker__mark", "aria-hidden": "true", hidden: true });
  const text = h("span", { class: "picker__text" }, PLACEHOLDER);
  const button = h(
    "button",
    {
      type: "button",
      class: "picker__button picker__button--empty",
      id,
      name: "category_id",
      "aria-expanded": "false",
      "aria-controls": `${id}-list`,
      // "Categoría" y, después, la elegida.
      "aria-labelledby": `${labelId} ${id}`,
      onClick: () => (list.hidden ? open() : close()),
    },
    mark,
    text,
  );
  const choices = options.map((option) =>
    h(
      "button",
      {
        type: "button",
        class: "picker__option",
        "aria-pressed": "false",
        onClick: () => {
          close({ focus: true });
          onPick(option.id);
        },
      },
      h("span", { class: "picker__mark", "aria-hidden": "true" }, initial(option.name)),
      h("span", { class: "picker__name" }, option.name),
    ),
  );
  const list = h(
    "div",
    { class: "picker__list", id: `${id}-list`, role: "group", "aria-labelledby": labelId, hidden: true },
    choices,
    create &&
      h(
        "a",
        { class: "picker__option picker__option--create", href: create.href, onClick: create.onClick },
        h("span", { class: "picker__mark", "aria-hidden": "true" }, "+"),
        h("span", { class: "picker__name" }, create.label),
      ),
  );

  function outside(event) {
    if (!button.contains(event.target) && !list.contains(event.target)) close();
  }

  function close({ focus = false } = {}) {
    if (list.hidden) return;
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside);
    if (focus) button.focus();
  }

  function open() {
    list.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside);
    list.scrollIntoView({ block: "nearest" });
  }

  for (const element of [button, list]) {
    element.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close({ focus: true });
    });
  }

  return {
    button,
    list,
    close,
    set(value) {
      const index = options.findIndex((option) => option.id === value);
      const name = index >= 0 ? options[index].name : value === null ? "" : nameOf(value);
      choices.forEach((choice, position) => choice.setAttribute("aria-pressed", String(position === index)));
      button.classList.toggle("picker__button--empty", !name);
      mark.hidden = !name;
      mark.textContent = name ? initial(name) : "";
      text.textContent = name || PLACEHOLDER;
    },
  };
}
