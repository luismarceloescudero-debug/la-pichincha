/* Precio por tienda: el mismo modelo en cada comercio, con el porcentaje contra el mas barato y lo que se ahorra contra el mas
   caro. Solo entre avisos comparables del mismo modelo; varios avisos de una tienda cuentan como una; un solo comercio no
   se compara con nadie. Logica pura en js/analisis.js, la tabla de la Comparativa (js/consulta.js) y la de las paginas
   estaticas (generar_paginas.js). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const B = require("../../js/buscador.js");
const A = require("../../js/analisis.js");
const G = require("../../generar_paginas.js");
const GP = require("../../generar_portada.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, tienda, modelo = "", { via = "", sellos = "" } = {}) =>
  [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, via, 0, 0, "", sellos, modelo];

const NOMBRES = { cg: "CompraGamer", mx: "Mexx", gc: "Gaming City", cy: "ComparaYa" };
const ctxPT = {
  comercioDe: f => f[4] || NOMBRES[f[3]] || f[3],
  fechaDe: f => (f[3] === "mx" ? "precio del 8/10" : "precio de hoy"),
  pesos: n => "$" + Math.round(n),
};
const COD = "KF432C16BB1/16";
const kf = (precio, tienda, extra) => fila("Memoria Kingston Fury DDR4 16GB 3200MHz " + COD, precio, tienda, COD, extra);

// ---------- logica pura ----------

test("ordena de menor a mayor, pone el porcentaje contra la mas barata y lo que se ahorra contra la mas cara", () => {
  const cg = kf(1000, "cg"), mx = kf(1080, "mx"), gc = kf(1220, "gc");
  const r = A.precioPorTienda(cg, [mx, gc], ctxPT);
  assert.equal(r.unico, false);
  assert.deepEqual(r.tiendas.map(t => [t.comercio, t.precio, t.pctTexto]),
    [["CompraGamer", 1000, "la más barata"], ["Mexx", 1080, "+8%"], ["Gaming City", 1220, "+22%"]]);
  assert.equal(r.barata.f, cg);
  assert.equal(r.cara.f, gc);
  assert.equal(r.ahorro, 220);
  assert.equal(r.ahorroPct, 18);
  assert.equal(r.textoAhorro, "$220 menos que en la más cara");
});

test("el orden es solo por precio: la representante no tiene que ser la mas barata ni un sello cambia nada", () => {
  const caro = kf(1500, "cg", { sellos: "oes" }), barato = kf(1200, "gc");
  const r = A.precioPorTienda(caro, [barato], ctxPT);
  assert.deepEqual(r.tiendas.map(t => t.comercio), ["Gaming City", "CompraGamer"]);
  assert.equal(r.tiendas[1].pctTexto, "+25%");
});

test("cada aviso trae la fecha real de su precio y el enlace a su aviso", () => {
  const r = A.precioPorTienda(kf(1000, "cg"), [kf(1080, "mx")], ctxPT);
  assert.equal(r.tiendas[0].fecha, "precio de hoy");
  assert.equal(r.tiendas[1].fecha, "precio del 8/10");
  assert.equal(r.tiendas[1].url, kf(1080, "mx")[2]);
});

test("varios avisos de la misma tienda cuentan como una sola tienda (la mas barata de ellas)", () => {
  const cg = kf(1000, "cg"), cg2 = kf(990, "cg"), mx = kf(1100, "mx"), cyMexx = kf(1050, "cy", { via: "Mexx" });
  const r = A.precioPorTienda(cg, [cg2, mx, cyMexx], ctxPT);
  assert.deepEqual(r.tiendas.map(t => [t.comercio, t.precio]), [["CompraGamer", 990], ["Mexx", 1050]]);
  assert.equal(r.ahorro, 60);
});

test("dos avisos de una sola tienda no son una comparacion: un solo comercio", () => {
  const r = A.precioPorTienda(kf(1000, "cg"), [kf(990, "cg")], ctxPT);
  assert.equal(r.unico, true);
  assert.equal(r.ahorro, null);
  assert.equal(r.tiendas.length, 1);
  assert.equal(r.tiendas[0].pctTexto, "");
  assert.equal(r.textoAhorro, "un solo comercio: no hay con qué comparar");
  assert.equal(A.precioPorTienda(kf(1000, "cg"), [], ctxPT).unico, true);
});

test("el mismo precio en todas las tiendas no inventa un ahorro", () => {
  const r = A.precioPorTienda(kf(1000, "cg"), [kf(1000, "mx")], ctxPT);
  assert.equal(r.ahorro, 0);
  assert.equal(r.textoAhorro, "mismo precio en todas las tiendas");
  assert.deepEqual(r.tiendas.map(t => t.pctTexto), ["la más barata", "la más barata"]);
});

test("una diferencia menor al 1% no se redondea a 0%", () => {
  const r = A.precioPorTienda(kf(10000, "cg"), [kf(10020, "mx")], ctxPT);
  assert.equal(r.tiendas[1].pctTexto, "+<1%");
});

test("no mezcla variantes: ni capacidades distintas ni OC contra no OC", () => {
  const ssd1 = fila("SSD Kingston NV2 1TB M.2", 80000, "cg", "SNV2S"), ssd2 = fila("SSD Kingston NV2 2TB M.2", 150000, "mx", "SNV2S");
  const ssd1b = fila("SSD Kingston NV2 1 TB NVMe", 82000, "gc", "SNV2S");
  const r = A.precioPorTienda(ssd1, [ssd2, ssd1b], ctxPT);
  assert.deepEqual(r.tiendas.map(t => t.comercio), ["CompraGamer", "Gaming City"]);

  const oc = fila("Placa de video ASUS Dual RTX 5060 Ti 16GB OC", 1000, "cg", "DUAL-5060TI");
  const base = fila("Placa de video ASUS Dual RTX 5060 Ti 16GB", 900, "mx", "DUAL-5060TI");
  const oc2 = fila("Placa de video ASUS Dual GeForce RTX 5060 Ti 16GB OC Edition", 1100, "gc", "DUAL-5060TI");
  const p = A.precioPorTienda(oc, [base, oc2], ctxPT);
  assert.deepEqual(p.tiendas.map(t => t.comercio), ["CompraGamer", "Gaming City"], "el aviso sin OC queda afuera");
  const q = A.precioPorTienda(base, [oc, oc2], ctxPT);
  assert.equal(q.unico, true, "sin OC no hay con quien comparar");
});

test("no mezcla notebooks de otra memoria o almacenamiento aunque compartan el codigo de la familia", () => {
  const a = fila("Notebook Lenovo IdeaPad 15IRH10 Core i5 8GB 512GB SSD", 900000, "cg", "15IRH10");
  const b = fila("Notebook Lenovo IdeaPad 15IRH10 Core i5 16GB 512GB SSD", 1000000, "mx", "15IRH10");
  const c = fila("Notebook Lenovo IdeaPad 15IRH10 Core i5 8GB 512GB SSD", 950000, "gc", "15IRH10");
  const r = A.precioPorTienda(a, [b, c], ctxPT);
  assert.deepEqual(r.tiendas.map(t => t.comercio), ["CompraGamer", "Gaming City"]);
});

test("un filtro de la consulta (admite) deja afuera lo que no es comparable", () => {
  const r = A.precioPorTienda(kf(1000, "cg"), [kf(500, "mx"), kf(1100, "gc")], { ...ctxPT, admite: f => f[3] !== "mx" });
  assert.deepEqual(r.tiendas.map(t => t.comercio), ["CompraGamer", "Gaming City"]);
});

test("sin la fecha de la fuente no se afirma que el precio es de hoy", () => {
  const r = A.precioPorTienda(kf(1000, "cg"), [kf(1080, "mx")], { comercioDe: ctxPT.comercioDe, pesos: ctxPT.pesos });
  assert.deepEqual(r.tiendas.map(t => t.fecha), ["", ""]);
  const html = A.tablaTiendasHtml(r, ctxHtml);
  assert.doesNotMatch(html, /precio de hoy/);
  assert.match(html, /sin fecha/);
});

test("Pagina.precioFecha dice de hoy, la fecha vieja o nada si no sabe", () => {
  const P = require("../../js/pagina.js");
  assert.equal(P.precioFecha("2026-10-09T08:12-03:00", "2026-10-09T10:00-03:00"), "precio de hoy");
  assert.equal(P.precioFecha("2026-10-08T08:12-03:00", "2026-10-09T10:00-03:00"), "precio del 8/10");
  assert.equal(P.precioFecha(undefined, "2026-10-09T10:00-03:00"), "");
  assert.equal(P.precioFecha("2026-10-09T08:12-03:00", undefined), "");
  assert.equal(P.precioFecha("basura", "2026-10-09T10:00-03:00"), "");
});

// ---------- dentro de analizarConsulta ----------

const FILAS = [
  kf(1000, "cg"), kf(1080, "mx"), kf(1220, "gc"),
  kf(1300, "cy", { sellos: "i", via: "Importadora" }),                      // internacional: no compite
  kf(1060, "cy", { sellos: "u", via: "Usados" }),                           // usado: tampoco
  fila("Memoria Adata XPG DDR4 16GB 3200MHz", 900, "cg", "AX4U3200"),
  fila("Memoria Crucial DDR4 16GB 3200MHz", 1150, "gc", "CT16G4"),
  fila("Memoria Hiksemi DDR4 16GB 3200MHz", 950, "mx", "HS-DIMM"),
];
const N = FILAS.map(f => B.normalBusq(f[0]));
function ctxAnalisis() {
  const otras = new Map();
  return {
    buscarTodo: q => {
      const c = B.filtroDe(q);
      const g = B.agruparPorModelo(B.unaPorUrl(FILAS.filter((f, i) => c(N[i]))), ctxPT.comercioDe);
      for (const [f, resto] of g.otras) otras.set(f, resto);
      return g.filas;
    },
    otrasDe: f => otras.get(f) || [],
    comercioDe: ctxPT.comercioDe, fechaDe: ctxPT.fechaDe, pesos: ctxPT.pesos,
    colorDe: () => "cg",
    marcaDe: n => B.marcaDe(n, B.armarMarcasRe(["kingston", "adata", "hiksemi", "crucial"])),
    nivelMarca: n => (/kingston|crucial/i.test(n) ? 2 : /adata/i.test(n) ? 1 : 0),
  };
}

test("cada opcion de la comparativa trae su precio por tienda, solo con avisos comparables del mismo modelo", () => {
  const r = A.analizarConsulta("ddr4 16gb", ctxAnalisis());
  const mejor = r.picks[0];
  assert.match(mejor.m.f[0], /Kingston Fury/);
  const pt = mejor.porTienda;
  assert.deepEqual(pt.tiendas.map(t => [t.comercio, t.precio]), [["CompraGamer", 1000], ["Mexx", 1080], ["Gaming City", 1220]],
    "ni la compra internacional ni el usado entran en la comparacion");
  assert.equal(pt.ahorro, 220);
  for (const p of r.picks) assert.ok(p.porTienda, "todas las opciones tienen su bloque");
  const sola = r.picks.find(p => /Adata/.test(p.m.f[0]));
  if (sola) assert.equal(sola.porTienda.unico, true);
});

test("sin otrasDe en el contexto, cada opcion es un solo comercio (nada inventado)", () => {
  const c = ctxAnalisis(); delete c.otrasDe;
  const r = A.analizarConsulta("ddr4 16gb", c);
  assert.ok(r.picks.every(p => p.porTienda.unico));
});

// ---------- el HTML compartido ----------

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ctxHtml = { esc, pesos: ctxPT.pesos, enlace: (f, txt, et) => `<a href="${esc(f[2])}" rel="noopener" aria-label="${esc(et)}">${txt}</a>` };

test("la tabla es accesible: encabezados con scope, el porcentaje va en texto y el ahorro se dice con palabras", () => {
  const html = A.tablaTiendasHtml(A.precioPorTienda(kf(1000, "cg"), [kf(1080, "mx"), kf(1220, "gc")], ctxPT), ctxHtml);
  assert.match(html, /<th scope="col">Tienda<\/th>/);
  assert.match(html, /<th scope="col">Contra la más barata<\/th>/);
  assert.equal((html.match(/<th scope="row">/g) || []).length, 3);
  assert.match(html, /la más barata/);
  assert.match(html, />\+8%</);
  assert.match(html, />\+22%</);
  assert.match(html, /\$220 menos que en la más cara/);
  assert.match(html, /precio del 8\/10/);
  assert.match(html, /precio de hoy/);
  assert.equal((html.match(/rel="noopener"/g) || []).length, 3);
  assert.match(html, /aria-label="Abrir el aviso de Mexx"/, "cada enlace dice a que tienda va, fuera de contexto");
  assert.match(html, /<th scope="col">Fecha del precio<\/th>/);
});

test("un solo comercio no arma tabla: dice que no hay con que comparar", () => {
  const html = A.tablaTiendasHtml(A.precioPorTienda(kf(1000, "cg"), [], ctxPT), ctxHtml);
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /un solo comercio: no hay con qué comparar/);
  assert.doesNotMatch(html, /menos que en la más cara/);
});

test("los nombres de tiendas y la fecha van escapados", () => {
  const raro = kf(1000, "cg", { via: "<img src=x onerror=1>" });
  const html = A.tablaTiendasHtml(A.precioPorTienda(raro, [kf(1100, "mx")], ctxPT), ctxHtml);
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
});

// ---------- paginas estaticas ----------

const IDX = {
  generado: "2026-10-09T08:12-03:00",
  tiendas: {
    cg: { nombre: "CompraGamer", color: "cg", relevado: "2026-10-09T08:12-03:00" },
    mx: { nombre: "Mexx", color: "mx", relevado: "2026-10-08T08:12-03:00" },      // no se relevo hoy
    gc: { nombre: "Gaming City", color: "gc", relevado: "2026-10-09T08:12-03:00" },
  },
  productos: [
    kf(1000, "cg"), kf(950, "mx"), kf(1100, "gc"),
    fila("Memoria Adata XPG DDR4 16GB 3200MHz", 900, "cg", "AX4U3200"),
    fila("Memoria Crucial DDR4 16GB 3200MHz", 1150, "gc", "CT16G4"),
    fila("Memoria Hiksemi DDR4 16GB 3200MHz", 980, "mx", "HS-DIMM"),
    fila("Memoria Otra Marca DDR4 16GB 3200MHz", 1050, "mx"),
  ],
};
function pagina(idx, q = "ddr4 16gb") {
  const ctx = G.crearContexto(idx, { baseUrl: "https://ejemplo.test/lp", ahora: new Date("2026-10-09T12:00:00-03:00"),
    marcas: { primera: ["kingston", "crucial"], conocida: ["adata", "hiksemi"] } });
  const analisis = A.analizarConsulta(q, ctx);
  return { analisis, html: G.renderPagina({ q, slug: "ddr4-16gb" }, analisis, ctx) };
}

test("la pagina estatica trae la seccion Precio por tienda con los numeros de la mejor compra", () => {
  const { analisis, html } = pagina(IDX);
  assert.match(analisis.picks[0].m.f[0], /Kingston Fury/);
  const sec = html.split("<h2>Precio por tienda</h2>")[1].split("</section>")[0];
  assert.match(sec, /<th scope="row">Mexx<\/th>/);
  assert.match(sec, /precio del 8\/10/);
  assert.match(sec, />\+5%</);        // CompraGamer 1000 contra Mexx 950
  assert.match(sec, />\+16%</);       // Gaming City 1100 contra Mexx 950
  assert.match(sec, /\$150 menos que en la más cara/);
  assert.ok(sec.includes(`href="${kf(1100, "gc")[2]}"`), "cada tienda enlaza a su aviso");
  assert.match(sec, /data-rubro="memoria"/, "el clic se mide igual que en el resto de la pagina");
  assert.match(sec, /target="_blank" rel="noopener"/);
});

test("en la pagina estatica un modelo en un solo comercio dice que no hay con que comparar", () => {
  const { html } = pagina(IDX);
  const sec = html.split("<h2>Precio por tienda</h2>")[1].split("</section>")[0];
  assert.match(sec, /un solo comercio: no hay con qué comparar/);
});

test("sin ningun modelo repetido en dos tiendas la pagina no inventa porcentajes", () => {
  const sin = { ...IDX, productos: [...IDX.productos.filter(f => f[9] !== COD), kf(1000, "cg")] };
  const { html } = pagina(sin);
  const sec = html.split("<h2>Precio por tienda</h2>")[1].split("</section>")[0];
  assert.doesNotMatch(sec, /<table/);
  assert.doesNotMatch(sec, /menos que en la más cara/);
});

// ---------- la Comparativa de la app ----------

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
function app(productos) {
  const doc = { querySelector: () => ({ dataset: {}, setAttribute() {} }), querySelectorAll: () => [], getElementById: () => null, addEventListener() {} };
  const ctx = GP.contexto(leer("index.html"), leer, { document: doc, setTimeout() {}, clearTimeout() {} });
  ctx.__idx = { generado: "2026-10-15T10:00-03:00",
    tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, mx: { nombre: "Mexx", color: "mx" }, gc: { nombre: "Gaming City", color: "gc" } }, productos };
  const correr = codigo => vm.runInContext(codigo, ctx);
  correr("IDX = __idx");
  correr('fijarConsulta("ssd 1tb")');
  return correr;
}
const SSD = (n, p, t, mod = "") => fila(n, p, t, mod);
const SSDS = [
  SSD("Disco Solido SSD Kingston NV2 1TB M.2 SNV2S/1000G", 50000, "cg", "SNV2S/1000G"),
  SSD("Disco Solido SSD Kingston NV2 1TB M.2 SNV2S/1000G", 65000, "mx", "SNV2S/1000G"),
  SSD("Disco Solido SSD Kingston NV2 1TB M.2 SNV2S/1000G", 56000, "gc", "SNV2S/1000G"),
  SSD("Disco Solido SSD Hiksemi Wave 1TB SATA", 60000, "cg"),
  SSD("Disco Solido SSD Western Digital Green 1TB SATA", 70000, "gc"),
  SSD("Disco Solido SSD Adata SU650 1TB SATA", 75000, "cg"),
  SSD("Disco Solido SSD Crucial P3 1TB M.2 NVMe", 99000, "mx"),
];

test("la Comparativa de la app muestra el precio por tienda de cada opcion", () => {
  const correr = app(SSDS);
  const html = correr("vistaComparativaDin()");
  assert.match(html, /Precio por tienda/);
  const picks = [...correr("ANALISIS.picks")];
  const conGrupo = picks.filter(p => p.porTienda && !p.porTienda.unico);
  assert.ok(conGrupo.length >= 1, "la Kingston esta en tres tiendas");
  const kingston = conGrupo.find(p => /Kingston/.test(p.m.f[0]));
  assert.ok(kingston);
  assert.deepEqual([...kingston.porTienda.tiendas].map(t => t.precio), [50000, 56000, 65000]);
  assert.match(html, /\$15\.000 menos que en la más cara/);
  assert.match(html, />\+12%</);          // 56000 contra 50000
  assert.match(html, />\+30%</);          // 65000 contra 50000
  assert.match(html, /<th scope="row">Mexx<\/th>/);
  const solos = picks.filter(p => p.porTienda.unico).length;
  assert.equal((html.match(/un solo comercio: no hay con qué comparar/g) || []).length, solos);
  assert.match(html, /target="_blank" rel="noopener"/);
});
