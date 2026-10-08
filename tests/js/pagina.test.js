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
