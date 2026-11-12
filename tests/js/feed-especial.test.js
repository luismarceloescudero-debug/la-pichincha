// Plan v4, seccion 8: /hoy/ especial de Black Friday (20/11 al 01/12) con lo que bajo de verdad contra el piso de 30 dias.
const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../../generar_feed.js");

const BASE = "https://ejemplo.test/la-pichincha";
const fila = (nombre, precio, { antes = 0, lista = 0, tienda = "cg" } = {}) =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", lista, antes, "", "", ""];
const IDX = {
  generado: "2026-11-27T08:12-03:00",
  tiendas: { cg: { nombre: "CompraGamer" } },
  productos: [
    fila("SSD Kingston 1TB", 90000, { antes: 120000 }),
    fila("SSD Crucial 2TB", 150000, { antes: 187500 }),   // -20 %: entra, pero despues de la de -25 %
    fila("Memoria Fury 16GB", 24000, { lista: 30000 }),   // rebaja de la tienda, no del piso: no entra al bloque
    fila("Sin oferta", 5000),
  ],
};
const opts = (diaISO) => ({ baseUrl: BASE, diaISO });

test("dentro de las fechas /hoy/ suma el bloque con la baja contra el piso de 30 dias", () => {
  const html = F.renderHoy(IDX, opts("2026-11-27"));
  assert.match(html, /Black Friday: <span>lo que bajó de verdad<\/span>/);
  assert.match(html, /Comparamos contra el precio más bajo de los últimos 30 días, no contra el precio «antes» que pone la tienda\./);
  assert.match(html, /Piso de los 30 días anteriores: \$120\.000 · bajó 25 %/);
  assert.match(html, /<title>Black Friday: lo que bajó de verdad/);
});

test("el bloque va ordenado por porcentaje de baja y no incluye rebajas que no son del piso", () => {
  const html = F.renderHoy(IDX, opts("2026-11-27"));
  const bloque = html.split('aria-labelledby="bf-t"')[1].split("</section>")[0];
  const pos = re => bloque.search(re);
  assert.ok(pos(/kingston/i) >= 0 && pos(/crucial/i) >= 0);
  assert.ok(pos(/kingston/i) < pos(/crucial/i), "primero la que mas bajo (25 %), despues la de 20 %");
  assert.doesNotMatch(bloque, /fury/i);
});

test("los bordes de la ventana entran y un dia antes o despues /hoy/ queda como siempre", () => {
  assert.match(F.renderHoy(IDX, opts("2026-11-20")), /id="bf-t"/);
  assert.match(F.renderHoy(IDX, opts("2026-12-01")), /id="bf-t"/);
  for (const dia of ["2026-11-19", "2026-12-02"]) {
    const html = F.renderHoy(IDX, opts(dia));
    assert.doesNotMatch(html, /id="bf-t"/);
    assert.doesNotMatch(html, /Black Friday/);
    assert.match(html, /<title>Pichinchas del día/);
  }
});

test("sin ninguna baja propia el bloque no aparece aunque sea Black Friday", () => {
  const sin = { ...IDX, productos: [fila("Sin oferta", 5000), fila("Memoria Fury 16GB", 24000, { lista: 30000 })] };
  const html = F.renderHoy(sin, opts("2026-11-27"));
  assert.doesNotMatch(html, /id="bf-t"/);
  assert.match(html, /<title>Pichinchas del día/);
});

test("sin diaISO explicito usa el dia del indice, sin mirar el reloj", () => {
  assert.match(F.renderHoy(IDX, { baseUrl: BASE }), /id="bf-t"/);                                       // generado = 27/11
  assert.doesNotMatch(F.renderHoy({ ...IDX, generado: "2026-10-09T08:12-03:00" }, { baseUrl: BASE }), /id="bf-t"/);
});

test("el bloque no pasa de 20 ofertas", () => {
  // Descuentos distintos: con diez o mas iguales el sitio los toma por un lote y los descarta (O.LOTE_MIN).
  const muchas = { ...IDX, productos: Array.from({ length: 40 }, (_, i) => fila(`SSD Kingston NV${2000 + i} 1TB`, 90000 - i * 100, { antes: 100000 + i * 1500 })) };
  const html = F.renderHoy(muchas, opts("2026-11-27"));
  const bloque = html.split('aria-labelledby="bf-t"')[1].split("</section>")[0];
  assert.ok((bloque.match(/<li>/g) || []).length <= 20);
});
