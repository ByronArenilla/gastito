// El perfil, sin DOM: cómo se muestra una persona (spec 031).

/** El nombre o, en una cuenta que todavía no lo tiene, el correo. */
export function displayName(me) {
  return me?.name || me?.email || "";
}

/** Las iniciales del círculo del perfil: "Byron Arenilla" → "BA", "Byron" →
 * "B". Sin nombre, la primera letra del correo. */
export function initials(me) {
  const words = (me?.name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length) {
    const letters = words.length === 1 ? [words[0]] : [words[0], words.at(-1)];
    return letters.map((word) => word.charAt(0).toUpperCase()).join("");
  }
  return (me?.email ?? "?").charAt(0).toUpperCase() || "?";
}

/** El nombre sin espacios alrededor; vacío no se envía. Que no pase de 50
 * caracteres lo dice la API (spec 031, RF-1). */
export function nameRequest(text) {
  const name = text.trim();
  return name ? { body: { name }, missing: [] } : { body: null, missing: ["name"] };
}

/** Si hay que pedirle el nombre a esta cuenta (spec 031, RF-9): solo cuando
 * la API dice expresamente que no lo tiene (`name: null`). Una API anterior
 * a la spec no envía `name`: ahí no se pide, porque tampoco sabría
 * guardarlo. Así la web nueva funciona con la API vieja mientras las dos
 * terminan de desplegarse, sin importar cuál llega primero. */
export function needsName(me) {
  return me != null && me.name === null;
}
