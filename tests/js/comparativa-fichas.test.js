/* Spec 063, fase A: las tarjetas y la tabla de la Comparativa muestran las MISMAS especificaciones, con la etiqueta de cada una.
   Antes cada tarjeta mostraba lo que su titulo daba la casualidad de decir: un Ryzen 7 en una tarjeta y nada en la vecina. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const GP = require("../../generar_portada.js");
const E = require("../../js/especificaciones.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const fila = (nombre, precio, tienda) => [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", ""];

function app(productos) {
  const doc = { querySelector: () => ({ dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const ctx = GP.contexto(leer("index.html"), leer, { document: doc, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem: () => null, setItem() {} } });
  ctx.__idx = { generado: "2026-10-23T10:00-03:00", tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, gc: { nombre: "Gaming City", color: "gc" } }, productos };
  vm.runInContext("IDX = __idx", ctx);
  return codigo => vm.runInContext(codigo, ctx);
}

const NOTEBOOKS = [
  fila("Notebook Lenovo IdeaPad AMD Ryzen 7 5700U 16GB 512GB SSD 15.6\"", 900000, "cg"),
  fila("Notebook HP 250 G9 16GB 512GB SSD", 800000, "mx"),                       // el titulo no dice el procesador
  fila("Notebook Asus Vivobook Intel Core i5 1235U 16GB 512GB SSD 15.6\"", 1000000, "gc"),
];

test("fichaDe: una fila por especificacion de la categoria, con etiqueta, y vacia cuando el titulo no la dice", () => {
  const f = E.fichaDe("Notebook HP 250 G9 16GB 512GB SSD");
  assert.equal(f.categoria, "notebook");
  assert.deepEqual(f.filas.map(r => r.clave), ["cpu", "ram", "rom", "gpu", "pantalla"]);
  assert.deepEqual(f.filas.map(r => r.texto), ["", "16 GB", "512 GB", "", ""]);
  assert.equal(E.fichaDe("Notebook Lenovo Ryzen 7 5700U 16GB 512GB").filas[0].texto, "Ryzen 7 serie 5000");
});

test("celular: red y pantalla salen del titulo; el modelo suelto no es pantalla", () => {
  const f = E.fichaDe('Celular Motorola Signature 5G 16GB 1TB 6.9 Pulgadas');
  assert.deepEqual(f.filas.map(r => r.texto), ["16 GB", "1 TB", "5G", '6.9"']);
  assert.equal(E.fichaDe("Notebook Lenovo IdeaPad 15 Ryzen 5 8GB 256GB").filas.find(r => r.clave === "pantalla").texto, "");
});

test("la Comparativa muestra el procesador en cada tarjeta: el valor o «no informa», nunca nada", () => {
  const correr = app(NOTEBOOKS);
  correr('fijarConsulta("notebook")');
  const html = correr("vistaComparativaDin()");
  const opciones = html.slice(0, html.indexOf('class="franja"'));          // las tarjetas de opciones, no las de comercios
  const tarjetas = opciones.split('<a class="dcard').slice(1);
  assert.ok(tarjetas.length >= 2, "hay al menos dos opciones");
  for (const t of tarjetas) assert.match(t, /<span class="eti">Procesador<\/span>/);
  assert.match(html, /Ryzen 7 serie 5000/);
  assert.match(html, /Procesador<\/span> no informa/);
});

test("la tabla repite las especificaciones con las mismas etiquetas y «no informa» donde falta", () => {
  const correr = app(NOTEBOOKS);
  correr('fijarConsulta("notebook")');
  const tabla = correr("tablaPicks(ANALISIS.picks)");
  assert.match(tabla, /<th>Procesador<\/th>/);
  assert.match(tabla, /<th>RAM<\/th>/);
  assert.match(tabla, /no informa/);
});

test("una especificacion que ninguna tarjeta dice no se muestra (no se llena de «no informa»)", () => {
  const correr = app(NOTEBOOKS);
  correr('fijarConsulta("notebook")');
  assert.doesNotMatch(correr("tablaPicks(ANALISIS.picks)"), /<th>Gráficos<\/th>/);
});

test("fase B: la Comparativa de teclados muestra tecnologia y switch en cada tarjeta", () => {
  const correr = app([
    fila("Teclado Mecanico Razer BlackWidow V4 Green Switch", 250000, "cg"),
    fila("Teclado Mecanico Redragon Kumara TKL Blue Switch USB", 60000, "mx"),
    fila("Teclado Mecanico Logitech G413 TKL Cable", 90000, "gc"),
  ]);
  correr('fijarConsulta("teclado mecanico")');
  const html = correr("vistaComparativaDin()");
  assert.match(html, /<span class="eti">Tecnología<\/span> Mecánico/);
  assert.match(html, /<span class="eti">Switch<\/span> Verde/);
  assert.match(html, /<span class="eti">Switch<\/span> no informa/, "el G413 no dice el switch");
});

/* --- Spec 063, fase C: «Comparar» desde una tarjeta busca por caracteristicas, de cualquier marca --- */
const TECLADOS = [
  [...fila("Teclado Mecanico Razer BlackWidow V4 Green Switch", 250000, "cg"), "RZ03-04690"],
  [...fila("Teclado Mecanico Razer BlackWidow V4 Green Switch", 240000, "mx"), "RZ03-04690"],  // el mismo modelo (mismo codigo) en otra tienda
  fila("Teclado Mecanico Redragon Kumara TKL Blue Switch USB", 60000, "mx"),
  fila("Teclado Mecanico Logitech G413 TKL Cable", 90000, "gc"),
  fila("Teclado Mecanico HyperX Alloy Origins Red Switch", 130000, "cg"),
  fila("Teclado Logitech K120 USB Membrana", 15000, "gc"),                                   // membrana: no es lo mismo
  fila("Mouse Gamer Logitech G502 Hero Cable 25600 DPI", 70000, "cg"),
];

test("comparar un teclado Razer trae teclados mecanicos de otras marcas, no solo el mismo Razer en otras tiendas", () => {
  const correr = app(TECLADOS);
  const ref = TECLADOS[0];
  correr(`fijarConsulta("Teclado Mecanico Razer", __f)`.replace("__f", JSON.stringify(ref)));
  const A = correr("ANALISIS");
  const nombres = [...A.base].map(m => m.f[0]);
  assert.ok(nombres.some(n => /Redragon/.test(n)) && nombres.some(n => /Logitech G413/.test(n)) && nombres.some(n => /HyperX/.test(n)), nombres.join(" | "));
  assert.ok(!nombres.some(n => /K120|Mouse/.test(n)), "ni membrana ni un mouse");
  assert.equal(A.espec.porEspecificaciones, true);
  const marcas = new Set([...A.picks].map(p => p.m.f[0].split(" ")[2]));
  assert.ok(marcas.size >= 2, "las opciones son de mas de una marca");
});

test("la tarjeta que elegiste siempre esta entre las opciones, marcada", () => {
  const correr = app(TECLADOS);
  const ref = TECLADOS[0];
  correr(`fijarConsulta("Teclado Mecanico Razer", ${JSON.stringify(ref)})`);
  const picks = [...correr("ANALISIS.picks")];
  const propia = picks.filter(p => p.esReferencia);
  assert.equal(propia.length, 1);
  assert.match(propia[0].m.f[0], /Razer/);
  assert.match(correr("vistaComparativaDin()"), /La que elegiste/);
});

test("con pocos avisos exactos suma los de especificaciones cercanas y lo dice", () => {
  const correr = app([
    fila("Celular Motorola Signature 5G 16GB 1TB", 2399999, "cg"),
    fila("Celular Samsung Galaxy S26 Ultra 12GB 512GB", 2200000, "mx"),
    fila("Celular Xiaomi 15T Pro 12GB 512GB", 1500000, "gc"),
    fila("Celular Basico Alcatel 1GB 8GB", 80000, "gc"),
  ]);
  correr(`fijarConsulta("Celular Motorola Signature", ${JSON.stringify(["Celular Motorola Signature 5G 16GB 1TB", 2399999, "https://cg.test/Celular%20Motorola%20Signature%205G%2016GB%201TB", "cg", "", 0, 0, "", ""])})`);
  const A = correr("ANALISIS");
  assert.equal(A.espec.aproximada, true);
  const nombres = [...A.base].map(m => m.f[0]);
  assert.ok(nombres.some(n => /Samsung/.test(n)) && nombres.some(n => /Xiaomi/.test(n)));
  assert.ok(!nombres.some(n => /Alcatel/.test(n)), "8 GB de almacenamiento no es cercano a 1 TB");
  assert.match(correr("vistaComparativaDin()"), /especificaciones parecidas/);
});

test("sin especificaciones suficientes en la tarjeta se compara como siempre (por el texto de la busqueda)", () => {
  const correr = app(TECLADOS);
  correr(`fijarConsulta("Mouse Gamer", ${JSON.stringify(["Mouse Logitech G203 Lightsync", 20000, "https://x.test/g203", "cg", "", 0, 0, "", ""])})`);
  assert.equal(correr("ANALISIS.espec.aplica"), false);
});

test("desde Ofertas la tarjeta de origen no repite su tabla de precio por tienda", () => {
  const correr = app(TECLADOS);
  const ref = JSON.stringify(TECLADOS[1]);                      // el Razer mas barato: representa al modelo
  correr(`fijarConsulta("Teclado Mecanico Razer", ${ref}, { desdeOferta: true })`);
  assert.doesNotMatch(correr("vistaComparativaDin()"), /pt-titulo">[^<]*Razer BlackWidow/);
  correr(`fijarConsulta("Teclado Mecanico Razer", ${ref})`);
  assert.match(correr("vistaComparativaDin()"), /pt-titulo">[^<]*Razer BlackWidow/, "desde Buscar si se muestra: hay dos tiendas");
});

test("la comparacion por especificaciones va en la URL (?ref=) y se reproduce", () => {
  const P = require("../../js/pagina.js");
  const url = P.armarUrl("/la-pichincha/", "teclado mecanico", "comparativa", "https://cg.test/teclado?id=1");
  assert.equal(url, "/la-pichincha/?q=teclado+mecanico&ref=https%3A%2F%2Fcg.test%2Fteclado%3Fid%3D1#comparativa");
  const l = P.leerUrl(url.slice(url.indexOf("?"), url.indexOf("#")), "#comparativa");
  assert.deepEqual(l, { q: "teclado mecanico", vista: "comparativa", ref: "https://cg.test/teclado?id=1" });
  assert.equal(P.armarUrl("/x/", "ssd", "", ""), "/x/?q=ssd", "sin referencia queda igual");
  assert.deepEqual(P.leerUrl("?q=ssd&ref=javascript:alert(1)", ""), { q: "ssd", vista: "" }, "solo direcciones web");
  assert.deepEqual(P.leerUrl("?ref=https://a.test/x", ""), { q: "", vista: "" }, "sin consulta no hay referencia");
});

/* --- Spec 063, fase G: el mejor valor de cada fila de la tabla se resalta --- */
test("la tabla resalta la RAM mas alta y no resalta cuando todos tienen lo mismo", () => {
  const correr = app([
    fila("Notebook Lenovo IdeaPad AMD Ryzen 7 5700U 16GB 512GB SSD 15.6\"", 900000, "cg"),
    fila("Notebook HP 250 G9 Intel Core i5 1235U 32GB 512GB SSD", 1100000, "mx"),
    fila("Notebook Asus Vivobook Intel Core i5 1235U 8GB 512GB SSD", 700000, "gc"),
  ]);
  correr('fijarConsulta("notebook")');
  const tabla = correr("tablaPicks(ANALISIS.picks)");
  const ram = tabla.match(/<tr><th>RAM<\/th>(.*?)<\/tr>/)[1];
  assert.equal((ram.match(/class="mejor"/g) || []).length, 1);
  assert.match(ram, /class="mejor">32 GB</);
  const disco = tabla.match(/<tr><th>Almacenamiento<\/th>(.*?)<\/tr>/)[1];
  assert.doesNotMatch(disco, /class="mejor"/, "512 GB en todas: no hay ganador");
});
