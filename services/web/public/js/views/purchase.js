// Compra con tarjeta y abonos (spec 012). Se completa en T9.
import { h } from "../dom.js";

export async function renderPurchase(main) {
  main.append(h("div", { class: "screen" }, h("h1", {}, "Compra")));
}
