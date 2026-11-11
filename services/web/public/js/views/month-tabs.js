// "Este mes | Reportes" arriba del Mes y de Reportes (spec 013, RF-1,
// decisión 2): dos enlaces, con `aria-current` en el que se está viendo.
import { h } from "../dom.js";

export function monthTabs(active) {
  const link = (href, text, key) =>
    h("a", { href, "aria-current": active === key ? "page" : null }, text);
  return h(
    "nav",
    { class: "month-tabs", "aria-label": "Mes o reportes" },
    link("/mes", "Este mes", "month"),
    link("/mes/reportes", "Reportes", "reports"),
  );
}
