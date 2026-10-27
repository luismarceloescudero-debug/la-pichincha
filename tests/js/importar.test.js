const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../../js/importar.js");

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

/* Spec 023: las formas que el dueño pego y no se reconocian (medidas en el sitio publicado el 23/10/2026). */
test("Amazon en español (/-/es/...) y con varios segmentos antes de /dp/: el slug es el que va justo antes", () => {
  const a = I.parsearEnlace("https://www.amazon.com/-/es/Soundcore-AeroClip-auriculares/dp/B0HFJ7NVPB/ref=sr_1_1?crid=2X");
  assert.deepEqual(a, { tienda: "amazon", id: "B0HFJ7NVPB", nombre: "Soundcore AeroClip auriculares", url: "https://www.amazon.com/dp/B0HFJ7NVPB" });
  assert.equal(I.parsearEnlace("https://www.amazon.com/-/es/dp/B0HFJ7NVPB").nombre, "", "el idioma no es un nombre");
  assert.equal(I.parsearEnlace("https://www.amazon.com/-/en_US/dp/B0HFJ7NVPB").nombre, "");
  assert.equal(I.parsearEnlace("https://www.amazon.com/-/es/gp/product/B0HFJ7NVPB?th=1").id, "B0HFJ7NVPB");
  assert.equal(I.parsearEnlace("https://www.amazon.com/-/es/gp/aw/d/B0HFJ7NVPB").id, "B0HFJ7NVPB");
  assert.equal(I.parsearEnlace("https://www.amazon.com/a/b/c/Nombre-Largo/dp/B0HFJ7NVPB").nombre, "Nombre Largo");
});

test("un patrocinado de Amazon (/sspa/click) lleva el producto en el parametro url", () => {
  const p = I.parsearEnlace("https://www.amazon.com/sspa/click?ie=UTF8&spc=MT&url=%2FSoundcore-AeroClip%2Fdp%2FB0HFJ7NVPB%2Fref%3Dsr");
  assert.deepEqual(p, { tienda: "amazon", id: "B0HFJ7NVPB", nombre: "Soundcore AeroClip", url: "https://www.amazon.com/dp/B0HFJ7NVPB" });
  assert.equal(I.parsearEnlace("https://www.amazon.com/sspa/click?url=%2F-%2Fes%2FX%2Fdp%2FB0HFJ7NVPB").id, "B0HFJ7NVPB");
  assert.equal(I.parsearEnlace("https://www.amazon.com/sspa/click?ie=UTF8"), null, "sin url no hay producto");
  assert.equal(I.parsearEnlace("https://www.amazon.com/sspa/click?url=https%3A%2F%2Fevil.com%2Fdp%2FB0HFJ7NVPB"), null,
    "el parametro url solo vale como ruta dentro de Amazon");
});

test("Amazon de otro pais se reconoce con su dominio y su moneda, sin el tag de EE.UU.", () => {
  const es = I.parsearEnlace("https://www.amazon.es/Soundcore-AeroClip/dp/B0HFJ7NVPB");
  assert.deepEqual(es, { tienda: "amazon", id: "B0HFJ7NVPB", nombre: "Soundcore AeroClip", url: "https://www.amazon.es/dp/B0HFJ7NVPB", dominio: "amazon.es" });
  assert.equal(I.parsearEnlace("https://www.amazon.com.mx/dp/B0HFJ7NVPB").dominio, "amazon.com.mx");
  const d = I.datosDeEnlace(es);
  assert.equal(d.tiendaNombre, "Amazon (amazon.es)");
  assert.equal(d.afiliado, false);
  assert.equal(d.abrir, "https://www.amazon.es/dp/B0HFJ7NVPB");
  assert.equal(I.parsearEnlace("https://www.amazon.evil.com/dp/B0HFJ7NVPB"), null);
});

test("una imagen de Amazon (m.media-amazon.com) no es un producto", () => {
  assert.equal(I.parsearEnlace("https://m.media-amazon.com/images/I/61fC4WN2xvL._AC_SL1500_.jpg"), null);
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

test("cada tienda reconocida trae su nombre y a donde abrirlo, sin campos de calculo (spec 040); Tiendamia con ASIN ofrece el mismo producto en Amazon", () => {
  for (const url of ["https://www.amazon.com/dp/B0DLGCHL8M", "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x",
    "https://www.loquieroaca.com/products/1589074", "https://www.ebay.com/itm/266512345678"]) {
    const d = I.datosDeEnlace(I.parsearEnlace(url));
    assert.ok(d.tiendaNombre, url);
    assert.match(d.abrir, /^https:\/\//, url);
    assert.deepEqual(Object.keys(d).sort(), ["abrir", "afiliado", "mismoEnAmazon", "tiendaNombre"], url);
  }
  const tm = I.datosDeEnlace(I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x"));
  assert.equal(tm.mismoEnAmazon, "https://www.amazon.com/dp/B0HFJ7NVPB?tag=lapichincha-20");
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M")).abrir, "https://www.amazon.com/dp/B0DLGCHL8M?tag=lapichincha-20");
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M")).afiliado, true);
  assert.equal(I.datosDeEnlace(I.parsearEnlace("https://amzn.to/3AbCdEf")).abrir, "https://amzn.to/3AbCdEf", "el corto no se toca: no sabemos adonde va");
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

test("«buscar afuera» ya no cita a Aerobox ni a ningun courier, y trae el campo para pegar un link (spec 040)", () => {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = I.buscarAfueraHtml("soundcore aeroclip", { esc, icono: () => "", oficiales: [] });
  assert.doesNotMatch(html, /aerobox/i);
  assert.doesNotMatch(html, /cotiz/i, "sin cotizador de courier");
  assert.equal(I.COURIERS, undefined);
  assert.match(html, /¿Ya lo encontraste\? Pegá el link/);
  assert.match(html, /<input id="pl-link" type="url"/);
  assert.match(html, /<div id="pl-res" aria-live="polite">/);
  assert.doesNotMatch(html, /#costo|data-ir-vista|calcul/i, "no hay calculadora a la que saltar");
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

/* --- Spec 023: lo que el Worker lee del link pegado (GET /enlace) --- */
test("la URL de /enlace lleva el link tal cual; sin Worker o sin link no hay URL", () => {
  assert.equal(I.urlLeerEnlace("https://w.workers.dev", " https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x "),
    "https://w.workers.dev/enlace?url=https%3A%2F%2Ftiendamia.com.ar%2Fp%2Famz%2Fb0hfj7nvpb%2Fx");
  assert.equal(I.urlLeerEnlace("", "https://x"), "");
  assert.equal(I.urlLeerEnlace("https://w.workers.dev", "  "), "");
});

test("Tiendamia leida: el precio en dolares y la linea dice que trae el envio", () => {
  const r = I.leidoDeEnlace({ leido: true, enlace: { tienda: "tiendamia" },
    item: { fuente: "tiendamia", precio: 198.88, moneda: "USD", envio: 0, nombre: "AeroClip 2", precioBase: null, recargoPct: null } });
  assert.equal(r.precio, "198.88");
  assert.equal(r.ars, false);
  assert.match(r.linea, /Precio leído en Tiendamia: US\$ 198,88, con el envío incluido/);
  assert.doesNotMatch(r.linea, /% más/, "sin precio base no hay porcentaje");
  assert.equal(r.nombre, "AeroClip 2");
});

test("Tiendamia leida con precio base: la linea muestra el porcentaje contra Amazon (spec 039)", () => {
  const r = I.leidoDeEnlace({ leido: true, enlace: { tienda: "tiendamia" },
    item: { fuente: "tiendamia", precio: 198.88, moneda: "USD", envio: 0, nombre: "AeroClip 2", precioBase: 169.98, recargoPct: 17 } });
  assert.equal(r.precio, "198.88");
  assert.match(r.linea, /En Amazon sale US\$ 169,98: un 17 % más con envío e impuestos incluidos \(aproximado\)/);
});

test("un link de Amazon que cruza a Tiendamia: el precio de Amazon es el base y la linea cita a Tiendamia", () => {
  const r = I.leidoDeEnlace({ leido: true, enlace: { tienda: "amazon" },
    item: { fuente: "tiendamia", precio: 198.88, moneda: "USD", envio: 0, nombre: "AeroClip 2", precioBase: 169.98, recargoPct: 17 } });
  assert.equal(r.precio, "169.98", "el campo de Amazon se llena con el precio base que publica Tiendamia");
  assert.match(r.linea, /Tiendamia tiene este producto a US\$ 198,88, con el envío incluido/);
  assert.match(r.linea, /un 17 % más/);
  const sin = I.leidoDeEnlace({ leido: true, enlace: { tienda: "amazon" },
    item: { fuente: "tiendamia", precio: 198.88, moneda: "USD", envio: 0, nombre: "x", precioBase: null, recargoPct: null } });
  assert.equal(sin.precio, "", "sin precio base no se llena el campo: no se inventa el precio de Amazon");
  assert.doesNotMatch(sin.linea, /% más/);
});

test("Amazon o eBay leidos por su API: la linea trae el precio", () => {
  const a = I.leidoDeEnlace({ leido: true, enlace: { tienda: "amazon" }, item: { precio: 79.99, moneda: "USD", envio: null, nombre: "x" } });
  assert.equal(a.precio, "79.99");
  assert.match(a.linea, /por la API de Amazon/);
  assert.match(I.leidoDeEnlace({ leido: true, enlace: { tienda: "ebay" }, item: { precio: 5, moneda: "USD", nombre: "x" } }).linea, /eBay/);
});

test("Loquieroaca leida: el precio en pesos ya puesto en casa, en un pago y en cuotas", () => {
  const r = I.leidoDeEnlace({ leido: true, enlace: { tienda: "loquieroaca" },
    item: { precio: 538616.1, moneda: "ARS", precioArs: 538616.1, precioCuotas: 598462.33, nombre: "AeroClip 2" } });
  assert.equal(r.precio, null);
  assert.equal(r.ars, true);
  assert.match(r.linea, /\$538\.616 en un pago o \$598\.462 en cuotas, ya puesto en casa/);
});

test("sin leer: se muestra el motivo; una respuesta rara no muestra nada", () => {
  const r = I.leidoDeEnlace({ leido: false, enlace: { tienda: "amazon" }, motivo: "Amazon no se lee sin su API" });
  assert.equal(r.precio, null);
  assert.equal(r.linea, "Amazon no se lee sin su API");
  assert.equal(I.leidoDeEnlace(null), null);
  assert.equal(I.leidoDeEnlace({ leido: true, enlace: { tienda: "tiendamia" }, item: null }), null);
  assert.equal(I.leidoDeEnlace({ leido: false }), null);
});

/* --- El bloque de pegar un link (spec 040): la referencia sin formulario --- */
const escHtml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

test("la ficha de un link de Tiendamia trae la tienda, el codigo y «El mismo en Amazon», sin formulario ni desglose", () => {
  const html = I.fichaEnlaceHtml(I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/soundcore-aeroclip-2"), { esc: escHtml });
  assert.match(html, /<b>Tiendamia<\/b> · código B0HFJ7NVPB/);
  assert.match(html, /«soundcore aeroclip 2»/);
  assert.match(html, /href="https:\/\/tiendamia\.com\.ar\/p\/amz\/b0hfj7nvpb\/soundcore-aeroclip-2" target="_blank" rel="noopener">/);
  assert.match(html, /El mismo en Amazon/);
  assert.match(html, /class="sub chico pl-leido"/);
  assert.doesNotMatch(html, /<input|<form|Copiar el enlace|desglose/i);
});

test("la ficha de Amazon lleva el tag y el rotulo de afiliado; un link no reconocido da el mensaje sin nombrar la calculadora", () => {
  const html = I.fichaEnlaceHtml(I.parsearEnlace("https://www.amazon.com/dp/B0DLGCHL8M"), { esc: escHtml });
  assert.match(html, /B0DLGCHL8M\?tag=lapichincha-20" target="_blank" rel="sponsored noopener"/);
  assert.match(html, /enlace de afiliado/);
  const nada = I.fichaEnlaceHtml(null, { esc: escHtml });
  assert.match(nada, /No reconozco ese link/);
  assert.doesNotMatch(nada, /calcul|precio del producto/i);
  assert.ok(I.fichaEnlaceHtml(I.parsearEnlace("https://amzn.to/3AbCdEf"), { esc: escHtml }).includes("link corto"));
});

test("la linea de la ficha es la referencia leida: el porcentaje contra Amazon de Tiendamia y el «puesto en casa» de Loquieroaca", () => {
  const tm = I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x");
  const l = I.leidoDeEnlace({ leido: true, enlace: { tienda: "tiendamia" },
    item: { fuente: "tiendamia", precio: 198.88, moneda: "USD", envio: 0, nombre: "AeroClip 2", precioBase: 169.98, recargoPct: 17 } });
  assert.match(I.lineaLeida(l, tm), /un 17 % más con envío e impuestos incluidos/);
  assert.doesNotMatch(I.lineaLeida(l, tm), /AeroClip 2/, "el link ya traia nombre: no se repite");
  assert.match(I.lineaLeida(l, I.parsearEnlace("https://tiendamia.com.ar/p/amz/b0hfj7nvpb")), /^«AeroClip 2» · /);
  const lqa = I.leidoDeEnlace({ leido: true, enlace: { tienda: "loquieroaca" },
    item: { precio: 538616.1, moneda: "ARS", precioArs: 538616.1, nombre: "x" } });
  assert.match(I.lineaLeida(lqa, I.parsearEnlace("https://www.loquieroaca.com/products/aeroclip-1589074")), /\$538\.616 en un pago, ya puesto en casa/);
  assert.equal(I.lineaLeida(null, tm), "");
});
