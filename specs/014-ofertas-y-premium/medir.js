/* Mide los modos de busqueda y el puntaje premium sobre un indice publicado (spec 014).
   Uso: node specs/014-ofertas-y-premium/medir.js <indice.json> [distribucion|busquedas|ofertas]
   (curl -o indice.json https://pichinchadeldia.com.ar/indice.json). Solo lee; no escribe nada. */
const fs = require("node:fs"), path = require("node:path");
const raiz = path.join(__dirname, "../..");
const B = require(raiz + "/js/buscador.js"), C = require(raiz + "/js/categorias.js"), P = require(raiz + "/js/premium.js"), M = require(raiz + "/js/modos.js");
const idx = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const que = process.argv[3] || "todo";
const datos = JSON.parse(fs.readFileSync(raiz + "/datos.json", "utf8"));
const nivel = B.crearNivelMarca(datos.marcas);
const ref = C.referencia(idx.productos);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : "0.0") + "%";

if (que === "todo" || que === "distribucion") {
  const t = {};
  for (const f of idx.productos) {
    if (B.esUsado(f)) continue;
    const g = C.evaluar(f[0], ref), p = P.puntaje(f[0], ref, g), o = (t[g.categoria] = t[g.categoria] || { avisos: 0, pasa: 0, premium: 0, puntos: {} });
    o.avisos++; if (g.pasa) o.pasa++; if (p.premium) o.premium++;
    o.puntos[p.puntos] = (o.puntos[p.puntos] || 0) + 1;
  }
  console.log("| categoria | avisos | pasan el minimo | premium | % premium | umbral |\n| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const c of C.ORDEN) if (t[c]) console.log(`| ${c} | ${t[c].avisos} | ${t[c].pasa} | ${t[c].premium} | ${pct(t[c].premium, t[c].avisos)} | ${P.UMBRAL[c] || "-"} |`);
}

if (que === "todo" || que === "busquedas") {
  const consultas = ["notebook", "celular samsung", "ssd 1tb", "monitor 27", "auriculares", "rtx 5060", "ryzen 5"];
  const ctx = M.preparar(idx, nivel);
  console.log("\n| consulta | conjunto | " + M.MODOS.map(m => m.eti).join(" | ") + " |\n| --- | ---: | " + M.MODOS.map(() => "---:").join(" | ") + " |");
  for (const q of consultas) {
    const coincide = B.filtroDe(q);
    const halla = idx.productos.filter(f => coincide(B.normalBusq(f[0])) && !B.motivoExclusion(B.normalBusq(f[0]), B.normalBusq(q), [], f[8]));
    const g = B.agruparPorModelo(B.unaPorUrl(halla), x => x[4] || x[3]);
    const med = B.mediana(g.filas.map(f => f[1]));
    const c = M.contar(g.filas, ctx, med);
    console.log(`| ${q} | ${g.filas.length} | ${M.MODOS.map(m => c[m.id]).join(" | ")} |`);
  }
}

if (que === "todo" || que === "ofertas") {
  const O = require(raiz + "/js/ofertas.js"), r = O.calcularOfertas(idx);
  const por = filas => { const c = {}; for (const f of filas) { const k = r.gama.get(f).categoria; c[k] = (c[k] || 0) + 1; } return c; };
  const union = new Set([...r.propias, ...r.publicadas, ...r.contraModelo.keys(), ...r.cruceGen.keys()]);
  const senales = { "baja propia": r.propias, "rebaja publicada": r.publicadas, "contra el mismo modelo": [...r.contraModelo.keys()], "gama alta del año pasado": [...r.cruceGen.keys()], "union (Super Oferta)": [...union] };
  console.log("\n| señal | avisos | " + C.ORDEN.join(" | ") + " |\n| --- | ---: | " + C.ORDEN.map(() => "---:").join(" | ") + " |");
  for (const [k, l] of Object.entries(senales)) { const c = por(l); console.log(`| ${k} | ${l.length} | ${C.ORDEN.map(x => c[x] || 0).join(" | ")} |`); }
  // modelos presentes en >=3 tiendas por categoria (sin ComparaYa, internacionales ni usados)
  const tiendas = new Map();
  for (const f of idx.productos) {
    if (!f[9] || f[3] === "comparaya" || B.esUsado(f) || (typeof f[8] === "string" && f[8].includes("i"))) continue;
    (tiendas.get(f[9]) || tiendas.set(f[9], { cat: C.categoriaDe(f[0]), t: new Set() }).get(f[9])).t.add(f[3]);
  }
  const cat3 = {}; let total3 = 0;
  for (const m of tiendas.values()) if (m.t.size >= 3) { cat3[m.cat] = (cat3[m.cat] || 0) + 1; total3++; }
  console.log(`\nModelos en >=3 tiendas: ${total3}`, JSON.stringify(cat3));
}
