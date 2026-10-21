/* Grafico del historial de precios de un aviso (plan v2, D2). Funciones puras: no tocan el DOM ni la red; quien las
   llama (js/vista-historial.js) baja el fragmento y pone el HTML que devuelven.

   Lo que dice y lo que no:
   - Solo cuenta los dias que seguimos el aviso ("N dias de datos"): la serie sale del historial propio, no de antes.
   - Un precio es una escalera: rige hasta el siguiente cambio y el ultimo llega hasta la fecha del indice.
   - Minimo y maximo son del tramo que se ve, con el primer dia en que rigieron. Nada de "minimo historico".
   - Un rango de 7, 30 o 90 dias solo se ofrece si los datos lo cubren; con menos de dos puntos no se dibuja nada.
   La clave y el fragmento se calculan igual que en generar_series.py (cyrb53 sobre tienda, salto de linea y url). */
(function (raiz) {
  "use strict";

  const FRAGMENTOS = 64;
  const VERSION = 1;
  const RANGOS = [7, 30, 90];
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MENOS = "−";

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");

  /* --- Clave y fragmento: cyrb53, el mismo que generar_series.py ------------------------------------------------ */
  function hash53(texto) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < texto.length; i++) {
      const c = texto.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const numero = (tienda, url) => hash53(tienda + "\n" + url);
  const clave = (tienda, url) => numero(tienda, url).toString(16);
  const fragmento = (tienda, url) => numero(tienda, url) % FRAGMENTOS;
  const nombreFragmento = n => "series/" + String(n).padStart(2, "0") + ".json";

  /* --- Fechas (ISO AAAA-MM-DD, siempre en UTC: sin husos ni horario de verano) ------------------------------------ */
  const dia = iso => Date.parse(iso + "T00:00:00Z") / 86400000;
  const iso = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const diasEntre = (a, b) => Math.round(dia(b) - dia(a));
  const fechaCorta = f => { const d = new Date(dia(f) * 86400000); return d.getUTCDate() + " " + MESES[d.getUTCMonth()]; };
  const plural = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
  const textoDias = n => plural(n, "día", "días") + " de datos";

  /* --- Lectura del fragmento ------------------------------------------------------------------------------------------ */
  /* {eventos:[{fecha,precio}], hasta, dias} del aviso, o null si el fragmento no lo trae o no alcanza para un grafico. */
  function leer(frag, tienda, url) {
    if (!frag || frag.v !== VERSION || !frag.s || !frag.base || !frag.hasta) return null;
    const plano = frag.s[clave(tienda, url)];
    if (!Array.isArray(plano) || plano.length < 2 || plano.length % 2) return null;
    const eventos = [];
    for (let i = 0; i < plano.length; i += 2) eventos.push({ fecha: iso(dia(frag.base) + plano[i]), precio: plano[i + 1] });
    const h = { eventos, hasta: frag.hasta, dias: diasEntre(eventos[0].fecha, frag.hasta) };
    return puntos(h).length < 2 ? null : h;
  }

  /* Los cambios y, si el ultimo es anterior a la fecha del indice, el dia de hoy con el mismo precio. */
  function puntos(h) {
    const p = h.eventos.map(e => ({ fecha: e.fecha, precio: e.precio }));
    const ult = p[p.length - 1];
    if (ult.fecha < h.hasta) p.push({ fecha: h.hasta, precio: ult.precio });
    return p;
  }

  /* El precio vigente al final de `fecha`. */
  function precioEl(p, fecha) {
    let v = null;
    for (const x of p) { if (x.fecha > fecha) break; v = x.precio; }
    return v;
  }

  /* Rangos que los datos cubren por completo: ni 30 ni 90 dias con dos semanas de historia. */
  const rangos = dias => RANGOS.filter(n => dias >= n);

  /* Los puntos de un rango: con numero, desde ese dia hacia atras (con el precio que regia entonces); con "todo", todos. */
  function ventana(h, rango) {
    const p = puntos(h);
    if (rango === "todo" || !rangos(h.dias).includes(rango)) return p;
    const inicio = iso(dia(h.hasta) - rango);
    return [{ fecha: inicio, precio: precioEl(p, inicio) }].concat(p.filter(x => x.fecha > inicio));
  }

  /* Hoy, minimo y maximo (primer dia en que rigieron) y variacion contra el primer punto de la ventana. */
  function cifras(v) {
    const primero = v[0], ultimo = v[v.length - 1];
    let min = primero, max = primero;
    for (const x of v) { if (x.precio < min.precio) min = x; if (x.precio > max.precio) max = x; }
    return {
      hoy: ultimo.precio, hasta: ultimo.fecha, desde: primero.fecha, dias: diasEntre(primero.fecha, ultimo.fecha),
      min: { precio: min.precio, fecha: min.fecha }, max: { precio: max.precio, fecha: max.fecha },
      variacion: Math.round((ultimo.precio / primero.precio - 1) * 1000) / 10,
    };
  }

  /* --- Textos --------------------------------------------------------------------------------------------------------- */
  const pct = n => Math.abs(n).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + "%";
  const pctConSigno = n => (n < 0 ? MENOS : n > 0 ? "+" : "") + pct(n);

  function textoVariacion(c) {
    if (c.variacion === 0) return "sin cambios en " + plural(c.dias, "día", "días");
    return (c.variacion < 0 ? "bajó " : "subió ") + pct(c.variacion) + " desde el " + fechaCorta(c.desde);
  }

  function resumenTexto(c) {
    return `Historial de precio, ${textoDias(c.dias)}: hoy ${pesos(c.hoy)}, mínimo ${pesos(c.min.precio)} (${fechaCorta(c.min.fecha)}), `
      + `máximo ${pesos(c.max.precio)} (${fechaCorta(c.max.fecha)}), ${textoVariacion(c)}.`;
  }

  /* --- Grafico: SVG inline, escalonado, sin librerias ------------------------------------------------------------------ */
  const W = 360, H = 170, PI = 66, PD = 12, PS = 16, PB = 26;
  const r1 = n => Math.round(n * 10) / 10;

  function svg(v, c) {
    const x0 = dia(v[0].fecha), x1 = dia(v[v.length - 1].fecha);
    const alto = c.max.precio - c.min.precio;
    const x = f => r1(PI + (x1 === x0 ? 0 : (dia(f) - x0) / (x1 - x0)) * (W - PI - PD));
    // Con precio plano la linea va al medio; si no, entre el minimo (abajo) y el maximo (arriba).
    const y = p => r1(alto ? PS + (1 - (p - c.min.precio) / alto) * (H - PS - PB) : (PS + H - PB) / 2);
    let d = `M${x(v[0].fecha)} ${y(v[0].precio)}`;
    for (let i = 1; i < v.length; i++) {
      d += ` H${x(v[i].fecha)}`;
      if (v[i].precio !== v[i - 1].precio) d += ` V${y(v[i].precio)}`;
    }
    const puntosSvg = v.map(p => `<circle class="hp-punto" cx="${x(p.fecha)}" cy="${y(p.precio)}" r="3"/>`).join("");
    const guia = p => `<line class="hp-eje" x1="${PI}" x2="${W - PD}" y1="${y(p)}" y2="${y(p)}"/>`
      + `<text class="hp-txt" x="${PI - 6}" y="${y(p) + 3.5}" text-anchor="end">${esc(pesos(p))}</text>`;
    const guias = alto ? guia(c.max.precio) + guia(c.min.precio) : guia(c.hoy);
    const etiqueta = resumenTexto(c);
    return `<svg class="hp-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiqueta)}" xmlns="http://www.w3.org/2000/svg">`
      + `<title>${esc(etiqueta)}</title>${guias}`
      + `<path class="hp-linea" d="${d}"/>${puntosSvg}`
      + `<text class="hp-txt" x="${PI}" y="${H - 8}">${esc(fechaCorta(v[0].fecha))}</text>`
      + `<text class="hp-txt" x="${W - PD}" y="${H - 8}" text-anchor="end">${esc(fechaCorta(v[v.length - 1].fecha))}</text></svg>`;
  }

  /* La misma serie como tabla: para quien no ve el grafico y para leer el valor exacto. */
  function tablaHtml(v) {
    const filas = v.map((p, i) => {
      const cambio = i === 0 ? "primer dato" : p.precio === v[i - 1].precio ? "sin cambios"
        : pctConSigno((p.precio / v[i - 1].precio - 1) * 100);
      return `<tr><th scope="row">${esc(fechaCorta(p.fecha))}</th><td>${esc(pesos(p.precio))}</td><td>${esc(cambio)}</td></tr>`;
    }).join("");
    return `<details class="hp-tabla"><summary>Ver los precios en una tabla</summary>`
      + `<table><caption>Precio de este aviso en cada fecha registrada</caption>`
      + `<thead><tr><th scope="col">Fecha</th><th scope="col">Precio</th><th scope="col">Cambio</th></tr></thead><tbody>${filas}</tbody></table></details>`;
  }

  /* --- Panel completo ------------------------------------------------------------------------------------------------- */
  function selector(h, activo) {
    const lista = rangos(h.dias);
    if (!lista.length) return "";
    const boton = (id, txt) => `<button type="button" class="of-chip" data-hp-rango="${id}" aria-pressed="${String(activo === id)}">${esc(txt)}</button>`;
    return `<div class="hp-rangos" role="group" aria-label="Rango del gráfico">`
      + lista.map(n => boton(n, n + " días")).join("") + boton("todo", `Todo (${h.dias} días)`) + `</div>`;
  }

  function cifra(et, valor, chico) {
    return `<div class="hp-cifra"><dt>${esc(et)}</dt><dd><b>${esc(valor)}</b><small>${esc(chico)}</small></dd></div>`;
  }

  /* h: lo que devuelve leer() o null; rango: 7, 30, 90 o "todo"; opciones: { mensaje, dias }. */
  function panelHtml(h, rango, opciones) {
    const o = opciones || {};
    if (!h) {
      return `<div class="hp-panel"><p class="hp-vacio"><b>Todavía no hay historia suficiente</b> para dibujar este precio. `
        + `Hace falta seguirlo al menos dos días; no afirmamos nada con menos.${o.mensaje ? " " + esc(o.mensaje) : ""}</p></div>`;
    }
    const activo = rangos(h.dias).includes(rango) ? rango : "todo";
    const v = ventana(h, activo), c = cifras(v);
    const inicio = fechaCorta(h.eventos[0].fecha);
    return `<div class="hp-panel"><p class="hp-dias"><b>${esc(textoDias(h.dias))}</b> · seguimos este aviso desde el ${esc(inicio)}; `
      + `no tenemos datos de antes del ${esc(inicio)}.</p>`
      + selector(h, activo)
      + `<dl class="hp-cifras">${cifra("Hoy", pesos(c.hoy), fechaCorta(c.hasta))}`
      + cifra("Mínimo", pesos(c.min.precio), "el " + fechaCorta(c.min.fecha))
      + cifra("Máximo", pesos(c.max.precio), "el " + fechaCorta(c.max.fecha))
      + cifra("Variación", c.variacion === 0 ? "0%" : pctConSigno(c.variacion), "desde el " + fechaCorta(c.desde)) + `</dl>`
      + svg(v, c) + tablaHtml(v)
      + `<p class="hp-nota">Precio publicado por la tienda, con lo que se relevó cada día. Mínimo y máximo son del período que se ve.</p></div>`;
  }

  function panelError() {
    return `<div class="hp-panel"><p class="hp-vacio">No pude cargar el historial de este aviso. Probá de nuevo en un rato.</p></div>`;
  }

  const api = { FRAGMENTOS, hash53, clave, fragmento, nombreFragmento, leer, puntos, rangos, ventana, cifras, textoVariacion,
                resumenTexto, svg, tablaHtml, panelHtml, panelError };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.SeriePrecios = api;
})(this);
