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
const Modos = require("./js/modos.js");
const P = require("./js/pagina.js");

const SITIO = require("./sitio.json");
const BASE_URL = SITIO.base_url;   // la direccion publica vive en sitio.json
const MIN_COMPARABLES = 5;     // debajo de esto la pagina es fina: no se indexa
const MIN_COMERCIOS = 2;       // con un solo comercio no hay comparacion (24/10: /precios/rtx-4060/, todo de revendedores de Mercado Libre)
const MAX_FILAS = 20;
const MAX_INTERNACIONALES = 5;

// Las URL de los avisos vienen de terceros: solo se enlaza http(s), nunca javascript: ni data:.
const esUrl = u => /^https?:\/\//i.test(String(u));
/* El enlace a una tienda con el codigo de afiliado de Mercado Libre (spec 027), rotulado y con rel="sponsored". */
const tienda = u => { const a = P.enlaceTienda(String(u)); return { href: esc(a.url), rel: a.afiliado ? "sponsored noopener" : "noopener",
  sello: a.afiliado ? ' <span class="afi" title="Enlace de afiliado: no cambia el precio ni el orden">(afiliado)</span>' : "" }; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pesos = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");

/* Como se muestra una consulta en titulos y encabezados: la busqueda se guarda en minuscula y sin tildes («rtx 5060»,
   «teclado mecanico»), pero Google y la persona leen «RTX 5060» y «Teclado mecánico». La URL y el ?q= no cambian. */
const SIGLAS = /^(rtx|gtx|rx|ssd|ddr\d|ram|usb|cpu|gpu|led|ips|va|oled|qd|hdmi|[abhxz]\d{3}[a-z]?|\d+k)$/;
const PALABRAS = { nvme: "NVMe", ipad: "iPad", iphone: "iPhone", ryzen: "Ryzen", intel: "Intel", amd: "AMD", samsung: "Samsung", logitech: "Logitech",
  mecanico: "mecánico", mecanicos: "mecánicos", inalambrico: "inalámbrico", inalambricos: "inalámbricos", microfono: "micrófono" };
function rotulo(q) {
  const palabras = String(q).trim().split(/\s+/).map(p => {
    const m = p.toLowerCase();
    if (PALABRAS[m]) return PALABRAS[m];
    if (SIGLAS.test(m)) return m.toUpperCase();
    const unidad = /^(\d+)(gb|tb|mb|w|hz|mhz)$/.exec(m);
    if (unidad) return unidad[1] + { gb: "GB", tb: "TB", mb: "MB", w: "W", hz: "Hz", mhz: "MHz" }[unidad[2]];
    return p;
  });
  const t = palabras.join(" ");
  // «iPad» y las demas del diccionario ya vienen escritas como van
  return /^[a-zà-ÿ]/.test(t) && !PALABRAS[t.split(" ")[0].toLowerCase()] ? t[0].toUpperCase() + t.slice(1) : t;
}

/* Lo que Analisis necesita de la "pagina": la busqueda sobre el indice, comercios y marcas. */
function crearContexto(idx, { baseUrl = BASE_URL, ahora = new Date(), marcas = {} } = {}) {
  const nombres = idx.productos.map(f => B.normalBusq(f[0]));
  const otras = new Map();     // fila mas barata de un producto -> las demas tiendas con el mismo codigo
  const marcasRe = B.armarMarcasRe([...(marcas.primera || []), ...(marcas.conocida || [])]);
  return {
    idx, baseUrl, ahora,
    otras,
    buscarTodo: q => {
      const c = B.filtroDe(q);
      if (!c) return [];
      const comercio = f => f[4] || (idx.tiendas[f[3]] || {}).nombre || f[3];
      const g = B.agruparPorModelo(B.unaPorUrl(idx.productos.filter((f, i) => c(nombres[i]))), comercio);
      for (const [f, resto] of g.otras) otras.set(f, resto);
      return g.filas;
    },
    comercioDe: f => f[4] || (idx.tiendas[f[3]] || {}).nombre || f[3],
    // el mismo modelo en las otras tiendas y la fecha real del precio de cada aviso (para "Precio por tienda")
    otrasDe: f => otras.get(f) || [],
    fechaDe: f => P.precioFecha((idx.tiendas[f[3]] || {}).relevado, idx.generado),
    colorDe: f => (idx.tiendas[f[3]] || {}).color || "fh",
    marcaDe: nombre => B.marcaDe(nombre, marcasRe),
    nivelMarca: B.crearNivelMarca(marcas),
    pesos,
  };
}

const esIndexable = analisis => !!analisis && analisis.base.length >= MIN_COMPARABLES && analisis.comercios.length >= MIN_COMERCIOS;

/* Los comparables en el orden de la pagina: primero lo que da el modo Recomendacion de la busqueda (precio-calidad, de
   menor a mayor precio) y despues el resto, en el mismo orden: la pagina estatica no esconde ningun comparable, que si
   cuenta para el rango y la mediana. La pagina y su feed.xml leen esta misma lista. */
function filasOrdenadas(analisis, ctx) {
  const comparables = analisis.base.map(m => m.f);
  const cm = ctx.modos || (ctx.modos = Modos.preparar(ctx.idx, ctx.nivelMarca));
  const recomendadas = new Set(Modos.filtrar(comparables, "recomendacion", cm, analisis.med));
  return [...Modos.ordenar(comparables.filter(f => recomendadas.has(f)), "precio", cm),
          ...Modos.ordenar(comparables.filter(f => !recomendadas.has(f)), "precio", cm)];
}

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

/* Las otras tiendas que venden el MISMO modelo (mismo codigo exacto), con su precio y enlace. */
function tambienEn(f, ctx) {
  const resto = (ctx.otras && ctx.otras.get(f)) || [];
  if (!resto.length) return "";
  const links = resto.map(o => {
    const txt = `${esc(ctx.comercioDe(o))} ${pesos(o[1])}`;
    if (!esUrl(o[2])) return txt;
    const t = tienda(o[2]);
    return `<a href="${t.href}" target="_blank" rel="${t.rel}" data-rubro="${esc(B.categoriaDe(o[0]) || "otro")}">${txt}</a>${t.sello}`;
  });
  return `<span class="mismo">También en ${links.join(" · ")}</span>`;
}

/* Seccion "Precio por tienda": para cada opcion que lidera (mejor compra, mas barata...), el mismo modelo en cada tienda
   con el porcentaje contra la mas barata y lo que se ahorra contra la mas cara. Misma tabla que la Comparativa. */
function enlaceTienda(f, texto, etiqueta) {
  if (!esUrl(f[2])) return "—";
  const t = tienda(f[2]);
  return `<a href="${t.href}" target="_blank" rel="${t.rel}" aria-label="${esc(etiqueta)}" data-rubro="${esc(B.categoriaDe(f[0]) || "otro")}">${texto}</a>${t.sello}`;
}
function precioPorTiendaHtml(analisis, ctx) {
  const h = { esc, pesos, enlace: enlaceTienda };
  const hay = analisis.picks.some(p => p.porTienda && !p.porTienda.unico);
  // Si ninguna opcion esta en mas de un comercio no se repite la misma nota cuatro veces: una sola frase.
  const bloques = hay ? analisis.picks.filter(p => p.porTienda).map(p =>
    `    <h3>${esc(p.rol)}: ${esc(p.m.f[0])}</h3>\n    ${A.tablaTiendasHtml(p.porTienda, { ...h, titulo: `${p.rol}: ${p.m.f[0]}` })}`).join("\n")
    : `    <p class="sub pt-nota">Estas opciones están cada una en un solo comercio: no hay con qué comparar.</p>`;
  return `  <section>
    <h2>Precio por tienda</h2>
    <p class="sub">El mismo modelo en cada tienda, con cuánto más cuesta contra la más barata y la fecha de cada precio. Solo se comparan avisos del mismo modelo y la misma variante; varios avisos de una tienda cuentan como una.</p>
${bloques}
  </section>
`;
}

function filaHtml(f, ctx) {
  const nombre = (esUrl(f[2])
    ? `<a href="${tienda(f[2]).href}" target="_blank" rel="${tienda(f[2]).rel}" data-rubro="${esc(B.categoriaDe(f[0]) || "otro")}">${esc(f[0])}</a>${tienda(f[2]).sello}`
    : esc(f[0])) + tambienEn(f, ctx);
  return `<tr data-op><td>${nombre}</td>` +
    `<td>${esc(ctx.comercioDe(f))}</td><td class="num">${pesos(f[1])}</td><td>${sellosHtml(f, ctx)}</td></tr>`;
}

/* JSON para meter en un <script>: el "<" va escapado para que ningun texto cierre la etiqueta. */
const jsonLd = obj => JSON.stringify(obj).replace(/</g, "\\u003c");

/* Mide el clic hacia una tienda con la misma analitica que el sitio (GoatCounter, sin cookies).
   Si el script de GoatCounter no cargo, el clic sigue su camino sin avisar. */
/* Inicia js/app.js: service worker y aviso de sin conexion con la fecha de los precios de la pagina. */
const scriptApp = (generado, rel) =>
  `App.iniciar(window, document, { sw: "${rel}sw.js", sonda: "${rel}manifest.webmanifest", generado: () => ${jsonLd(generado)} });`;

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
  // La Pichincha no vende: un Product con Offer por tienda es, para Google, una "ficha de comerciante"
  // (exige imagen, envio y devoluciones, que no tenemos). Cada item es un ListItem con nombre y enlace,
  // que es lo que pide el carrusel; el unico precio que se declara es el rango de la comparacion.
  // Un precio que no se pudo verificar hoy lo dice tambien aca, no solo en la pagina (FR-017).
  const listados = filas.filter(f => esUrl(f[2])).slice(0, MAX_FILAS);
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "ItemList", name: `${rotulo(consulta.q)}: precios en Argentina`, numberOfItems: listados.length,
      itemListElement: listados.map((f, i) => ({ "@type": "ListItem", position: i + 1, name: f[0], url: f[2],
        ...(viejoDe(f, ctx) ? { description: viejoDe(f, ctx) } : {}) })) },
    { "@type": "Product", name: rotulo(consulta.q), image: `${base}/img/og.png`, url: canonica,
      offers: { "@type": "AggregateOffer", lowPrice: desde, highPrice: hasta, offerCount: filas.length, priceCurrency: "ARS" } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "La Pichincha", item: `${base}/` },
      { "@type": "ListItem", position: 2, name: "Precios", item: `${base}/precios/` },
      { "@type": "ListItem", position: 3, name: rotulo(consulta.q), item: canonica } ] },
  ] };
}

function cabeza({ titulo, descripcion, canonica, noindex, baseUrl, grafo, feed, rel = "../../" }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${SITIO.csp}">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<link rel="canonical" href="${esc(canonica)}">
<link rel="alternate" type="application/rss+xml" title="Ofertas de La Pichincha" href="${esc(baseUrl)}/ofertas.xml">
${feed ? `<link rel="alternate" type="application/rss+xml" title="${esc(feed.titulo)}" href="${esc(feed.href)}">
` : ""}${noindex ? '<meta name="robots" content="noindex,follow">\n' : ""}<meta property="og:type" content="website">
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
<link rel="icon" type="image/png" href="${rel}img/icono-192.png">
<link rel="apple-touch-icon" href="${rel}img/apple-touch-icon.png">
<meta name="theme-color" content="#0b4fd8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e1117" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=optional" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=optional"></noscript>
<link rel="stylesheet" href="${rel}css/sitio.css">
<script id="gc" data-goatcounter="https://mescudero.goatcounter.com/count" async src="https://gc.zgo.at/count.v4.js" integrity="sha384-nRw6qfbWyJha9LhsOtSb2YJDyZdKvvCFh0fJYlkquSFjUxp9FVNugbfy8q1jdxI+" crossorigin="anonymous"></script>
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
.wrap h3{font-size:.95rem;margin:18px 0 8px}
.wrap .mismo{display:block;margin-top:4px;font-size:.78rem;color:var(--ink-3)}
.wrap ul.relacionadas{display:flex;flex-wrap:wrap;gap:8px 14px;list-style:none;padding:0;margin:0}
</style>
</head>`;
}

// Las fuentes salen del indice: sumar una tienda no obliga a tocar este texto.
const listaDeFuentes = tiendas => {
  const n = Object.values(tiendas || {}).map(t => t.nombre).filter(Boolean);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}` : n.join("");
};

function pie(ctx) {
  return `<p class="nota">Precios con IVA y sin envío, tomados de ${esc(listaDeFuentes(ctx.idx.tiendas))}. ` +
    `El stock y los precios de hardware se mueven rápido: confirmá antes de pagar. ` +
    `<a href="../../">Volver a La Pichincha</a> · <a href="../../estado/">Estado de las fuentes</a> · <a href="../../legal/">Términos y privacidad</a> · <a href="../../contacto/">Contacto</a>.</p>`;
}

/* Otras paginas del mismo rubro (squirrelscan, 24/10: 24 paginas de /precios/ solo tenian un enlace interno, al indice). */
const MAX_RELACIONADAS = 8;
function relacionadasHtml(lista) {
  if (!lista || !lista.length) return "";
  return `  <section>
    <h2>Búsquedas relacionadas</h2>
    <ul class="relacionadas">${lista.map(r => `<li><a href="../${esc(r.slug)}/">${esc(rotulo(r.q))}</a></li>`).join("")}</ul>
  </section>
`;
}

/* Las relacionadas de cada pagina indexable: sus vecinas de grupo (las que siguen y las que preceden, en ronda), y si no
   alcanzan, las que siguen en la lista entera; hasta MAX_RELACIONADAS. En ronda, cada pagina recibe enlaces de sus
   vecinas: con «las primeras del grupo» casi todas quedaban sin enlaces entrantes. */
function vecinas(lista, i, n) {
  const fuera = [];
  for (let d = 1; fuera.length < n && d < lista.length; d++) {
    fuera.push(lista[(i + d) % lista.length]);
    if (fuera.length < n && lista.length - d > d) fuera.push(lista[(i - d + lista.length) % lista.length]);
  }
  return [...new Set(fuera)];
}
function relacionadas(entradas, slug) {
  const propia = entradas.find(e => e.slug === slug);
  if (!propia) return [];
  const grupo = entradas.filter(e => e.grupo === propia.grupo);
  const elegidas = vecinas(grupo, grupo.indexOf(propia), MAX_RELACIONADAS);
  if (elegidas.length < MAX_RELACIONADAS) {
    const resto = entradas.filter(e => e === propia || e.grupo !== propia.grupo);
    elegidas.push(...vecinas(resto, resto.indexOf(propia), MAX_RELACIONADAS - elegidas.length));
  }
  return elegidas.map(e => ({ q: e.q, slug: e.slug }));
}

/* Pagina de una consulta. consulta = { q, slug, relacionadas? }; analisis = Analisis.analizarConsulta o null. */
function renderPagina(consulta, analisis, ctx) {
  const { q, slug } = consulta;
  const nom = rotulo(q);
  const canonica = `${ctx.baseUrl}/precios/${slug}/`;
  const cuando = P.fechaHora(ctx.idx.generado);   // fija: la pagina queda escrita
  const interactiva = P.armarUrl("../../", q, "comparativa");
  const filtrable = P.armarUrl("../../", q, "buscar");   // los filtros viven en la busqueda (specs/008-filtros, FR-007)

  if (!esIndexable(analisis)) {
    const buscador = P.armarUrl("../../", q, "buscar");
    return cabeza({ titulo: `${nom}: precios en Argentina | La Pichincha`,
      descripcion: `Hoy no hay opciones suficientes de ${nom} para comparar. Probá el buscador de La Pichincha.`,
      canonica, noindex: true, baseUrl: ctx.baseUrl }) + `
<body>
<div id="sin-red" class="sin-red" role="status" hidden></div>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap">
  <p class="meta">La Pichincha · precios del ${esc(cuando)}</p>
  <h1>${esc(nom)}: hoy no hay opciones suficientes</h1>
  <p class="sub">${analisis && analisis.base.length >= MIN_COMPARABLES
    ? `Hoy las opciones comparables de «${esc(nom)}» están en un solo comercio (${esc(analisis.comercios[0] ? analisis.comercios[0].nom : "")}), así que no hay con qué comparar.`
    : `Encontramos menos de ${MIN_COMPARABLES} opciones comparables de «${esc(nom)}» en las tiendas que seguimos, así que todavía no armamos la comparación.`} Probá con el buscador, que mira todos los avisos.</p>
  <p><a class="acc" href="${esc(buscador)}">Buscar «${esc(nom)}» en La Pichincha</a></p>
  ${pie(ctx)}
</main>
<script src="../../js/pagina.js"></script>
<script src="../../js/app.js"></script>
<script>${scriptApp(ctx.idx.generado, "../../")}</script>
<script>${SCRIPT_MEDICION}</script>
</body>
</html>
`;
  }

  const comparables = analisis.base.map(m => m.f);
  const filas = filasOrdenadas(analisis, ctx);
  const mostrar = filas.slice(0, MAX_FILAS);
  const resto = filas.length - mostrar.length;
  const precios = comparables.map(f => f[1]);   // el rango es el de todo lo comparable, no solo de lo recomendado
  const desde = Math.min(...precios), hasta = Math.max(...precios);
  const mejor = analisis.picks[0].m.f;
  const comercios = analisis.comercios.length;
  const afuera = A.partesExclusion(analisis.excl);
  const intl = analisis.internacionales.map(m => m.f).sort((a, b) => a[1] - b[1]).slice(0, MAX_INTERNACIONALES);

  const avisos = filas.length + filas.reduce((n, f) => n + ((ctx.otras && ctx.otras.get(f)) || []).length, 0);
  const conteo = avisos > filas.length ? `${filas.length} productos en ${avisos} avisos` : `${filas.length} opciones`;

  const titulo = `${nom}: precios desde ${pesos(desde)} | La Pichincha`;
  const descripcion = `${conteo} de ${nom} en ${comercios === 1 ? "1 comercio" : `${comercios} comercios`}: desde ${pesos(desde)}, ` +
    `mediana ${pesos(analisis.med)}. Mejor compra y precios del ${cuando}.`;

  return cabeza({ titulo, descripcion, canonica, noindex: false, baseUrl: ctx.baseUrl,
    feed: { titulo: `Precios de ${nom} en La Pichincha`, href: `${canonica}${FEED_ARCHIVO}` },
    grafo: grafoDe(consulta, filas, analisis, ctx, desde, hasta) }) + `
<body>
<div id="sin-red" class="sin-red" role="status" hidden></div>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap">
  <p class="meta">La Pichincha · precios del ${esc(cuando)}</p>
  <h1>${esc(nom)}: precios y qué conviene comprar</h1>
  <p class="sub">Comparamos ${conteo} de «${esc(nom)}» en ${comercios} comercio${comercios > 1 ? "s" : ""}: de ${pesos(desde)} a ${pesos(hasta)}, con una mediana de ${pesos(analisis.med)}. Dejamos afuera lo que no es comparable.</p>

  <section class="panel">
    <h2>Mejor compra</h2>
    <p>${esUrl(mejor[2]) ? `<a href="${tienda(mejor[2]).href}" target="_blank" rel="${tienda(mejor[2]).rel}" data-rubro="${esc(B.categoriaDe(mejor[0]) || "otro")}"><b>${esc(mejor[0])}</b></a>${tienda(mejor[2]).sello}` : `<b>${esc(mejor[0])}</b>`} · ${esc(ctx.comercioDe(mejor))} · <b>${pesos(mejor[1])}</b> ${sellosHtml(mejor, ctx)}</p>
    <p class="sub">${esc(analisis.picks[0].razon)}</p>
  </section>

  <div class="tiles">
    <div class="tile"><div class="k">Mediana</div><div class="v">${pesos(analisis.med)}</div><div class="d">${filas.length} opciones comparables</div></div>
    <div class="tile"><div class="k">Desde</div><div class="v">${pesos(desde)}</div><div class="d">la opción más barata</div></div>
    <div class="tile"><div class="k">Comercios</div><div class="v">${comercios}</div><div class="d">con opciones comparables</div></div>
  </div>

${precioPorTiendaHtml(analisis, ctx)}
  <section>
    <h2>Opciones de ${esc(nom)}</h2>
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
    <div class="scroll"><table>
      <thead><tr><th>Producto</th><th>Comercio</th><th>Precio</th><th>Detalle</th></tr></thead>
      <tbody>
${intl.map(f => "      " + filaHtml(f, ctx).replace("<tr data-op>", "<tr>")).join("\n")}
    </tbody></table></div>
  </section>
` : ""}${afuera.length ? `  <p class="sub">Quedaron afuera ${esc(afuera.join(", "))}.</p>\n` : ""}${relacionadasHtml(consulta.relacionadas)}
  <p><a class="acc" href="${esc(interactiva)}">Ver la comparativa completa</a> <a class="acc" href="${esc(filtrable)}">Buscar y filtrar por tienda y precio</a></p>
  ${pie(ctx)}
</main>
<script src="../../js/pagina.js"></script>
<script src="../../js/app.js"></script>
<script>${scriptApp(ctx.idx.generado, "../../")}</script>
<script>${SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

const FEED_ARCHIVO = "feed.xml";
const MAX_FEED_PAGINA = 10;

/* feed.xml de una pagina (RSS 2.0): las mejores comparables de la consulta, la mejor compra primero y despues en el orden
   de la pagina. Sale del mismo analisis y la misma lista que la tabla, asi que nunca dice otra cosa que la pagina: solo
   avisos comparables (sin internacionales ni usados), con su precio, comercio y enlace a la tienda. Una pagina que no es
   indexable no tiene feed (devuelve null). El guid lleva el precio: el lector marca una entrada como nueva solo si cambio. */
function renderFeedPagina(consulta, analisis, ctx) {
  if (!esIndexable(analisis)) return null;
  const { q, slug } = consulta;
  const nom = rotulo(q);
  const canonica = `${ctx.baseUrl}/precios/${slug}/`;
  const fecha = new Date(ctx.idx.generado);
  const rfc = isNaN(fecha) ? new Date().toUTCString() : fecha.toUTCString();
  const cuando = P.fechaHora(ctx.idx.generado);
  const mejor = analisis.picks[0].m.f;
  const lista = [mejor, ...filasOrdenadas(analisis, ctx).filter(f => f !== mejor)].filter(f => esUrl(f[2])).slice(0, MAX_FEED_PAGINA);
  const items = lista.map(f => {
    const baja = f[6] > f[1] ? Math.round((1 - f[1] / f[6]) * 100) : 0;
    const titulo = `${f[0]}: ${pesos(f[1])}${baja ? ` (−${baja}%)` : ""} en ${ctx.comercioDe(f)}`;
    const desc = (f === mejor ? `Mejor compra. ${analisis.picks[0].razon} ` : "") +
      (baja ? `Antes ${pesos(f[6])}, hoy ${pesos(f[1])}. ` : "") +
      (viejoDe(f, ctx) ? `Ojo: ${viejoDe(f, ctx)}. ` : "") +
      `Precios del ${cuando}. Verificá en la tienda antes de comprar.`;   // la mediana ya va en la razon de la mejor compra
    return `    <item>
      <title>${esc(titulo)}</title>
      <link>${esc(f[2])}</link>
      <guid isPermaLink="false">${esc(f[2])}#${esc(f[1])}</guid>
      <pubDate>${rfc}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(`La Pichincha: ${nom}`)}</title>
    <link>${esc(canonica)}</link>
    <atom:link href="${esc(canonica + FEED_ARCHIVO)}" rel="self" type="application/rss+xml"/>
    <description>${esc(`Los mejores precios de ${nom} en tiendas de Argentina, con el precio, el comercio y el enlace a cada aviso.`)}</description>
    <language>es-AR</language>
    <lastBuildDate>${rfc}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>
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
  const cuando = P.fechaHora(ctx.idx.generado);   // fija: la pagina queda escrita
  const grafo = { "@context": "https://schema.org", "@graph": [
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "La Pichincha", item: `${ctx.baseUrl}/` },
      { "@type": "ListItem", position: 2, name: "Precios", item: canonica } ] },
  ] };
  const cuerpo = entradas.length ? [...grupos].map(([grupo, lista]) => `  <section>
    <h2>${esc(grupo)}</h2>
    <ul>
${lista.map(e => `      <li><a href="${esc(e.slug)}/">${esc(rotulo(e.q))}</a> <span class="sub">desde ${pesos(e.desde)} · ${e.comparables} opciones</span></li>`).join("\n")}
    </ul>
  </section>`).join("\n")
    : `  <p class="sub">Todavía no hay páginas de precios con opciones suficientes. Probá el <a href="../">buscador</a>.</p>`;
  return cabeza({ titulo: "Precios de hardware en Argentina | La Pichincha",
    descripcion: `Precios de hardware en Argentina comparados en varias tiendas: placas de video, monitores, memorias, SSD y más. Precios del ${cuando}.`,
    canonica, noindex: false, baseUrl: ctx.baseUrl, grafo, rel: "../" }) + `
<body>
<div id="sin-red" class="sin-red" role="status" hidden></div>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap">
  <p class="meta">La Pichincha · precios del ${esc(cuando)}</p>
  <h1>Precios de hardware en Argentina</h1>
  <p class="sub">Lo que se busca más, con el precio de hoy en varias tiendas, la mediana y qué conviene comprar. Cada página sale del mismo análisis que la comparativa de <a href="../">La Pichincha</a>.</p>
${cuerpo}
  <p class="nota">Precios con IVA y sin envío. <a href="../">Volver a La Pichincha</a>.</p>
</main>
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
  // Primero el analisis de todas, para que cada pagina enlace a sus relacionadas indexables.
  const analizadas = consultas.map(c => ({ c, analisis: A.analizarConsulta(c.q, ctx) }));
  for (const { c, analisis } of analizadas) {
    const indexable = esIndexable(analisis);
    paginas.push({ slug: c.slug, q: c.q, indexable });
    if (indexable) entradas.push({ q: c.q, slug: c.slug, grupo: (c.nota || "").split(":")[0] || "Otros",
      desde: Math.min(...analisis.base.map(m => m.f[1])), comparables: analisis.base.length });
  }
  for (const { c, analisis } of analizadas) {
    const dir = path.join(salida, "precios", c.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderPagina({ ...c, relacionadas: relacionadas(entradas, c.slug) }, analisis, ctx), "utf8");
    const feed = renderFeedPagina(c, analisis, ctx);
    if (feed) fs.writeFileSync(path.join(dir, FEED_ARCHIVO), feed, "utf8");
  }
  fs.mkdirSync(path.join(salida, "precios"), { recursive: true });
  fs.writeFileSync(path.join(salida, "precios", "index.html"), renderIndice(entradas, ctx), "utf8");
  const manifiesto = arg("manifiesto");                  // lo lee generar_paginas.py para el mapa del sitio
  if (manifiesto) fs.writeFileSync(manifiesto, JSON.stringify({ generado: idx.generado, paginas }), "utf8");
  console.log(`${consultas.length} paginas generadas, ${entradas.length} indexables`);
  return 0;
}

module.exports = { rotulo, crearContexto, renderPagina, renderFeedPagina, renderIndice, main, esIndexable, relacionadas, esc, pesos, cabeza, SCRIPT_MEDICION, BASE_URL, MIN_COMPARABLES, MIN_COMERCIOS, MAX_RELACIONADAS };
if (require.main === module) process.exit(main(process.argv.slice(2)));
