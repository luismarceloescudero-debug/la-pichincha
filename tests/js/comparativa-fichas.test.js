/* Spec 063, fase A: las tarjetas y la tabla de la Comparativa muestran las MISMAS especificaciones, con la etiqueta de cada una.
   Antes cada tarjeta mostraba lo que su titulo daba la casualidad de decir: un Ryzen 7 en una tarjeta y nada en la vecina. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const GP = require("../../generar_portada.js");
const E = require("../../js/especificaciones.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const fila = (nombre, precio, tienda) => [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", ""];

function app(productos) {
  const doc = { querySelector: () => ({ dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const ctx = GP.contexto(leer("index.html"), leer, { document: doc, setTimeout() {}, clearTimeout() {},
    localStorage: { getItem: () => null, setItem() {} } });
  ctx.__idx = { generado: "2026-10-23T10:00-03:00", tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, gc: { nombre: "Gaming City", color: "gc" } }, productos };
  vm.runInContext("IDX = __idx", ctx);
  return codigo => vm.runInContext(codigo, ctx);
}

const NOTEBOOKS = [
  fila("Notebook Lenovo IdeaPad AMD Ryzen 7 5700U 16GB 512GB SSD 15.6\"", 900000, "cg"),
  fila("Notebook HP 250 G9 16GB 512GB SSD", 800000, "mx"),                       // el titulo no dice el procesador
  fila("Notebook Asus Vivobook Intel Core i5 1235U 16GB 512GB SSD 15.6\"", 1000000, "gc"),
];

test("fichaDe: una fila por especificacion de la categoria, con etiqueta, y vacia cuando el titulo no la dice", () => {
  const f = E.fichaDe("Notebook HP 250 G9 16GB 512GB SSD");
  assert.equal(f.categoria, "notebook");
  assert.deepEqual(f.filas.map(r => r.clave), ["cpu", "ram", "rom", "gpu", "pantalla"]);
  assert.deepEqual(f.filas.map(r => r.texto), ["", "16 GB", "512 GB", "", ""]);
  assert.equal(E.fichaDe("Notebook Lenovo Ryzen 7 5700U 16GB 512GB").filas[0].texto, "Ryzen 7 serie 5000");
});

test("celular: red y pantalla salen del titulo; el modelo suelto no es pantalla", () => {
  const f = E.fichaDe('Celular Motorola Signature 5G 16GB 1TB 6.9 Pulgadas');
  assert.deepEqual(f.filas.map(r => r.texto), ["16 GB", "1 TB", "5G", '6.9"']);
  assert.equal(E.fichaDe("Notebook Lenovo IdeaPad 15 Ryzen 5 8GB 256GB").filas.find(r => r.clave === "pantalla").texto, "");
});

test("la Comparativa muestra el procesador en cada tarjeta: el valor o «no informa», nunca nada", () => {
  const correr = app(NOTEBOOKS);
  correr('fijarConsulta("notebook")');
  const html = correr("vistaComparativaDin()");
  const opciones = html.slice(0, html.indexOf('class="franja"'));          // las tarjetas de opciones, no las de comercios
  const tarjetas = opciones.split('<a class="dcard').slice(1);
  assert.ok(tarjetas.length >= 2, "hay al menos dos opciones");
  for (const t of tarjetas) assert.match(t, /<span class="eti">Procesador<\/span>/);
  assert.match(html, /Ryzen 7 serie 5000/);
  assert.match(html, /Procesador<\/span> no informa/);
});

test("la tabla repite las especificaciones con las mismas etiquetas y «no informa» donde falta", () => {
  const correr = app(NOTEBOOKS);
  correr('fijarConsulta("notebook")');
  const tabla = correr("tablaPicks(ANALISIS.picks)");
  assert.match(tabla, /<th>Procesador<\/th>/);
  assert.match(tabla, /<th>RAM<\/th>/);
  assert.match(tabla, /no informa/);
});

test("una especificacion que ninguna tarjeta dice no se muestra (no se llena de «no informa»)", () => {
  const correr = app(NOTEBOOKS);
  correr('fijarConsulta("notebook")');
  assert.doesNotMatch(correr("tablaPicks(ANALISIS.picks)"), /<th>Gráficos<\/th>/);
});
