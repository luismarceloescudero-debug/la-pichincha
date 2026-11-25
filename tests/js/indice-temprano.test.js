/* N-CAL1: con #buscar u #ofertas en la URL, index.html pide el indice al empezar a leer la pagina y asegurarIndice
   reusa ese pedido (una sola vez). Spec 068: con ?q= ya no pide el indice entero sino la porcion de esa busqueda
   (precios/<slug>/filas.json), que pedirPorcion reusa. En la portada sin nada de eso, no se pide nada hasta abrir Buscar u Ofertas. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const G = require("../../generar_portada.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const HTML = leer("index.html");
const INDICE = { generado: "2026-11-17T10:00-03:00", campos: ["nombre", "precio"], tiendas: {}, productos: [] };
const PORCION = { q: "ram", generado: "2026-11-17T10:00-03:00", campos: ["nombre", "precio"], tiendas: { a: { nombre: "A" } }, productos: [["Memoria RAM 8GB", 1000, "https://a/1", "a"]] };

/* La pagina de verdad (sus scripts, en orden) con un fetch que cuenta. `falla` hace fallar el primer pedido del indice. */
function pagina(search, hash, { falla = false, porcion = PORCION } = {}) {
  const pedidos = [];
  let fallo = false;
  const fetch = (url, opc) => {
    pedidos.push({ url, cache: opc && opc.cache });
    if (url.endsWith("/filas.json"))
      return Promise.resolve(porcion ? { ok: true, json: () => Promise.resolve(porcion) } : { ok: false, status: 404 });
    if (falla && !fallo) { fallo = true; return Promise.reject(new TypeError("sin red")); }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(INDICE) });
  };
  const ctx = G.contexto(HTML, leer, { fetch, location: { hash, search, pathname: "/", origin: "", href: "http://x/" } });
  return { ctx, pedidos, correr: codigo => vm.runInContext(codigo, ctx) };
}
const delIndice = pedidos => pedidos.filter(p => p.url === "indice.json");

for (const [search, hash] of [["?q=ram", "#buscar"], ["", "#buscar"], ["", "#ofertas"]]) {
  test(`con ${search}${hash} el indice se pide al arrancar y asegurarIndice no lo pide de nuevo`, async () => {
    const { pedidos, correr } = pagina(search, hash);
    assert.equal(delIndice(pedidos).length, 1, "el pedido temprano");
    assert.deepStrictEqual(delIndice(pedidos)[0], { url: "indice.json", cache: "no-cache" });
    const j = await correr("asegurarIndice()");
    assert.equal(j.generado, INDICE.generado);
    assert.equal(delIndice(pedidos).length, 1, "reusa el temprano");
    assert.equal(correr("window.INDICE_TEMPRANO"), null, "se usa una sola vez");
    await correr("asegurarIndice(true)");
    assert.equal(delIndice(pedidos).length, 2, "forzar pide de nuevo");
    assert.equal(delIndice(pedidos)[1].cache, "reload");
  });
}

for (const [search, hash] of [["", ""], ["", "#comparativa"], ["?q=r", ""], ["?x=ram", "#tiendas"], ["?q=ram", ""], ["?q=ram", "#veredicto"]]) {
  test(`sin buscar ni ofertas (${search + hash || "portada"}) el indice entero no se pide al arrancar`, async () => {
    const { pedidos, correr } = pagina(search, hash);
    assert.equal(delIndice(pedidos).length, 0);
    await correr("asegurarIndice()");
    assert.equal(delIndice(pedidos).length, 1, "se pide recien al abrir Buscar u Ofertas");
  });
}

test("si el pedido temprano fallo, asegurarIndice lo pide como siempre", async () => {
  const { pedidos, correr } = pagina("", "#buscar", { falla: true });
  const j = await correr("asegurarIndice()");
  assert.equal(j.generado, INDICE.generado);
  assert.equal(delIndice(pedidos).length, 2);
});

// ---- Spec 068: la porcion de la busqueda ----

for (const [search, url] of [["?q=ram", "precios/ram/filas.json"], ["?q=SSD%20%201TB", "precios/ssd-1tb/filas.json"],
  ["?q=Placa+de+V%C3%ADdeo", "precios/placa-de-video/filas.json"]]) {
  test(`con ${search} se pide la porcion ${url} al arrancar, y pedirPorcion la reusa`, async () => {
    const { pedidos, correr } = pagina(search, "", { porcion: { ...PORCION, q: new URLSearchParams(search).get("q") } });
    assert.deepStrictEqual(pedidos, [{ url, cache: "no-cache" }]);
    const j = await correr(`pedirPorcion(${JSON.stringify(new URLSearchParams(search).get("q"))})`);
    assert.ok(j && j.productos.length === 1);
    assert.equal(pedidos.length, 1, "reusa la temprana");
    assert.equal(correr("window.PORCION_TEMPRANA"), null, "se usa una sola vez");
  });
}

test("una porcion de otra busqueda con el mismo slug no se usa", async () => {
  const { correr } = pagina("?q=ram", "", { porcion: { ...PORCION, q: "r-a-m" } });
  assert.equal(await correr('pedirPorcion("ram")'), null);
});

test("sin porcion (404) pedirPorcion da null y el arranque baja el indice entero", async () => {
  const { correr } = pagina("?q=ram", "", { porcion: null });
  assert.equal(await correr('pedirPorcion("ram")'), null);
});

test("con la porcion IDX queda parcial: ofertas no se calculan y asegurarIndice baja el indice entero", async () => {
  const { pedidos, correr } = pagina("?q=ram", "");
  const j = await correr('pedirPorcion("ram")');
  correr("usarPorcion")(j);
  assert.equal(correr("IDX.parcial"), true);
  assert.equal(correr("ofertasListas()"), null, "las ofertas de una porcion serian falsas");
  assert.equal(correr("VISTAS.find(v => v.id === 'buscar').n()"), null, "la pestaña Buscar no dice 1 producto");
  const entero = await correr("asegurarIndice()");
  assert.equal(entero.generado, INDICE.generado);
  assert.equal(correr("IDX.parcial"), undefined);
  assert.equal(delIndice(pedidos).length, 1);
});
