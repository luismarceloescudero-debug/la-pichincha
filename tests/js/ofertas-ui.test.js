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

test("una tarjeta se abre con un botón que dice si está abierta y la estrella dice si está marcada", () => {
  const { correr, els } = pagina([fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 130000)]);
  correr("pintarOfertas()");
  const html = els["#resOf"].innerHTML;
  assert.doesNotMatch(html, /<article[^>]*tabindex/, "la tarjeta no es un foco sin rol: el foco va al botón del nombre");
  const [, id] = /<h3 class="o-nom"><button type="button" class="o-abrir" aria-expanded="false" aria-controls="(od-\d+)">/.exec(html) || [];
  assert.ok(id, "el nombre es el botón que abre la tarjeta");
  assert.match(html, new RegExp(`<div class="o-detalle" id="${id}">`), "y controla el detalle");
  assert.match(html, /class="o-star" [^>]*aria-pressed="false"/);

  const atributos = {}, clases = new Set();
  const boton = { setAttribute: (k, v) => { atributos[k] = v; } };
  const tarjeta = { classList: { toggle: c => (clases.has(c) ? (clases.delete(c), false) : (clases.add(c), true)) }, querySelector: () => boton };
  assert.strictEqual(correr("alternarOferta")(tarjeta), true);
  assert.strictEqual(atributos["aria-expanded"], "true");
  assert.strictEqual(correr("alternarOferta")(tarjeta), false);
  assert.strictEqual(atributos["aria-expanded"], "false");
});

test("el detalle cerrado no se lee y el foco del botón resalta la tarjeta", () => {
  const css = leer("css/sitio.css");
  assert.match(css, /\.o-detalle>\.o-in\{[^}]*visibility:hidden/);
  assert.match(css, /\.ocard\.abierta \.o-detalle>\.o-in\{visibility:visible\}/);
  assert.match(css, /\.ocard:has\(\.o-abrir:focus-visible\)/);
  assert.match(leer("js/indice-ofertas.js"), /btn\.setAttribute\("aria-pressed", String\(ESTRELLAS\.has\(u\)\)\)/);
});

test("jerarquia (spec 055): lo mejor del dia es un bloque solido, lo siguiente pesa mas y el resto queda quieto, con pisos", () => {
  const { correr } = pagina([]);
  // Un dia flojo (todo por debajo de los pisos): nada se disfraza de estrella.
  assert.strictEqual(correr(`cortesDe([0.05, 0.08, 0.1].map(off => ({ off }))); nivelOferta(10)`), "normal");
  // Con descuentos grandes, las ~6 mejores son heroes y las del 20 % siguiente llevan el precio grande.
  correr(`CORTES = cortesDe(Array.from({ length: 30 }, (_, i) => ({ off: (50 - i) / 100 })))`);
  assert.strictEqual(correr("nivelOferta(50)"), "heroe");
  assert.strictEqual(correr("nivelOferta(45)"), "heroe");    // la 6.a mejor es 45 %: el corte de heroe
  assert.strictEqual(correr("nivelOferta(44)"), "fuerte");   // y siguen 4 con el precio grande
  assert.strictEqual(correr("nivelOferta(20)"), "normal");
  const niveles = correr("[50, 49, 48, 47, 46, 45, 44, 43, 30, 21].map(nivelOferta).join()");
  assert.strictEqual(niveles.split("heroe").length - 1, 6);
});

test("jerarquia (spec 055): entre tramos de 8 tarjetas va una banda de color con el rango de lo que sigue, sin tocar los indices", () => {
  const { correr, els } = pagina(Array.from({ length: 10 }, (_, i) => fila(`Memoria Kingston Fury DDR5 ${16 + i}GB 6000MHz`, 100000 - i * 3000, 150000)));
  correr("pintarOfertas()");
  const html = els["#resOf"].innerHTML;
  assert.strictEqual((html.match(/class="o-banda/g) || []).length, 1);   // 10 tarjetas: una banda, antes de la novena
  assert.match(html, /Ahora: (de \d+% a \d+%|\d+%) de descuento/);
  assert.match(html, /aria-hidden="true"><b>/);                          // decorativa: el dato esta en cada tarjeta
  assert.strictEqual((html.match(/data-comparar-oferta="\d+"/g) || []).length, 10);
  assert.match(html, /data-comparar-oferta="9"/);
  assert.match(html, /class="ocard[^"]* n-(heroe|fuerte|normal)/);
});

test("orden (056): «Mayor descuento» ordena toda la lista por descuento, sin volver a empezar con las rebajas publicadas", () => {
  const pub = (nombre, precio, lista) => { const f = fila(nombre, precio, 0); f[5] = lista; return f; };
  const { correr } = pagina([fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 97000, 100000),            // baja propia de 3 %
                             fila("Celular Motorola Edge 50 8GB 256GB", 450000, 500000),                  // baja propia de 10 %
                             pub("Celular Motorola G85 8GB 256GB", 300000, 400000)]);                     // publicada de 25 %
  assert.deepEqual(JSON.parse(correr("JSON.stringify(ofertasFiltradas().map(o => Math.round(o.off * 100)))")), [25, 10]);
  correr("OF.orden = 'precio'");
  assert.deepEqual(JSON.parse(correr("JSON.stringify(ofertasFiltradas().map(o => o.f[1]))")), [300000, 450000]);
});
