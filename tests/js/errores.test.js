// spec 061: errores del navegador a Sentry, apagados sin DSN, con muestreo bajo y sin datos personales.
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../js/errores.js");

const DSN = "https://0123456789abcdef0123456789abcdef@o12345.ingest.us.sentry.io/678";

test("destino arma la direccion del envelope y rechaza lo que no es un DSN", () => {
  assert.deepEqual(E.destino(DSN), {
    url: "https://o12345.ingest.us.sentry.io/api/678/envelope/?sentry_key=0123456789abcdef0123456789abcdef&sentry_version=7",
    dsn: DSN,
  });
  for (const malo of ["", null, undefined, "http://abcdefabcdefabcd@x.io/1", "https://x.io/1", "https://zz@x.io/1"]) {
    assert.equal(E.destino(malo), null, String(malo));
  }
});

test("limpiar saca mails, numeros largos y la consulta de las direcciones", () => {
  assert.equal(E.limpiar("fallo para juan.perez@mail.com"), "fallo para [mail]");
  assert.equal(E.limpiar("tel 11 5555-1234 y dni 30123456"), "tel [numero] y dni [numero]");
  assert.equal(E.limpiar("rtx 4060 de 8gb"), "rtx 4060 de 8gb");
  assert.equal(E.limpiar("en https://pichinchadeldia.com.ar/?q=mi%20busqueda#buscar linea"),
    "en https://pichinchadeldia.com.ar/ linea");
  assert.equal(E.limpiar(null), "");
  assert.equal(E.limpiar("x".repeat(500)).length, 300);
});

test("direccion es solo origen y ruta", () => {
  assert.equal(E.direccion({ origin: "https://p.ar", pathname: "/precios/rtx/", search: "?q=x", hash: "#a" }), "https://p.ar/precios/rtx/");
  assert.equal(E.direccion(null), "");
});

test("cuadros lee la pila de Chrome y de Firefox, de la mas vieja a la mas nueva", () => {
  const pila = "TypeError: x\n    at mostrar (https://p.ar/js/app.js:10:5)\n    at https://p.ar/js/arranque.js:3:1\nleer@https://p.ar/js/busqueda.js:7:2";
  const c = E.cuadros(pila);
  assert.equal(c.length, 3);
  assert.deepEqual(c[2], { function: "mostrar", filename: "https://p.ar/js/app.js", lineno: 10, colno: 5 });
  assert.deepEqual(c[0], { function: "leer", filename: "https://p.ar/js/busqueda.js", lineno: 7, colno: 2 });
  assert.deepEqual(c[1], { function: "?", filename: "https://p.ar/js/arranque.js", lineno: 3, colno: 1 });
  assert.deepEqual(E.cuadros(""), []);
});

test("evento y sobre tienen la forma que pide Sentry, sin usuario ni IP", () => {
  const ev = E.evento("TypeError", "a is undefined", "at f (https://p.ar/js/a.js:1:2)", { url: "https://p.ar/", version: "v1", id: "ab", ahora: 1000 });
  assert.equal(ev.exception.values[0].type, "TypeError");
  assert.equal(ev.exception.values[0].stacktrace.frames.length, 1);
  assert.equal(ev.release, "la-pichincha@v1");
  assert.deepEqual(ev.user, { ip_address: null });
  assert.equal(ev.timestamp, 1);
  const lineas = E.sobre(ev, DSN).split("\n");
  assert.equal(lineas.length, 3);
  assert.deepEqual(JSON.parse(lineas[0]), { event_id: "ab", dsn: DSN, sent_at: "1970-01-01T00:00:01.000Z" });
  assert.deepEqual(JSON.parse(lineas[1]), { type: "event" });
  const sinPila = E.evento(undefined, "x");
  assert.equal(sinPila.exception.values[0].type, "Error");
  assert.equal(sinPila.release, undefined);
  assert.equal(sinPila.exception.values[0].stacktrace, undefined);
});

test("nuevoId son 32 hexadecimales", () => {
  assert.match(E.nuevoId(), /^[0-9a-f]{32}$/);
});

test("captador: apagado sin DSN, muestreo, sin repetir y con tope por visita", () => {
  assert.equal(E.captador({ dsn: "", enviar: () => {} }), null);
  const enviados = [];
  const siempre = E.captador({ dsn: DSN, rnd: () => 0, enviar: (u, c) => enviados.push([u, c]), loc: { origin: "https://p.ar", pathname: "/" } });
  assert.equal(siempre("Error", "uno"), true);
  assert.equal(siempre("Error", "uno"), false, "el mismo error no se repite");
  siempre("Error", "dos"); siempre("Error", "tres");
  assert.equal(siempre("Error", "cuatro"), false, "tope por visita");
  assert.equal(enviados.length, E.MAX_POR_VISITA);
  assert.match(enviados[0][0], /envelope/);
  const nunca = E.captador({ dsn: DSN, rnd: () => 0.99, enviar: () => assert.fail("no tenia que salir") });
  assert.equal(nunca("Error", "x"), false);
  const roto = E.captador({ dsn: DSN, rnd: () => 0, enviar: () => { throw new Error("sin red"); } });
  assert.equal(roto("Error", "x"), true, "un envio que falla no rompe la pagina");
  assert.ok(E.MUESTREO <= 0.2, "muestreo bajo");
});

function ventana(dsn, nav = {}) {
  const oyentes = {};
  return {
    oyentes,
    document: { querySelector: s => (s.includes("errores-dsn") ? (dsn === null ? null : { content: dsn }) : null) },
    location: { origin: "https://p.ar", pathname: "/" },
    navigator: nav,
    addEventListener: (t, f) => { oyentes[t] = f; },
  };
}

test("enganchar: sin DSN no escucha nada", () => {
  for (const dsn of ["", null]) {
    const w = ventana(dsn);
    assert.equal(E.enganchar(w), false);
    assert.deepEqual(Object.keys(w.oyentes), []);
  }
});

test("enganchar: con DSN escucha errores y promesas y manda por sendBeacon o fetch", () => {
  const original = Math.random;
  Math.random = () => 0;
  try {
    const mandados = [];
    const w = ventana(DSN, { sendBeacon: (u, c) => mandados.push(c) });
    assert.equal(E.enganchar(w), true);
    w.oyentes.error({ message: "", error: null });   // un recurso que no cargo: nada
    w.oyentes.error({ message: "x is not defined", error: { name: "ReferenceError", stack: "" } });
    w.oyentes.unhandledrejection({ reason: "texto suelto" });
    w.oyentes.unhandledrejection({ reason: { name: "TypeError", message: "m" } });
    assert.equal(mandados.length, 3);
    assert.match(mandados[0], /ReferenceError/);
    assert.match(mandados[1], /UnhandledRejection/);

    let pedido = null;
    const w2 = ventana(DSN, {});
    w2.fetch = (u, o) => { pedido = o; return Promise.resolve(); };
    E.enganchar(w2);
    w2.oyentes.error({ message: "y", error: null });
    assert.equal(pedido.credentials, "omit");
    const w3 = ventana(DSN, {});
    E.enganchar(w3);
    w3.oyentes.error({ message: "sin fetch ni beacon" });   // no explota
  } finally {
    Math.random = original;
  }
});
