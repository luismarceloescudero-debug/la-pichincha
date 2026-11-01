const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const G = require("../../guardia.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo, desde]
let n = 0;
const fila = (nombre, precio, { lista = 0, antes = 0 } = {}) =>
  [nombre, precio, "https://t.test/" + (n++), "cg", "", lista, antes, "", "", "", ""];

// Un indice chico con una baja propia, ofertas en varias categorias y un equipo sin datos.
const sano = () => ({ generado: "2026-10-19T09:13-03:00", historial: { inicio: "2026-10-07" }, productos: [
  fila("SSD Kingston NV3 1TB NVMe Gen4", 90000, { antes: 120000 }),
  fila("Monitor LG UltraGear 27 IPS 180Hz", 300000, { lista: 400000 }),
  fila("Celular Samsung Galaxy A56 8GB 256GB", 600000, { lista: 800000 }),
  fila("Notebook Lenovo IdeaPad", 900000) ] });

test("mide bajas propias, avisos por categoria, sin datos y ofertas", () => {
  const m = G.medir(sano());
  assert.equal(m.productos, 4);
  assert.equal(m.bajasPropias, 1);
  assert.equal(m.categorias.notebook.avisos, 1);
  assert.equal(m.categorias.notebook.sinDatos, 1);
  assert.equal(m.categorias.componente.ofertas, 1);
  assert.equal(m.categorias.monitor.ofertas, 1);
  assert.ok(m.destacadas >= 3);
});

test("el indice del 18/10: 0 bajas propias en todo el indice con historial es una alarma", () => {
  const idx = sano();
  idx.productos[0][6] = 0;
  const a = G.alarmas(G.medir(idx), null);
  assert.ok(a.some(x => /0 bajas propias/.test(x)), a.join("\n"));
});

test("sin historial todavia no se exige ninguna baja", () => {
  const idx = sano();
  idx.productos[0][6] = 0;
  idx.historial = { inicio: "" };
  assert.ok(!G.alarmas(G.medir(idx), null).some(x => /bajas propias/.test(x)));
});

test("una categoria que tenia ofertas y queda en cero es una alarma", () => {
  const previa = G.medir(sano());
  const idx = sano();
  idx.productos[1][5] = 0;                                  // el monitor ya no tiene rebaja
  const a = G.alarmas(G.medir(idx), previa);
  assert.ok(a.some(x => /Monitores.*sin ofertas/.test(x)), a.join("\n"));
});

test("con otras reglas de oferta la corrida anterior no se compara por categoria (spec 035)", () => {
  const previa = { ...G.medir(sano()), reglas: "034" };
  const idx = sano();
  idx.productos[1][5] = 0;
  assert.ok(!G.alarmas(G.medir(idx), previa).some(x => /sin ofertas/.test(x)));
  assert.ok(!G.alarmas(G.medir(idx), { ...previa, reglas: undefined }).some(x => /sin ofertas/.test(x)), "un guardia.json de antes no tiene reglas");
});

test("el sin datos de una categoria que salta mas de 10 puntos es una alarma", () => {
  const previa = G.medir(sano());
  previa.categorias.smartphone = { avisos: 100, pasan: 90, sinDatos: 5, ofertas: 3 };
  const actual = G.medir(sano());
  actual.categorias.smartphone = { avisos: 100, pasan: 70, sinDatos: 25, ofertas: 3 };
  const a = G.alarmas(actual, previa);
  assert.ok(a.some(x => /Smartphones.*sin datos.*5%.*25%/.test(x)), a.join("\n"));
});

test("un salto de exactamente 10 puntos no es alarma (borde de punto flotante: 8/20 - 6/20 da 0,10000000000000003)", () => {
  const previa = G.medir(sano());
  previa.categorias.smartphone = { avisos: 20, pasan: 14, sinDatos: 6, ofertas: 3 };
  const actual = G.medir(sano());
  actual.categorias.smartphone = { avisos: 20, pasan: 12, sinDatos: 8, ofertas: 3 };
  assert.ok(!G.alarmas(actual, previa).some(x => /Smartphones.*sin datos/.test(x)));
});

test("pocas ofertas para el resumen es una alarma", () => {
  const a = G.alarmas({ ...G.medir(sano()), destacadas: 3 }, null);
  assert.ok(a.some(x => /solo 3 ofertas/.test(x)), a.join("\n"));
});

test("un dia normal no da alarmas", () => {
  const m = { ...G.medir(sano()), destacadas: 40 };
  assert.deepEqual(G.alarmas(m, m), []);
});

test("main escribe guardia.json, el resumen y sale con 3 si hay alarma", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardia-"));
  const idx = sano();
  idx.productos[0][6] = 0;
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify(idx));
  const salida = path.join(dir, "guardia.json"), alarma = path.join(dir, "alarma.md");
  const codigo = G.main(["--indice", path.join(dir, "indice.json"), "--salida", salida, "--alarma", alarma,
                         "--previa", path.join(dir, "no-esta.json")]);
  assert.equal(codigo, 3);
  assert.equal(JSON.parse(fs.readFileSync(salida, "utf8")).bajasPropias, 0);
  assert.match(fs.readFileSync(alarma, "utf8"), /0 bajas propias/);
  // sin alarma: 0 y sin archivo de alarma
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ ...sano(), productos: [
    ...sano().productos, ...Array.from({ length: 12 }, (_, i) => fila("SSD Kingston NV" + (i + 10) + " 1TB NVMe Gen4", 90000, { antes: 120000 + i * 2000 }))] }));
  fs.rmSync(alarma);
  assert.equal(G.main(["--indice", path.join(dir, "indice.json"), "--salida", salida, "--alarma", alarma]), 0);
  assert.equal(fs.existsSync(alarma), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("sin indice no mide nada, y el resumen de GitHub recibe la tabla", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardia-"));
  assert.equal(G.main(["--indice", path.join(dir, "no-esta.json")]), 0);
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ productos: [fila("Mouse Logitech G203", 30000)] }));
  const resumen = path.join(dir, "resumen.md");
  G.main(["--indice", path.join(dir, "indice.json"), "--resumen", resumen]);
  assert.match(fs.readFileSync(resumen, "utf8"), /\| Periféricos \| 1 \| 1 \|/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- Dos ofertas del dia que son el mismo modelo (23/10): red de seguridad sobre el ofertas.json que se publica ----
test("repetidas: dos ofertas publicadas del mismo modelo o familia son una alarma", () => {
  const ofertas = [{ nombre: "Notebook Lenovo V15 G5 Core i5 13420H 32Gb Ssd 512Gb 15.6\" #" },
                   { nombre: "Notebook Lenovo V15 G5 Core i5 13420H 32Gb Ssd 512Gb 15.6\" Wind 11 Pro #" },
                   { nombre: "SSD A", modelo: "SNV3S/1000G" }, { nombre: "SSD B", modelo: "SNV3S/1000G" },
                   { nombre: "Monitor LG 27GP850" }];
  const rep = G.repetidas(ofertas);
  assert.equal(rep.length, 2);
  const lista = G.alarmas({ ...G.medir(sano()), repetidas: rep }, null);
  assert.ok(lista.some(x => /mismo modelo/.test(x) && /Lenovo V15/.test(x)));
  assert.equal(G.repetidas([{ nombre: "Monitor LG 27GP850" }, { nombre: "SSD A", modelo: "X1" }]).length, 0);
});

test("main con --ofertas frena la publicacion si se repite un modelo", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guardia-"));
  const indice = path.join(dir, "indice.json"), ofertas = path.join(dir, "ofertas.json");
  const muchas = Array.from({ length: 12 }, (_, i) => fila(`SSD Marca${i} Modelo${i} 1TB NVMe`, 90000, { antes: 130000 + i * 2000 }));
  fs.writeFileSync(indice, JSON.stringify({ ...sano(), productos: [...sano().productos, ...muchas] }));
  fs.writeFileSync(ofertas, JSON.stringify({ ofertas: [{ nombre: "SSD X 1TB Negro" }, { nombre: "SSD X 1TB Blanco" }] }));
  const log = console.log; console.log = () => {};
  try {
    assert.equal(G.main(["--indice", indice, "--ofertas", ofertas]), 3);
    fs.writeFileSync(ofertas, JSON.stringify({ ofertas: [{ nombre: "SSD X 1TB" }, { nombre: "SSD Y 1TB" }] }));
    assert.equal(G.main(["--indice", indice, "--ofertas", ofertas]), 0);
  } finally { console.log = log; }
});

test("repetidas: la misma notebook con el procesador escrito distinto en dos tiendas es una alarma (30/10)", () => {
  const pares = G.repetidas([{ nombre: "Notebook HP 15.6 250 C5-120U 16GB SSD512GB" }, { nombre: "Notebook HP 250 15.6″ Core 5 120U 16GB 512GB" },
                             { nombre: "Notebook HP 250 15.6″ Core 5 120U 32GB 512GB" }]);
  assert.equal(pares.length, 1);
});
