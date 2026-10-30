const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const G = require("../../generar_portada.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const HTML = leer("index.html");
const PRE = G.prerender(HTML, leer);

const entre = (html, abre, cierra) => html.slice(html.indexOf(abre), html.indexOf(cierra, html.indexOf(abre)));
const cuantas = (texto, re) => (texto.match(re) || []).length;

// ---- El build escribe la vista inicial ----

test("el HTML publicado trae las pestañas, con la Comparativa elegida", () => {
  const tabs = entre(PRE, 'id="tablist"', "</div>");
  assert.strictEqual(cuantas(tabs, /class="tab"/g), 4);   // Comparativa, Ofertas, Buscar y Veredicto (Tiendas va dentro de la Comparativa, spec 021; Costo de importar se quito en la 040)
  assert.doesNotMatch(tabs, /data-ir="costo"/);
  assert.match(tabs, /data-ir="comparativa"[^>]*aria-selected="true"/);
  assert.strictEqual(cuantas(tabs, /aria-selected="true"/g), 1);
});

test("el HTML publicado trae el sello con la cantidad de productos", () => {
  const datos = JSON.parse(entre(HTML, "const DATOS = ", G.FINAL).slice("const DATOS = ".length).replace(/;\s*$/, ""));
  assert.match(PRE, new RegExp(`id="sello">Precios verificados en cada sitio[^<]* · ${datos.productos.length} productos seguidos`));
});

test("el HTML publicado trae la portada sin la comparativa curada del primer relevamiento (spec 021)", () => {
  const vista = PRE.slice(PRE.indexOf('id="vista"'), PRE.indexOf("<noscript>", PRE.indexOf('id="vista"')));
  assert.match(vista, /^id="vista" data-pre="comparativa:ram" role="tabpanel" aria-labelledby="tab-comparativa">/);
  assert.doesNotMatch(vista, /Memorias DDR4 16GB|análisis a fondo|class="card /);
  assert.match(vista, /Tus búsquedas van a aparecer acá/);    // sin storage en el build, la tira invita a buscar
  assert.match(vista, /id="reciente"/);                        // ahi va tu ultima busqueda cuando llega el indice
});

test("la vista pre-renderizada nace quieta: sin animacion de entrada que atrase el LCP", () => {
  const vista = PRE.slice(PRE.indexOf('id="vista"'), PRE.indexOf("<noscript>", PRE.indexOf('id="vista"')));
  assert.strictEqual(cuantas(vista, /class="panel quieta"/g), 1);
  assert.doesNotMatch(entre(HTML, "function vistaComparativa", "function vistaVeredicto"), /quieta/); // al navegar, se anima
});

test("armar dos veces da lo mismo: no se duplica nada", () => {
  assert.strictEqual(G.prerender(PRE, leer), PRE);
});

test("los datos y los scripts quedan tal cual", () => {
  assert.ok(PRE.includes(entre(HTML, G.INICIO, G.FINAL)));
  assert.strictEqual(cuantas(PRE, /<script/g), cuantas(HTML, /<script/g));
});

test("sin los marcadores de la portada no toca nada", () => {
  const otra = "<html><body><p>otra</p></body></html>";
  assert.strictEqual(G.prerender(otra, leer), otra);
});

// ---- Al arrancar, el JS no vuelve a armar lo que ya esta ----

/* Un DOM minimo: cuenta cuantas veces se escribe el HTML de cada elemento. */
function elemento(html = "") {
  const el = { escrituras: 0, _html: html, dataset: {}, hidden: false, textContent: "",
    scrollWidth: 0, clientWidth: 0, setAttribute() {}, addEventListener() {}, scrollIntoView() {},
    get children() { return { length: el._html.trim() ? 1 : 0 }; } };
  Object.defineProperty(el, "innerHTML", { get: () => el._html, set: v => { el._html = v; el.escrituras++; } });
  return el;
}

function arrancar(html, { almacen = {}, suelta = true, hash = "", search = "" } = {}) {
  const tablist = entre(html, 'id="tablist">', "</div>").slice('id="tablist">'.length);
  const pre = (/id="vista" data-pre="([^"]*)"/.exec(html) || [])[1];
  const els = { "#vista": elemento(pre ? "<div>pre</div>" : ""), "#tablist": elemento(tablist), "#sello": elemento() };
  if (pre) els["#vista"].dataset.pre = pre;
  const documento = {
    querySelector: s => els[s] || (els[s] = elemento()), querySelectorAll: () => [], getElementById: () => null,
    addEventListener() {}, body: elemento(),
  };
  const ctx = G.contexto(html, leer, {
    document: documento, setTimeout() {}, location: { hash, search, pathname: "/", origin: "http://x" },
    fetch: () => Promise.reject(new Error("sin red")),
    localStorage: { getItem: k => (k in almacen ? almacen[k] : null), setItem() {} },
    navigator: {}, history: { replaceState() {} }, addEventListener() {},
  }, { conArranque: true, suelta, antesDeArrancar: c => { c.App = { iniciar: () => null }; } });
  return { els, ctx };
}

test("con la vista pre-renderizada el arranque no reescribe la vista ni las pestañas", () => {
  const { els } = arrancar(PRE);
  assert.strictEqual(els["#vista"].escrituras, 0);
  assert.strictEqual(els["#tablist"].escrituras, 0);
  assert.strictEqual(els["#vista"].dataset.pre, undefined);    // sirve una sola vez: al volver se arma
  assert.match(els["#sello"].textContent, /productos seguidos/); // el sello se actualiza: dice "hoy" o "ayer"
});

test("sin pre-render (la copia del artifact) el arranque arma todo", () => {
  const { els } = arrancar(HTML);
  assert.strictEqual(els["#vista"].escrituras, 1);
  assert.strictEqual(els["#tablist"].escrituras, 1);
  assert.match(els["#vista"].innerHTML, /id="ultimas"/);
});

test("si la persona habia elegido webcams (categoria curada vieja), la portada pre-renderizada sirve igual", () => {
  const { els } = arrancar(PRE, { almacen: { cat: "webcam" } });
  assert.strictEqual(els["#vista"].escrituras, 0);
});

test("con busquedas guardadas se arma la vista, porque la tira las muestra", () => {
  const { els } = arrancar(PRE, { almacen: { hist2: JSON.stringify([{ q: "ssd 1tb" }]) } });
  assert.strictEqual(els["#vista"].escrituras, 1);
  assert.match(els["#vista"].innerHTML, /ssd 1tb/);
});

test("con un enlace a otra vista se arma esa vista", () => {
  const { els } = arrancar(PRE, { hash: "#veredicto" });
  assert.strictEqual(els["#vista"].escrituras, 1);
  assert.match(els["#vista"].innerHTML, /Veredicto/);
});

test("despues de abrir otra vista, volver a la Comparativa la arma", () => {
  const { els, ctx } = arrancar(PRE, { hash: "#veredicto" });
  ctx.aplicar("comparativa");
  assert.strictEqual(els["#vista"].escrituras, 2);
  assert.match(els["#vista"].innerHTML, /id="ultimas"/);
});

test("el enlace viejo #tiendas abre la Comparativa (Tiendas es una sección de ella desde la spec 021)", () => {
  const { els, ctx } = arrancar(PRE, { hash: "#tiendas" });
  assert.strictEqual(els["#vista"].escrituras, 0);             // es la portada: sirve la pre-renderizada
  assert.strictEqual(require("vm").runInContext("ALIAS.tiendas + ' ' + ANCLAS.tiendas", ctx), "comparativa donde-comprar");
});

test("dentro de un marco (sin boton Imprimir) se arma la vista", () => {
  const { els } = arrancar(PRE, { suelta: false });
  assert.strictEqual(els["#vista"].escrituras, 1);
  assert.doesNotMatch(els["#vista"].innerHTML, /Imprimir/);
});

test("con una consulta en la URL que no se puede abrir, queda la Comparativa armada", async () => {
  const { els } = arrancar(PRE, { search: "?q=ssd" });
  await new Promise(r => setImmediate(r));
  assert.match(els["#vista"].innerHTML, /id="ultimas"/);
});

// ---- La linea de comandos del build ----

test("--salida pre-renderiza el index.html de esa carpeta, y una segunda vez no lo toca", () => {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portada-"));
  try {
    fs.writeFileSync(path.join(dir, "index.html"), HTML);
    fs.cpSync(path.join(RAIZ, "js"), path.join(dir, "js"), { recursive: true });
    const log = console.log; const dichos = []; console.log = m => dichos.push(m);
    try {
      assert.strictEqual(G.main(["--salida", dir]), 0);
      assert.strictEqual(G.main(["--salida", dir]), 0);
    } finally { console.log = log; }
    assert.deepStrictEqual(dichos, ["Portada pre-renderizada", "Portada sin cambios"]);
    assert.strictEqual(fs.readFileSync(path.join(dir, "index.html"), "utf8"), PRE);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("sin --salida explica el uso y sale con error", () => {
  const err = console.error; console.error = () => {};
  try { assert.strictEqual(G.main([]), 2); } finally { console.error = err; }
});

// ---- Lo ultimo en tecnologia en la portada (spec 017, fase 2) ----

const NOVEDADES_EJ = [{ categoria: "notebook", etiqueta: "Notebooks", items: [
  { nombre: "Notebook Gamer ASUS ROG Strix G16 Ryzen 9 9955HX 32GB 1TB RTX 5070", precio: 4900000, url: "https://t.test/a", tienda: "CompraGamer", resumen: "Ryzen 9 serie 9000 · 32 GB de RAM · 1 TB · RTX 5070", ultimo: true },
  { nombre: "Notebook Gamer HP OMEN Core i7 14650HX 16GB 1TB RTX 5060", precio: 3400000, url: "https://t.test/b", tienda: "Mexx", resumen: "Core i7 14ª gen · 16 GB de RAM · 1 TB · RTX 5060", ultimo: false }] }];

test("con novedades, la portada trae «Lo último en tecnología» antes de tus búsquedas, sin animación", () => {
  const pre = G.prerender(HTML, leer, NOVEDADES_EJ);
  const vista = pre.slice(pre.indexOf('id="vista"'), pre.indexOf("<noscript>", pre.indexOf('id="vista"')));
  assert.ok(vista.indexOf('id="novedades"') > 0, "el panel de novedades esta");
  assert.ok(vista.indexOf('id="novedades"') < vista.indexOf('id="ultimas"'), "va primero");
  assert.strictEqual(cuantas(vista, /<div class="panel quieta"/g), 2, "los dos paneles entran sin animacion");
  assert.match(vista, /data-comparar-fila="https:\/\/t\.test\/a"/);
});

test("las novedades viajan en la pagina como NOVEDADES, sin cerrar el script", () => {
  const pre = G.prerender(HTML, leer, [{ ...NOVEDADES_EJ[0], etiqueta: "</script><b>" }]);
  assert.match(pre, /const NOVEDADES = \[/);
  assert.ok(!pre.includes('"etiqueta":"</script>'), "el < se escapa");
  assert.ok(pre.includes("\u003c/script>"));
});

test("sin novedades la portada es la de siempre", () => {
  assert.ok(!G.prerender(HTML, leer, []).includes('id="novedades"'));
  assert.ok(!PRE.includes("const NOVEDADES"));
});

test("novedadesDe lee el indice de la carpeta de salida, y sin indice o con uno roto no rompe", () => {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portada-"));
  try {
    assert.strictEqual(G.novedadesDe(dir, []), null, "sin indice.json");
    fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ tiendas: {}, productos: [] }));
    assert.deepStrictEqual(G.novedadesDe(dir, []), [], "un indice vacio no tiene novedades");
    fs.writeFileSync(path.join(dir, "indice.json"), "{ roto");
    const avisos = [], aviso = console.warn;
    console.warn = m => avisos.push(m);
    try { assert.strictEqual(G.novedadesDe(dir, []), null); } finally { console.warn = aviso; }
    assert.match(avisos[0], /Portada sin novedades/);
    const otro = path.join(dir, "otro.json");
    fs.writeFileSync(otro, JSON.stringify({ tiendas: {}, productos: [] }));
    assert.deepStrictEqual(G.novedadesDe(dir, ["--indice", otro]), [], "--indice manda sobre la carpeta de salida");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- Lo mas buscado en la portada (spec 017, fase 3) ----

test("con lo más buscado, la portada lo trae primero, sin animación, y lo deja disponible para Buscar", () => {
  const pre = G.prerender(HTML, leer, null, ["ssd 1tb", "monitor 27 oled"]);
  const vista = pre.slice(pre.indexOf('id="vista"'), pre.indexOf("<noscript>", pre.indexOf('id="vista"')));
  assert.ok(vista.indexOf('id="mas-buscado"') > 0);
  assert.ok(vista.indexOf('id="mas-buscado"') < vista.indexOf('id="ultimas"'));
  assert.match(vista, /data-comparar="ssd 1tb"/);
  assert.strictEqual(cuantas(vista, /<div class="panel quieta"/g), 2);
  assert.match(pre, /const BUSCADAS = \["ssd 1tb","monitor 27 oled"\];/);
});

test("novedades y lo más buscado viajan juntos, y sin ninguno la portada es la de siempre", () => {
  const pre = G.prerender(HTML, leer, NOVEDADES_EJ, ["ssd 1tb"]);
  const vista = pre.slice(pre.indexOf('id="vista"'));
  assert.ok(vista.indexOf('id="mas-buscado"') < vista.indexOf('id="novedades"'), "primero lo mas buscado, despues las novedades");
  assert.ok(!PRE.includes("const BUSCADAS") && !PRE.includes('id="mas-buscado"'));
});

test("buscadasDe vuelve a filtrar: un dato personal no llega a la página aunque el archivo se haya editado a mano", () => {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buscadas-portada-"));
  try {
    assert.strictEqual(G.buscadasDe(dir), null, "sin archivo");
    fs.writeFileSync(path.join(dir, "buscadas.json"), JSON.stringify({ terminos: ["ssd 1tb", "juan@x.com", "11 5555 1234", "  Monitor  27 ", "a".repeat(80)] }));
    assert.deepStrictEqual(G.buscadasDe(dir), ["ssd 1tb", "monitor 27"]);
    fs.writeFileSync(path.join(dir, "buscadas.json"), JSON.stringify({ terminos: Array.from({ length: 20 }, (_, i) => `memoria ${i}gb`) }));
    assert.strictEqual(G.buscadasDe(dir).length, 8, "con tope");
    fs.writeFileSync(path.join(dir, "buscadas.json"), "{ roto");
    const aviso = console.warn, avisos = [];
    console.warn = m => avisos.push(m);
    try { assert.strictEqual(G.buscadasDe(dir), null); } finally { console.warn = aviso; }
    assert.match(avisos[0], /Portada sin lo mas buscado/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("main escribe la portada con las novedades y lo más buscado de la carpeta de salida", () => {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portada-main-"));
  try {
    fs.mkdirSync(path.join(dir, "datos"));
    for (const f of ["js", "css", "img"]) fs.cpSync(path.join(RAIZ, f), path.join(dir, f), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), HTML);
    fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ tiendas: {}, productos: [] }));
    fs.writeFileSync(path.join(dir, "buscadas.json"), JSON.stringify({ terminos: ["ssd 1tb"] }));
    const log = console.log; console.log = () => {};
    try { assert.strictEqual(G.main(["--salida", dir], ), 0); } finally { console.log = log; }
    const salida = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    assert.match(salida, /const BUSCADAS = \["ssd 1tb"\];/);
    assert.ok(salida.includes('id="mas-buscado"'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- Lo mas vendido en las tiendas (spec 019) ----

const VENDIDOS_EJ = [{ categoria: "notebook", etiqueta: "Notebooks", items: [
  { nombre: "Notebook Gamer ASUS ROG Strix G16", precio: 4800000, url: "https://t.test/v", tienda: "Mexx", resumen: "32 GB de RAM", puesto: 1, tiendas: 2 },
  { nombre: "Notebook Gamer HP OMEN", precio: 3400000, url: "https://t.test/w", tienda: "CompraGamer", resumen: "16 GB de RAM", puesto: 1, tiendas: 1 }] }];

test("lo más vendido va después de lo más buscado y antes de las novedades, y viaja como VENDIDOS", () => {
  const pre = G.prerender(HTML, leer, NOVEDADES_EJ, ["ssd 1tb"], VENDIDOS_EJ);
  const vista = pre.slice(pre.indexOf('id="vista"'));
  assert.ok(vista.indexOf('id="mas-buscado"') < vista.indexOf('id="mas-vendido"'));
  assert.ok(vista.indexOf('id="mas-vendido"') < vista.indexOf('id="novedades"'));
  assert.match(pre, /const VENDIDOS = \[/);
  assert.ok(!PRE.includes("const VENDIDOS") && !PRE.includes('id="mas-vendido"'));
});

test("vendidosDe lee el indice de la carpeta de salida, y sin indice o con uno roto no rompe", () => {
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vendidos-"));
  try {
    assert.strictEqual(G.vendidosDe(dir, []), null, "sin indice.json");
    fs.writeFileSync(path.join(dir, "indice.json"), JSON.stringify({ tiendas: {}, productos: [] }));
    assert.deepStrictEqual(G.vendidosDe(dir, []), []);
    fs.writeFileSync(path.join(dir, "indice.json"), "{ roto");
    const avisos = [], aviso = console.warn;
    console.warn = m => avisos.push(m);
    try { assert.strictEqual(G.vendidosDe(dir, []), null); } finally { console.warn = aviso; }
    assert.match(avisos[0], /Portada sin lo mas vendido/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
