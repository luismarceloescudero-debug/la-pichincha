const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../../js/novedades.js");

// Filas del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, tienda = "cg", { sellos = "", modelo = "" } = {}) =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre + tienda), tienda, "", 0, 0, "", sellos, modelo];

const TIENDAS = { cg: { nombre: "CompraGamer" }, mx: { nombre: "Mexx" } };
const ASUS = "Notebook Gamer ASUS ROG Strix G16 16\" AMD Ryzen 9 9955HX 32GB DDR5 SSD 1TB RTX 5070";
const OMEN = "Notebook Gamer HP OMEN 15.3\" QHD 165Hz Intel Core i7 14650HX 16GB 1TB RTX 5060";
const LAPTOP = "Laptop Hp Omen I7-14700hx 1tb/32gb 16.1 Qhd Rtx 4070 8gb";
const BASICA = "Notebook Lenovo IdeaPad Intel Celeron 4GB 128GB 15.6 HD";

const IDX = {
  tiendas: TIENDAS,
  productos: [
    fila(ASUS, 4900000, "cg", { modelo: "G16-9955" }),
    fila(OMEN, 3400000, "cg"),
    fila(LAPTOP, 5200000, "mx"),
    fila(OMEN + " usado", 1000000, "cg", { sellos: "u" }),                 // usado: no entra
    fila("Notebook Gamer ASUS ROG Strix G18 AMD Ryzen 9 9955HX 32GB 1TB RTX 5080 importada", 4000000, "mx", { sellos: "i" }),   // internacional: no entra
    fila(ASUS, 4800000, "mx", { modelo: "G16-9955" }),                      // el mismo modelo en otra tienda: una sola fila
    fila(BASICA, 400000, "cg"),                                             // no es premium
    fila("Mouse Logitech G203 Lightsync", 20000, "cg"),                      // otra categoria sin especificaciones
  ],
};

test("elige solo lo premium de cada categoría, sin usados, internacionales ni repetidos", () => {
  const g = N.novedadesPorCategoria(IDX, null);
  const notebooks = g.find(x => x.categoria === "notebook");
  assert.ok(notebooks, "hay notebooks premium para comparar");
  const nombres = notebooks.items.map(i => i.nombre);
  assert.ok(!nombres.some(n => /usado/.test(n)), "sin usados");
  assert.ok(!nombres.some(n => /importada/.test(n)), "sin internacionales");
  assert.ok(!nombres.includes(BASICA), "lo que no es premium no entra");
  assert.equal(nombres.filter(n => n === ASUS).length, 1, "el mismo modelo en dos tiendas es uno solo");
  assert.ok(notebooks.items.length <= N.POR_CATEGORIA);
});

test("el mismo celular sin código escrito distinto en tres tiendas es uno solo y sale con la tienda más barata (07/11)", () => {
  const idx = { tiendas: { ...TIENDAS, mt: { nombre: "Max Tecno" }, cc: { nombre: "Compra Cierta" } }, productos: [
    fila("CELULAR SAMSUNG GALAXY S26 ULTRA 12/512GB 6.9\" 120 Hz D AMOLED NEGRO", 3721489, "mt"),
    fila("Samsung Galaxy S26 Ultra 5G 512GB 12GB RAM 6.9 Pulgadas", 3409999, "cg"),
    fila("Samsung Galaxy S26 Ultra 512gb 12gb Dual Sim", 2300000, "cc"),
    fila("Celular Honor 600 Pro 5g Dual Sim 512 GB 12 GB Ram Blanco Dorado 200 Mp", 1750000, "cg"),
  ] };
  const cel = N.novedadesPorCategoria(idx, null).find(x => x.categoria === "smartphone");
  assert.ok(cel, "hay celulares premium para comparar");
  const s26 = cel.items.filter(i => /s26 ultra/i.test(i.nombre));
  assert.equal(s26.length, 1, "el S26 Ultra 12/512 sale una sola vez");
  assert.equal(s26[0].precio, 2300000, "y con la tienda más barata");
  assert.equal(s26[0].tienda, "Compra Cierta");
});

test("otra memoria es otro equipo: el S26 Ultra de 256 GB no se junta con el de 512 GB", () => {
  const idx = { tiendas: TIENDAS, productos: [
    fila("Samsung Galaxy S26 Ultra 512gb 12gb Dual Sim", 2300000, "cg"),
    fila("Samsung Galaxy S26 Ultra 256gb 12gb Dual Sim", 2050000, "mx"),
  ] };
  const cel = N.novedadesPorCategoria(idx, null).find(x => x.categoria === "smartphone");
  assert.equal(cel && cel.items.length, 2);
});

test("cada item trae sus especificaciones clave, el precio y la tienda", () => {
  const notebooks = N.novedadesPorCategoria(IDX, null).find(x => x.categoria === "notebook");
  for (const i of notebooks.items) {
    assert.ok(i.resumen.length > 0, i.nombre);
    assert.ok(i.precio > 0 && i.url.startsWith("https://"));
    assert.ok(["CompraGamer", "Mexx"].includes(i.tienda));
  }
});

test("una categoría con menos de dos productos para comparar no sale", () => {
  const g = N.novedadesPorCategoria(IDX, null);
  assert.ok(!g.some(x => x.categoria === "smartphone"), "no hay celulares en el índice");
  assert.ok(!g.some(x => x.categoria === "monitor"));
  const solo = { tiendas: TIENDAS, productos: [fila(ASUS, 4900000)] };
  assert.deepEqual(N.novedadesPorCategoria(solo, null), []);
});

test("el panel compara de frente: el más barato y cuánto más caro es cada uno", () => {
  const g = N.novedadesPorCategoria(IDX, null);
  const html = N.novedadesHtml(g, { esc: s => String(s), pesos: n => "$" + n, enlace: u => u, icono: () => "" });
  assert.match(html, /<h2>Lo último en tecnología<\/h2>/);
  assert.match(html, /<h3>Notebooks<\/h3>/);
  assert.match(html, /el más barato/);
  assert.match(html, /\+\d+%/);
  assert.match(html, /data-comparar-fila="https:\/\/t\.test\//);
  assert.match(html, /<table class="pt-tabla nov-tabla"/);
});

test("sin grupos no hay panel", () => {
  const h = { esc: s => s, pesos: n => n, enlace: u => u, icono: () => "" };
  assert.equal(N.novedadesHtml([], h), "");
  assert.equal(N.novedadesHtml(null, h), "");
});

test("el nombre va como en Ofertas: titulo limpio y caracteristicas en pastillas, y el texto se escapa", () => {
  const g = [{ categoria: "notebook", etiqueta: "Notebooks", items: [
    { nombre: "Notebook Gigabyte Gaming A16 i7-13620H 32GB 2TB RTX 5060", precio: 100, url: "https://t.test/a", tienda: "Mexx", resumen: "", ultimo: true },
    { nombre: "Otra <b>", precio: 150, url: "https://t.test/b", tienda: "Mexx", resumen: "", ultimo: false }] }];
  const esc = s => String(s).replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const html = N.novedadesHtml(g, { esc, pesos: n => "$" + n, enlace: u => u, icono: () => "" });
  assert.match(html, /<span class="tit-chip[^"]*">(?:<span aria-hidden="true">✦ <\/span>)?RTX 5060<\/span>/);
  assert.match(html, /<span class="tit-chip[^"]*">(?:<span aria-hidden="true">✦ <\/span>)?32 GB RAM<\/span>/);
  assert.ok(!html.includes("<b>"), "el nombre se escapa");
  assert.ok(!html.includes("Especificaciones"), "sin la columna que repetia el titulo");
  assert.match(html, /lo último/);
  assert.match(html, /\+50%/);
});

test("«Lo más buscado» muestra solo los términos, cada uno con su comparativa, y escapa el texto", () => {
  const h = { esc: s => String(s).replace(/</g, "&lt;").replace(/"/g, "&quot;") };
  const html = N.masBuscadasHtml(["ssd 1tb", 'a<b"'], h);
  assert.match(html, /<h2>Lo más buscado<\/h2>/);
  assert.match(html, /<button class="sug" data-comparar="ssd 1tb">ssd 1tb<\/button>/);
  assert.ok(html.includes("a&lt;b&quot;") && !html.includes("a<b"), "el texto se escapa");
  assert.ok(!/\d+ (personas|búsquedas)/.test(html), "sin conteos");
  assert.equal(N.masBuscadasHtml([], h), "");
  assert.equal(N.masBuscadasHtml(null, h), "");
});

// ---- Lo mas vendido en las tiendas (spec 019) ----

// La columna 13 del indice es el puesto del aviso en el orden «mas vendidos» de su tienda (0: sin puesto).
const vendida = (nombre, precio, tienda, puesto, extra = {}) => {
  const f = fila(nombre, precio, tienda, extra);
  return [...f, "", "", "", puesto];
};
const NITRO = "Notebook Gamer Acer Nitro V15 Intel Core i7 13620H 16GB 1TB RTX 4060";
const IDX_V = {
  tiendas: TIENDAS,
  productos: [
    vendida(OMEN, 3400000, "cg", 7),            // el puesto es de toda la tienda: 7, pero es su notebook mas vendida
    vendida(ASUS, 4900000, "cg", 9, { modelo: "G16-9955" }),
    vendida(ASUS, 4800000, "mx", 1, { modelo: "G16-9955" }),   // la mas vendida de Mexx, y tambien entre las de CompraGamer
    vendida(NITRO, 2100000, "mx", 2),
    vendida(BASICA, 400000, "cg", 1),            // la mas vendida de la tienda, pero no llega al minimo de su gama
    vendida(LAPTOP, 5200000, "mx", 0),           // sin puesto: no entra
    vendida(OMEN + " usado", 900000, "mx", 3, { sellos: "u" }),
    vendida("Mouse Logitech G203 Lightsync", 20000, "cg", 2),
  ],
};

test("lo más vendido sale del orden de cada tienda: su primera de la categoría, sin usados ni lo que no llega al mínimo", () => {
  const g = N.masVendidosPorCategoria(IDX_V, null);
  const notebooks = g.find(x => x.categoria === "notebook");
  assert.ok(notebooks, "hay notebooks con puesto");
  const nombres = notebooks.items.map(i => i.nombre);
  assert.ok(!nombres.includes(BASICA), "lo que no llega al mínimo de su gama no entra");
  assert.ok(!nombres.includes(LAPTOP), "sin puesto no entra");
  assert.ok(!nombres.some(n => /usado/.test(n)), "sin usados");
  assert.equal(nombres.filter(n => n === ASUS).length, 1, "el mismo modelo en dos tiendas es uno solo");
  assert.ok(notebooks.items.length <= N.POR_CATEGORIA);
});

test("primero las que encabezan su tienda, y a igual puesto la que se vende en más tiendas", () => {
  const notebooks = N.masVendidosPorCategoria(IDX_V, null).find(x => x.categoria === "notebook");
  const [primera, segunda] = notebooks.items;
  assert.equal(primera.nombre, ASUS, "encabeza Mexx y está entre las de CompraGamer");
  assert.equal(primera.puesto, 1);
  assert.equal(primera.tiendas, 2);
  assert.equal(segunda.nombre, OMEN, "la primera de CompraGamer en notebooks, aunque en toda la tienda sea la 7");
  assert.equal(segunda.puesto, 1);
  assert.equal(segunda.tienda, "CompraGamer");
});

test("sin puestos en el índice no hay panel de lo más vendido", () => {
  assert.deepEqual(N.masVendidosPorCategoria(IDX, null), [], "un índice sin la columna");
  assert.equal(N.masVendidosHtml([], { esc: String, pesos: String, enlace: String, icono: () => "" }), "");
});

test("el panel dice de dónde sale el orden, sin inventar cantidades", () => {
  const g = N.masVendidosPorCategoria(IDX_V, null);
  const html = N.masVendidosHtml(g, { esc: s => String(s), pesos: n => "$" + n, enlace: u => u, icono: () => "" });
  assert.match(html, /id="mas-vendido"/);
  assert.match(html, /Lo más vendido en las tiendas/);
  assert.match(html, /n\.º 1 en Mexx/);
  assert.match(html, /entre las más vendidas de 2 tiendas/);
  assert.match(html, /no publican cuántas unidades/);
  assert.match(html, /data-comparar-fila="https:\/\/t\.test\//);
  assert.ok(!/\d+ (unidades|ventas)/.test(html), "sin cantidades inventadas");
});

test("un aviso sin código de modelo que nombra el código de otro es el mismo modelo", () => {
  // Medido el 22/10: el LG 24GS60F salía dos veces porque GoldenTech no trae el código y The Gamer Shop sí (24GS60F-B).
  const LG = "Monitor LG UltraGear 24GS60F 24\" IPS 180Hz Full HD";
  const idx = { tiendas: { tg: { nombre: "The Gamer Shop" }, gt: { nombre: "GoldenTech" }, mx: { nombre: "Mexx" } }, productos: [
    vendida(LG, 217600, "tg", 4, { modelo: "24GS60F-B" }),
    vendida("MONITOR GAMER 24 LG ULTRAGEAR 24GS60F 180HZ IPS 1MS FHD", 226861, "gt", 6),
    vendida("Monitor Samsung Odyssey G5 27\" VA 165Hz QHD", 300000, "mx", 1),
  ] };
  const monitores = N.masVendidosPorCategoria(idx, null).find(x => x.categoria === "monitor");
  assert.equal(monitores.items.filter(i => /24GS60F/i.test(i.nombre)).length, 1);
  assert.equal(monitores.items.find(i => /24GS60F/i.test(i.nombre)).tiendas, 2);
});
