const test = require("node:test");
const assert = require("node:assert");
const { adelgazar } = require("../../adelgazar_indice.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo, desde]
const CAMPOS = ["nombre", "precio", "url", "tienda", "via", "lista", "antes", "imagen", "sellos", "modelo", "desde"];
const fila = (nombre, precio, antes, imagen) =>
  [nombre, precio, `https://cg.test/${encodeURIComponent(nombre)}`, "cg", "", antes, 0, imagen, "", "", ""];
const indice = productos => ({ generado: "2026-10-17T10:00-03:00", campos: CAMPOS, tiendas: { cg: { nombre: "CompraGamer", color: "cg" } },
  historial: { inicio: "2026-10-07" }, productos });

test("saca la foto de todas las filas y la deja aparte solo para las que pueden ser oferta (spec 057)", () => {
  const oferta = fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 130000, "https://img.test/ram.jpg");
  const comun = fila("Mouse Logitech G203 Lightsync Negro", 30000, 0, "https://img.test/mouse.jpg");
  const sin = fila("Cable HDMI 2 metros", 5000, 0, "");
  const r = adelgazar(indice([oferta, comun, sin]));
  assert.ok(r.indice.productos.every(f => f[7] === ""), "ninguna fila lleva foto en el indice del sitio");
  assert.deepEqual(r.imagenes, { [oferta[2]]: "https://img.test/ram.jpg" });
  assert.equal(r.sacadas, 2);
  // las posiciones no se mueven: el nombre, el precio y la URL siguen donde estaban
  assert.deepEqual(r.indice.productos[0].slice(0, 7), oferta.slice(0, 7));
  assert.equal(r.indice.productos[0].length, oferta.length);
});

test("no toca el indice original ni los demas campos", () => {
  const original = indice([fila("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, 130000, "https://img.test/ram.jpg")]);
  const copia = JSON.stringify(original);
  const r = adelgazar(original);
  assert.equal(JSON.stringify(original), copia);
  assert.deepEqual(r.indice.tiendas, original.tiendas);
  assert.equal(r.indice.generado, original.generado);
});

test("un indice sin campo de imagen queda igual", () => {
  const idx = { campos: ["nombre", "precio", "url", "tienda"], productos: [["a", 1, "https://t.test/a", "cg"]] };
  const r = adelgazar(idx);
  assert.equal(r.indice, idx);
  assert.deepEqual(r.imagenes, {});
  assert.equal(r.sacadas, 0);
});
