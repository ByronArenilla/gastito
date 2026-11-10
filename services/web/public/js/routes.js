// Rutas de la app (spec 011, plan "Pantallas y datos"; spec 012, plan
// "Pantallas y datos").
//
// `access`: "guest" solo sin sesión (entrar, crear cuenta), "member" con
// sesión, "any" con o sin ella (unirse por enlace, decisión 19 de la 011).

const ROUTES = [
  { pattern: /^\/entrar$/, view: "login", access: "guest" },
  { pattern: /^\/crear-cuenta$/, view: "register", access: "guest" },
  { pattern: /^\/mes$/, view: "month", access: "member" },
  { pattern: /^\/mes\/planear$/, view: "plan", access: "member" },
  { pattern: /^\/mes\/reportes$/, view: "reports", access: "member" },
  { pattern: /^\/registrar$/, view: "record", access: "member" },
  { pattern: /^\/gastos$/, view: "expenses", access: "member" },
  { pattern: /^\/gastos\/(?<id>\d+)$/, view: "edit", access: "member" },
  { pattern: /^\/tarjetas$/, view: "cards", access: "member" },
  { pattern: /^\/tarjetas\/nueva$/, view: "cardNew", access: "member" },
  { pattern: /^\/tarjetas\/(?<id>\d+)$/, view: "card", access: "member" },
  { pattern: /^\/tarjetas\/(?<id>\d+)\/editar$/, view: "cardEdit", access: "member" },
  { pattern: /^\/compras\/(?<id>\d+)$/, view: "purchase", access: "member" },
  { pattern: /^\/retiros\/(?<id>\d+)$/, view: "withdrawal", access: "member" },
  { pattern: /^\/espacio$/, view: "space", access: "member" },
  { pattern: /^\/unirse\/(?<token>[\w-]+)$/, view: "join", access: "any" },
];

/** Ancho desde el que la navegación va al costado y se abre el Mes. */
const WIDE = 1024;

/** La pantalla de inicio: el Mes en el computador y Registrar en el celular
 * (spec 012, decisión 3). Se decide con el ancho de la ventana al abrir. */
export function homePath(width) {
  return width >= WIDE ? "/mes" : "/registrar";
}

export function matchRoute(pathname, { width = 0 } = {}) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const { pattern, view, access } of ROUTES) {
    const match = pattern.exec(path);
    if (!match) continue;
    const params = { ...match.groups };
    if (params.id !== undefined) params.id = Number(params.id);
    return { view, params, access };
  }
  return { redirect: homePath(width) };
}
