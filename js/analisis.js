/* Analisis de una consulta: que avisos son comparables, la mejor compra, el ranking de
   comercios y que quedo afuera. Es la misma logica para la Comparativa interactiva
   (index.html) y para las paginas estaticas por busqueda (generar_paginas.js): por eso
   vive en un modulo puro, sin DOM, y recibe lo que depende de la pagina en `ctx`.
   ctx = { buscarTodo(q), comercioDe(f), colorDe(f), marcaDe(nombre), nivelMarca(nombre), pesos(n) } */
(function (raiz) {
  "use strict";

  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;
  const { mediana, motivoExclusion, normalBusq, pisoDeGama } = B;

  function analizarConsulta(q, ctx) {
    const { buscarTodo, colorDe, comercioDe, marcaDe, nivelMarca, pesos } = ctx;
  const crudo = buscarTodo(q);
  if (!crudo.length) return null;
  const nq = normalBusq(q);
  const toks = nq.split(/\s+/).filter(Boolean);
  const excl = { internacionales: 0, formato: 0, usados: 0, equipos: 0, similares: 0, accesorios: 0, tipo: 0, raros: 0, caros: 0 };
  const meta = crudo.map(f => ({ f, n: normalBusq(f[0]), niv: nivelMarca(f[0]) }));

  // Las compras internacionales no compiten en la comparativa, pero siguen en la
  // lista de Buscar con su sello: son otra forma de comprar, no otro producto.
  const internacionales = [];
  const utiles = meta.filter(m => {
    const motivo = motivoExclusion(m.n, nq, toks, m.f[8]);
    if (motivo) { excl[motivo]++; if (motivo === "internacionales") internacionales.push(m); return false; }
    return true;
  });
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
    razon: `Bajó ${Math.round((1 - baja.f[1] / baja.f[6]) * 100)}% desde el relevamiento anterior: antes ${pesos(baja.f[6])}.` });

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

  return { q, total: crudo.length, base, med, picks, comercios, excl, internacionales,
           primeras: base.filter(m => m.niv === 2) };
}

  const api = { analizarConsulta };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Analisis = api;
})(this);
