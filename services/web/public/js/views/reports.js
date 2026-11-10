// Pantalla Reportes (spec 013): "Este mes | Reportes", el mes elegido y los
// tres reportes. La lógica vive en `reports.js` y `charts.js`; aquí solo se
// arma el DOM y se llama a la API.
import { h } from "../dom.js";
import { formatMonth, shiftPeriod } from "../format.js";
import { screenError } from "../offline.js";
import { SAVINGS_WINDOWS, monthBounds } from "../reports.js";
import { monthTabs } from "./month-tabs.js";

const PERIOD = "reports-period";
const WINDOW = "reports-window";

export async function renderReports(main, app) {
  const base = `/spaces/${app.space.id}`;
  // En memoria mientras la app esté abierta (RF-2); al abrirla, el mes
  // anterior y 1 mes, que es lo que responde la API sin parámetros.
  let period = app.drafts.get(PERIOD);
  let months = app.drafts.get(WINDOW) ?? 1;
  let last = null;
  let loadCount = 0;

  const name = h("span", { class: "month-switch__name", "aria-live": "polite" });
  const previous = h("button", { type: "button", "aria-label": "Mes anterior", onClick: () => move(-1) }, "‹");
  const next = h("button", { type: "button", "aria-label": "Mes siguiente", onClick: () => move(1) }, "›");
  const body = h("div", { class: "reports" }, h("div", { class: "loading", "aria-hidden": "true" }));

  main.classList.add("main--reports");
  main.append(
    h(
      "div",
      { class: "screen" },
      h("h1", { class: "sr-only" }, "Reportes"),
      h(
        "div",
        { class: "reports-head" },
        monthTabs("reports"),
        h("div", { class: "month-switch", role: "group", "aria-label": "Mes de los reportes" }, previous, name, next),
      ),
      body,
    ),
  );

  function move(step) {
    if (!last) return;
    period = shiftPeriod(last.period, step);
    app.drafts.set(PERIOD, period);
    load();
  }

  function pickWindow(value) {
    months = value;
    app.drafts.set(WINDOW, months);
    load();
  }

  async function load() {
    const count = ++loadCount;
    const params = { months: String(months) };
    if (period) params.period = period;
    try {
      const reports = await app.api.get(`${base}/reports`, params);
      if (count !== loadCount) return;
      last = reports;
      period = reports.period;
      paint(reports);
    } catch (error) {
      if (count !== loadCount) return;
      body.replaceChildren(h("p", { class: "error", role: "alert" }, screenError(error, app.connection.online())));
    }
  }

  function paint(reports) {
    name.textContent = formatMonth(reports.period);
    app.setMonth(reports.period);
    const bounds = monthBounds(reports.period, reports.first_period, reports.current);
    previous.disabled = !bounds.previous;
    next.disabled = !bounds.next;
    body.replaceChildren(
      reportSection("spending", "¿En qué se me va la plata?", formatMonth(reports.period)),
      reportSection("planning", "¿Planeo bien?", formatMonth(reports.period)),
      savingsSection(reports),
    );
  }

  function savingsSection(reports) {
    const chips = h(
      "div",
      { class: "chips report__window", role: "group", "aria-label": "Meses que mira el reporte" },
      SAVINGS_WINDOWS.map((option) =>
        h(
          "button",
          {
            type: "button",
            "aria-pressed": String(option.months === months),
            onClick: () => pickWindow(option.months),
          },
          option.label,
        ),
      ),
    );
    const periods = reports.savings.window.periods;
    const label = periods.length === 1 ? formatMonth(periods[0]) : `${formatMonth(periods[0])} – ${formatMonth(periods.at(-1))}`;
    return reportSection("savings", "¿Estoy ahorrando?", label, chips);
  }

  await load();
}

/** Un reporte: rótulo con la pregunta, el mes o la ventana que mira, y su
 * contenido (RF-4). */
export function reportSection(key, question, label, ...children) {
  const id = `report-${key}`;
  return h(
    "section",
    { class: `report report--${key}`, "aria-labelledby": id },
    h("div", { class: "report__head" }, h("h2", { class: "label", id }, question), h("span", { class: "label" }, label)),
    ...children,
  );
}
