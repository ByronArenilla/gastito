// Tema claro u oscuro, sin DOM. Por defecto manda el sistema; el botón del
// encabezado elige el otro y la elección se recuerda en el dispositivo.

export const THEME_KEY = "gastito.theme";

/** Los colores de fondo de cada tema (`--paper` en tokens.css), para la
 * barra del navegador y del sistema. */
export const THEME_COLORS = { light: "#e9eee6", dark: "#111823" };

/** Lo elegido a mano, o `null` si manda el sistema. Un almacenamiento que
 * falla (modo privado) no rompe nada. */
export function storedTheme(storage) {
  try {
    const theme = storage.getItem(THEME_KEY);
    return theme === "light" || theme === "dark" ? theme : null;
  } catch {
    return null;
  }
}

export function saveTheme(storage, theme) {
  try {
    storage.setItem(THEME_KEY, theme);
  } catch {
    // No se recuerda, pero el tema cambia igual en esta visita.
  }
}

/** El tema que se está viendo: el elegido o, si no, el del sistema. */
export function activeTheme(stored, systemDark) {
  return stored ?? (systemDark ? "dark" : "light");
}

export function otherTheme(theme) {
  return theme === "dark" ? "light" : "dark";
}

/** Lo que dice el botón: a qué tema cambia. */
export function themeLabel(theme) {
  return theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
}
