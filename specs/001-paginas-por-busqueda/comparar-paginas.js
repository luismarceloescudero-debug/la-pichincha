// T014 / SC-004: la pagina generada da lo mismo que la Comparativa. Lee el HTML (no el analisis)
// y lo compara con base-analisis.json, medido con el codigo real de index.html (T001).
// Uso: node specs/001-paginas-por-busqueda/comparar-paginas.js <indice-base.json>
const fs = require("fs");
const path = require("path");
const raiz = path.resolve(__dirname, "../..");
const G = require(raiz + "/generar_paginas.js");
const A = require(raiz + "/js/analisis.js");
const idx = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const datos = JSON.parse(fs.readFileSync(raiz + "/datos.json", "utf8"));
const base = JSON.parse(fs.readFileSync(__dirname + "/base-analisis.json", "utf8"));
const ctx = G.crearContexto(idx, { marcas: datos.marcas });
const plano = h => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
let ok = 0;
for (const [q, esperado] of Object.entries(base)) {
  const html = G.renderPagina({ q, slug: q }, A.analizarConsulta(q, ctx), ctx);
  const texto = plano(html);
  const mejor = esperado.picks[0];                              // [clave, url, precio]
  const checks = {
    mediana: texto.includes(G.pesos(esperado.mediana)),
    mejorCompra: html.split("<h2>Mejor compra</h2>")[1].split("</section>")[0].includes(`href="${mejor[1]}"`) &&
      html.split("<h2>Mejor compra</h2>")[1].split("</section>")[0].includes(G.pesos(mejor[2])),
    comparables: texto.includes(`Comparamos ${esperado.comparables} opciones`),
    comercios: texto.includes(` en ${esperado.comercios.length} comercio`),
  };
  const bien = Object.values(checks).every(Boolean);
  if (bien) ok++;
  console.log((bien ? "ok " : "MAL") + " " + q.padEnd(18), bien ? "" : JSON.stringify(checks));
}
console.log(`${ok}/${Object.keys(base).length} consultas coinciden`);
process.exit(ok === Object.keys(base).length ? 0 : 1);
