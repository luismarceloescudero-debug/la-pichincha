/* Analisis de una consulta: que avisos son comparables, la mejor compra, el ranking de
   comercios y que quedo afuera. Es la misma logica para la Comparativa interactiva
   (index.html) y para las paginas estaticas por busqueda (generar_paginas.js): por eso
   vive en un modulo puro, sin DOM, y recibe lo que depende de la pagina en `ctx`.
   ctx = { buscarTodo(q), comercioDe(f), colorDe(f), marcaDe(nombre), nivelMarca(nombre), pesos(n) } */
(function (raiz) {
  "use strict";

  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;
  const { capacidadGB, compatibles, mediana, motivoExclusion, normal, normalBusq, pisoDeGama } = B;
  // Ofertas carga categorias; la comparacion de configuraciones de equipos vive ahi. Se pide al usarla: en la pagina
  // js/ofertas.js se carga despues de este modulo.
  const mismaConfig = () => (typeof module === "object" && module.exports ? require("./ofertas.js") : raiz.Ofertas).mismaConfiguracion;
  // Las especificaciones clave de una tarjeta (spec 017). Tambien se pide al usarla, por el mismo motivo.
  const especificaciones = () => (typeof module === "object" && module.exports ? require("./especificaciones.js") : raiz.Especificaciones);

  /* --- Precio por tienda --------------------------------------------------
     El mismo modelo en cada comercio, de menor a mayor precio, con el porcentaje contra la tienda mas barata y lo que
     se ahorra contra la mas cara. Solo entran avisos comparables del mismo modelo: mismo codigo (lo garantiza
     agruparPorModelo), misma capacidad, OC contra OC, la misma configuracion en un equipo, y lo que la consulta no excluye
     (internacionales, usados, accesorios). Varios avisos de una misma tienda son UNA tienda: queda el mas barato.
     Con una sola tienda no hay comparacion y no se inventa. El orden es solo por precio (comisiones nunca lo cambian).
     ctx = { comercioDe(f), pesos(n), fechaDe(f)?, admite(f)? } */
  const esOC = nombre => /\b(?:oc|overclock(?:ed)?)\b/.test(normal(String(nombre)));

  function precioPorTienda(f, otras, ctx) {
    const { comercioDe, pesos, fechaDe = () => "", admite = () => true } = ctx;
    const mismaC = mismaConfig();
    const grupo = [f, ...(otras || [])].filter(x => x === f || admite(x));
    const conCap = [...grupo].sort((a, b) => a[1] - b[1]).find(x => capacidadGB(x[0]));
    const pivote = capacidadGB(f[0]) ? f : conCap || f;
    const oc = esOC(f[0]);
    const mismos = grupo.filter(x => x === f || (compatibles(pivote, x) && esOC(x[0]) === oc && mismaC(f, x)));
    const porComercio = new Map();
    for (const x of [...mismos].sort((a, b) => a[1] - b[1] || (comercioDe(a) < comercioDe(b) ? -1 : 1))) {
      const k = normal(String(comercioDe(x) ?? ""));
      if (!porComercio.has(k)) porComercio.set(k, x);
    }
    const filas = [...porComercio.values()];
    const unico = filas.length < 2;
    const minimo = filas[0][1], maximo = filas[filas.length - 1][1];
    const tiendas = filas.map(x => {
      const pct = unico ? null : Math.round((x[1] / minimo - 1) * 100);
      const pctTexto = unico ? "" : x[1] === minimo ? "la más barata" : pct === 0 ? "+<1%" : `+${pct}%`;
      return { f: x, comercio: comercioDe(x), precio: x[1], url: x[2], pct, pctTexto, fecha: fechaDe(x) || "" };
    });
    const ahorro = unico ? null : maximo - minimo;
    return { tiendas, unico, barata: tiendas[0], cara: tiendas[tiendas.length - 1], ahorro,
      ahorroPct: unico ? null : Math.round((1 - minimo / maximo) * 100),
      textoAhorro: unico ? "un solo comercio: no hay con qué comparar"
        : ahorro === 0 ? "mismo precio en todas las tiendas" : `${pesos(ahorro)} menos que en la más cara` };
  }

  /* La tabla (o la nota de "un solo comercio") de un precioPorTienda, la misma en la Comparativa y en las paginas
     estaticas. h = { esc, pesos, enlace(f, texto, etiqueta), titulo? }; `enlace` arma el <a> de cada pagina. */
  function tablaTiendasHtml(pt, h) {
    if (pt.unico) return `<p class="sub pt-nota">${h.esc(pt.textoAhorro)}.</p>`;
    const fila = t => `<tr><th scope="row">${h.esc(t.comercio)}</th><td class="num">${h.pesos(t.precio)}</td>`
      + `<td${t.f === pt.barata.f ? ' class="mejor"' : ""}>${h.esc(t.pctTexto)}</td>`
      + `<td>${h.esc(t.fecha || "sin fecha")}</td>`
      + `<td>${h.enlace(t.f, "Ver aviso", `Ver aviso de ${t.comercio}`)}</td></tr>`;
    const ahorro = pt.ahorro > 0 ? ` (${pt.ahorroPct}%)` : "";
    // el titulo ya esta escrito arriba como encabezado: aca es solo el nombre accesible de la tabla
    return `<div class="scroll"><table class="pt-tabla"${h.titulo ? ` aria-label="${h.esc("Precio por tienda: " + h.titulo)}"` : ""}>`
      + `<thead><tr><th scope="col">Tienda</th><th scope="col" class="num">Precio</th><th scope="col">Contra la más barata</th>`
      + `<th scope="col">Fecha del precio</th><th scope="col">Aviso</th></tr></thead>`
      + `<tbody>${pt.tiendas.map(fila).join("")}</tbody></table></div>`
      + `<p class="pt-ahorro"><b>${h.esc(pt.textoAhorro)}</b>${ahorro}.</p>`;
  }

  function analizarConsulta(q, ctx) {
    const { buscarTodo, colorDe, comercioDe, marcaDe, nivelMarca, pesos, otrasDe, fechaDe, referencia } = ctx;
  const crudo = buscarTodo(q);
  if (!crudo.length) return null;
  const nq = normalBusq(q);
  const toks = nq.split(/\s+/).filter(Boolean);
  const excl = { internacionales: 0, formato: 0, usados: 0, equipos: 0, similares: 0, accesorios: 0, tipo: 0, variante: 0, raros: 0, caros: 0, especificaciones: 0 };
  const meta = crudo.map(f => ({ f, n: normalBusq(f[0]), niv: nivelMarca(f[0]) }));

  // Las compras internacionales no compiten en la comparativa, pero siguen en la
  // lista de Buscar con su sello: son otra forma de comprar, no otro producto.
  const internacionales = [];
  const candidatas = meta.filter(m => {
    const motivo = motivoExclusion(m.n, nq, toks, m.f[8]);
    if (motivo) { excl[motivo]++; if (motivo === "internacionales") internacionales.push(m); return false; }
    return true;
  });
  // Comparacion justa (spec 017): al comparar desde una tarjeta, solo entran avisos con SUS especificaciones clave. Si la tarjeta
  // no dice las suficientes no se filtra (se compara como siempre) y se avisa; si quedan pocos, se dice en vez de mezclar familias.
  let espec = null, utiles = candidatas;
  if (referencia) {
    const Esp = especificaciones();
    if (Esp.mismas(referencia, referencia).aplica) {
      utiles = candidatas.filter(m => m.f[2] === referencia[2] || Esp.mismas(referencia, m.f).coincide);
      excl.especificaciones = candidatas.length - utiles.length;
      espec = { aplica: true, resumen: Esp.resumen(referencia), comparables: utiles.length, pocos: utiles.length < Esp.MIN_COMPARABLES };
    } else {
      espec = { aplica: false, resumen: "", comparables: candidatas.length, pocos: false };
    }
  }
  if (!utiles.length) return null;

  // Lo que cuesta menos del 45% de la mediana y no tiene marca reconocida casi
  // nunca es el mismo tipo de producto. Si quedan pocos, no filtro mas.
  // Tambien lo que cuesta mas de 3 veces la mediana: buscando "ddr4 16gb" entran
  // notebooks y PCs completas que mencionan esa memoria en el nombre.
  const med1 = mediana(utiles.map(m => m.f[1]));
  const muyBarato = m => m.niv === 0 && m.f[1] < med1 * 0.45;
  const muyCaro = m => m.f[1] > med1 * 3;
  const sinExtremos = utiles.filter(m => !muyBarato(m) && !muyCaro(m));
  const base = sinExtremos.length >= 3 ? sinExtremos : utiles;
  excl.raros = base === sinExtremos ? utiles.filter(muyBarato).length : 0;
  excl.caros = base === sinExtremos ? utiles.filter(muyCaro).length : 0;
  const med = mediana(base.map(m => m.f[1]));

  const piso = m => pisoDeGama(m.f[1], m.niv, med);
  const rec = [...base].sort((a, b) => (piso(a) - piso(b)) || (b.niv - a.niv) || (a.f[1] - b.f[1]));
  const porPrecio = [...base].sort((a, b) => a.f[1] - b.f[1]);
  const mejor = rec[0];
  const barato = porPrecio[0] === mejor ? null : porPrecio[0];
  const marcaMejor = marcaDe(mejor.f[0]);
  const alt = rec.find(m => {
    if (m === mejor || m === barato || m.f[1] > mejor.f[1] * 1.6) return false;
    const ma = marcaDe(m.f[0]);
    return ma && ma !== marcaMejor;
  }) || null;
  const baja = base
    .filter(m => m.f[6] > m.f[1] && m !== mejor && m !== barato && m !== alt)
    .sort((a, b) => (1 - b.f[1] / b.f[6]) - (1 - a.f[1] / a.f[6]))[0] || null;

  const bajoMed = m => Math.round((1 - m.f[1] / med) * 100);
  const textoMed = m => { const x = bajoMed(m);
    return x === 0 ? "justo en la mediana" : `${Math.abs(x)}% ${x > 0 ? "por debajo" : "por encima"} de la mediana`; };

  const picks = [];
  picks.push({ clave: "mejor", ico: "trofeo", m: mejor,
    rol: barato ? "Mejor compra" : "Mejor compra y más barata", rolCorto: "Mejor compra",
    razon: `${mejor.niv === 2 ? "La marca más confiable" : mejor.niv === 1 ? "La marca más conocida" : "La mejor ubicada"} entre las opciones, al menor precio dentro de ese nivel: ${textoMed(mejor)} (mediana ${pesos(med)}).`
      + (barato ? "" : " Además es la más barata de todas.") });
  if (barato) picks.push({ clave: "barato", ico: "flechaAbajo", m: barato, rol: "Más barata", rolCorto: "Más barata",
    razon: `La más barata de las comparables: ${pesos(mejor.f[1] - barato.f[1])} menos (${Math.round((1 - barato.f[1] / mejor.f[1]) * 100)}%) que la mejor compra.`
      + (barato.niv === 0 ? " No reconocemos la marca: mirá garantía y reseñas antes de pagar." : "")
      + (piso(barato) ? " Está muy por debajo de lo habitual: puede ser un modelo viejo o de entrada." : "") });
  if (alt) { const dp = Math.round((alt.f[1] / mejor.f[1] - 1) * 100);
    picks.push({ clave: "alt", ico: "balanza", m: alt, rol: "Alternativa de otra marca", rolCorto: "Otra marca",
      razon: `Otra marca (${marcaDe(alt.f[0])}) para no depender de una sola: ${Math.abs(dp)}% ${dp >= 0 ? "más cara" : "más barata"} que la mejor compra.` }); }
  if (baja) picks.push({ clave: "baja", ico: "fuego", m: baja, rol: "Bajó de precio", rolCorto: "Bajó de precio",
    razon: `Bajó ${Math.round((1 - baja.f[1] / baja.f[6]) * 100)}% contra su precio más bajo de los 30 días anteriores (${pesos(baja.f[6])}).` });

  // Si la busqueda tiene una sola marca no hay "otra marca" que contrastar. En
  // vez de dejar una tarjeta sola, muestro un escalon arriba y la gama alta.
  const en = new Set(picks.map(p => p.m));
  const pctSobre = m => Math.round((m.f[1] / mejor.f[1] - 1) * 100);
  if (picks.length < 3) {
    const escalon = rec.find(m => !en.has(m) && !piso(m) && m.niv >= 1 && m.f[1] >= mejor.f[1] * 1.3);
    if (escalon) { en.add(escalon); picks.push({ clave: "escalon", ico: "subir", m: escalon,
      rol: "Un escalón más arriba", rolCorto: "Un escalón arriba",
      razon: `${pctSobre(escalon)}% más cara que la mejor compra. Fijate qué trae de más en las especificaciones antes de pagar la diferencia.` }); }
  }
  if (picks.length < 3) {
    const alta = [...base].filter(m => !en.has(m) && m.niv === 2).sort((a, b) => b.f[1] - a.f[1])[0];
    if (alta && alta.f[1] > mejor.f[1] * 1.3) { en.add(alta); picks.push({ clave: "alta", ico: "subir", m: alta,
      rol: "Gama alta", rolCorto: "Gama alta",
      razon: `La más cara de primera línea: ${pctSobre(alta)}% sobre la mejor compra. Solo si necesitás esas prestaciones.` }); }
  }

  // Precio por tienda de cada opcion: solo con lo que esta consulta considera comparable (mismo filtro que arriba).
  const admite = f => !motivoExclusion(normalBusq(f[0]), nq, toks, f[8]);
  for (const p of picks) p.porTienda = precioPorTienda(p.m.f, otrasDe ? otrasDe(p.m.f) : [], { comercioDe, pesos, fechaDe, admite });

  // Ranking de comercios: cada comercio de ComparaYa cuenta por separado.
  const mapa = new Map();
  for (const m of base) {
    const nom = comercioDe(m.f);
    let c = mapa.get(nom);
    if (!c) mapa.set(nom, c = { nom, color: colorDe(m.f), items: [] });
    c.items.push(m);
  }
  const comercios = [...mapa.values()].map(c => {
    const primeras = c.items.filter(m => m.niv === 2);
    const mejorItem = [...(primeras.length ? primeras : c.items)].sort((a, b) => a.f[1] - b.f[1])[0];
    return { ...c, n: c.items.length, med: mediana(c.items.map(m => m.f[1])),
      conPrimera: primeras.length > 0, pctPrimera: primeras.length / c.items.length, mejorItem,
      bajas: c.items.filter(m => m.f[6] > m.f[1]).length };
  }).sort((a, b) => (b.conPrimera - a.conPrimera) || (a.mejorItem.f[1] - b.mejorItem.f[1]));

  return { q, total: crudo.length, base, med, picks, comercios, excl, internacionales, espec,
           primeras: base.filter(m => m.niv === 2) };
}

  /* Que quedo afuera de la comparativa, en palabras. Lo usan el cartel de la Comparativa
     y las paginas por busqueda: el mismo texto en los dos lados. */
  function partesExclusion(ex) {
    const n = (k, uno, varios) => ex[k] ? `${ex[k]} ${ex[k] > 1 ? varios : uno}` : null;
    return [
      n("internacionales", "compra internacional (envío desde el exterior)", "compras internacionales (envío desde el exterior)"),
      ex.formato ? `${ex.formato} de notebook` : null,
      ex.equipos ? `${ex.equipos} equipos completos (notebooks, PCs, combos)` : null,
      ex.similares ? `${ex.similares} que dicen «simil» y no son lo que buscás` : null,
      ex.accesorios ? `${ex.accesorios} accesorios (cables, adaptadores, soportes)` : null,
      ex.tipo ? `${ex.tipo} de otro tipo de producto` : null,
      n("variante", "de otra versión del chip (Ti, Super, XT)", "de otra versión del chip (Ti, Super, XT)"),
      ex.usados ? `${ex.usados} usados u outlet` : null,
      ex.especificaciones ? `${ex.especificaciones} con otras especificaciones (no son la misma configuración)` : null,
      ex.raros ? `${ex.raros} muy por debajo del resto y sin marca conocida` : null,
      ex.caros ? `${ex.caros} que cuestan más del triple (suelen ser equipos completos)` : null,
    ].filter(Boolean);
  }

  const api = { analizarConsulta, partesExclusion, precioPorTienda, tablaTiendasHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Analisis = api;
})(this);
