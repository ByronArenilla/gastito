// Entrar, crear cuenta y cerrar sesión, sin DOM (spec 011, RF-1 a RF-4).
// Las pantallas de `views/auth.js` y `views/space.js` los usan.

const OFFLINE_LOGOUT =
  "Cerraste sesión en este dispositivo. Como no hay conexión, la sesión en el " +
  "servidor se cerrará sola tras 90 días sin uso.";

/** Entra y devuelve la ruta a la que ir: la que se pidió antes de entrar o
 * la pantalla de inicio del dispositivo (RF-2 y decisión 16 de la 011; RF-2
 * de la 012). Sin `home`, Registrar. */
export async function logIn({ api, session, home }, { email, password }) {
  const token = await api.post("/auth/login", { email, password });
  session.save({ token: token.access_token, email: email.trim().toLowerCase() });
  return session.takeNext() ?? home?.() ?? "/registrar";
}

/** Crea la cuenta, con su nombre (spec 031, RF-8), y entra con ella (RF-1). */
export async function signUp(context, { name, email, password }) {
  await context.api.post("/auth/register", { name, email, password });
  return logIn(context, { email, password });
}

/** Guarda el nombre de quien tiene la sesión y devuelve la cuenta al día
 * (spec 031, RF-4). */
export function saveName({ api }, name) {
  return api.patch("/me", { name });
}

/** Cierra la sesión en la API y borra lo del dispositivo. Sin conexión, borra
 * igual y devuelve el aviso de los 90 días (RF-4). */
export async function logOut({ api, session }) {
  try {
    await api.post("/auth/logout");
    return null;
  } catch (error) {
    if (error.offline) return OFFLINE_LOGOUT;
    // Una sesión que ya no existe (401) también cuenta como cerrada.
    if (error.status === 401) return null;
    throw error;
  } finally {
    session.clear();
  }
}
