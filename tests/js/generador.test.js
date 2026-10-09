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
  const filaMexx = html.split("<tr data-op").slice(1).find(t => t.includes("Hiksemi"));
  assert.match(filaMexx, /precio del 8\/10/);
  const filaCg = html.split("<tr data-op").slice(1).find(t => t.includes("Crucial"));
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

// ---- US2: seguir a la comparativa interactiva y medir los clics ----

function paginaDe(idx, q = "ddr4 16gb") {
  const { ctx, analisis } = armar(idx, q);
  return { ctx, analisis, html: G.renderPagina({ q, slug: G.slugDe ? G.slugDe(q) : q.replace(/ /g, "-") }, analisis, ctx) };
}

test("el boton lleva a la comparativa interactiva de la misma consulta", () => {
  const { html } = paginaDe(IDX);
  assert.match(html, /<a class="acc" href="\.\.\/\.\.\/\?q=ddr4\+16gb#comparativa">Ver la comparativa completa<\/a>/);
});

test("las paginas cargan GoatCounter y cada enlace a una tienda lleva su rubro", () => {
  const { html } = paginaDe(IDX);
  assert.match(html, /<script id="gc" data-goatcounter="https:\/\/mescudero\.goatcounter\.com\/count" async src="https:\/\/gc\.zgo\.at\/count\.js"><\/script>/);
  assert.match(html, /<script src="\.\.\/\.\.\/js\/pagina\.js"><\/script>/);
  const enlaces = html.match(/<a href="https:\/\/t\.test[^>]*>/g) || [];
  assert.ok(enlaces.length >= 5);
  assert.ok(enlaces.every(a => /data-rubro="memoria"/.test(a)), enlaces[0]);
});

test("el clic en una tienda se mide como clic_saliente con su comercio y rubro", () => {
  const vm = require("node:vm");
  const llamadas = [];
  let escuchar = null;
  const ventana = { goatcounter: { count: e => llamadas.push(e) }, Pagina: require("../../js/pagina.js") };
  const documento = { addEventListener: (tipo, fn) => { if (tipo === "click") escuchar = fn; } };
  vm.runInNewContext(G.SCRIPT_MEDICION, { window: ventana, document: documento, Pagina: ventana.Pagina });
  const enlace = { href: "https://www.mexx.com.ar/p.html", dataset: { rubro: "memoria" } };
  escuchar({ target: { closest: sel => sel === "a[data-rubro]" ? enlace : null } });
  escuchar({ target: { closest: () => null } });                       // un clic que no es en una tienda
  assert.deepEqual(llamadas, [{ path: "clic_saliente/mexx.com.ar/memoria", title: "mexx.com.ar", event: true }]);
});

test("sin GoatCounter cargado el clic no rompe nada", () => {
  const vm = require("node:vm");
  let escuchar = null;
  vm.runInNewContext(G.SCRIPT_MEDICION, { window: { Pagina: require("../../js/pagina.js") },
    document: { addEventListener: (t, fn) => { escuchar = fn; } }, Pagina: require("../../js/pagina.js") });
  assert.doesNotThrow(() => escuchar({ target: { closest: () => ({ href: "https://a.com.ar/x", dataset: { rubro: "x" } }) } }));
});

// ---- US3: que los buscadores entiendan la pagina ----

function jsonld(html) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, "falta el JSON-LD");
  return JSON.parse(m[1]);
}

test("el JSON-LD trae ItemList, el rango de precios en ARS y las migas", () => {
  const { html, analisis } = paginaDe(IDX);
  const grafo = jsonld(html)["@graph"];
  const tipo = t => grafo.find(n => n["@type"] === t);
  const lista = tipo("ItemList");
  assert.equal(lista.numberOfItems, 5);
  assert.equal(lista.itemListElement.length, 5);
  const primero = lista.itemListElement[0];
  assert.equal(primero.position, 1);
  // La Pichincha no vende: un Product con Offer por tienda es una "ficha de comerciante" para Google
  // (pide imagen, envio y devoluciones). Cada item es solo un ListItem con nombre y enlace.
  assert.equal(primero["@type"], "ListItem");
  assert.equal(typeof primero.name, "string");
  assert.match(primero.url, /^https?:\/\//);
  assert.equal(primero.item, undefined, "sin Product anidado");
  assert.ok(!JSON.stringify(lista).includes('"Offer"'), "ninguna Offer individual");
  assert.ok(!JSON.stringify(lista).includes('"Product"'), "ningun Product individual");
  const producto = tipo("Product");
  const oferta = producto.offers;
  assert.equal(oferta["@type"], "AggregateOffer");
  assert.deepEqual([oferta.lowPrice, oferta.highPrice, oferta.offerCount, oferta.priceCurrency], [900, 1100, 5, "ARS"]);
  const migas = tipo("BreadcrumbList").itemListElement.map(e => e.name);
  assert.deepEqual(migas, ["La Pichincha", "Precios", "ddr4 16gb"]);
});

test("el JSON-LD escapa lo que podria cerrar el script", () => {
  const raro = { ...IDX, productos: IDX.productos.map(f => [...f]) };
  raro.productos[4][0] = "Memoria </script><script>alert(1)</script> DDR4 16GB 3200MHz";
  const { html } = paginaDe(raro);
  const crudo = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  assert.ok(!crudo.includes("</script"));
  assert.ok(JSON.stringify(JSON.parse(crudo)).includes("alert(1)"), "el texto sigue estando, escapado");
});

test("titulo, descripcion, canonica y social son propios de la pagina", () => {
  const { html } = paginaDe(IDX);
  assert.match(html, /<title>ddr4 16gb: precios desde \$900 \| La Pichincha<\/title>/);
  // Un titulo muy largo se corta en Google: aun con una consulta larga y un precio de siete cifras entra.
  const larga = { ...IDX, productos: IDX.productos.map(f => [f[0], f[1] * 100000, ...f.slice(2)]) };
  const largo = paginaDe(larga, "memoria ddr4 16gb 3200mhz");
  assert.match(largo.html, /<tr data-op/, "la consulta larga tiene que dar una pagina completa");
  const titulo = (largo.html.match(/<title>(.*?)<\/title>/) || [])[1] || "";
  assert.ok(titulo.length <= 70, titulo.length + ": " + titulo);
  assert.match(html, /<meta name="description" content="5 opciones de ddr4 16gb en 2 comercios: desde \$900, mediana \$1\.000\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/precios\/ddr4-16gb\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/ejemplo\.test\/la-pichincha\/img\/og\.png">/);
});

// ---- US4: el indice /precios/ enlaza todas las paginas indexables ----

test("el indice de consultas enlaza cada pagina, agrupada, con su precio desde", () => {
  const { ctx } = armar(IDX, "ddr4 16gb");
  const html = G.renderIndice([
    { q: "ssd 1tb", slug: "ssd-1tb", grupo: "Almacenamiento", desde: 204250, comparables: 28 },
    { q: "ddr4 16gb", slug: "ddr4-16gb", grupo: "Memorias", desde: 900, comparables: 5 },
    { q: "ssd 2tb", slug: "ssd-2tb", grupo: "Almacenamiento", desde: 400000, comparables: 16 },
  ], ctx);
  assert.match(html, /<h1>Precios de hardware en Argentina<\/h1>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/precios\/">/);
  assert.match(html, /<link rel="stylesheet" href="\.\.\/css\/sitio\.css">/);
  assert.match(html, /<a href="ssd-1tb\/">ssd 1tb<\/a>[^<]*<span[^>]*>desde \$204\.250/);
  assert.ok(html.indexOf("Almacenamiento") < html.indexOf("ssd-1tb/") && html.indexOf("ssd-2tb/") < html.indexOf("Memorias"),
    "las del mismo grupo van juntas");
  assert.doesNotMatch(html, /noindex/);
  assert.match(html, /<a href="\.\.\/">/, "vuelve a la pagina principal");
});

test("el indice sin paginas no inventa enlaces", () => {
  const { ctx } = armar(IDX, "ddr4 16gb");
  const html = G.renderIndice([], ctx);
  assert.doesNotMatch(html, /<li>/);
  assert.match(html, /todav[ií]a no hay/i);
});

test("el JSON-LD lleva la fecha de los precios que no se pudieron verificar (FR-017)", () => {
  const { html } = paginaDe(IDX);
  const items = jsonld(html)["@graph"].find(n => n["@type"] === "ItemList").itemListElement;
  const mexx = items.filter(i => /Hiksemi|Otra Marca/.test(i.name));
  assert.equal(mexx.length, 2);
  for (const i of mexx) assert.equal(i.description, "precio del 8/10");
  const cg = items.filter(i => /Kingston|Adata|Crucial/.test(i.name));
  for (const i of cg) assert.equal(i.description, undefined, "los de hoy no llevan aviso");
});

test("un aviso con una URL que no es http(s) no se enlaza ni va al JSON-LD", () => {
  const malo = { ...IDX, productos: IDX.productos.map(f => [...f]) };
  malo.productos[4][2] = "javascript:alert(1)";
  const { html } = paginaDe(malo);
  assert.doesNotMatch(html, /javascript:/);
  assert.equal((html.match(/<tr data-op/g) || []).length, 5, "el aviso sigue en la tabla, sin enlace");
  const items = jsonld(html)["@graph"].find(n => n["@type"] === "ItemList").itemListElement;
  assert.ok(items.every(e => /^https?:\/\//.test(e.url)));
});

// ---- App instalable: las paginas por busqueda tambien son parte de la app ----

test("las paginas y el indice enlazan el manifiesto, los colores y el icono con su ruta relativa", () => {
  const { html } = paginaDe(IDX);
  assert.match(html, /<link rel="manifest" href="\.\.\/\.\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="\.\.\/\.\.\/img\/apple-touch-icon\.png">/);
  assert.match(html, /<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)">/);
  const { ctx } = armar(IDX, "ddr4 16gb");
  const hub = G.renderIndice([], ctx);
  assert.match(hub, /<link rel="manifest" href="\.\.\/manifest\.webmanifest">/);
  assert.doesNotMatch(html + hub, /beforeinstallprompt/);
});

test("las paginas y el indice llevan el aviso de sin conexion con la fecha de sus precios", () => {
  const { html } = paginaDe(IDX);
  assert.match(html, /<div id="sin-red" class="sin-red" role="status" hidden><\/div>/);
  assert.match(html, /<script src="\.\.\/\.\.\/js\/app\.js"><\/script>/);
  assert.match(html, /App\.iniciar\(window, document, \{ sw: "\.\.\/\.\.\/sw\.js", sonda: "\.\.\/\.\.\/manifest\.webmanifest", generado: \(\) => "2026-10-09T08:12-03:00" \}\)/);
  const { ctx } = armar(IDX, "ddr4 16gb");
  const hub = G.renderIndice([], ctx);
  assert.match(hub, /<div id="sin-red" class="sin-red" role="status" hidden><\/div>/);
  assert.match(hub, /App\.iniciar\(window, document, \{ sw: "\.\.\/sw\.js", sonda: "\.\.\/manifest\.webmanifest", generado: \(\) => "2026-10-09T08:12-03:00" \}\)/);
});

test("la pagina sin opciones tambien se puede ver sin conexion con su aviso", () => {
  const { ctx } = armar(IDX, "zzzxxy");
  const html = G.renderPagina({ q: "zzzxxy", slug: "zzzxxy" }, null, ctx);
  assert.match(html, /<div id="sin-red"/);
  assert.match(html, /App\.iniciar\(/);
});

test("las fuentes de Google no bloquean los scripts de la pagina ni del indice", () => {
  const { html } = paginaDe(IDX);
  const { ctx } = armar(IDX, "ddr4 16gb");
  for (const h of [html, G.renderIndice([], ctx)]) {
    const enlaces = h.match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g) || [];
    assert.equal(enlaces.length, 2, "uno con media=print y su version noscript");
    assert.match(enlaces[0], /media="print" onload="this\.media='all'"/);
    assert.match(h, /<noscript><link[^>]*fonts\.googleapis\.com\/css2[^>]*><\/noscript>/);
  }
});

test("la fecha que va dentro del script inline sale escapada, como el JSON-LD", () => {
  const raro = { ...IDX, generado: "2026-10-09T08:12</script><script>alert(1)//" };
  const { html } = paginaDe(raro);
  assert.ok(!html.includes("</script><script>alert(1)"), "el texto crudo cerraria el script y abriria otro");
  assert.ok(html.includes("alert(1)"), "el texto sigue estando, escapado");
});

test("el unico precio que declara la pagina es el rango de la comparacion, con imagen", () => {
  const { html } = paginaDe(IDX);
  const grafo = jsonld(html)["@graph"];
  const productos = grafo.filter(n => n["@type"] === "Product");
  assert.equal(productos.length, 1, "un solo Product: la consulta, no cada tienda");
  assert.equal(productos[0].offers["@type"], "AggregateOffer");
  assert.match(productos[0].image, /^https:\/\/.*\.png$/, "Product siempre con image");
  assert.equal(grafo.flatMap(n => JSON.stringify(n).match(/"@type":"Offer"/g) || []).length, 0);
});

test("un producto que dos tiendas venden con el mismo codigo sale una vez, con la otra tienda al lado", () => {
  const COD = "KF432C16BB1/16";
  const conCodigo = (nombre, precio, tienda) => [...fila(nombre, precio, tienda), COD];
  const idx = { ...IDX, productos: [
    ...IDX.productos.filter(f => !f[0].includes("Fury")),
    conCodigo("Memoria Kingston Fury DDR4 16GB 3200MHz KF432C16BB1/16", 1000, "cg"),
    conCodigo("MEMORIA 16GB DDR4 3200 KINGSTON KF432C16BB1/16", 950, "mx"),
  ] };
  const { ctx, analisis } = armar(idx, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  const filas = html.match(/<tr data-op/g) || [];
  assert.equal(filas.length, 5, "5 productos, aunque son 6 avisos comparables");
  assert.match(html, /También en[^<]*(<a[^>]*>[^<]*Mexx|<a[^>]*>[^<]*CompraGamer)/);
  assert.match(html, /5 productos en 6 avisos/);
  assert.ok(!html.includes("Memoria Kingston Fury DDR4 16GB 3200MHz KF432C16BB1/16"), "el aviso de la otra tienda no se repite como fila");
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const lista = ld["@graph"].find(x => x["@type"] === "ItemList");
  assert.equal(lista.numberOfItems, 5);
});

test("sin codigos repetidos la pagina queda como siempre", () => {
  const { ctx, analisis } = armar(IDX, "ddr4 16gb");
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  assert.ok(!html.includes("También en"));
  assert.ok(!/productos en \d+ avisos/.test(html));
});
