/* N-CAL1: con ?q=, #buscar u #ofertas en la URL, index.html pide el indice al empezar a leer la pagina y asegurarIndice
   reusa ese pedido (una sola vez). En la portada sin nada de eso, el indice no se pide hasta abrir Buscar u Ofertas. */
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

/* La pagina de verdad (sus scripts, en orden) con un fetch que cuenta. `falla` hace fallar el primer pedido. */
function pagina(search, hash, { falla = false } = {}) {
  const pedidos = [];
  const fetch = (url, opc) => {
    pedidos.push({ url, cache: opc && opc.cache });
    if (falla && pedidos.length === 1) return Promise.reject(new TypeError("sin red"));
    return Promise.resolve({ json: () => Promise.resolve(INDICE) });
  };
  const ctx = G.contexto(HTML, leer, { fetch, location: { hash, search, pathname: "/", origin: "", href: "http://x/" } });
  return { ctx, pedidos, correr: codigo => vm.runInContext(codigo, ctx) };
}

for (const [search, hash] of [["?q=ram", ""], ["?q=ram", "#buscar"], ["", "#buscar"], ["", "#ofertas"]]) {
  test(`con ${search}${hash} el indice se pide al arrancar y asegurarIndice no lo pide de nuevo`, async () => {
    const { pedidos, correr } = pagina(search, hash);
    assert.equal(pedidos.length, 1, "el pedido temprano");
    assert.deepStrictEqual(pedidos[0], { url: "indice.json", cache: "no-cache" });
    const j = await correr("asegurarIndice()");
    assert.equal(j.generado, INDICE.generado);
    assert.equal(pedidos.length, 1, "reusa el temprano");
    assert.equal(correr("window.INDICE_TEMPRANO"), null, "se usa una sola vez");
    await correr("asegurarIndice(true)");
    assert.equal(pedidos.length, 2, "forzar pide de nuevo");
    assert.equal(pedidos[1].cache, "reload");
  });
}

for (const [search, hash] of [["", ""], ["", "#comparativa"], ["?q=r", ""], ["?x=ram", "#tiendas"]]) {
  test(`sin buscar ni ofertas (${search + hash || "portada"}) el indice no se pide al arrancar`, async () => {
    const { pedidos, correr } = pagina(search, hash);
    assert.equal(pedidos.length, 0);
    await correr("asegurarIndice()");
    assert.equal(pedidos.length, 1, "se pide recien al abrir Buscar u Ofertas");
  });
}

test("si el pedido temprano fallo, asegurarIndice lo pide como siempre", async () => {
  const { pedidos, correr } = pagina("?q=ram", "#buscar", { falla: true });
  const j = await correr("asegurarIndice()");
  assert.equal(j.generado, INDICE.generado);
  assert.equal(pedidos.length, 2);
});
