#!/usr/bin/env node
/* Feed RSS de ofertas (ofertas.xml) y la lista que lee el canal de Telegram (ofertas.json).

   Uso: node generar_feed.js --indice indice.json --salida _sitio [--base-url URL] [--descartadas descartadas.json]
   (--descartadas: los enlaces que verificar_ofertas.py encontro caidos; no entran a ninguno de los archivos)
   --candidatas archivo [--max N]: escribe solo las N mejores ofertas para verificarlas y no genera el sitio

   Las ofertas son las de la pestaña Ofertas (js/ofertas.js): primero las bajas propias, despues las
   rebajas publicadas, cada grupo por descuento. El orden no depende de comisiones. */
"use strict";

const fs = require("fs");
const path = require("path");
const O = require("./js/ofertas.js");
const C = require("./js/categorias.js");
const P = require("./js/pagina.js");
const T = require("./js/titulo.js");
const G = require("./generar_paginas.js");

const SITIO = require("./sitio.json");
const BASE_URL = SITIO.base_url;
const MAX_FEED = 20;
const MAX_HOY = 10, EN_TARJETA = 5;
const CANAL_TELEGRAM = SITIO.canal_telegram;

const xml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");

/* "2026-10-09T08:12-03:00" -> "09/10 08:12"; si el indice solo trae la fecha, "09/10". */
const cuando = iso => {
  const m = String(iso).match(/^\d{4}-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/);
  return m ? `${m[2]}/${m[1]}${m[3] ? " " + m[3] : ""}` : "";
};
const horaDe = iso => /T\d{2}:\d{2}/.test(String(iso)) ? " (hora de Argentina)" : "";

const comercioDe = (f, idx) => f[4] || (idx.tiendas[f[3]] || {}).nombre || f[3];

/* Una compra internacional no se esconde pero se rotula: puede pagar impuestos al llegar. */
const comercioDeOferta = (o, idx) => comercioDe(o.f, idx) + (o.internacional ? " · compra internacional" : "");

/* El indice sin las publicaciones que verificar_ofertas.py encontro caidas (por su enlace). Sin lista, el mismo indice. */
function sinCaidas(idx, descartadas) {
  if (!Array.isArray(descartadas) || !descartadas.length) return idx;
  const caidas = new Set(descartadas);
  return { ...idx, productos: idx.productos.filter(f => !caidas.has(f[2])) };
}

function renderFeed(idx, { baseUrl = BASE_URL, max = MAX_FEED } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const fecha = new Date(idx.generado);
  const rfc = isNaN(fecha) ? new Date().toUTCString() : fecha.toUTCString();
  const dia = String(idx.generado).slice(0, 10);
  const items = O.destacadas(idx, max).map(o => {
    const f = o.f, pct = Math.round(o.off * 100);
    const titulo = `${T.linea(f[0], { emoji: false })}: ${pesos(f[1])} (−${pct}%) en ${comercioDeOferta(o, idx)}`;
    const desc = `${T.de(f[0]).completo}. ${C.ETIQUETA[o.categoria]}. ` + (o.modelo ? `Hoy ${pesos(f[1])}: ${O.textoContraModelo(o.modelo, pesos)}. `
      : o.tipo === "seguimiento" ? `Lo seguimos hace pocos días: pasó de ${pesos(o.antes)} a ${pesos(f[1])} (ahorrás ${pesos(o.ahorro)}); todavía no tiene una semana de historial. `
      : `Antes ${pesos(o.antes)}, hoy ${pesos(f[1])}: ahorrás ${pesos(o.ahorro)}. `) +
      (o.cruce ? `Gama alta al precio de la gama media (${O.textoContra(o.contra, pesos)}). ` : "") +
      (o.nota ? o.nota[0].toUpperCase() + o.nota.slice(1) + ". " : "") +
      (P.enlaceTienda(f[2]).afiliado ? "Enlace de afiliado. " : "") +
      `Precios del ${cuando(idx.generado)}${horaDe(idx.generado)}. Verificá en la tienda antes de comprar.`;
    return `    <item>
      <title>${xml(titulo)}</title>
      <link>${xml(P.enlaceTienda(f[2]).url)}</link>
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

/* /hoy/: la pagina para historias de Instagram y para el link de la bio. Arriba, una tarjeta 9:16 con
   las mejores del dia para sacarle captura (en Instagram el texto de una imagen no es un enlace); abajo,
   todas con su enlace a la tienda, que es lo que abre el sticker de link. Mismas ofertas que el feed. */
function renderHoy(idx, { baseUrl = BASE_URL, max = MAX_HOY } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const esc = G.esc;
  const fecha = P.fechaHora(idx.generado);
  const dia = fecha.split(" ")[0];
  const ofertas = O.destacadas(idx, max);
  const linea = o => `${esc(G.pesos(o.f[1]))} · ${esc(comercioDeOferta(o, idx))}`;
  const enTarjeta = ofertas.slice(0, EN_TARJETA);
  const mejorOff = Math.max(...enTarjeta.map(o => o.off));
  let marcada = false;   // solo una: la primera con el mayor descuento
  const tarjeta = enTarjeta.map(o => `      <li${!marcada && o.off === mejorOff && (marcada = true) ? ' class="h-top"' : ""}><span class="h-pct">−${Math.round(o.off * 100)}%</span>` +
    `<span class="h-nom">${T.html(o.f[0], esc)}</span><span class="h-pre">${linea(o)}</span></li>`).join("\n");
  // Los enlaces de afiliado (P.enlaceTienda) llevan su rotulo y rel="sponsored"; el orden no cambia (principio II).
  const enlace = o => { const e = P.enlaceTienda(o.f[2]);
    return `<a class="oferta" data-rubro="ofertas" href="${esc(e.url)}" rel="${e.afiliado ? "sponsored noopener" : "noopener"}">${T.html(o.f[0], esc)}</a>` +
      (e.afiliado ? ' <span class="rotulo">enlace de afiliado</span>' : ""); };
  const lista = ofertas.map(o => `    <li>${enlace(o)}` +
    (o.modelo ? `<span class="det"><b>${esc(G.pesos(o.f[1]))}</b> en ${esc(comercioDeOferta(o, idx))}: ${esc(O.textoContraModelo(o.modelo, G.pesos))}</span>`
      : o.tipo === "seguimiento" ? `<span class="det"><b>${esc(G.pesos(o.f[1]))}</b> en ${esc(comercioDeOferta(o, idx))}: −${Math.round(o.off * 100)}% desde que lo seguimos, hace pocos días</span>`
      : `<span class="det"><b>${esc(G.pesos(o.f[1]))}</b> <s>${esc(G.pesos(o.antes))}</s> −${Math.round(o.off * 100)}% en ${esc(comercioDeOferta(o, idx))}</span>`) + `</li>`).join("\n");
  const titulo = `Pichinchas del día · ${dia} | La Pichincha`;
  const descripcion = ofertas.length
    ? `Las ${ofertas.length} mejores bajas de precio de hardware en Argentina, con precios del ${fecha}.`
    : "Las mejores bajas de precio de hardware en Argentina, todos los días.";
  return G.cabeza({ titulo, descripcion, canonica: `${base}/hoy/`, baseUrl: base, rel: "../" }) + `
<style>
.hoy .historia{width:min(100%,420px);aspect-ratio:9/16;margin:6px auto 24px;padding:26px 22px;border-radius:22px;
  background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:14px;overflow:hidden}
.hoy .h-cab{display:flex;justify-content:space-between;font:600 .8rem var(--font-mono);color:var(--accent)}
.hoy .historia h1{font-size:2.3rem;line-height:1.02;margin:4px 0 2px;letter-spacing:-.02em}
.hoy .h-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;flex:1}
.hoy .h-lista li{display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:2px;align-items:start}
.hoy .h-pct{grid-row:span 2;font:700 1.05rem var(--font-mono);color:var(--good);background:var(--good-soft);border-radius:10px;padding:6px 8px}
.hoy .h-nom{font-size:.9rem;line-height:1.25;min-width:0}
.hoy .h-pre{font:500 .8rem var(--font-mono);color:var(--ink-2)}
/* Jerarquia (spec 055): la de mayor descuento es un bloque de color solido con el porcentaje grande; el resto queda chico. */
.hoy .h-lista li.h-top{background:#0f5132;color:#fff;border-radius:14px;padding:8px 12px;margin:0 -4px}
.hoy .h-top .h-pct{font-size:1.5rem;letter-spacing:-.05em;color:#0f5132;background:#fff;padding:6px 10px}
.hoy .h-top .h-nom,.hoy .h-top .tit-nom{color:#fff}
.hoy .h-top .tit-ico{color:#fff}
.hoy .h-top .tit-chip{background:rgba(255,255,255,.16);color:#fff}
.hoy .h-top .h-pre{font-size:.8rem;font-weight:700;color:#fff}
.hoy .h-top .h-pre s,.hoy .h-top .h-pre *{color:rgba(255,255,255,.82)}
.hoy .h-pie{margin:0;font-size:.78rem;color:var(--ink-3);overflow-wrap:anywhere}
.hoy .h-pie b{color:var(--ink)}
.hoy ol.todas{padding-left:1.2em}
.hoy ol.todas li{margin:0 0 12px}
.hoy .det{display:block;font:500 .82rem var(--font-mono);color:var(--ink-2)}
.hoy .det s{color:var(--ink-3)}
.hoy .rotulo{font:500 .74rem var(--font-mono);color:var(--ink-3)}
</style>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap hoy">
  <section class="historia" aria-label="Tarjeta con las mejores ofertas de hoy">
    <div class="h-cab"><span>La Pichincha</span><span>${esc(dia)}</span></div>
    <h1>Pichinchas<br>del día</h1>
    <ol class="h-lista">
${tarjeta}
    </ol>
    <p class="h-pie">Todas con su link en<br><b>${esc(base.replace(/^https?:\/\//, ""))}/hoy</b></p>
  </section>
  <p class="meta">La Pichincha · precios del ${esc(fecha)}</p>
  <h2>Todas las ofertas de hoy</h2>
${ofertas.length ? `  <ol class="todas">\n${lista}\n  </ol>` : `  <p class="sub">Hoy no hay bajas para destacar. Volvé mañana o buscá lo que necesitás en el comparador.</p>`}
  <p><a class="acc" href="../">Buscar y comparar en La Pichincha</a> · <a href="${CANAL_TELEGRAM}" rel="noopener">Canal de Telegram</a></p>
  <p class="nota">Precios con IVA y sin envío. Cambian rápido: verificá en la tienda antes de comprar. El orden no depende de comisiones. <a href="../estado/">Estado de las fuentes</a> · <a href="../legal/">Términos y privacidad</a> · <a href="../contacto/">Contacto</a>.</p>
</main>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

/* Lo justo para el canal: texto plano, sin nada de terceros sin escapar (lo escapa quien lo publica). */
function listaParaCanal(idx, max = 10) {
  return O.destacadas(idx, max).map(o => ({
    // titulo, chips y tipo (spec 044): el nombre legible que muestran el canal y la imagen; `nombre` sigue siendo el de la tienda
    nombre: o.f[0], ...(({ titulo, chips, tipo, emoji }) => ({ titulo, chips, icono: tipo, emoji }))(T.de(o.f[0])), precio: o.f[1], antes: Math.round(o.antes), descuento: Math.round(o.off * 100),
    ...(o.modelo ? { contra: `bajo la mediana de otras ${o.modelo.tiendas} tiendas` }
      : o.tipo === "seguimiento" ? { contra: "desde que lo seguimos, hace pocos días" } : {}),
    comercio: comercioDeOferta(o, idx), url: o.f[2], tipo: o.tipo, categoria: C.ETIQUETA[o.categoria],
    tienda: o.f[3],
    ...(o.f[9] ? { modelo: o.f[9] } : {}),      // para que la guardia reconozca el mismo modelo en lo que se publica
    // `url` queda como esta en el indice (verificar_ofertas.py la busca por ese valor); el canal abre `enlace`, con el afiliado.
    ...(P.enlaceTienda(o.f[2]).afiliado ? { enlace: P.enlaceTienda(o.f[2]).url, afiliado: true } : {}) }));   // la fuente del indice: verificar_ofertas.py la verifica a su manera
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const indicePath = arg("indice", path.join(__dirname, "indice.json"));
  const salida = arg("salida", path.join(__dirname, "_sitio"));
  const baseUrl = arg("base-url", BASE_URL);
  if (!fs.existsSync(indicePath)) { console.log("sin indice de precios: no se genera el feed"); return 0; }
  let descartadas = [];
  try { descartadas = JSON.parse(fs.readFileSync(arg("descartadas", ""), "utf8")); } catch (e) { /* sin lista o rota: se publica todo */ }
  const idx = sinCaidas(JSON.parse(fs.readFileSync(indicePath, "utf8")), descartadas);
  // --candidatas archivo [--max N]: solo escribe las N mejores ofertas (por defecto 40) para que verificar_ofertas.py las revise
  // antes de armar el sitio; no toca nada mas.
  const candidatas = arg("candidatas", "");
  if (candidatas) {
    const n = parseInt(arg("max", "40"), 10) || 40;
    fs.writeFileSync(candidatas, JSON.stringify({ ofertas: O.destacadas(idx, n).map(o => ({ url: o.f[2], nombre: o.f[0], precio: o.f[1], tienda: o.f[3] })) }), "utf8");
    console.log(`candidatas a verificar: ${Math.min(O.destacadas(idx, n).length, n)}`);
    return 0;
  }
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, "ofertas.xml"), renderFeed(idx, { baseUrl }), "utf8");
  const lista = listaParaCanal(idx, 10);
  fs.writeFileSync(path.join(salida, "ofertas.json"),
    JSON.stringify({ generado: idx.generado, sitio: baseUrl.replace(/\/$/, "") + "/", ofertas: lista }), "utf8");
  fs.mkdirSync(path.join(salida, "hoy"), { recursive: true });
  fs.writeFileSync(path.join(salida, "hoy", "index.html"), renderHoy(idx, { baseUrl }), "utf8");
  console.log(`feed de ofertas: ${Math.min(O.destacadas(idx, MAX_FEED).length, MAX_FEED)} entradas`);
  return 0;
}

module.exports = { sinCaidas, renderFeed, renderHoy, listaParaCanal, main, BASE_URL };
if (require.main === module) process.exit(main(process.argv.slice(2)));
