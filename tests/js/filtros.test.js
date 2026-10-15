const test = require("node:test");
const assert = require("node:assert");
const B = require("../../js/buscador.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, tienda, modelo = "") =>
  [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", "", modelo];

const nivel = n => (/kingston|corsair/i.test(n) ? 2 : 0);
const con = (cambios) => Object.assign(B.filtrosVacios(), cambios);

const a = fila("SSD Kingston NV2 1TB", 80000, "cg");
const b = fila("SSD Hiksemi Wave 1TB", 60000, "gc");
const c = fila("SSD Kit Adaptador + Disco 1TB usado", 40000, "mx");
const d = fila("SSD Corsair MP600 1TB", 120000, "cg");
const todas = [a, b, c, d];

test("sin filtros no cambia nada: mismas filas, mismo orden, nada oculto", () => {
  const otras = new Map();
  const r = B.filtrarGrupos(todas, otras, B.filtrosVacios(), nivel);
  assert.deepStrictEqual(r.filas, todas);
  assert.strictEqual(r.otras, otras);
  assert.strictEqual(r.ocultas, 0);
  assert.strictEqual(B.hayFiltros(B.filtrosVacios()), false);
});

test("hayFiltros se entera de cualquier filtro puesto", () => {
  assert.strictEqual(B.hayFiltros(con({ tiendas: ["cg"] })), true);
  assert.strictEqual(B.hayFiltros(con({ min: 1000 })), true);
  assert.strictEqual(B.hayFiltros(con({ max: 1000 })), true);
  assert.strictEqual(B.hayFiltros(con({ primera: true })), true);
  assert.strictEqual(B.hayFiltros(con({ excluir: "kit" })), true);
  assert.strictEqual(B.hayFiltros(con({ excluir: "  , " })), false);   // solo separadores: no filtra
});

test("por tienda: quedan solo las marcadas, en el mismo orden", () => {
  const r = B.filtrarGrupos(todas, new Map(), con({ tiendas: ["cg", "mx"] }), nivel);
  assert.deepStrictEqual(r.filas, [a, c, d]);
  assert.strictEqual(r.ocultas, 1);
});

test("por precio: los limites incluyen, y se puede poner solo uno", () => {
  assert.deepStrictEqual(B.filtrarGrupos(todas, new Map(), con({ min: 60000, max: 80000 }), nivel).filas, [a, b]);
  assert.deepStrictEqual(B.filtrarGrupos(todas, new Map(), con({ min: 100000 }), nivel).filas, [d]);
  assert.deepStrictEqual(B.filtrarGrupos(todas, new Map(), con({ max: 40000 }), nivel).filas, [c]);
});

test("un minimo mayor que el maximo no se corrige solo: no queda nada", () => {
  const r = B.filtrarGrupos(todas, new Map(), con({ min: 90000, max: 50000 }), nivel);
  assert.deepStrictEqual(r.filas, []);
  assert.strictEqual(r.ocultas, 4);
});

test("solo primera linea usa el nivel de marca 2", () => {
  const r = B.filtrarGrupos(todas, new Map(), con({ primera: true }), nivel);
  assert.deepStrictEqual(r.filas, [a, d]);
});

test("palabrasExcluidas separa por comas y espacios y saca acentos y mayusculas", () => {
  assert.deepStrictEqual(B.palabrasExcluidas("Kit, USADO  Reacondicionado,"), ["kit", "usado", "reacondicionado"]);
  assert.deepStrictEqual(B.palabrasExcluidas(" , "), []);
  assert.deepStrictEqual(B.palabrasExcluidas(""), []);
});

test("excluir palabras: sale el aviso que trae alguna como palabra, no las que la llevan adentro", () => {
  const r = B.filtrarGrupos(todas, new Map(), con({ excluir: "usado, adaptador" }), nivel);
  assert.deepStrictEqual(r.filas, [a, b, d]);
  const e = fila("SSD Kingston Disipador 1TB", 70000, "cg");   // "ipad" no esta en "disipador"
  assert.deepStrictEqual(B.filtrarGrupos([e], new Map(), con({ excluir: "ipad" }), nivel).filas, [e]);
});

test("excluir una medida la trata como palabra entera", () => {
  const x = fila("Memoria 16GB DDR4", 1, "cg"), y = fila("Memoria 8GB DDR4 de 116GB/s", 2, "cg");
  assert.deepStrictEqual(B.filtrarGrupos([x, y], new Map(), con({ excluir: "16gb" }), nivel).filas, [y]);
});

test("los filtros se combinan: tienda, precio, marca y palabras a la vez", () => {
  const r = B.filtrarGrupos(todas, new Map(), con({ tiendas: ["cg"], max: 100000, primera: true, excluir: "usado" }), nivel);
  assert.deepStrictEqual(r.filas, [a]);
});

test("un grupo sigue saliendo con la fila de la tienda marcada aunque otra fuera mas barata", () => {
  const barata = fila("SSD Kingston NV2 1TB", 70000, "gc", "SNV2S/1000G");
  const cara = fila("SSD Kingston NV2 1TB", 80000, "cg", "SNV2S/1000G");
  const otras = new Map([[barata, [cara]]]);
  const r = B.filtrarGrupos([barata, b], otras, con({ tiendas: ["cg"] }), nivel);
  assert.deepStrictEqual(r.filas, [cara]);                   // la de cg, no desaparece el producto
  assert.deepStrictEqual(r.otras.get(cara), [barata]);       // la mas barata pasa a "tambien en"
  assert.strictEqual(r.ocultas, 1);                          // solo `b` queda oculta
});

test("un grupo queda en el lugar que tenia y su representante es la fila mas barata que cumple", () => {
  const g1 = fila("SSD Kingston 1TB", 90000, "cg", "K1"), g2 = fila("SSD Kingston 1TB", 100000, "gc", "K1");
  const g3 = fila("SSD Kingston 1TB", 110000, "mx", "K1");
  const otras = new Map([[g1, [g2, g3]]]);
  const r = B.filtrarGrupos([b, g1, c], otras, con({ min: 95000 }), nivel);
  assert.deepStrictEqual(r.filas, [g2]);
  assert.deepStrictEqual(r.otras.get(g2), [g1, g3]);         // las demas tiendas, de menor a mayor precio
});

test("si ninguna fila del grupo cumple, el producto se oculta", () => {
  const g1 = fila("SSD Kingston 1TB", 90000, "cg", "K1"), g2 = fila("SSD Kingston 1TB", 100000, "gc", "K1");
  const r = B.filtrarGrupos([g1], new Map([[g1, [g2]]]), con({ tiendas: ["mx"] }), nivel);
  assert.deepStrictEqual(r.filas, []);
  assert.strictEqual(r.otras.size, 0);
  assert.strictEqual(r.ocultas, 1);
});

test("filtrar no toca las filas ni el mapa originales", () => {
  const otras = new Map([[a, [d]]]);
  const copia = [...todas];
  B.filtrarGrupos(todas, otras, con({ tiendas: ["gc"] }), nivel);
  assert.deepStrictEqual(todas, copia);
  assert.deepStrictEqual(otras.get(a), [d]);
});
