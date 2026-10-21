const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../../generar_consultas.js");

// Fila del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos]
let n = 0;
const fila = (nombre, precio, tienda) => [nombre, precio, "https://t.test/" + (n++), tienda, "", 0, 0, "", ""];
const tiendas = { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, fh: { nombre: "FullH4rd", color: "fh" } };
const marcas = { primera: ["asus", "gigabyte"], conocida: ["msi"] };
const ctxDe = productos => C.contexto({ generado: "2026-10-21T08:00-03:00", tiendas, productos }, { marcas });

// 8 placas RTX 5060 Ti 16GB en 3 tiendas, 2 de la 5070 (pocas) y 8 monitores 27" FHD 180Hz
const placas = ["Asus", "Gigabyte", "Msi", "Zotac", "Palit", "Galax", "Gainward", "Inno3d"]
  .map((m, i) => fila(`Placa de Video ${m} GeForce RTX 5060 Ti 16GB GDDR7`, 900 + i * 10, ["cg", "mx", "fh"][i % 3]));
const poca = [fila("Placa de Video Asus RTX 5070 12GB", 1500, "cg"), fila("Placa de Video Msi RTX 5070 12GB", 1550, "mx")];
const monitores = ["Samsung", "LG", "Asus", "Msi", "Gigabyte", "AOC", "Philips", "BenQ"]
  .map((m, i) => fila(`Monitor ${m} 27" FHD 180Hz`, 300 + i * 5, ["cg", "mx", "fh"][i % 3]));

test("descubre las consultas que arma Comparar, con su cantidad de comparables y comercios", () => {
  const r = C.descubrir(ctxDe([...placas, ...poca, ...monitores]));
  const q = r.map(x => x.q);
  assert.ok(q.includes("rtx 5060 ti 16gb"), q.join("|"));
  assert.ok(q.includes("monitor 27 fhd 180hz"), q.join("|"));
  const g = r.find(x => x.q === "rtx 5060 ti 16gb");
  assert.match(g.nota, /^Placas de video: 8 avisos, 8 comparables en 3 comercios/);
  assert.match(r.find(x => x.q === "monitor 27 fhd 180hz").nota, /^Monitores: /);
});

test("descarta las consultas con pocas opciones comparables o un solo comercio", () => {
  const unaTienda = ["Asus", "Msi", "Gigabyte", "Zotac", "Palit", "Galax", "Gainward", "Inno3d"]
    .map((m, i) => fila(`Procesador ${m} Ryzen 7 9700X`, 400 + i, "cg"));
  const r = C.descubrir(ctxDe([...placas, ...poca, ...unaTienda]));
  const q = r.map(x => x.q);
  assert.ok(!q.includes("rtx 5070 12gb"), "2 opciones no alcanzan");
  assert.ok(!q.includes("ryzen 7 9700x"), "un solo comercio no es una comparacion");
});

test("ordena por cantidad de comparables y respeta el tope", () => {
  const r = C.descubrir(ctxDe([...placas, ...monitores, fila('Monitor Dell 27" FHD 180Hz', 310, "cg"), fila('Monitor Hp 27" FHD 180Hz', 315, "mx")]), { tope: 1 });
  assert.equal(r.length, 1);
  assert.equal(r[0].q, "monitor 27 fhd 180hz");           // 10 comparables contra 8
});

test("unir deja primero las manuales y no repite una URL ya publicada", () => {
  const manuales = [{ q: "RTX 5060 Ti 16GB", nota: "Placas de video: manual" }, { q: "ssd 1tb", nota: "Almacenamiento: manual" }];
  const autos = [{ q: "rtx 5060 ti 16gb", nota: "Placas de video: auto" }, { q: "monitor 27 fhd", nota: "Monitores: auto" }];
  const u = C.unir(manuales, autos);
  assert.deepEqual(u.map(x => x.q), ["RTX 5060 Ti 16GB", "ssd 1tb", "monitor 27 fhd"]);
  assert.equal(u[0].nota, "Placas de video: manual");
});

test("no publica dos paginas con los mismos avisos comparables ni una consulta de una sola palabra", () => {
  const ctx = ctxDe([...placas, ...monitores]);
  const r = C.descubrir(ctx);
  assert.ok(!r.some(x => !x.q.includes(" ")), "una sola palabra (monitor, notebook) es demasiado general");
  // una manual que ya cubre exactamente los mismos avisos deja afuera a la automatica
  const sin = C.descubrir(ctx, { excluir: [{ q: "rtx 5060 ti", nota: "x" }] });
  assert.ok(!sin.some(x => x.q === "rtx 5060 ti 16gb"), "mismos avisos que la manual rtx 5060 ti");
  assert.ok(sin.some(x => x.q === "monitor 27 fhd 180hz"));
});
