// Inicio (`/inicio`): a donde lleva el logo. Una guía de las secciones que
// no están en los botones de abajo del celular: Mes, Reportes, Tarjetas y
// Espacio, cada una con lo que se hace ahí y, si se puede, cómo va.
import { h } from "../dom.js";
import { homeStatus } from "../home.js";

function tile({ href, title, text, note = null, tag = null }) {
  return h(
    "a",
    { class: tag ? "tile tile--start" : "tile", href },
    h("span", { class: "tile__title" }, title, tag && h("span", { class: "tile__tag" }, tag)),
    h("span", { class: "tile__text" }, text),
    note && h("span", { class: "tile__note" }, note),
    h("span", { class: "tile__arrow", "aria-hidden": "true" }, "›"),
  );
}

export async function renderHome(main, app) {
  // El resumen solo añade las frases de "cómo va": si falla, la guía sale
  // igual. Un 401 ya lo maneja el cliente de la API (pide entrar de nuevo).
  let summary = null;
  try {
    summary = await app.api.get(`/spaces/${app.space.id}/summary`);
  } catch {
    summary = null;
  }
  const status = homeStatus(summary);
  if (summary) app.setMonth(summary.period);

  main.classList.add("main--wide");
  main.append(
    h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "stack" },
        h("h1", {}, "Inicio"),
        h(
          "p",
          { class: "muted" },
          "Elige a dónde ir. Para anotar un gasto o ver los del mes, Registrar y Gastos están siempre a la mano.",
        ),
      ),
      h(
        "nav",
        { class: "tiles", "aria-label": "Secciones de Gastito" },
        tile({
          href: "/mes",
          title: "Mes",
          text: "Cómo va el mes: lo planeado frente a lo gastado, rubro por rubro. Aquí también se planea.",
          note: status.month,
          tag: status.start ? "Empieza aquí" : null,
        }),
        tile({
          href: "/mes/reportes",
          title: "Reportes",
          text: "En qué se te va la plata, si planeas bien y si estás ahorrando.",
        }),
        tile({
          href: "/tarjetas",
          title: "Tarjetas",
          text: "Lo que hay que pagarle a cada tarjeta, con sus cuotas y sus abonos.",
          note: status.cards,
        }),
        tile({
          href: "/espacio",
          title: "Espacio",
          text: `Las categorías de «${app.space.name}», invitar a alguien, crear otro espacio y tu cuenta.`,
        }),
      ),
    ),
  );
}
