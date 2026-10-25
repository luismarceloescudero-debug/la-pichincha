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


const ML = "https://www.mercadolibre.com.ar/memoria-kingston/p/MLA45717120";

test("un enlace de Mercado Libre lleva el codigo de afiliado, rel=sponsored y el rotulo; el de otra tienda queda igual", () => {
  const { correr } = pagina([]);
  assert.equal(correr(`hrefTienda("${ML}")`), `${ML}?matt_word=chococuyano&amp;matt_tool=31231658`);
  assert.equal(correr(`relTienda("${ML}")`), "sponsored noopener");
  assert.match(correr(`selloAfiliado("${ML}")`), /class="sello afi"[^>]*>afiliado</);
  const otra = "https://compragamer.com/producto/x?a=1";
  assert.equal(correr(`hrefTienda("${otra}")`), "https://compragamer.com/producto/x?a=1");
  assert.equal(correr(`relTienda("${otra}")`), "noopener");
  assert.equal(correr(`selloAfiliado("${otra}")`), "");
  assert.equal(correr('hrefTienda("javascript:alert(1)")'), "#");
  assert.equal(correr('hrefTienda("https://www.mercadolibre.com.ar.evil.com/p")'), "https://www.mercadolibre.com.ar.evil.com/p");
});

test("la pestaña Ofertas abre Mercado Libre con el codigo de afiliado y lo rotula, sin tocar el orden ni el precio", () => {
  const ml = fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 130000);
  ml[2] = ML;
  const otro = fila("Celular Motorola Edge 50 8GB 256GB", 450000, 520000);
  const { correr, els } = pagina([ml, otro]);
  correr("pintarOfertas()");
  const html = els["#resOf"].innerHTML;
  assert.match(html, /href="https:\/\/www\.mercadolibre\.com\.ar\/memoria-kingston\/p\/MLA45717120\?matt_word=chococuyano&amp;matt_tool=31231658" target="_blank" rel="sponsored noopener"/);
  assert.match(html, /class="sello afi"/);
  assert.equal((html.match(/class="sello afi"/g) || []).length, 1, "solo el de Mercado Libre");
  assert.match(html, /href="https:\/\/cg\.test\/[^"]*" target="_blank" rel="noopener"/);
});
