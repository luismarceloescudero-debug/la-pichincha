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

/* La super oferta (spec 059, como en el Reel v4): la de mayor descuento, la primera si empatan. Con 20 % o mas se
   llama «Súper oferta» (el piso de los heroes de la pestaña Ofertas, spec 055); un dia flojo es «La mejor del día». */
const PISO_SUPER = 20;
const mejorDe = ofertas => ofertas.reduce((m, o, i) => (m < 0 || o.off > ofertas[m].off ? i : m), -1);

/* El nombre en el lenguaje del Reel: el tipo adelante si el titulo tiene pocas palabras (rosa), la marca (celeste) y el
   modelo; el nombre completo de la tienda queda en el title. */
function nombreReel(nombre, esc) {
  const t = T.de(nombre), corte = t.titulo.indexOf(" ");
  const marca = corte < 0 ? t.titulo : t.titulo.slice(0, corte), resto = corte < 0 ? "" : t.titulo.slice(corte);
  return `<span class="h-nom" title="${esc(t.completo)}">${t.prefijo ? `<span class="h-tipo">${esc(t.prefijo)}</span> ` : ""}` +
    `<span class="h-marca">${esc(marca)}</span>${esc(resto)}</span>`;
}

/* Las chips: cada una en su pastilla; las premium con ✦ y el degradado rosa-celeste. */
const chipsReel = (nombre, esc) => {
  const chips = T.de(nombre).chips;
  return chips.length ? `<span class="h-chips">${chips.map(c => T.premium(c)
    ? `<span class="h-chip pr"><span aria-hidden="true">✦ </span>${esc(c)}</span>` : `<span class="h-chip">${esc(c)}</span>`).join("")}</span>` : "";
};

/* «−52 %» con cada parte en su color: el signo rosa, el numero amarillo y el % celeste. Sin rebaja no se inventa un −0 %. */
const pctReel = (o, clase) => o.off > 0
  ? `<span class="${clase}"><span class="sig">−</span><span class="num">${Math.round(o.off * 100)}</span><span class="por">%</span></span>` : "";

/* /hoy/: la pagina del link de la bio y de la vista previa de Telegram. Arriba, el cartel del dia con el lenguaje del
   Reel v4 (spec 059): la super oferta en grande y las siguientes en tarjetas; abajo, todas con su enlace a la tienda.
   Mismas ofertas que el feed. */
function renderHoy(idx, { baseUrl = BASE_URL, max = MAX_HOY } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const esc = G.esc;
  const fecha = P.fechaHora(idx.generado);
  const dia = fecha.split(" ")[0];
  const ofertas = O.destacadas(idx, max);
  // La super oferta es la mejor de todas las de hoy (como en el Reel, que mira las 10); las tarjetas, las siguientes en orden.
  const s = mejorDe(ofertas), sup = ofertas[s];
  // El precio de antes solo se tacha si es un precio de antes de verdad: contra el mismo modelo se dice contra que se
  // compara, y en seguimiento (menos de una semana de historial) no se afirma un precio anterior (spec 035 y 038).
  const contra = o => o.modelo ? esc(O.textoContraModelo(o.modelo, G.pesos))
    : o.tipo === "seguimiento" ? "desde que lo seguimos, hace pocos días"
    : o.off > 0 ? `<s>${esc(G.pesos(o.antes))}</s>` : "";
  const precio = (o, clase) => { const n = esc(G.pesos(o.f[1])).replace(/^\$/, "");
    return `<span class="${clase}"><span class="sig">$</span>${n}</span>`; };
  const icono = o => T.svg(T.de(o.f[0]).tipo, "h-svg").replace('role="img"', 'aria-hidden="true"');
  const heroe = sup ? `    <article class="h-super">
      <p class="h-cinta"><span aria-hidden="true">★</span> ${sup.off * 100 >= PISO_SUPER ? "Súper oferta" : "La mejor del día"} <span aria-hidden="true">★</span></p>
      <div class="h-cuerpo">
        ${pctReel(sup, "h-pct") || "<span></span>"}
        <span class="h-icono">${icono(sup)}</span>
        <h2>${nombreReel(sup.f[0], esc)}</h2>
        ${chipsReel(sup.f[0], esc)}
        <p class="h-precio">${precio(sup, "h-ahora")}<span class="h-antes">${contra(sup)}</span></p>
        <p class="h-tienda">en <b>${esc(comercioDeOferta(sup, idx))}</b></p>
      </div>
    </article>` : "";
  const resto = ofertas.filter((o, i) => i !== s).slice(0, EN_TARJETA - 1);
  const tarjeta = resto.map(o => `      <li>${pctReel(o, "h-pct") || '<span class="h-pct"></span>'}<span class="h-txt"><span class="h-fila"><span class="h-ico">${icono(o)}</span>${nombreReel(o.f[0], esc)}</span>` +
    `${chipsReel(o.f[0], esc)}<span class="h-pre">${precio(o, "h-chico")} <span class="h-donde">en <b>${esc(comercioDeOferta(o, idx))}</b></span></span></span></li>`).join("\n");
  // Los enlaces de afiliado (P.enlaceTienda) llevan su rotulo y rel="sponsored"; el orden no cambia (principio II).
  const enlace = o => { const e = P.enlaceTienda(o.f[2]);
    return `<a class="oferta" data-rubro="ofertas" href="${esc(e.url)}" rel="${e.afiliado ? "sponsored noopener" : "noopener"}">${T.html(o.f[0], esc)}</a>` +
      (e.afiliado ? ' <span class="rotulo">enlace de afiliado</span>' : ""); };
  // La lista completa (spec 060): la misma tarjeta de dos tonos que el cartel, con el enlace a la tienda en el nombre.
  // El precio de antes se tacha solo si es un precio de antes de verdad; contra el modelo o en seguimiento se dice contra que.
  const lista = ofertas.map(o => `    <li>${pctReel(o, "h-pct") || '<span class="h-pct"></span>'}<span class="h-txt">${enlace(o)}` +
    `<span class="h-pre">${precio(o, "h-chico")}${!o.modelo && o.tipo !== "seguimiento" && o.off > 0 ? ` <s class="h-tachado">${esc(G.pesos(o.antes))}</s>` : ""}` +
    ` <span class="h-donde">en <b>${esc(comercioDeOferta(o, idx))}</b></span></span>` +
    (o.modelo ? `<span class="det">${esc(O.textoContraModelo(o.modelo, G.pesos))}</span>`
      : o.tipo === "seguimiento" ? `<span class="det">−${Math.round(o.off * 100)}% desde que lo seguimos, hace pocos días</span>` : "") +
    `</span></li>`).join("\n");
  const titulo = `Pichinchas del día · ${dia} | La Pichincha`;
  const descripcion = ofertas.length
    ? `Las ${ofertas.length} mejores bajas de precio de hardware en Argentina, con precios del ${fecha}.`
    : "Las mejores bajas de precio de hardware en Argentina, todos los días.";
  return G.cabeza({ titulo, descripcion, canonica: `${base}/hoy/`, baseUrl: base, rel: "../" }) + `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=optional" media="print" onload="this.media='all'">
<style>
/* El cartel del dia con el lenguaje del Reel v4 (spec 059, paleta «neon» aprobada por el dueño el 04/11): fondo violeta
   con rayas, tarjeta de dos tonos con borde rosa, el descuento y el precio enormes (signo rosa, numero amarillo, % celeste),
   la marca y la tienda en celeste, las chips en pastillas. Los colores son fijos (no siguen el tema claro/oscuro): es un
   cartel, y todos pasan 4,5:1 sobre su fondo. */
.hoy .historia{--n-fondo:#120018;--n-fondo2:#3b0a57;--n-tinta:#fff4ff;--n-suave:#d7b8e6;--n-amarillo:#ffd23f;--n-celeste:#3ee6ff;
  --n-rosa:#ff5fae;--n-tarjeta:#26063b;--n-tarjeta2:#0c1446;--n-tachado:#ff7eb6;
  --f-tit:"Oswald","Bahnschrift","Roboto Condensed","Arial Narrow","Avenir Next Condensed",sans-serif;
  width:min(100%,440px);margin:6px auto 24px;padding:22px 14px 20px;border-radius:24px;overflow:hidden;color:var(--n-tinta);
  background:repeating-linear-gradient(-45deg,rgba(215,184,230,.12) 0 2px,transparent 2px 30px),
    radial-gradient(120% 70% at 50% 28%,var(--n-fondo2),var(--n-fondo) 72%);
  display:flex;flex-direction:column;gap:14px}
.hoy .historia .sig{color:var(--n-rosa)} .hoy .historia .num{color:var(--n-amarillo)} .hoy .historia .por{color:var(--n-celeste);font-size:.82em}
.hoy .h-cab{display:flex;justify-content:space-between;padding:0 4px;font:700 .8rem var(--font-mono);letter-spacing:.12em;color:var(--n-amarillo);text-transform:uppercase}
.hoy .h-cab span+span{color:var(--n-celeste)}
.hoy .historia h1{margin:0;padding:0 4px;font:700 2.7rem/.95 var(--f-tit);font-stretch:condensed;letter-spacing:-.01em;text-transform:uppercase;color:var(--n-tinta)}
.hoy .historia h1 span{display:block;color:var(--n-celeste)}
.hoy .h-nom{font-family:var(--f-tit);font-weight:700;font-stretch:condensed;text-transform:uppercase;color:var(--n-tinta);overflow-wrap:anywhere}
.hoy .h-tipo{color:var(--n-rosa)} .hoy .h-marca{color:var(--n-celeste)}
.hoy .h-chips{display:flex;flex-wrap:wrap;gap:6px}
.hoy .h-chip{padding:2px 10px 3px;border-radius:999px;font:700 .82rem/1.3 var(--font-sans);color:var(--n-celeste);
  background:rgba(62,230,255,.12);border:2px solid rgba(62,230,255,.6)}
.hoy .h-chip.pr{color:var(--n-fondo);border-color:transparent;background:linear-gradient(90deg,var(--n-rosa),var(--n-celeste))}
/* La super oferta */
.hoy .h-super{border-radius:22px;overflow:hidden;border:3px solid var(--n-rosa);box-shadow:0 0 30px rgba(255,95,174,.45);
  background:linear-gradient(165deg,var(--n-tarjeta),var(--n-tarjeta2))}
.hoy .h-cinta{margin:0;padding:9px 8px 8px;text-align:center;font:700 1.15rem/1 var(--f-tit);font-stretch:condensed;letter-spacing:.16em;
  text-transform:uppercase;color:var(--n-fondo);background:linear-gradient(90deg,var(--n-rosa),var(--n-celeste),var(--n-rosa))}
.hoy .h-cuerpo{display:grid;grid-template-columns:1fr auto;gap:8px 12px;padding:14px 16px 16px;align-items:start}
.hoy .h-super .h-pct{font:700 4.6rem/.85 var(--f-tit);font-stretch:condensed;letter-spacing:-.02em;white-space:nowrap;
  text-shadow:0 4px 22px rgba(18,0,24,.55)}
.hoy .h-icono{width:88px;height:88px;border-radius:20px;background:#fff;color:var(--n-fondo2);display:grid;place-items:center;
  box-shadow:0 10px 26px rgba(0,0,0,.35)}
.hoy .h-icono svg{width:60px;height:60px}
.hoy .h-super h2{grid-column:1/-1;margin:4px 0 0;font-size:2rem;line-height:1}
.hoy .h-super .h-chips{grid-column:1/-1}
.hoy .h-precio{grid-column:1/-1;margin:14px 0 0;display:flex;flex-direction:column;gap:4px}
.hoy .h-ahora{font:700 min(3.7rem,15vw)/.9 var(--f-tit);font-stretch:condensed;letter-spacing:-.01em;color:var(--n-amarillo);
  white-space:nowrap;font-variant-numeric:tabular-nums}
.hoy .h-antes{font:700 1.05rem var(--font-mono);color:var(--n-suave)}
.hoy .h-antes s{text-decoration-color:var(--n-tachado);text-decoration-thickness:3px}
.hoy .h-tienda{grid-column:1/-1;margin:0;font:600 1rem var(--font-sans);color:var(--n-suave)}
.hoy .historia b{color:var(--n-celeste)}
/* Las siguientes: tarjetas de dos tonos con borde celeste */
.hoy .h-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.hoy .h-lista li{display:grid;grid-template-columns:4.6rem 1fr;gap:10px;align-items:start;padding:12px 12px 12px 8px;border-radius:18px;
  background:linear-gradient(165deg,var(--n-tarjeta),var(--n-tarjeta2));border:2px solid rgba(62,230,255,.45)}
.hoy .h-lista .h-pct{font:700 2.1rem/.9 var(--f-tit);font-stretch:condensed;letter-spacing:-.02em;white-space:nowrap;text-align:right}
.hoy .h-txt{display:flex;flex-direction:column;gap:6px;min-width:0}
.hoy .h-fila{display:flex;gap:8px;align-items:flex-start}
.hoy .h-ico{flex:none;color:var(--n-celeste)} .hoy .h-ico svg{width:24px;height:24px;margin-top:1px}
.hoy .h-lista .h-nom{font-size:1.2rem;line-height:1.1}
.hoy .h-pre{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px}
.hoy .h-chico{font:700 1.55rem/1 var(--f-tit);font-stretch:condensed;color:var(--n-amarillo);font-variant-numeric:tabular-nums}
.hoy .h-donde{font:600 .85rem var(--font-sans);color:var(--n-suave)}
.hoy .h-pie{margin:0;padding:0 4px;font:600 .85rem/1.35 var(--font-sans);color:var(--n-suave);overflow-wrap:anywhere}
.hoy .h-pie b{color:var(--n-amarillo);font-family:var(--font-mono)}
/* Tarjetas alternadas (pedido del dueño 04/11): una con borde celeste y nombre blanco, la siguiente con borde rosa y
   nombre lila claro, para que dos vecinas no se vean iguales */
.hoy .h-lista li:nth-child(3n+2){border-color:rgba(255,110,182,.6)}
.hoy .h-lista li:nth-child(3n){border-color:rgba(199,155,255,.75)}
.hoy .h-lista li:nth-child(3n+2) .h-nom,.hoy .h-lista li:nth-child(3n+2) .tit-nom{color:#f3b6ff}
.hoy .h-lista li:nth-child(3n+1) .h-nom,.hoy .h-lista li:nth-child(3n+1) .tit-nom{color:#d9a6ff}
.hoy .h-lista li:nth-child(3n) .h-nom,.hoy .h-lista li:nth-child(3n) .tit-nom{color:#8dffc4}
/* la tienda, destacada: pastilla llena con letra negra en negrita (celeste, rosa, lila en ciclo) */
.hoy .h-donde b,.hoy .h-tienda b{display:inline-block;padding:1px 10px 2px;border-radius:999px;background:#3ee6ff;color:#120018;font-weight:800}
.hoy .h-lista li:nth-child(3n+2) .h-donde b{background:#ff6eb6}
.hoy .h-lista li:nth-child(3n) .h-donde b{background:#c79bff}
/* La lista completa (spec 060): las mismas tarjetas, con el nombre como enlace a la tienda */
.hoy .h-todas h2{margin:0;padding:0 4px;font:700 2rem/.95 var(--f-tit);font-stretch:condensed;text-transform:uppercase;color:var(--n-tinta)}
.hoy .h-todas h2 span{color:var(--n-celeste)}
.hoy .historia a.oferta{display:block;padding:0;margin:0;border:0;border-radius:6px;background:none;box-shadow:none;animation:none;
  transform:none;color:var(--n-tinta);text-decoration:none}
.hoy .historia a.oferta:hover .tit-nom{text-decoration:underline;text-decoration-color:var(--n-celeste);text-underline-offset:3px}
.hoy .historia a.oferta:focus-visible{outline:2px solid var(--n-celeste);outline-offset:3px}
.hoy .historia .tit-ico{color:var(--n-rosa);width:24px;height:24px}
.hoy .historia .tit-txt{gap:6px}
.hoy .historia .tit-nom{font:700 1.2rem/1.1 var(--f-tit);font-stretch:condensed;text-transform:uppercase;color:var(--n-tinta);letter-spacing:0}
.hoy .historia .tit-marca{color:var(--n-celeste)}
.hoy .historia .tit-chips{gap:6px}
/* en la lista las chips van en lila: el celeste queda para la marca y la tienda (alternar, no amontonar) */
.hoy .historia .tit-chip{padding:1px 9px 2px;border-radius:999px;font:700 .78rem/1.3 var(--font-sans);color:var(--n-suave);
  background:rgba(215,184,230,.10);border:2px solid rgba(215,184,230,.45)}
.hoy .historia .tit-chip.pr{color:var(--n-fondo);border-color:transparent;background:linear-gradient(90deg,var(--n-rosa),var(--n-celeste))}
.hoy .h-tachado{font:700 .95rem var(--font-mono);color:var(--n-suave);text-decoration-color:var(--n-tachado);text-decoration-thickness:2px}
.hoy .historia .det{display:block;font:600 .82rem/1.35 var(--font-sans);color:var(--n-suave)}
.hoy .historia .rotulo{font:600 .74rem var(--font-mono);color:var(--n-suave)}
</style>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap hoy">
  <section class="historia" aria-label="Tarjeta con las mejores ofertas de hoy">
    <div class="h-cab"><span>La Pichincha</span><span>Hoy ${esc(dia)}</span></div>
    <h1>Pichinchas <span>del día</span></h1>
${heroe}
${tarjeta ? `    <ol class="h-lista">\n${tarjeta}\n    </ol>` : ""}
    <p class="h-pie">Todas con su link en<br><b>${esc(base.replace(/^https?:\/\//, ""))}/hoy</b></p>
  </section>
  <section class="historia h-todas" aria-labelledby="todas-t">
    <div class="h-cab"><span>La Pichincha</span><span>precios del ${esc(fecha)}</span></div>
    <h2 id="todas-t">Todas las ofertas <span>de hoy</span></h2>
${ofertas.length ? `    <ol class="h-lista todas">\n${lista}\n    </ol>` : `    <p class="h-pie">Hoy no hay bajas para destacar. Volvé mañana o buscá lo que necesitás en el comparador.</p>`}
  </section>
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
    nombre: o.f[0], ...(({ titulo, prefijo, chips, tipo, emoji }) => ({ titulo, ...(prefijo ? { prefijo } : {}), chips, icono: tipo, emoji }))(T.de(o.f[0])), precio: o.f[1], antes: Math.round(o.antes), descuento: Math.round(o.off * 100),
    ...(o.modelo ? { contra: `bajo la mediana de otras ${o.modelo.tiendas} tiendas` }
      : o.tipo === "seguimiento" ? { contra: "desde que lo seguimos, hace pocos días" }
      : !o.off ? { sinRebaja: true } : {}),      // a precio de siempre: el mensaje muestra el producto sin inventar un −0 %
    comercio: comercioDeOferta(o, idx), url: o.f[2], tipo: o.tipo, categoria: C.ETIQUETA[o.categoria],
    tienda: o.f[3],
    // la foto de la tienda para el Reel (spec 045) y la imagen de /hoy/ (spec 059): solo una direccion https sin comillas ni espacios
    ...(/^https:\/\/[^\s"'()<>\\]+$/.test(o.f[7] || "") ? { imagen: o.f[7] } : {}),
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
