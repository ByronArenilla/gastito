// Estado de la conexión (spec 011, RF-30, decisión 15). Sin service worker:
// combina `navigator.onLine`, sus eventos y lo que informa el cliente de la
// API cuando una petición falla por red o responde.

export function createConnection(win) {
  let online = win.navigator.onLine !== false;
  const listeners = new Set();

  function report(value) {
    if (value === online) return;
    online = value;
    for (const listener of listeners) listener(online);
  }

  win.addEventListener("online", () => report(true));
  win.addEventListener("offline", () => report(false));

  return {
    online: () => online,
    report,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** El mensaje de una pantalla que no se pudo abrir. Un error de la API trae
 * su mensaje en español; uno del navegador (por ejemplo, el módulo de una
 * pantalla que no carga sin conexión) no se muestra tal cual. */
export function screenError(error, online) {
  if (typeof error?.status === "number") return error.message;
  return online
    ? "No se pudo abrir esta pantalla. Revisa la conexión y vuelve a intentarlo."
    : "Sin conexión: esta pantalla se abrirá cuando vuelva la conexión.";
}
