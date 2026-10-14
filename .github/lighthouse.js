#!/usr/bin/env node
/* Compara los informes JSON de Lighthouse contra los umbrales de CONSTRAINTS.md.

   Uso: node .github/lighthouse.js informe1.json [informe2.json ...]

   Las cuatro categorias cortan la CI si bajan de 90. Excepcion: el rendimiento de la portada avisa y no
   corta. La portada se arma entera con JS y en la CPU del runner su TBT ronda los 560 ms (77-79 puntos),
   aunque en una maquina comun da 99-100. Vuelve a cortar cuando se pre-renderice (ver CONSTRAINTS.md). */
"use strict";

const fs = require("fs");

const BLOQUEANTES = { performance: 90, accessibility: 90, "best-practices": 90, seo: 90 };
const AVISO = { performance: 90 };
const SOLO_AVISO_EN_PORTADA = ["performance"];
const esPortada = url => new URL(url).pathname === "/";

let fallas = 0;
for (const ruta of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const puntajes = Object.fromEntries(Object.values(r.categories).map(c => [c.id, Math.round(c.score * 100)]));
  console.log(`${r.finalDisplayedUrl}: ` + Object.entries(puntajes).map(([k, v]) => `${k}=${v}`).join(" "));
  // Las metricas y que elemento fue el LCP: sin esto, un rendimiento bajo en el runner no se puede diagnosticar.
  const a = r.audits;
  const lcp = (((a["largest-contentful-paint-element"] || {}).details || {}).items || [])[0];
  const nodo = lcp && lcp.items && lcp.items[0] && lcp.items[0].node;
  const fases = (((a["largest-contentful-paint-element"] || {}).details || {}).items || [])[1];
  console.log("  " + ["first-contentful-paint", "largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time"]
    .map(k => `${k}=${(a[k] || {}).displayValue}`).join(" ") +
    (nodo ? ` lcp-elemento=${nodo.snippet.slice(0, 80)}` : "") +
    (fases && fases.items ? " fases=" + fases.items.map(f => `${f.phase}:${Math.round(f.timing)}`).join(",") : ""));
  for (const s of (((a["layout-shifts"] || {}).details || {}).items || []))
    if (s.score > 0.01) console.log(`  salto ${s.score.toFixed(3)} en ${((s.node || {}).snippet || "").slice(0, 80)}`);
  for (const [cat, min] of Object.entries(BLOQUEANTES)) {
    if (esPortada(r.finalDisplayedUrl) && SOLO_AVISO_EN_PORTADA.includes(cat)) continue;
    if (puntajes[cat] < min) {
      fallas++;
      console.log(`::error::${r.finalDisplayedUrl}: ${cat} ${puntajes[cat]} < ${min}`);
      for (const a of r.categories[cat].auditRefs) {
        const x = r.audits[a.id];
        if (a.weight > 0 && x.score !== null && x.score < 1) console.log(`  - ${x.id}: ${x.title}`);
      }
    }
  }
  for (const [cat, min] of Object.entries(AVISO)) {
    if (esPortada(r.finalDisplayedUrl) && puntajes[cat] < min) console.log(`::warning::${r.finalDisplayedUrl}: ${cat} ${puntajes[cat]} < ${min}`);
  }
}
process.exitCode = fallas ? 1 : 0;
