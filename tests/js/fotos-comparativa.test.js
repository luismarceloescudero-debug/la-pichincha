/* Spec 063, fase E: las tarjetas de la Comparativa muestran la foto del producto. El indice del navegador no trae fotos (spec 057):
   viajan aparte, partidas en rebanadas (imagenes/N.json) que se piden solo para las tarjetas que se ven. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const GP = require("../../generar_portada.js");
const Pagina = require("../../js/pagina.js");
const { adelgazar, main } = require("../../adelgazar_indice.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");

test("la rebanada de una foto es estable y cae siempre dentro de las rebanadas", () => {
  const u = "https://tienda.test/producto/123";
  assert.equal(Pagina.rebanadaFoto(u), Pagina.rebanadaFoto(u));
  for (const x of [u, "", "https://a.test/" + "x".repeat(300)]) {
    const n = Pagina.rebanadaFoto(x);
    assert.ok(Number.isInteger(n) && n >= 0 && n < Pagina.REBANADAS_FOTO, String(n));
  }
});

const IDX = { campos: ["nombre", "precio", "url", "tienda", "via", "lista", "antes", "imagen"], tiendas: {}, generado: "2026-11-01T10:00-03:00",
  productos: Array.from({ length: 200 }, (_, i) => [`Teclado ${i}`, 1000 + i, `https://t.test/p/${i}`, "cg", "", 0, 0, `https://img.test/${i}.jpg`]) };

test("el build parte TODAS las fotos en rebanadas por la direccion del aviso y no las pierde", () => {
  const { rebanadas, indice } = adelgazar(IDX);
  assert.equal(rebanadas.length, Pagina.REBANADAS_FOTO);
  const juntas = Object.assign({}, ...rebanadas);
  assert.equal(Object.keys(juntas).length, 200);
  assert.equal(juntas["https://t.test/p/7"], "https://img.test/7.jpg");
  for (const f of IDX.productos) assert.ok(f[2] in rebanadas[Pagina.rebanadaFoto(f[2])], "cada foto esta en SU rebanada");
  assert.ok(indice.productos.every(f => f[7] === ""), "el indice sigue sin fotos");
});

test("main escribe imagenes/N.json junto a imagenes.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fotos-"));
  const entrada = path.join(dir, "indice.json"), salida = path.join(dir, "_sitio");
  fs.writeFileSync(entrada, JSON.stringify(IDX));
  main(["--indice", entrada, "--salida", salida]);
  assert.ok(fs.existsSync(path.join(salida, "imagenes.json")));
  assert.equal(fs.readdirSync(path.join(salida, "imagenes")).length, Pagina.REBANADAS_FOTO);
  const r = JSON.parse(fs.readFileSync(path.join(salida, "imagenes", Pagina.rebanadaFoto("https://t.test/p/7") + ".json"), "utf8"));
  assert.equal(r["https://t.test/p/7"], "https://img.test/7.jpg");
});

function app(productos, entorno = {}) {
  const ctx = GP.contexto(leer("index.html"), leer, { document: { querySelector: () => ({ dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: () => null, addEventListener() {} },
    setTimeout() {}, clearTimeout() {}, localStorage: { getItem: () => null, setItem() {} }, ...entorno });
  ctx.__idx = { generado: "2026-10-23T10:00-03:00", tiendas: { cg: { nombre: "CompraGamer", color: "cg" } }, productos };
  vm.runInContext("IDX = __idx", ctx);
  return { correr: c => vm.runInContext(c, ctx), ctx };
}
const fila = (n, p, t, img = "") => [n, p, `https://${t}.test/${encodeURIComponent(n)}`, t, "", 0, 0, img, ""];

test("cada tarjeta lleva su espacio de foto con el icono y la direccion del aviso", () => {
  const { correr } = app([fila("Teclado Mecanico Redragon Kumara TKL", 60000, "cg"), fila("Teclado Mecanico Logitech G413 TKL", 90000, "cg")]);
  correr('fijarConsulta("teclado mecanico")');
  const html = correr("vistaComparativaDin()");
  assert.match(html, /<div class="d-img sin-foto" data-foto="https:\/\/cg\.test\/Teclado/);
});

test("si el indice trae la foto (indice completo, tests e2e) la tarjeta la muestra de entrada", () => {
  const { correr } = app([fila("Teclado Mecanico Redragon Kumara TKL", 60000, "cg", "https://img.test/a.jpg"), fila("Teclado Mecanico Logitech G413 TKL", 90000, "cg")]);
  correr('fijarConsulta("teclado mecanico")');
  const html = correr("vistaComparativaDin()");
  assert.match(html, /class="d-img" data-foto="[^"]+" style="background-image:url\(&quot;https:\/\/img\.test\/a\.jpg&quot;\)"/);
});

test("pintarFotos pide solo la rebanada de cada tarjeta y completa la foto; una rebanada caida deja el icono", async () => {
  const url = "https://cg.test/Teclado%201", otra = "https://cg.test/Teclado%202";
  const pedidos = [];
  const mk = u => ({ dataset: { foto: u }, style: {}, isConnected: true, classList: { remove(c) { this.quitada = c; } } });
  const a = mk(url), b = mk(otra);
  const fetchFalso = ruta => { pedidos.push(ruta); return Promise.resolve({ ok: !ruta.endsWith(`/${Pagina.rebanadaFoto(otra)}.json`), json: () => Promise.resolve({ [url]: "https://img.test/1.jpg" }) }); };
  const { correr } = app([], { fetch: fetchFalso, document: { querySelector: () => null, getElementById: () => null, addEventListener() {}, querySelectorAll: s => (s.startsWith("[data-foto]") ? [a, b] : []) } });
  await correr("pintarFotos()");
  assert.equal(a.style.backgroundImage, 'url("https://img.test/1.jpg")');
  assert.equal(a.classList.quitada, "sin-foto");
  assert.equal(b.style.backgroundImage, undefined, "sin foto en la rebanada queda el icono");
  assert.ok(pedidos.length <= 2 && pedidos.every(r => /^imagenes\/\d+\.json$/.test(r)), pedidos.join());
});
