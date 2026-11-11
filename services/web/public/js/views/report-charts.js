// Piezas de los gráficos de los reportes (spec 013, ADR 0017): barras
// horizontales, barras divergentes, columnas por mes con línea de cero, la
// lectura al tocar una columna y "Ver cifras". Los tamaños llegan de
// `charts.js` y se pasan a CSS con `style.setProperty`, que la CSP permite
// (ADR 0016). Los gráficos se ocultan al lector de pantalla: la frase y la
// tabla de cifras dicen lo mismo (RF-26).
import { barScale, columnScale, divergentScale } from "../charts.js";
import { h } from "../dom.js";

/** Fija propiedades CSS (`--size`, `--zero`…) sin el atributo `style`. */
function withVars(element, vars) {
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, String(value));
  return element;
}

/** Barras horizontales con nombre, monto y parte: la lista de "¿En qué se me
 * va la plata?". Cada fila: `{ name, figure, share, tint }`. */
export function hbars(rows) {
  const sizes = barScale(rows.map((row) => row.amount));
  return h(
    "ul",
    { class: "hbars" },
    rows.map((row, index) =>
      h(
        "li",
        { class: "hbar" },
        h("span", { class: "hbar__name" }, row.name),
        h("span", { class: "figure" }, row.figure),
        h("span", { class: "figure hbar__share" }, row.share),
        h(
          "span",
          { class: "hbar__track", "aria-hidden": "true" },
          withVars(h("span", { class: `hbar__fill ${row.tint}` }), { "--size": sizes[index] }),
        ),
      ),
    ),
  );
}

/** Barras divergentes desde una línea de cero (RF-19): lo que se pasa a la
 * derecha en rojo, lo que sobra a la izquierda en tinta. Cada fila:
 * `{ name, figure, value }`, con `name` texto o nodos. */
export function divergent(rows) {
  const scaled = divergentScale(rows.map((row) => row.value));
  return h(
    "div",
    { class: "divergent" },
    h("div", { class: "divergent__axis", "aria-hidden": "true" }, h("span", {}, "← sobra"), h("span", {}, "se pasa →")),
    h(
      "ul",
      { class: "divergent__rows" },
      rows.map((row, index) => {
        const { side, size } = scaled[index];
        const bar = (cls) => withVars(h("span", { class: cls }), { "--size": size });
        return h(
          "li",
          { class: "divergent__row" },
          h("span", { class: "divergent__name" }, row.name),
          h("span", { class: side === "over" ? "figure over" : "figure" }, row.figure),
          h(
            "span",
            { class: "divergent__track", "aria-hidden": "true" },
            h("span", { class: "divergent__left" }, side === "under" && bar("fill-ink")),
            h("span", { class: "divergent__right" }, side === "over" && bar("fill-red")),
          ),
        );
      }),
    ),
  );
}

/**
 * Columnas por mes desde una línea de cero (RF-22). Cada columna:
 * `{ label, read, top, strong, empty, up: [{ amount, cls }], down }`: las
 * partes de arriba se apilan con 2 px de papel entre ellas; `down` (positivo)
 * es lo que baja del cero, en rojo. Tocar o pasar el puntero muestra `read` en la
 * lectura de arriba (decisión 15).
 */
export function columns(items, { initialRead, legend: legendItems = [] }) {
  const ups = items.map((item) => item.up.reduce((sum, part) => sum + part.amount, 0));
  const downs = items.map((item) => -(item.down ?? 0));
  const { zero, sizes } = columnScale([...ups, ...downs]);
  const readout = h("p", { class: "readout" }, initialRead);

  const cols = items.map((item, index) => {
    const plot = withVars(h("div", { class: "col__plot" }), { "--zero": zero });
    if (!item.empty) {
      const stack = withVars(h("div", { class: "col__up" }), { "--size": sizes[index] });
      for (const part of item.up) {
        if (part.amount > 0) stack.append(withVars(h("span", { class: part.cls }), { "--part": part.amount }));
      }
      plot.append(stack);
      if (item.down) {
        plot.append(withVars(h("div", { class: "col__down fill-red" }), { "--size": -sizes[items.length + index] }));
      }
    }
    plot.append(h("div", { class: "col__zero" }));
    const col = h(
      "div",
      { class: item.empty ? "col col--empty" : "col" },
      h("span", { class: item.strong ? "col__top col__top--strong" : "col__top" }, item.top ?? ""),
      plot,
      h("span", { class: "col__label" }, item.label),
    );
    const read = () => {
      for (const other of cols) other.classList.remove("is-read");
      col.classList.add("is-read");
      readout.replaceChildren(...item.read);
    };
    col.addEventListener("click", read);
    col.addEventListener("pointerover", (event) => {
      if (event.pointerType === "mouse") read();
    });
    return col;
  });

  const scroll = h("div", { class: "chart-scroll" }, h("div", { class: "cols" }, cols));
  const chart = h(
    "div",
    { class: "chart", "aria-hidden": "true" },
    readout,
    scroll,
    legendItems.length > 0 && legend(legendItems),
  );
  chart.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    for (const col of cols) col.classList.remove("is-read");
    readout.replaceChildren(...initialRead);
  });
  // 12 meses en el celular: el mes más reciente a la vista ("Celular y
  // computador"). Se hace cuando el gráfico ya está en la página.
  requestAnimationFrame(() => {
    scroll.scrollLeft = scroll.scrollWidth;
  });
  return chart;
}

/** Leyenda: muestra de color y nombre, nunca el color solo (RF-17). */
export function legend(items) {
  return h(
    "ul",
    { class: "legend legend--inline" },
    items.map(({ cls, text }) => h("li", {}, h("span", { class: `swatch ${cls}` }), text)),
  );
}

/** "Ver cifras": la tabla del gráfico, que se abre con teclado (RF-26). */
export function figures({ caption, head, rows, total = null }) {
  return h(
    "details",
    { class: "figures" },
    h("summary", {}, "Ver cifras"),
    h(
      "div",
      { class: "scroll-x" },
      h(
        "table",
        { class: "schedule figures__table" },
        h("caption", {}, caption),
        h("thead", {}, h("tr", {}, head.map((cell) => h("th", { scope: "col" }, cell)))),
        h(
          "tbody",
          {},
          rows.map((row) => h("tr", {}, row.map((cell) => h("td", { class: cell?.over ? "over" : null }, cell?.text ?? cell)))),
          total && h("tr", { class: "figures__total" }, total.map((cell) => h("td", {}, cell))),
        ),
      ),
    ),
  );
}
