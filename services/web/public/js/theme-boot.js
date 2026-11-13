// Aplica el tema elegido antes de pintar la página, para que no parpadee
// con el del sistema. Es un script clásico y aparte porque la CSP no deja
// scripts en línea, y `main.js` (un módulo) corre después del primer pintado.
// La misma clave que usa theme.js.
(function () {
  try {
    var theme = window.localStorage.getItem("gastito.theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (error) {
    // Sin almacenamiento (modo privado estricto): se queda el tema del sistema.
  }
})();
