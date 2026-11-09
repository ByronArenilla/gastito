// Mes y Planear (spec 012). Se completa en T4 y T6.
import { h } from "../dom.js";

export async function renderMonth(main) {
  main.append(h("div", { class: "screen" }, h("h1", {}, "Mes")));
}

export async function renderPlan(main) {
  main.append(h("div", { class: "screen" }, h("h1", {}, "Planear")));
}
