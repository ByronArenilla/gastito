// Reportes, sin DOM (spec 013): el mes elegido, la ventana de "¿Estoy
// ahorrando?" y lo que dice y dibuja cada reporte. Todo sale de la respuesta
// de `GET reports`: aquí no se calcula ninguna regla de negocio (principio
// 10), solo frases, orden de las tintas y escalas.
import { shiftPeriod } from "./format.js";

/** Ventanas de "¿Estoy ahorrando?", que terminan en el mes elegido (RF-2). */
export const SAVINGS_WINDOWS = [
  { months: 1, label: "1 mes" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
  { months: 12, label: "12 meses" },
];

/** Si se puede ir al mes anterior y al siguiente: nunca antes del primer mes
 * con datos ni al mes en curso, que está a medias (RF-3). */
export function monthBounds(period, firstPeriod, current) {
  return {
    previous: firstPeriod !== null && period > firstPeriod,
    next: firstPeriod !== null && shiftPeriod(period, 1) < current,
  };
}
