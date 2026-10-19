const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../../generar_feed.js");

const BASE = "https://ejemplo.test/la-pichincha";
const fila = (nombre, precio, { antes = 0, lista = 0, tienda = "cg", via = "", sellos = "", url } = {}) =>
  [nombre, precio, url || "https://t.test/" + encodeURIComponent(nombre), tienda, via, lista, antes, "", sellos, ""];
const IDX = {
  generado: "2026-10-09T08:12-03:00",
  tiendas: { cg: { nombre: "CompraGamer" }, cy: { nombre: "ComparaYa" } },
  productos: [
    fila("SSD Kingston 1TB", 90000, { antes: 120000 }),
    fila("Memoria <b>Fury</b> & \"Beast\" 16GB", 24000, { lista: 30000, tienda: "cy", via: "Frávega" }),
    fila("Sin oferta", 5000),
  ],
};

test("el feed es un RSS 2.0 con el canal, el enlace a si mismo y la hora de los precios", () => {
  const xml = F.renderFeed(IDX, { baseUrl: BASE });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<atom:link href="https:\/\/ejemplo\.test\/la-pichincha\/ofertas\.xml" rel="self" type="application\/rss\+xml"\/>/);
  assert.match(xml, /<link>https:\/\/ejemplo\.test\/la-pichincha\/<\/link>/);
  assert.match(xml, /<language>es-AR<\/language>/);
  assert.match(xml, /<lastBuildDate>Fri, 09 Oct 2026 11:12:00 GMT<\/lastBuildDate>/);
});

test("una entrada por oferta, las bajas propias primero, con precio, descuento, comercio y enlace", () => {
  const xml = F.renderFeed(IDX, { baseUrl: BASE });
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  assert.equal(items.length, 2);
  assert.match(items[0], /<title>SSD Kingston 1TB: \$90\.000 \(−25%\) en CompraGamer<\/title>/);
  assert.match(items[0], /<link>https:\/\/t\.test\/SSD%20Kingston%201TB<\/link>/);
  assert.match(items[0], /Antes \$120\.000, hoy \$90\.000: ahorrás \$30\.000\./);
  assert.match(items[0], /Precios del 09\/10 08:12/);
  assert.match(items[0], /Verificá en la tienda antes de comprar/);
  assert.match(items[0], /<guid isPermaLink="false">https:\/\/t\.test\/SSD%20Kingston%201TB#2026-10-09<\/guid>/);
  assert.match(items[0], /<pubDate>Fri, 09 Oct 2026 11:12:00 GMT<\/pubDate>/);
  assert.match(items[1], /en Frávega/);                  // el comercio de ComparaYa es el real, no el agregador
});

test("todo texto de terceros va escapado y ningun enlace raro entra", () => {
  const idx = { ...IDX, productos: [...IDX.productos, fila("Malo", 1000, { antes: 5000, url: "javascript:alert(1)" })] };
  const xml = F.renderFeed(idx, { baseUrl: BASE });
  assert.ok(!xml.includes("<b>Fury</b>"));
  assert.match(xml, /Memoria &lt;b&gt;Fury&lt;\/b&gt; &amp; &quot;Beast&quot; 16GB/);
  assert.ok(!xml.includes("javascript:"));
});

test("sin ofertas el feed sale igual, vacio y bien formado", () => {
  const xml = F.renderFeed({ ...IDX, productos: [fila("Sin oferta", 5000)] }, { baseUrl: BASE });
  assert.ok(!xml.includes("<item>"));
  assert.match(xml, /<\/channel>\s*<\/rss>\s*$/);
});

test("el feed trae como mucho 20 entradas", () => {
  const muchas = Array.from({ length: 30 }, (_, i) => fila("Producto " + i, 8000 + i, { antes: 10000 }));
  const xml = F.renderFeed({ ...IDX, productos: muchas }, { baseUrl: BASE });
  assert.equal((xml.match(/<item>/g) || []).length, 20);
});

test("la lista para el canal trae lo justo, sin nada de terceros sin escapar", () => {
  const lista = F.listaParaCanal(IDX, 10);
  assert.deepEqual(lista[0], { nombre: "SSD Kingston 1TB", precio: 90000, antes: 120000, descuento: 25,
    comercio: "CompraGamer", url: "https://t.test/SSD%20Kingston%201TB", tipo: "propia", categoria: "Componente", tienda: "cg" });
  assert.equal(lista.length, 2);
  assert.equal(F.listaParaCanal(IDX, 1).length, 1);
});

test("main escribe ofertas.xml y ofertas.json en la carpeta de salida", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify(IDX));
  const salida = path.join(dir, "sitio");
  const guardar = console.log; console.log = () => {};
  try { assert.equal(F.main(["--indice", path.join(dir, "indice.json"), "--salida", salida, "--base-url", BASE + "/"]), 0); }
  finally { console.log = guardar; }
  assert.match(fs.readFileSync(path.join(salida, "ofertas.xml"), "utf8"), /<item>/);
  const j = JSON.parse(fs.readFileSync(path.join(salida, "ofertas.json"), "utf8"));
  assert.equal(j.sitio, BASE + "/");
  assert.equal(j.ofertas.length, 2);
  assert.equal(j.generado, IDX.generado);
  fs.rmSync(dir, { recursive: true });
});

test("sin indice no escribe nada y no falla", () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
  const guardar = console.log; console.log = () => {};
  try { assert.equal(F.main(["--indice", path.join(dir, "no-hay.json"), "--salida", dir]), 0); }
  finally { console.log = guardar; }
  assert.ok(!fs.existsSync(path.join(dir, "ofertas.xml")));
  fs.rmSync(dir, { recursive: true });
});

test("si el indice solo trae la fecha, sin hora, el feed dice solo la fecha", () => {
  const xml = F.renderFeed({ ...IDX, generado: "2026-10-07" }, { baseUrl: BASE });
  assert.match(xml, /Precios del 07\/10\. Verificá/);
  assert.ok(!xml.includes("hora de Argentina"));
});

test("/hoy/ es una pagina para historias: tarjeta 9:16 con las mejores y la lista completa con enlaces", () => {
  const html = F.renderHoy(IDX, { baseUrl: BASE });
  assert.match(html, /<title>Pichinchas del día · 9\/10 \| La Pichincha<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/hoy\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/ejemplo\.test\/la-pichincha\/img\/og\.png">/);
  assert.match(html, /class="historia"/);
  assert.match(html, /precios del 9\/10 08:12/);
  const enlaces = html.match(/<a class="oferta"[^>]*href="https:\/\/t\.test\/[^"]+"/g) || [];
  assert.equal(enlaces.length, 2);                                  // una por oferta, a la tienda
  assert.match(html, /data-rubro="ofertas"/);                        // el clic se mide como los demas
  assert.match(html, /Memoria &lt;b&gt;Fury&lt;\/b&gt; &amp; &quot;Beast&quot; 16GB/);  // texto de terceros escapado
  assert.doesNotMatch(html, /Sin oferta/);
});

test("/hoy/ sin ofertas sale igual, con un aviso y sin lista", () => {
  const html = F.renderHoy({ ...IDX, productos: [] }, { baseUrl: BASE });
  assert.match(html, /Hoy no hay bajas para destacar/);
  assert.doesNotMatch(html, /<a class="oferta"/);
});

test("main escribe hoy/index.html", () => {
  const os = require("os"), fs = require("fs"), path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoy-")), indice = path.join(dir, "indice.json");
  fs.writeFileSync(indice, JSON.stringify(IDX));
  F.main(["--indice", indice, "--salida", dir, "--base-url", BASE]);
  assert.match(fs.readFileSync(path.join(dir, "hoy", "index.html"), "utf8"), /class="historia"/);
});

test("una compra internacional entra al feed, al final de su categoria y rotulada", () => {
  const idx = { ...IDX, productos: [fila("Celular Importado 8GB RAM 256GB", 7000, { antes: 10000, sellos: "i" }), ...IDX.productos] };
  const xml = F.renderFeed(idx, { baseUrl: BASE });
  const items = xml.match(/<item>[\s\S]*?<\/item>/g);
  assert.match(items.find(i => i.includes("Celular Importado")), /Celular Importado.*compra internacional/);
  assert.equal(F.listaParaCanal(idx, 10).find(o => o.nombre.includes("Importado")).comercio.endsWith("compra internacional"), true);
});

test("una oferta de gama alta al precio de la media lo dice en la descripcion del feed", () => {
  const media = Array.from({ length: 8 }, (_, i) => fila(`Celular Moto G${i} 6GB/256GB`, 300000 + i * 1000));
  const idx = { ...IDX, productos: [...media, fila("Celular Samsung Galaxy S26 12GB 256GB", 280000, { antes: 450000 })] };
  assert.match(F.renderFeed(idx, { baseUrl: BASE }), /Gama alta al precio de la gama media \(mediana de los smartphones de gama media de 256 GB: \$[\d.]+ \(8 avisos\)\)/);
});

test("sin las publicaciones caidas: no entran al feed, a /hoy/ ni a la lista del canal, y entra la que sigue", () => {
  const caida = "https://t.test/caida";
  const idx = { ...IDX, productos: [fila("Caida", 70000, { antes: 100000, url: caida }),
                                    fila("Siguiente", 80000, { antes: 100000 }), ...IDX.productos] };
  const sin = F.sinCaidas(idx, [caida]);
  assert.equal(sin.productos.some(f => f[2] === caida), false);
  assert.equal(idx.productos.some(f => f[2] === caida), true);     // el indice original no se toca
  assert.equal(F.listaParaCanal(sin, 10).some(o => o.url === caida), false);
  assert.equal(F.renderFeed(sin, { baseUrl: BASE }).includes("caida"), false);
  assert.equal(F.renderHoy(sin, { baseUrl: BASE }).includes("caida"), false);
  assert.equal(F.listaParaCanal(sin, 10).some(o => o.nombre === "Siguiente"), true);
});

test("sinCaidas sin lista devuelve el mismo indice", () => {
  assert.equal(F.sinCaidas(IDX, []), IDX);
  assert.equal(F.sinCaidas(IDX, undefined), IDX);
});

test("main con --descartadas deja afuera esas publicaciones en los tres archivos", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
  const caida = "https://t.test/caida";
  const idx = { ...IDX, productos: [fila("Caida", 70000, { antes: 100000, url: caida }), ...IDX.productos] };
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify(idx));
  fs.writeFileSync(path.join(dir, "descartadas.json"), JSON.stringify([caida]));
  F.main(["--indice", path.join(dir, "indice.json"), "--salida", path.join(dir, "s"),
          "--descartadas", path.join(dir, "descartadas.json")]);
  for (const f of ["ofertas.xml", "ofertas.json", "hoy/index.html"])
    assert.equal(fs.readFileSync(path.join(dir, "s", f), "utf8").includes("caida"), false, f);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("main sin --descartadas, o con el archivo roto, publica todo como antes", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify(IDX));
  fs.writeFileSync(path.join(dir, "rota.json"), "{no es json");
  F.main(["--indice", path.join(dir, "indice.json"), "--salida", path.join(dir, "s"), "--descartadas", path.join(dir, "rota.json")]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "s", "ofertas.json"), "utf8")).ofertas.length, 2);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("main con --candidatas escribe solo la lista a verificar (hasta --max) y no genera el sitio", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
  const muchas = Array.from({ length: 12 }, (_, i) => fila("Producto " + i, 8000 + i, { antes: 10000 }));
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ ...IDX, productos: muchas }));
  F.main(["--indice", path.join(dir, "indice.json"), "--salida", path.join(dir, "s"),
          "--candidatas", path.join(dir, "c.json"), "--max", "5"]);
  const c = JSON.parse(fs.readFileSync(path.join(dir, "c.json"), "utf8"));
  assert.equal(c.ofertas.length, 5);
  assert.deepEqual(Object.keys(c.ofertas[0]).sort(), ["nombre", "precio", "tienda", "url"]);   // precio y fuente, para verificarla a su manera
  assert.ok(c.ofertas.every(o => o.precio >= 8000 && o.precio < 8012));
  assert.equal(fs.existsSync(path.join(dir, "s")), false);                 // no se armo el sitio
  F.main(["--indice", path.join(dir, "indice.json"), "--salida", path.join(dir, "s"), "--candidatas", path.join(dir, "c2.json")]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "c2.json"), "utf8")).ofertas.length, 12);   // por defecto 40
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--candidatas ya sin las descartadas: la siguiente candidata ocupa el lugar", () => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
  const caida = "https://t.test/caida";
  const idx = { ...IDX, productos: [fila("Caida", 70000, { antes: 100000, url: caida }), fila("Otra", 80000, { antes: 100000 })] };
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify(idx));
  fs.writeFileSync(path.join(dir, "d.json"), JSON.stringify([caida]));
  F.main(["--indice", path.join(dir, "indice.json"), "--descartadas", path.join(dir, "d.json"), "--candidatas", path.join(dir, "c.json")]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "c.json"), "utf8")).ofertas.map(o => o.nombre), ["Otra"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- costo puesto en casa de lo internacional (spec 012) ----
const COSTO_FX = (() => {
  const fs = require("fs"), path = require("path"), M = require("../../js/monedas.js");
  const leerFx = n => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "monedas", n), "utf8"));
  return { reglas: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "importacion.json"), "utf8")),
    tasas: M.normalizar({ dolarapi: leerFx("dolarapi-dolares.json"), erapi: leerFx("erapi-usd.json"), frankfurter: leerFx("frankfurter-usd.json") }) };
})();
const IDX_INTL = { generado: "2026-10-19T08:00-03:00", tiendas: { cg: { nombre: "CompraGamer" } },
  productos: [fila("SSD Kingston 1TB", 90000, { lista: 120000 }),
    (() => { const f = fila("SSD Importado 1TB", 306000, { lista: 450000 }); f[8] = "ie"; return f; })()] };

test("el feed dice el costo puesto en casa de una compra internacional, y solo de ella", () => {
  const xml = F.renderFeed(IDX_INTL, { baseUrl: BASE, costo: COSTO_FX });
  const items = xml.split("<item>").slice(1);
  const intl = items.find(i => i.includes("SSD Importado")), local = items.find(i => i.includes("SSD Kingston"));
  assert.match(intl, /Costo puesto en casa, estimación/);
  assert.match(intl, /\$370\.260/);
  assert.doesNotMatch(local, /puesto en casa/);
});

test("sin reglas ni cotizaciones el feed sale como antes", () => {
  assert.equal(F.renderFeed(IDX_INTL, { baseUrl: BASE }), F.renderFeed(IDX_INTL, { baseUrl: BASE, costo: null }));
  assert.doesNotMatch(F.renderFeed(IDX_INTL, { baseUrl: BASE }), /puesto en casa/);
});

test("la lista del canal y /hoy/ llevan el costo estimado de lo internacional", () => {
  const lista = F.listaParaCanal(IDX_INTL, 10, COSTO_FX);
  assert.match(lista.find(o => o.nombre.includes("Importado")).puesto, /\$306\.000.*\$370\.260/);
  assert.equal(lista.find(o => o.nombre.includes("Kingston")).puesto, undefined);
  assert.match(F.renderHoy(IDX_INTL, { baseUrl: BASE, costo: COSTO_FX }), /Costo puesto en casa/);
});
