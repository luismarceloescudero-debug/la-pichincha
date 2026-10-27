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
  // Hallazgo de la revision de OmniRoute: sin tag en el link no es de afiliado y no se rotula asi
  const sinTag = { searchResult: { items: [{ detailPageURL: "https://www.amazon.com/dp/B0DLGCHL8M", itemInfo: { title: { displayValue: "x" } },
    offersV2: { listings: [{ price: { money: { amount: 10, currency: "USD" } } }] } }] } };
  assert.equal(parsearAmazon(sinTag, AHORA)[0].afiliado, false);
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

/* --- Spec 023: paginas leidas dentro del robots.txt de cada tienda (fixtures reales del 23/10/2026) --- */
const html = n => fs.readFileSync(path.join(__dirname, "..", "fixtures", "worker", n), "utf8");

test("ficha de Tiendamia: nombre completo, precio en dolares con envio (198,88) e imagen", async () => {
  const { parsearFichaTiendamia } = await cargar("fuentes/tiendamia.js");
  const url = "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas";
  const a = parsearFichaTiendamia(html("tiendamia-ficha.html"), url, AHORA);
  assert.equal(a.fuente, "tiendamia");
  assert.match(a.nombre, /^Soundcore Anker AeroClip 2 - Auriculares con clip para llamadas nítidas \| Chip AI ANKER Thus™/);
  assert.equal(a.precio, 198.88);
  assert.equal(a.moneda, "USD");
  assert.equal(a.envio, 0, "el precio de Tiendamia ya trae el envio");
  assert.equal(a.url, url);
  assert.equal(a.imagen, "https://m.media-amazon.com/images/I/61fC4WN2xvL._UX438_UY408_.jpg");
  assert.equal(a.afiliado, false);
  assert.equal(parsearFichaTiendamia("<html>sin datos</html>", url, AHORA), null);
});

test("ficha de Tiendamia: precio base de Amazon y porcentaje del recargo (spec 039)", async () => {
  const { parsearFichaTiendamia } = await cargar("fuentes/tiendamia.js");
  const url = "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas";
  const a = parsearFichaTiendamia(html("tiendamia-ficha.html"), url, AHORA);
  assert.equal(a.precioBase, 169.98, "merchant_price: el precio base de Amazon que publica la ficha");
  assert.equal(a.recargoPct, 17, "(198,88 - 169,98) / 169,98 = 17%");
  // Sin merchant_price (o con merchant_price 0) no hay porcentaje: nunca un porcentaje con un solo numero
  const sinBase = parsearFichaTiendamia('"item_name":"Algo" "final_price":100', url, AHORA);
  assert.equal(sinBase.precioBase, null);
  assert.equal(sinBase.recargoPct, null);
  const baseCero = parsearFichaTiendamia('"item_name":"Algo" "merchant_price":0 "final_price":100', url, AHORA);
  assert.equal(baseCero.precioBase, 0);
  assert.equal(baseCero.recargoPct, null);
});

test("busqueda de Tiendamia: tarjetas con precio en dolares, sin repetir el mismo producto en otro color", async () => {
  const { parsearBusquedaTiendamia } = await cargar("fuentes/tiendamia.js");
  const items = parsearBusquedaTiendamia(html("tiendamia-busqueda.html"), AHORA);
  assert.ok(items.length >= 2 && items.length <= 5, String(items.length));
  assert.match(items[0].nombre, /^Soundcore Anker AeroClip 2 - Auriculares con clip/);
  assert.equal(items[0].precio, 216.24);
  assert.equal(items[0].url, "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas");
  assert.equal(items[0].imagen, "https://m.media-amazon.com/images/I/61fC4WN2xvL._UX438_UY408_.jpg");
  const claves = items.map(i => i.nombre + i.precio);
  assert.equal(new Set(claves).size, claves.length, "las variantes de color iguales no se repiten");
  for (const i of items) {
    assert.equal(i.fuente, "tiendamia");
    assert.equal(i.envio, 0);
    assert.equal(i.moneda, "USD");
    assert.match(i.url, /^https:\/\/tiendamia\.com\.ar\/p\//);
  }
  assert.deepEqual(parsearBusquedaTiendamia("", AHORA), []);
});

test("ficha de Loquieroaca: nombre del h1, precio en un pago como puesto en casa y el de cuotas aparte; el tachado no se usa", async () => {
  const { parsearFichaLoquieroaca } = await cargar("fuentes/loquieroaca.js");
  const url = "https://www.loquieroaca.com/products/1589074";
  const a = parsearFichaLoquieroaca(html("loquieroaca-ficha.html"), url, AHORA);
  assert.equal(a.nombre, "Soundcore Anker AeroClip 2 Open-Ear Clip-On Earbuds for Crystal-Clear Calls");
  assert.equal(a.precio, 538616.1);
  assert.equal(a.moneda, "ARS");
  assert.equal(a.precioArs, 538616.1, "en un pago, como el precio de transferencia del indice");
  assert.equal(a.precioCuotas, 598462.33);
  assert.equal(a.imagen, "https://images-na.ssl-images-amazon.com/images/I/31lfBCzCuLL.jpg");
  assert.equal(a.url, url);
  assert.ok(!JSON.stringify(a).includes("946999"), "el precio tachado no es un precio real");
  assert.equal(parsearFichaLoquieroaca("<h1>x</h1>", url, AHORA), null);
  // «en un pago» tiene que estar escrito: otro «o $» de la pagina no es ese precio
  const sinUnPago = `<h1>Algo</h1><p>Envio gratis a todo $ 5.000</p><p class="font-bold text-3xl">$ 100.000,00</p>`;
  assert.equal(parsearFichaLoquieroaca(sinUnPago, url, AHORA).precio, 100000);
});

test("las entidades HTML fuera del plano basico y los textos vacios no rompen nada", async () => {
  const { decodificar } = await cargar("fuentes/tiendamia.js");
  const { pesosDe } = await cargar("fuentes/loquieroaca.js");
  assert.equal(decodificar("A&#x1F3A7;B&#128266;"), "A🎧B🔊");
  assert.equal(pesosDe(undefined), null);
});

test("los precios argentinos se leen con punto de miles y coma decimal", async () => {
  const { pesosDe } = await cargar("fuentes/loquieroaca.js");
  assert.equal(pesosDe("$ 598.462,33"), 598462.33);
  assert.equal(pesosDe("$ 1.000"), 1000);
  assert.equal(pesosDe("$99.743,72"), 99743.72);
  assert.equal(pesosDe("sin precio"), null);
});

/* --- Pedidos a cada API --- */

test("eBay: busca con envio a Argentina, el contexto de ubicacion AR y la campaña de afiliado si esta", async () => {
  const { pedidoEbay } = await cargar("fuentes/ebay.js");
  const p = pedidoEbay("soundcore aeroclip 2", { EBAY_CAMPAIGN_ID: "5338000000" }, "TOKEN");
  const u = new URL(p.url);
  assert.equal(u.origin + u.pathname, "https://api.ebay.com/buy/browse/v1/item_summary/search");
  assert.equal(u.searchParams.get("q"), "soundcore aeroclip 2");
  assert.equal(u.searchParams.get("filter"), "deliveryCountry:AR,conditions:{NEW}");
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

const SIN_TM = { TIENDAMIA: "apagada" };   // Tiendamia no pide credenciales: los tests de las otras fuentes la apagan
const ENV_EBAY = { ...SIN_TM, EBAY_CLIENT_ID: "id", EBAY_CLIENT_SECRET: "sec" };

test("sin fuentes configuradas responde vacio y lo dice, sin guardar en cache", async () => {
  const { crearAtender } = await cargar("index.js");
  const cache = cacheFalsa();
  const atender = crearAtender({ fetch: fetchFalso([]), cache, ahora: () => AHORA });
  const r = await atender(pedido("soundcore aeroclip 2"), SIN_TM);
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
  assert.deepEqual(j.fuentes, [{ id: "ebay", ok: true, n: 1 }]);
  assert.deepEqual(j.items.map(i => i.precio), [89.99], "el «(usado)» de $61 no compite con lo nuevo (spec 031)");
  assert.equal(cache.m.size, 1);
  const guardado = [...cache.m.values()][0];
  assert.match(guardado.headers.get("Cache-Control"), /max-age=28800/);
  // La segunda vez sale de la cache, sin llamar a eBay (aunque cambien mayusculas y espacios)
  const antes = llamadas.length;
  const r2 = await atender(pedido("soundcore aeroclip 2"), ENV_EBAY);
  assert.equal((await r2.json()).items.length, 1);
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

test("una busqueda con una fuente caida se guarda 15 minutos, no 8 horas; un error no se guarda nunca", async () => {
  const { crearAtender } = await cargar("index.js");
  const cache = cacheFalsa();
  const env = { ...ENV_EBAY, ALIEXPRESS_APP_KEY: "k", ALIEXPRESS_APP_SECRET: "s", ALIEXPRESS_TRACKING_ID: "t" };
  const f = fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", fixture("ebay-search.json")],
    ["api-sg.aliexpress.com", () => new Response("error", { status: 500 })]]);
  const atender = crearAtender({ fetch: f, cache, ahora: () => AHORA });
  const j = await (await atender(pedido("aeroclip 2"), env)).json();
  assert.deepEqual(j.fuentes.map(x => x.ok), [true, false]);
  assert.match([...cache.m.values()][0].headers.get("Cache-Control"), /max-age=900$/);
  const malo = await atender(pedido(""), env);
  assert.equal(malo.status, 400);
  assert.equal(malo.headers.get("Cache-Control"), "no-store");
});

test("AliExpress y eBay juntos: se mezclan por precio", async () => {
  const { crearAtender } = await cargar("index.js");
  const env = { ...ENV_EBAY, ALIEXPRESS_APP_KEY: "k", ALIEXPRESS_APP_SECRET: "s", ALIEXPRESS_TRACKING_ID: "t" };
  const f = fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", fixture("ebay-search.json")],
    ["api-sg.aliexpress.com", fixture("aliexpress-query.json")]]);
  const atender = crearAtender({ fetch: f, cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedido("aeroclip 2"), env)).json();
  assert.deepEqual(j.items.map(i => i.fuente), ["aliexpress", "ebay"], "por precio y solo lo nuevo que nombra «aeroclip 2»");
});

test("Amazon solo se consulta con sus dos secretos", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const f = fetchFalso([["auth/o2/token", { access_token: "A", expires_in: 3600 }], ["creatorsapi.amazon", fixture("amazon-search.json")]], llamadas);
  const atender = crearAtender({ fetch: f, cache: cacheFalsa(), ahora: () => AHORA });
  assert.deepEqual((await (await atender(pedido("soundcore aeroclip"), { ...SIN_TM, AMAZON_CREATORS_ID: "id" })).json()).fuentes, []);
  const j = await (await atender(pedido("aeroclip soundcore"), { ...SIN_TM, AMAZON_CREATORS_ID: "id", AMAZON_CREATORS_SECRET: "s" })).json();
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
    const r = await atender(pedido(malo), SIN_TM);
    assert.equal(r.status, 400, String(malo));
    assert.equal((await r.json()).error, "consulta no valida");
  }
});

test("CORS: solo el sitio y localhost; otro origen no recibe el permiso; OPTIONS responde el preflight", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => AHORA });
  for (const o of ["http://localhost:8765", "http://127.0.0.1:8080", "https://pichinchadeldia.com.ar"]) {
    const r = await atender(pedido("monitor 27", { origin: o }), SIN_TM);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), o, o);
    assert.equal(r.headers.get("Vary"), "Origin");
  }
  for (const o of ["https://evil.com", "https://pichinchadeldia.com.ar.evil.com", "http://pichinchadeldia.com.ar"]) {
    const r = await atender(pedido("monitor 27", { origin: o }), SIN_TM);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), null, o);
  }
  const pre = await atender(pedido("monitor 27", { metodo: "OPTIONS" }), SIN_TM);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
});

test("otra ruta o metodo: 404 y 405", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => AHORA });
  assert.equal((await atender(pedido("monitor", { ruta: "/otra" }), SIN_TM)).status, 404);
  assert.equal((await atender(pedido("monitor", { metodo: "POST" }), SIN_TM)).status, 405);
});

test("tope por IP: 30 busquedas por minuto; la 31 da 429 y otra IP sigue", async () => {
  const { crearAtender } = await cargar("index.js");
  let reloj = Date.parse(AHORA);
  const atender = crearAtender({ fetch: fetchFalso([]), cache: cacheFalsa(), ahora: () => new Date(reloj).toISOString() });
  for (let i = 0; i < 30; i++) assert.equal((await atender(pedido("monitor " + i), SIN_TM)).status, 200);
  const r = await atender(pedido("monitor 99"), SIN_TM);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get("Retry-After"), "60");
  assert.equal((await atender(pedido("monitor 99", { ip: "5.6.7.8" }), SIN_TM)).status, 200);
  reloj += 61 * 1000;
  assert.equal((await atender(pedido("monitor 99"), SIN_TM)).status, 200, "pasado el minuto vuelve a andar");
});

test("el export por defecto atiende con la cache y el fetch del entorno de Workers", async () => {
  const mod = await cargar("index.js");
  const cache = cacheFalsa();
  globalThis.caches = { default: cache };
  try {
    const r = await mod.default.fetch(pedido("monitor 24"), SIN_TM, {});
    assert.equal(r.status, 200);
  } finally { delete globalThis.caches; }
});

/* --- Spec 023: Tiendamia en /buscar y /enlace (una pagina pegada por la persona) --- */
const conHtml = n => () => new Response(html(n), { status: 200, headers: { "Content-Type": "text/html" } });
const pedidoEnlace = (link, extra = {}) => new Request("https://afuera.example.workers.dev/enlace" + (link === null ? "" : "?url=" + encodeURIComponent(link)),
  { headers: { Origin: "https://pichinchadeldia.com.ar", "CF-Connecting-IP": extra.ip || "9.9.9.9" } });

test("Tiendamia busca sin credenciales en tiendamia.com.ar/search/amazon/, con el user-agent del sitio", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const atender = crearAtender({ fetch: fetchFalso([["tiendamia.com.ar/search/amazon/soundcore+aeroclip+2", conHtml("tiendamia-busqueda.html")]], llamadas),
    cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedido("soundcore aeroclip 2"), {})).json();
  assert.deepEqual(j.fuentes.map(f => [f.id, f.ok]), [["tiendamia", true]]);
  assert.equal(j.items[0].fuente, "tiendamia");
  assert.ok(j.items.every(i => i.envio === 0));
  const l = llamadas.find(x => x.url.includes("tiendamia"));
  assert.equal(l.url, "https://tiendamia.com.ar/search/amazon/soundcore+aeroclip+2");
  assert.equal(l.init.headers["User-Agent"], "LaPichincha-verificador/1.0 (+https://pichinchadeldia.com.ar)");
  assert.match(l.init.headers.Accept, /text\/html/);
});

test("/enlace de Tiendamia lee la ficha canonica de tiendamia.com.ar y la guarda en cache", async () => {
  const { crearAtender } = await cargar("index.js");
  const cache = cacheFalsa(), llamadas = [];
  const atender = crearAtender({ fetch: fetchFalso([["tiendamia.com.ar/p/amz/b0hfj7nvpb", conHtml("tiendamia-ficha.html")]], llamadas), cache, ahora: () => AHORA });
  const r = await atender(pedidoEnlace("https://www.tiendamia.com/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas?utm=x"), {});
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://pichinchadeldia.com.ar");
  const j = await r.json();
  assert.equal(j.leido, true);
  assert.equal(j.enlace.tienda, "tiendamia");
  assert.equal(j.item.precio, 198.88);
  assert.equal(j.item.moneda, "USD");
  assert.equal(llamadas[0].url, "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas",
    "siempre la ficha canonica en tiendamia.com.ar (www.tiendamia.com da 403)");
  await atender(pedidoEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas"), {});
  assert.equal(llamadas.length, 1, "la segunda pegada sale de la cache");
});

test("/enlace de Loquieroaca: precio en pesos ya puesto en casa", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([["loquieroaca.com/products/1589074", conHtml("loquieroaca-ficha.html")]]), cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedidoEnlace("loquieroaca.com/products/1589074"), {})).json();
  assert.equal(j.leido, true);
  assert.equal(j.item.precioArs, 538616.1);
  assert.equal(j.item.precioCuotas, 598462.33);
});

test("/enlace de Amazon sin la Creators API no lee nada y lo dice; con ella usa GetItems", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const getItems = { itemsResult: { items: fixture("amazon-search.json").searchResult.items } };
  const atender = crearAtender({ fetch: fetchFalso([["auth/o2/token", { access_token: "A", expires_in: 3600 }], ["catalog/v1/getItems", getItems]], llamadas),
    cache: cacheFalsa(), ahora: () => AHORA });
  const sin = await (await atender(pedidoEnlace("https://www.amazon.com/-/es/X/dp/B0DLGCHL8M"), {})).json();
  assert.equal(sin.leido, false);
  assert.match(sin.motivo, /Amazon/);
  assert.equal(llamadas.length, 0, "nada de leer la pagina de Amazon");
  const con = await (await atender(pedidoEnlace("https://www.amazon.com/dp/B0DLGCHL8M"), { AMAZON_CREATORS_ID: "i", AMAZON_CREATORS_SECRET: "s" })).json();
  assert.equal(con.leido, true);
  assert.equal(con.item.precio, 79.99);
  const body = JSON.parse(llamadas.find(l => l.url.includes("getItems")).init.body);
  assert.deepEqual(body.itemIds, ["B0DLGCHL8M"]);
  assert.equal(body.partnerTag, "lapichincha-20");
});

test("/enlace de eBay usa getItem de la Browse API si hay credenciales", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const item = fixture("ebay-search.json").itemSummaries[0];
  const atender = crearAtender({ fetch: fetchFalso([["oauth2/token", { access_token: "T", expires_in: 7200 }], ["get_item_by_legacy_id", item]], llamadas),
    cache: cacheFalsa(), ahora: () => AHORA });
  assert.equal((await (await atender(pedidoEnlace("https://www.ebay.com/itm/266512345678"), {})).json()).leido, false);
  const j = await (await atender(pedidoEnlace("https://www.ebay.com/itm/266512345678"), ENV_EBAY)).json();
  assert.equal(j.leido, true);
  assert.equal(j.item.precio, 89.99);
  assert.match(llamadas.find(l => l.url.includes("get_item_by_legacy_id")).url, /legacy_item_id=266512345678/);
});

test("/enlace: un link que no es de una tienda conocida da 400 y no se pide nada afuera; una ficha caida da leido=false", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const atender = crearAtender({ fetch: fetchFalso([["tiendamia.com.ar/p/", () => new Response("no", { status: 503 })]], llamadas),
    cache: cacheFalsa(), ahora: () => AHORA });
  for (const malo of ["https://evil.com/p/amz/x", "http://169.254.169.254/latest", "hola", null]) {
    const r = await atender(pedidoEnlace(malo), {});
    assert.equal(r.status, 400, String(malo));
  }
  assert.equal(llamadas.length, 0);
  const caida = await (await atender(pedidoEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"), {})).json();
  assert.equal(caida.leido, false);
  assert.match(caida.motivo, /no respondió|no se pudo/);
});

test("/enlace: una pagina que redirige a otro host no se lee (paginaPermitida vale para el destino, revision del 24/10)", async () => {
  const { crearAtender } = await cargar("index.js");
  const redirigida = () => { const r = new Response(html("tiendamia-ficha.html"), { status: 200 });
    Object.defineProperty(r, "url", { value: "https://otro-sitio.example/p/x" }); return r; };
  const atender = crearAtender({ fetch: fetchFalso([["tiendamia.com.ar/p/", redirigida]]), cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedidoEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"), {})).json();
  assert.equal(j.leido, false);
  assert.equal(j.item, null);
});

test("/enlace: con el 403 del desafio anti-bots de Cloudflare dice que la tienda no deja leer su pagina (24/10)", async () => {
  const { crearAtender } = await cargar("index.js");
  const desafio = () => new Response("<title>Just a moment...</title>", { status: 403 });
  const atender = crearAtender({ fetch: fetchFalso([["tiendamia.com.ar/p/", desafio], ["loquieroaca.com/products/", desafio]]),
    cache: cacheFalsa(), ahora: () => AHORA });
  const tm = await (await atender(pedidoEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"), {})).json();
  assert.equal(tm.leido, false);
  assert.equal(tm.motivo, "Tiendamia no deja leer su página automáticamente: escribí el precio a mano.");
  assert.equal(tm.enlace.nombre, "x", "el nombre del link sigue llegando a la pagina");
  const lq = await (await atender(pedidoEnlace("https://www.loquieroaca.com/products/1589074"), {})).json();
  assert.match(lq.motivo, /^Loquieroacá no deja leer su página automáticamente/);
});

test("relevancia: «compatible con... para» el producto es un accesorio, salvo que se busque con «para» (24/10)", async () => {
  const { relevantes } = await cargar("fuentes/comun.js");
  const n = nombre => ({ nombre, precio: 1 });
  const nombres = items => items.map(i => i.nombre);
  // nombres reales de Tiendamia, 24/10/2026
  const g502 = [n("AKNK Compatible con estación de carga GPW para Logitech G502/Gen 2/Gen 3/Gen 4/G903/Magnetic USB Hub RGB Luz ambiental"),
    n("Mouse de Juego Logitech G502 SE Hero de Alto Rendimiento con RGB de 11 Botones Programables"),
    n("Ratón de Juego Logitech - G502 HERO con Óptica Cableada y Iluminación RGB - Negro-910-005469"),
    n("Logitech - G502 X Ratán USB Cableado con HERO 25K Sensor - Negro-910-006136")];
  assert.deepEqual(nombres(relevantes(g502, "logitech g502")), nombres(g502.slice(1)));
  const para = [n("Mouse inalámbrico para notebook Logitech M170"), n("Funda para notebook 15.6 con bolsillo para mouse")];
  assert.deepEqual(nombres(relevantes(para, "mouse para notebook")), [para[0].nombre]);
});

test("relevancia: lo reacondicionado («Renewed», «renovada») no compite con lo nuevo salvo que se pida (24/10)", async () => {
  const { relevantes } = await cargar("fuentes/comun.js");
  const n = nombre => ({ nombre, precio: 1 });
  const reales = [n("GIGABYTE Tarjeta gráfica GeForce RTX 4070 WINDFORCE OC 12G, 3 ventiladores WINDFORCE, 12 GB 192 bits GDDR6X, tarjeta de video GV-N4070WF3OC-12GD (renovada)"),
    n("GIGABYTE Tarjeta gráfica GeForce RTX 4070 WINDFORCE OC 12G, 3X ventiladores WINDFORCE, 12GB 192-bit GDDR6X, tarjeta de video GV-N4070WF3OC-12GD"),
    n("Samsung 32\" Odyssey G5 QHD (2560 x 1440), 1000R, 165Hz Curved Gaming Monitor, LS32CG554ENXZA, (Renewed)")];
  assert.deepEqual(relevantes(reales, "rtx 4070").map(i => i.nombre), [reales[1].nombre]);
  assert.equal(relevantes(reales, "odyssey g5").length, 0);
  assert.equal(relevantes(reales, "rtx 4070 renovada").length, 1, "si se pide, vale");
});

test("relevancia: entra el aviso que nombra todas las palabras de la consulta, sin contar conectores como «by»", async () => {
  const { relevantes } = await cargar("fuentes/comun.js");
  const n = nombre => ({ nombre, precio: 1 });
  const items = [n("Soundcore Anker AeroClip 2 - Auriculares con clip"), n("Soundcore C50i by Anker - Auriculares de oreja abierta"),
    n("Soundcore AeroClip by Anker - Auriculares abiertos"), n("UGREEN ClipBuds Pro 2"), n("Anker Soundcore AeroClip 2, color rosa")];
  assert.deepEqual(relevantes(items, "soundcore aeroclip 2 by anker").map(i => i.nombre),
    ["Soundcore Anker AeroClip 2 - Auriculares con clip", "Anker Soundcore AeroClip 2, color rosa"]);
  assert.equal(relevantes(items, "aeroclip").length, 3);
  assert.equal(relevantes([n("Auriculares Inalámbricos")], "auriculares inalambricos").length, 1, "sin tildes ni mayusculas");
  assert.deepEqual(relevantes(items, "de by con"), items, "sin palabras significativas no se filtra");
});

test("/buscar deja solo lo relevante de cada fuente", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([["tiendamia.com.ar/search/amazon/", conHtml("tiendamia-busqueda.html")]]),
    cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedido("soundcore aeroclip 2 by anker"), {})).json();
  assert.ok(j.items.length > 0);
  assert.ok(j.items.every(i => /aeroclip 2/i.test(i.nombre)), j.items.map(i => i.nombre).join(" | "));
});

test("relevancia: fundas y estuches «para» el producto no pasan como el producto (nombres reales de Tiendamia, 23/10)", async () => {
  const { relevantes } = await cargar("fuentes/comun.js");
  const n = nombre => ({ nombre, precio: 1 });
  const reales = [
    "FJIASTB Funda de silicona para auriculares Anker Soundcore AeroClip 2 | Funda protectora suave con mosquetón y cordón",
    "Anker Soundcore - Funda de viaje para auriculares AeroClip 2 | Antiarañazos, correa de muñeca",
    "Soundcore Anker AeroClip 2 - Auriculares con clip para llamadas nítidas | Chip AI ANKER ThusTM",
    "Soundcore Anker Aeroclip 2 y estuche de viaje para auriculares (paquete)",
    "Anker Soundcore Estuche de viaje Aeroclip 2 y auriculares (paquete)"].map(n);
  assert.deepEqual(relevantes(reales, "soundcore aeroclip 2 anker").map(i => i.nombre.slice(0, 30)),
    ["Soundcore Anker AeroClip 2 - A", "Soundcore Anker Aeroclip 2 y e"]);
  assert.equal(relevantes(reales, "funda aeroclip 2").length, 2, "si se busca la funda, la funda vale");
});

test("defensa propia: el Worker solo lee paginas de tiendamia.com.ar y www.loquieroaca.com por https", async () => {
  const { paginaPermitida } = await cargar("index.js");
  assert.equal(paginaPermitida("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"), true);
  assert.equal(paginaPermitida("https://www.loquieroaca.com/products/1589074"), true);
  for (const malo of ["http://tiendamia.com.ar/p/x", "https://localhost:8080/admin", "https://tiendamia.com.ar.evil.com/p/x", "nada", ""])
    assert.equal(paginaPermitida(malo), false, malo);
});

test("una fuente que falla dice por que en `motivo` (HTTP, tiempo), sin claves ni cuerpo de la respuesta", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([["oauth2/token", () => new Response('{"error":"invalid_client","secret":"sec"}', { status: 401 })]]),
    cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedido("rtx 4060"), ENV_EBAY)).json();
  assert.deepEqual(j.fuentes, [{ id: "ebay", ok: false, n: 0, motivo: "HTTP 401" }]);
  assert.doesNotMatch(JSON.stringify(j), /sec|invalid_client|id:/);
});

test("una fuente que anda no trae `motivo`", async () => {
  const { crearAtender } = await cargar("index.js");
  const atender = crearAtender({ fetch: fetchFalso([["oauth2/token", { access_token: "TOK", expires_in: 7200 }], ["item_summary/search", fixture("ebay-search.json")]]),
    cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(pedido("rtx 4060"), ENV_EBAY)).json();
  assert.equal(j.fuentes[0].ok, true);
  assert.equal("motivo" in j.fuentes[0], false);
});
