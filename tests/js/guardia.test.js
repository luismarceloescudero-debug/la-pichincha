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

test("el sin datos de una categoria que salta mas de 10 puntos es una alarma", () => {
  const previa = G.medir(sano());
  previa.categorias.smartphone = { avisos: 100, pasan: 90, sinDatos: 5, ofertas: 3 };
  const actual = G.medir(sano());
  actual.categorias.smartphone = { avisos: 100, pasan: 70, sinDatos: 25, ofertas: 3 };
  const a = G.alarmas(actual, previa);
  assert.ok(a.some(x => /Smartphones.*sin datos.*5%.*25%/.test(x)), a.join("\n"));
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
    ...sano().productos, ...Array.from({ length: 12 }, (_, i) => fila("SSD Kingston NV3 1TB NVMe Gen4 " + i, 90000, { antes: 120000 }))] }));
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
