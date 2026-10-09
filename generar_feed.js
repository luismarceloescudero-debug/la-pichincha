#!/usr/bin/env node
/* Feed RSS de ofertas (ofertas.xml) y la lista que lee el canal de Telegram (ofertas.json).

   Uso: node generar_feed.js --indice indice.json --salida _sitio [--base-url URL]

   Las ofertas son las de la pestaña Ofertas (js/ofertas.js): primero las bajas propias, despues las
   rebajas publicadas, cada grupo por descuento. El orden no depende de comisiones. */
"use strict";

const fs = require("fs");
const path = require("path");
const O = require("./js/ofertas.js");

const BASE_URL = "https://luismarceloescudero-debug.github.io/la-pichincha";
const MAX_FEED = 20;

const xml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");

/* "2026-10-09T08:12-03:00" -> "09/10 08:12"; si el indice solo trae la fecha, "09/10". */
const cuando = iso => {
  const m = String(iso).match(/^\d{4}-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  return m ? `${m[2]}/${m[1]}${m[3] ? " " + m[3] : ""}` : "";
};
const horaDe = iso => /T\d{2}:\d{2}/.test(String(iso)) ? " (hora de Argentina)" : "";

const comercioDe = (f, idx) => f[4] || (idx.tiendas[f[3]] || {}).nombre || f[3];

function renderFeed(idx, { baseUrl = BASE_URL, max = MAX_FEED } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const fecha = new Date(idx.generado);
  const rfc = isNaN(fecha) ? new Date().toUTCString() : fecha.toUTCString();
  const dia = String(idx.generado).slice(0, 10);
  const items = O.destacadas(idx, max).map(o => {
    const f = o.f, pct = Math.round(o.off * 100);
    const titulo = `${f[0]}: ${pesos(f[1])} (−${pct}%) en ${comercioDe(f, idx)}`;
    const desc = `Antes ${pesos(f[o.ref])}, hoy ${pesos(f[1])}: ahorrás ${pesos(o.ahorro)}. ` +
      `Precios del ${cuando(idx.generado)}${horaDe(idx.generado)}. Verificá en la tienda antes de comprar.`;
    return `    <item>
      <title>${xml(titulo)}</title>
      <link>${xml(f[2])}</link>
      <guid isPermaLink="false">${xml(f[2])}#${xml(dia)}</guid>
      <pubDate>${rfc}</pubDate>
      <description>${xml(desc)}</description>
    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>La Pichincha: ofertas de hardware</title>
    <link>${xml(base)}/</link>
    <atom:link href="${xml(base)}/ofertas.xml" rel="self" type="application/rss+xml"/>
    <description>Las bajas de precio y rebajas del dia en tiendas de hardware de Argentina.</description>
    <language>es-AR</language>
    <lastBuildDate>${rfc}</lastBuildDate>
${items.join("\n")}${items.length ? "\n" : ""}  </channel>
</rss>
`;
}

/* Lo justo para el canal: texto plano, sin nada de terceros sin escapar (lo escapa quien lo publica). */
function listaParaCanal(idx, max = 10) {
  return O.destacadas(idx, max).map(o => ({
    nombre: o.f[0], precio: o.f[1], antes: o.f[o.ref], descuento: Math.round(o.off * 100),
    comercio: comercioDe(o.f, idx), url: o.f[2], tipo: o.tipo }));
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const indicePath = arg("indice", path.join(__dirname, "indice.json"));
  const salida = arg("salida", path.join(__dirname, "_sitio"));
  const baseUrl = arg("base-url", BASE_URL);
  if (!fs.existsSync(indicePath)) { console.log("sin indice de precios: no se genera el feed"); return 0; }
  const idx = JSON.parse(fs.readFileSync(indicePath, "utf8"));
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, "ofertas.xml"), renderFeed(idx, { baseUrl }), "utf8");
  const lista = listaParaCanal(idx, 10);
  fs.writeFileSync(path.join(salida, "ofertas.json"),
    JSON.stringify({ generado: idx.generado, sitio: baseUrl.replace(/\/$/, "") + "/", ofertas: lista }), "utf8");
  console.log(`feed de ofertas: ${Math.min(O.destacadas(idx, MAX_FEED).length, MAX_FEED)} entradas`);
  return 0;
}

module.exports = { renderFeed, listaParaCanal, main, BASE_URL };
if (require.main === module) process.exit(main(process.argv.slice(2)));
