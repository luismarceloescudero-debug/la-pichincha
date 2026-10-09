#!/usr/bin/env node
/* Genera las paginas estaticas por busqueda popular (precios/<slug>/index.html).

   Uso: node generar_paginas.js --indice indice.json --consultas consultas-validadas.json \
          --salida _sitio [--datos datos.json] [--base-url https://...]

   La lista la valida y le pone slug generar_paginas.py. El analisis de cada consulta es el de
   js/analisis.js: el mismo modulo que usa la Comparativa del sitio, asi que la pagina y la
   comparativa dan siempre lo mismo (FR-004). Sin dependencias: solo Node. */
"use strict";

const fs = require("fs");
const path = require("path");
const B = require("./js/buscador.js");
const A = require("./js/analisis.js");
const P = require("./js/pagina.js");

const BASE_URL = "https://luismarceloescudero-debug.github.io/la-pichincha";
const MIN_COMPARABLES = 5;     // debajo de esto la pagina es fina: no se indexa
const MAX_FILAS = 20;
const MAX_INTERNACIONALES = 5;

// Las URL de los avisos vienen de terceros: solo se enlaza http(s), nunca javascript: ni data:.
const esUrl = u => /^https?:\/\//i.test(String(u));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

/* Lo que Analisis necesita de la "pagina": la busqueda sobre el indice, comercios y marcas. */
function crearContexto(idx, { baseUrl = BASE_URL, ahora = new Date(), marcas = {} } = {}) {
  const nombres = idx.productos.map(f => B.normalBusq(f[0]));
  const marcasRe = B.armarMarcasRe([...(marcas.primera || []), ...(marcas.conocida || [])]);
  return {
    idx, baseUrl, ahora,
    buscarTodo: q => { const c = B.filtroDe(q); return c ? idx.productos.filter((f, i) => c(nombres[i])) : []; },
    comercioDe: f => f[4] || (idx.tiendas[f[3]] || {}).nombre || f[3],
    colorDe: f => (idx.tiendas[f[3]] || {}).color || "fh",
    marcaDe: nombre => B.marcaDe(nombre, marcasRe),
    nivelMarca: B.crearNivelMarca(marcas),
    pesos,
  };
}

const esIndexable = analisis => !!analisis && analisis.base.length >= MIN_COMPARABLES;

/* "precio del 8/10" si la fuente no se releva el dia de los precios (principio II). */
const viejoDe = (f, ctx) => P.precioDel((ctx.idx.tiendas[f[3]] || {}).relevado, ctx.idx.generado);

function sellosHtml(f, ctx) {
  const s = [];
  const viejo = viejoDe(f, ctx);
  if (viejo) s.push(["ojo", viejo]);
  if (f[6] > f[1]) s.push(["baja", `bajó ${Math.round((1 - f[1] / f[6]) * 100)}%`]);
  s.push(...B.sellosDe(f[8]));
  return s.map(([clase, texto]) => `<span class="sello ${clase}">${esc(texto)}</span>`).join(" ");
}

function filaHtml(f, ctx) {
  const nombre = esUrl(f[2])
    ? `<a href="${esc(f[2])}" target="_blank" rel="noopener" data-rubro="${esc(B.categoriaDe(f[0]) || "otro")}">${esc(f[0])}</a>`
    : esc(f[0]);
  return `<tr data-op><td>${nombre}</td>` +
    `<td>${esc(ctx.comercioDe(f))}</td><td class="num">${pesos(f[1])}</td><td>${sellosHtml(f, ctx)}</td></tr>`;
}

/* JSON para meter en un <script>: el "<" va escapado para que ningun texto cierre la etiqueta. */
const jsonLd = obj => JSON.stringify(obj).replace(/</g, "\\u003c");

/* Mide el clic hacia una tienda con la misma analitica que el sitio (GoatCounter, sin cookies).
   Si el script de GoatCounter no cargo, el clic sigue su camino sin avisar. */
/* Inicia js/app.js: service worker y aviso de sin conexion con la fecha de los precios de la pagina. */
const scriptApp = (generado, rel) =>
  `App.iniciar(window, document, { sw: "${rel}sw.js", sonda: "${rel}manifest.webmanifest", generado: () => ${JSON.stringify(generado)} });`;

const SCRIPT_MEDICION = `(function () {
  function alClic(ev) {
    var a = ev.target.closest("a[data-rubro]");
    if (!a) return;
    var e = Pagina.eventoClic(a.href, a.dataset.rubro);
    var gc = window.goatcounter;
    if (e && gc && typeof gc.count === "function") { try { gc.count(e); } catch (_) {} }
  }
  document.addEventListener("click", alClic, true);
  document.addEventListener("auxclick", alClic, true);
})();`;

function grafoDe(consulta, filas, analisis, ctx, desde, hasta) {
  const base = ctx.baseUrl;
  const canonica = `${base}/precios/${consulta.slug}/`;
  // Un precio que no se pudo verificar hoy lo dice tambien aca, no solo en la pagina (FR-017).
  const oferta = f => ({ "@type": "Offer", price: f[1], priceCurrency: "ARS", url: f[2],
    ...(viejoDe(f, ctx) ? { description: viejoDe(f, ctx) } : {}) });
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "ItemList", name: `${consulta.q}: precios en Argentina`, numberOfItems: Math.min(filas.filter(f => esUrl(f[2])).length, MAX_FILAS),
      itemListElement: filas.filter(f => esUrl(f[2])).slice(0, MAX_FILAS).map((f, i) => ({ "@type": "ListItem", position: i + 1,
        item: { "@type": "Product", name: f[0], url: f[2], offers: oferta(f) } })) },
    { "@type": "Product", name: consulta.q, image: `${base}/img/og.png`, url: canonica,
      offers: { "@type": "AggregateOffer", lowPrice: desde, highPrice: hasta, offerCount: filas.length, priceCurrency: "ARS" } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "La Pichincha", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Precios", item: `${base}/precios/` },
      { "@type": "ListItem", position: 3, name: consulta.q, item: canonica } ] },
  ] };
}

function cabeza({ titulo, descripcion, canonica, noindex, baseUrl, grafo, rel = "../../" }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${esc(canonica)}">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : ""}<meta property="og:type" content="website">
<meta property="og:site_name" content="La Pichincha">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:url" content="${esc(canonica)}">
<meta property="og:image" content="${esc(baseUrl)}/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(titulo)}">
<meta name="twitter:description" content="${esc(descripcion)}">
<meta name="twitter:image" content="${esc(baseUrl)}/img/og.png">
<link rel="manifest" href="${rel}manifest.webmanifest">
<link rel="apple-touch-icon" href="${rel}img/apple-touch-icon.png">
<meta name="theme-color" content="#0b4fd8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1117" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"></noscript>
<link rel="stylesheet" href="${rel}css/sitio.css">
<script id="gc" data-goatcounter="https://mescudero.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
${grafo ? `<script type="application/ld+json">${jsonLd(grafo)}</script>
` : ""}<style>
/* Solo de estas paginas: todo sale de las variables del sitio, asi sigue el tema claro u oscuro. */
.wrap a{color:var(--accent)}
.wrap a.acc{color:var(--ink)}
.wrap h2{font-size:1.1rem;margin:30px 0 12px;letter-spacing:-.01em}
.wrap section.panel{margin:22px 0}
.wrap section.panel h2{margin-top:0}
.wrap td.num{text-align:right;font-family:var(--font-mono);white-space:nowrap}
.wrap th:nth-child(3){text-align:right}
.wrap .nota{margin-top:34px;color:var(--ink-3);font-size:.82rem}
</style>
</head>`;
}

function pie(ctx) {
  return `<p class="nota">Precios con IVA y sin envío, tomados de CompraGamer, Gaming City, Mexx, FullH4rd y ComparaYa. ` +
    `El stock y los precios de hardware se mueven rápido: confirmá antes de pagar. ` +
    `<a href="../../">Volver a La Pichincha</a>.</p>`;
}

/* Pagina de una consulta. consulta = { q, slug }; analisis = Analisis.analizarConsulta o null. */
function renderPagina(consulta, analisis, ctx) {
  const { q, slug } = consulta;
  const canonica = `${ctx.baseUrl}/precios/${slug}/`;
  const cuando = P.cuando(ctx.idx.generado, ctx.ahora);
  const interactiva = P.armarUrl("../../", q, "comparativa");

  if (!esIndexable(analisis)) {
    const buscador = P.armarUrl("../../", q, "buscar");
    return cabeza({ titulo: `${q}: precios en Argentina | La Pichincha`,
      descripcion: `Hoy no hay opciones suficientes de ${q} para comparar. Probá el buscador de La Pichincha.`,
      canonica, noindex: true, baseUrl: ctx.baseUrl }) + `
<body>
<div id="sin-red" class="sin-red" role="status" hidden></div>
<div class="wrap">
  <p class="meta">La Pichincha · ${esc(cuando)}</p>
  <h1>${esc(q)}: hoy no hay opciones suficientes</h1>
  <p class="sub">Encontramos menos de ${MIN_COMPARABLES} opciones comparables de «${esc(q)}» en las tiendas que seguimos, así que todavía no armamos la comparación. Probá con el buscador, que mira todos los avisos.</p>
  <p><a class="acc" href="${esc(buscador)}">Buscar «${esc(q)}» en La Pichincha</a></p>
  ${pie(ctx)}
</div>
<script src="../../js/pagina.js"></script>
<script src="../../js/app.js"></script>
<script>${scriptApp(ctx.idx.generado, "../../")}</script>
<script>${SCRIPT_MEDICION}</script>
</body>
</html>
`;
  }

  const filas = B.ordenar(analisis.base.map(m => m.f), analisis.med, "recomendado", ctx.nivelMarca);
  const mostrar = filas.slice(0, MAX_FILAS);
  const resto = filas.length - mostrar.length;
  const precios = filas.map(f => f[1]);
  const desde = Math.min(...precios), hasta = Math.max(...precios);
  const mejor = analisis.picks[0].m.f;
  const comercios = analisis.comercios.length;
  const afuera = A.partesExclusion(analisis.excl);
  const intl = analisis.internacionales.map(m => m.f).sort((a, b) => a[1] - b[1]).slice(0, MAX_INTERNACIONALES);

  const titulo = `${q}: precios desde ${pesos(desde)} | La Pichincha`;
  const descripcion = `${filas.length} opciones de ${q} en ${comercios} comercios: desde ${pesos(desde)}, ` +
    `mediana ${pesos(analisis.med)}. Mejor compra y precios de ${cuando}.`;

  return cabeza({ titulo, descripcion, canonica, noindex: false, baseUrl: ctx.baseUrl,
    grafo: grafoDe(consulta, filas, analisis, ctx, desde, hasta) }) + `
<body>
<div id="sin-red" class="sin-red" role="status" hidden></div>
<div class="wrap">
  <p class="meta">La Pichincha · precios de ${esc(cuando)}</p>
  <h1>${esc(q)}: precios y qué conviene comprar</h1>
  <p class="sub">Comparamos ${filas.length} opciones de «${esc(q)}» en ${comercios} comercio${comercios > 1 ? "s" : ""}: de ${pesos(desde)} a ${pesos(hasta)}, con una mediana de ${pesos(analisis.med)}. Dejamos afuera lo que no es comparable.</p>

  <section class="panel">
    <h2>Mejor compra</h2>
    <p>${esUrl(mejor[2]) ? `<a href="${esc(mejor[2])}" target="_blank" rel="noopener" data-rubro="${esc(B.categoriaDe(mejor[0]) || "otro")}"><b>${esc(mejor[0])}</b></a>` : `<b>${esc(mejor[0])}</b>`} · ${esc(ctx.comercioDe(mejor))} · <b>${pesos(mejor[1])}</b> ${sellosHtml(mejor, ctx)}</p>
    <p class="sub">${esc(analisis.picks[0].razon)}</p>
  </section>

  <div class="tiles">
    <div class="tile"><div class="k">Mediana</div><div class="v">${pesos(analisis.med)}</div><div class="d">${filas.length} opciones comparables</div></div>
    <div class="tile"><div class="k">Desde</div><div class="v">${pesos(desde)}</div><div class="d">la opción más barata</div></div>
    <div class="tile"><div class="k">Comercios</div><div class="v">${comercios}</div><div class="d">con opciones comparables</div></div>
  </div>

  <section>
    <h2>Opciones de ${esc(q)}</h2>
    <div class="scroll"><table>
      <thead><tr><th>Producto</th><th>Comercio</th><th>Precio</th><th>Detalle</th></tr></thead>
      <tbody>
${mostrar.map(f => "        " + filaHtml(f, ctx)).join("\n")}
      </tbody>
    </table></div>
    ${resto > 0 ? `<p class="sub">Y ${resto} opciones más en la comparativa interactiva.</p>` : ""}
  </section>
${intl.length ? `
  <section>
    <h2>Compras internacionales</h2>
    <p class="sub">Se envían desde el exterior: tardan semanas y pueden pagar impuestos al llegar, por eso no compiten con el resto.</p>
    <div class="scroll"><table><tbody>
${intl.map(f => "      " + filaHtml(f, ctx).replace("<tr data-op>", "<tr>")).join("\n")}
    </tbody></table></div>
  </section>
` : ""}${afuera.length ? `  <p class="sub">Quedaron afuera ${esc(afuera.join(", "))}.</p>\n` : ""}
  <p><a class="acc" href="${esc(interactiva)}">Ver la comparativa completa</a></p>
  ${pie(ctx)}
</div>
<script src="../../js/pagina.js"></script>
<script src="../../js/app.js"></script>
<script>${scriptApp(ctx.idx.generado, "../../")}</script>
<script>${SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

/* /precios/: el hub que enlaza cada pagina indexable, agrupada por rubro. entradas = [{ q, slug,
   grupo, desde, comparables }] y solo trae las indexables: las finas no se enlazan. */
function renderIndice(entradas, ctx) {
  const canonica = `${ctx.baseUrl}/precios/`;
  const grupos = new Map();
  for (const e of entradas) {
    if (!grupos.has(e.grupo)) grupos.set(e.grupo, []);
    grupos.get(e.grupo).push(e);
  }
  const cuando = P.cuando(ctx.idx.generado, ctx.ahora);
  const grafo = { "@context": "https://schema.org", "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "La Pichincha", item: `${ctx.baseUrl}/` },
      { "@type": "ListItem", position: 2, name: "Precios", item: canonica } ] },
  ] };
  const cuerpo = entradas.length ? [...grupos].map(([grupo, lista]) => `  <section>
    <h2>${esc(grupo)}</h2>
    <ul>
${lista.map(e => `      <li><a href="${esc(e.slug)}/">${esc(e.q)}</a> <span class="sub">desde ${pesos(e.desde)} · ${e.comparables} opciones</span></li>`).join("\n")}
    </ul>
  </section>`).join("\n")
    : `  <p class="sub">Todavía no hay páginas de precios con opciones suficientes. Probá el <a href="../">buscador</a>.</p>`;
  return cabeza({ titulo: "Precios de hardware en Argentina | La Pichincha",
    descripcion: `Precios de hardware en Argentina comparados en varias tiendas: placas de video, monitores, memorias, SSD y más. Precios de ${cuando}.`,
    canonica, noindex: false, baseUrl: ctx.baseUrl, grafo, rel: "../" }) + `
<body>
<div id="sin-red" class="sin-red" role="status" hidden></div>
<div class="wrap">
  <p class="meta">La Pichincha · precios de ${esc(cuando)}</p>
  <h1>Precios de hardware en Argentina</h1>
  <p class="sub">Lo que se busca más, con el precio de hoy en varias tiendas, la mediana y qué conviene comprar. Cada página sale del mismo análisis que la comparativa de <a href="../">La Pichincha</a>.</p>
${cuerpo}
  <p class="nota">Precios con IVA y sin envío. <a href="../">Volver a La Pichincha</a>.</p>
</div>
<script src="../js/pagina.js"></script>
<script src="../js/app.js"></script>
<script>${scriptApp(ctx.idx.generado, "../")}</script>
</body>
</html>
`;
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const raiz = __dirname;
  const indicePath = arg("indice", path.join(raiz, "indice.json"));
  const consultasPath = arg("consultas");
  const salida = arg("salida", path.join(raiz, "_sitio"));
  const baseUrl = arg("base-url", BASE_URL).replace(/\/$/, "");
  if (!consultasPath) throw new Error("falta --consultas (la lista validada por generar_paginas.py)");

  if (!fs.existsSync(indicePath)) {                      // FR-016: sin indice no hay paginas vacias
    console.log("sin indice de precios: no se generan paginas por busqueda");
    return 0;
  }
  const idx = JSON.parse(fs.readFileSync(indicePath, "utf8"));
  const datos = JSON.parse(fs.readFileSync(arg("datos", path.join(raiz, "datos.json")), "utf8"));
  const consultas = JSON.parse(fs.readFileSync(consultasPath, "utf8"));
  const ctx = crearContexto(idx, { baseUrl, marcas: datos.marcas || {} });

  const paginas = [], entradas = [];
  for (const c of consultas) {
    const analisis = A.analizarConsulta(c.q, ctx);
    const dir = path.join(salida, "precios", c.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderPagina(c, analisis, ctx), "utf8");
    const indexable = esIndexable(analisis);
    paginas.push({ slug: c.slug, q: c.q, indexable });
    if (indexable) entradas.push({ q: c.q, slug: c.slug, grupo: (c.nota || "").split(":")[0] || "Otros",
      desde: Math.min(...analisis.base.map(m => m.f[1])), comparables: analisis.base.length });
  }
  fs.mkdirSync(path.join(salida, "precios"), { recursive: true });
  fs.writeFileSync(path.join(salida, "precios", "index.html"), renderIndice(entradas, ctx), "utf8");
  const manifiesto = arg("manifiesto");                  // lo lee generar_paginas.py para el mapa del sitio
  if (manifiesto) fs.writeFileSync(manifiesto, JSON.stringify({ generado: idx.generado, paginas }), "utf8");
  console.log(`${consultas.length} paginas generadas, ${entradas.length} indexables`);
  return 0;
}

module.exports = { crearContexto, renderPagina, renderIndice, esIndexable, esc, pesos, SCRIPT_MEDICION, BASE_URL, MIN_COMPARABLES };
if (require.main === module) process.exit(main(process.argv.slice(2)));
