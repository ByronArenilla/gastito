// Pantalla Reportes (spec 013): "Este mes | Reportes", el mes elegido y los
// tres reportes. La lógica vive en `reports.js` y `charts.js`; aquí solo se
// arma el DOM y se llama a la API.
import { h } from "../dom.js";
import { formatMonth, formatMonthShort, formatPesos, shiftPeriod } from "../format.js";
import { screenError } from "../offline.js";
import {
  SAVINGS_WINDOWS,
  monthBounds,
  percentText,
  planningReport,
  savingsReport,
  spendingReport,
} from "../reports.js";
import { monthTabs } from "./month-tabs.js";
import { columns, divergent, figures, hbars } from "./report-charts.js";

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
    return reportSection("savings", "¿Estoy ahorrando?", label, chips, ...savingsBody(reports));
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

/** "oct" y, en la primera columna o en enero, el año debajo. */
function columnLabel(period, index) {
  const [month, year] = formatMonthShort(period).split(" ");
  return index === 0 || period.endsWith("-01") ? [month, h("br"), h("b", {}, year)] : month;
}

/** Lo que dice la lectura al tocar una columna (decisión 15). */
function savingsRead(month) {
  const label = h("b", {}, formatMonthShort(month.period));
  if (month.empty) return [label, " · sin datos"];
  const parts = [`apartado ${formatPesos(month.saved)}`];
  if (month.withdrawn) parts.push(`retirado ${formatPesos(month.withdrawn)}`);
  parts.push(`quedó ${formatPesos(month.left)}`);
  const share = month.share === null ? "" : ` · ${percentText(month.share)}`;
  return [label, ` · ahorraste ${formatPesos(month.total)} (${parts.join(", ")})${share}`];
}

/** ¿Estoy ahorrando? (RF-21 a RF-23). */
function savingsBody(reports) {
  const report = savingsReport(reports);
  if (report.empty) {
    return [
      h(
        "div",
        { class: "empty stack" },
        h("p", { class: "report__answer" }, report.empty),
        h("p", {}, "Planea un rubro en la categoría Ahorro y registra lo que apartes cada mes."),
      ),
    ];
  }
  const head = [answer(report.answer), h("p", { class: "report__sub" }, report.sub)];
  let chart;
  if (report.single) {
    const month = report.single;
    const row = (label, value, cls = "figure") =>
      h("div", { class: "big__row" }, h("span", {}, label), h("span", { class: cls }, value));
    chart = h(
      "div",
      { class: "big" },
      h("span", { class: month.total < 0 ? "big__value over" : "big__value" }, formatPesos(month.total)),
      row("Apartado en Ahorro", formatPesos(month.saved)),
      month.withdrawn > 0 && row("Retirado del ahorro", formatPesos(-month.withdrawn)),
      row("Quedó sin gastar", formatPesos(month.left), month.left < 0 ? "figure over" : "figure"),
      row(`Ingreso planeado${month.income_estimated ? " (estimado)" : ""}`, formatPesos(month.income)),
      row("Parte del ingreso", percentText(month.share)),
    );
  } else {
    const latest = [...report.columns].reverse().find((column) => !column.empty);
    chart = columns(
      report.columns.map((column, index) => ({
        label: columnLabel(column.period, index),
        read: savingsRead(column.month),
        top: column.top,
        strong: column.top !== "",
        empty: column.empty,
        up: column.up,
        down: column.down,
      })),
      {
        initialRead: savingsRead(latest.month),
        legend: [
          { cls: "fill-ink", text: "Apartado, menos lo retirado" },
          { cls: "fill-left", text: "Quedó sin gastar" },
          { cls: "fill-red", text: "Faltó" },
        ],
      },
    );
  }
  const months = reports.savings.months;
  return [
    ...head,
    chart,
    figures({
      caption: "Lo apartado en Ahorro, lo retirado, lo que quedó sin gastar y lo ahorrado (apartado − retirado + quedó), por mes.",
      head: ["Mes", "Ingreso", "Apartado", "Retirado", "Quedó", "Ahorrado", "Parte"],
      rows: months.map((month) =>
        month.empty
          ? [formatMonthShort(month.period), "sin datos", "", "", "", "", ""]
          : [
              formatMonthShort(month.period),
              `${formatPesos(month.income)}${month.income_estimated ? " (est.)" : ""}`,
              formatPesos(month.saved),
              month.withdrawn ? formatPesos(-month.withdrawn) : "—",
              { text: formatPesos(month.left), over: month.left < 0 },
              { text: formatPesos(month.total), over: month.total < 0 },
              percentText(month.share),
            ],
      ),
      total: reports.savings.average
        ? ["Promedio", "", "", "", "", formatPesos(reports.savings.average.total), percentText(reports.savings.average.share)]
        : null,
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
