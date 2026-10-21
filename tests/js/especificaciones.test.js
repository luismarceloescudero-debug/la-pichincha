const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../../js/especificaciones.js");
const B = require("../../js/buscador.js");
const A = require("../../js/analisis.js");

// Filas del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos]
const fila = (nombre, precio, tienda = "cg") =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", 0, 0, "", ""];

const OLED = 'Monitor Gamer Samsung Odyssey OLED G6 27" QHD 300Hz';

test("monitor: tamaño, panel, Hz y resolución salen del título", () => {
  assert.deepEqual(E.clavesDe(OLED), { categoria: "monitor", valores: { pulgadas: 27, panel: "oled", hz: 300, resolucion: "2k" } });
  assert.equal(E.resumen([OLED]), '27" · OLED · 300 Hz · 2K (QHD)');
});

test("PC y notebook: procesador (familia y generación), RAM, almacenamiento y GPU", () => {
  const pc = E.clavesDe("PC Armada Intel Core i5 12400F 32GB RAM 1TB SSD RTX 4060");
  assert.deepEqual(pc.valores, { cpu: "i5-12", ram: 32, rom: 1000, gpu: "rtx 4060" });
  assert.equal(E.clavesDe("PC Gamer AMD Ryzen 5 5600G 16GB 480GB SSD").valores.cpu, "r5-5");
  assert.equal(E.clavesDe("Notebook Lenovo Intel Core i7-13620H 16GB 512GB SSD").valores.cpu, "i7-13");
  assert.equal(E.resumen(["PC Armada Intel Core i5 12400F 32GB RAM 1TB SSD RTX 4060"]), "Core i5 12ª gen · 32 GB de RAM · 1 TB · RTX 4060");
});

test("componentes y celulares: capacidad, tipo y velocidad; RAM y almacenamiento", () => {
  assert.deepEqual(E.clavesDe("Memoria RAM Kingston Fury 16GB DDR4 3200MHz").valores, { capacidad: 16, ddr: "ddr4" });
  assert.deepEqual(E.clavesDe("SSD Kingston NV2 1TB M.2 NVMe").valores, { capacidad: 1000, interfaz: "nvme" });
  assert.deepEqual(E.clavesDe("Celular Samsung Galaxy A55 8GB 256GB").valores, { ram: 8, rom: 256 });
});

test("una categoría sin especificaciones clave no se filtra", () => {
  assert.deepEqual(E.clavesDe("Mouse Logitech G203 Lightsync").valores, {});
  assert.equal(E.mismas(["Mouse Logitech G203"], ["Mouse Razer Viper"]).aplica, false);
});

test("mismas especificaciones: el mismo panel, Hz, tamaño y resolución coinciden aunque cambie el modelo", () => {
  const otro = 'Monitor Gamer MSI MAG 271QP OLED 27" QHD 300Hz';
  const r = E.mismas([OLED], [otro]);
  assert.equal(r.coincide, true);
  assert.deepEqual(r.ok, ["pulgadas", "panel", "hz", "resolucion"]);
});

test("mismas especificaciones: otro panel, otros Hz u otra resolución NO coinciden", () => {
  const r = E.mismas([OLED], ['Monitor Gamer LG UltraGear IPS 27" FHD 165Hz']);
  assert.equal(r.coincide, false);
  assert.deepEqual(r.distintas, ["panel", "hz", "resolucion"]);
  assert.equal(E.mismas([OLED], ['Monitor OLED 27" QHD 240Hz']).coincide, false);
});

test("una especificación que el otro aviso no menciona NO cuenta como coincidencia", () => {
  const r = E.mismas([OLED], ['Monitor Gamer OLED 27" QHD']);       // no dice los Hz
  assert.equal(r.coincide, false);
  assert.deepEqual(r.faltan, ["hz"]);
});

test("una tarjeta con menos de dos especificaciones no alcanza para comparar con justicia", () => {
  assert.equal(E.mismas(['Monitor Gamer 27"'], [OLED]).aplica, false);
});

test("otra categoría nunca coincide", () => {
  assert.equal(E.mismas([OLED], ["PC Armada Intel Core i5 12400F 32GB RAM 1TB SSD"]).coincide, false);
});

// --- Integracion: la comparativa desde una tarjeta (spec 017) ---
const FILAS = [
  fila(OLED, 900000, "cg"),
  fila('Monitor Gamer MSI MAG 271QP OLED 27" QHD 300Hz', 850000, "mx"),
  fila('Monitor Gamer Asus ROG OLED 27" QHD 300Hz', 950000, "gc"),
  fila('Monitor Gamer LG UltraGear IPS 27" FHD 165Hz', 250000, "cg"),
  fila('Monitor Gamer AOC IPS 27" FHD 180Hz', 230000, "mx"),
  fila('Monitor Gamer Dell OLED 32" 4K 240Hz', 1200000, "gc"),
  fila('Monitor Gamer Gigabyte OLED 27" QHD', 800000, "cg"),
];
const IDX = { tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, gc: { nombre: "Gaming City", color: "gc" } } };
const N = FILAS.map(f => B.normalBusq(f[0]));
const ctx = {
  buscarTodo: q => { const c = B.filtroDe(q); return c ? FILAS.filter((f, i) => c(N[i])) : []; },
  comercioDe: f => (IDX.tiendas[f[3]] || {}).nombre || f[3],
  colorDe: f => (IDX.tiendas[f[3]] || {}).color || "fh",
  marcaDe: n => B.marcaDe(n, B.armarMarcasRe(["samsung", "msi", "asus", "lg", "aoc", "dell", "gigabyte"])),
  nivelMarca: () => 1,
  pesos: n => "$" + Math.round(n),
};

test("desde una tarjeta, la comparativa solo trae avisos con sus mismas especificaciones", () => {
  const r = A.analizarConsulta("monitor 27", { ...ctx, referencia: FILAS[0] });
  assert.deepEqual(r.base.map(m => m.f[0]).sort(), FILAS.slice(0, 3).map(f => f[0]).sort());
  assert.equal(r.espec.aplica, true);
  assert.equal(r.espec.comparables, 3);
  assert.equal(r.espec.pocos, false);
  assert.equal(r.espec.resumen, '27" · OLED · 300 Hz · 2K (QHD)');
  assert.ok(r.excl.especificaciones >= 3, "los IPS y el que no dice los Hz quedan afuera");
  assert.ok(A.partesExclusion(r.excl).some(t => /otras especificaciones/.test(t)));
});

test("con menos de tres avisos iguales la comparativa lo dice y no completa con otras familias", () => {
  const r = A.analizarConsulta("monitor 27", { ...ctx, referencia: FILAS[3] });    // IPS 27 FHD 165: hay un solo aviso así
  assert.equal(r.base.length, 1);
  assert.equal(r.espec.pocos, true);
  assert.equal(r.espec.comparables, 1);
});

test("sin tarjeta de referencia la comparativa es la de siempre", () => {
  const r = A.analizarConsulta("monitor 27", ctx);
  assert.equal(r.espec, null);
  assert.equal(r.excl.especificaciones, 0);
  assert.ok(r.base.length >= 6);
});

test("si la tarjeta no dice sus especificaciones, no se filtra y se avisa", () => {
  const sinSpecs = fila('Monitor Gamer 27"', 300000, "cg");
  const r = A.analizarConsulta("monitor 27", { ...ctx, buscarTodo: q => [...ctx.buscarTodo(q), sinSpecs], referencia: sinSpecs });
  assert.equal(r.espec.aplica, false);
  assert.equal(r.excl.especificaciones, 0);
  assert.ok(r.base.length >= 6);
});
