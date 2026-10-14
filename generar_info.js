#!/usr/bin/env node
/* Paginas de informacion: /estado/ (cuando se relevo cada fuente) y /legal/ (terminos, privacidad y
   afiliados).

   Uso: node generar_info.js --indice indice.json --salud salud.json --salida _sitio [--base-url URL]

   /estado/ sale del indice (tiendas.<clave>.relevado) y, si es de la misma corrida, de salud.json
   (cuanto trajo cada fuente, ver salud.py). Sin indice no hay estado que mostrar y se escribe solo
   /legal/. */
"use strict";

const fs = require("fs");
const path = require("path");
const G = require("./generar_paginas.js");
const P = require("./js/pagina.js");

const BASE_URL = G.BASE_URL;
const esc = G.esc;

const ETIQUETAS = {
  fallo: "No respondió en el último relevamiento: se muestran sus precios anteriores, con su fecha.",
  baja: "Trajo menos de lo habitual: puede faltar parte de su catálogo.",
  atrasada: "Sin datos nuevos: se muestran sus precios anteriores, con su fecha.",
  "sin-datos": "Todavía sin relevar.",
  ok: "Al día.",
};
const ORDEN = ["fallo", "sin-datos", "atrasada", "baja", "ok"];

/* Una fila por fuente del indice. El estado medido en salud.json manda solo si es de la misma corrida
   que el indice; si no, lo dice la fecha del ultimo relevamiento. */
function estadoFuentes(idx, salud) {
  const medido = salud && salud.fecha === idx.generado ? salud.fuentes || {} : {};
  const avisos = {};
  for (const f of idx.productos || []) avisos[f[3]] = (avisos[f[3]] || 0) + 1;
  const filas = Object.entries(idx.tiendas || {}).map(([clave, t]) => {
    // Los indices anteriores a tiendas.relevado no la traen: si la fuente tiene avisos, son del indice.
    const relevado = t.relevado || (avisos[clave] ? idx.generado : null);
    let estado = !relevado ? "sin-datos" : P.precioDel(relevado, idx.generado) ? "atrasada" : "ok";
    if (medido[clave] && medido[clave].estado !== "ok") estado = medido[clave].estado;
    return { clave, nombre: t.nombre || clave, avisos: avisos[clave] || 0, relevado, estado, segunda: !!t.segunda };
  });
  return filas.sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado));
}

const ESTILO = `<style>
.info table{width:100%;min-width:0;border-collapse:collapse}
.info th,.info td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.info .num{text-align:right}
.info .est{display:block;font-size:.82rem;color:var(--ink-2)}
.info .est.mal{color:var(--bad)}
.info td:first-child{font-family:var(--font-sans)}
.info .agr{font-size:.75rem;color:var(--ink-3)}
.info .cuando{display:block;font:500 .78rem var(--font-mono);color:var(--ink-3);margin-top:2px}
.info section{margin:28px 0}
.info section p,.info section li{line-height:1.55}
</style>`;

const pie = `<p class="nota"><a href="../">Volver a La Pichincha</a> · <a href="../estado/">Estado de las fuentes</a> · <a href="../legal/">Términos y privacidad</a></p>`;

/* La cabeza comun de las paginas generadas, con el estilo de estas dos adentro del <head>. */
const cabeza = opciones => G.cabeza(opciones).replace("</head>", ESTILO + "\n</head>");

function renderEstado(idx, salud, { baseUrl = BASE_URL } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const filas = estadoFuentes(idx, salud).map(f => `    <tr><td>${esc(f.nombre)}${f.segunda ? ' <span class="agr">(agregador)</span>' : ""}` +
    `<span class="est${f.estado === "ok" ? "" : " mal"}">${esc(ETIQUETAS[f.estado] || f.estado)}</span>` +
    (f.relevado ? `<span class="cuando">Último dato: ${esc(P.fechaHora(f.relevado))}</span>` : "") +
    `</td><td class="num">${f.avisos.toLocaleString("es-AR")}</td></tr>`).join("\n");
  return cabeza({ titulo: "Estado de las fuentes | La Pichincha",
    descripcion: "Cuándo se relevó por última vez cada tienda que compara La Pichincha y cuántos avisos trajo.",
    canonica: `${base}/estado/`, baseUrl: base, rel: "../" }) + `
<body>
<div class="wrap info">
  <h1>Estado de las fuentes</h1>
  <p class="sub">Precios del ${esc(P.fechaHora(idx.generado))} (hora argentina). Cada tienda se releva una vez por día; si una no responde, se conservan sus precios anteriores y se muestran con su fecha, nunca como si fueran de hoy.</p>
  <table>
    <thead><tr><th>Tienda</th><th class="num">Avisos</th></tr></thead>
    <tbody>
${filas}
    </tbody>
  </table>
  ${pie}
</div>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

function renderLegal({ baseUrl = BASE_URL } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  return cabeza({ titulo: "Términos, privacidad y afiliados | La Pichincha",
    descripcion: "Cómo funciona La Pichincha: de dónde salen los precios, qué datos se miden y cómo se rotulan los enlaces de afiliado.",
    canonica: `${base}/legal/`, baseUrl: base, rel: "../" }) + `
<body>
<div class="wrap info">
  <h1>Términos, privacidad y afiliados</h1>
  <section>
    <h2 id="terminos">Términos de uso</h2>
    <p>La Pichincha compara precios publicados por tiendas argentinas. No vende nada: cada compra se hace en la tienda, con sus condiciones, su stock y su garantía.</p>
    <p>Cada precio dice de dónde sale y cuándo se verificó. Los precios con IVA y sin envío cambian rápido: confirmalos en la tienda antes de pagar. Si una tienda no responde, se muestran sus precios anteriores con su fecha (ver <a href="../estado/">estado de las fuentes</a>).</p>
    <p>El análisis ("qué conviene") es una orientación hecha con los datos del día, no un consejo profesional.</p>
  </section>
  <section>
    <h2 id="privacidad">Privacidad</h2>
    <p>El sitio no tiene cuentas ni formularios y no guarda datos personales. Las visitas, las búsquedas y los clics a tiendas se miden con GoatCounter, sin cookies y sin identificar a nadie, para saber qué se busca y qué sirve.</p>
    <p>Las preferencias (por ejemplo, el tema claro u oscuro) quedan solo en tu navegador.</p>
  </section>
  <section>
    <h2 id="afiliados">Enlaces de afiliado</h2>
    <p>Algunos enlaces a tiendas pueden ser de afiliado: si comprás, la tienda le paga una comisión a La Pichincha, sin costo extra para vos. Cada uno de esos enlaces va rotulado.</p>
    <p>El orden de los resultados nunca depende de una comisión: sale solo del precio y de las reglas de comparación.</p>
  </section>
  ${pie}
</div>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const indicePath = arg("indice", path.join(__dirname, "indice.json"));
  const saludPath = arg("salud", path.join(__dirname, "salud.json"));
  const salida = arg("salida", path.join(__dirname, "_sitio"));
  const baseUrl = arg("base-url", BASE_URL);
  const escribir = (dir, html) => {
    fs.mkdirSync(path.join(salida, dir), { recursive: true });
    fs.writeFileSync(path.join(salida, dir, "index.html"), html, "utf8");
  };
  escribir("legal", renderLegal({ baseUrl }));
  if (!fs.existsSync(indicePath)) { console.log("sin indice de precios: no se genera /estado/"); return 0; }
  const idx = JSON.parse(fs.readFileSync(indicePath, "utf8"));
  const salud = fs.existsSync(saludPath) ? JSON.parse(fs.readFileSync(saludPath, "utf8")) : null;
  escribir("estado", renderEstado(idx, salud, { baseUrl }));
  console.log(`paginas de informacion: /legal/ y /estado/ (${Object.keys(idx.tiendas || {}).length} fuentes)`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { estadoFuentes, renderEstado, renderLegal, main, ETIQUETAS };
