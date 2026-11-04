const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../../generar_vista_hoy.js");

// spec 059: la imagen de vista previa de /hoy/ (la que Telegram muestra en grande) con el lenguaje del Reel v4.
const oferta = (nombre, precio, antes, descuento, extra = {}) => ({ nombre, precio, antes, descuento, comercio: "Max Tecno", url: "https://t.test/" + nombre, ...extra });
const DATOS = { generado: "2026-11-04T10:56-03:00", sitio: "https://ejemplo.test/", ofertas: [
  oferta("Celular Motorola G Max 8/256GB", 749999, 899999, 17),
  oferta("Teclado Mecanico VSG Alnilam Blanco RGB", 72990, 150887, 52, { imagen: "https://img.test/teclado.jpg" }),
  oferta("Auriculares <b>Raros</b>", 1000, 2000, 50),
] };

test("la súper oferta es la de mayor descuento, con su tipo, chips premium, el precio y el de antes tachado", () => {
  const html = V.paginaVista(DATOS);
  const tarjeta = html.split('<div class="der">')[0];
  assert.match(tarjeta, /★ SÚPER OFERTA ★/);
  assert.match(tarjeta, /<span class="tipo">Teclado<\/span> <span class="marca">VSG<\/span> ALNILAM/);
  assert.match(tarjeta, /<span class="num">52<\/span>/);
  assert.match(tarjeta, /<span class="pr">✦ Mecánico<\/span>/);
  assert.match(tarjeta, /<span class="sig">\$<\/span>72\.990<\/span><s>\$150\.887<\/s>/);
  assert.match(tarjeta, /<img src="https:\/\/img\.test\/teclado\.jpg"/);
  assert.match(html, /HOY 04\/11/);
  assert.match(html, /ejemplo\.test\/hoy/);
  assert.doesNotMatch(html, /<b>Raros<\/b>/);                     // texto de terceros escapado
});

test("contra el mismo modelo no se tacha un precio de antes, y una foto rara no entra", () => {
  const datos = { ...DATOS, ofertas: [oferta("Router ASUS RT-AX52", 66700, 88000, 24, { contra: "bajo la mediana de otras 3 tiendas", imagen: 'https://x.test/a".jpg' })] };
  const html = V.paginaVista(datos);
  assert.doesNotMatch(html, /<s>/);
  assert.match(html, /bajo la mediana de otras 3 tiendas/);
  assert.doesNotMatch(html, /<img /);
});

test("un dia flojo dice «La mejor del día» y sin ofertas la imagen sale igual", () => {
  assert.match(V.paginaVista({ ...DATOS, ofertas: [oferta("Teclado VSG Alnilam", 90000, 100000, 10)] }), /LA MEJOR DEL DÍA/);
  assert.match(V.paginaVista({ ...DATOS, ofertas: [] }), /Hoy no hay bajas para destacar/);
});

test("conVista apunta og:image y twitter:image a la imagen del dia, con tamaño y texto alternativo", () => {
  const cab = '<meta property="og:image" content="https://e.test/img/og.png">\n<meta name="twitter:image" content="https://e.test/img/og.png">';
  const html = V.conVista(cab, "https://e.test/hoy/og.png?v=abc", 'Teclado "VSG"');
  assert.match(html, /<meta property="og:image" content="https:\/\/e\.test\/hoy\/og\.png\?v=abc">/);
  assert.match(html, /<meta property="og:image:width" content="1200">/);
  assert.match(html, /<meta property="og:image:height" content="630">/);
  assert.match(html, /og:image:alt" content="Teclado &quot;VSG&quot;"/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/e\.test\/hoy\/og\.png\?v=abc">/);
  assert.equal(V.conVista("<p>sin cabecera</p>", "x", "y"), "<p>sin cabecera</p>");
});

test("la version cambia con la lista y es la misma para la misma lista", () => {
  assert.equal(V.version("a"), V.version("a"));
  assert.notEqual(V.version("a"), V.version("b"));
  assert.match(V.version("a"), /^[0-9a-f]{10}$/);
});

test("sin ofertas.json no rompe la corrida", () => {
  assert.equal(V.main(["no-existe.json", "--salida", "no-existe"]), 0);
});
