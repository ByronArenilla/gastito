// Entrar, crear cuenta y cerrar sesión, sin navegador (spec 011, RF-1 a RF-4).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../public/js/api.js";
import {
  confirmAccount,
  confirmEmail,
  logIn,
  logOut,
  requestPasswordReset,
  requestVerification,
  resetPassword,
  saveName,
  signUp,
} from "../public/js/account.js";

function fakeSession() {
  const state = { saved: null, cleared: false, next: null };
  return {
    state,
    save: (value) => (state.saved = value),
    clear: () => (state.cleared = true),
    takeNext: () => {
      const next = state.next;
      state.next = null;
      return next;
    },
  };
}

function fakeApi(handlers) {
  const calls = [];
  return {
    calls,
    post: async (path, body) => {
      calls.push([path, body]);
      return handlers[path](body);
    },
  };
}

const TOKEN = { access_token: "abc", token_type: "bearer" };

test("entrar guarda el token y el correo y va a Registrar", async () => {
  const session = fakeSession();
  const api = fakeApi({ "/auth/login": () => TOKEN });

  const destination = await logIn({ api, session }, { email: " Ana@Example.com ", password: "x" });

  assert.equal(destination, "/registrar");
  assert.deepEqual(session.state.saved, { token: "abc", email: "ana@example.com" });
});

test("entrar vuelve a la pantalla a la que se iba", async () => {
  const session = fakeSession();
  session.state.next = "/unirse/abc";
  const api = fakeApi({ "/auth/login": () => TOKEN });

  const destination = await logIn({ api, session }, { email: "ana@example.com", password: "x" });

  assert.equal(destination, "/unirse/abc");
});

test("sin ruta pendiente, entrar va a la pantalla de inicio del dispositivo (spec 012)", async () => {
  const session = fakeSession();
  const api = fakeApi({ "/auth/login": () => TOKEN });

  const destination = await logIn(
    { api, session, home: () => "/mes" },
    { email: "ana@example.com", password: "x" },
  );

  assert.equal(destination, "/mes");
});

test("crear cuenta pide el enlace y todavía no entra (spec 032)", async () => {
  const session = fakeSession();
  const api = fakeApi({
    "/auth/register": () => ({ email: "ana@example.com", detail: "Te enviamos un enlace." }),
  });

  const result = await signUp(
    { api, session },
    { name: "Ana", email: "Ana@Example.com", password: "una-contraseña-larga" },
  );

  assert.deepEqual(result, { pending: true, email: "ana@example.com", detail: "Te enviamos un enlace." });
  assert.deepEqual(
    api.calls.map(([path]) => path),
    ["/auth/register"],
  );
  assert.equal(session.state.saved, null);
  // El nombre viaja con la solicitud (spec 031, RF-8).
  assert.equal(api.calls[0][1].name, "Ana");
});

test("con una API anterior, que crea la cuenta enseguida, entra como antes", async () => {
  // Durante un despliegue la web nueva puede hablar unos minutos con la API
  // vieja (spec 032, RF-21).
  const session = fakeSession();
  const api = fakeApi({ "/auth/register": () => ({ id: 1 }), "/auth/login": () => TOKEN });

  const result = await signUp(
    { api, session },
    { name: "Ana", email: "ana@example.com", password: "una-contraseña-larga" },
  );

  assert.deepEqual(result, { pending: false, destination: "/registrar" });
  assert.deepEqual(
    api.calls.map(([path]) => path),
    ["/auth/register", "/auth/login"],
  );
  assert.equal(session.state.saved.token, "abc");
});

test("los enlaces del correo llaman a su ruta con el token", async () => {
  const api = fakeApi({
    "/auth/register/confirm": () => ({ email: "ana@example.com" }),
    "/auth/email-verification/confirm": () => ({ email: "ana@example.com" }),
    "/auth/password-reset/confirm": () => ({ detail: "Contraseña cambiada." }),
    "/auth/password-reset": () => ({ detail: "Si hay una cuenta…" }),
    "/me/email-verification": () => ({ detail: "Te enviamos un enlace." }),
  });

  await confirmAccount({ api }, "t1");
  await confirmEmail({ api }, "t2");
  await resetPassword({ api }, { token: "t3", password: "una-contraseña-nueva" });
  await requestPasswordReset({ api }, "  ana@example.com ");
  await requestVerification({ api });

  assert.deepEqual(api.calls, [
    ["/auth/register/confirm", { token: "t1" }],
    ["/auth/email-verification/confirm", { token: "t2" }],
    ["/auth/password-reset/confirm", { token: "t3", password: "una-contraseña-nueva" }],
    ["/auth/password-reset", { email: "ana@example.com" }],
    ["/me/email-verification", undefined],
  ]);
});

test("guardar el nombre lo envía a /me y devuelve la cuenta", async () => {
  const calls = [];
  const api = {
    patch: async (path, body) => {
      calls.push([path, body]);
      return { id: 1, email: "ana@example.com", name: body.name };
    },
  };

  const me = await saveName({ api }, "Ana");

  assert.deepEqual(calls, [["/me", { name: "Ana" }]]);
  assert.equal(me.name, "Ana");
});

test("cerrar sesión la cierra en la API y borra el dispositivo", async () => {
  const session = fakeSession();
  const api = fakeApi({ "/auth/logout": () => null });

  const notice = await logOut({ api, session });

  assert.equal(notice, null);
  assert.equal(session.state.cleared, true);
});

test("sin conexión, cerrar sesión borra igual y avisa de los 90 días", async () => {
  const session = fakeSession();
  const api = fakeApi({
    "/auth/logout": () => {
      throw new ApiError({ status: 0, message: "Sin conexión.", offline: true });
    },
  });

  const notice = await logOut({ api, session });

  assert.equal(session.state.cleared, true);
  assert.match(notice, /90 días/);
});
