const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const G = require("../../generar_portada.js");

const RAIZ = path.join(__dirname, "..", "..");
const leer = ruta => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const HTML = leer("index.html");

/* Un DOM minimo: cada selector devuelve siempre el mismo elemento, con lo justo para la lista y el panel. */
function elemento(extra = {}) {
  const el = { innerHTML: "", textContent: "", value: "", open: false, dataset: {}, atributos: {}, clases: new Set(),
    oyentes: {}, hijos: [],
    classList: { toggle: (c, on) => (on ? el.clases.add(c) : el.clases.delete(c)) },
    setAttribute(k, v) { el.atributos[k] = v; }, addEventListener(t, f) { el.oyentes[t] = f; },
    querySelector: () => null, querySelectorAll: () => el.hijos, blur() {}, ...extra };
  return el;
}

function pagina(guardado = {}) {
  const els = {}, oyentes = {}, botones = [];
  const doc = { querySelector: s => els[s] || (els[s] = elemento()), querySelectorAll: sel => botones.filter(b => sel === "[data-orden2]" ? b.dataset.orden2 : sel === "[data-orden]" ? b.dataset.orden : true), getElementById: () => null,
    addEventListener(t, f) { (oyentes[t] = oyentes[t] || []).push(f); }, activeElement: null };
  const almacen = { ...guardado };
  const localStorage = { getItem: k => (k in almacen ? almacen[k] : null), setItem: (k, v) => { almacen[k] = v; } };
  const ctx = G.contexto(HTML, leer, { document: doc, setTimeout() {}, clearTimeout() {}, localStorage });
  // un SSD de cada tienda, y dos tiendas que venden el mismo modelo
  const fila = (nombre, precio, tienda, modelo = "") =>
    [nombre, precio, `https://${tienda}.test/${encodeURIComponent(nombre)}`, tienda, "", 0, 0, "", "", modelo];
  ctx.__idx = {
    generado: "2026-10-15T10:00-03:00",
    tiendas: { cg: { nombre: "CompraGamer", color: "cg" }, gc: { nombre: "Gaming City", color: "gc" }, mx: { nombre: "Mexx", color: "mx" } },
    productos: [
      fila("Disco Solido SSD Kingston NV2 1TB M.2", 80000, "gc", "SNV2S/1000G"),
      fila("Disco Solido SSD Kingston NV2 1TB M.2", 90000, "cg", "SNV2S/1000G"),
      fila("Disco Solido SSD Hiksemi Wave 1TB SATA", 60000, "mx"),
      fila("Disco Solido SSD Adata SU650 1TB SATA usado", 50000, "mx"),
      fila("Disco Solido SSD Western Digital Green 1TB SATA", 70000, "cg"),
    ],
  };
  require("vm").runInContext("IDX = __idx", ctx);
  return { ctx, els, oyentes, botones, almacen, correr: codigo => require("vm").runInContext(codigo, ctx) };
}

test("la vista Buscar trae el panel de filtros, plegado, con todos sus controles", () => {
  const { correr } = pagina();
  const html = correr("vistaBuscar()");
  assert.match(html, /<details class="filtros" id="filtros"><summary>Filtros<\/summary>/);
  assert.doesNotMatch(html, /<details class="filtros"[^>]* open/);
  for (const id of ['id="f-min"', 'id="f-max"', 'id="f-excluir"', 'data-filtro="primera"', 'data-filtro="quitar"'])
    assert.ok(html.includes(id), id);
  assert.match(html, /<label class="of-et" for="f-excluir">/);   // el campo de texto tiene su etiqueta
});

test("un chip por tienda del indice, con aria-pressed", () => {
  const { correr } = pagina();
  const html = correr("filtrosHtml()");
  assert.strictEqual((html.match(/data-filtro="tienda"/g) || []).length, 3);
  assert.match(html, /data-valor="gc" aria-pressed="false">Gaming City/);
});

test("cambiarFiltro marca y desmarca tiendas, alterna primera linea y quita todo", () => {
  const { correr } = pagina();
  correr('cambiarFiltro("tienda", "gc"); cambiarFiltro("tienda", "cg")');
  assert.deepStrictEqual([...correr("FILTROS.tiendas")], ["gc", "cg"]);   // [...]: viene de otro contexto de vm
  correr('cambiarFiltro("tienda", "gc")');
  assert.deepStrictEqual([...correr("FILTROS.tiendas")], ["cg"]);
  correr('cambiarFiltro("primera")');
  assert.strictEqual(correr("FILTROS.primera"), true);
  correr('cambiarFiltro("primera")');
  assert.strictEqual(correr("FILTROS.primera"), false);
  correr('cambiarFiltro("primera"); cambiarFiltro("quitar")');
  assert.strictEqual(correr("Buscador.hayFiltros(FILTROS)"), false);
});

test("los campos de precio leen cifras con puntos y los de texto, tal cual", () => {
  const { correr } = pagina();
  assert.strictEqual(correr('numeroDe("60.000")'), 60000);
  assert.strictEqual(correr('numeroDe("$ 1.250.000")'), 1250000);
  assert.strictEqual(correr('numeroDe("")'), null);
  assert.strictEqual(correr('numeroDe("abc")'), null);
});

test("al escribir en un campo se actualiza el filtro; un campo ajeno no hace nada", () => {
  const { correr } = pagina();
  const caja = elemento();
  correr("engancharFiltros").call(null, caja);
  const escribir = (id, value) => caja.oyentes.input({ target: { id, value } });
  escribir("f-min", "60.000"); escribir("f-max", "120.000"); escribir("f-excluir", "kit, usado");
  assert.strictEqual(correr("FILTROS.min"), 60000);
  assert.strictEqual(correr("FILTROS.max"), 120000);
  assert.strictEqual(correr("FILTROS.excluir"), "kit, usado");
  escribir("q", "otra cosa");
  assert.strictEqual(correr("FILTROS.excluir"), "kit, usado");
});

test("sincronizarFiltros refleja el estado en los controles, con miles, y no pisa el campo en uso", () => {
  const { correr, els } = pagina();
  const chip = elemento({ dataset: { valor: "gc" } });
  const primera = elemento();
  const caja = elemento({ hijos: [chip], querySelector: s => (s === '[data-filtro="primera"]' ? primera : null) });
  els["#filtros"] = caja; els["#f-min"] = elemento(); els["#f-max"] = elemento(); els["#f-excluir"] = elemento();
  correr('FILTROS.tiendas = ["gc"]; FILTROS.primera = true; FILTROS.min = 60000; FILTROS.excluir = "kit"; sincronizarFiltros()');
  assert.strictEqual(chip.atributos["aria-pressed"], "true");
  assert.strictEqual(primera.atributos["aria-pressed"], "true");
  assert.strictEqual(els["#f-min"].value, (60000).toLocaleString("es-AR"));
  assert.strictEqual(els["#f-max"].value, "");
  assert.strictEqual(els["#f-excluir"].value, "kit");
  assert.ok(caja.clases.has("activo") && caja.open);
  const enUso = els["#f-excluir"];
  correr("document").activeElement = enUso;
  correr('FILTROS.excluir = "otra"; sincronizarFiltros()');
  assert.strictEqual(enUso.value, "kit");                      // la persona esta escribiendo ahi
});

test("la lista muestra solo lo que cumple, dice cuantos oculto y no toca la mediana", () => {
  const { correr, els } = pagina();
  els["#q"] = elemento({ value: "ssd 1tb" });
  correr('pintarResultados("ssd 1tb")');
  const sinFiltros = els["#res"].innerHTML;
  const mediana = /mediana \$[\d.]+/.exec(els["#estado"].innerHTML)[0];
  assert.match(sinFiltros, /Kingston/);
  assert.match(sinFiltros, /Hiksemi/);
  correr('FILTROS.tiendas = ["mx"]; FILTROS.excluir = "usado"; pintarResultados("ssd 1tb")');
  assert.match(els["#res"].innerHTML, /Hiksemi/);
  assert.doesNotMatch(els["#res"].innerHTML, /Kingston|Adata|Western/);
  assert.match(els["#estado"].innerHTML, /oculto/);
  assert.ok(els["#estado"].innerHTML.includes(mediana), "la mediana es la del mercado, no la de la lista filtrada");
});

test("el mismo modelo sigue saliendo con la tienda marcada, y 'tambien en' dice la otra", () => {
  const { correr, els } = pagina();
  correr('FILTROS.tiendas = ["cg"]; pintarResultados("ssd 1tb")');
  const html = els["#res"].innerHTML;
  assert.match(html, /Kingston/);
  assert.match(html, /\$90\.000/);                             // el de CompraGamer, no el de Gaming City ($80.000)
  assert.match(html, /También en/);
  assert.match(html, /Gaming City \$80\.000/);
});

test("sin ningun resultado dice que son los filtros y ofrece quitarlos", () => {
  const { correr, els } = pagina();
  correr('FILTROS.min = 9999999; pintarResultados("ssd 1tb")');
  assert.match(els["#estado"].textContent, /ningún aviso cumple los filtros \(hay \d+ sin filtrar\)/);
  assert.match(els["#res"].innerHTML, /data-filtro="quitar"/);
});

/* --- Los tres modos y el orden de adentro (spec 013) --- */

test("la vista Buscar trae los tres modos y los tres ordenes, y ya no 'Más barato' ni 'Mejor marca'", () => {
  const { correr } = pagina();
  const html = correr("vistaBuscar()");
  for (const m of ["recomendacion", "super", "primera"]) assert.ok(html.includes(`data-orden="${m}"`), m);
  for (const o of ["precio", "novedades", "premium"]) assert.ok(html.includes(`data-orden2="${o}"`), o);
  assert.match(html, /data-orden="recomendacion" aria-selected="true"[^>]*>Recomendación</);
  assert.match(html, /data-orden="super"[^>]*>Súper Oferta</);
  assert.match(html, /data-orden="primera"[^>]*>Primera Línea</);
  assert.match(html, /data-orden2="precio" aria-selected="true"[^>]*>Precio ↓</);
  assert.match(html, /role="group" aria-label="Ordenar por"/);
  assert.doesNotMatch(html, /Más barato|Mejor marca|Recomendado</);
});

test("lo guardado por la version anterior ('precio', 'marca') arranca en Recomendacion", () => {
  for (const viejo of ["precio", "marca", "recomendado"]) {
    const { correr } = pagina({ orden: viejo, orden2: "marca" });
    assert.strictEqual(correr("ORDEN"), "recomendacion", viejo);
    assert.strictEqual(correr("ORDEN2"), "precio");
  }
  const { correr } = pagina({ orden: "primera", orden2: "premium" });
  assert.strictEqual(correr("ORDEN"), "primera");
  assert.strictEqual(correr("ORDEN2"), "premium");
});

test("Recomendacion lista de mayor a menor precio, con marca reconocida (Kingston, Hiksemi) y sin la que no", () => {
  const { correr, els } = pagina();
  correr("MARCAS.primera.push('kingston'); MARCAS.conocida.push('hiksemi')");
  correr('pintarResultados("ssd 1tb")');
  const html = els["#res"].innerHTML;
  const precios = [...html.matchAll(/class="pre">\$([\d.]+)</g)].map(m => +m[1].replace(/\./g, ""));
  assert.ok(precios.length >= 2);
  assert.deepStrictEqual(precios, [...precios].sort((a, b) => b - a));
});

test("un modo sin resultados no deja la pantalla vacia: lo explica y ofrece el modo que si tiene", () => {
  const { correr, els } = pagina();
  correr("MARCAS.primera.push('kingston')");
  correr('ORDEN = "super"; pintarResultados("ssd 1tb")');
  assert.match(els["#estado"].textContent, /ningún aviso entra en Súper Oferta \(hay \d+ en esta búsqueda\)/);
  assert.match(els["#res"].innerHTML, /En «Súper Oferta» no hay nada para esta búsqueda/);
  assert.match(els["#res"].innerHTML, /data-orden="primera"[^>]*>Primera Línea \(\d+\)/);
  assert.ok(els["#res"].innerHTML.length > 100);
});

test("Primera Linea sin marcas de primera linea en la busqueda ofrece Recomendacion, que si tiene", () => {
  const { correr, els } = pagina();
  correr('ORDEN = "primera"; pintarResultados("hiksemi")');
  assert.match(els["#res"].innerHTML, /En «Primera Línea» no hay nada.*ningún aviso es de una marca de primera línea/);
  assert.match(els["#res"].innerHTML, /data-orden="recomendacion"[^>]*>Recomendación \(1\)/);
});

test("al tocar un modo o un orden se guarda, se marca y se vuelve a pintar", () => {
  const { correr, els, botones, almacen } = pagina();
  const b1 = elemento({ dataset: { orden: "super" } }), b2 = elemento({ dataset: { orden2: "novedades" } });
  botones.push(b1, b2);
  els["#q"] = elemento({ value: "ssd 1tb" });
  correr('elegirOrden("super", null)');
  assert.strictEqual(correr("ORDEN"), "super");
  assert.strictEqual(almacen.orden, "super");
  assert.strictEqual(b1.atributos["aria-selected"], "true");
  assert.strictEqual(b2.atributos["aria-selected"], "false");
  correr('elegirOrden(null, "novedades")');
  assert.strictEqual(correr("ORDEN2"), "novedades");
  assert.strictEqual(almacen.orden2, "novedades");
  assert.strictEqual(b2.atributos["aria-selected"], "true");
  assert.match(els["#estado"].textContent, /ningún aviso entra en Súper Oferta/, "se volvio a pintar");
  correr('elegirOrden("marca", null)');
  assert.strictEqual(correr("ORDEN"), "recomendacion", "un valor viejo o inventado cae en Recomendacion");
});
