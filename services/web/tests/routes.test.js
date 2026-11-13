// Rutas de la app (spec 011, plan "Pantallas y datos").
import { test } from "node:test";
import assert from "node:assert/strict";
import { homePath, matchRoute } from "../public/js/routes.js";

test("cada ruta encuentra su pantalla y si pide sesión", () => {
  assert.deepEqual(matchRoute("/entrar"), { view: "login", params: {}, access: "guest" });
  assert.deepEqual(matchRoute("/crear-cuenta"), { view: "register", params: {}, access: "guest" });
  assert.deepEqual(matchRoute("/registrar"), { view: "record", params: {}, access: "member" });
  assert.deepEqual(matchRoute("/gastos"), { view: "expenses", params: {}, access: "member" });
  assert.deepEqual(matchRoute("/espacio"), { view: "space", params: {}, access: "member" });
});

test("el logo lleva a /inicio, la guía de secciones", () => {
  assert.deepEqual(matchRoute("/inicio"), { view: "home", params: {}, access: "member" });
  // Abrir la app sigue llevando a Registrar en el celular.
  assert.deepEqual(matchRoute("/"), { redirect: "/registrar" });
});

test("los reportes viven en /mes/reportes (spec 013)", () => {
  assert.deepEqual(matchRoute("/mes/reportes"), { view: "reports", params: {}, access: "member" });
});

test("un retiro de ahorro se abre en /retiros/<id> (spec 013)", () => {
  assert.deepEqual(matchRoute("/retiros/12"), { view: "withdrawal", params: { id: 12 }, access: "member" });
});

test("las rutas con parámetros los extraen", () => {
  assert.deepEqual(matchRoute("/gastos/12"), {
    view: "edit",
    params: { id: 12 },
    access: "member",
  });
  assert.deepEqual(matchRoute("/unirse/abc-_9"), {
    view: "join",
    params: { token: "abc-_9" },
    access: "any",
  });
});

test("la raíz y una ruta desconocida van a la pantalla de inicio", () => {
  assert.deepEqual(matchRoute("/"), { redirect: "/registrar" });
  assert.deepEqual(matchRoute("/no-existe"), { redirect: "/registrar" });
  assert.deepEqual(matchRoute("/gastos/abc"), { redirect: "/registrar" });
  assert.deepEqual(matchRoute("/", { width: 1280 }), { redirect: "/mes" });
  assert.deepEqual(matchRoute("/no-existe", { width: 1280 }), { redirect: "/mes" });
});

test("la pantalla de inicio depende del ancho (spec 012, decisión 3)", () => {
  assert.equal(homePath(1280), "/mes");
  assert.equal(homePath(1024), "/mes");
  assert.equal(homePath(1023), "/registrar");
  assert.equal(homePath(390), "/registrar");
});

test("las rutas de la 012 encuentran su pantalla", () => {
  assert.deepEqual(matchRoute("/mes"), { view: "month", params: {}, access: "member" });
  assert.deepEqual(matchRoute("/mes/planear"), { view: "plan", params: {}, access: "member" });
  assert.deepEqual(matchRoute("/tarjetas"), { view: "cards", params: {}, access: "member" });
  assert.deepEqual(matchRoute("/tarjetas/nueva"), { view: "cardNew", params: {}, access: "member" });
  assert.deepEqual(matchRoute("/tarjetas/3"), { view: "card", params: { id: 3 }, access: "member" });
  assert.deepEqual(matchRoute("/tarjetas/3/editar"), {
    view: "cardEdit",
    params: { id: 3 },
    access: "member",
  });
  assert.deepEqual(matchRoute("/compras/12"), { view: "purchase", params: { id: 12 }, access: "member" });
  assert.deepEqual(matchRoute("/tarjetas/abc"), { redirect: "/registrar" });
});

test("una barra final no cambia la ruta", () => {
  assert.equal(matchRoute("/gastos/").view, "expenses");
});
