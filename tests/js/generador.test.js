const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");
const A = require("../../js/analisis.js");
const G = require("../../generar_paginas.js");

// Fila del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos]
const fila = (nombre, precio, tienda = "cg", sellos = "", antes = 0) =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", 0, antes, "", sellos];

const IDX = {
  generado: "2026-10-09T08:12-03:00",
  tiendas: {
    cg: { nombre: "CompraGamer", color: "cg", relevado: "2026-10-09T08:12-03:00" },
    mx: { nombre: "Mexx", color: "mx", relevado: "2026-10-08T08:12-03:00" },     // no se relevo hoy
    cy: { nombre: "ComparaYa", color: "cy", relevado: "2026-10-09T08:12-03:00" },
  },
  productos: [
    fila("Memoria Kingston Fury DDR4 16GB 3200MHz", 1000, "cg", "e"),
    fila("Memoria Adata XPG DDR4 16GB 3200MHz", 900, "cg", "", 1000),
    fila("Memoria Hiksemi Hiker DDR4 16GB 3200MHz", 950, "mx"),
    fila("Memoria Crucial DDR4 16GB 3200MHz", 1100, "cg"),
    fila("Memoria Otra Marca <b>DDR4</b> 16GB 3200MHz", 1050, "mx"),
    fila("Memoria Kingston DDR4 16GB 3200MHz importada", 700, "cy", "i"),
  ],
};
const ahora = new Date("2026-10-09T12:00:00-03:00");

function armar(idx, q) {
  const ctx = G.crearContexto(idx, { baseUrl: "https://ejemplo.test/la-pichincha", ahora,
    marcas: { primera: ["kingston", "crucial"], conocida: ["adata", "hiksemi"] } });
  return { ctx, analisis: A.analizarConsulta(q, ctx), html: null };
}

test("la pagina trae todo el contenido en el HTML: titulo, hora, mejor compra, mediana y tabla", () => {
  const { ctx, analisis } = armar(IDX, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  assert.match(html, /<h1>[^<]*ddr4 16gb[^<]*<\/h1>/i);
  assert.match(html, /hoy 09:12|hoy 08:12/);
  assert.ok(html.includes(analisis.picks[0].razon));
  assert.ok(html.includes("$1.000"), "la mediana va con formato de pesos");
  const filas = html.match(/<tr data-op/g) || [];
  assert.equal(filas.length, 5);
  for (const f of analisis.base) {
    assert.ok(html.includes("CompraGamer") && html.includes("Mexx"));
    assert.ok(html.includes(`href="${f.f[2]}"`), "cada opcion enlaza a su aviso");
  }
  assert.ok((html.match(/rel="noopener"/g) || []).length >= 5);
  assert.ok(!html.includes("<b>DDR4</b>"), "el texto de los avisos va escapado");
});

test("la tabla se corta en 20 opciones y dice cuantas mas hay", () => {
  const muchas = { ...IDX, productos: Array.from({ length: 30 }, (_, i) =>
    fila(`Memoria Kingston ${i} DDR4 16GB`, 1000 + i)) };
  const { ctx, analisis } = armar(muchas, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  assert.equal((html.match(/<tr data-op/g) || []).length, 20);
  assert.match(html, /10 opciones m[aá]s/);
});

test("una fuente que no se releva hoy muestra la fecha de su precio", () => {
  const { ctx, analisis } = armar(IDX, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  const filaMexx = html.split("<tr data-op").find(t => t.includes("Hiksemi"));
  assert.match(filaMexx, /precio del 8\/10/);
  const filaCg = html.split("<tr data-op").find(t => t.includes("Crucial"));
  assert.doesNotMatch(filaCg, /precio del/);
});

test("las compras internacionales van aparte, marcadas, y no son la mejor compra", () => {
  const { ctx, analisis } = armar(IDX, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  assert.match(html, /compra internacional/);
  const mejor = html.split("<h2>Mejor compra</h2>")[1].split("</section>")[0];
  assert.doesNotMatch(mejor, /importada/);
  assert.ok(mejor.includes(`href="${analisis.picks[0].m.f[2]}"`), "la seccion tiene el aviso elegido");
  assert.equal((html.match(/<tr data-op/g) || []).length, 5, "no entran a la tabla de comparables");
});

test("con menos de 5 comparables la pagina no es indexable y lo dice", () => {
  const pocas = { ...IDX, productos: IDX.productos.slice(0, 3) };
  const { ctx, analisis } = armar(pocas, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  assert.match(html, /hoy no hay opciones suficientes/i);
  assert.match(html, /<meta name="robots" content="noindex,follow">/);
  assert.match(html, /href="[^"]*\?q=ddr4\+16gb#buscar"/);
  assert.equal(G.esIndexable(analisis), false);
});

test("con 5 o mas comparables es indexable y no lleva noindex", () => {
  const { ctx, analisis } = armar(IDX, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  assert.doesNotMatch(html, /noindex/);
  assert.equal(G.esIndexable(analisis), true);
});

test("una consulta sin resultados tambien es una pagina no indexable", () => {
  const { ctx } = armar(IDX, "zzzxxy");
  const html = G.renderPagina({ q: "zzzxxy", slug: "zzzxxy" }, null, ctx);
  assert.match(html, /hoy no hay opciones suficientes/i);
  assert.match(html, /noindex/);
  assert.equal(G.esIndexable(null), false);
});
