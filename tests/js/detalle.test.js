/* Spec 042: el detalle de la compra pegado, igual para Amazon, eBay, Tiendamia y Loquieroaca. Amazon tiene un pegado real
   (tests/fixtures/detalle/amazon-2026-10-28.txt, checkout de Amazon.com con AmazonGlobal que pego el dueño el 28/10/2026);
   eBay y Loquieroaca, todavia no: sus casos prueban la lectura tolerante (rotulo + monto), no rotulos vistos. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const I = require("../../js/importar.js");

const AMAZON = fs.readFileSync(path.join(__dirname, "..", "fixtures", "detalle", "amazon-2026-10-28.txt"), "utf8").replace(/\r\n/g, "\n");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FILAS = ["producto", "envio", "importacion", "impuestos", "envioLocal", "total", "pesos"];

test("numeroFlexible entiende los dos formatos: el ultimo separador con 3 cifras es de miles", () => {
  assert.equal(I.numeroFlexible("168.99"), 168.99);
  assert.equal(I.numeroFlexible("1,234.56"), 1234.56);
  assert.equal(I.numeroFlexible("1.234,56"), 1234.56);
  assert.equal(I.numeroFlexible("371.667"), 371667);
  assert.equal(I.numeroFlexible("1.066.508"), 1066508);
  assert.equal(I.numeroFlexible("27,1"), 27.1);
  assert.equal(I.numeroFlexible("0"), 0);
});

test("Amazon: el checkout real del dueño, la promocion de envio resta del envio y la suma da el total", () => {
  const d = I.parsearDetalleAmazon(AMAZON);
  assert.equal(d.tienda, "amazon");
  assert.equal(d.moneda, "USD");
  assert.equal(d.producto, 168.99);
  assert.equal(d.envio, 0, "US$27.10 de envío menos US$27.10 de promoción");
  assert.equal(d.impuestos, 0);
  assert.equal(d.importacion, 41.46);
  assert.equal(d.envioLocal, 0);
  assert.equal(d.total, 210.45);
  assert.equal(d.totalLeido, true);
  assert.deepEqual(d.otros, []);
  assert.deepEqual(d.notas, ["Ya descontado en su fila: «Promoción de envío GRATIS» (−US$ 27,10)."]);
});

test("Amazon: el mismo texto en un renglon con barras, como lo escribio el dueño, da lo mismo", () => {
  const unaLinea = AMAZON.trim().split("\n").join(" / ");
  const a = I.parsearDetalleAmazon(AMAZON), b = I.parsearDetalleAmazon(unaLinea);
  for (const k of ["producto", "envio", "importacion", "impuestos", "total"]) assert.equal(b[k], a[k], k);
});

test("Amazon sin el total: es la suma; con un renglon que no suma, lo avisa", () => {
  const sinTotal = AMAZON.replace(/Total del pedido.*\n/, "");
  assert.equal(I.parsearDetalleAmazon(sinTotal).total, 210.45);
  assert.equal(I.parsearDetalleAmazon(sinTotal).totalLeido, false);
  const roto = AMAZON.replace("US$210.45", "US$250.00");
  assert.match(I.parsearDetalleAmazon(roto).notas.join(" "), /no da el total/);
});

test("un rotulo desconocido queda fuera del desglose pero dentro del total, y se dice", () => {
  const d = I.parsearDetalleAmazon("Productos: US$100.00\nGift wrap: US$5.00\nTotal del pedido: US$105.00");
  assert.deepEqual(d.otros, [{ rotulo: "Gift wrap", monto: 5 }]);
  assert.match(d.notas.join(" "), /No sé en qué fila va «Gift wrap»/);
  assert.equal(d.total, 105);
});

test("sin producto o sin montos, no hay desglose", () => {
  for (const t of [undefined, null, "", "hola", "Total del pedido", "Envío: gratis"])
    assert.equal(I.parsearDetalleAmazon(t), null, String(t));
});

test("eBay (sin fixture real): rotulo + monto con «US $» y coma decimal; un «$» solo es dolar", () => {
  const d = I.parsearDetalleEbay("Subtotal (2 artículos) US $50,00\nEnvío US $10,00\nCargos de importación US $5,00\nTotal US $65,00");
  assert.deepEqual([d.moneda, d.cantidad, d.producto, d.envio, d.importacion, d.total], ["USD", 2, 50, 10, 5, 65]);
  assert.equal(I.parsearDetalleEbay("Item $20\nShipping $5").moneda, "USD");
  assert.equal(I.parsearDetalleEbay("Item $20\nShipping $5").total, 25);
  assert.equal(I.parsearDetalleEbay("Artículo 30,00 EUR\nTotal 30,00 EUR").moneda, "EUR", "eBay de Europa, con la moneda despues");
});

test("Loquieroaca (sin fixture real): un «$» solo es peso, miles con punto", () => {
  const d = I.parsearDetalleLoquieroaca("Producto $ 150.000\nEnvío $ 1.500,50\nImpuestos $ 20.000\nTotal $171.500,50");
  assert.deepEqual([d.moneda, d.producto, d.envio, d.impuestos, d.total], ["ARS", 150000, 1500.5, 20000, 171500.5]);
});

test("Tiendamia en la forma comun: servicios de importacion en «Importación o servicios», IVA en impuestos", () => {
  const d = I.parsearDetalle("tiendamia", "Producto(s) (1)\tAR$187.061\nEnvio Internacional\nAR$9.250\nServicios de Importación\nAR$267.824\n"
    + "IVA e impuestos internos\nAR$41.225\nEnvío Estándar a tu dirección\tAR$22.231\nTotal\tAR$527.590");
  assert.deepEqual([d.moneda, d.producto, d.envio, d.importacion, d.impuestos, d.envioLocal, d.total],
    ["ARS", 187061, 9250, 267824, 41225, 22231, 527590]);
});

test("parsearDetalle elige el parser por tienda; una tienda desconocida no tiene", () => {
  assert.equal(I.parsearDetalle("amazon", AMAZON).total, 210.45);
  assert.equal(I.parsearDetalle("mercadolibre", AMAZON), null);
});

test("las filas son las mismas en los cuatro proveedores", () => {
  const casos = [I.parsearDetalle("amazon", AMAZON), I.parsearDetalle("ebay", "Item US $20\nTotal US $20"),
    I.parsearDetalle("loquieroaca", "Producto $1.000\nTotal $1.000"), I.parsearDetalle("tiendamia", "Productos (1) AR$1.000\nSubtotal AR$1.000")];
  for (const d of casos) assert.deepEqual(I.filasDetalle(d).map(f => f.clave), FILAS, d.tienda);
});

test("total en pesos: en pesos es el total; en dolares, sin cotizacion lo dice y con cotizacion convierte y cita la fuente", () => {
  const pesos = I.filasDetalle(I.parsearDetalle("loquieroaca", "Producto $1.000\nTotal $1.000")).at(-1);
  assert.equal(pesos.texto, "AR$ 1.000");
  const sin = I.filasDetalle(I.parsearDetalleAmazon(AMAZON)).at(-1);
  assert.equal(sin.texto, "sin cotización");
  assert.equal(sin.monto, null);
  const con = I.filasDetalle(I.parsearDetalleAmazon(AMAZON), { valor: 1500, nombre: "dólar tarjeta", fuente: "DolarApi", hora: "14:05" }).at(-1);
  assert.equal(con.monto, 315675);
  assert.equal(con.texto, "AR$ 315.675");
  assert.equal(con.nota, "a AR$ 1.500 (dólar tarjeta, 14:05, DolarApi)");
});

test("detalleHtml: tabla con las filas, notas escapadas y, en Tiendamia, la cuenta de Amazon", () => {
  const html = I.detalleHtml(I.parsearDetalleAmazon(AMAZON), { esc });
  assert.match(html, /<table class="pl-detalle">/);
  assert.equal((html.match(/<tr /g) || []).length, 7);
  assert.match(html, /<th scope="row">Importación o servicios<\/th><td>US\$ 41,46/);
  assert.match(html, /sin cotización/);
  const raro = I.detalleHtml(I.parsearDetalleAmazon("Productos: US$1\n<b>x</b>: US$2"), { esc });
  assert.doesNotMatch(raro, /<b>x<\/b>/, "el rotulo pegado se escapa");
  const tm = I.detalleHtml(I.parsearDetalle("tiendamia", "Productos (1) AR$371.667\nEnvio Internacional AR$9.278\nServicios de Importación AR$16.506\nSubtotal AR$397.451"),
    { esc, item: { precio: 198.88, precioBase: 169.98 } });
  assert.match(tm, /Comprado en Amazon saldría aprox\. AR\$ 343\.443/);
});

test("la ficha de los cuatro proveedores trae el mismo campo; cambia solo la ayuda", () => {
  const links = { amazon: "https://www.amazon.com/dp/B0DLGCHL8M", ebay: "https://www.ebay.com/itm/123456789012",
    tiendamia: "https://tiendamia.com.ar/p/amz/b0hfj7nvpb/x", loquieroaca: "https://www.loquieroaca.com/products/1589074" };
  const ayudas = new Set();
  for (const [tienda, url] of Object.entries(links)) {
    const html = I.fichaEnlaceHtml(I.parsearEnlace(url), { esc });
    assert.match(html, /<label for="pl-carrito">Pegá el detalle de la compra<\/label>/, tienda);
    assert.match(html, /no se envía a ningún lado/, tienda);
    ayudas.add(html.match(/id="pl-carrito-ayuda"[^>]*>([^<]*)/)[1]);
  }
  assert.equal(ayudas.size, 4);
  assert.doesNotMatch(I.fichaEnlaceHtml(null, { esc }), /pl-carrito/);
});
