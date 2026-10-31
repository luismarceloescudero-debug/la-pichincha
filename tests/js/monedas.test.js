/* Spec 043: monitor de monedas y conversion de los desgloses de la spec 042. Las respuestas son las de DolarApi del
   28/10/2026 (recortadas): /v1/dolares y /v1/cotizaciones/eur. Los tests nunca van a la red. */
const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../../js/monedas.js");
const I = require("../../js/importar.js");

const DOLARES = [
  { moneda: "USD", casa: "oficial", nombre: "Oficial", compra: 1510, venta: 1560, fechaActualizacion: "2026-10-28T17:00:00.000Z" },
  { moneda: "USD", casa: "blue", nombre: "Blue", compra: 1545, venta: 1565, fechaActualizacion: "2026-10-28T19:58:00.000Z" },
  { moneda: "USD", casa: "bolsa", nombre: "Bolsa", compra: 1568, venta: 1573.1, fechaActualizacion: "2026-10-28T19:58:00.000Z" },
  { moneda: "USD", casa: "tarjeta", nombre: "Tarjeta", compra: 1963, venta: 2028, fechaActualizacion: "2026-10-28T17:00:00.000Z" },
];
const EUR = { moneda: "EUR", casa: "oficial", nombre: "Euro", compra: 1705.1559, venta: 1719.0216, fechaActualizacion: "2026-10-28T16:52:00.000Z" };
const AHORA = new Date("2026-10-28T20:30:00.000Z");     // 17:30 en Argentina
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

test("la fuente es DolarApi por https, y los dolares ofrecidos son tarjeta (por defecto), MEP y oficial", () => {
  assert.equal(M.FUENTE, "DolarApi");
  assert.deepEqual(M.URLS, { dolares: "https://dolarapi.com/v1/dolares", eur: "https://dolarapi.com/v1/cotizaciones/eur" });
  assert.deepEqual(M.TIPOS.map(t => t.id), ["tarjeta", "bolsa", "oficial"]);
  assert.equal(M.POR_DEFECTO, "tarjeta");
});

test("normalizar se queda con los tres dolares y el euro, con su hora; sin ningun dolar util, null", () => {
  const t = M.normalizar(DOLARES, EUR);
  assert.deepEqual(Object.keys(t.dolares).sort(), ["bolsa", "oficial", "tarjeta"], "el blue no se ofrece");
  assert.deepEqual(t.dolares.tarjeta, { venta: 2028, actualizado: "2026-10-28T17:00:00.000Z" });
  assert.deepEqual(t.eur, { venta: 1719.0216, actualizado: "2026-10-28T16:52:00.000Z" });
  assert.equal(M.normalizar(DOLARES, null).eur, null);
  assert.equal(M.normalizar(DOLARES, { moneda: "USD", venta: 1 }).eur, null);
  for (const malo of [null, undefined, {}, [], [{ casa: "tarjeta", venta: 0 }], [{ casa: "tarjeta", venta: "2028" }], [{ casa: "__proto__", venta: 5 }]])
    assert.equal(M.normalizar(malo, EUR), null, JSON.stringify(malo));
});

test("horaAr: la hora de Argentina, con la fecha si no es de hoy", () => {
  assert.equal(M.horaAr("2026-10-28T17:00:00.000Z", AHORA), "14:00");
  assert.equal(M.horaAr("2026-10-27T17:00:00.000Z", AHORA), "27/10 14:00");
  assert.equal(M.horaAr("cualquier cosa", AHORA), "");
});

test("cotizacion en dolares: el tipo elegido, tarjeta por defecto, con nombre, fuente y hora", () => {
  const t = M.normalizar(DOLARES, EUR);
  assert.deepEqual(M.cotizacion(t, "USD", undefined, AHORA), { valor: 2028, nombre: "dólar tarjeta", fuente: "DolarApi", hora: "14:00" });
  assert.equal(M.cotizacion(t, "USD", "bolsa", AHORA).valor, 1573.1);
  assert.equal(M.cotizacion(t, "USD", "bolsa", AHORA).nombre, "dólar MEP");
  assert.equal(M.cotizacion(t, "USD", "oficial", AHORA).valor, 1560);
  assert.equal(M.cotizacion(t, "USD", "inventado", AHORA).valor, 2028, "un tipo desconocido cae en el de por defecto");
});

test("cotizacion en euros: el euro oficial pasado al dolar elegido por el cruce oficial", () => {
  const t = M.normalizar(DOLARES, EUR);
  assert.equal(M.cotizacion(t, "EUR", "oficial", AHORA).valor, 1719.0216);
  const tarjeta = M.cotizacion(t, "EUR", "tarjeta", AHORA);
  assert.ok(Math.abs(tarjeta.valor - 1719.0216 / 1560 * 2028) < 1e-9);
  assert.equal(tarjeta.nombre, "euro al dólar tarjeta");
  assert.equal(tarjeta.hora, "13:52", "la hora mas vieja de las dos que usa");
  assert.equal(M.cotizacion(M.normalizar(DOLARES, null), "EUR", "tarjeta", AHORA), null, "sin euro no se inventa");
});

test("sin tasas o sin el dolar elegido, no hay cotizacion; otra moneda tampoco", () => {
  assert.equal(M.cotizacion(null, "USD"), null);
  assert.equal(M.cotizacion(M.normalizar([DOLARES[0]], null), "USD", "tarjeta"), null);
  assert.equal(M.cotizacion(M.normalizar(DOLARES, EUR), "GBP"), null);
});

test("una cotizacion de hace mas de 4 dias se marca vieja, en la hora y en el monitor", () => {
  const t = M.normalizar(DOLARES, EUR), despues = new Date("2026-11-02T20:30:00.000Z");
  assert.equal(M.cotizacion(t, "USD", "tarjeta", despues).hora, "28/10 14:00, vieja");
  assert.match(M.monitorHtml(t, { esc, ahora: despues }), /mn-vieja/);
  assert.doesNotMatch(M.monitorHtml(t, { esc, ahora: AHORA }), /mn-vieja/);
});

test("el monitor muestra los tres dolares y el euro con su hora, la fuente y el tarjeta elegido", () => {
  const html = M.monitorHtml(M.normalizar(DOLARES, EUR), { esc, ahora: AHORA });
  assert.match(html, /Monedas en vivo/);
  assert.match(html, /fuente DolarApi/);
  for (const n of ["Dólar tarjeta", "Dólar MEP", "Dólar oficial", "Euro"]) assert.match(html, new RegExp(n), n);
  assert.match(html, /\$ 2\.028/);
  assert.match(html, /\$ 1\.573,1/);
  assert.match(html, /\$ 1\.719,02/);
  assert.match(html, /value="tarjeta" checked/);
  assert.match(M.monitorHtml(M.normalizar(DOLARES, EUR), { esc, tipo: "bolsa" }), /value="bolsa" checked/);
});

test("sin cotizacion el monitor lo dice, y mientras consulta tambien", () => {
  assert.match(M.monitorHtml(null, { esc }), /Sin cotización: DolarApi no respondió/);
  assert.match(M.monitorHtml(null, { esc, cargando: true }), /Consultando la cotización/);
});

test("el desglose de Amazon en dolares pasa a pesos al dolar tarjeta, citando la cotizacion", () => {
  const d = I.parsearDetalleAmazon("Productos: US$168.99\nCargos de importación: US$41.46\nTotal del pedido: US$210.45");
  const fila = I.filasDetalle(d, M.cotizacion(M.normalizar(DOLARES, EUR), d.moneda, "tarjeta", AHORA)).at(-1);
  assert.equal(fila.monto, Math.round(210.45 * 2028));
  assert.equal(fila.texto, "AR$ 426.793");
  assert.equal(fila.nota, "a AR$ 2.028 (dólar tarjeta, 14:00, DolarApi)");
  const sin = I.filasDetalle(d, M.cotizacion(null, d.moneda)).at(-1);
  assert.equal(sin.texto, "sin cotización", "si DolarApi no respondio, no se convierte");
});

test("el bloque de pegar un link trae el lugar del monitor", () => {
  assert.match(I.pegarLinkHtml(), /<div class="pl-monedas"><\/div>/);
});
