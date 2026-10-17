const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");
const C = require("../../js/categorias.js");
const O = require("../../js/ofertas.js");

// Cada tienda publica el mismo producto con otra tipografia. Lo que se busca tiene que encontrarlo igual.
const halla = (consulta, titulo) => B.filtroDe(consulta)(B.normalBusq(titulo));

test("busqueda: guiones, espacios duros y guiones largos no cambian el resultado", () => {
  assert.equal(halla("b840m h", "Mother GIGABYTE B840M-H DDR5"), true);
  assert.equal(halla("b840m-h", "Motherboard GIGABYTE B840M H AM5 DDR5"), true);
  assert.equal(halla("b840m-h", "Mother GIGABYTE B840M–H DDR5"), true);
  assert.equal(halla("h410m-a pro", "MOTHER MSI H410M-A PRO DDR4 LGA1200"), true);
  assert.equal(halla("h410m a", "MOTHER MSI H410M A PRO DDR4"), true);
  assert.equal(halla("i5-13420h", "Notebook HP Intel Core i5 13420H 16GB"), true);
  assert.equal(halla("ddr4 3200", "Memoria Kingston DDR4-3200 16GB"), true);
  assert.equal(halla("tp-link", "Router TP Link Archer"), true);
});

test("busqueda: UDIMM, SODIMM y sus variantes de escritura", () => {
  for (const t of ["Hiksemi Hiker Ddr4 32Gb 3200Mhz U-Dimm", "Memoria Patriot Udimm Pc", "Memoria U DIMM 16GB"]) assert.equal(halla("udimm", t), true, t);
  for (const t of ["SODIMM DDR5 8GB", "Memoria SO-DIMM DDR4", "Memoria so dimm 8gb"]) assert.equal(halla("sodimm", t), true, t);
  assert.equal(halla("u-dimm", "Memoria Patriot Udimm Pc"), true);
  assert.equal(halla("so-dimm", "SODIMM DDR5 8GB"), true);
  assert.equal(halla("udimm", "SODIMM DDR5 8GB"), false);
});

test("busqueda: las capacidades se escriben de muchas formas y son la misma", () => {
  for (const t of ["SSD Kingston 1TB", "SSD Kingston 1 Tb", "SSD Kingston 1000GB", "SSD Kingston 1024 GB", "SSD Kingston 1tb"]) {
    assert.equal(halla("ssd 1tb", t), true, t);
    assert.equal(halla("ssd 1000gb", t), true, t);
  }
  assert.equal(halla("ssd 2tb", "SSD WD 2048GB"), true);
  assert.equal(halla("ssd 1tb", "SSD WD 2TB"), false);
  assert.equal(halla("ssd 500gb", "SSD WD 1000GB"), false);
  assert.equal(halla("16gb", "VGA RTX 5070 Ti 16G GDDR7"), true);
  assert.equal(halla("rtx 5070 ti 16g", "Placa de video RTX 5070 Ti 16GB"), true);
  assert.equal(halla("1tb", "Disco 11TB"), false);                        // una medida es palabra entera
});

test("busqueda: lo que ya andaba sigue andando", () => {
  assert.equal(halla("sa400s37/480g", "SSD Kingston SA400S37/480G"), true);
  assert.equal(halla("ipad", "Disipador Cooler"), false);
  assert.equal(halla("27", "Monitor Vp227hf"), false);
  assert.equal(halla("27", 'Monitor 27" Led'), true);
});

test("categorias: pulgadas con todas las comillas y con coma decimal", () => {
  for (const [titulo, esperado] of [['Monitor LG 27" IPS 165Hz', 27], ["Monitor LG 27″ IPS 165Hz", 27], ["Monitor LG 27” IPS 165Hz", 27],
      ["Monitor LG 27'' IPS 165Hz", 27], ["Monitor LG 27 pulgadas IPS 165Hz", 27], ["Monitor LG 23,8″ IPS 165Hz", 23.8], ["Monitor LG 23.8 IPS 165Hz", 23.8]]) {
    const e = C.evaluar(titulo);
    if (esperado < 24) assert.equal(e.pasa, false, titulo);
    else assert.equal(e.pasa, true, titulo);
  }
  assert.match(C.evaluar("Monitor LG 23,8″ IPS 165Hz").motivo, /23\.8" \(mínimo 24"\)/);
});

test("categorias: la VRAM se lee tambien como 6G y la RAM de un celular con otras palabras", () => {
  assert.equal(C.evaluar("VGA RTX 4050 6G GDDR6").pasa, false);
  assert.equal(C.evaluar("VGA 16GB RTX 5070 TI ASUS TUF GAMING OC 16G GDDR7").nivel, "alta");
  const ref = C.referencia([]);
  for (const t of ["Celular Moto G 8GB de memoria RAM 256GB", "Celular Moto G RAM: 8 GB 256GB", "Celular Moto G Memoria RAM 8 GB Almacenamiento 256 GB",
      "Celular Moto G 256GB 8GB RAM", "Celular Moto G 8GB | 256GB", "Celular Moto G 8 GB + 256 GB"]) {
    assert.equal(C.memoriaDe(t).ram, 8, t);
    assert.equal(C.memoriaDe(t).rom, 256, t);
    assert.equal(C.evaluar(t, ref).pasa, true, t);
  }
});

test("el mismo aviso con la URL escrita distinto cuenta una sola vez (www, barra final, parametros de seguimiento)", () => {
  const fila = (url, via = "") => ["Smart Tv Acer 55", 216200, url, via ? "comparaya" : "cg", via, 0, 292817, "", "", ""];
  const a = fila("https://www.tienda.test/producto/tv-acer-55/");
  const b = fila("http://tienda.test/producto/tv-acer-55?utm_source=comparaya&utm_medium=cpc", "Tienda");
  const c = fila("https://tienda.test/producto/tv-acer-55?variante=2");
  assert.equal(O.calcularOfertas({ productos: [a, b] }).propias.length, 1);
  assert.equal(O.calcularOfertas({ productos: [b, a] }).propias[0][3], "cg");                      // gana la fila directa
  assert.equal(O.calcularOfertas({ productos: [a, c] }).propias.length, 2);                        // otra variante: otro aviso
});
