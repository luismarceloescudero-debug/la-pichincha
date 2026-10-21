const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../../js/serie-precios.js");

// Fragmento como lo escribe generar_series.py: dias desde base y precio, un par por cambio.
const FRAG = (s, base = "2026-10-07", hasta = "2026-10-21") => ({ v: 1, base, hasta, s });

test("la clave y el fragmento coinciden con los de generar_series.py (mismos vectores)", () => {
  assert.equal(S.clave("cg", "https://compragamer.com/producto/x_1"), "1587a1b1a60607");
  assert.equal(S.clave("comparaya", "https://articulo.mercadolibre.com.ar/MLA-1-ñandú_JM"), "29181109cccdb");
  for (const u of ["a", "b", "c", "https://x.test/ñ"]) {
    const f = S.fragmento("cg", u);
    assert.ok(Number.isInteger(f) && f >= 0 && f < S.FRAGMENTOS);
  }
});

test("el nombre del fragmento tiene dos cifras", () => {
  assert.equal(S.nombreFragmento(3), "series/03.json");
  assert.equal(S.nombreFragmento(41), "series/41.json");
});

const URL1 = "https://t.test/p1";
const hist = (pares, opts) => S.leer(FRAG({ [S.clave("cg", URL1)]: pares }, opts && opts.base, opts && opts.hasta), "cg", URL1);

test("leer devuelve null si el aviso no esta en el fragmento", () => {
  assert.equal(S.leer(FRAG({}), "cg", URL1), null);
  assert.equal(S.leer(null, "cg", URL1), null);
  assert.equal(S.leer({ v: 99, s: {} }, "cg", URL1), null);
});

test("leer arma los cambios con fecha y los dias de datos son desde el primero hasta la fecha del indice", () => {
  const h = hist([0, 100, 5, 90]);
  assert.deepEqual(h.eventos, [{ fecha: "2026-10-07", precio: 100 }, { fecha: "2026-10-12", precio: 90 }]);
  assert.equal(h.hasta, "2026-10-21");
  assert.equal(h.dias, 14);
});

test("un precio que no cambio es una serie valida de dos puntos: del primer dia a hoy", () => {
  const h = hist([0, 50]);
  const p = S.puntos(h);
  assert.deepEqual(p, [{ fecha: "2026-10-07", precio: 50 }, { fecha: "2026-10-21", precio: 50 }]);
});

test("el punto final de hoy no se duplica si el ultimo cambio es de hoy", () => {
  const h = hist([0, 100, 14, 90]);
  assert.equal(S.puntos(h).length, 2);
});

test("con un solo punto no hay serie: leer da null y el panel dice que falta historia", () => {
  assert.equal(hist([14, 90]), null);
  const html = S.panelHtml(null, "todo", { dias: 0 });
  assert.match(html, /Todavía no hay historia suficiente/);
  assert.doesNotMatch(html, /<svg/);
});

test("las cifras: hoy, minimo con fecha, maximo con fecha y variacion desde el primer dia", () => {
  const h = hist([0, 100000, 3, 120000, 9, 90000]);
  const c = S.cifras(S.ventana(h, "todo"));
  assert.equal(c.hoy, 90000);
  assert.deepEqual(c.min, { precio: 90000, fecha: "2026-10-16" });
  assert.deepEqual(c.max, { precio: 120000, fecha: "2026-10-10" });
  assert.equal(c.desde, "2026-10-07");
  assert.equal(c.variacion, -10);        // 100.000 -> 90.000
  assert.equal(c.dias, 14);
});

test("el minimo y el maximo son la primera fecha en que rigieron, aunque vuelvan despues", () => {
  const h = hist([0, 100, 2, 80, 4, 100, 6, 80]);
  const c = S.cifras(S.ventana(h, "todo"));
  assert.equal(c.min.fecha, "2026-10-09");
  assert.equal(c.max.fecha, "2026-10-07");
});

test("la variacion es 0 y el texto dice sin cambios si el precio no se movio", () => {
  const c = S.cifras(S.ventana(hist([0, 777]), "todo"));
  assert.equal(c.variacion, 0);
  assert.match(S.textoVariacion(c), /sin cambios/);
});

test("el texto de variacion no afirma mas de lo que hay: dice desde cuando y cuantos dias", () => {
  const c = S.cifras(S.ventana(hist([0, 100, 5, 90]), "todo"));
  assert.match(S.textoVariacion(c), /bajó 10%/);
  assert.match(S.textoVariacion(c), /7 oct/);
  const s = S.cifras(S.ventana(hist([0, 100, 5, 125]), "todo"));
  assert.match(S.textoVariacion(s), /subió 25%/);
});

test("los rangos solo existen si los datos los cubren", () => {
  assert.deepEqual(S.rangos(3), []);
  assert.deepEqual(S.rangos(7), [7]);
  assert.deepEqual(S.rangos(14), [7]);
  assert.deepEqual(S.rangos(30), [7, 30]);
  assert.deepEqual(S.rangos(100), [7, 30, 90]);
});

test("un rango de 7 dias arranca con el precio vigente ese dia, no con el primer cambio", () => {
  const h = hist([0, 100, 3, 120, 9, 90]);       // 7 oct, 10 oct, 16 oct; hoy 21 oct; hace 7 dias = 14 oct
  const v = S.ventana(h, 7);
  assert.deepEqual(v[0], { fecha: "2026-10-14", precio: 120 });
  assert.deepEqual(v.slice(-1)[0], { fecha: "2026-10-21", precio: 90 });
  const c = S.cifras(v);
  assert.equal(c.max.precio, 120);
  assert.equal(c.dias, 7);
  assert.equal(c.variacion, -25);
});

test("el texto del resumen dice los dias de datos y las cuatro cifras", () => {
  const h = hist([0, 100000, 9, 90000]);
  const t = S.resumenTexto(S.cifras(S.ventana(h, "todo")));
  assert.match(t, /14 días de datos/);
  assert.match(t, /hoy \$90\.000/);
  assert.match(t, /mínimo \$90\.000/);
  assert.match(t, /máximo \$100\.000/);
});

test("un dia de datos se dice en singular", () => {
  const h = hist([0, 100], { hasta: "2026-10-08" });
  assert.match(S.resumenTexto(S.cifras(S.ventana(h, "todo"))), /1 día de datos/);
});

test("el grafico es un SVG con role=img y etiqueta con el resumen, sin dependencias", () => {
  const h = hist([0, 100000, 3, 120000, 9, 90000]);
  const v = S.ventana(h, "todo");
  const svg = S.svg(v, S.cifras(v));
  assert.match(svg, /^<svg [^>]*role="img"/);
  assert.match(svg, /aria-label="[^"]*14 días de datos/);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/);
  assert.match(svg, /<path class="hp-linea" d="M/);
  assert.equal((svg.match(/<circle/g) || []).length, v.length);
  assert.match(svg, /\$120\.000/);
  assert.match(svg, /\$90\.000/);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
});

test("una linea plana (minimo igual a maximo) no divide por cero", () => {
  const v = S.ventana(hist([0, 500]), "todo");
  const svg = S.svg(v, S.cifras(v));
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/);
  assert.match(svg, /\$500/);
});

test("la linea es escalonada: el precio rige hasta el siguiente cambio", () => {
  const v = S.ventana(hist([0, 100, 7, 80]), "todo");
  const d = /d="([^"]+)"/.exec(S.svg(v, S.cifras(v)))[1];
  assert.match(d, /^M[\d.]+ [\d.]+ H[\d.]+ V[\d.]+ H[\d.]+$/);
});

test("la tabla alternativa trae cada precio con su fecha y el cambio contra el anterior", () => {
  const v = S.ventana(hist([0, 100, 5, 90]), "todo");
  const t = S.tablaHtml(v);
  assert.match(t, /<table/);
  assert.match(t, /<caption/);
  assert.match(t, /7 oct/);
  assert.match(t, /\$100\.000|\$100/);
  assert.match(t, /−10%/);
});

test("el panel junta los dias de datos, las cuatro cifras, el grafico y la tabla", () => {
  const h = hist([0, 100000, 3, 120000, 9, 90000]);
  const html = S.panelHtml(h, "todo", {});
  assert.match(html, /14 días de datos/);
  for (const et of ["Hoy", "Mínimo", "Máximo", "Variación"]) assert.match(html, new RegExp(et));
  assert.match(html, /<svg/);
  assert.match(html, /<table/);
  assert.match(html, /desde el 7 oct/i);
  // con 14 dias solo hay rango de 7 y "todo": nada de 30 ni 90
  assert.match(html, /data-hp-rango="7"/);
  assert.match(html, /data-hp-rango="todo"/);
  assert.doesNotMatch(html, /data-hp-rango="30"/);
  assert.doesNotMatch(html, /data-hp-rango="90"/);
});

test("el panel dice que no es historial anterior al seguimiento", () => {
  const html = S.panelHtml(hist([0, 100, 5, 90]), "todo", {});
  assert.match(html, /no tenemos datos de antes del 7 oct/i);
});

test("con menos de 7 dias de datos no hay selector de rango", () => {
  const html = S.panelHtml(hist([0, 100, 2, 90], { hasta: "2026-10-10" }), "todo", {});
  assert.doesNotMatch(html, /data-hp-rango/);
});

test("todo texto que viene de afuera se escapa", () => {
  const html = S.panelHtml(null, "todo", { mensaje: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("un error de red no se hace pasar por falta de historia", () => {
  const html = S.panelError();
  assert.match(html, /No pude cargar/);
  assert.doesNotMatch(html, /Todavía no hay historia/);
});

test("el panel de rango marca el activo con aria-pressed", () => {
  const h = hist([0, 100, 5, 90]);
  const html = S.panelHtml(h, 7, {});
  assert.match(html, /data-hp-rango="7"[^>]*aria-pressed="true"/);
  assert.match(html, /data-hp-rango="todo"[^>]*aria-pressed="false"/);
});
