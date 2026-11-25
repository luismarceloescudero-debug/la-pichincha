/* Spec 068: /?q= de una busqueda pre-armada se arma con su porcion (precios/<slug>/filas.json) y no baja el indice entero.
   Invariante: la porcion da exactamente el mismo analisis que el indice entero. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const G = require("../../generar_portada.js");
const GP = require("../../generar_paginas.js");
const A = require("../../js/analisis.js");
const Pagina = require("../../js/pagina.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const INDICE = JSON.parse(leer("tests/fixtures/e2e/indice.json"));
const DATOS = JSON.parse(leer("datos.json"));
const marcas = DATOS.marcas || {};

test("Pagina.slug da lo mismo que slug() de generar_paginas.py (tests/fixtures/slugs.json, mismos casos en Python)", () => {
  for (const [q, esperado] of Object.entries(JSON.parse(leer("tests/fixtures/slugs.json")))) assert.equal(Pagina.slug(q), esperado, q);
  assert.equal(Pagina.slug("¿¿??"), "");
});

test("la porcion trae solo las filas que coinciden, con tiendas, campos y fecha del indice", () => {
  const p = GP.porcionDe(INDICE, "rtx 5060");
  assert.ok(p.productos.length > 0 && p.productos.length < INDICE.productos.length);
  assert.ok(p.productos.every(f => /5060/.test(f[0])));
  assert.deepStrictEqual(p.tiendas, INDICE.tiendas);
  assert.equal(p.generado, INDICE.generado);
  assert.equal(p.q, "rtx 5060");
});

test("invariante: la porcion da el mismo analisis que el indice entero, en cada busqueda del fixture", () => {
  const consultas = ["rtx 5060", "rtx 5060 ti", "placa de video", "ssd 1tb", "ryzen 5", "monitor 27", "memoria ddr4", "no existe nada"];
  let conResultado = 0;
  for (const q of consultas) {
    const entero = A.analizarConsulta(q, GP.crearContexto(INDICE, { marcas }));
    const porcion = A.analizarConsulta(q, GP.crearContexto(GP.porcionDe(INDICE, q), { marcas }));
    assert.equal(GP.firmaAnalisis(porcion), GP.firmaAnalisis(entero), q);
    if (entero) conResultado++;
  }
  assert.ok(conResultado >= 1, "el fixture tiene que tener al menos una busqueda con analisis");
});

test("la firma distingue analisis distintos (si no, el control del build no controla nada)", () => {
  const a = A.analizarConsulta("rtx 5060", GP.crearContexto(INDICE, { marcas }));
  const recortado = { ...INDICE, productos: GP.porcionDe(INDICE, "rtx 5060").productos.slice(1) };
  const b = A.analizarConsulta("rtx 5060", GP.crearContexto(recortado, { marcas }));
  assert.notEqual(GP.firmaAnalisis(b), GP.firmaAnalisis(a));
  assert.equal(GP.firmaAnalisis(null), "sin analisis");
});

/* ---- La pagina de verdad, con su arranque: un DOM minimo que guarda lo que se escribe en cada elemento ---- */
function elemento() {
  const el = { _html: "", dataset: {}, textContent: "", value: "", scrollWidth: 0, clientWidth: 0, classList: { add() {}, remove() {} },
    setAttribute() {}, addEventListener() {}, scrollIntoView() {}, querySelector: () => null, querySelectorAll: () => [],
    get children() { return { length: el._html.trim() ? 1 : 0 }; } };
  Object.defineProperty(el, "innerHTML", { get: () => el._html, set: v => { el._html = v; } });
  return el;
}

async function abrir(search, { porcion = true } = {}) {
  const q = new URLSearchParams(search).get("q");
  const pedidos = [];
  const fetch = url => {
    pedidos.push(url);
    if (url.endsWith("/filas.json"))
      return Promise.resolve(porcion ? { ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(GP.porcionDe(INDICE, q)))) }
        : { ok: false, status: 404, json: () => Promise.reject(new Error("404")) });
    if (url === "indice.json") return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(INDICE))) });
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) });
  };
  const els = {};
  const documento = { querySelector: s => els[s] || (els[s] = elemento()), querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, body: elemento(), documentElement: { className: "" }, title: "" };
  const ctx = G.contexto(leer("index.html"), leer, {
    document: documento, setTimeout() {}, location: { hash: "", search, pathname: "/", origin: "http://x", href: "http://x/" + search },
    fetch, localStorage: { getItem: () => null, setItem() {} }, navigator: {}, history: { replaceState() {} }, addEventListener() {},
    matchMedia: () => ({ matches: false }),
  }, { conArranque: true, antesDeArrancar: c => { c.App = { iniciar: () => null }; } });
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  return { els, ctx, pedidos, correr: codigo => vm.runInContext(codigo, ctx), documento };
}

test("/?q=rtx 5060 arma la comparativa con la porcion, sin pedir el indice entero", async () => {
  const { els, pedidos, correr, documento } = await abrir("?q=rtx%205060");
  assert.deepStrictEqual(pedidos.filter(u => !u.startsWith("datos/")), ["precios/rtx-5060/filas.json"]);
  assert.match(els["#vista"].innerHTML, /Comparativa: rtx 5060/);
  assert.equal(correr("IDX.parcial"), true);
  assert.match(documento.documentElement.className, /con-q/, "la portada pre-renderizada no se dibuja");
  // Abrir Buscar necesita el catalogo: recien ahi se baja el indice, y la comparativa queda con sus filas.
  await correr("asegurarIndice()");
  assert.equal(pedidos.filter(u => u === "indice.json").length, 1);
  assert.equal(correr("IDX.parcial"), undefined);
  assert.ok(correr("IDX.productos.includes(ANALISIS.picks[0].m.f)"), "ANALISIS pasa a las filas del indice entero");
});

test("sin porcion para esa busqueda (404) se baja el indice entero y la comparativa sale igual", async () => {
  const { els, pedidos, correr } = await abrir("?q=rtx%205060", { porcion: false });
  assert.ok(pedidos.includes("indice.json"));
  assert.match(els["#vista"].innerHTML, /Comparativa: rtx 5060/);
  assert.equal(correr("IDX.parcial"), undefined);
});
