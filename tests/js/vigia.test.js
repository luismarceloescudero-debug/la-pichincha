/* Vigia del sitio (spec 065, plan v4 seccion 7.1): cada 5 minutos mira la portada, /hoy/, una ficha de /precios/, que el
   indice sea de hoy y, cuando la app este publicada, assetlinks.json. Si algo falla, avisa al chat privado del dueno por
   Telegram; si vuelve a andar, tambien. El Worker es ESM, se carga con import() como en worker.test.js. */
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const cargar = m => import(path.join(__dirname, "..", "..", "worker", "src", m).replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));

const HOY = "2026-11-12";
const AHORA = `${HOY}T12:00:00.000Z`;        // 09:00 en Argentina
const MADRUGADA = `${HOY}T05:30:00.000Z`;    // 02:30 en Argentina: la corrida diaria (00:23 y 02:47) puede no haber salido
const BASE = "https://pichinchadeldia.com.ar";

const pagina = (marca = "La Pichincha") => new Response(`<!doctype html><html><head><title>${marca}</title></head><body></body></html>`,
  { status: 200, headers: { "Content-Type": "text/html" } });
const indice = (generado = `${HOY}T09:23-03:00`) => new Response(`{"generado":"${generado}","tiendas":{}`, { status: 200 });
const hoy = () => pagina("Pichinchas del día · 12/11/2026 | La Pichincha");

/* Un sitio falso: la ruta mas larga que coincida con el principio de la url responde eso (una funcion recibe url e init),
   asi BASE + "/" no se come a las demas. */
function fetchSitio(rutas, llamadas = []) {
  const patrones = Object.entries(rutas).sort((a, z) => z[0].length - a[0].length);
  return async (url, init = {}) => {
    const u = String(url);
    llamadas.push({ url: u, init });
    for (const [patron, r] of patrones) if (u.startsWith(patron)) return typeof r === "function" ? r(u, init) : r.clone();
    return new Response("no", { status: 404 });
  };
}
const sitioSano = extra => ({ [BASE + "/"]: pagina(), [BASE + "/hoy/"]: hoy(), [BASE + "/precios/"]: pagina(),
  [BASE + "/indice.json"]: indice(), ...extra });
const ids = r => r.fallas.map(f => f.id).sort();

/* --- Cuando corre y que fecha es "hoy" --- */

test("la hora del sitio es la argentina (UTC-3 fijo): fecha y hora del chequeo no dependen del reloj del Worker", async () => {
  const { fechaArgentina, horaArgentina } = await cargar("vigia.js");
  assert.equal(fechaArgentina(Date.parse("2026-11-12T02:30:00.000Z")), "2026-11-11", "02:30 UTC del 12 es 23:30 del 11 en Argentina");
  assert.equal(horaArgentina(Date.parse("2026-11-12T02:30:00.000Z")), 23);
  assert.equal(fechaArgentina(Date.parse(AHORA)), HOY);
  assert.equal(horaArgentina(Date.parse(MADRUGADA)), 2);
});

/* --- El indice: la fecha sin bajar los 6 MB --- */

test("la fecha del indice se lee del principio del archivo, sin bajarlo entero", async () => {
  const { leerGenerado } = await cargar("vigia.js");
  assert.equal(leerGenerado('{"generado":"2026-11-12T09:23-03:00","tiendas":{}'), "2026-11-12");
  assert.equal(leerGenerado('{\n "generado": "2026-11-12T09:23-03:00"'), "2026-11-12");
  assert.equal(leerGenerado('{"tiendas":{},"generado":"2026-11-12T09:23-03:00"}'), null, "no es el formato de indexar.py");
  assert.equal(leerGenerado("<html>404</html>"), null);
  assert.equal(leerGenerado(""), null);
  assert.equal(leerGenerado(null), null);
});

test("pide solo los primeros bytes del indice y corta la descarga ahi (el indice pesa mas de 6 MB)", async () => {
  const { revisar, TIEMPO_MAXIMO } = await cargar("vigia.js");
  const PEDAZO = 256 * 1024, PEDAZOS = 20;      // 5 MB en total: el indice real pesa mas
  let pedazos = 0, bajado = 0;
  const grande = new ReadableStream({
    pull(c) {
      pedazos += 1;
      if (pedazos > PEDAZOS) return c.close();
      const trozo = pedazos === 1 ? new TextEncoder().encode(`{"generado":"${HOY}T09:23-03:00","productos":[`) : new Uint8Array(PEDAZO);
      bajado += trozo.length;
      c.enqueue(trozo);
    },
  });
  const llamadas = [];
  const f = fetchSitio(sitioSano({ [BASE + "/indice.json"]: () => new Response(grande, { status: 200 }) }), llamadas);
  const r = await revisar({ fetch: f, ahora: () => AHORA });
  assert.equal(r.ok, true, JSON.stringify(r.fallas));
  const pedido = llamadas.find(l => l.url.endsWith("/indice.json"));
  assert.equal(pedido.init.headers.Range, "bytes=0-511", "pide el principio del archivo");
  assert.ok(bajado < 2 * PEDAZO * 2, `corto la descarga: ${bajado} bytes de ${PEDAZOS * PEDAZO}`);
  assert.ok(TIEMPO_MAXIMO > 0 && TIEMPO_MAXIMO <= 30000, "cada chequeo tiene tope de tiempo");
});

/* --- Los cuatro chequeos de la seccion 7.1 --- */

test("con el sitio sano no hay nada que avisar", async () => {
  const { revisar } = await cargar("vigia.js");
  const llamadas = [];
  const r = await revisar({ fetch: fetchSitio(sitioSano(), llamadas), ahora: () => AHORA });
  assert.equal(r.ok, true);
  assert.deepEqual(r.fallas, []);
  assert.equal(r.cuando, AHORA);
  const urls = llamadas.map(l => l.url);
  assert.ok(urls.includes(BASE + "/"), "mira la portada");
  assert.ok(urls.includes(BASE + "/hoy/"), "mira /hoy/");
  assert.ok(urls.includes(BASE + "/precios/placa-de-video/"), "mira una ficha de /precios/");
  assert.ok(urls.includes(BASE + "/indice.json"), "mira el indice");
});

test("una pagina caida se informa con su codigo, y las demas se revisan igual", async () => {
  const { revisar } = await cargar("vigia.js");
  const f = fetchSitio(sitioSano({ [BASE + "/"]: new Response("error", { status: 502 }),
    [BASE + "/hoy/"]: new Response("no", { status: 404 }) }));
  const r = await revisar({ fetch: f, ahora: () => AHORA });
  assert.equal(r.ok, false);
  assert.deepEqual(ids(r), ["hoy", "portada"]);
  assert.match(r.fallas.find(x => x.id === "portada").detalle, /502/);
  assert.match(r.fallas.find(x => x.id === "hoy").detalle, /404/);
});

test("un 200 que no es la pagina del sitio tambien es una falla (una pantalla de error con otro codigo)", async () => {
  const { revisar } = await cargar("vigia.js");
  const f = fetchSitio(sitioSano({ [BASE + "/precios/"]: () => pagina("Mantenimiento") }));
  const r = await revisar({ fetch: f, ahora: () => AHORA });
  assert.deepEqual(ids(r), ["precios"]);
  assert.match(r.fallas[0].detalle, /no es la página del sitio/);
});

test("una pagina que no responde o tarda no cuelga al vigia: se informa y sigue con las otras", async () => {
  const { revisar } = await cargar("vigia.js");
  const f = fetchSitio(sitioSano({ [BASE + "/hoy/"]: () => { throw new Error("tiempo agotado"); } }));
  const r = await revisar({ fetch: f, ahora: () => AHORA });
  assert.deepEqual(ids(r), ["hoy"]);
  assert.match(r.fallas[0].detalle, /no respondió/);
});

test("el indice tiene que ser de hoy, pero no se avisa antes de las 03:00 (corrida de 00:23 y 02:47)", async () => {
  const { revisar } = await cargar("vigia.js");
  const deAyer = indice("2026-11-11T09:20-03:00");
  const f = () => fetchSitio(sitioSano({ [BASE + "/indice.json"]: deAyer }));
  const tarde = await revisar({ fetch: f(), ahora: () => AHORA });
  assert.deepEqual(ids(tarde), ["indice"]);
  assert.match(tarde.fallas[0].detalle, /11\/11/, "dice de que dia es");
  const madrugada = await revisar({ fetch: f(), ahora: () => MADRUGADA });
  assert.deepEqual(ids(madrugada), [], "a las 02:30 todavia puede estar corriendo la corrida del dia");
  const dosDias = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/indice.json"]: indice("2026-11-10T09:20-03:00") })), ahora: () => MADRUGADA });
  assert.deepEqual(ids(dosDias), ["indice"], "con dos dias de atraso se avisa a cualquier hora");
});

test("sin indice (404 o algo que no es JSON) es una falla: el buscador se queda sin precios", async () => {
  const { revisar } = await cargar("vigia.js");
  const sin = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/indice.json"]: new Response("no", { status: 404 }) })), ahora: () => AHORA });
  assert.deepEqual(ids(sin), ["indice"]);
  assert.match(sin.fallas[0].detalle, /404/);
  const roto = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/indice.json"]: () => pagina("Mantenimiento") })), ahora: () => AHORA });
  assert.deepEqual(ids(roto), ["indice"]);
  assert.match(roto.fallas[0].detalle, /fecha/);
  const mudo = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/indice.json"]: () => { throw new Error("tiempo agotado"); } })), ahora: () => AHORA });
  assert.deepEqual(ids(mudo), ["indice"]);
  assert.match(mudo.fallas[0].detalle, /no respondió/);
});

/* --- assetlinks.json: recien cuando la app esta publicada (Fase 3) --- */

test("assetlinks.json no se revisa hasta que la app este publicada", async () => {
  const { revisar } = await cargar("vigia.js");
  const llamadas = [];
  const r = await revisar({ fetch: fetchSitio(sitioSano(), llamadas), ahora: () => AHORA, env: {} });
  assert.deepEqual(r.fallas, []);
  assert.ok(!llamadas.some(l => l.url.includes("assetlinks")), "sin APP_PUBLICADA=si no se pide");
});

test("con la app publicada, assetlinks.json tiene que estar y ser de nuestro paquete", async () => {
  const { revisar, PAQUETE } = await cargar("vigia.js");
  const env = { APP_PUBLICADA: "si" };
  const falta = await revisar({ fetch: fetchSitio(sitioSano()), ahora: () => AHORA, env });
  assert.deepEqual(ids(falta), ["assetlinks"]);
  const otro = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/.well-known/assetlinks.json"]:
    new Response(JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "com.otro" } }])) })),
  ahora: () => AHORA, env });
  assert.deepEqual(ids(otro), ["assetlinks"], "la huella o el paquete de otra app no sirven");
  const bien = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/.well-known/assetlinks.json"]:
    new Response(JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app",
      package_name: PAQUETE, sha256_cert_fingerprints: ["AA:BB"] } }])) })), ahora: () => AHORA, env });
  assert.deepEqual(bien.fallas, []);
  const mudo = await revisar({ fetch: fetchSitio(sitioSano({ [BASE + "/.well-known/assetlinks.json"]: () => { throw new Error("red"); } })),
    ahora: () => AHORA, env });
  assert.deepEqual(ids(mudo), ["assetlinks"]);
  assert.match(mudo.fallas[0].detalle, /no respondió/);
});

/* --- El aviso por Telegram, al chat privado --- */

const ROTO = { cuando: AHORA, ok: false, fallas: [{ id: "portada", titulo: "Portada", detalle: "respondió 502" }] };
const SANO = { cuando: AHORA, ok: true, fallas: [] };

test("el aviso dice que fallo y donde, y no repite el mismo problema en cada vuelta", async () => {
  const { textoAviso, RECORDAR_MS, huella } = await cargar("vigia.js");
  const primero = textoAviso(ROTO, null, Date.parse(AHORA));
  assert.match(primero, /^⚠️/);
  assert.match(primero, /Portada/);
  assert.match(primero, /respondió 502/);
  assert.match(primero, new RegExp(BASE));
  const anotado = { huella: huella(ROTO), avisado: Date.parse(AHORA), fallas: ROTO.fallas };
  assert.equal(textoAviso(ROTO, anotado, Date.parse(AHORA) + 5 * 60 * 1000), "", "el mismo problema no se repite a los 5 minutos");
  assert.notEqual(textoAviso(ROTO, anotado, Date.parse(AHORA) + RECORDAR_MS + 1000), "", "a las 6 horas se recuerda");
  const otro = { ...ROTO, fallas: [...ROTO.fallas, { id: "indice", titulo: "Indice", detalle: "es del 11/11" }] };
  assert.notEqual(textoAviso(otro, anotado, Date.parse(AHORA) + 60 * 1000), "", "un problema nuevo si se avisa");
});

test("cuando vuelve a andar manda un solo mensaje de que ya esta bien", async () => {
  const { textoAviso, huella } = await cargar("vigia.js");
  const anotado = { huella: huella(ROTO), avisado: Date.parse(AHORA), fallas: ROTO.fallas };
  const vuelve = textoAviso(SANO, anotado, Date.parse(AHORA) + 5 * 60 * 1000);
  assert.match(vuelve, /^🟢/);
  assert.equal(textoAviso(SANO, null, Date.parse(AHORA)), "", "si nunca hubo problemas no se manda nada");
  const yaAvisado = { huella: "", avisado: Date.parse(AHORA) };
  assert.equal(textoAviso(SANO, yaAvisado, Date.parse(AHORA) + 5 * 60 * 1000), "", "no repite el «ya esta bien»");
});

test("el aviso va al chat privado del dueno con el bot del canal; nunca al canal y nunca sin secreto", async () => {
  const { avisar } = await cargar("vigia.js");
  const llamadas = [];
  const f = async (url, init = {}) => { llamadas.push({ url: String(url), init }); return new Response('{"ok":true}', { status: 200 }); };
  const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_DUENO: "999", TELEGRAM_CHAT_ID: "@pichinchasdeldia" };
  assert.equal(await avisar("hola", { fetch: f, env }), true);
  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].url, /^https:\/\/api\.telegram\.org\/bot123:abc\/sendMessage$/, "el token va en la direccion");
  const cuerpo = JSON.parse(llamadas[0].init.body);
  assert.equal(cuerpo.chat_id, "999");
  assert.equal(cuerpo.parse_mode, "HTML");
  assert.equal(cuerpo.disable_web_page_preview, true);
  // Sin el secreto del chat privado no se manda: el paso no falla, queda la advertencia en el log.
  assert.equal(await avisar("hola", { fetch: f, env: { TELEGRAM_BOT_TOKEN: "123:abc" } }), false);
  // Si el chat del dueno es el canal publico, tampoco: los avisos no se publican.
  assert.equal(await avisar("hola", { fetch: f, env: { ...env, TELEGRAM_CHAT_DUENO: "@pichinchasdeldia " } }), false);
  assert.equal(llamadas.length, 1, "no se hizo ningun pedido de mas");
  // Si Telegram no contesta, el vigia sigue: devuelve false y no rompe la corrida.
  assert.equal(await avisar("hola", { fetch: async () => { throw new Error("red"); }, env }), false);
  assert.equal(await avisar("hola", { fetch: async () => new Response("no", { status: 500 }), env }), false);
});

/* --- La corrida entera: revisar, comparar con lo ultimo y avisar --- */

function cacheFalsa(inicial = {}) {
  const m = new Map(Object.entries(inicial));
  return { m, match: async k => (m.has(k) ? new Response(m.get(k)) : undefined), put: async (k, r) => { m.set(k, await r.text()); } };
}

test("el vigia avisa una vez, se acuerda entre corridas y avisa cuando se arregla", async () => {
  const { vigilar, CLAVE_ESTADO } = await cargar("vigia.js");
  const cache = cacheFalsa(), enviados = [];
  const telegram = async (url, init = {}) => { if (String(url).includes("api.telegram.org")) { enviados.push(JSON.parse(init.body).text); return new Response('{"ok":true}'); } return new Response("no", { status: 404 }); };
  const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_DUENO: "999" };
  // Primera corrida: la portada responde 502.
  const roto = fetchSitio(sitioSano({ [BASE + "/"]: new Response("error", { status: 502 }) }), []);
  const r1 = await vigilar({ fetch: async (u, i) => (String(u).startsWith(BASE) ? roto(u, i) : telegram(u, i)), cache, ahora: () => AHORA, env });
  assert.equal(r1.avisado, true);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0], /Portada/);
  // Segunda corrida, cinco minutos despues y con la misma falla: no repite.
  const cinco = new Date(Date.parse(AHORA) + 5 * 60 * 1000).toISOString();
  const r2 = await vigilar({ fetch: async (u, i) => (String(u).startsWith(BASE) ? roto(u, i) : telegram(u, i)), cache, ahora: () => cinco, env });
  assert.equal(r2.avisado, false);
  assert.equal(enviados.length, 1);
  // Tercera: se arreglo. Un solo mensaje verde.
  const sano = fetchSitio(sitioSano(), []);
  const diez = new Date(Date.parse(AHORA) + 10 * 60 * 1000).toISOString();
  const r3 = await vigilar({ fetch: async (u, i) => (String(u).startsWith(BASE) ? sano(u, i) : telegram(u, i)), cache, ahora: () => diez, env });
  assert.equal(r3.ok, true);
  assert.equal(enviados.length, 2);
  assert.match(enviados[1], /^🟢/);
  // Cuarta: sigue bien, no manda nada mas.
  await vigilar({ fetch: async (u, i) => (String(u).startsWith(BASE) ? sano(u, i) : telegram(u, i)), cache, ahora: () => new Date(Date.parse(AHORA) + 15 * 60 * 1000).toISOString(), env });
  assert.equal(enviados.length, 2);
  assert.ok(cache.m.has(CLAVE_ESTADO), "deja anotado lo ultimo para la proxima corrida");
});

test("si el aviso no salio (sin secretos) no se anota como avisado: la proxima corrida lo vuelve a intentar", async () => {
  const { vigilar, CLAVE_ESTADO } = await cargar("vigia.js");
  const cache = cacheFalsa(), llamadas = [];
  const roto = fetchSitio(sitioSano({ [BASE + "/"]: new Response("error", { status: 502 }) }), llamadas);
  const r = await vigilar({ fetch: roto, cache, ahora: () => AHORA, env: {} });
  assert.equal(r.avisado, false);
  assert.equal(r.fallas.length, 1, "el resultado de los chequeos se devuelve igual");
  assert.ok(!cache.m.has(CLAVE_ESTADO), "no se guarda un estado que diga que ya aviso");
});

test("el vigia se prende y se apaga solo: sin la variable no corre, y con el interruptor apagado tampoco", async () => {
  const { vigilar, revisar, CLAVE_ESTADO } = await cargar("vigia.js");
  const cache = cacheFalsa(), llamadas = [];
  const f = fetchSitio(sitioSano(), llamadas);
  const r = await vigilar({ fetch: f, cache, ahora: () => AHORA, env: { VIGIA: "no" } });
  assert.equal(r.corrio, false);
  assert.equal(llamadas.length, 0, "apagado no pide nada");
  assert.ok(!cache.m.has(CLAVE_ESTADO));
  const si = await revisar({ fetch: f, ahora: () => AHORA, env: {} });
  assert.equal(si.ok, true, "por defecto esta prendido");
});

test("si la cache falla, el vigia revisa y avisa igual (perder el estado es un aviso de mas, no una caida)", async () => {
  const { vigilar } = await cargar("vigia.js");
  const enviados = [];
  const f = async (u, i = {}) => {
    if (String(u).includes("api.telegram.org")) { enviados.push(JSON.parse(i.body).text); return new Response('{"ok":true}'); }
    return String(u).startsWith(BASE) ? fetchSitio(sitioSano({ [BASE + "/"]: new Response("error", { status: 502 }) }))(u, i)
      : new Response("no", { status: 404 });
  };
  const cache = { match: async () => { throw new Error("cache rota"); }, put: async () => { throw new Error("cache rota"); } };
  const r = await vigilar({ fetch: f, cache, ahora: () => AHORA, env: { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_DUENO: "999" } });
  assert.equal(r.avisado, true);
  assert.equal(enviados.length, 1);
});

/* --- El Worker: el cron y la ruta para mirarlo a mano --- */

test("el Worker tiene el cron del vigia y una ruta GET /vigia que no manda Telegram", async () => {
  const { crearAtender, default: worker } = await cargar("index.js");
  assert.equal(typeof worker.scheduled, "function", "el Cron Trigger llama a scheduled()");
  const llamadas = [];
  const cache = cacheFalsa();
  const atender = crearAtender({ fetch: fetchSitio(sitioSano(), llamadas), cache, ahora: () => AHORA });
  const pedido = new Request("https://afuera.example.workers.dev/vigia", { headers: { "CF-Connecting-IP": "1.2.3.4" } });
  const r = await atender(pedido, { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHAT_DUENO: "999" });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.deepEqual(j.fallas, []);
  assert.ok(!llamadas.some(l => l.url.includes("api.telegram.org")), "/vigia solo mira: el aviso lo manda el cron");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});

test("la ruta /vigia no repite los chequeos si se la pide dos veces seguidas", async () => {
  const { crearAtender } = await cargar("index.js");
  const llamadas = [];
  const atender = crearAtender({ fetch: fetchSitio(sitioSano(), llamadas), cache: cacheFalsa(), ahora: () => AHORA });
  const pedir = (ruta = "/vigia") => atender(new Request("https://afuera.example.workers.dev" + ruta, { headers: { "CF-Connecting-IP": "1.2.3.4" } }), {});
  await pedir();
  const primeros = llamadas.length;
  assert.equal((await (await pedir()).json()).ok, true);
  assert.equal(llamadas.length, primeros, "la segunda sale de lo ultimo, sin volver a pedir el sitio");
  await pedir("/vigia?fresco=1");
  assert.ok(llamadas.length > primeros, "?fresco=1 fuerza la revision");
});

test("en modo /vigia la fecha del indice no avisa pero si se informa (la ruta sirve para verificar a mano)", async () => {
  const { crearAtender } = await cargar("index.js");
  const f = fetchSitio(sitioSano({ [BASE + "/indice.json"]: indice("2026-11-11T09:20-03:00") }));
  const atender = crearAtender({ fetch: f, cache: cacheFalsa(), ahora: () => AHORA });
  const j = await (await atender(new Request("https://afuera.example.workers.dev/vigia", { headers: { "CF-Connecting-IP": "1.2.3.4" } }), {})).json();
  assert.equal(j.ok, false);
  assert.deepEqual(j.fallas.map(x => x.id), ["indice"]);
});
