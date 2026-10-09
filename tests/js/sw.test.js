const test = require("node:test");
const assert = require("node:assert/strict");
const SW = require("../../sw.js");

const BASE = "https://sitio.test/la-pichincha/";
const pedido = (ruta, extra = {}) => ({ url: new URL(ruta, BASE).href, method: "GET", mode: "cors", ...extra });
const respuesta = (cuerpo, status = 200) => ({ ok: status >= 200 && status < 300, status, cuerpo, clone() { return { ...this }; } });

/* Cache y red de mentira: lo guardado se ve en `guardado`, y `red` decide que pasa con cada pedido. */
function entorno(red, guardado = {}, extra = {}) {
  const tienda = { ...guardado };
  const cache = {
    match: async p => tienda[typeof p === "string" ? p : p.url],
    put: async (p, r) => { tienda[typeof p === "string" ? p : p.url] = r; },
  };
  return { tienda, env: {
    caches: { open: async () => cache, keys: async () => ["pichincha-vieja", "otra-cosa", "pichincha-v1"],
              delete: async n => { (entorno.borradas = entorno.borradas || []).push(n); return true; } },
    fetch: async p => red(p),
    origen: "https://sitio.test", base: BASE, cache: "pichincha-v1", limiteMs: 30, ...extra } };
}
const url = r => new URL(r, BASE).href;

test("con red buena devuelve lo de la red y guarda una copia", async () => {
  const { env, tienda } = entorno(() => respuesta("nuevo"));
  const r = await SW.responder(pedido("indice.json"), env);
  assert.equal(r.cuerpo, "nuevo");
  await new Promise(x => setImmediate(x));
  assert.equal(tienda[url("indice.json")].cuerpo, "nuevo");
});

test("con red buena NUNCA devuelve lo guardado, aunque haya algo", async () => {
  const { env } = entorno(() => respuesta("de hoy"), { [url("indice.json")]: respuesta("de ayer") });
  assert.equal((await SW.responder(pedido("indice.json"), env)).cuerpo, "de hoy");
});

test("si la red falla devuelve lo guardado", async () => {
  const { env } = entorno(() => { throw new TypeError("sin red"); }, { [url("indice.json")]: respuesta("de ayer") });
  assert.equal((await SW.responder(pedido("indice.json"), env)).cuerpo, "de ayer");
});

test("si la red tarda mas del limite devuelve lo guardado, y despues actualiza la copia", async () => {
  let llega;
  const lenta = new Promise(r => { llega = r; });
  const { env, tienda } = entorno(() => lenta, { [url("indice.json")]: respuesta("de ayer") });
  assert.equal((await SW.responder(pedido("indice.json"), env)).cuerpo, "de ayer");
  llega(respuesta("recien llegado"));
  await new Promise(x => setTimeout(x, 10));
  assert.equal(tienda[url("indice.json")].cuerpo, "recien llegado");
});

test("un error del servidor no pisa lo guardado y se usa lo guardado", async () => {
  const { env, tienda } = entorno(() => respuesta("roto", 503), { [url("indice.json")]: respuesta("de ayer") });
  assert.equal((await SW.responder(pedido("indice.json"), env)).cuerpo, "de ayer");
  assert.equal(tienda[url("indice.json")].cuerpo, "de ayer");
});

test("un 404 es un 404: no resucita una pagina que ya no existe", async () => {
  const { env } = entorno(() => respuesta("no esta", 404), { [url("precios/vieja/")]: respuesta("de ayer") });
  assert.equal((await SW.responder(pedido("precios/vieja/"), env)).status, 404);
});

test("sin red y sin copia, una navegacion muestra la pagina de sin conexion", async () => {
  const { env } = entorno(() => { throw new TypeError("sin red"); }, { [url("sin-red.html")]: respuesta("no disponible") });
  const r = await SW.responder(pedido("precios/rtx-4060/", { mode: "navigate" }), env);
  assert.equal(r.cuerpo, "no disponible");
});

test("sin red y sin copia, un pedido que no es una pagina deja el error de red", async () => {
  const { env } = entorno(() => { throw new TypeError("sin red"); }, { [url("sin-red.html")]: respuesta("no disponible") });
  await assert.rejects(SW.responder(pedido("indice.json"), env), TypeError);
});

test("una pagina de /precios/ visitada se guarda y despues se ve sin red", async () => {
  let hayRed = true;
  const { env } = entorno(() => { if (!hayRed) throw new TypeError("sin red"); return respuesta("pagina ssd"); });
  await SW.responder(pedido("precios/ssd-1tb/", { mode: "navigate" }), env);
  await new Promise(x => setImmediate(x));
  hayRed = false;
  assert.equal((await SW.responder(pedido("precios/ssd-1tb/", { mode: "navigate" }), env)).cuerpo, "pagina ssd");
});

test("no toca otros origenes ni pedidos que no son GET", async () => {
  const { env, tienda } = entorno(() => respuesta("x"));
  assert.equal(await SW.responder({ url: "https://tienda.com.ar/p.jpg", method: "GET", mode: "cors" }, env), null);
  assert.equal(await SW.responder(pedido("indice.json", { method: "POST" }), env), null);
  assert.equal(await SW.responder(pedido("manifest.webmanifest", { method: "HEAD" }), env), null);
  assert.deepEqual(Object.keys(tienda), []);
});

test("la cascara trae lo necesario y no pasa de un tamano razonable de archivos", () => {
  for (const f of ["./", "index.html", "css/sitio.css", "js/app.js", "js/analisis.js", "manifest.webmanifest", "sin-red.html", "indice.json"])
    assert.ok(SW.CASCARA.includes(f), f);
  assert.ok(SW.CASCARA.length < 30);
  assert.ok(SW.CASCARA.every(f => !/^https?:/.test(f)), "nada de otros origenes");
});

test("al activar borra toda cache pichincha distinta de la actual y respeta las ajenas", async () => {
  entorno.borradas = [];
  const { env } = entorno(() => respuesta("x"));
  await SW.limpiar(env.caches, "pichincha-v1");
  assert.deepEqual(entorno.borradas, ["pichincha-vieja"]);
});

test("al instalar guarda lo que puede y no se cae si algo falta", async () => {
  const guardadas = [];
  const cache = { put: async (p) => { guardadas.push(p); } };
  const falla = "indice.json";
  const fetchFalso = async p => { if (String(p).endsWith(falla)) throw new TypeError("sin indice"); return respuesta("ok"); };
  const ok = await SW.precargar(cache, fetchFalso, BASE);
  assert.ok(ok > 0 && ok < SW.CASCARA.length, "guardo todo menos lo que fallo");
  assert.ok(!guardadas.some(p => String(p).endsWith(falla)));
});

test("un link con ?q= abre sin red la misma pagina guardada, porque la busqueda se lee en el navegador", async () => {
  const { env } = entorno(() => { throw new TypeError("sin red"); }, { [url("./")]: respuesta("la principal") });
  const r = await SW.responder(pedido("./?q=ssd+1tb", { mode: "navigate" }), env);
  assert.equal(r.cuerpo, "la principal");
});

test("las busquedas distintas no llenan la cache: una navegacion se guarda sin su ?q=", async () => {
  const { env, tienda } = entorno(() => respuesta("la principal"));
  for (const q of ["ssd", "rtx", "ryzen 5", "monitor 27"]) await SW.responder(pedido("./?q=" + q, { mode: "navigate" }), env);
  await new Promise(x => setImmediate(x));
  assert.deepEqual(Object.keys(tienda), [url("./")], "una sola copia de la pagina");
});

test("fuera de las navegaciones la URL completa cuenta: indice.json?v=1 no pisa a indice.json", async () => {
  const { env, tienda } = entorno(p => respuesta(p.url.includes("v=1") ? "otro" : "el indice"));
  await SW.responder(pedido("indice.json"), env);
  await SW.responder(pedido("indice.json?v=1"), env);
  await new Promise(x => setImmediate(x));
  assert.equal(tienda[url("indice.json")].cuerpo, "el indice");
  assert.equal(tienda[url("indice.json?v=1")].cuerpo, "otro");
});

test("si no se puede guardar una respuesta (por ejemplo una parcial 206) no hay rechazos sin atajar y la persona la recibe igual", async () => {
  const rechazos = [];
  const alRechazar = e => rechazos.push(e);
  process.on("unhandledRejection", alRechazar);
  const { env } = entorno(() => respuesta("parcial", 206));
  env.caches.open = async () => ({ match: async () => undefined, put: async () => { throw new TypeError("Partial response (status code 206) is unsupported"); } });
  const r = await SW.responder(pedido("video.mp4"), env);
  await new Promise(x => setTimeout(x, 20));
  process.off("unhandledRejection", alRechazar);
  assert.equal(r.cuerpo, "parcial");
  assert.deepEqual(rechazos, []);
});
