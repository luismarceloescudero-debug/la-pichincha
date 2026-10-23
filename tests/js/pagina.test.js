const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../../js/pagina.js");

test("leerUrl toma q y la vista", () => {
  assert.deepEqual(P.leerUrl("?q=ssd+1tb", "#comparativa"), { q: "ssd 1tb", vista: "comparativa" });
  assert.deepEqual(P.leerUrl("", ""), { q: "", vista: "" });
  assert.deepEqual(P.leerUrl("?q=%20a%20", "#buscar"), { q: "", vista: "buscar" });
  assert.deepEqual(P.leerUrl("?q=monitor%20%2027%22&utm_source=wa", ""), { q: 'monitor 27"', vista: "" });
  assert.equal(P.leerUrl("?q=" + "x".repeat(150), "").q.length, 100);
});

test("armarUrl escribe q y la vista solo si hay", () => {
  assert.equal(P.armarUrl("/la-pichincha/", "ssd 1tb", "comparativa"), "/la-pichincha/?q=ssd+1tb#comparativa");
  assert.equal(P.armarUrl("/la-pichincha/", "", "ofertas"), "/la-pichincha/#ofertas");
  assert.equal(P.armarUrl("/la-pichincha/", "  ", ""), "/la-pichincha/");
});

test("una consulta con caracteres raros va y vuelve intacta", () => {
  for (const q of ['monitor 27"', "placa de video & cía", "ssd 1tb #oferta", "100% algodón", "rtx 4060+ti"]) {
    const u = new URL("https://x.test" + P.armarUrl("/la-pichincha/", q, "veredicto"));
    assert.deepEqual(P.leerUrl(u.search, u.hash), { q, vista: "veredicto" });
  }
});

test("cuando habla en hora argentina", () => {
  const ahora = new Date("2026-10-08T18:00:00-03:00");
  assert.equal(P.cuando("2026-10-08T15:25-03:00", ahora), "hoy 15:25");
  assert.equal(P.cuando("2026-10-07T23:59-03:00", ahora), "ayer 23:59");
  assert.equal(P.cuando("2026-10-05T09:05-03:00", ahora), "5/10 09:05");
  // 22:00 del 7 en Argentina ya es el 8 en UTC: igual es "hoy" si alla todavia es el 7.
  assert.equal(P.cuando("2026-10-07T22:00-03:00", new Date("2026-10-08T02:00:00Z")), "hoy 22:00");
});

test("cuando con un indice viejo sin hora, o basura", () => {
  assert.equal(P.cuando("2026-10-07", new Date("2026-10-08T12:00:00-03:00")), "el 7/10");
  assert.equal(P.cuando("", new Date()), "");
  assert.equal(P.cuando(undefined, new Date()), "");
  assert.equal(P.cuando("basura", new Date()), "");
});

test("comercioDeUrl se queda con el dominio del comercio", () => {
  assert.equal(P.comercioDeUrl("https://www.mexx.com.ar/productos-rubro/x.html"), "mexx.com.ar");
  assert.equal(P.comercioDeUrl("https://articulo.mercadolibre.com.ar/MLA-123"), "mercadolibre.com.ar");
  assert.equal(P.comercioDeUrl("https://compragamer.com/producto/x"), "compragamer.com");
  assert.equal(P.comercioDeUrl("https://www.gamingcity.com.ar/a--det--1"), "gamingcity.com.ar");
  assert.equal(P.comercioDeUrl("mailto:x@y.com"), "");
  assert.equal(P.comercioDeUrl("no es url"), "");
});

test("eventoBusqueda separa las vacias y recorta el termino", () => {
  assert.deepEqual(P.eventoBusqueda("ssd 1tb", 45), { path: "busqueda/ssd 1tb", title: "45 resultados", event: true });
  assert.equal(P.eventoBusqueda("ssd 1tb", 1).title, "1 resultado");
  assert.deepEqual(P.eventoBusqueda("xyzzy", 0), { path: "busqueda_vacia/xyzzy", title: "sin resultados", event: true });
  assert.equal(P.eventoBusqueda("   ", 3), null);
  assert.equal(P.eventoBusqueda("a  b", 2).path, "busqueda/a b");
  assert.equal(P.eventoBusqueda("a".repeat(80), 2).path, "busqueda/" + "a".repeat(60));
});

test("eventoClic y eventoAccion", () => {
  assert.deepEqual(P.eventoClic("https://www.mexx.com.ar/p.html", "memoria"),
    { path: "clic_saliente/mexx.com.ar/memoria", title: "mexx.com.ar", event: true });
  assert.equal(P.eventoClic("https://www.mexx.com.ar/p.html", "").path, "clic_saliente/mexx.com.ar/otro");
  assert.equal(P.eventoClic("mailto:x@y.com", "a"), null);
  assert.deepEqual(P.eventoAccion("excel", "buscar"), { path: "exportar/excel/buscar", title: "buscar", event: true });
  assert.equal(P.eventoAccion("csv", "buscar").path, "exportar/csv/buscar");
  assert.equal(P.eventoAccion("imprimir", "ofertas").path, "exportar/imprimir/ofertas");
  assert.equal(P.eventoAccion("copiar", "comparativa").path, "compartir/copiar/comparativa");
  assert.equal(P.eventoAccion("compartir", "veredicto").path, "compartir/nativo/veredicto");
  assert.equal(P.eventoAccion("otra", "x"), null);
});

test("precioDel avisa solo si el relevamiento es de otro dia argentino", () => {
  const ref = "2026-10-08T15:25-03:00";
  assert.equal(P.precioDel("2026-10-08T15:25-03:00", ref), "");
  assert.equal(P.precioDel("2026-10-08T09:00-03:00", ref), "");            // otra corrida del mismo dia
  assert.equal(P.precioDel("2026-10-07T15:25-03:00", ref), "precio del 7/10");
  // 23:30 del 7 en Argentina ya es el 8 en UTC: sigue siendo del 7.
  assert.equal(P.precioDel("2026-10-07T23:30-03:00", "2026-10-08T00:10-03:00"), "precio del 7/10");
  assert.equal(P.precioDel("2026-10-07", ref), "precio del 7/10");         // indice viejo sin hora
  assert.equal(P.precioDel("2026-09-30T10:00-03:00", ref), "precio del 30/9");
});

test("precioDel sin datos no inventa un aviso", () => {
  const ref = "2026-10-08T15:25-03:00";
  assert.equal(P.precioDel("", ref), "");
  assert.equal(P.precioDel(undefined, ref), "");
  assert.equal(P.precioDel("basura", ref), "");
  assert.equal(P.precioDel("2026-10-07T15:25-03:00", ""), "");
});

test("sinVerificar dice desde cuando falla un producto curado", () => {
  const ref = "2026-10-09T15:25-03:00";
  assert.equal(P.sinVerificar("", ref), "");
  assert.equal(P.sinVerificar(undefined, ref), "");
  assert.equal(P.sinVerificar("2026-10-09", ref), "sin verificar hoy");
  assert.equal(P.sinVerificar("2026-10-08", ref), "sin verificar desde el 8/10");
  assert.equal(P.sinVerificar("2026-10-08", ""), "sin verificar desde el 8/10"); // --build no estampa hora
  assert.equal(P.sinVerificar("basura", ref), "");
});

test("fechaHora da la fecha fija, sin 'hoy' ni 'ayer', para texto que queda escrito", () => {
  assert.equal(P.fechaHora("2026-10-12T18:05-03:00"), "12/10 18:05");
  assert.equal(P.fechaHora("2026-10-07T23:30-03:00"), "7/10 23:30");
  assert.equal(P.fechaHora("2026-10-07"), "7/10");
  assert.equal(P.fechaHora(""), "");
  assert.equal(P.fechaHora("basura"), "");
});

test("la hora argentina sale de UTC-3 fijo, sin Intl: crear el formato con zona horaria era una tarea larga al abrir", () => {
  const vm = require("node:vm");
  const fs = require("fs");
  const codigo = fs.readFileSync(require.resolve("../../js/pagina.js"), "utf8");
  const IntlRoto = { DateTimeFormat: function () { throw new Error("Intl.DateTimeFormat no se usa"); } };
  const ctx = vm.createContext({ Intl: IntlRoto, URLSearchParams });
  vm.runInContext(codigo, ctx);
  const ahora = new Date("2026-10-08T18:00:00-03:00");
  assert.equal(ctx.Pagina.cuando("2026-10-08T15:25-03:00", ahora), "hoy 15:25");
  assert.equal(ctx.Pagina.cuando("2026-10-07T22:00-03:00", new Date("2026-10-08T02:00:00Z")), "hoy 22:00");
  assert.equal(ctx.Pagina.fechaHora("2026-10-12T00:05:00Z"), "11/10 21:05");
  assert.equal(ctx.Pagina.fechaHora("2026-03-01T03:07:00Z"), "1/3 00:07");
});

// ---- Afiliado de Amazon (Fase E1): un enlace de busqueda con el Store ID, rotulado ----
test("enlaceAmazon arma una busqueda en amazon.com con el Store ID y el termino codificado", () => {
  const u = new URL(P.enlaceAmazon("Cargador UGREEN 65W & cable"));
  assert.strictEqual(u.origin, "https://www.amazon.com");
  assert.strictEqual(u.pathname, "/s");
  assert.strictEqual(u.searchParams.get("k"), "Cargador UGREEN 65W & cable");
  assert.strictEqual(u.searchParams.get("tag"), "lapichincha-20");
  assert.strictEqual(P.AMAZON_TAG, "lapichincha-20");
});

test("enlaceAmazon recorta el termino y no arma nada si esta vacio", () => {
  assert.strictEqual(P.enlaceAmazon("   "), null);
  assert.strictEqual(P.enlaceAmazon(null), null);
  assert.ok(new URL(P.enlaceAmazon("x".repeat(500))).searchParams.get("k").length <= 100);
});

// ---- Afiliado de Mercado Libre (spec 027): el usuario y la herramienta del programa, solo en mercadolibre.com.ar ----
test("enlaceTienda suma el codigo de afiliado a una pagina de Mercado Libre y conserva lo demas", () => {
  const e = P.enlaceTienda("https://www.mercadolibre.com.ar/notebook-acer/p/MLA67221216?pdp_filters=item_id#reco");
  const u = new URL(e.url);
  assert.strictEqual(e.afiliado, true);
  assert.strictEqual(u.pathname, "/notebook-acer/p/MLA67221216");
  assert.strictEqual(u.searchParams.get("pdp_filters"), "item_id");
  assert.strictEqual(u.searchParams.get("matt_word"), "chococuyano");
  assert.strictEqual(u.searchParams.get("matt_tool"), "31231658");
  assert.strictEqual(u.hash, "#reco");
  assert.strictEqual(P.enlaceTienda("https://articulo.mercadolibre.com.ar/MLA-123-x").afiliado, true);
  const repetido = new URL(P.enlaceTienda("https://www.mercadolibre.com.ar/x?matt_word=otro").url);
  assert.deepStrictEqual(repetido.searchParams.getAll("matt_word"), ["chococuyano"]);
});

test("enlaceTienda deja igual cualquier otro enlace", () => {
  for (const url of ["https://www.oncity.com/redmi/p", "http://www.mercadolibre.com.ar/x", "https://mercadolibre.com.ar.otro.test/x",
                     "https://falsomercadolibre.com.ar/x", "https://www.mercadolibre.com/x", "javascript:alert(1)", "no es url", ""]) {
    assert.deepStrictEqual(P.enlaceTienda(url), { url, afiliado: false });
  }
});

test("cambioDe: desde cuando tiene el aviso su precio, y que el historial empezo en una fecha", () => {
  assert.equal(P.cambioDe("2026-10-12", "2026-10-07"), "precio sin cambios desde el 12/10/2026");
  assert.equal(P.cambioDe("2026-10-07", "2026-10-07"), "precio sin cambios desde el 7/10/2026 (cuando empezamos a seguirlo; puede ser más antiguo)");
  assert.equal(P.cambioDe("2026-09-30", "2026-10-07"), "precio sin cambios desde el 30/9/2026 (cuando empezamos a seguirlo; puede ser más antiguo)");
  assert.equal(P.cambioDe("2026-10-12", ""), "precio sin cambios desde el 12/10/2026");
});

test("cambioDe: sin fecha o con una fecha rara no afirma nada", () => {
  for (const v of ["", null, undefined, "basura", "2026-10", 20261012]) assert.equal(P.cambioDe(v, "2026-10-07"), "", String(v));
});
