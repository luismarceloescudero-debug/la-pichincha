/* Worker «Afuera» (spec 022): las fuentes internacionales en vivo. El Worker es ESM (worker/package.json) y se carga con
   import(); los fixtures estan armados con los campos de la doc oficial de cada API (no hay credenciales todavia). */
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const fixture = n => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "worker", n), "utf8"));
const cargar = m => import(path.join(__dirname, "..", "..", "worker", "src", m).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));

const AHORA = "2026-10-23T15:00:00.000Z";

/* --- Normalizar lo que devuelve cada API --- */

test("eBay: cada aviso sale con precio, envio, link de afiliado si lo hay e imagen https; sin precio no entra", async () => {
  const { parsearEbay } = await cargar("fuentes/ebay.js");
  const items = parsearEbay(fixture("ebay-search.json"), AHORA);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { fuente: "ebay", nombre: "Anker Soundcore AeroClip 2 Open-Ear Earbuds - Black", precio: 89.99,
    moneda: "USD", envio: 24.5, precioArs: null, url: "https://www.ebay.com/itm/266512345678?mkcid=1&mkrid=711-53200-19255-0&campid=5338000000",
    imagen: "https://i.ebayimg.com/images/g/abc/s-l225.jpg", afiliado: true, fecha: AHORA });
  assert.equal(items[1].afiliado, false);
  assert.equal(items[1].url, "https://www.ebay.com/itm/266500000001");
  assert.equal(items[1].envio, null, "envio calculado: no hay numero");
  assert.equal(items[1].imagen, "https://i.ebayimg.com/images/g/def/s-l225.jpg", "http pasa a https");
  assert.deepEqual(parsearEbay({}, AHORA), []);
  assert.deepEqual(parsearEbay(null, AHORA), []);
});

test("AliExpress: lee la respuesta envuelta de /sync y la simple de la doc; el link de afiliado manda", async () => {
  const { parsearAliexpress } = await cargar("fuentes/aliexpress.js");
  const items = parsearAliexpress(fixture("aliexpress-query.json"), AHORA);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { fuente: "aliexpress", nombre: "Auriculares de clip abiertos Bluetooth 5.4", precio: 23.47, moneda: "USD",
    envio: null, precioArs: null, url: "https://s.click.aliexpress.com/e/_abc123", imagen: "https://ae01.alicdn.com/kf/S1234.jpg",
    afiliado: true, fecha: AHORA });
  assert.equal(items[1].precio, 12);
  assert.equal(items[1].afiliado, false);
  assert.equal(items[1].url, "https://www.aliexpress.com/item/1005009999999999.html");
  const simple = { code: "0", resp_result: { resp_code: 200, result: { products: [{ product_title: "x", target_sale_price: "5",
    target_sale_price_currency: "USD", product_detail_url: "https://www.aliexpress.com/item/1.html" }] } } };
  assert.equal(parsearAliexpress(simple, AHORA).length, 1);
  assert.deepEqual(parsearAliexpress({ error_response: { code: "IncompleteSignature" } }, AHORA), []);
});

test("Amazon (Creators API): titulo, precio de la primera oferta y detailPageURL con el tag; sin oferta no entra", async () => {
  const { parsearAmazon } = await cargar("fuentes/amazon.js");
  const items = parsearAmazon(fixture("amazon-search.json"), AHORA);
  assert.deepEqual(items, [{ fuente: "amazon", nombre: "Soundcore AeroClip Open-Ear Earbuds", precio: 79.99, moneda: "USD", envio: null,
    precioArs: null, url: "https://www.amazon.com/dp/B0DLGCHL8M?tag=lapichincha-20&linkCode=ogi",
    imagen: "https://m.media-amazon.com/images/I/41abc._SL160_.jpg", afiliado: true, fecha: AHORA }]);
  assert.deepEqual(parsearAmazon(undefined, AHORA), []);
});

test("un aviso con url que no es https o con precio raro no entra", async () => {
  const { aviso } = await cargar("fuentes/comun.js");
  const base = { fuente: "ebay", nombre: "x", precio: "10", moneda: "USD", url: "https://a.com/1", afiliado: false, fecha: AHORA };
  assert.ok(aviso(base));
  assert.equal(aviso({ ...base, url: "javascript:alert(1)" }), null);
  assert.equal(aviso({ ...base, url: "ftp://a.com" }), null);
  assert.equal(aviso({ ...base, precio: "0" }), null);
  assert.equal(aviso({ ...base, precio: "abc" }), null);
  assert.equal(aviso({ ...base, nombre: "  " }), null);
  assert.equal(aviso({ ...base, moneda: "dolares" }), null);
  assert.equal(aviso({ ...base, imagen: "data:image/png;base64,xx" }).imagen, null);
  assert.equal(aviso({ ...base, nombre: "a".repeat(300) }).nombre.length, 160);
});

/* --- Pedidos a cada API --- */

test("eBay: busca con envio a Argentina, el contexto de ubicacion AR y la campaña de afiliado si esta", async () => {
  const { pedidoEbay } = await cargar("fuentes/ebay.js");
  const p = pedidoEbay("soundcore aeroclip 2", { EBAY_CAMPAIGN_ID: "5338000000" }, "TOKEN");
  const u = new URL(p.url);
  assert.equal(u.origin + u.pathname, "https://api.ebay.com/buy/browse/v1/item_summary/search");
  assert.equal(u.searchParams.get("q"), "soundcore aeroclip 2");
  assert.equal(u.searchParams.get("filter"), "deliveryCountry:AR");
  assert.equal(u.searchParams.get("limit"), "5");
  assert.equal(p.headers.Authorization, "Bearer TOKEN");
  assert.equal(p.headers["X-EBAY-C-MARKETPLACE-ID"], "EBAY_US");
  assert.equal(p.headers["X-EBAY-C-ENDUSERCTX"], "affiliateCampaignId=5338000000,contextualLocation=country%3DAR");
  assert.equal(pedidoEbay("x", {}, "T").headers["X-EBAY-C-ENDUSERCTX"], "contextualLocation=country%3DAR");
});

test("eBay: el token de aplicacion se pide con client credentials y el scope publico", async () => {
  const { pedidoTokenEbay } = await cargar("fuentes/ebay.js");
  const p = pedidoTokenEbay({ EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "secreto" });
  assert.equal(p.url, "https://api.ebay.com/identity/v1/oauth2/token");
  assert.equal(p.headers.Authorization, "Basic " + Buffer.from("id:secreto").toString("base64"));
  assert.equal(p.body, "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope");
});

test("AliExpress: la firma es HMAC-SHA256 de los parametros ordenados clave+valor, en hexa mayuscula (doc oficial)", async () => {
  const { firmar } = await cargar("fuentes/aliexpress.js");
  const params = { foo: "1", bar: "2", foo_bar: "3", foobar: "4" };
  const esperado = crypto.createHmac("sha256", "helloworld").update("bar2foo1foo_bar3foobar4").digest("hex").toUpperCase();
  assert.equal(await firmar(params, "helloworld"), esperado);
  assert.equal(await firmar({ b: "", a: "x" }, "s"), crypto.createHmac("sha256", "s").update("ax").digest("hex").toUpperCase(),
    "los vacios no entran, como en el ejemplo de la doc");
});

test("AliExpress: el pedido va a /sync con el metodo, envio a AR, dolares, español, tracking y la firma", async () => {
  const { pedidoAliexpress, firmar } = await cargar("fuentes/aliexpress.js");
  const env = { ALIEXPRESS_APP_KEY: "123", ALIEXPRESS_APP_SECRET: "sec", ALIEXPRESS_TRACKING_ID: "pichincha" };
  const p = await pedidoAliexpress("auriculares clip", env, 1792767000000);
  const u = new URL(p.url);
  assert.equal(u.origin + u.pathname, "https://api-sg.aliexpress.com/sync");
  const q = Object.fromEntries(u.searchParams);
  assert.equal(q.method, "aliexpress.affiliate.product.query");
  assert.equal(q.app_key, "123");
  assert.equal(q.sign_method, "sha256");
  assert.equal(q.timestamp, "1792767000000");
  assert.equal(q.keywords, "auriculares clip");
  assert.equal(q.ship_to_country, "AR");
  assert.equal(q.target_currency, "USD");
  assert.equal(q.target_language, "ES");
  assert.equal(q.tracking_id, "pichincha");
  assert.equal(q.page_size, "5");
  const { sign, ...resto } = q;
  assert.equal(sign, await firmar(resto, "sec"));
});

test("Amazon: el token y la busqueda siguen la doc de la Creators API", async () => {
  const { pedidoTokenAmazon, pedidoAmazon } = await cargar("fuentes/amazon.js");
  const t = pedidoTokenAmazon({ AMAZON_CREATORS_ID: "id", AMAZON_CREATORS_SECRET: "sec" });
  assert.equal(t.url, "https://api.amazon.com/auth/o2/token");
  assert.deepEqual(JSON.parse(t.body), { grant_type: "client_credentials", client_id: "id", client_secret: "sec", scope: "creatorsapi::default" });
  const p = pedidoAmazon("soundcore aeroclip", {}, "TOK");
  assert.equal(p.url, "https://creatorsapi.amazon/catalog/v1/searchItems");
  assert.equal(p.headers.Authorization, "Bearer TOK");
  assert.equal(p.headers["x-marketplace"], "www.amazon.com");
  const body = JSON.parse(p.body);
  assert.equal(body.partnerTag, "lapichincha-20");
  assert.equal(body.keywords, "soundcore aeroclip");
  assert.equal(body.itemCount, 5);
});

/* --- El Worker: validacion, CORS, cache, tope y fuentes --- */

function cacheFalsa() {
  const m = new Map();
  return { m, match: async k => (m.has(k) ? m.get(k).clone() : undefined), put: async (k, r) => { m.set(k, r.clone()); } };
}
const pedido = (q, { origin = "https://pichinchadeldia.com.ar", ip = "1.2.3.4", metodo = "GET", ruta = "/buscar" } = {}) =>
  new Request(`https://afuera.example.workers.dev${ruta}${q === null ? "" : "?q=" + encodeURIComponent(q)}`,
    { method: metodo, headers: { Origin: origin, "CF-Connecting-IP": ip } });

function fetchFalso(respuestas, llamadas = []) {
  return async (url, init = {}) => {
    const u = String(url);
    llamadas.push({ url: u, init });
    for (const [patron, r] of respuestas) if (u.includes(patron)) return typeof r === "function" ? r(u, init) : new Response(JSON.stringify(r), { status: 200 });
    return new Response("no", { status: 404 });
  };
}

const ENV_EBAY = { EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "sec" };

test("sin fuentes configuradas responde vacio y lo dice, sin guardar en cache", async () => {
  const { crearAtender } = await cargar("index.js");
  const cache = cacheFalsa();
  const atender = crearAtender({ fetch: fetchFalso([]), cache, ahora: () => AHORA });
  const r = await atender(pedido("soundcore aeroclip 2"), {});
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual(j.items, []);
  assert.deepEqual(j.fuentes, []);
  assert.equal(j.consulta, "soundcore aeroclip 2");
  assert.equal(cache.m.size, 0);
});

test("con eBay configurado busca, normaliza, ordena por precio y guarda en cache 8 horas", async () => {
  const { crearAtender } = await cargar("index.js");
  const cache = cacheFalsa(), llamadas = [];
  const f = fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", fixture("ebay-search.json")]], llamadas);
  const atender = crearAtender({ fetch: f, cache, ahora: () => AHORA });
  const r = await atender(pedido("Soundcore  AeroClip 2"), ENV_EBAY);
  const j = await r.json();
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://pichinchadeldia.com.ar");
  assert.equal(r.headers.get("Content-Type"), "application/json; charset=utf-8");
  assert.deepEqual(j.fuentes, [{ id: "ebay", ok: true, n: 2 }]);
  assert.deepEqual(j.items.map(i => i.precio), [61, 89.99], "de menor a mayor precio, nunca por comision");
  assert.equal(cache.m.size, 1);
  const guardado = [...cache.m.values()][0];
  assert.match(guardado.headers.get("Cache-Control"), /max-age=28800/);
  // La segunda vez sale de la cache, sin llamar a eBay (aunque cambien mayusculas y espacios)
  const antes = llamadas.length;
  const r2 = await atender(pedido("soundcore aeroclip 2"), ENV_EBAY);
  assert.equal((await r2.json()).items.length, 2);
  assert.equal(llamadas.length, antes);
  assert.equal(r2.headers.get("Access-Control-Allow-Origin"), "https://pichinchadeldia.com.ar");
  // Las llamadas se identifican con el user-agent del sitio
  assert.equal(llamadas.find(l => l.url.includes("item_summary")).init.headers["User-Agent"], "LaPichincha-verificador/1.0 (+https://pichinchadeldia.com.ar)");
});

test("una fuente caida o lenta no tumba a las demas, se marca y no se guarda en cache si ninguna respondio", async () => {
  const { crearAtender } = await cargar("index.js");
  const cache = cacheFalsa();
  const env = { ...ENV_EBAY, ALIEXPRESS_APP_KEY: "k", ALIEXPRESS_APP_SECRET: "s", ALIEXPRESS_TRACKING_ID: "t" };
  const lento = () => new Promise(() => {});                 // nunca contesta: lo corta el tiempo maximo
  const f = fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", lento],
    ["api-sg.aliexpress.com", () => new Response("error", { status: 500 })]]);
  const atender = crearAtender({ fetch: f, cache, ahora: () => AHORA, tiempoMaximo: 30 });
  const j = await (await atender(pedido("auriculares clip"), env)).json();
  assert.deepEqual(j.items, []);
  assert.deepEqual(j.fuentes.map(x => [x.id, x.ok]), [["ebay", false], ["aliexpress", false]]);
  assert.equal(cache.m.size, 0);
});

test("AliExpress y eBay juntos: se mezclan por precio", async () => {
  const { crearAtender } = await cargar("index.js");
  const env = { ...ENV_EBAY, ALIEXPRESS_APP_KEY: "k", ALIEXPRESS_APP_SECRET: "s", ALIEXPRESS_TRACKING_ID: "t" };
  const f = fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", fixture("ebay-search.json")],
    ["api-sg.aliexpress.com", fixture("aliexpress-query.json")]]);
  const atender = crearAtender({ fetch: f, cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedido("auriculares clip"), env)).json();
  assert.deepEqual(j.items.map(i => i.fuente), ["aliexpress", "aliexpress", "ebay", "ebay"]);
});

test("Amazon solo se consulta con sus dos secretos", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const f = fetchFalso([["auth/o2/token", { access_token: "A", expires_in: 3600 }], ["creatorsapi.amazon", fixture("amazon-search.json")]], llamadas);
  const atender = crearAtender({ fetch: f, cache: cacheFalsa(), ahora: () => AHORA });
  assert.deepEqual((await (await atender(pedido("x1 soundcore"), { AMAZON_CREATORS_ID: "id" })).json()).fuentes, []);
  const j = await (await atender(pedido("x2 soundcore"), { AMAZON_CREATORS_ID: "id", AMAZON_CREATORS_SECRET: "s" })).json();
  assert.deepEqual(j.fuentes, [{ id: "amazon", ok: true, n: 1 }]);
  assert.equal(llamadas.filter(l => l.url.includes("auth/o2/token")).length, 1);
});

test("el token de eBay se reusa hasta que vence", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  let reloj = Date.parse(AHORA);
  const f = fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", fixture("ebay-search.json")]], llamadas);
  const atender = crearAtender({ fetch: f, cache: cacheFalsa(), ahora: () => new Date(reloj).toISOString() });
  await atender(pedido("uno dos"), ENV_EBAY);
  await atender(pedido("tres cuatro"), ENV_EBAY);
  assert.equal(llamadas.filter(l => l.url.includes("oauth2/token")).length, 1);
  reloj += 7200 * 1000;
  await atender(pedido("cinco seis"), ENV_EBAY);
  assert.equal(llamadas.filter(l => l.url.includes("oauth2/token")).length, 2);
});

test("la consulta se valida con los criterios de js/buscadas.js: largo, mails, links, telefonos y documentos no pasan", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => AHORA });
  for (const malo of ["", "a", "juan@mail.com", "https://x.com", "11 5555 1234", "dni 30123456", "1234567", "x".repeat(41), null]) {
    const r = await atender(pedido(malo), {});
    assert.equal(r.status, 400, String(malo));
    assert.equal((await r.json()).error, "consulta no valida");
  }
});

test("CORS: solo el sitio y localhost; otro origen no recibe el permiso; OPTIONS responde el preflight", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => AHORA });
  for (const o of ["http://localhost:8765", "http://127.0.0.1:8080", "https://pichinchadeldia.com.ar"]) {
    const r = await atender(pedido("monitor 27", { origin: o }), {});
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), o, o);
    assert.equal(r.headers.get("Vary"), "Origin");
  }
  for (const o of ["https://evil.com", "https://pichinchadeldia.com.ar.evil.com", "http://pichinchadeldia.com.ar"]) {
    const r = await atender(pedido("monitor 27", { origin: o }), {});
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), null, o);
  }
  const pre = await atender(pedido("monitor 27", { metodo: "OPTIONS" }), {});
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
});

test("otra ruta o metodo: 404 y 405", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => AHORA });
  assert.equal((await atender(pedido("monitor", { ruta: "/otra" }), {})).status, 404);
  assert.equal((await atender(pedido("monitor", { metodo: "POST" }), {})).status, 405);
});

test("tope por IP: 30 busquedas por minuto; la 31 da 429 y otra IP sigue", async () => {
  const { crearAtender } = await cargar("index.js");
  let reloj = Date.parse(AHORA);
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => new Date(reloj).toISOString() });
  for (let i = 0; i < 30; i++) assert.equal((await atender(pedido("monitor " + i), {})).status, 200);
  const r = await atender(pedido("monitor 99"), {});
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "60");
  assert.equal((await atender(pedido("monitor 99", { ip: "5.6.7.8" }), {})).status, 200);
  reloj += 61 * 1000;
  assert.equal((await atender(pedido("monitor 99"), {})).status, 200, "pasado el minuto vuelve a andar");
});

test("el export por defecto atiende con la cache y el fetch del entorno de Workers", async () => {
  const mod = await cargar("index.js");
  const cache = cacheFalsa();
  globalThis.caches = { default: cache };
  try {
    const r = await mod.default.fetch(pedido("monitor 24"), {}, {});
    assert.equal(r.status, 200);
  } finally { delete globalThis.caches; }
});
