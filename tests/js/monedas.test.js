const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const M = require("../../js/monedas.js");

// Respuestas reales de las APIs, guardadas el 15/10/2026: los tests nunca van a la red.
const leer = nombre => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "monedas", nombre), "utf8"));
const DOLARAPI = leer("dolarapi-dolares.json");
const ERAPI = leer("erapi-usd.json");
const FRANKFURTER = leer("frankfurter-usd.json");
const CRUDAS = { dolarapi: DOLARAPI, erapi: ERAPI, frankfurter: FRANKFURTER };
const AHORA = "2026-10-15T17:00:00Z";

const dolar = casa => DOLARAPI.find(x => x.casa === casa);
const redondear = n => Math.round(n * 100) / 100;

// ---- normalizar ----

test("normalizar arma los tipos de dolar de dolarapi con su compra, su venta y su hora", () => {
  const t = M.normalizar(CRUDAS);
  for (const casa of ["oficial", "blue", "bolsa", "contadoconliqui", "mayorista", "cripto", "tarjeta"]) {
    assert.equal(t.dolares[casa].venta, dolar(casa).venta, casa);
    assert.equal(t.dolares[casa].compra, dolar(casa).compra, casa);
    assert.equal(t.dolares[casa].actualizado, new Date(dolar(casa).fechaActualizacion).toISOString(), casa);
  }
  assert.equal(t.fuentes.dolares, "dolarapi.com");
});

test("normalizar toma las demas monedas de open.er-api, con USD en 1 y sin el peso", () => {
  const t = M.normalizar(CRUDAS);
  assert.equal(t.porUsd.EUR, ERAPI.rates.EUR);
  assert.equal(t.porUsd.USD, 1);
  assert.ok(!("ARS" in t.porUsd), "el peso se cotiza por los tipos de dolar, no por open.er-api");
  assert.equal(t.fuentes.monedas, "open.er-api.com");
  assert.equal(t.actualizados.monedas, new Date(ERAPI.time_last_update_utc).toISOString());
});

test("si open.er-api no sirve, las monedas salen de frankfurter", () => {
  const t = M.normalizar({ dolarapi: DOLARAPI, erapi: null, frankfurter: FRANKFURTER });
  assert.equal(t.porUsd.EUR, FRANKFURTER.rates.EUR);
  assert.equal(t.fuentes.monedas, "frankfurter.dev");
  assert.equal(t.actualizados.monedas, new Date(FRANKFURTER.date).toISOString());
  const rota = M.normalizar({ dolarapi: DOLARAPI, erapi: { result: "error" }, frankfurter: FRANKFURTER });
  assert.equal(rota.fuentes.monedas, "frankfurter.dev");
});

test("lo que falta queda en null y no se inventa: sin dolarapi no hay dolares, sin ninguna fuente de monedas solo existe USD", () => {
  const sin = M.normalizar({});
  assert.deepEqual(sin.dolares, {});
  assert.deepEqual(sin.porUsd, { USD: 1 });
  assert.equal(sin.fuentes.dolares, null);
  assert.equal(sin.fuentes.monedas, null);
  assert.equal(M.normalizar({ dolarapi: "basura" }).fuentes.dolares, null);
});

test("un tipo de dolar sin venta numerica se descarta", () => {
  const t = M.normalizar({ dolarapi: [{ casa: "oficial", compra: 1, venta: 1535, fechaActualizacion: "2026-10-15T14:00:00.000Z" },
                                       { casa: "blue", compra: 1, venta: "no", fechaActualizacion: "2026-10-15T14:00:00.000Z" },
                                       { casa: "raro", compra: 1, venta: null }] });
  assert.deepEqual(Object.keys(t.dolares), ["oficial"]);
});

// ---- convertir ----

const TASAS = M.normalizar(CRUDAS);

test("convertir dolares a pesos usa la venta del tipo elegido", () => {
  assert.equal(M.convertir(100, "USD", "ARS", TASAS, { tipoDolar: "oficial" }).monto, redondear(100 * dolar("oficial").venta));
  assert.equal(M.convertir(100, "USD", "ARS", TASAS, { tipoDolar: "tarjeta" }).monto, redondear(100 * dolar("tarjeta").venta));
  assert.equal(M.convertir(100, "USD", "ARS", TASAS).tipoDolar, "oficial");            // sin elegir, oficial
});

test("convertir pesos a dolares es la inversa con el mismo tipo", () => {
  const ida = M.convertir(100, "USD", "ARS", TASAS, { tipoDolar: "blue" });
  const vuelta = M.convertir(ida.monto, "ARS", "USD", TASAS, { tipoDolar: "blue" });
  assert.equal(vuelta.monto, 100);
});

test("convertir entre otras monedas pasa por el dolar", () => {
  const eurAUsd = M.convertir(100, "EUR", "USD", TASAS);
  assert.equal(eurAUsd.monto, redondear(100 / ERAPI.rates.EUR));
  const eurAPesos = M.convertir(100, "EUR", "ARS", TASAS, { tipoDolar: "oficial" });
  assert.equal(eurAPesos.monto, redondear(100 / ERAPI.rates.EUR * dolar("oficial").venta));
  const brlACny = M.convertir(100, "BRL", "CNY", TASAS);
  assert.equal(brlACny.monto, redondear(100 / ERAPI.rates.BRL * ERAPI.rates.CNY));
});

test("la misma moneda no cambia el monto y la tasa es 1", () => {
  const r = M.convertir(123.45, "USD", "USD", TASAS);
  assert.equal(r.monto, 123.45);
  assert.equal(r.tasa, 1);
  assert.equal(M.convertir(50, "ARS", "ARS", TASAS).monto, 50);
});

test("el resultado dice la tasa usada, de donde sale y la hora mas vieja de lo que uso", () => {
  const r = M.convertir(100, "EUR", "ARS", TASAS, { tipoDolar: "oficial" });
  assert.ok(Math.abs(r.tasa - dolar("oficial").venta / ERAPI.rates.EUR) < 1e-9);          // el orden de las operaciones puede cambiar el ultimo bit
  assert.deepEqual(r.fuentes.sort(), ["dolarapi.com", "open.er-api.com"]);
  assert.equal(r.actualizado, new Date(ERAPI.time_last_update_utc).toISOString());          // la de open.er-api es mas vieja
  const soloDolar = M.convertir(100, "USD", "ARS", TASAS, { tipoDolar: "oficial" });
  assert.deepEqual(soloDolar.fuentes, ["dolarapi.com"]);
  assert.equal(soloDolar.actualizado, new Date(dolar("oficial").fechaActualizacion).toISOString());
});

test("una moneda desconocida o un tipo de dolar que no hay falla con un mensaje claro", () => {
  assert.throws(() => M.convertir(1, "XXX", "USD", TASAS), /moneda desconocida "XXX"/);
  assert.throws(() => M.convertir(1, "USD", "ARS", TASAS, { tipoDolar: "paralelo" }), /paralelo/);
  assert.throws(() => M.convertir(1, "USD", "ARS", M.normalizar({}), { tipoDolar: "oficial" }), /oficial/);
  assert.throws(() => M.convertir(NaN, "USD", "ARS", TASAS), /monto/);
  assert.throws(() => M.convertir(-1, "USD", "ARS", TASAS), /monto/);
});

// ---- Hallazgos de la revision de cinco ejes (code-review-and-quality, 15/10/2026) ----

test("las claves heredadas de un objeto no son monedas: constructor o toString dan error, no NaN", () => {
  for (const codigo of ["constructor", "toString", "__proto__", "hasOwnProperty", ""]) {
    assert.throws(() => M.convertir(1, codigo, "USD", TASAS), /moneda desconocida/, codigo);
    assert.throws(() => M.convertir(1, "USD", codigo, TASAS), /moneda desconocida/, codigo);
  }
});

test("un dolar con venta cero o negativa se descarta: nunca devuelve infinito ni plata negativa", () => {
  const t = M.normalizar({ dolarapi: [{ casa: "oficial", compra: 1, venta: 0, fechaActualizacion: "2026-10-15T14:00:00Z" },
                                       { casa: "blue", compra: 1, venta: -5 }, { casa: "bolsa", compra: -1, venta: 1536.7 }] });
  assert.deepEqual(Object.keys(t.dolares), ["bolsa"]);
  assert.equal(t.dolares.bolsa.compra, null);                       // una compra invalida no se inventa
  assert.throws(() => M.convertir(100, "ARS", "USD", t, { tipoDolar: "oficial" }), /oficial/);
});

test("una tasa de otra moneda en cero o negativa tampoco entra", () => {
  const t = M.normalizar({ erapi: { result: "success", time_last_update_utc: "Thu, 15 Oct 2026 00:02:31 +0000", rates: { EUR: 0, GBP: -1, BRL: 5.1 } } });
  assert.deepEqual(Object.keys(t.porUsd).sort(), ["BRL", "USD"]);
});

test("si la copia no trae los dolares, se avisa que no se puede pasar a pesos en vez de decir solo que se uso la copia", async () => {
  const sinDolares = { generado: "2026-10-14T09:00:00Z", dolarapi: null, erapi: ERAPI, frankfurter: null };
  const r = await M.cotizar({ fetch: fetchDe({}), snapshot: sinDolares, ahora: AHORA });
  assert.equal(r.origen, "copia");
  assert.ok(r.avisos.some(a => a.codigo === "sin_dolares" && /pesos/.test(a.texto)));
  const sinMonedas = { generado: "2026-10-14T09:00:00Z", dolarapi: DOLARAPI, erapi: null, frankfurter: null };
  const r2 = await M.cotizar({ fetch: fetchDe({}), snapshot: sinMonedas, ahora: AHORA });
  assert.ok(r2.avisos.some(a => a.codigo === "sin_monedas"));
  const completo = await M.cotizar({ fetch: fetchDe({}), snapshot: SNAPSHOT, ahora: AHORA });
  assert.ok(!completo.avisos.some(a => a.codigo === "sin_dolares" || a.codigo === "sin_monedas"));
});

test("una respuesta de monedas sin ninguna moneda util (vacia, en cero o solo ARS y USD) cuenta como fuente caida", async () => {
  for (const rates of [{}, { EUR: 0, BRL: -1 }, { ARS: 1500, USD: 1 }, { constructor: 5, "__proto__": 2 }]) {
    const inutil = { result: "success", time_last_update_utc: ERAPI.time_last_update_utc, rates };
    // con frankfurter andando, la reemplaza
    const conReserva = await M.cotizar({ fetch: fetchDe({ ...BIEN, [M.URLS.erapi]: resp(inutil) }), snapshot: SNAPSHOT, ahora: AHORA });
    assert.equal(conReserva.tasas.fuentes.monedas, "frankfurter.dev", JSON.stringify(rates));
    assert.ok(conReserva.tasas.porUsd.EUR > 0, JSON.stringify(rates));
    // sin reserva, sale de la copia
    const sinReserva = await M.cotizar({ fetch: fetchDe({ [M.URLS.dolarapi]: resp(DOLARAPI), [M.URLS.erapi]: resp(inutil) }), snapshot: SNAPSHOT, ahora: AHORA });
    assert.equal(sinReserva.origen, "mixto", JSON.stringify(rates));
    assert.ok(sinReserva.tasas.porUsd.EUR > 0, JSON.stringify(rates));
    assert.ok(sinReserva.avisos.some(a => a.codigo === "copia"), JSON.stringify(rates));
  }
});

test("sin pasar la hora actual, cotizar usa el reloj y el aviso de la copia dice de hace cuanto es", async () => {
  const haceDosHoras = { ...SNAPSHOT, generado: new Date(Date.now() - 2 * 3600 * 1000).toISOString() };
  const r = await M.cotizar({ fetch: fetchDe({}), snapshot: haceDosHoras });
  assert.ok(r.avisos.some(a => a.codigo === "sin_conexion" && /hace 2 h/.test(a.texto)), JSON.stringify(r.avisos));
});

// ---- antiguedad ----

test("antiguedad dice hace cuanto se actualizo y cuando es vieja", () => {
  const a = (iso, opciones) => M.antiguedad(iso, AHORA, opciones);
  assert.deepEqual(a("2026-10-15T16:55:00Z"), { minutos: 5, texto: "hace 5 min", vieja: false });
  assert.deepEqual(a("2026-10-15T14:00:00Z"), { minutos: 180, texto: "hace 3 h", vieja: false });
  assert.deepEqual(a("2026-10-14T15:00:00Z"), { minutos: 1560, texto: "hace 1 dia", vieja: true });
  assert.equal(a("2026-10-12T17:00:00Z").texto, "hace 3 dias");
  assert.equal(a("2026-10-15T17:00:20Z").texto, "ahora");                       // el reloj de la persona atrasa unos segundos
  assert.equal(a("2026-10-15T16:59:30Z").texto, "ahora");
  assert.equal(a("2026-10-14T20:00:00Z", { maxHoras: 12 }).vieja, true);
  assert.equal(a("2026-10-15T08:00:00Z", { maxHoras: 12 }).vieja, false);
  assert.equal(M.antiguedad(null, AHORA), null);
  assert.equal(M.antiguedad("no es una fecha", AHORA), null);
});

// ---- cotizar: en vivo, mixto, copia y sin datos ----

const resp = (cuerpo, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => cuerpo });
const BIEN = { [M.URLS.dolarapi]: resp(DOLARAPI), [M.URLS.erapi]: resp(ERAPI), [M.URLS.frankfurter]: resp(FRANKFURTER) };
const fetchDe = mapa => async url => {
  const r = mapa[url];
  if (r === undefined) throw new Error("sin red");
  return typeof r === "function" ? r() : r;
};
const SNAPSHOT = { generado: "2026-10-14T09:00:00Z", ...CRUDAS };

test("con las fuentes andando, todo sale en vivo y sin avisos", async () => {
  const r = await M.cotizar({ fetch: fetchDe(BIEN), snapshot: SNAPSHOT, ahora: AHORA });
  assert.equal(r.origen, "vivo");
  assert.deepEqual(r.avisos, []);
  assert.equal(r.tasas.dolares.oficial.venta, dolar("oficial").venta);
  assert.equal(r.tasas.fuentes.monedas, "open.er-api.com");
});

test("no pide a frankfurter si open.er-api respondio bien", async () => {
  const pedidas = [];
  const f = async url => { pedidas.push(url); return fetchDe(BIEN)(url); };
  await M.cotizar({ fetch: f, snapshot: SNAPSHOT, ahora: AHORA });
  assert.ok(!pedidas.includes(M.URLS.frankfurter));
  assert.equal(pedidas.length, 2);
});

test("si open.er-api cae, frankfurter la reemplaza y se avisa", async () => {
  const mapa = { ...BIEN, [M.URLS.erapi]: resp({}, { ok: false, status: 503 }) };
  const r = await M.cotizar({ fetch: fetchDe(mapa), snapshot: SNAPSHOT, ahora: AHORA });
  assert.equal(r.origen, "vivo");
  assert.equal(r.tasas.fuentes.monedas, "frankfurter.dev");
  assert.ok(r.avisos.some(a => a.codigo === "fuente_alternativa" && /frankfurter/.test(a.texto)));
});

test("si cae dolarapi, los dolares salen de la copia del build, con su fecha, y el origen es mixto", async () => {
  const mapa = { ...BIEN, [M.URLS.dolarapi]: () => { throw new Error("timeout"); } };
  const r = await M.cotizar({ fetch: fetchDe(mapa), snapshot: SNAPSHOT, ahora: AHORA });
  assert.equal(r.origen, "mixto");
  assert.equal(r.tasas.dolares.oficial.venta, dolar("oficial").venta);
  const aviso = r.avisos.find(a => a.codigo === "copia");
  assert.ok(aviso && /dolarapi/.test(aviso.texto) && /hace/.test(aviso.texto));
  assert.equal(r.tasas.fuentes.monedas, "open.er-api.com");
});

test("sin red, todo sale de la copia y se avisa cuanto tiene", async () => {
  const r = await M.cotizar({ fetch: fetchDe({}), snapshot: SNAPSHOT, ahora: AHORA });
  assert.equal(r.origen, "copia");
  assert.equal(r.tasas.dolares.oficial.venta, dolar("oficial").venta);
  assert.ok(r.avisos.some(a => a.codigo === "sin_conexion" && /hace 1 dia/.test(a.texto)));
});

test("sin red y sin copia no hay cotizaciones: se dice y no se inventa nada", async () => {
  const r = await M.cotizar({ fetch: fetchDe({}), snapshot: null, ahora: AHORA });
  assert.equal(r.origen, "sin_datos");
  assert.deepEqual(r.tasas.dolares, {});
  assert.deepEqual(r.tasas.porUsd, { USD: 1 });
  assert.ok(r.avisos.some(a => a.codigo === "sin_datos"));
});

test("una respuesta mal formada o con error HTTP cuenta como fuente caida", async () => {
  for (const mala of [resp("basura"), resp(null), resp(undefined), resp({ result: "error" }), resp([], { ok: false, status: 500 }), { ok: true, status: 200, json: async () => { throw new Error("json roto"); } }]) {
    const r = await M.cotizar({ fetch: fetchDe({ ...BIEN, [M.URLS.dolarapi]: mala }), snapshot: SNAPSHOT, ahora: AHORA });
    assert.equal(r.origen, "mixto");
    assert.equal(r.tasas.dolares.oficial.venta, dolar("oficial").venta);       // salio de la copia
  }
});

test("una fuente que no responde a tiempo se corta y se usa la copia", async () => {
  const colgada = () => new Promise(() => {});
  const r = await M.cotizar({ fetch: fetchDe({ ...BIEN, [M.URLS.dolarapi]: colgada }), snapshot: SNAPSHOT, ahora: AHORA, tiempoMaximoMs: 20 });
  assert.equal(r.origen, "mixto");
  assert.ok(r.avisos.some(a => a.codigo === "copia"));
});

test("una copia vieja de mas de un dia se marca como vieja en el aviso", async () => {
  const vieja = { ...SNAPSHOT, generado: "2026-10-10T09:00:00Z" };
  const r = await M.cotizar({ fetch: fetchDe({}), snapshot: vieja, ahora: AHORA });
  assert.ok(r.avisos.some(a => /hace 5 dias/.test(a.texto)));
});

test("cotizar nunca lanza: aunque el fetch falle de formas raras", async () => {
  const f = async () => { throw { raro: true }; };
  const r = await M.cotizar({ fetch: f, snapshot: undefined, ahora: AHORA });
  assert.equal(r.origen, "sin_datos");
});

test("los tipos de dolar disponibles para el selector estan en un orden fijo y con su nombre", () => {
  assert.deepEqual(M.TIPOS_DOLAR.map(t => t.id), ["oficial", "tarjeta", "bolsa", "contadoconliqui", "blue", "mayorista", "cripto"]);
  assert.ok(M.TIPOS_DOLAR.every(t => t.nombre));
  assert.equal(M.TIPOS_DOLAR.find(t => t.id === "bolsa").nombre, "MEP (bolsa)");
});
