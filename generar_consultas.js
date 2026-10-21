#!/usr/bin/env node
/* Descubre las paginas por busqueda a partir del indice, sin lista a mano.

   Uso: node generar_consultas.js --indice indice.json [--datos datos.json] [--tope 150]
   Escribe en stdout un JSON [{q, nota}], el mismo formato que consultas.json.

   La consulta de cada pagina es la que arma «Comparar» con una oferta real (Buscador.consultaDeOferta):
   asi la pagina y el boton dicen siempre lo mismo. Entran las que tienen suficientes opciones
   comparables en varios comercios, de mas a menos. Lo curado a mano en consultas.json va primero
   y no se pisa (generar_paginas.py las une). Sin dependencias: solo Node. */
"use strict";

const fs = require("fs");
const path = require("path");
const B = require("./js/buscador.js");
const A = require("./js/analisis.js");
const G = require("./generar_paginas.js");

const MIN_COMPARABLES = 8, MIN_COMERCIOS = 2, TOPE = 150, A_EVALUAR = 600;

/* Solo los rubros donde «Comparar» conoce las especificaciones que definen la compra. */
const RUBROS = [
  [/^(placa|tarjeta) de video\b/, "Placas de video"], [/^procesador\b/, "Procesadores"],
  [/^(notebook|laptop)\b/, "Notebooks y tablets"], [/^monitor\b/, "Monitores"],
  [/^(memoria|ram)\b/, "Memorias"], [/^ssd\b|^disco solido\b/, "Almacenamiento"],
];
const rubroDe = nombre => { const n = B.normal(String(nombre)); const r = RUBROS.find(([re]) => re.test(n)); return r ? r[1] : null; };

/* El mismo slug que generar_paginas.py: dos consultas con la misma URL son una sola pagina. */
const slug = q => B.normal(q).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function contexto(idx, { marcas = {}, ahora = new Date() } = {}) {
  const ctx = G.crearContexto(idx, { ahora, marcas });
  ctx.nombres = idx.productos.map(f => B.normalBusq(f[0]));
  return ctx;
}

/* Los avisos que una consulta compara, como clave: dos consultas con la misma clave son la misma pagina. */
const claveDe = a => a.base.map(m => m.f[2]).sort().join("|");

function descubrir(ctx, { tope = TOPE, minComparables = MIN_COMPARABLES, minComercios = MIN_COMERCIOS, excluir = [] } = {}) {
  const { idx, nombres } = ctx;
  const cuentas = new Map();                                   // consulta -> cuantas ofertas la piden
  const hay = (() => {
    const memo = new Map();
    return q => {
      if (!memo.has(q)) { const fl = B.filtroDe(q); memo.set(q, !!fl && nombres.some(n => fl(n))); }
      return memo.get(q);
    };
  })();
  idx.productos.forEach(f => {
    const grupo = rubroDe(f[0]);
    if (!grupo) return;
    const q = B.consultaDeOferta(String(f[0]), hay).trim().toLowerCase();
    if (q.length < 2 || q.length > 60 || !q.includes(" ")) return;     // una palabra sola (monitor, notebook) no dice nada
    const c = cuentas.get(q) || { q, grupo, n: 0 };
    c.n++;
    cuentas.set(q, c);
  });
  const fecha = (idx.generado || "").slice(5, 10).split("-").reverse().map(Number).join("/");
  const salida = [], vistas = new Set(excluir.map(m => { const a = A.analizarConsulta(m.q, ctx); return a ? claveDe(a) : null; }).filter(Boolean));
  for (const c of [...cuentas.values()].sort((a, b) => b.n - a.n).slice(0, A_EVALUAR)) {
    const a = A.analizarConsulta(c.q, ctx);
    if (!a || a.base.length < minComparables || a.comercios.length < minComercios) continue;
    const clave = claveDe(a);
    if (vistas.has(clave)) continue;                           // otra consulta ya publica exactamente estos avisos
    vistas.add(clave);
    salida.push({ q: c.q, nota: `${c.grupo}: ${a.total} avisos, ${a.base.length} comparables en ${a.comercios.length} comercios (${fecha})`,
      comparables: a.base.length });
  }
  return salida.sort((a, b) => b.comparables - a.comparables).slice(0, tope).map(({ q, nota }) => ({ q, nota }));
}

/* Las curadas a mano primero y sin tocar; las automaticas solo si su URL no esta ya. */
function unir(manuales, autos) {
  const vistos = new Set(manuales.map(m => slug(m.q)));
  return [...manuales, ...autos.filter(a => { const s = slug(a.q); if (!s || vistos.has(s)) return false; vistos.add(s); return true; })];
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const indice = arg("indice", path.join(__dirname, "indice.json"));
  if (!fs.existsSync(indice)) { console.log("[]"); return 0; }
  const datos = JSON.parse(fs.readFileSync(arg("datos", path.join(__dirname, "datos.json")), "utf8"));
  const manualesPath = arg("manuales", path.join(__dirname, "consultas.json"));
  const manuales = fs.existsSync(manualesPath) ? JSON.parse(fs.readFileSync(manualesPath, "utf8")) : [];
  const ctx = contexto(JSON.parse(fs.readFileSync(indice, "utf8")), { marcas: datos.marcas || {} });
  console.log(JSON.stringify(descubrir(ctx, { tope: +arg("tope", TOPE), excluir: manuales })));
  return 0;
}

module.exports = { contexto, descubrir, unir, rubroDe, slug };
if (require.main === module) process.exit(main(process.argv.slice(2)));
