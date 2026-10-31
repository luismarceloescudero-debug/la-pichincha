// Base comun de las pruebas e2e (spec 051): cada prueba arranca con los terceros simulados, asi nada depende de la red
// y no se manda un solo pedido real (ni DolarApi, ni GoatCounter, ni las fuentes de Google, ni el Worker).
const { test: base, expect } = require("@playwright/test");

const DOLARES = [
  { casa: "tarjeta", venta: 1700, fechaActualizacion: "2026-10-30T15:00:00.000Z" },
  { casa: "bolsa", venta: 1500, fechaActualizacion: "2026-10-30T15:00:00.000Z" },
  { casa: "oficial", venta: 1450, fechaActualizacion: "2026-10-30T15:00:00.000Z" },
];
const EURO = { moneda: "EUR", venta: 1700, fechaActualizacion: "2026-10-30T15:00:00.000Z" };

const json = cuerpo => ({ status: 200, contentType: "application/json", body: JSON.stringify(cuerpo) });
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

async function simularTerceros(context) {
  await context.route("**://dolarapi.com/**", ruta =>
    ruta.fulfill(json(ruta.request().url().includes("/cotizaciones/eur") ? EURO : DOLARES)));
  await context.route("**://*.goatcounter.com/**", ruta => ruta.fulfill({ status: 204, body: "" }));
  await context.route("**://gc.zgo.at/**", ruta => ruta.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await context.route("**://fonts.googleapis.com/**", ruta => ruta.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await context.route("**://fonts.gstatic.com/**", ruta => ruta.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
  await context.route("**://*.workers.dev/**", ruta => ruta.fulfill(json({ ok: false, error: "simulado" })));
  // Las fotos de las tiendas: un PNG de un pixel, para no salir a internet.
  await context.route(/\.(jpe?g|png|webp)(\?.*)?$/, ruta => {
    if (new URL(ruta.request().url()).hostname === "localhost") return ruta.fallback();
    return ruta.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
  });
}

const test = base.extend({
  context: async ({ context }, usar) => { await simularTerceros(context); await usar(context); },
});

/* Junta los errores de consola, los errores de la pagina y los pedidos fallidos. */
function vigilar(page) {
  const problemas = [];
  // Dos ruidos que pone la simulacion y no el sitio: el script simulado de GoatCounter no tiene el hash de integridad del
  // real, y el Chromium sin interfaz aborta el pedido del manifiesto (no lo usa).
  const ruido = t => /gc\.zgo\.at\/count/.test(t) || /manifest\.webmanifest net::ERR_ABORTED/.test(t);
  const sumar = t => { if (!ruido(t)) problemas.push(t); };
  page.on("console", m => { if (m.type() === "error") sumar("consola: " + m.text()); });
  page.on("pageerror", e => sumar("pagina: " + e.message));
  page.on("requestfailed", r => sumar("pedido: " + r.url() + " " + (r.failure() || {}).errorText));
  return problemas;
}

/* Pesos de «$1.234.567» -> 1234567. */
const pesos = texto => Number(String(texto).replace(/[^\d]/g, ""));

module.exports = { test, expect, vigilar, pesos };
