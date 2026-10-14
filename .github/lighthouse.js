#!/usr/bin/env node
/* Compara los informes JSON de Lighthouse contra los umbrales de CONSTRAINTS.md.

   Uso: node .github/lighthouse.js informe1.json [informe2.json ...]

   Accesibilidad, buenas practicas y SEO cortan la CI si bajan de 90. Rendimiento se informa como aviso
   hasta que el indice este partido por rubro (A3): en el runner varia de una corrida a otra. */
"use strict";

const fs = require("fs");

const BLOQUEANTES = { accessibility: 90, "best-practices": 90, seo: 90 };
const AVISO = { performance: 90 };

let fallas = 0;
for (const ruta of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const puntajes = Object.fromEntries(Object.values(r.categories).map(c => [c.id, Math.round(c.score * 100)]));
  console.log(`${r.finalDisplayedUrl}: ` + Object.entries(puntajes).map(([k, v]) => `${k}=${v}`).join(" "));
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
  for (const [cat, min] of Object.entries(AVISO)) {
    if (puntajes[cat] < min) console.log(`::warning::${r.finalDisplayedUrl}: ${cat} ${puntajes[cat]} < ${min}`);
  }
}
process.exitCode = fallas ? 1 : 0;
