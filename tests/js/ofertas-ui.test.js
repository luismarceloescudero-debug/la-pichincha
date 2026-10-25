const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const G = require("../../generar_portada.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const HTML = leer("index.html");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo, desde]
const fila = (nombre, precio, antes, tienda = "cg") =>
  [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, antes, "", "", "", ""];

/* La pagina de verdad con un DOM minimo: la pestaña Ofertas se pinta sobre un indice chico. */
function pagina(productos) {
  const els = {};
  const el = sel => els[sel] || (els[sel] = { textContent: "", innerHTML: "", dataset: {}, setAttribute() {}, addEventListener() {}, classList: { toggle() {}, add() {}, remove() {} } });
  const doc = { querySelector: el, querySelectorAll: () => [], getElementById: id => el("#" + id), addEventListener() {} };
  const ctx = G.contexto(HTML, leer, { document: doc, setTimeout() {}, clearTimeout() {}, matchMedia: () => ({ matches: true }),
                                     requestAnimationFrame() {}, performance: { now: () => 0 } });
  ctx.__idx = { generado: "2026-10-17T10:00-03:00", campos: ["nombre", "precio", "url", "tienda", "via", "lista", "antes"],
                tiendas: { cg: { nombre: "CompraGamer", color: "cg" } }, historial: { inicio: "2026-10-07" }, productos };
  const correr = codigo => vm.runInContext(codigo, ctx);
  correr("IDX = __idx; OFERTAS = calcularOfertas(IDX)");
  return { correr, els };
}

test("la pestaña Ofertas se pinta con ofertas y dice en que categorias no hubo (sin romperse)", () => {
  const { correr, els } = pagina([fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 130000),
                                  fila("Celular Motorola Edge 50 8GB 256GB", 450000, 520000)]);
  correr("pintarOfertas()");
  assert.match(els["#estadoOf"].textContent, /^2 ofertas/);
  assert.match(els["#estadoOf"].textContent, /hoy sin ofertas en notebooks, monitores, pcs completas/);
  assert.match(els["#resOf"].innerHTML, /class="ocard/);
  assert.match(els["#resOf"].innerHTML, /Smartphones <span class="n">1<\/span>/);       // chip de categoria real, no la primera palabra
});

test("sin ninguna oferta manda a buscar los precios", () => {
  const { correr, els } = pagina([fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 0)]);
  correr("pintarOfertas()");
  assert.match(els["#estadoOf"].textContent, /no hay rebajas en este relevamiento: en Buscar/);
});

test("una URL maliciosa de una tienda no rompe el enlace ni corre codigo", () => {
  const mala = fila("Celular Motorola Edge 50 8GB 256GB", 450000, 520000);
  mala[2] = 'https://x.test/" onmouseover="alert(1)';
  const js = fila("Celular Motorola G85 8GB 256GB", 300000, 360000);
  js[2] = "javascript:alert(1)";
  const { correr, els } = pagina([mala, js]);
  correr("pintarOfertas()");
  const html = els["#resOf"].innerHTML;
  assert.doesNotMatch(html, /onmouseover="alert/);
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.equal(correr('enlace("https://ok.test/a?b=1&c=2")'), "https://ok.test/a?b=1&amp;c=2");
});

test("una imagen con comillas no inyecta CSS en la tarjeta, y la planilla CSV no ejecuta formulas", () => {
  const mala = fila("Celular Motorola Edge 50 8GB 256GB", 450000, 520000);
  mala[7] = 'x");position:fixed;inset:0;z-index:9999;background:url("https://evil.test/p.png';
  const buena = fila("Celular Motorola G85 8GB 256GB", 300000, 360000);
  buena[7] = "https://img.test/g85.jpg";
  const { correr, els } = pagina([mala, buena]);
  correr("pintarOfertas()");
  const html = els["#resOf"].innerHTML;
  assert.doesNotMatch(html, /position:fixed/);
  assert.match(html, /url\(&quot;https:\/\/img\.test\/g85\.jpg&quot;\)/);
  assert.equal(correr('csvCampo("=HYPERLINK(\\"https://evil\\")")'), '"\'=HYPERLINK(""https://evil"")"');
  assert.equal(correr('csvCampo("Memoria 16GB")'), '"Memoria 16GB"');
  assert.equal(correr("esc(\"a'b\")"), "a&#39;b");
  assert.equal(correr('enlace("https://evil\\\\@good.com/x")'), "#");
});

test("la pestaña Ofertas muestra «En seguimiento» aparte, con su propia cinta y su aclaracion, sin mezclarlo con las bajas", () => {
  const seg = fila("Memoria Corsair Vengeance DDR5 32GB 6000MHz", 90000, 120000);
  seg[8] = "k";
  const { correr, els } = pagina([fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 130000), seg]);
  correr("pintarOfertas()");
  const html = els["#resOf"].innerHTML;
  assert.match(html, /data-of="tipo:seguimiento"[^>]*>En seguimiento <span class="n">1<\/span>/);
  assert.match(html, /Bajaron de precio <span class="n">1<\/span>/);
  assert.match(html, /Rebajas publicadas <span class="n">0<\/span>/);
  assert.match(html, /bajó desde que lo seguimos/);
  assert.match(html, /Lo seguimos hace menos de una semana/);
  assert.match(els["#estadoOf"].textContent, /^2 ofertas/);
});
