/* Seccion «Afuera» de la busqueda (spec 022): lo que pinta la pagina con la respuesta del Worker. Funciones puras. */
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../../js/afuera.js");

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FECHA = "2026-10-23T15:00:00.000Z";
const item = (o = {}) => ({ fuente: "ebay", nombre: "Soundcore AeroClip 2", precio: 89.99, moneda: "USD", envio: 24.5, precioArs: null,
  url: "https://www.ebay.com/itm/1?campid=5338", imagen: "https://i.ebayimg.com/a.jpg", afiliado: true, fecha: FECHA, ...o });
const datos = (items, fuentes = [{ id: "ebay", ok: true, n: items.length }]) => ({ consulta: "soundcore aeroclip 2", fecha: FECHA, fuentes, items });

test("la URL del Worker se arma con la consulta; sin Worker configurado no hay URL", () => {
  assert.equal(A.urlConsulta("https://pichincha-afuera.x.workers.dev", "  soundcore aeroclip 2 "),
    "https://pichincha-afuera.x.workers.dev/buscar?q=soundcore%20aeroclip%202");
  assert.equal(A.urlConsulta("", "algo"), "");
  assert.equal(A.urlConsulta("https://w.dev", "   "), "");
});

test("sin respuesta, sin fuentes configuradas o con algo raro no se pinta nada: queda lo de la spec 020", () => {
  for (const d of [null, undefined, {}, { items: [] }, datos([], []), { fuentes: [{ id: "ebay", ok: true }], items: "x" }]) {
    assert.equal(A.afueraHtml(d, { esc }), "", JSON.stringify(d));
    assert.equal(A.afueraHtml(d, { esc, respaldo: "<p>armadas</p>" }), "<p>armadas</p>", "con respaldo, queda el respaldo");
  }
});

test("si ninguna fuente se pudo leer lo dice y deja las busquedas armadas, no desaparece (24/10: Tiendamia con Cloudflare)", () => {
  const html = A.afueraHtml(datos([], [{ id: "tiendamia", ok: false, n: 0 }]), { esc, respaldo: "<p>armadas</p>" });
  assert.match(html, /Ahora no pudimos leer precios de afuera: Tiendamia no respondió\./);
  assert.ok(html.endsWith("<p>armadas</p>"));
  const conAvisos = A.afueraHtml(datos([item()]), { esc, respaldo: "<p>armadas</p>" });
  assert.ok(!conAvisos.includes("armadas"), "con avisos en vivo no hace falta el respaldo");
  assert.ok(A.afueraHtml(datos([], [{ id: "ebay", ok: true, n: 0 }]), { esc, respaldo: "<p>armadas</p>" }).endsWith("<p>armadas</p>"));
});

test("con avisos: lista de menor a mayor, precio en dolares, envio, fuente, afiliado rotulado y sponsored", () => {
  const html = A.afueraHtml(datos([item({ precio: 120, nombre: "Caro" }), item({ precio: 23.47, fuente: "aliexpress", envio: null,
    afiliado: false, url: "https://www.aliexpress.com/item/1.html", nombre: "Barato" })]), { esc });
  assert.ok(html.indexOf("Barato") < html.indexOf("Caro"), "el orden es por precio, aunque llegue desordenado");
  assert.match(html, /US\$ 23,47/);
  assert.match(html, /US\$ 120,00/);
  assert.match(html, /\+ envío US\$ 24,50/);
  assert.match(html, /AliExpress/);
  assert.match(html, /eBay \(EE\.UU\.\)/);
  assert.equal((html.match(/rel="sponsored noopener"/g) || []).length, 1);
  assert.equal((html.match(/enlace de afiliado/g) || []).length, 1);
  assert.match(html, /nunca por comisión/);
  assert.match(html, /<img [^>]*src="https:\/\/i\.ebayimg\.com\/a\.jpg"[^>]*loading="lazy"/);
});

test("el mejor precio de aca va arriba, para comparar", () => {
  const html = A.afueraHtml(datos([item()]), { esc, mejorAca: { precio: 150025, tienda: "Mexx" } });
  assert.match(html, /Mejor precio acá: <b>\$150\.025<\/b> en Mexx/);
  assert.ok(!A.afueraHtml(datos([item()]), { esc }).includes("Mejor precio acá"));
});

test("Tiendamia, Amazon y eBay ya no ofrecen «Calcular puesto en casa»: no hay calculadora a la que saltar (spec 040)", () => {
  for (const fuente of ["tiendamia", "amazon", "ebay"]) {
    const html = A.afueraHtml(datos([item({ fuente })], [{ id: fuente, ok: true, n: 1 }]), { esc });
    assert.ok(!html.includes("Calcular puesto en casa"), fuente);
    assert.ok(!html.includes("#costo"), fuente);
    assert.ok(!html.includes("puesto en casa"), fuente + ": sin precio final en pesos no se estima");
  }
});

test("con avisos, el campo de pegar un link va al pie; sin avisos queda el del respaldo y no se repite", () => {
  const campo = '<div class="pegar-link">campo</div>';
  assert.ok(A.afueraHtml(datos([item()]), { esc, pegarLink: campo }).includes(campo));
  assert.ok(!A.afueraHtml(datos([item()]), { esc }).includes("pegar-link"));
  const vacio = A.afueraHtml(datos([]), { esc, respaldo: "RESPALDO", pegarLink: campo });
  assert.ok(!vacio.includes(campo), "el respaldo ya trae el campo");
});

test("si la fuente ya da el precio puesto en pesos, se muestra ese y no hace falta calcular", () => {
  const html = A.afueraHtml(datos([item({ precioArs: 597646.5, moneda: "USD", fuente: "loquieroaca", afiliado: false })]), { esc });
  assert.match(html, /\$597\.647 puesto en casa/);
  assert.ok(!html.includes("Calcular puesto en casa"));
  assert.match(html, /class="afv-puesto"/);
});

test("el nombre y la URL van escapados; una URL que no es https no se pinta", () => {
  const html = A.afueraHtml(datos([item({ nombre: "<b>x</b>" }), item({ url: "javascript:alert(1)", nombre: "malo" }),
    item({ imagen: "http://x/a.jpg", nombre: "sin foto" })]), { esc });
  assert.ok(!html.includes("<b>x</b>"));
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
  assert.ok(!html.includes("javascript:"));
  assert.ok(!html.includes("malo"));
  assert.ok(!html.includes("http://x/a.jpg"));
});

test("como mucho 8 avisos; las fuentes caidas se nombran", () => {
  const muchos = Array.from({ length: 12 }, (_, i) => item({ precio: 10 + i, nombre: "n" + i }));
  const html = A.afueraHtml(datos(muchos, [{ id: "ebay", ok: true, n: 12 }, { id: "aliexpress", ok: false, n: 0 }]), { esc });
  assert.equal((html.match(/class="afv-item"/g) || []).length, 8);
  assert.match(html, /AliExpress no respondió/);
});

test("fuentes que respondieron sin avisos: lo dice, nombrando donde se busco", () => {
  const html = A.afueraHtml(datos([], [{ id: "ebay", ok: true, n: 0 }, { id: "aliexpress", ok: true, n: 0 }]), { esc });
  assert.match(html, /No encontramos ofertas con envío a Argentina en eBay \(EE\.UU\.\) y AliExpress/);
  assert.match(A.afueraHtml(datos([], [{ id: "ebay", ok: false, n: 0 }]), { esc }), /eBay \(EE\.UU\.\) no respondió/, "si ninguna respondio, lo dice");
  const mixto = A.afueraHtml(datos([], [{ id: "ebay", ok: true, n: 0 }, { id: "amazon", ok: false, n: 0 }]), { esc });
  assert.match(mixto, /en eBay \(EE\.UU\.\)\./);
  assert.match(mixto, /Amazon \(EE\.UU\.\) no respondió/, "la caida no se cuenta como buscada");
});

test("un aviso con precio que no es numero no se pinta", () => {
  const html = A.afueraHtml(datos([item({ precio: "89", nombre: "texto" }), item({ nombre: "bien" })]), { esc });
  assert.ok(!html.includes("texto"));
  assert.ok(html.includes("bien"));
});

test("una moneda que no es dolar se muestra con su codigo", () => {
  const html = A.afueraHtml(datos([item({ moneda: "EUR", precio: 50, envio: null })]), { esc });
  assert.match(html, /EUR 50,00/);
});

test("Tiendamia: el envio y los servicios van en el carrito y se dice asi (no «+ envio US$ 0,00» ni «envio incluido»)", () => {
  const html = A.afueraHtml(datos([item({ fuente: "tiendamia", envio: 0, afiliado: false })], [{ id: "tiendamia", ok: true, n: 1 }]), { esc });
  assert.match(html, /\+ envío y servicios de importación en el carrito/);
  assert.ok(!html.includes("envío incluido"));
  assert.ok(!html.includes("US$ 0,00"));
  assert.match(html, />Tiendamia</);
});
