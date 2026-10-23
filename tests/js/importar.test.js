const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../../js/importar.js");
const C = require("../../js/calculadora.js");

const RUBROS = ["smartphone", "notebook", "pc", "monitor", "componente", "periferico", "otro"];

test("cada rubro tiene un peso tipico positivo, y el que no conoce cae en «otro»", () => {
  for (const r of RUBROS) assert.ok(I.PESO_TIPICO[r] > 0, r);
  const sinRubro = I.hrefCalculadora(100, "rubro-raro", "/");
  assert.equal(C.estadoDeUrl(sinRubro.split("#")[0].split("?")[1]).peso, String(I.PESO_TIPICO.otro));
});

test("el estado precargado trae el precio en dolares y el peso del rubro, el resto por defecto", () => {
  const e = I.estadoImportar(199.5, "notebook");
  assert.equal(e.valor, "199.5");
  assert.equal(e.moneda, "USD");
  assert.equal(e.peso, "2.5");
  assert.equal(e.pago, C.POR_DEFECTO.pago);
  assert.equal(e.aduana, C.POR_DEFECTO.aduana);
});

test("el precio se redondea a centavos y nunca sale en notacion cientifica", () => {
  assert.equal(I.estadoImportar(1234.5678, "pc").valor, "1234.57");
  assert.equal(I.estadoImportar(3, "monitor").valor, "3");
});

test("el enlace abre #costo con la calculadora precargada, y se lee de vuelta igual", () => {
  const href = I.hrefCalculadora(250, "smartphone", "/buscador/");
  assert.ok(href.startsWith("/buscador/?"), href);
  assert.ok(href.endsWith("#costo"), href);
  const leido = C.estadoDeUrl(href.split("?")[1].split("#")[0]);
  assert.equal(leido.valor, "250");
  assert.equal(leido.moneda, "USD");
  assert.equal(leido.peso, "0.3");
});

test("solo Amazon lleva el tag de afiliado; con termino, va a la busqueda de ese producto", () => {
  const amazon = I.FUENTES.find(f => f.id === "amazon");
  assert.equal(amazon.afiliado, true);
  assert.equal(I.enlaceFuente(amazon), "https://www.amazon.com/?tag=lapichincha-20");
  assert.equal(I.enlaceFuente(amazon, "usb c hub"), "https://www.amazon.com/s?k=usb%20c%20hub&tag=lapichincha-20");
  for (const f of I.FUENTES.filter(f => f.id !== "amazon")) {
    assert.equal(f.afiliado, false, f.id);
    assert.equal(I.enlaceFuente(f, "algo"), f.url, f.id);
  }
});

test("las fuentes son https y estan las tres que pide el dueño", () => {
  assert.deepEqual(I.FUENTES.map(f => f.id).sort(), ["amazon", "loquieroaca", "tiendamia"]);
  for (const f of I.FUENTES) assert.match(f.url, /^https:\/\//, f.id);
});

/* --- Spec 020: buscar afuera cuando no hay resultados y pegar un link en Costo de importar --- */

test("cada fuente busca el termino con la URL de busqueda real de esa tienda (verificada el 23/10/2026)", () => {
  const f = id => I.FUENTES.find(x => x.id === id);
  assert.equal(I.urlBusqueda(f("amazon"), "soundcore aeroclip 2 by anker"),
    "https://www.amazon.com/s?k=soundcore%20aeroclip%202%20by%20anker&tag=lapichincha-20");
  assert.equal(I.urlBusqueda(f("tiendamia"), "soundcore aeroclip 2"), "https://tiendamia.com.ar/search/amazon/soundcore+aeroclip+2");
  assert.equal(I.urlBusqueda(f("loquieroaca"), "soundcore aeroclip 2"), "https://www.loquieroaca.com/products?search=soundcore+aeroclip+2");
});

test("la busqueda limpia el termino: espacios de mas, barras y signos no rompen la URL", () => {
  const tm = I.FUENTES.find(x => x.id === "tiendamia"), lqa = I.FUENTES.find(x => x.id === "loquieroaca");
  assert.equal(I.urlBusqueda(tm, "  rtx 4060/ti  8gb & más "), "https://tiendamia.com.ar/search/amazon/rtx+4060%2Fti+8gb+%26+m%C3%A1s");
  assert.equal(I.urlBusqueda(lqa, " a  b "), "https://www.loquieroaca.com/products?search=a+b");
});

test("sin termino, cada fuente cae en su portada (Amazon con el tag)", () => {
  for (const f of I.FUENTES) {
    const u = I.urlBusqueda(f, "   ");
    if (f.afiliado) assert.equal(u, "https://www.amazon.com/?tag=lapichincha-20");
    else assert.equal(u, f.url, f.id);
  }
});

test("parsearEnlace reconoce Amazon por /dp/, /gp/product/ y /gp/aw/d/, con el ASIN en mayusculas y el nombre del slug", () => {
  const a = I.parsearEnlace("https://www.amazon.com/Soundcore-AeroClip-Earbuds-Crystal-Clear/dp/b0dlgchl8m/ref=sr_1_3?crid=X&th=1");
  assert.deepEqual(a, { tienda: "amazon", id: "B0DLGCHL8M", nombre: "Soundcore AeroClip Earbuds Crystal Clear",
    url: "https://www.amazon.com/dp/B0DLGCHL8M" });
  assert.equal(I.parsearEnlace("amazon.com/gp/product/B0DLGCHL8M").id, "B0DLGCHL8M");
  assert.equal(I.parsearEnlace("https://amazon.com/gp/aw/d/B0DLGCHL8M?psc=1").id, "B0DLGCHL8M");
  assert.equal(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M").nombre, "");
  assert.equal(I.parsearEnlace("  https://smile.amazon.com/dp/B0DLGCHL8M  ").tienda, "amazon");
});

test("un link corto de Amazon (amzn.to) se reconoce, pero sin ASIN: no se puede saber sin abrirlo", () => {
  assert.deepEqual(I.parsearEnlace("https://amzn.to/3AbCdEf"), { tienda: "amazon", id: null, nombre: "", url: "https://amzn.to/3AbCdEf" });
  // El «Compartir» de la app de Amazon da a.co/d/...
  assert.deepEqual(I.parsearEnlace("https://a.co/d/7xYzAbC"), { tienda: "amazon", id: null, nombre: "", url: "https://a.co/d/7xYzAbC" });
  assert.equal(I.parsearEnlace("https://a.co/"), null);
});

test("parsearEnlace reconoce Tiendamia /p/<origen>/<id>/<slug> y, si viene de Amazon, el ASIN", () => {
  const t = I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas?utm=x");
  assert.deepEqual(t, { tienda: "tiendamia", id: "B0HFJ7NVPB", origen: "amz",
    nombre: "soundcore anker aeroclip 2 auriculares con clip para llamadas",
    url: "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-anker-aeroclip-2-auriculares-con-clip-para-llamadas" });
  const e = I.parsearEnlace("www.tiendamia.com/p/ebay/123456789012/algo-usado");
  assert.equal(e.tienda, "tiendamia");
  assert.equal(e.origen, "ebay");
  assert.equal(e.id, "123456789012");
});

test("parsearEnlace reconoce Loquieroaca /products/<id> y /products/<slug>-<id>", () => {
  assert.deepEqual(I.parsearEnlace("https://www.loquieroaca.com/products/1589074"),
    { tienda: "loquieroaca", id: "1589074", nombre: "", url: "https://www.loquieroaca.com/products/1589074" });
  const l = I.parsearEnlace("https://loquieroaca.com/products/auriculares-abiertos-soundcore-c50i-de-anker-243397");
  assert.equal(l.id, "243397");
  assert.equal(l.nombre, "auriculares abiertos soundcore c50i de anker");
});

test("parsearEnlace reconoce eBay /itm/<id> y /itm/<slug>/<id>", () => {
  assert.deepEqual(I.parsearEnlace("https://www.ebay.com/itm/266512345678?hash=item3e"),
    { tienda: "ebay", id: "266512345678", nombre: "", url: "https://www.ebay.com/itm/266512345678" });
  const e = I.parsearEnlace("https://ebay.com/itm/Logitech-MX-Master-3S/266512345678");
  assert.equal(e.id, "266512345678");
  assert.equal(e.nombre, "Logitech MX Master 3S");
});

test("parsearEnlace no se deja engañar por dominios parecidos y devuelve null con lo que no es un link conocido", () => {
  for (const malo of ["https://amazon.com.evil.com/dp/B0DLGCHL8M", "https://notamazon.com/dp/B0DLGCHL8M", "https://www.amazon.com/",
    "https://www.amazon.com/dp/CORTO", "javascript:alert(1)", "", null, undefined, "hola che", "https://www.mercadolibre.com.ar/p/MLA123",
    "https://tiendamia.com.ar/search/amazon/x", "https://www.loquieroaca.com/categoria/audio-409810", "https://www.ebay.com/itm/abc",
    "ftp://www.amazon.com/dp/B0DLGCHL8M"]) {
    assert.equal(I.parsearEnlace(malo), null, String(malo));
  }
});

test("el nombre del slug se decodifica, se limpia y no pasa de 120 caracteres", () => {
  assert.equal(I.parsearEnlace("https://www.amazon.com/Auriculares-Inal%C3%A1mbricos__Pro--2/dp/B0DLGCHL8M").nombre, "Auriculares Inalámbricos Pro 2");
  assert.equal(I.parsearEnlace("https://www.amazon.com/%E0%A4%A/dp/B0DLGCHL8M").nombre, "%E0%A4%A");
  const largo = "a-".repeat(200) + "fin";
  assert.ok(I.parsearEnlace(`https://www.amazon.com/${largo}/dp/B0DLGCHL8M`).nombre.length <= 120);
});

test("el estado del link precarga el precio en dolares y donde se cobran los impuestos; Loquieroaca no se calcula", () => {
  const amazon = I.estadoDeEnlace(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M"), "79,99");
  assert.equal(amazon.valor, "79,99");
  assert.equal(amazon.moneda, "USD");
  assert.equal(amazon.cobro, "checkout");
  assert.equal(I.estadoDeEnlace(I.parsearEnlace("https://www.ebay.com/itm/266512345678"), "").cobro, "checkout");
  const tm = I.estadoDeEnlace(I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"), "120");
  assert.equal(tm.cobro, "checkout");
  assert.equal(tm.flete, "", "Tiendamia muestra el precio con envio: no se suma otro");
  assert.equal(I.estadoDeEnlace(I.parsearEnlace("https://www.loquieroaca.com/products/1589074"), "100"), null);
  assert.equal(I.estadoDeEnlace(null, "100"), null);
});

test("cada tienda reconocida trae su nombre y una ayuda de una linea; Tiendamia con ASIN ofrece el mismo producto en Amazon", () => {
  for (const url of ["https://www.amazon.com/dp/B0DLGCHL8M", "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x",
    "https://www.loquieroaca.com/products/1589074", "https://www.ebay.com/itm/266512345678"]) {
    const d = I.datosDeEnlace(I.parsearEnlace(url));
    assert.ok(d.tiendaNombre && d.ayuda, url);
    assert.match(d.abrir, /^https:\/\//, url);
  }
  const tm = I.datosDeEnlace(I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"));
  assert.equal(tm.mismoEnAmazon, "https://www.amazon.com/dp/B0HFJ7NVPB?tag=lapichincha-20");
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M")).abrir, "https://www.amazon.com/dp/B0DLGCHL8M?tag=lapichincha-20");
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M")).afiliado, true);
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://amzn.to/3AbCdEf")).abrir, "https://amzn.to/3AbCdEf", "el corto no se toca: no sabemos adonde va");
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://www.loquieroaca.com/products/1589074")).calcula, false);
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://ebay.com/itm/266512345678")).mismoEnAmazon, null);
  assert.equal(I.datosDeEnlace(null), null);
});

/* Tiendas oficiales: solo con el envio a Argentina confirmado en la fuente (fecha y pagina de envios). */
const OFICIAL = { marca: "Ejemplo", claves: ["ejemplo", "ejemplo pro"], nombre: "Tienda Ejemplo", url: "https://ejemplo.com/",
  busqueda: "https://ejemplo.com/search?q=", envios: "https://ejemplo.com/envios", verificado: "2026-10-23" };

test("una tienda oficial aparece solo si el termino nombra su marca y esta verificada con fecha y pagina de envios", () => {
  assert.deepEqual(I.oficialesPara("Ejemplo Pro 2", [OFICIAL]).map(o => o.nombre), ["Tienda Ejemplo"]);
  assert.deepEqual(I.oficialesPara("ejemplar", [OFICIAL]), [], "la clave va como palabra entera");
  assert.deepEqual(I.oficialesPara("ejemplo", [{ ...OFICIAL, verificado: "" }]), []);
  assert.deepEqual(I.oficialesPara("ejemplo", [{ ...OFICIAL, envios: "" }]), []);
  assert.deepEqual(I.oficialesPara("ejemplo", [{ ...OFICIAL, envios: "http://ejemplo.com/envios" }]), [], "solo https");
  assert.deepEqual(I.oficialesPara("", [OFICIAL]), []);
  assert.deepEqual(I.oficialesPara("ejemplo"), I.oficialesPara("ejemplo", I.OFICIALES), "sin lista, la curada");
});

test("la lista curada de oficiales cumple las reglas: https, fecha valida y clave en minusculas", () => {
  for (const o of I.OFICIALES) {
    assert.match(o.url, /^https:\/\//);
    assert.match(o.envios, /^https:\/\//);
    assert.match(o.verificado, /^\d{4}-\d{2}-\d{2}$/);
    for (const c of o.claves) assert.equal(c, c.toLowerCase());
  }
});

test("el bloque «buscar afuera» trae las tres fuentes con el termino, Amazon rotulado como afiliado y rel=sponsored", () => {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = I.buscarAfueraHtml("soundcore <b>aeroclip</b>", { esc, icono: () => "", oficiales: [] });
  assert.match(html, /amazon\.com\/s\?k=soundcore%20%3Cb%3Eaeroclip%3C%2Fb%3E&amp;tag=lapichincha-20/);
  assert.match(html, /tiendamia\.com\.ar\/search\/amazon\/soundcore\+%3Cb%3Eaeroclip%3C%2Fb%3E/);
  assert.match(html, /loquieroaca\.com\/products\?search=/);
  assert.ok(!html.includes("<b>aeroclip"), "el termino va escapado");
  assert.match(html, /rel="sponsored noopener"/);
  assert.match(html, /enlace de afiliado/);
  assert.equal((html.match(/rel="noopener"/g) || []).length, 2);
});

test("el bloque suma la tienda oficial verificada con su fecha, y sin oficiales no la menciona", () => {
  const esc = s => String(s);
  const con = I.buscarAfueraHtml("ejemplo pro", { esc, icono: () => "", oficiales: [OFICIAL] });
  assert.match(con, /https:\/\/ejemplo\.com\/search\?q=ejemplo%20pro/);
  assert.match(con, /23\/10\/2026/);
  assert.match(con, /https:\/\/ejemplo\.com\/envios/);
  const sin = I.buscarAfueraHtml("ejemplo pro", { esc, icono: () => "", oficiales: [] });
  assert.ok(!sin.includes("ejemplo.com"));
  const sinBusqueda = I.buscarAfueraHtml("ejemplo", { esc, icono: () => "", oficiales: [{ ...OFICIAL, busqueda: "" }] });
  assert.match(sinBusqueda, /href="https:\/\/ejemplo\.com\/"/, "sin busqueda propia, la portada");
  assert.ok(I.buscarAfueraHtml("x", { esc }).includes("tiendamia"), "sin opciones de icono ni lista, igual arma el bloque");
});
