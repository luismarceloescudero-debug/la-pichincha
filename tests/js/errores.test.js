/* js/errores.js (spec 062): Sentry solo en el dominio publicado, sin datos de la persona y sin romper nada. */
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../js/errores.js");

const PUBLICADO = { protocol: "https:", hostname: "pichinchadeldia.com.ar", origin: "https://pichinchadeldia.com.ar", hash: "" };

/* Un navegador de mentira: lo justo para ver que agrega el script y escucha errores. */
function navegador({ dsn, ubicacion = PUBLICADO, estado = "loading" }) {
  const agregados = [];
  const escuchas = {};
  const doc = {
    readyState: estado,
    querySelector: sel => (sel === 'meta[name="sentry-dsn"]' && dsn !== undefined ? { content: dsn } : null),
    createElement: () => ({}),
    head: { appendChild: s => agregados.push(s) },
  };
  const r = {
    document: doc, location: ubicacion,
    addEventListener: (tipo, fn) => { (escuchas[tipo] = escuchas[tipo] || []).push(fn); },
    removeEventListener: (tipo, fn) => { escuchas[tipo] = (escuchas[tipo] || []).filter(f => f !== fn); },
  };
  return { r, agregados, escuchas };
}

test("solo se prende en el dominio publicado y por https", () => {
  assert.equal(E.activo(PUBLICADO), true);
  assert.equal(E.activo({ protocol: "https:", hostname: "www.pichinchadeldia.com.ar" }), true);
  assert.equal(E.activo({ protocol: "http:", hostname: "localhost" }), false);
  assert.equal(E.activo({ protocol: "http:", hostname: "127.0.0.1" }), false);
  assert.equal(E.activo({ protocol: "https:", hostname: "luismarceloescudero-debug.github.io" }), false);
  assert.equal(E.activo(undefined), false);
});

test("sin DSN o fuera del dominio no agrega nada ni escucha errores", () => {
  for (const caso of [{ dsn: "" }, { dsn: undefined }, { dsn: "https://k@o1.ingest.us.sentry.io/2", ubicacion: { protocol: "http:", hostname: "localhost" } }]) {
    const n = navegador(caso);
    assert.equal(E.arrancar(n.r), false);
    assert.deepEqual(n.agregados, []);
    assert.deepEqual(n.escuchas, {});
  }
});

test("con DSN espera a que cargue la pagina y baja el programa con su huella", () => {
  const n = navegador({ dsn: "https://k@o1.ingest.us.sentry.io/2" });
  assert.equal(E.arrancar(n.r), true);
  assert.deepEqual(n.agregados, [], "nada antes del load");
  assert.equal(n.escuchas.error.length, 1);
  assert.equal(n.escuchas.unhandledrejection.length, 1);
  assert.equal(n.escuchas.load.length, 1);
});

test("el programa de Sentry es una version fija del CDN con integridad", () => {
  assert.match(E.SDK, /^https:\/\/browser\.sentry-cdn\.com\/\d+\.\d+\.\d+\/bundle\.min\.js$/);
  assert.match(E.INTEGRIDAD, /^sha384-[A-Za-z0-9+/]{64}$/);
});

test("las opciones no mandan datos personales", () => {
  const o = E.opciones("https://k@o1.ingest.us.sentry.io/2", PUBLICADO);
  assert.equal(o.sendDefaultPii, false);
  assert.deepEqual(o.allowUrls, ["https://pichinchadeldia.com.ar"]);
  assert.ok(o.denyUrls[0].test("chrome-extension://abc/x.js"));
  assert.equal(o.replaysSessionSampleRate, undefined);
  assert.equal(o.tracesSampleRate, undefined);
});

test("limpiar borra la busqueda, la persona y las cookies", () => {
  const ev = E.limpiar({
    user: { ip_address: "1.2.3.4" },
    request: { url: "https://pichinchadeldia.com.ar/?q=juan%40mail.com#buscar", query_string: "q=juan", cookies: "a=b", headers: { Referer: "https://x/?q=1", "User-Agent": "UA" } },
    breadcrumbs: [
      { category: "navigation", data: { from: "/?q=rtx", to: "/hoy/?utm=1" } },
      { category: "fetch", data: { url: "https://dolarapi.com/v1?x=1" } },
      { category: "console", message: "algo con datos" },
    ],
  });
  assert.equal(ev.user, undefined);
  assert.equal(ev.request.url, "https://pichinchadeldia.com.ar/");
  assert.equal(ev.request.query_string, undefined);
  assert.equal(ev.request.cookies, undefined);
  assert.deepEqual(ev.request.headers, { "User-Agent": "UA" });
  assert.deepEqual(ev.breadcrumbs.map(b => b.data), [{ from: "/", to: "/hoy/" }, { url: "https://dolarapi.com/v1" }]);
});

test("sinConsulta deja pasar lo que no es texto", () => {
  assert.equal(E.sinConsulta(undefined), undefined);
  assert.equal(E.sinConsulta("/precios/rtx-5060/"), "/precios/rtx-5060/");
});

test("los errores de scripts ajenos (sin archivo del sitio) no se mandan", () => {
  // Sentry LA-PICHINCHA-3 (09/11): el autocompletar de un navegador de Android inyecta codigo anonimo.
  const ajeno = { exception: { values: [{ type: "ReferenceError", value: "xbrowser is not defined",
    stacktrace: { frames: [{ filename: "<anonymous>", function: "execute_auto_fill" }] } }] } };
  assert.equal(E.ajeno(ajeno), true);
  assert.equal(E.antesDeMandar(ajeno), null);
  // Uno del sitio sigue llegando (y limpio).
  const propio = { request: { url: "https://pichinchadeldia.com.ar/?q=x" }, exception: { values: [{ type: "TypeError", value: "x",
    stacktrace: { frames: [{ filename: "<anonymous>" }, { filename: "https://pichinchadeldia.com.ar/js/busqueda.js" }] } }] } };
  assert.equal(E.ajeno(propio), false);
  assert.equal(E.antesDeMandar(propio).request.url, "https://pichinchadeldia.com.ar/");
  // Sin pila (un mensaje suelto, la prueba de #probar-errores) no se descarta.
  assert.equal(E.ajeno({ message: "Prueba de errores de La Pichincha" }), false);
  assert.equal(E.opciones("https://k@o1.ingest.us.sentry.io/2", PUBLICADO).beforeSend, E.antesDeMandar);
});
