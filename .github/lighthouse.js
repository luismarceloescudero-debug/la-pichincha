#!/usr/bin/env node
/* Compara los informes JSON de Lighthouse contra los umbrales de CONSTRAINTS.md.

   Uso: node .github/lighthouse.js informe1.json [informe2.json ...]

   Las cuatro categorias cortan la CI si bajan de 90, en todas las paginas. La portada tambien: desde que
   el build la pre-renderiza (generar_portada.js) ya no la arma el JS al abrir (ver CONSTRAINTS.md).

   Con varias corridas de una misma pagina se evalua la mediana por rendimiento (la de abajo si son pares),
   como recomienda Lighthouse: la primera corrida del job sale con Chrome en frio y en el runner su primer
   pintado llego a tardar 1,2 s mas que en las siguientes. */
"use strict";

const fs = require("fs");

const BLOQUEANTES = { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 };

const puntajesDe = r => Object.fromEntries(Object.values(r.categories).map(c => [c.id, Math.round(c.score * 100)]));

const porPagina = new Map();
for (const ruta of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(ruta, "utf8"));
  if (!porPagina.has(r.finalDisplayedUrl)) porPagina.set(r.finalDisplayedUrl, []);
  porPagina.get(r.finalDisplayedUrl).push(r);
}

let fallas = 0;
for (const corridas of porPagina.values()) {
  const rend = r => (r.categories.performance || {}).score || 0;
  const orden = [...corridas].sort((x, y) => rend(x) - rend(y));
  const r = orden[Math.floor((orden.length - 1) / 2)];
  const puntajes = puntajesDe(r);
  console.log(`${r.finalDisplayedUrl}: ` + Object.entries(puntajes).map(([k, v]) => `${k}=${v}`).join(" "));
  if (corridas.length > 1)
    console.log(`  mediana de ${corridas.length} corridas (performance ${orden.map(x => puntajesDe(x).performance).join(", ")})`);
  // Las metricas y que elemento fue el LCP: sin esto, un rendimiento bajo en el runner no se puede diagnosticar.
  const a = r.audits;
  const lcp = (((a["largest-contentful-paint-element"] || {}).details || {}).items || [])[0];
  const nodo = lcp && lcp.items && lcp.items[0] && lcp.items[0].node;
  const fases = (((a["largest-contentful-paint-element"] || {}).details || {}).items || [])[1];
  console.log("  " + ["first-contentful-paint", "largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time"]
    .map(k => `${k}=${(a[k] || {}).displayValue}`).join(" ") +
    (nodo ? ` lcp-elemento=${nodo.snippet.slice(0, 80)}` : "") +
    (fases && fases.items ? " fases=" + fases.items.map(f => `${f.phase}:${Math.round(f.timing)}`).join(",") : ""));
  // Con TBT, las tareas largas observadas (sin simular) y de que son: en el runner cambian de corrida a corrida.
  if (((a["total-blocking-time"] || {}).numericValue || 0) > 0)
    for (const t of (((a["long-tasks"] || {}).details || {}).items || []))
      console.log(`  tarea larga ${Math.round(t.duration)} ms a los ${Math.round(t.startTime)} ms: ${t.url}`);
  for (const s of (((a["layout-shifts"] || {}).details || {}).items || []))
    if (s.score > 0.01) console.log(`  salto ${s.score.toFixed(3)} en ${((s.node || {}).snippet || "").slice(0, 80)}`);
  for (const [cat, min] of Object.entries(BLOQUEANTES)) {
    if (puntajes[cat] < min) {
      fallas++;
      console.log(`::error::${r.finalDisplayedUrl}: ${cat} ${puntajes[cat]} < ${min}`);
      for (const a of r.categories[cat].auditRefs) {
        const x = r.audits[a.id];
        if (a.weight > 0 && x.score !== null && x.score < 1) console.log(`  - ${x.id}: ${x.title}`);
      }
    }
  }
}
process.exitCode = fallas ? 1 : 0;
