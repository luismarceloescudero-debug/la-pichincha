const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");
const A = require("../../js/analisis.js");

// Filas del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos]
const fila = (nombre, precio, tienda = "cg", sellos = "") =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", 0, 0, "", sellos];
const FILAS = [
  fila("Memoria Kingston Fury DDR4 16GB 3200MHz", 1000),
  fila("Memoria Adata XPG DDR4 16GB 3200MHz", 900),
  fila("Memoria Hiksemi Hiker DDR4 16GB 3200MHz", 950, "mx"),
  fila("Memoria Crucial DDR4 16GB 3200MHz", 1100, "gc"),
  fila("Memoria Otra Marca DDR4 16GB 3200MHz", 1050, "mx"),
  fila("Memoria Kingston DDR4 16GB SODIMM notebook", 500),
  fila("Notebook Lenovo 16GB DDR4 512GB SSD", 2000),
  fila("Memoria Kingston DDR4 16GB 3200MHz importada", 700, "cy", "i"),
];
const IDX = { productos: FILAS, tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" },
  gc: { nombre: "Gaming City", color: "gc" }, cy: { nombre: "ComparaYa", color: "cy" } } };

const nivelMarca = n => (/kingston|crucial/i.test(n) ? 2 : /adata/i.test(n) ? 1 : 0);
const N = FILAS.map(f => B.normalBusq(f[0]));
const ctx = {
  buscarTodo: q => { const c = B.filtroDe(q); return c ? FILAS.filter((f, i) => c(N[i])) : []; },
  comercioDe: f => f[4] || (IDX.tiendas[f[3]] || {}).nombre || f[3],
  colorDe: f => (IDX.tiendas[f[3]] || {}).color || "fh",
  marcaDe: n => B.marcaDe(n, B.armarMarcasRe(["kingston", "adata", "hiksemi", "crucial"])),
  nivelMarca,
  pesos: n => "$" + Math.round(n),
};

test("analizarConsulta separa lo comparable de lo que no", () => {
  const r = A.analizarConsulta("ddr4 16gb", ctx);
  assert.equal(r.total, 8);
  assert.equal(r.base.length, 5);
  assert.equal(r.med, 1000);
  assert.deepEqual({ formato: r.excl.formato, equipos: r.excl.equipos, internacionales: r.excl.internacionales },
    { formato: 1, equipos: 1, internacionales: 1 });
  assert.equal(r.internacionales.length, 1);
  assert.equal(r.internacionales[0].f[1], 700);
});

test("la mejor compra es la marca confiable mas barata y la internacional no compite", () => {
  const r = A.analizarConsulta("ddr4 16gb", ctx);
  assert.equal(r.picks[0].clave, "mejor");
  assert.equal(r.picks[0].m.f[1], 1000);
  assert.match(r.picks[0].m.f[0], /Kingston Fury/);
  assert.equal(r.picks[1].clave, "barato");
  assert.equal(r.picks[1].m.f[1], 900);
  assert.ok(r.picks.every(p => !p.m.f[8].includes("i")));
});

test("el ranking de comercios cuenta cada comercio por separado", () => {
  const r = A.analizarConsulta("ddr4 16gb", ctx);
  assert.deepEqual(r.comercios.map(c => [c.nom, c.n]).sort(), [["CompraGamer", 2], ["Gaming City", 1], ["Mexx", 2]]);
});

test("sin resultados devuelve null", () => {
  assert.equal(A.analizarConsulta("zzzxxy", ctx), null);
});

test("si la busqueda pide importados, las internacionales compiten", () => {
  const r = A.analizarConsulta("ddr4 16gb importada", ctx);
  assert.equal(r.excl.internacionales, 0);
  assert.equal(r.internacionales.length, 0);
});
