/* Spec 041: la base de carritos reales de Tiendamia (datos/tiendamia-cargos.json) tiene forma fija y cuentas que cierran. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = JSON.parse(fs.readFileSync(path.join(__dirname, "../../datos/tiendamia-cargos.json"), "utf8"));
const CATEGORIAS = ["smartphone", "notebook", "monitor", "pc", "componente", "periferico", "otro"];   // ORDEN de js/categorias.js

test("la base tiene al menos el carrito del AeroClip 2 que pego el dueño", () => {
  assert.ok(Array.isArray(base.compras) && base.compras.length >= 1);
  const a = base.compras.find(c => c.url.includes("/b0hfj7nvpb/"));
  assert.deepEqual([a.price, a.merchant_price, a.productos, a.envio, a.servicios, a.subtotal], [198.88, 169.98, 371667, 9278, 16506, 397451]);
});

test("cada compra tiene los campos con su tipo, una categoria del sitio y una ficha de Tiendamia", () => {
  for (const c of base.compras) {
    assert.match(c.fecha, /^\d{4}-\d{2}-\d{2}$/, c.url);
    assert.match(c.url, /^https:\/\/tiendamia\.com\.ar\/p\/amz\/[a-z0-9]{10}\//, c.url);
    assert.ok(CATEGORIAS.includes(c.categoria), c.categoria);
    assert.ok(typeof c.nombre === "string" && c.nombre.length > 3, c.url);
    for (const k of ["price", "merchant_price", "markup", "weight", "productos", "envio", "servicios", "subtotal", "dolar"])
      assert.ok(typeof c[k] === "number" && c[k] >= 0, `${c.url} ${k}`);
    assert.ok(c.price > 0 && c.productos > 0 && c.dolar > 0, c.url);
  }
});

test("las cuentas cierran: subtotal = suma, dolar = productos / price, markup = price - merchant_price; sin repetidos", () => {
  for (const c of base.compras) {
    assert.equal(c.subtotal, c.productos + c.envio + c.servicios, c.url);
    assert.equal(c.dolar, Math.round(c.productos / c.price * 100) / 100, c.url);
    assert.ok(Math.abs(c.price - c.merchant_price - c.markup) < 0.011, c.url);
  }
  const claves = base.compras.map(c => c.url + "|" + c.fecha);
  assert.equal(new Set(claves).size, claves.length);
});
