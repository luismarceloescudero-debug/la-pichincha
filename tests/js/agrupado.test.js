const test = require("node:test");
const assert = require("node:assert");
const B = require("../../js/buscador.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, tienda, modelo = "") =>
  [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", "", modelo];

const SSD = "KF432C16BB1/16";
const a = fila("Memoria Kingston Fury 16GB KF432C16BB1/16", 100, "cg", SSD);
const b = fila("MEMORIA 16GB DDR4 3200 KINGSTON KF432C16BB1/16", 90, "gc", SSD);
const c = fila("Memoria Kingston Fury 16GB KF432C16BB1/16", 120, "fh", SSD);
const suelta = fila("Memoria Adata 8GB", 50, "cg");
const unica = fila("Memoria Corsair CMK16GX4M2B3200C16", 200, "cg", "CMK16GX4M2B3200C16");

test("el mismo codigo en tiendas distintas es un solo producto con la fila mas barata", () => {
  const { filas, otras } = B.agruparPorModelo([a, b, c]);
  assert.deepStrictEqual(filas, [b]);
  assert.deepStrictEqual(otras.get(b), [a, c]);              // las otras tiendas, de menor a mayor precio
});

test("sin codigo, con codigo unico o de una sola tienda queda suelto, en su lugar", () => {
  const { filas, otras } = B.agruparPorModelo([suelta, unica, a, b]);
  assert.deepStrictEqual(filas, [suelta, unica, b]);
  assert.strictEqual(otras.size, 1);
});

test("una tienda con dos avisos del mismo codigo no forma grupo por si sola", () => {
  const dup = fila("Memoria Kingston 16GB KF432C16BB1/16 otro listado", 95, "cg", SSD);
  const { filas, otras } = B.agruparPorModelo([a, dup]);
  assert.deepStrictEqual(filas, [a, dup]);
  assert.strictEqual(otras.size, 0);
});

test("dentro de un grupo, una tienda con dos avisos aparece una vez con su precio mas bajo y el otro queda suelto", () => {
  const caro = fila("Memoria Kingston 16GB KF432C16BB1/16 caja", 130, "cg", SSD);
  const { filas, otras } = B.agruparPorModelo([caro, a, b]);
  assert.deepStrictEqual(filas, [caro, b]);                  // el grupo en el lugar del primero que aparece
  assert.deepStrictEqual(otras.get(b), [a]);
});

test("mismo resultado sin importar el orden en que llegan las filas", () => {
  const sets = [[a, b, c, suelta], [c, suelta, b, a], [suelta, a, c, b]];
  const vistos = sets.map(s => {
    const { filas, otras } = B.agruparPorModelo(s);
    const grupo = filas.find(f => otras.has(f));
    return JSON.stringify([grupo, otras.get(grupo)]);
  });
  assert.strictEqual(new Set(vistos).size, 1);
});

test("capacidades distintas con el mismo codigo no se agrupan; 1.92TB y 1920GB si", () => {
  const x = fila("Disco SSD 480GB Kingston SEDC600M/480G", 100, "gc", "SEDC600M");
  const y = fila("HD SSD 1.92TB KINGSTON DC600M SEDC600M", 300, "fh", "SEDC600M");
  assert.deepStrictEqual(B.agruparPorModelo([x, y]).filas, [x, y]);
  const p = fila("Disco Ssd 1920Gb Kingston SEDC600M", 290, "gc", "SEDC600M");
  const { filas, otras } = B.agruparPorModelo([p, y]);
  assert.deepStrictEqual(filas, [p]);
  assert.deepStrictEqual(otras.get(p), [y]);
});

test("un aviso sin capacidad en el nombre es compatible con el que la dice", () => {
  const x = fila("Placa de Video Asus DUAL-RTX3060-O12G", 900, "cg", "DUAL-RTX3060-O12G");
  const y = fila("Tarjeta De Video 12 Gb Asus Dual-rtx3060-o12g", 800, "ci", "DUAL-RTX3060-O12G");
  const { filas } = B.agruparPorModelo([x, y]);
  assert.strictEqual(filas.length, 1);
});

test("filas de un indice viejo, sin la columna modelo, no se agrupan", () => {
  const vieja = a.slice(0, 9), vieja2 = b.slice(0, 9);
  assert.deepStrictEqual(B.agruparPorModelo([vieja, vieja2]).filas, [vieja, vieja2]);
});

test("textoConteo dice productos y avisos solo cuando hay grupos", () => {
  assert.strictEqual(B.textoConteo(41, 41), "41 resultados");
  assert.strictEqual(B.textoConteo(1, 1), "1 resultado");
  assert.strictEqual(B.textoConteo(41, 58), "41 productos en 58 avisos");
});

// ComparaYa lista a muchos comercios con una sola clave de tienda: el comercio es la tienda (f[4]), y uno que llega directo
// y por ComparaYa es el mismo comercio.
const via = (nombre, precio, comercio, modelo = "") =>
  [nombre, precio, `https://${comercio}.test/${encodeURIComponent(nombre)}`, "comparaya", comercio, 0, 0, "", "", modelo];

test("dos comercios que llegan por ComparaYa son dos tiendas, aunque compartan la clave comparaya", () => {
  const x = via("Monitor Samsung LS27DG300ELXZB", 300, "Fravega", "LS27DG300ELXZB");
  const y = via("Monitor Samsung 27 LS27DG300ELXZB", 280, "Musimundo", "LS27DG300ELXZB");
  const { filas, otras } = B.agruparPorModelo([x, y]);
  assert.deepStrictEqual(filas, [y]);
  assert.deepStrictEqual(otras.get(y), [x]);
});

test("el mismo comercio directo y por ComparaYa cuenta una vez, con el nombre que le pasa quien llama", () => {
  const directa = fila("Monitor Samsung LS27DG300ELXZB", 300, "cg", "LS27DG300ELXZB");
  const agregador = via("Monitor Samsung 27 LS27DG300ELXZB", 310, "CompraGamer", "LS27DG300ELXZB");
  const nombre = f => f[4] || { cg: "CompraGamer" }[f[3]] || f[3];
  assert.strictEqual(B.agruparPorModelo([directa, agregador], nombre).otras.size, 0);
  assert.strictEqual(B.agruparPorModelo([directa, agregador]).otras.size, 1);       // sin el nombre, parecen dos tiendas
});

test("unaPorUrl: el aviso VTEX que llega directo y por ComparaYa queda una vez, el directo", () => {
  const directa = ["Celular Moto G06", 199999, "https://www.oncity.com/celular-moto-g06-158039/p", "oncity", ""];
  const agregador = ["Celular Moto G06", 229999, "https://oncity.com/celular-moto-g06-158039/p/?utm_source=comparaya", "comparaya", "OnCity"];
  const variante = ["Celular Moto G06", 209999, "https://www.oncity.com/celular-moto-g06-158039/p?variante=2", "comparaya", "OnCity"];
  assert.deepStrictEqual(B.unaPorUrl([agregador, directa, variante]), [directa, variante]);
  assert.deepStrictEqual(B.unaPorUrl([directa, agregador]), [directa]);
  assert.strictEqual(B.urlClave("https://WWW.oncity.com/a/p/?gclid=1&b=2&a=1"), "oncity.com/a/p?a=1&b=2");
});
