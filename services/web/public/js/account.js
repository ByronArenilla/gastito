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

/** Pide la cuenta nueva (spec 032, RF-15). La API no la crea todavía:
 * envía un enlace al correo, y la cuenta nace al confirmarlo. Devuelve
 * `{ pending: true, email, detail }`.
 *
 * Una API anterior a la spec 032 sí la crea enseguida y responde con ella
 * (`id`): entonces se entra como antes y se devuelve `{ pending: false,
 * destination }`. Así la web nueva funciona con la API vieja mientras las
 * dos terminan de desplegarse (RF-21). */
export async function signUp(context, { name, email, password }) {
  const result = await context.api.post("/auth/register", { name, email, password });
  if (result?.id !== undefined) {
    return { pending: false, destination: await logIn(context, { email, password }) };
  }
  return { pending: true, email: result.email, detail: result.detail };
}

/** Crea la cuenta de un enlace de "Crear cuenta" (spec 032, RF-16). No
 * inicia sesión: devuelve la cuenta, para llevar a Entrar con su correo. */
export function confirmAccount({ api }, token) {
  return api.post("/auth/register/confirm", { token });
}

/** Pide un enlace para confirmar el correo de la sesión (spec 032, RF-17). */
export function requestVerification({ api }) {
  return api.post("/me/email-verification");
}

/** Confirma el correo de un enlace; no necesita sesión (spec 032, RF-18). */
export function confirmEmail({ api }, token) {
  return api.post("/auth/email-verification/confirm", { token });
}

/** Pide el enlace para cambiar la contraseña. La API responde lo mismo
 * exista o no la cuenta (spec 032, RF-19). */
export function requestPasswordReset({ api }, email) {
  return api.post("/auth/password-reset", { email: email.trim() });
}

/** Guarda la contraseña nueva de un enlace (spec 032, RF-20). */
export function resetPassword({ api }, { token, password }) {
  return api.post("/auth/password-reset/confirm", { token, password });
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
