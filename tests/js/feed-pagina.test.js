/* Feed RSS por pagina de busqueda: /precios/<slug>/feed.xml (specs/001-paginas-por-busqueda, FR-018). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), os = require("os"), path = require("path");
const A = require("../../js/analisis.js");
const G = require("../../generar_paginas.js");

// Fila del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos]
const fila = (nombre, precio, tienda = "cg", sellos = "", antes = 0) =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", 0, antes, "", sellos];

const BASE = "https://ejemplo.test/la-pichincha";
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
const C = { q: "ddr4 16gb", slug: "ddr4-16gb" };

function armar(idx, q = C.q) {
  const ctx = G.crearContexto(idx, { baseUrl: BASE, marcas: { primera: ["kingston", "crucial"], conocida: ["adata", "hiksemi"] } });
  return { ctx, analisis: A.analizarConsulta(q, ctx) };
}

test("cada pagina indexable anuncia su feed en el head, ademas del global", () => {
  const { ctx, analisis } = armar(IDX);
  const html = G.renderPagina(C, analisis, ctx);
  assert.match(html, /<link rel="alternate" type="application\/rss\+xml" title="[^"]*DDR4 16GB[^"]*" href="https:\/\/ejemplo\.test\/la-pichincha\/precios\/ddr4-16gb\/feed\.xml">/);
  assert.match(html, /href="https:\/\/ejemplo\.test\/la-pichincha\/ofertas\.xml"/);
});

test("la pagina fina, la que no tiene resultados y el indice /precios/ no anuncian feed por busqueda", () => {
  const pocas = { ...IDX, productos: IDX.productos.slice(0, 3) };
  const { ctx, analisis } = armar(pocas);
  assert.doesNotMatch(G.renderPagina(C, analisis, ctx), /feed\.xml/);
  assert.equal(G.renderFeedPagina(C, analisis, ctx), null);
  assert.equal(G.renderFeedPagina({ q: "zzz", slug: "zzz" }, null, ctx), null);
  assert.doesNotMatch(G.renderIndice([], ctx), /feed\.xml/);
});

test("el feed es un RSS 2.0 con el canal apuntando a la pagina y la hora de los precios", () => {
  const { ctx, analisis } = armar(IDX);
  const xml = G.renderFeedPagina(C, analisis, ctx);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<title>La Pichincha: DDR4 16GB<\/title>/);
  assert.match(xml, /<link>https:\/\/ejemplo\.test\/la-pichincha\/precios\/ddr4-16gb\/<\/link>/);
  assert.match(xml, /<atom:link href="https:\/\/ejemplo\.test\/la-pichincha\/precios\/ddr4-16gb\/feed\.xml" rel="self" type="application\/rss\+xml"\/>/);
  assert.match(xml, /<language>es-AR<\/language>/);
  assert.match(xml, /<lastBuildDate>Fri, 09 Oct 2026 11:12:00 GMT<\/lastBuildDate>/);
});

test("lista las comparables con precio, tienda y enlace real: la mejor compra primero y sin internacionales", () => {
  const { ctx, analisis } = armar(IDX);
  const xml = G.renderFeedPagina(C, analisis, ctx);
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  assert.equal(items.length, 5);                         // las 5 comparables; la importada queda afuera
  const mejor = analisis.picks[0].m.f;
  assert.ok(items[0].includes(`<link>${mejor[2]}</link>`), "la mejor compra va primero");
  assert.ok(items[0].includes("Mejor compra"));
  for (const f of analisis.base.map(m => m.f)) {
    const it = items.find(i => i.includes(`<link>${f[2]}</link>`));
    assert.ok(it, "cada comparable con su enlace");
    assert.ok(it.includes("$" + f[1].toLocaleString("es-AR")));
    assert.ok(it.includes(ctx.comercioDe(f)));
  }
  assert.ok(!xml.includes("importada"));
  assert.match(items[0], /<pubDate>Fri, 09 Oct 2026 11:12:00 GMT<\/pubDate>/);
  assert.match(items[0], /Verificá en la tienda antes de comprar/);
});

test("marca la baja de precio y el precio de una fuente sin relevar hoy, y escapa el texto de terceros", () => {
  const { ctx, analisis } = armar(IDX);
  const xml = G.renderFeedPagina(C, analisis, ctx);
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  const adata = items.find(i => i.includes("Adata"));
  assert.match(adata, /−10%/);                           // 900 contra 1000
  assert.match(adata, /Antes \$1\.000/);
  assert.match(items.find(i => i.includes("Hiksemi")), /precio del 8\/10/);
  assert.ok(!xml.includes("<b>DDR4</b>"));
  assert.match(xml, /&lt;b&gt;DDR4&lt;\/b&gt;/);
});

test("trae como mucho 10 entradas y ningun enlace que no sea http(s)", () => {
  const muchas = { ...IDX, productos: [...Array.from({ length: 30 }, (_, i) => fila(`Memoria Kingston ${i} DDR4 16GB`, 1000 + i, i % 2 ? "cg" : "mx")),
    ["Memoria Kingston Malo DDR4 16GB", 1005, "javascript:alert(1)", "cg", "", 0, 0, "", ""]] };
  const { ctx, analisis } = armar(muchas);
  const xml = G.renderFeedPagina(C, analisis, ctx);
  assert.equal((xml.match(/<item>/g) || []).length, 10);
  assert.ok(!xml.includes("javascript:"));
});

test("el guid cambia con el precio: el lector avisa de una entrada nueva solo cuando el precio se movio", () => {
  const { ctx, analisis } = armar(IDX);
  const xml = G.renderFeedPagina(C, analisis, ctx);
  const f = analisis.picks[0].m.f;
  assert.ok(xml.includes(`<guid isPermaLink="false">${f[2]}#${f[1]}</guid>`));
});

test("main escribe feed.xml solo en las paginas indexables", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feedpag-"));
  try {
    const poblado = { ...IDX, productos: [...IDX.productos, fila("Disco Kingston SSD 480GB", 5000)] };
    fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify(poblado));
    fs.writeFileSync(path.join(dir, "consultas.json"), JSON.stringify([
      { q: "ddr4 16gb", nota: "Memoria: x", slug: "ddr4-16gb" }, { q: "ssd 480gb", nota: "SSD: x", slug: "ssd-480gb" }]));
    fs.writeFileSync(path.join(dir, "datos.json"), JSON.stringify({ marcas: {} }));
    const guardar = console.log; console.log = () => {};
    try {
      G.main(["--indice", path.join(dir, "indice.json"), "--consultas", path.join(dir, "consultas.json"),
        "--datos", path.join(dir, "datos.json"), "--salida", path.join(dir, "sitio"), "--base-url", BASE]);
    } finally { console.log = guardar; }
    assert.match(fs.readFileSync(path.join(dir, "sitio", "precios", "ddr4-16gb", "feed.xml"), "utf8"), /<item>/);
    assert.ok(!fs.existsSync(path.join(dir, "sitio", "precios", "ssd-480gb", "feed.xml")));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
