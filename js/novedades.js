/* Lo ultimo en tecnologia por categoria, para la portada (spec 017, fase 2).
   Elige, de cada categoria, lo mas nuevo y premium POR ESPECIFICACIONES (no por marca, spec 014) que pasa el minimo de su
   gama, y lo pone en una tabla de comparacion directa: especificaciones clave, precio y cuanto mas caro es cada uno contra el
   mas barato. Funciones puras: no tocan el DOM ni la red. El build las corre sobre el indice (generar_portada.js) y escribe el
   resultado en la portada; asi la portada pre-renderizada no pierde puntos de rendimiento (CONSTRAINTS.md). */
(function (raiz) {
  "use strict";

  const nodo = typeof module === "object" && module.exports;
  // Se piden al usarlas: en la pagina estos scripts se cargan en otro orden.
  const M = () => (nodo ? require("./modos.js") : raiz.Modos);
  const C = () => (nodo ? require("./categorias.js") : raiz.Categorias);
  const E = () => (nodo ? require("./especificaciones.js") : raiz.Especificaciones);
  const B = () => (nodo ? require("./buscador.js") : raiz.Buscador);

  const CATEGORIAS = [["smartphone", "Celulares"], ["notebook", "Notebooks"], ["monitor", "Monitores"], ["pc", "PCs armadas"]];
  const POR_CATEGORIA = 3;       // los que se comparan de frente
  const MIN_PARA_COMPARAR = 2;   // con uno solo no hay comparacion: la categoria no sale

  /* [{ categoria, etiqueta, items: [{ nombre, precio, url, tienda, resumen, ultimo }] }] */
  function novedadesPorCategoria(idx, ganadores, { porCategoria = POR_CATEGORIA, categorias = CATEGORIAS } = {}) {
    const m = M(), c = C(), e = E(), b = B();
    const ctx = m.preparar(idx, () => 0, null, ganadores);   // nivelMarca no cuenta: lo premium es por especificaciones
    // Lo nuevo y de aca: sin usados, sin compras internacionales (otro costo y otro plazo), una sola fila por URL.
    const filas = b.unaPorUrl(idx.productos).filter(f => f[1] > 0 && !b.esUsado(f) && !(typeof f[8] === "string" && f[8].includes("i")));
    const novedad = f => m.novedadDe(f[0], ctx.ref);
    const salida = [];
    for (const [categoria, etiqueta] of categorias) {
      const candidatas = filas.filter(f => c.categoriaDe(f[0]) === categoria && ctx.premium(f[0]).premium);
      // Primero lo mas nuevo, despues el mayor puntaje premium y, a igual todo, el mas barato.
      candidatas.sort((a, z) => (novedad(z) - novedad(a) || 0) || (ctx.premium(z[0]).puntos - ctx.premium(a[0]).puntos) || (a[1] - z[1]));
      const vistos = new Set(), items = [];
      for (const f of candidatas) {
        const clave = f[9] || b.normal(String(f[0]));          // el mismo modelo en varias tiendas es uno solo
        if (vistos.has(clave) || !e.mismas(f, f).aplica) continue;   // sin especificaciones legibles no hay con que comparar
        vistos.add(clave);
        items.push({ nombre: f[0], precio: f[1], url: f[2], tienda: (idx.tiendas[f[3]] || {}).nombre || f[3],
          resumen: e.resumen(f), ultimo: novedad(f) === 0 });
        if (items.length === porCategoria) break;
      }
      if (items.length >= MIN_PARA_COMPARAR) salida.push({ categoria, etiqueta, items });
    }
    return salida;
  }

  const corto = n => (n.length > 64 ? n.slice(0, 61) + "…" : n);

  /* El panel de la portada. h = { esc, pesos, enlace, icono }. Sin grupos no sale nada. */
  function novedadesHtml(grupos, h) {
    if (!grupos || !grupos.length) return "";
    const tabla = g => {
      const minimo = Math.min(...g.items.map(i => i.precio));
      const fila = i => {
        const contra = i.precio === minimo ? "el más barato" : `+${Math.round((i.precio / minimo - 1) * 100)}%`;
        // Cuatro columnas y no seis: la tienda va bajo el nombre y lo que cuesta de mas bajo el precio (se lee bien en el celular).
        return `<tr><th scope="row"><a href="${h.enlace(i.url)}" target="_blank" rel="noopener">${h.esc(corto(i.nombre))}</a>`
          + `${i.ultimo ? ' <span class="sello conocida">lo último</span>' : ""}<br><small>${h.esc(i.tienda)}</small></th>`
          + `<td>${h.esc(i.resumen)}</td><td class="num">${h.pesos(i.precio)}<br><small>${h.esc(contra)}</small></td>`
          + `<td><button class="acc" data-comparar-fila="${h.esc(i.url)}" title="Compara solo con avisos de las mismas especificaciones">${h.icono("balanza")} Comparar</button></td></tr>`;
      };
      return `<h3>${h.esc(g.etiqueta)}</h3><div class="scroll"><table class="pt-tabla nov-tabla" aria-label="${h.esc("Lo último en " + g.etiqueta)}">`
        + `<thead><tr><th scope="col">Producto y tienda</th><th scope="col">Especificaciones</th><th scope="col" class="num">Precio</th>`
        + `<th scope="col">Comparar</th></tr></thead>`
        + `<tbody>${g.items.map(fila).join("")}</tbody></table></div>`;
    };
    return `<div class="panel" id="novedades"><div class="panel-head"><h2>Lo último en tecnología</h2>`
      + `<p class="sub">Lo más nuevo y premium de cada categoría, comparado de frente. Solo entran equipos que pasan el mínimo de su gama, `
      + `elegidos por especificaciones y no por marca. Revisá el aviso antes de comprar.</p></div>${grupos.map(tabla).join("")}</div>`;
  }

  /* «Lo mas buscado» (fase 3): los terminos que mas buscan otras personas, cada uno con su comparativa. Sin terminos no sale
     nada. h = { esc }. Solo la lista: el panel no muestra conteos ni nada de quien busco. */
  function masBuscadasHtml(terminos, h) {
    if (!Array.isArray(terminos) || !terminos.length) return "";
    return `<div class="panel" id="mas-buscado"><div class="panel-head"><h2>Lo más buscado</h2>`
      + `<p class="sub">Lo que más buscan otras personas en La Pichincha, de los últimos 30 días. Tocá uno para ver su comparativa. `
      + `Solo se publican búsquedas de productos hechas por varias personas distintas.</p></div>`
      + `<div class="sugeridas">${terminos.map(t => `<button class="sug" data-comparar="${h.esc(t)}">${h.esc(t)}</button>`).join("")}</div></div>`;
  }

  const api = { CATEGORIAS, POR_CATEGORIA, MIN_PARA_COMPARAR, novedadesPorCategoria, novedadesHtml, masBuscadasHtml };
  if (nodo) module.exports = api;
  else raiz.Novedades = api;
})(this);
