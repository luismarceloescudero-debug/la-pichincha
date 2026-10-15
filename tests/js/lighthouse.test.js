const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const VERIFICADOR = path.join(__dirname, "..", "..", ".github", "lighthouse.js");

/* Un informe de Lighthouse minimo: lo que lee el verificador. */
function informe(url, puntajes) {
  const categorias = Object.fromEntries(Object.entries(puntajes).map(([id, p]) =>
    [id, { id, score: p / 100, auditRefs: [] }]));
  return { finalDisplayedUrl: url, categories: categorias, audits: {} };
}

function verificar(...informes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lh-"));
  try {
    const rutas = informes.map((r, i) => {
      const ruta = path.join(dir, `lh-${i}.json`);
      fs.writeFileSync(ruta, JSON.stringify(r));
      return ruta;
    });
    return spawnSync(process.execPath, [VERIFICADOR, ...rutas], { encoding: "utf8" });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const BIEN = { performance: 95, accessibility: 100, "best-practices": 100, seo: 100 };

test("con todo en 90 o mas pasa", () => {
  const r = verificar(informe("http://localhost:8080/", BIEN), informe("http://localhost:8080/precios/", BIEN));
  assert.strictEqual(r.status, 0, r.stdout);
});

test("el rendimiento de la portada bajo 90 corta la CI, como el de cualquier pagina (A3: pre-renderizada)", () => {
  const r = verificar(informe("http://localhost:8080/", { ...BIEN, performance: 89 }));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /::error::http:\/\/localhost:8080\/: performance 89 < 90/);
});

test("cualquier categoria bajo 90 en otra pagina corta la CI", () => {
  const r = verificar(informe("http://localhost:8080/hoy/", { ...BIEN, seo: 80 }));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /seo 80 < 90/);
});

test("con TBT imprime las tareas largas y de que script son, para diagnosticar el runner", () => {
  const r0 = informe("http://localhost:8080/", BIEN);
  r0.audits["total-blocking-time"] = { numericValue: 430, displayValue: "430 ms" };
  r0.audits["long-tasks"] = { details: { items: [
    { url: "http://localhost:8080/", duration: 182.4, startTime: 1210.7 },
    { url: "http://localhost:8080/js/arranque.js", duration: 61, startTime: 1500 }] } };
  const r = verificar(r0);
  assert.match(r.stdout, /tarea larga 182 ms a los 1211 ms: http:\/\/localhost:8080\//);
  assert.match(r.stdout, /tarea larga 61 ms a los 1500 ms: .*arranque\.js/);
});

// ---- Varias corridas por pagina: se evalua la mediana (la primera del job sale con Chrome en frio) ----

test("con tres corridas de una pagina evalua la mediana: una corrida en frio no corta", () => {
  const r = verificar(...[70, 97, 95].map(p => informe("http://localhost:8080/", { ...BIEN, performance: p })));
  assert.strictEqual(r.status, 0, r.stdout);
  assert.match(r.stdout, /mediana de 3 corridas \(performance 70, 95, 97\)/);
  assert.match(r.stdout, /http:\/\/localhost:8080\/: performance=95 /);
});

test("si la mediana queda bajo 90, corta", () => {
  const r = verificar(...[70, 85, 97].map(p => informe("http://localhost:8080/", { ...BIEN, performance: p })));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /performance 85 < 90/);
});

test("la mediana se toma por pagina: cada una se evalua aparte", () => {
  const r = verificar(informe("http://localhost:8080/", BIEN), informe("http://localhost:8080/hoy/", { ...BIEN, seo: 80 }),
    informe("http://localhost:8080/", BIEN));
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /hoy\/: seo 80 < 90/);
  assert.doesNotMatch(r.stdout, /8080\/: performance \d+ < 90/);
});
