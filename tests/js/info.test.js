const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const I = require("../../generar_info.js");

const BASE = "https://ejemplo.test/la-pichincha";
const fila = (nombre, tienda) => [nombre, 1000, "https://t.test/" + nombre, tienda, "", 0, 0, "", "", ""];
const IDX = {
  generado: "2026-10-14T09:10-03:00",
  tiendas: {
    compragamer: { nombre: "CompraGamer", relevado: "2026-10-14T09:10-03:00" },
    fullh4rd: { nombre: "FullH4rd", relevado: "2026-10-07T09:05-03:00" },
    nueva: { nombre: "Tienda <Nueva>" },
    comparaya: { nombre: "ComparaYa", relevado: "2026-10-14T09:10-03:00", segunda: true },
  },
  productos: [fila("a", "compragamer"), fila("b", "compragamer"), fila("c", "fullh4rd"), fila("d", "comparaya")],
};
const SALUD = {
  fecha: "2026-10-14T09:10-03:00",
  fuentes: {
    compragamer: { nombre: "CompraGamer", previo: 2000, ahora: 1200, estado: "baja" },
    fullh4rd: { nombre: "FullH4rd", previo: 1500, ahora: 0, estado: "fallo" },
  },
};

test("cada fuente sale con sus avisos, su ultimo relevamiento y un estado", () => {
  const filas = I.estadoFuentes(IDX, null);
  const por = Object.fromEntries(filas.map(f => [f.clave, f]));
  assert.deepEqual(por.compragamer, { clave: "compragamer", nombre: "CompraGamer", avisos: 2,
    relevado: "2026-10-14T09:10-03:00", estado: "ok", segunda: false });
  assert.equal(por.fullh4rd.estado, "atrasada");          // sin salud.json, lo dice la fecha
  assert.equal(por.nueva.estado, "sin-datos");
  assert.equal(por.nueva.avisos, 0);
  assert.equal(por.comparaya.segunda, true);
});

test("un indice anterior a tiendas.relevado toma la fecha del indice para las fuentes con avisos", () => {
  const viejo = { ...IDX, tiendas: { compragamer: { nombre: "CompraGamer" }, nueva: { nombre: "Nueva" } } };
  const por = Object.fromEntries(I.estadoFuentes(viejo, null).map(f => [f.clave, f]));
  assert.equal(por.compragamer.estado, "ok");
  assert.equal(por.compragamer.relevado, IDX.generado);
  assert.equal(por.nueva.estado, "sin-datos");             // sin avisos ni fecha: de verdad no se relevo
});

test("con salud.json de la misma corrida, manda el estado medido", () => {
  const por = Object.fromEntries(I.estadoFuentes(IDX, SALUD).map(f => [f.clave, f]));
  assert.equal(por.compragamer.estado, "baja");
  assert.equal(por.fullh4rd.estado, "fallo");
  assert.equal(por.comparaya.estado, "ok");               // no figura en salud: se juzga por la fecha
});

test("un salud.json de otra corrida no pisa lo que dice el indice", () => {
  const viejo = { ...SALUD, fecha: "2026-10-13T09:00-03:00" };
  const por = Object.fromEntries(I.estadoFuentes(IDX, viejo).map(f => [f.clave, f]));
  assert.equal(por.compragamer.estado, "ok");
  assert.equal(por.fullh4rd.estado, "atrasada");
});

test("primero las fuentes con problemas, despues las que estan al dia", () => {
  const orden = I.estadoFuentes(IDX, SALUD).map(f => f.clave);
  assert.deepEqual(orden, ["fullh4rd", "nueva", "compragamer", "comparaya"]);
});

test("la pagina /estado/ dice la hora de cada fuente en hora argentina y escapa los nombres", () => {
  const html = I.renderEstado(IDX, SALUD, { baseUrl: BASE });
  assert.match(html, /<title>Estado de las fuentes \| La Pichincha<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/estado\/">/);
  assert.match(html, /Precios del 14\/10 09:10/);
  assert.match(html, /FullH4rd[\s\S]*?No respondió[\s\S]*?7\/10 09:05/);
  assert.match(html, /CompraGamer[\s\S]*?Trajo menos de lo habitual/);
  assert.match(html, /Tienda &lt;Nueva&gt;[\s\S]*?Todavía sin relevar/);
  assert.ok(!html.includes("<Nueva>"));
  assert.match(html, /href="\.\.\/legal\/"/);
  assert.match(html, /\.info table[^<]*<\/style>\n<\/head>/);    // el estilo propio va dentro del head
});

test("la pagina legal cubre terminos, privacidad sin cookies y afiliados rotulados", () => {
  const html = I.renderLegal({ baseUrl: BASE });
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/legal\/">/);
  for (const id of ["terminos", "privacidad", "afiliados"]) assert.match(html, new RegExp(`<h2 id="${id}">`));
  assert.match(html, /GoatCounter/);
  assert.match(html, /sin cookies/);
  assert.match(html, /nunca depende de una comisión/);
});

test("main escribe /estado/ y /legal/; sin indice escribe solo /legal/", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "info-"));
  const indice = path.join(dir, "indice.json");
  const salud = path.join(dir, "salud.json");
  fs.writeFileSync(indice, JSON.stringify(IDX));
  fs.writeFileSync(salud, JSON.stringify(SALUD));
  const salida = path.join(dir, "sitio");
  I.main(["--indice", indice, "--salud", salud, "--salida", salida, "--base-url", BASE]);
  assert.match(fs.readFileSync(path.join(salida, "estado", "index.html"), "utf8"), /No respondió/);
  assert.ok(fs.existsSync(path.join(salida, "legal", "index.html")));

  const solo = path.join(dir, "solo");
  I.main(["--indice", path.join(dir, "no-hay.json"), "--salud", path.join(dir, "tampoco.json"), "--salida", solo, "--base-url", BASE]);
  assert.ok(!fs.existsSync(path.join(solo, "estado")));
  assert.ok(fs.existsSync(path.join(solo, "legal", "index.html")));
});
