// Pantalla Reportes (spec 013): "Este mes | Reportes", el mes elegido y los
// tres reportes. La lógica vive en `reports.js` y `charts.js`; aquí solo se
// arma el DOM y se llama a la API.
import { h } from "../dom.js";
import { formatMonth, formatPesos, shiftPeriod } from "../format.js";
import { screenError } from "../offline.js";
import {
  SAVINGS_WINDOWS,
  monthBounds,
  percentText,
  planningReport,
  spendingReport,
} from "../reports.js";
import { monthTabs } from "./month-tabs.js";
import { divergent, figures, hbars } from "./report-charts.js";

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
    const month = formatMonth(reports.period);
    body.replaceChildren(
      reportSection("spending", "¿En qué se me va la plata?", month, ...spendingBody(reports)),
      reportSection("planning", "¿Planeo bien?", month, ...planningBody(reports)),
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

/** La frase con la cifra en monoespaciada (RF-4); el lector de pantalla la
 * lee entera. */
function answer(parts) {
  return h(
    "p",
    { class: "report__answer" },
    parts.map((part) => (typeof part === "string" ? part : h("span", { class: "figure" }, part.figure))),
  );
}

/** Un mes sin datos: lo dice y ofrece planear (decisión 14). */
function emptyState(text) {
  return [
    h(
      "div",
      { class: "empty stack" },
      h("p", { class: "report__answer" }, text),
      h("p", {}, "Planea el mes y registra tus gastos: cuando termine, aquí verás cómo te fue."),
      h("a", { class: "button button--quiet", href: "/mes/planear" }, "Planear"),
    ),
  ];
}

/** ¿En qué se me va la plata? (RF-14, RF-15, RF-17, RF-31). */
function spendingBody(reports) {
  const report = spendingReport(reports);
  if (report.empty) return emptyState(report.empty);
  const data = reports.spending;
  return [
    answer(report.answer),
    h("p", { class: "report__sub" }, report.sub),
    hbars(report.rows),
    figures({
      caption: `Lo gastado por categoría en ${formatMonth(reports.period)}, sin lo apartado en Ahorro.`,
      head: ["Categoría", "Gastado", "Parte"],
      rows: [
        ...data.lines.map((line) => [
          line.deleted ? `${line.name} (eliminada)` : line.name,
          formatPesos(line.total),
          percentText(line.share),
        ]),
        ["No planeado (incluido arriba)", formatPesos(data.unplanned), percentText(data.unplanned_share)],
        ...(data.saved ? [["Apartado en Ahorro (aparte)", formatPesos(data.saved), ""]] : []),
        ...(data.withdrawn ? [["Retirado del ahorro (aparte)", formatPesos(-data.withdrawn), ""]] : []),
      ],
      total: ["Total gastado", formatPesos(data.total), percentText(100)],
    }),
  ];
}

/** ¿Planeo bien? (RF-18 a RF-20): las filas sin rubro dicen "· sin rubro". */
function planningBody(reports) {
  const report = planningReport(reports);
  if (report.empty) return emptyState(report.empty);
  const name = (row) =>
    row.unplanned ? [row.name, h("span", { class: "muted" }, " · sin rubro")] : row.name;
  return [
    answer(report.answer),
    h("p", { class: "report__sub" }, report.sub),
    divergent(report.rows.map((row) => ({ name: name(row), figure: row.figure, value: row.value }))),
    figures({
      caption: `Planeado y gastado por rubro en ${formatMonth(reports.period)}. Lo gastado sin rubro tiene planeado 0; Ahorro no entra: lo mide "¿Estoy ahorrando?".`,
      head: ["Rubro", "Planeado", "Gastado", "Diferencia"],
      rows: report.rows.map((row) => [
        row.unplanned ? `Sin rubro · ${row.category}` : `${row.name} · ${row.category}`,
        formatPesos(row.planned),
        formatPesos(row.spent),
        { text: row.figure, over: row.value > 0 },
      ]),
    }),
  ];
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
