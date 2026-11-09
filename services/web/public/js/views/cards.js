// Tarjetas (spec 012). Se completa en T7 y T8.
import { h } from "../dom.js";

const placeholder = (title) => async (main) => {
  main.append(h("div", { class: "screen" }, h("h1", {}, title)));
};

export const renderCards = placeholder("Tarjetas");
export const renderCardNew = placeholder("Añadir tarjeta");
export const renderCard = placeholder("Tarjeta");
export const renderCardEdit = placeholder("Editar tarjeta");
