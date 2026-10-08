const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");

test("mediana con cantidad par, impar y vacia, sin tocar el original", () => {
  const nums = [4, 1, 3, 2];
  assert.equal(B.mediana([]), 0);
  assert.equal(B.mediana([3, 1, 2]), 2);
  assert.equal(B.mediana(nums), 2.5);
  assert.deepEqual(nums, [4, 1, 3, 2]);
});

test("normalBusq saca acentos y pega la cifra con su unidad", () => {
  assert.equal(B.normalBusq("Memoria 16 GB Ñandú 3200 MHz"), "memoria 16gb nandu 3200mhz");
});

test("una medida tiene que ser palabra entera", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("2tb")(n("Disco 12TB Seagate")), false);
  assert.equal(B.filtroDe("2tb")(n("Disco Seagate 2 TB")), true);
  assert.equal(B.filtroDe("27")(n("Monitor Vp227hf")), false);
  assert.equal(B.filtroDe("monitor 27")(n('Monitor Samsung 27" Curvo')), true);
  assert.equal(B.filtroDe("kingston")(n("Memoria KINGSTON Fury")), true);
  assert.equal(B.filtroDe("   "), null);
});

test("pisoDeGama es mas exigente sin marca reconocida", () => {
  assert.equal(B.pisoDeGama(400, 0, 1000), true);
  assert.equal(B.pisoDeGama(400, 2, 1000), false);
  assert.equal(B.pisoDeGama(300, 2, 1000), true);
});

test("ordenar por precio, por marca y recomendado", () => {
  const nivel = n => (/kingston/i.test(n) ? 2 : /hiksemi/i.test(n) ? 1 : 0);
  const filas = [["Generica 16GB", 300], ["Kingston 16GB", 900], ["Hiksemi 16GB", 800], ["Otra 16GB", 1000]];
  const nombres = r => r.map(f => f[0].split(" ")[0]);
  assert.deepEqual(nombres(B.ordenar(filas, 900, "precio", nivel)), ["Generica", "Hiksemi", "Kingston", "Otra"]);
  assert.deepEqual(nombres(B.ordenar(filas, 900, "marca", nivel)), ["Kingston", "Hiksemi", "Generica", "Otra"]);
  // Recomendado: primero la marca mas confiable, y al fondo el piso de gama (300 < 45% de 900).
  assert.deepEqual(nombres(B.ordenar(filas, 900, "recomendado", nivel)), ["Kingston", "Hiksemi", "Otra", "Generica"]);
  assert.equal(filas[0][0], "Generica 16GB");
});

test("la marca es la primera que aparece, con alias", () => {
  const re = B.armarMarcasRe(["intel", "hp", "kingston", "xpg", "western digital"]);
  assert.equal(B.marcaDe("Notebook HP Intel Core i5", re), "hp");
  assert.equal(B.marcaDe("Memoria XPG Gammix D35", re), "adata");
  assert.equal(B.marcaDe("Disco Western Digital Blue 1TB", re), "wd");
  assert.equal(B.marcaDe("Mouse generico", re), "");
});

test("specsDe lee lo que dice el nombre", () => {
  assert.deepEqual(B.specsDe("Memoria Kingston Fury DDR4 16GB 3200MHz CL16 RGB"),
    { Tipo: "DDR4", Capacidad: "16GB", Velocidad: "3200 MHz", Latencia: "CL16", Luces: "RGB" });
  assert.deepEqual(B.specsDe("SSD Kingston NV2 1TB M.2 NVMe"), { Capacidad: "1TB", Formato: "M.2 NVMe" });
  assert.deepEqual(B.specsDe('Monitor Samsung 27" 165Hz FHD'),
    { Pantalla: '27"', Refresco: "165 Hz", "Resolución": "FHD" });
});

test("motivoExclusion respeta lo que pide la busqueda", () => {
  const m = (nombre, q) => {
    const nq = B.normalBusq(q);
    return B.motivoExclusion(B.normalBusq(nombre), nq, nq.split(/\s+/).filter(Boolean));
  };
  assert.equal(m("SSD Kingston 480GB para notebook", "ssd 480gb"), null);
  assert.equal(m("Notebook Lenovo 16GB SSD 512GB", "ssd 512gb"), "equipos");
  assert.equal(m("Notebook Lenovo 16GB SSD 512GB", "notebook lenovo"), null);
  assert.equal(m("HD SSD 960GB Kingston SIMIL 1TB", "ssd 1tb"), "similares");
  assert.equal(m("Silla gamer simil cuero negra", "silla"), null);
  assert.equal(m("Cable SATA para SSD", "ssd"), "accesorios");
  assert.equal(m("Cable SATA para SSD", "cable sata"), null);
  assert.equal(m("Disco rigido WD Blue 1TB", "ssd 1tb"), "tipo");
  assert.equal(m("SSD Kingston A400 1TB", "disco rigido 1tb"), "tipo");
  assert.equal(m("Memoria Kingston 16GB SODIMM", "memoria 16gb"), "formato");
  assert.equal(m("Memoria Kingston 16GB SODIMM", "memoria sodimm 16gb"), null);
  assert.equal(m("Placa de video RTX 3060 outlet", "rtx 3060"), "usados");
});

test("categoriaDe es la primera palabra en singular", () => {
  assert.equal(B.categoriaDe("Auriculares Samsung Galaxy"), "auricular");
  assert.equal(B.categoriaDe("Monitores LG 27"), "monitor");
  assert.equal(B.categoriaDe("Memorias Kingston"), "memoria");
  assert.equal(B.categoriaDe("SSD Kingston"), "ssd");
  assert.equal(B.categoriaDe("Mouse Logitech"), "mouse");
});
