const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const I = require("../../generar_info.js");

const BASE = "https://ejemplo.test/la-pichincha";
const IDX = {
  generado: "2026-10-21T09:10-03:00",
  tiendas: { compragamer: { nombre: "CompraGamer", relevado: "2026-10-21T09:10-03:00" } },
  productos: [["a", 1000, "https://t.test/a", "compragamer", "", 0, 0, "", "", ""]],
};
const FIAB = {
  hasta: "2026-10-21", dias: 30, minimo: 30,
  comercios: {
    "www.grande.test": { verificadas: 120, caidas: 18, sin_comprobar: 6, ultima: "2026-10-21", suficiente: true },
    "chica.test": { verificadas: 7, caidas: 3, sin_comprobar: 0, ultima: "2026-10-19", suficiente: false },
    "<b>x</b>.test": { verificadas: 40, caidas: 0, sin_comprobar: 0, ultima: "2026-10-20", suficiente: true },
    "vieja.test": { verificadas: 0, caidas: 0, sin_comprobar: 0, ultima: "2026-08-01", suficiente: false },
  },
};
const fila = (html, nombre) => html.match(new RegExp("<tr[^>]*>(?:(?!</tr>)[\\s\\S])*" + nombre + "[\\s\\S]*?</tr>"))[0];

test("fiabilidadComercios ordena por muestras, saca el www y calcula el porcentaje solo con muestra suficiente", () => {
  const filas = I.fiabilidadComercios(FIAB);
  assert.deepEqual(filas.map(f => f.nombre), ["grande.test", "<b>x</b>.test", "chica.test", "vieja.test"]);
  assert.equal(filas[0].pct, 15);                        // 18 de 120
  assert.equal(filas[1].pct, 0);
  assert.equal(filas[2].pct, null);                      // 7 de 30 necesarias: sin porcentaje
  assert.equal(filas[3].pct, null);
});

test("fiabilidadComercios sin datos o con un archivo roto devuelve una lista vacia", () => {
  assert.deepEqual(I.fiabilidadComercios(null), []);
  assert.deepEqual(I.fiabilidadComercios({}), []);
  assert.deepEqual(I.fiabilidadComercios({ comercios: "mal" }), []);
});

test("/estado/ dice la ventana, el minimo y que es un conteo propio", () => {
  const html = I.renderEstado(IDX, null, { baseUrl: BASE, fiabilidad: FIAB });
  assert.match(html, /Ofertas que ya no estaban en pie/);
  assert.match(html, /últimos 30 días/);
  assert.match(html, /hasta el 21\/10/);
  assert.match(html, /menos de 30 verificadas/);
  assert.match(html, /conteo propio/);
  assert.match(html, /no es una opinión/);
});

test("/estado/ muestra K de N por comercio y la ultima revision", () => {
  const html = I.renderEstado(IDX, null, { baseUrl: BASE, fiabilidad: FIAB });
  const g = fila(html, "grande\\.test");
  assert.match(g, />120</);
  assert.match(g, /18 \(15%\)/);
  assert.match(g, /21\/10/);
  assert.match(g, /sin comprobar: 6/);
});

test("/estado/ no rotula con porcentaje a un comercio con pocas muestras", () => {
  const html = I.renderEstado(IDX, null, { baseUrl: BASE, fiabilidad: FIAB });
  const c = fila(html, "chica\\.test");
  assert.match(c, /Pocas revisiones: 7 de 30/);
  assert.doesNotMatch(c, /%/);
  assert.match(c, /19\/10/);
  const v = fila(html, "vieja\\.test");
  assert.match(v, /Sin revisiones en los últimos 30 días/);
  assert.match(v, /1\/8/);
});

test("un comercio con avisos revisados pero ninguno comprobado no figura como 'sin revisiones'", () => {
  const fiab = { ...FIAB, comercios: { "ml.test": { verificadas: 0, caidas: 0, sin_comprobar: 4, ultima: "2026-10-21", suficiente: false } } };
  const html = I.renderEstado(IDX, null, { baseUrl: BASE, fiabilidad: fiab });
  const m = fila(html, "ml\\.test");
  assert.match(m, /Ninguno se pudo comprobar todavía \(sin comprobar: 4\)/);
  assert.doesNotMatch(m, /Sin revisiones/);
});

test("bordes: sin ultima revision, sin porcentaje sin verificadas y campos que faltan", () => {
  assert.equal(I.fiabilidadComercios({ comercios: { "a.test": {} } })[0].nombre, "a.test");
  assert.equal(I.fiabilidadComercios({ comercios: { "a.test": { verificadas: 0, suficiente: true } } })[0].pct, null);
  const html = I.renderEstado(IDX, null, { baseUrl: BASE,
    fiabilidad: { dias: 30, minimo: 30, hasta: "2026-10-21", comercios: { "a.test": { suficiente: true, verificadas: 50, caidas: 10 } } } });
  const m = fila(html, "a\\.test");
  assert.match(m, /10 \(20%\)/);
  assert.doesNotMatch(m, /Última revisión/);
});

test("/estado/ escapa el nombre del comercio de la telemetria", () => {
  const html = I.renderEstado(IDX, null, { baseUrl: BASE, fiabilidad: FIAB });
  assert.ok(!html.includes("<b>x</b>.test"));
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;\.test/);
});

test("sin fiabilidad la pagina no muestra la seccion ni promete datos", () => {
  for (const fiabilidad of [undefined, null, { dias: 30, minimo: 30, hasta: "2026-10-21", comercios: {} }]) {
    const html = I.renderEstado(IDX, null, { baseUrl: BASE, fiabilidad });
    assert.doesNotMatch(html, /Ofertas que ya no estaban en pie/);
  }
});

test("main lee fiabilidad.json si existe y sigue sin el o con uno roto", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "info-fiab-"));
  const indice = path.join(dir, "indice.json");
  fs.writeFileSync(indice, JSON.stringify(IDX));
  fs.writeFileSync(path.join(dir, "fiabilidad.json"), JSON.stringify(FIAB));
  fs.writeFileSync(path.join(dir, "roto.json"), "{no es json");
  const correr = (nombre, fiab) => {
    const salida = path.join(dir, nombre);
    I.main(["--indice", indice, "--salud", path.join(dir, "no.json"), "--fiabilidad", path.join(dir, fiab), "--salida", salida, "--base-url", BASE]);
    return fs.readFileSync(path.join(salida, "estado", "index.html"), "utf8");
  };
  assert.match(correr("con", "fiabilidad.json"), /grande\.test/);
  assert.doesNotMatch(correr("sin", "nada.json"), /Ofertas que ya no estaban en pie/);
  assert.doesNotMatch(correr("roto", "roto.json"), /Ofertas que ya no estaban en pie/);
});
