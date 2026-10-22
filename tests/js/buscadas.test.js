const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const X = require("../../js/buscadas.js");
const G = require("../../generar_buscadas.js");

// ---- El filtro de privacidad (js/buscadas.js) ----

test("un término de producto se normaliza y pasa", () => {
  assert.equal(X.terminoLimpio("  Monitor   27  OLED "), "monitor 27 oled");
  assert.equal(X.terminoLimpio("ssd 1tb"), "ssd 1tb");
  for (const producto of ["rtx 4060 16gb", "notebook i7 14700 32gb", "ddr4 16gb 3200", "monitor 27 144hz", "tarjeta de video"]) {
    assert.equal(X.terminoLimpio(producto), producto, producto);
  }
});

test("mails, direcciones web, teléfonos, DNI y números largos NO pasan", () => {
  for (const personal of ["juan.perez@gmail.com", "www.tienda.com.ar", "https://x.test/a", "tienda.com", "1155551234",
    "11 5555 1234", "+54 9 11 5555 1234", "mi numero 11-5555-1234", "12.345.678", "mi dni 12345678", "cbu 0000003100",
    "contraseña wifi", "password123", "cuil 20123456789"]) {
    assert.equal(X.terminoLimpio(personal), "", personal);
  }
});

test("el ruido tampoco pasa: muy corto, muy largo, de muchas palabras, solo números", () => {
  assert.equal(X.terminoLimpio("a"), "");
  assert.equal(X.terminoLimpio("x".repeat(41)), "");
  assert.equal(X.terminoLimpio("uno dos tres cuatro cinco seis siete"), "");
  assert.equal(X.terminoLimpio("12345"), "");
  assert.equal(X.terminoLimpio(""), "");
  assert.equal(X.terminoLimpio(null), "");
});

// ---- Lo más buscado (agregado, con mínimo y solo productos) ----

const productos = [["SSD Kingston 1TB", 1], ["SSD Adata 1TB", 1], ["Disco SSD 1TB WD", 1], ["SSD Crucial 1TB", 1],
  ["Monitor 27 OLED A", 1], ["Monitor 27 OLED B", 1], ["Monitor 27 OLED C", 1], ["Mouse X", 1]];
const hit = (termino, count, prefijo = "busqueda/") => ({ path: prefijo + termino, count, event: true });

test("solo entran las búsquedas de al menos 5 personas distintas", () => {
  const r = X.masBuscadas([hit("ssd 1tb", 5), hit("monitor 27 oled", 4)], { productos });
  assert.deepEqual(r, ["ssd 1tb"], "con 4 personas no se publica");
  assert.deepEqual(X.masBuscadas([hit("ssd 1tb", 4)], { productos }), []);
});

test("solo entran términos que son productos del catálogo", () => {
  const r = X.masBuscadas([hit("ssd 1tb", 50), hit("cosa rara que nadie vende", 90), hit("mouse x", 80)], { productos });
  assert.deepEqual(r, ["ssd 1tb"], "lo que no devuelve al menos 3 resultados no se publica (mouse x tiene 1)");
});

test("ordena de más a menos buscado, ignora las búsquedas sin resultados y lo que no es una búsqueda", () => {
  const hits = [hit("monitor 27 oled", 12), hit("ssd 1tb", 30), hit("auriculares", 99, "busqueda_vacia/"),
    { path: "/inicio", count: 900, event: false }, { path: "clic_saliente/mexx/ram", count: 70, event: true }];
  assert.deepEqual(X.masBuscadas(hits, { productos }), ["ssd 1tb", "monitor 27 oled"]);
});

test("el mismo término escrito de dos maneras no suma personas: se queda la mayor", () => {
  const r = X.masBuscadas([hit("ssd 1tb", 3), hit("SSD  1TB", 5), hit("/ssd 1tb", 4, "")], { productos, minimo: 5 });
  assert.deepEqual(r, ["ssd 1tb"]);
  assert.deepEqual(X.masBuscadas([hit("ssd 1tb", 3), hit("SSD 1TB", 4)], { productos, minimo: 5 }), [], "3 + 4 no es 7");
});

test("un término con datos personales no entra aunque lo busquen muchos", () => {
  assert.deepEqual(X.masBuscadas([hit("juan@x.com ssd", 80), hit("1155551234", 80), hit("ssd 1tb", 5)], { productos }), ["ssd 1tb"]);
});

test("se queda con un máximo de términos", () => {
  const muchos = productos.concat(Array.from({ length: 12 }, (_, i) => [`Memoria Marca${i} 16GB`, 1]));
  const hits = Array.from({ length: 12 }, (_, i) => hit(`memoria marca${i}`, 20 + i)).concat(hit("ssd 1tb", 5));
  assert.equal(X.masBuscadas(hits, { productos: [...muchos, ...muchos, ...muchos], max: 3 }).length, 3);
});

// ---- generar_buscadas.js: lo que sale a disco y a la consola ----

const TOKEN = "gc-token-secreto-de-prueba";
function carpeta() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buscadas-"));
  fs.writeFileSync(path.join(dir, "index.html"), '<script id="gc" data-goatcounter="https://sitio.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>');
  fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ productos }));
  return dir;
}
const respuesta = (cuerpo, ok = true, status = 200) => ({ ok, status, json: async () => cuerpo });
/* Corre main capturando consola: devuelve { codigo, avisos, pedidos }. */
async function correr(dir, { token = TOKEN, pedir, argv = [] } = {}) {
  const avisos = [], log = console.log, warn = console.warn, err = console.error;
  console.log = m => avisos.push(String(m)); console.warn = m => avisos.push(String(m)); console.error = m => avisos.push(String(m));
  try {
    const codigo = await G.main(["--salida", dir, ...argv], token ? { GOATCOUNTER_TOKEN: token } : {}, { pedir, ahora: Date.UTC(2026, 9, 21, 15, 40), esperar: async () => {} });
    return { codigo, avisos };
  } finally { console.log = log; console.warn = warn; console.error = err; }
}

test("sin token no consulta nada ni escribe nada", async () => {
  const dir = carpeta();
  try {
    let llamadas = 0;
    const r = await correr(dir, { token: "", pedir: async () => { llamadas++; } });
    assert.equal(r.codigo, 0);
    assert.equal(llamadas, 0);
    assert.ok(!fs.existsSync(path.join(dir, "buscadas.json")));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("escribe solo la lista de términos: sin conteos, sin fechas de búsqueda y sin el token", async () => {
  const dir = carpeta();
  try {
    const pedidos = [];
    const pedir = async (url, opciones) => {
      pedidos.push({ url: String(url), auth: opciones.headers.Authorization });
      return respuesta({ more: false, hits: [
        { path_id: 1, path: "busqueda/ssd 1tb", count: 17, event: true },
        { path_id: 2, path: "busqueda/juan@x.com", count: 40, event: true },
        { path_id: 3, path: "busqueda/monitor 27 oled", count: 6, event: true }] });
    };
    const r = await correr(dir, { pedir });
    assert.equal(r.codigo, 0);
    const texto = fs.readFileSync(path.join(dir, "buscadas.json"), "utf8");
    const datos = JSON.parse(texto);
    assert.deepEqual(datos.terminos, ["ssd 1tb", "monitor 27 oled"]);
    assert.deepEqual(Object.keys(datos).sort(), ["generado", "minimo_visitantes", "terminos", "ventana_dias"]);
    assert.ok(!/\b17\b|\b40\b|juan|@/.test(texto), "ni conteos ni el termino descartado");
    assert.equal(datos.ventana_dias, 30);
    assert.match(pedidos[0].url, /^https:\/\/sitio\.goatcounter\.com\/api\/v0\/stats\/hits\?start=2026-09-21T15%3A00/);
    assert.equal(pedidos[0].auth, `Bearer ${TOKEN}`);
    assert.ok(!r.avisos.join("\n").includes(TOKEN), "el token no se imprime");
    assert.ok(!r.avisos.join("\n").includes("juan"), "los terminos descartados no se imprimen");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("pagina con exclude_paths mientras la API diga que hay más, y corta si no aparece nada nuevo", async () => {
  const dir = carpeta();
  try {
    const urls = [];
    const paginas = [
      { more: true, hits: [{ path_id: 1, path: "busqueda/ssd 1tb", count: 9, event: true }] },
      { more: true, hits: [{ path_id: 2, path: "busqueda/monitor 27 oled", count: 8, event: true }] },
      { more: true, hits: [{ path_id: 2, path: "busqueda/monitor 27 oled", count: 8, event: true }] },   // nada nuevo: corta
    ];
    const pedir = async url => { urls.push(String(url)); return respuesta(paginas[urls.length - 1]); };
    await correr(dir, { pedir });
    assert.equal(urls.length, 3);
    assert.ok(!urls[0].includes("exclude_paths"));
    assert.match(urls[1], /exclude_paths=1/);
    assert.match(urls[2], /exclude_paths=1&exclude_paths=2/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "buscadas.json"), "utf8")).terminos, ["ssd 1tb", "monitor 27 oled"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("si GoatCounter falla se informa el código, nunca el cuerpo, y no se escribe nada", async () => {
  const dir = carpeta();
  try {
    const r = await correr(dir, { pedir: async () => ({ ok: false, status: 401, json: async () => { throw new Error("no se lee"); }, text: async () => "cuerpo con datos" }) });
    assert.equal(r.codigo, 0, "no corta la publicacion");
    assert.match(r.avisos.join("\n"), /GoatCounter respondio 401/);
    assert.ok(!r.avisos.join("\n").includes("cuerpo con datos"));
    assert.ok(!fs.existsSync(path.join(dir, "buscadas.json")));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("sin catálogo no se publica nada: no se puede comprobar que un término sea un producto", async () => {
  const dir = carpeta();
  try {
    fs.rmSync(path.join(dir, "indice.json"));
    const r = await correr(dir, { pedir: async () => { throw new Error("no deberia pedir"); } });
    assert.equal(r.codigo, 0);
    assert.ok(!fs.existsSync(path.join(dir, "buscadas.json")));
    assert.match(r.avisos.join("\n"), /Sin indice/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("baseDe toma la dirección de GoatCounter del index.html; sin ella no hay nada que consultar", async () => {
  assert.equal(G.baseDe('<script data-goatcounter="https://otro.goatcounter.com/count"></script>'), "https://otro.goatcounter.com");
  assert.equal(G.baseDe("<html></html>"), null);
  const dir = carpeta();
  try {
    fs.writeFileSync(path.join(dir, "index.html"), "<html></html>");
    const r = await correr(dir, { pedir: async () => { throw new Error("no deberia pedir"); } });
    assert.match(r.avisos.join("\n"), /direccion de GoatCounter/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("sin --salida muestra el uso y devuelve 2", async () => {
  const err = console.error; let dicho = "";
  console.error = m => { dicho += m; };
  try { assert.equal(await G.main([], { GOATCOUNTER_TOKEN: TOKEN }), 2); } finally { console.error = err; }
  assert.match(dicho, /Uso/);
  assert.ok(!dicho.includes(TOKEN));
});
