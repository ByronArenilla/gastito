// Arranque de la web (spec 011): sesión, cliente de la API, rutas,
// navegación y avisos. Las pantallas viven en `views/` y reciben `app`, el
// contexto compartido.
import { API_URL } from "/config.js";
import { logOut, requestVerification } from "./account.js";
import { createApi } from "./api.js";
import { h } from "./dom.js";
import { formatMonthShort } from "./format.js";
import { createConnection, screenError } from "./offline.js";
import { displayName, initials, needsName, needsVerification } from "./profile.js";
import { homePath, matchRoute } from "./routes.js";
import { createSession } from "./session.js";
import { createDrafts } from "./state.js";
import { THEME_COLORS, activeTheme, otherTheme, saveTheme, storedTheme, themeLabel } from "./theme.js";
import { confirmDialog, createNotices } from "./views/notices.js";
import { createProfileMenu } from "./views/profile.js";

// Cada pantalla se carga cuando se visita (módulos ES, sin compilar).
const VIEWS = {
  home: () => import("./views/home.js").then((module) => module.renderHome),
  name: () => import("./views/name.js").then((module) => module.renderName),
  profile: () => import("./views/profile.js").then((module) => module.renderProfile),
  account: () => import("./views/account.js").then((module) => module.renderAccount),
  login: () => import("./views/auth.js").then((module) => module.renderLogin),
  register: () => import("./views/auth.js").then((module) => module.renderRegister),
  confirmAccount: () => import("./views/email-links.js").then((module) => module.renderConfirmAccount),
  verifyEmail: () => import("./views/email-links.js").then((module) => module.renderVerifyEmail),
  forgot: () => import("./views/email-links.js").then((module) => module.renderForgot),
  reset: () => import("./views/email-links.js").then((module) => module.renderReset),
  record: () => import("./views/record.js").then((module) => module.renderRecord),
  edit: () => import("./views/record.js").then((module) => module.renderEdit),
  expenses: () => import("./views/expenses.js").then((module) => module.renderExpenses),
  space: () => import("./views/space.js").then((module) => module.renderSpace),
  join: () => import("./views/join.js").then((module) => module.renderJoin),
  month: () => import("./views/month.js").then((module) => module.renderMonth),
  plan: () => import("./views/month.js").then((module) => module.renderPlan),
  reports: () => import("./views/reports.js").then((module) => module.renderReports),
  cards: () => import("./views/cards.js").then((module) => module.renderCards),
  cardNew: () => import("./views/cards.js").then((module) => module.renderCardNew),
  card: () => import("./views/cards.js").then((module) => module.renderCard),
  cardEdit: () => import("./views/cards.js").then((module) => module.renderCardEdit),
  purchase: () => import("./views/purchase.js").then((module) => module.renderPurchase),
  withdrawal: () => import("./views/withdrawal.js").then((module) => module.renderWithdrawal),
};

// Qué sección de la navegación marca cada pantalla.
const SECTIONS = {
  home: "home",
  profile: "profile",
  account: "profile",
  month: "month",
  plan: "month",
  reports: "reports",
  record: "record",
  edit: "expenses",
  expenses: "expenses",
  cards: "cards",
  cardNew: "cards",
  card: "cards",
  cardEdit: "cards",
  purchase: "cards",
  withdrawal: "expenses",
  space: "profile",
};

// En el celular no todas las secciones tienen su botón abajo: Reportes se
// alcanza desde Mes y Tarjetas desde Inicio. Cuando el enlace de una sección
// no está a la vista, se marca el de la que lleva a ella.
const SECTION_FALLBACK = { reports: "month", cards: "home" };

const shell = document.getElementById("app");
const main = document.getElementById("main");
const spaceName = document.getElementById("space-name");
const profileName = document.getElementById("profile-name");
const profileSpace = document.getElementById("profile-space");
const profileInitials = document.getElementById("profile-initials");
const monthLabel = document.getElementById("current-month");
const dialog = document.getElementById("dialog");

const session = createSession({ local: window.localStorage, temporary: window.sessionStorage });
const connection = createConnection(window);
const noticesBox = document.getElementById("notices");
const notices = createNotices(noticesBox);
const drafts = createDrafts();
let renderCount = 0;

const api = createApi({
  baseUrl: API_URL,
  fetch: (...args) => window.fetch(...args),
  token: () => session.token(),
  onNetwork: (online) => connection.report(online),
  // La sesión caducó o se cerró en otro lado (RF-3, decisión 16): se pide
  // entrar de nuevo y después se vuelve a esta misma pantalla.
  onUnauthorized: (message) => {
    // Sin sesión guardada (unas credenciales malas al entrar), el 401 es solo
    // un error del formulario.
    if (!session.isLoggedIn()) return;
    session.clear();
    app.me = null;
    session.setNext(location.pathname);
    drafts.set("auth-message", message);
    navigate("/entrar", { replace: true });
  },
});

/** El contexto que reciben todas las pantallas. */
const app = {
  api,
  session,
  connection,
  drafts,
  notices,
  me: null,
  spaces: [],
  space: null,
  navigate,
  /** La pantalla de inicio de este dispositivo (spec 012, decisión 3). */
  home: () => homePath(window.innerWidth),
  confirm: (options) => confirmDialog(dialog, options),
  /** Usuario, espacios y espacio actual (RF-23, decisión 17). */
  async loadAccount() {
    const [me, spaces] = await Promise.all([api.get("/me"), api.get("/spaces")]);
    app.me = me;
    app.spaces = spaces;
    app.space = session.chooseSpace(spaces);
    refreshProfile();
  },
  /** Pasa a otro espacio y lo recuerda en el dispositivo. */
  useSpace(space) {
    session.setSpace(space.id);
    app.space = space;
    refreshProfile();
  },
  /** Pasa a otro espacio y vuelve a pintar la pantalla (el perfil). */
  switchSpace,
  /** Cierra la sesión y lleva a Entrar (decisión 22 de la 011). */
  async signOut() {
    const notice = await logOut(app).catch((error) => error.message);
    app.me = null;
    drafts.clear("record");
    navigate("/entrar", { replace: true });
    if (notice) notices.show({ text: notice, seconds: 0 });
  },
  /** El mes que muestra el encabezado (`AAAA-MM`). */
  setMonth(period) {
    monthLabel.textContent = period ? formatMonthShort(period) : "";
  },
  /** Vuelve a marcar lo que envía datos según la conexión. */
  refreshSending,
};

/** Quién eres y en qué espacio estás: el encabezado y el perfil del menú. */
function refreshProfile() {
  spaceName.textContent = app.space?.name ?? "";
  profileSpace.textContent = app.space?.name ?? "";
  profileName.textContent = displayName(app.me);
  profileInitials.textContent = initials(app.me);
  refreshVerification();
}

// --- "Confirma tu correo" (spec 032, RF-17) ---
// Una cuenta anterior a la spec lo ve arriba hasta que confirme. "Ahora no"
// lo quita hasta la próxima vez que se abra la app; en Mi cuenta sigue.
let verificationSnoozed = false;
let currentView = null;
const verificationSend = h(
  "button",
  {
    type: "button",
    class: "button button--link",
    "data-sends": true,
    onClick: async () => {
      if (!connection.online()) return;
      verificationSend.disabled = true;
      try {
        const result = await requestVerification(app);
        notices.show({ text: result.detail, seconds: 10 });
      } catch (error) {
        // Por ejemplo, el minuto de espera entre un correo y otro.
        if (error.status !== 401) notices.show({ text: error.message, kind: "error", seconds: 10 });
      } finally {
        verificationSend.disabled = false;
      }
    },
  },
  "Enviar enlace",
);
const verificationBar = h(
  "div",
  { class: "notice notice--pending", role: "status" },
  h(
    "span",
    { class: "notice__text" },
    h("b", {}, "Confirma tu correo"),
    h("span", {}, "Te enviamos un enlace y lo abres. Sin confirmarlo no puedes compartir espacios."),
  ),
  verificationSend,
  h(
    "button",
    {
      type: "button",
      class: "button button--link",
      onClick: () => {
        verificationSnoozed = true;
        refreshVerification();
      },
    },
    "Ahora no",
  ),
);

function refreshVerification() {
  const show =
    !verificationSnoozed &&
    session.isLoggedIn() &&
    needsVerification(app.me) &&
    !shell.hasAttribute("data-guest") &&
    // En la pantalla del enlace el aviso sobra: ahí mismo se confirma.
    currentView !== "verifyEmail";
  if (!show) verificationBar.remove();
  else if (!verificationBar.isConnected) noticesBox.prepend(verificationBar);
}

/** Pasa a otro espacio desde el perfil y vuelve a pintar la pantalla.
 * Lo escrito en Registrar y el mes elegido eran del espacio anterior; un
 * gasto, una tarjeta o una compra abiertos también, así que de ahí se sale. */
function switchSpace(space) {
  app.useSpace(space);
  for (const key of ["record", "period", "withdrawal"]) drafts.clear(key);
  const route = matchRoute(location.pathname, { width: window.innerWidth });
  if (Object.keys(route.params ?? {}).length) navigate(app.home(), { replace: true });
  else render();
  notices.show({ text: `Ahora estás en «${space.name}».`, seconds: 6 });
}

const profileMenu = createProfileMenu({
  root: document.getElementById("profile"),
  button: document.getElementById("profile-button"),
  menu: document.getElementById("profile-menu"),
  app,
});

// --- Tema claro u oscuro ---
const themeToggle = document.getElementById("theme-toggle");
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
// Los `<meta name="theme-color">` con el color que traían, para devolvérselo
// al sistema si no hay un tema elegido.
const themeMetas = [...document.querySelectorAll('meta[name="theme-color"]')].map((meta) => ({
  meta,
  original: meta.content,
}));

/** Pone el tema elegido (o deja el del sistema) y pone al día el botón y el
 * color de la barra del navegador. */
function applyTheme() {
  const stored = storedTheme(window.localStorage);
  const theme = activeTheme(stored, systemDark.matches);
  if (stored) document.documentElement.dataset.theme = stored;
  else delete document.documentElement.dataset.theme;
  for (const { meta, original } of themeMetas) meta.content = stored ? THEME_COLORS[stored] : original;
  themeToggle.setAttribute("aria-label", themeLabel(theme));
  themeToggle.title = themeLabel(theme);
}

themeToggle.addEventListener("click", () => {
  const theme = activeTheme(storedTheme(window.localStorage), systemDark.matches);
  saveTheme(window.localStorage, otherTheme(theme));
  // Si no se pudo guardar (modo privado), al menos cambia en esta visita.
  if (storedTheme(window.localStorage) === null) document.documentElement.dataset.theme = otherTheme(theme);
  applyTheme();
});
// Sin tema elegido, el botón sigue al sistema si este cambia.
systemDark.addEventListener("change", applyTheme);
applyTheme();

function refreshSending() {
  const offline = !connection.online();
  document.body.toggleAttribute("data-offline", offline);
  for (const element of document.querySelectorAll("[data-sends]")) {
    element.setAttribute("aria-disabled", String(offline));
  }
}

function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  render();
}

function markSection(view) {
  const links = [...document.querySelectorAll("a[data-section]")];
  // `offsetParent` es `null` en un enlace oculto (`display: none`).
  const shown = (section) =>
    links.some((link) => link.dataset.section === section && link.offsetParent !== null);
  let section = SECTIONS[view];
  if (section && !shown(section)) section = SECTION_FALLBACK[section] ?? section;
  for (const link of links) {
    if (link.dataset.section === section) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

async function render() {
  const count = ++renderCount;
  profileMenu.close();
  const route = matchRoute(location.pathname, { width: window.innerWidth });
  if (route.redirect) return navigate(route.redirect, { replace: true });

  const loggedIn = session.isLoggedIn();
  if (route.access === "member" && !loggedIn) {
    session.setNext(location.pathname);
    return navigate("/entrar", { replace: true });
  }
  if (route.access === "guest" && loggedIn) {
    return navigate(session.takeNext() ?? app.home(), { replace: true });
  }

  const member = loggedIn && route.access !== "guest";
  // "¿Cómo te llamas?" se ve como las pantallas de entrar: sin menú.
  shell.toggleAttribute("data-guest", !member || route.view === "name");
  markSection(route.view);
  currentView = route.view;
  refreshVerification();
  app.setMonth(null);
  // Cada pantalla pone su ancho (`main--wide`, `main--reports`): sin esto,
  // el de la anterior se quedaba.
  main.className = "main";
  main.replaceChildren(h("div", { class: "loading", "aria-hidden": "true" }));

  try {
    if (member && !app.me) await app.loadAccount();
    if (count !== renderCount) return;
    // Una cuenta sin nombre lo escribe antes de seguir (spec 031, RF-9), y
    // después vuelve a la pantalla que había pedido.
    if (member && needsName(app.me) && route.view !== "name") {
      session.setNext(location.pathname);
      return navigate("/tu-nombre", { replace: true });
    }
    if (route.view === "name" && !needsName(app.me)) return navigate(app.home(), { replace: true });
    refreshVerification();
    const view = await VIEWS[route.view]();
    if (count !== renderCount) return;
    main.replaceChildren();
    await view(main, app, route.params);
  } catch (error) {
    if (count !== renderCount || error.status === 401) return;
    main.replaceChildren(
      h(
        "div",
        { class: "screen" },
        h("p", { class: "error", role: "alert" }, screenError(error, connection.online())),
        h("button", { type: "button", class: "button button--quiet", onClick: render }, "Reintentar"),
      ),
    );
  }
  refreshSending();
  // Lleva el foco a la pantalla nueva si la vista no lo puso en un campo.
  if (!main.contains(document.activeElement)) main.focus({ preventScroll: true });
}

// Los enlaces internos cambian de pantalla sin recargar la página.
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    link.target ||
    link.hasAttribute("download") ||
    link.origin !== location.origin
  ) {
    return;
  }
  event.preventDefault();
  if (link.pathname !== location.pathname) navigate(link.pathname);
});

window.addEventListener("popstate", render);

connection.subscribe((online) => {
  notices.setOffline(!online);
  refreshSending();
});
notices.setOffline(!connection.online());

render();
