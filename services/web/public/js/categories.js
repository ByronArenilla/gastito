// Categorías sin DOM (spec 012, RF-28). Que el nombre no se repita ni pase
// del largo permitido lo dice la API (spec 002).

/** El nombre sin espacios alrededor; vacío no se envía. */
export function categoryRequest(name) {
  const clean = name.trim();
  return clean ? { body: { name: clean }, missing: [] } : { body: null, missing: ["name"] };
}
