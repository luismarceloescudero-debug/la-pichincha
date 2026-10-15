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
  assert.strictEqual(cuantas(tabs, /class="tab"/g), 5);
  assert.match(tabs, /data-ir="comparativa"[^>]*aria-selected="true"/);
  assert.strictEqual(cuantas(tabs, /aria-selected="true"/g), 1);
});

test("el HTML publicado trae el sello con la cantidad de productos", () => {
  const datos = JSON.parse(entre(HTML, "const DATOS = ", G.FINAL).slice("const DATOS = ".length).replace(/;\s*$/, ""));
  assert.match(PRE, new RegExp(`id="sello">Precios verificados en cada sitio[^<]* · ${datos.productos.length} productos seguidos`));
});

test("el HTML publicado trae la comparativa de memorias con una tarjeta por producto", () => {
  const vista = PRE.slice(PRE.indexOf('id="vista"'), PRE.indexOf("<noscript>", PRE.indexOf('id="vista"')));
  assert.match(vista, /^id="vista" data-pre="comparativa:ram">/);
  assert.match(vista, /<h2>Memorias DDR4 16GB/);
  const rams = cuantas(HTML, /"tipo": "ram"/g);
  assert.ok(rams > 0);
  assert.strictEqual(cuantas(vista, /class="card /g), rams);
  assert.match(vista, /fetchpriority="high"/);                 // la primera foto sigue pidiendose enseguida
});

test("la vista pre-renderizada nace quieta: sin animacion de entrada que atrase el LCP", () => {
  const vista = PRE.slice(PRE.indexOf('id="vista"'), PRE.indexOf("<noscript>", PRE.indexOf('id="vista"')));
  assert.strictEqual(cuantas(vista, /class="panel quieta"/g), 1);
  assert.doesNotMatch(entre(HTML, "function vistaComparativa", "function vistaTiendas"), /quieta/); // al navegar, se anima
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
  assert.match(els["#vista"].innerHTML, /class="card /);
});

test("si la persona eligio webcams, se arma su vista", () => {
  const { els } = arrancar(PRE, { almacen: { cat: "webcam" } });
  assert.strictEqual(els["#vista"].escrituras, 1);
  assert.match(els["#vista"].innerHTML, /Webcams/);
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
  assert.match(els["#vista"].innerHTML, /class="card /);
});

test("dentro de un marco (sin boton Imprimir) se arma la vista", () => {
  const { els } = arrancar(PRE, { suelta: false });
  assert.strictEqual(els["#vista"].escrituras, 1);
  assert.doesNotMatch(els["#vista"].innerHTML, /Imprimir/);
});

test("con una consulta en la URL que no se puede abrir, queda la Comparativa armada", async () => {
  const { els } = arrancar(PRE, { search: "?q=ssd" });
  await new Promise(r => setImmediate(r));
  assert.match(els["#vista"].innerHTML, /class="card /);
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
