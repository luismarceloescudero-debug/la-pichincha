const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const G = require("../../generar_portada.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const HTML = leer("index.html");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, tienda, sellos = "") =>
  [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", sellos, ""];

/* La pagina de verdad con un DOM minimo y un indice chico: los plus se miran en lo que lidera la comparativa. */
function pagina(productos) {
  const nada = () => null;
  const doc = { querySelector: () => ({ dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: nada, addEventListener() {} };
  const ctx = G.contexto(HTML, leer, { document: doc, setTimeout() {}, clearTimeout() {} });
  ctx.__idx = {
    generado: "2026-10-15T10:00-03:00",
    tiendas: { cy: { nombre: "ComparaYa", color: "cy" }, cg: { nombre: "CompraGamer", color: "cg" } },
    productos,
  };
  const correr = codigo => vm.runInContext(codigo, ctx);
  correr("IDX = __idx");
  correr('fijarConsulta("ssd 1tb")');
  return correr;
}

const SSDS = [
  fila("Disco Solido SSD Kingston NV2 1TB M.2", 80000, "cy", "es"),
  fila("Disco Solido SSD Hiksemi Wave 1TB SATA", 60000, "cg"),
  fila("Disco Solido SSD Western Digital Green 1TB SATA", 70000, "cy", "e"),
  fila("Disco Solido SSD Adata SU650 1TB SATA", 75000, "cg"),
  fila("Disco Solido SSD Crucial P3 1TB M.2 NVMe", 90000, "cy", "s"),
  fila("Disco Solido SSD Samsung 870 EVO 1TB SATA", 95000, "cg"),
];

test("la tarjeta de una opcion que lidera la comparativa muestra su plus", () => {
  const correr = pagina(SSDS);
  const picks = correr("ANALISIS.picks");
  assert.ok(picks.length >= 1);
  const conPlus = picks.map(p => p.m.f).find(f => /e|s/.test(f[8]));
  assert.ok(conPlus, "alguna opcion de las que lideran trae plus");
  const i = picks.findIndex(p => p.m.f === conPlus);
  const html = correr(`cardPick(ANALISIS.picks[${i}], ${i})`);
  const esperado = ["envío gratis", "cuotas sin interés"].filter((t, k) => conPlus[8].includes(["e", "s"][k])).join(" · ");
  assert.ok(html.includes(`<p class="plus">＋ ${esperado}</p>`), html.slice(html.indexOf("razon") - 200, html.indexOf("razon") + 300));
});

test("una opcion sin plus no muestra la linea ni inventa uno", () => {
  const correr = pagina(SSDS);
  const picks = correr("ANALISIS.picks");
  const sin = picks.findIndex(p => !/e|s/.test(p.m.f[8]));
  assert.ok(sin >= 0, "alguna opcion de las que lideran no trae plus");
  assert.doesNotMatch(correr(`cardPick(ANALISIS.picks[${sin}], ${sin})`), /class="plus"/);
});

test("la tabla de las opciones tiene una fila Plus, y un guion no afirma que no lo tenga", () => {
  const correr = pagina(SSDS);
  const tabla = correr("tablaPicks(ANALISIS.picks)");
  assert.match(tabla, /<tr><th>Plus<\/th>/);
  const fila = tabla.slice(tabla.indexOf("<th>Plus</th>"), tabla.indexOf("</tr>", tabla.indexOf("<th>Plus</th>")));
  assert.match(fila, /envío gratis|cuotas sin interés/);
  assert.match(fila, /—/);
  assert.match(tabla, /«—» no es que no lo tenga: la fuente no lo informa/);
});

test("sin ningun plus en las opciones no hay fila ni nota", () => {
  const correr = pagina(SSDS.map(f => [...f.slice(0, 8), "", f[9]]));
  const tabla = correr("tablaPicks(ANALISIS.picks)");
  assert.doesNotMatch(tabla, /<th>Plus<\/th>/);
  assert.doesNotMatch(tabla, /no es que no lo tenga/);
});

test("el plus no cambia el orden de las opciones ni cual es la mejor compra", () => {
  const conPlus = pagina(SSDS)("ANALISIS.picks.map(p => p.m.f[0])");
  const sinPlus = pagina(SSDS.map(f => [...f.slice(0, 8), "", f[9]]))("ANALISIS.picks.map(p => p.m.f[0])");
  assert.deepStrictEqual([...conPlus], [...sinPlus]);
});

test("el enlace a Amazon va rotulado como afiliado, con rel sponsored y el Store ID", () => {
  const correr = pagina([]);
  const h = correr('amazonHtml("UGREEN 65W", "Buscar en Amazon")');
  assert.match(h, /rel="noopener sponsored"/);
  assert.match(h, /enlace de afiliado/);
  assert.match(h, /tag=lapichincha-20/);
  assert.match(h, /href="legal\/#afiliados"/);
  assert.strictEqual(correr('amazonHtml("  ", "x")'), "");
});
