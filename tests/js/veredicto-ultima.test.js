/* Spec 063, fase D: el Veredicto se arma con la ULTIMA busqueda (la haya guardado el historial o no), dice cuando no tiene
   resultados, separa los tipos de producto de una busqueda ambigua y habla del producto que es (no de «equipos completos»). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const GP = require("../../generar_portada.js");
const A = require("../../js/analisis.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const fila = (nombre, precio, tienda) => [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", ""];

const AERO = [
  fila("Notebook Gigabyte Aero 14 Intel Core i7 16GB 1TB", 3200000, "cg"),
  fila("Notebook Gigabyte Aero 16 Intel Core i9 32GB 1TB", 4100000, "mx"),
  fila("Notebook Gigabyte Aero 15 Intel Core i7 16GB 512GB", 3000000, "gc"),
  fila("Auriculares Soundcore Aero Clip 2 by Anker Bluetooth", 180000, "cg"),
  fila("Auriculares Soundcore Aero Clip Open-Ear Inalambricos", 170000, "mx"),
  fila("Auriculares Soundcore Aero Clip 2 Bluetooth 32 horas", 190000, "gc"),
];

function app(productos, hist = [], hash = "#veredicto") {
  const almacen = { hist2: JSON.stringify(hist) };
  const vista = { dataset: {}, innerHTML: "", setAttribute() {} };
  const doc = { querySelector: s => (s === "#vista" ? vista : { dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const ctx = GP.contexto(leer("index.html"), leer, { document: doc, setTimeout() {}, clearTimeout() {}, location: { hash, search: "", pathname: "/", origin: "" },
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = v; } } });
  ctx.__idx = { generado: "2026-10-23T10:00-03:00", tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, gc: { nombre: "Gaming City", color: "gc" } }, productos };
  vm.runInContext("IDX = __idx", ctx);
  return { correr: c => vm.runInContext(c, ctx), vista, almacen };
}
const esperar = () => new Promise(r => setImmediate(r));

test("el Veredicto usa lo ultimo que escribiste aunque el historial tenga un fragmento viejo", async () => {
  const { correr, vista } = app(AERO, [{ q: "aero", t: Date.now() - 1000 }]);
  correr('ULTIMA_ESCRITA = "aero clip 2"');
  correr('abrirReciente("veredicto")');
  await esperar();
  assert.match(vista.innerHTML, /Veredicto: aero clip 2/);
  assert.doesNotMatch(vista.innerHTML, /Veredicto: aero</);
});

test("al abrir el Veredicto la ultima busqueda queda en el historial sin esperar al temporizador", async () => {
  const { correr, almacen } = app(AERO, [{ q: "aero", t: Date.now() - 1000 }]);
  correr('ULTIMA_ESCRITA = "aero clip 2"');
  correr('abrirReciente("veredicto")');
  await esperar();
  assert.deepEqual(JSON.parse(almacen.hist2).map(h => h.q), ["aero clip 2"], "y el fragmento «aero» se reemplaza");
});

test("si la ultima busqueda no tiene resultados lo dice y ofrece la anterior, en vez de mostrar otro veredicto", async () => {
  const { correr, vista } = app(AERO, [{ q: "aero clip 2", t: Date.now() - 500000 }]);
  correr('ULTIMA_ESCRITA = "zzz inexistente"');
  correr('abrirReciente("veredicto")');
  await esperar();
  assert.match(vista.innerHTML, /zzz inexistente/);
  assert.match(vista.innerHTML, /no tiene avisos comparables/);
  assert.match(vista.innerHTML, /data-comparar="aero clip 2"/);
  assert.doesNotMatch(vista.innerHTML, /Veredicto: /);
});

test("sin ninguna busqueda escrita, el Veredicto sigue usando el historial como antes", async () => {
  const { correr, vista } = app(AERO, [{ q: "aero clip 2", t: 1 }]);
  correr('abrirReciente("veredicto")');
  await esperar();
  assert.match(vista.innerHTML, /Veredicto: aero clip 2/);
});

test("los fragmentos tipeados («aero» antes de «aeroclip 2») no se acumulan en el historial", () => {
  const { correr, almacen } = app(AERO, [{ q: "aero", t: Date.now() - 2000 }, { q: "ssd 1tb", t: Date.now() - 90000 }]);
  correr('guardarHist("aeroclip 2")');
  assert.deepEqual(JSON.parse(almacen.hist2).map(h => h.q), ["aeroclip 2", "ssd 1tb"]);
  // una busqueda vieja que casualmente es prefijo (hace horas) si se conserva
  const otro = app(AERO, [{ q: "aero", t: Date.now() - 5 * 3600 * 1000 }]);
  otro.correr('guardarHist("aeroclip 2")');
  assert.deepEqual(JSON.parse(otro.almacen.hist2).map(h => h.q), ["aeroclip 2", "aero"]);
});

test("borrar las busquedas vacia tambien la ultima escrita", () => {
  const { correr } = app(AERO);
  correr('fijarConsulta("aeroclip 2")');
  correr("borrarHistorial()");
  assert.equal(correr("ULTIMA_ESCRITA"), "");
});

test("«aero» junta notebooks y auriculares: lo dice y deja elegir un tipo", () => {
  const { correr } = app(AERO);
  correr('fijarConsulta("aero")');
  const a = correr("ANALISIS");
  assert.deepEqual([...a.mezcla].map(c => c.categoria).sort(), ["auricular", "notebook"]);
  const html = correr("bannerConsulta()");
  assert.match(html, /tipos distintos/);
  assert.match(html, /data-solo-categoria="auricular"/);
  assert.match(html, /data-solo-categoria="notebook"/);
});

test("elegir «Auriculares» deja solo auriculares y lo dice, con salida para ver todo", () => {
  const { correr } = app(AERO);
  correr('fijarConsulta("aero", null, { categoria: "auricular" })');
  const a = correr("ANALISIS");
  assert.ok([...a.base].every(m => /Auriculares/.test(m.f[0])));
  assert.equal(a.excl.tipo, 3, "los 3 notebooks quedan afuera como otro tipo de producto");
  const html = correr("bannerConsulta()");
  assert.match(html, /Mostrando solo <b>auriculares<\/b>/);
  assert.match(html, /data-solo-categoria=""/);
});

test("una busqueda de un solo tipo no ofrece elegir", () => {
  const { correr } = app(AERO);
  correr('fijarConsulta("soundcore")');
  assert.equal(correr("ANALISIS.mezcla"), null);
  assert.doesNotMatch(correr("bannerConsulta()"), /tipos distintos/);
});

test("los textos de exclusion hablan del producto: lo caro de unos auriculares no son «equipos completos»", () => {
  const ex = { equipos: 6, caros: 17 };
  assert.deepEqual(A.partesExclusion(ex, "notebook"), ["6 equipos completos (notebooks, PCs, combos)", "17 que cuestan más del triple (suelen ser equipos completos)"]);
  assert.deepEqual(A.partesExclusion(ex), A.partesExclusion(ex, "componente"), "sin categoria queda como siempre");
  const aur = A.partesExclusion(ex, "auricular");
  assert.equal(aur[0], "6 equipos completos (notebooks, PCs, combos)", "los notebooks que quedan afuera siguen siendo equipos");
  assert.match(aur[1], /packs, lotes o un modelo de otra gama/);
});

test("el Veredicto de auriculares no dice que lo caro son «equipos completos»", () => {
  const prod = [...AERO.slice(3), fila("Auriculares Soundcore Aero Clip Pack x10 Mayorista", 5000000, "cg")];
  const { correr } = app(prod);
  correr('fijarConsulta("soundcore")');
  const html = correr("vistaVeredictoDin()");
  assert.match(html, /packs, lotes o un modelo de otra gama/);
  assert.doesNotMatch(html, /equipos completos que solo mencionan/);
});

test("el Veredicto dice que especificaciones tiene y cuales no dice el aviso de la mejor compra", () => {
  const { correr } = app([
    fila("Notebook Lenovo IdeaPad AMD Ryzen 7 5700U 16GB 512GB SSD", 900000, "cg"),
    fila("Notebook HP 250 G9 16GB 512GB SSD", 800000, "mx"),
    fila("Notebook Asus Vivobook Intel Core i5 1235U 16GB 512GB SSD", 1000000, "gc"),
  ]);
  correr('fijarConsulta("notebook")');
  const html = correr("vistaVeredictoDin()");
  assert.match(html, /Qué dice \(y qué no\) el aviso de la mejor compra/);
  assert.match(html, /Dice: .*ram 16 GB/);
  assert.match(html, /No dice: .*gráficos/);
});
