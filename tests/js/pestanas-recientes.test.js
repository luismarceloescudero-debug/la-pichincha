/* Spec 021: sin una busqueda activa, Comparativa y Veredicto salen de lo que la persona busco hace poco, no del analisis
   curado del primer relevamiento (memorias DDR4 y webcams). Tiendas pasa a ser una seccion de la Comparativa. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const GP = require("../../generar_portada.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");

const fila = (nombre, precio, tienda, modelo = "") =>
  [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", "", modelo];
const SSDS = [
  fila("Disco Solido SSD Kingston NV2 1TB M.2 SNV2S/1000G", 50000, "cg", "SNV2S/1000G"),
  fila("Disco Solido SSD Kingston NV2 1TB M.2 SNV2S/1000G", 65000, "mx", "SNV2S/1000G"),
  fila("Disco Solido SSD Hiksemi Wave 1TB SATA", 60000, "cg"),
  fila("Disco Solido SSD Western Digital Green 1TB SATA", 70000, "gc"),
  fila("Disco Solido SSD Adata SU650 1TB SATA", 75000, "cg"),
  fila("Disco Solido SSD Crucial P3 1TB M.2 NVMe", 99000, "mx"),
];

/* La pagina cargada en Node con un historial de busquedas (lo mas nuevo primero, como lo guarda guardarHist). */
function app(hist = [], { conIndice = true } = {}) {
  const almacen = { hist2: JSON.stringify(hist) };
  const doc = { querySelector: () => ({ dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const ctx = GP.contexto(leer("index.html"), leer, { document: doc, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = v; } } });
  const correr = codigo => vm.runInContext(codigo, ctx);
  if (conIndice) {
    ctx.__idx = { generado: "2026-10-23T10:00-03:00",
      tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, gc: { nombre: "Gaming City", color: "gc" } },
      productos: SSDS };
    correr("IDX = __idx");
  }
  return { correr, almacen };
}

test("las pestañas ya no traen Tiendas: es una sección de la Comparativa", () => {
  const { correr } = app();
  const tabs = correr('pestanasHtml("comparativa")');
  assert.equal((tabs.match(/class="tab"/g) || []).length, 5);
  assert.doesNotMatch(tabs, /data-ir="tiendas"/);
  assert.deepEqual([...correr("DINAMICAS")], ["comparativa", "veredicto"]);
});

test("la Comparativa sin búsqueda no muestra el análisis curado de memorias y webcams", () => {
  const { correr } = app();
  const html = correr("vistaComparativa()");
  assert.doesNotMatch(html, /Memorias DDR4 16GB/);
  assert.doesNotMatch(html, /análisis a fondo/);
  assert.doesNotMatch(html, /data-abrir=/);              // ninguna tarjeta curada
  assert.match(html, /id="reciente"/);                   // el lugar de la última búsqueda
});

test("la tira sin historial no ofrece las comparaciones curadas", () => {
  const { correr } = app();
  const html = correr("tiraHtml(false)");
  assert.doesNotMatch(html, /data-cat=/);
  assert.match(html, /Tus búsquedas van a aparecer acá/);
  assert.doesNotMatch(html, /data-borrar-hist/);         // sin búsquedas no hay nada que borrar
});

test("con historial, la tira trae solo tus búsquedas y el botón para borrarlas", () => {
  const { correr } = app([{ q: "ssd 1tb", t: 2 }, { q: "monitor 27", t: 1 }]);
  const html = correr("tiraHtml(false)");
  assert.doesNotMatch(html, /data-cat=/);
  assert.match(html, /data-comparar="ssd 1tb"/);
  assert.match(html, /data-borrar-hist/);
});

test("la búsqueda reciente es la más nueva que todavía trae resultados", () => {
  const { correr } = app([{ q: "zzz inexistente", t: 3 }, { q: "ssd 1tb", t: 2 }, { q: "hiksemi", t: 1 }]);
  assert.equal(correr("consultaReciente()"), "ssd 1tb");
});

test("sin historial, la búsqueda reciente es la primera de lo más buscado que trae resultados", () => {
  const { correr } = app();
  correr('BUSCADAS = ["notebook gamer", "ssd 1tb"]');
  assert.equal(correr("consultaReciente()"), "ssd 1tb");
});

test("sin índice cargado no hay búsqueda reciente (se espera al índice)", () => {
  const { correr } = app([{ q: "ssd 1tb", t: 1 }], { conIndice: false });
  assert.equal(correr("consultaReciente()"), "");
});

test("la Comparativa de una búsqueda incluye dónde conviene comprar (lo que era la pestaña Tiendas)", () => {
  const { correr } = app();
  correr('fijarConsulta("ssd 1tb")');
  const html = correr("vistaComparativaDin()");
  assert.match(html, /id="donde-comprar"/);
  assert.match(html, /Dónde conviene comprar/);
  assert.match(html, /CompraGamer/);
  assert.doesNotMatch(html, /Ver el análisis curado/);
});

test("el bloque de la última búsqueda muestra sus opciones y abre la comparativa completa", () => {
  const { correr } = app([{ q: "ssd 1tb", t: 1 }]);
  const html = correr('recienteHtml("ssd 1tb")');
  assert.match(html, /Tu última búsqueda/);
  assert.match(html, /class="dcard /);
  assert.match(html, /data-comparar="ssd 1tb"/);
  assert.equal(correr("CONSULTA"), "");                  // mirarla no fija la consulta ni cambia las pestañas
});

test("el Veredicto sin ninguna búsqueda invita a buscar en vez de repetir el relevamiento viejo", () => {
  const { correr } = app();
  const html = correr("vistaVeredicto()");
  assert.doesNotMatch(html, /ADATA|Kingston|Combo RAM/);
  assert.match(html, /data-ir-vista="buscar"/);
});

test("borrar el historial lo deja vacío y suelta la consulta activa", () => {
  const { correr, almacen } = app([{ q: "ssd 1tb", t: 1 }]);
  correr('fijarConsulta("ssd 1tb")');
  correr("borrarHistorial()");
  assert.deepEqual(JSON.parse(almacen.hist2), []);
  assert.equal(correr("CONSULTA"), "");
});

test("el animalito que se come las búsquedas sale de una lista y respeta el movimiento reducido", () => {
  const { correr } = app();
  const comilones = [...correr("COMILONES")];
  assert.ok(comilones.length >= 3);
  assert.ok(comilones.every(c => typeof c.clase === "string" && typeof c.eti === "string"));
  assert.equal(correr("comilonDe(0).clase"), comilones[0].clase);
  assert.equal(correr(`comilonDe(${comilones.length})`).clase, comilones[0].clase);   // da la vuelta
});
