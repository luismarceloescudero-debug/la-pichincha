#!/usr/bin/env node
/* La imagen de vista previa de /hoy/ (spec 059): hoy/og.png, 1200x630, con el lenguaje del Reel v4 (paleta «neon»). Es la
   que Telegram muestra en grande debajo del mensaje de las Pichinchas del dia (y WhatsApp o X al compartir /hoy/).

Uso:
    node generar_vista_hoy.js _sitio/ofertas.json [--salida _sitio] [--chrome RUTA] [--solo-html]

Arma la pagina (fuera del sitio, en una carpeta temporal), le saca una captura con Chrome sin ventana y, si salio bien,
apunta el og:image y el twitter:image de _sitio/hoy/index.html a hoy/og.png?v=<version> (la version cambia con la lista,
asi Telegram no reusa la de ayer). Si no hay Chrome o la captura falla, /hoy/ queda con la imagen general del sitio y la
corrida sigue: nunca rompe la publicacion. No publica nada. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const T = require("./js/titulo.js");

const ANCHO = 1200, ALTO = 630;
const PISO_SUPER = 20;   // como en /hoy/ y el Reel: con menos, «La mejor del día»
const URL_FOTO = /^https:\/\/[^\s"'()<>\\]+$/;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const miles = n => Math.round(n).toLocaleString("es-AR").replace(/,/g, ".");

/* La version de la imagen: cambia si cambia la lista (otra oferta, otro precio). */
const version = texto => crypto.createHash("sha1").update(texto).digest("hex").slice(0, 10);

/* La super oferta: la de mayor descuento (la primera si empatan). */
const mejorDe = ofertas => ofertas.reduce((m, o, i) => (m < 0 || (+o.descuento || 0) > (+ofertas[m].descuento || 0) ? i : m), -1);

/* El nombre como en /hoy/: tipo (rosa) si hace falta, marca (celeste) y modelo. Con un ofertas.json viejo, desde el nombre. */
function nombre(o) {
  const t = T.de(o.nombre), titulo = o.titulo || t.titulo, prefijo = o.titulo ? (o.prefijo || "") : t.prefijo;
  const corte = titulo.indexOf(" ");
  const marca = corte < 0 ? titulo : titulo.slice(0, corte), resto = corte < 0 ? "" : titulo.slice(corte);
  return `${prefijo ? `<span class="tipo">${esc(prefijo)}</span> ` : ""}<span class="marca">${esc(marca)}</span>${esc(resto)}`;
}

const pct = o => (+o.descuento > 0 && !o.sinRebaja)
  ? `<span class="sig">−</span><span class="num">${+o.descuento}</span><span class="por">%</span>` : "";

/* La pagina de la imagen. Todo el texto de terceros va escapado; la foto solo si es https limpia. */
function paginaVista(datos) {
  const ofertas = datos.ofertas || [];
  const fecha = String(datos.generado || "");
  const dia = fecha.length >= 10 ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : "";
  const sitio = String(datos.sitio || "").replace(/^https?:\/\//, "").replace(/\/$/, "") + "/hoy";
  const s = mejorDe(ofertas), sup = ofertas[s];
  const resto = ofertas.filter((o, i) => i !== s).slice(0, 3);
  const tipo = sup ? (sup.icono || T.de(sup.nombre).tipo) : "otro";
  const icono = T.svg(tipo, "ico");
  const foto = sup && URL_FOTO.test(sup.imagen || "") ? sup.imagen : "";
  const chips = sup ? (sup.chips || T.de(sup.nombre).chips).slice(0, 4) : [];
  const antes = sup && !sup.sinRebaja && sup.antes && !sup.contra ? `<s>$${miles(sup.antes)}</s>` : "";
  const contra = sup && sup.contra ? `<span class="contra">${esc(sup.contra)}</span>` : "";
  const tarjeta = sup ? `<div class="tarjeta">
  <p class="cinta">★ ${+sup.descuento >= PISO_SUPER ? "SÚPER OFERTA" : "LA MEJOR DEL DÍA"} ★</p>
  <div class="cuerpo">
    <div class="arriba"><p class="pct">${pct(sup)}</p>
      <div class="caja">${foto ? `<img src="${esc(foto)}" alt="" onerror="this.remove()">` : ""}${icono}</div></div>
    <h1>${nombre(sup)}</h1>
    ${chips.length ? `<p class="chips">${chips.map(c => `<span${T.premium(c) ? ' class="pr">✦ ' : ">"}${esc(c)}</span>`).join("")}</p>` : ""}
    <p class="precio"><span class="ahora"><span class="sig">$</span>${miles(sup.precio)}</span>${antes}</p>
    <p class="tienda">en <b>${esc(sup.comercio)}</b>${contra ? " · " + contra : ""}</p>
  </div>
</div>` : `<div class="tarjeta vacia"><p class="cinta">★ PICHINCHAS DEL DÍA ★</p><h1>Hoy no hay bajas para destacar</h1></div>`;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Pichinchas del día ${esc(dia)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Source+Sans+3:wght@600;700&family=Roboto+Mono:wght@700&display=block">
<style>
:root{--fondo:#120018;--fondo2:#3b0a57;--tinta:#fff4ff;--suave:#d7b8e6;--amarillo:#ffd23f;--celeste:#3ee6ff;--rosa:#ff5fae;
  --tarjeta:#26063b;--tarjeta2:#0c1446;--tachado:#ff7eb6;--tit:"Oswald","Arial Narrow",sans-serif;--txt:"Source Sans 3",sans-serif;--mono:"Roboto Mono",monospace}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${ANCHO}px;height:${ALTO}px;overflow:hidden}
body{font-family:var(--txt);color:var(--tinta);position:relative;
  background:repeating-linear-gradient(-45deg,rgba(215,184,230,.13) 0 3px,transparent 3px 44px),radial-gradient(110% 90% at 30% 40%,var(--fondo2),var(--fondo) 75%)}
.sig{color:var(--rosa)} .num{color:var(--amarillo)} .por{color:var(--celeste);font-size:.82em}
.tarjeta{position:absolute;left:36px;top:34px;width:712px;height:562px;border-radius:34px;overflow:hidden;border:4px solid var(--rosa);
  box-shadow:0 0 50px rgba(255,95,174,.5);background:linear-gradient(165deg,var(--tarjeta),var(--tarjeta2));display:flex;flex-direction:column}
.cinta{flex:none;height:58px;display:flex;align-items:center;justify-content:center;font:700 34px/1 var(--tit);letter-spacing:.16em;color:var(--fondo);
  background:linear-gradient(90deg,var(--rosa),var(--celeste),var(--rosa))}
.cuerpo{flex:1;min-height:0;display:flex;flex-direction:column;padding:18px 34px 22px}
.arriba{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.pct{font:700 148px/.84 var(--tit);letter-spacing:-.02em;white-space:nowrap;text-shadow:0 6px 30px rgba(18,0,24,.6)}
.caja{flex:none;width:150px;height:150px;border-radius:30px;background:#fff;display:grid;place-items:center;overflow:hidden;color:var(--fondo2);
  box-shadow:0 14px 40px rgba(0,0,0,.4);position:relative}
.caja img{position:absolute;inset:14px;width:calc(100% - 28px);height:calc(100% - 28px);object-fit:contain;background:#fff}
.caja .ico{width:96px;height:96px}
h1{margin-top:14px;font:700 54px/1 var(--tit);text-transform:uppercase;letter-spacing:-.005em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tipo{color:var(--rosa)} .marca{color:var(--celeste)}
.chips{margin-top:12px;display:flex;flex-wrap:wrap;gap:10px;max-height:44px;overflow:hidden}
.chips span{padding:3px 16px 5px;border-radius:999px;font:700 26px/1.2 var(--txt);color:var(--celeste);background:rgba(62,230,255,.12);border:3px solid rgba(62,230,255,.6)}
.chips span.pr{color:var(--fondo);border-color:transparent;background:linear-gradient(90deg,var(--rosa),var(--celeste))}
.precio{margin-top:auto;display:flex;align-items:baseline;gap:22px;white-space:nowrap}
.ahora{font:700 118px/.88 var(--tit);letter-spacing:-.01em;color:var(--amarillo)}
.precio s{font:700 34px var(--mono);color:var(--suave);text-decoration-color:var(--tachado);text-decoration-thickness:5px}
.tienda{margin-top:10px;font:600 30px/1.2 var(--txt);color:var(--suave);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tienda b{color:var(--celeste)}
.vacia h1{margin:60px 40px;font-size:70px}
.der{position:absolute;left:784px;right:36px;top:34px;bottom:34px;display:flex;flex-direction:column}
.marcaS{display:flex;justify-content:space-between;font:700 22px var(--mono);letter-spacing:.1em;color:var(--amarillo)}
.marcaS span+span{color:var(--celeste)}
h2{margin-top:8px;font:700 62px/.92 var(--tit);text-transform:uppercase}
h2 span{display:block;color:var(--celeste)}
.otras{list-style:none;margin-top:14px;display:flex;flex-direction:column;gap:10px}
.otras li{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:18px;background:linear-gradient(165deg,var(--tarjeta),var(--tarjeta2));border:2px solid rgba(62,230,255,.45)}
.otras .p{flex:none;width:96px;font:700 40px/.9 var(--tit);white-space:nowrap;text-align:right}
.otras .t{min-width:0;display:flex;flex-direction:column;gap:4px}
.otras .n{font:700 22px/1.05 var(--tit);text-transform:uppercase;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.otras .v{font:700 28px/1 var(--tit);color:var(--amarillo)} .otras .v .sig{color:var(--rosa)}
.pie{margin-top:auto;font:600 21px/1.3 var(--txt);color:var(--suave)}
.pie b{display:block;font:700 22px var(--mono);color:var(--amarillo)}
</style></head>
<body>
${tarjeta}
<div class="der">
  <p class="marcaS"><span>LA PICHINCHA</span><span>HOY ${esc(dia)}</span></p>
  <h2>Pichinchas <span>del día</span></h2>
  ${resto.length ? `<ul class="otras">${resto.map(o => `<li><span class="p">${pct(o)}</span><span class="t"><span class="n">${nombre(o)}</span><span class="v"><span class="sig">$</span>${miles(o.precio)}</span></span></li>`).join("")}</ul>` : ""}
  <p class="pie">${ofertas.length > 1 ? `Las ${ofertas.length}, con su link en` : "Con su link en"}<b>${esc(sitio)}</b></p>
</div>
<script>
// El precio va lo mas grande que entra en la tarjeta (un precio de 9 cifras es mas ancho que uno de 5).
const ah = document.querySelector(".ahora"), pr = document.querySelector(".precio");
if (ah && pr) { let f = 118; while (pr.scrollWidth > pr.clientWidth && f > 60) ah.style.fontSize = (f -= 4) + "px"; }
</script>
</body></html>
`;
}

/* /hoy/ apuntando a su imagen: og:image y twitter:image (antes, la general del sitio) con su tamaño y texto alternativo. */
function conVista(html, url, alt) {
  const tag = /<meta property="og:image" content="[^"]*">/;
  if (!tag.test(html)) return html;
  return html.replace(tag, `<meta property="og:image" content="${esc(url)}">\n<meta property="og:image:width" content="${ANCHO}">\n` +
      `<meta property="og:image:height" content="${ALTO}">\n<meta property="og:image:alt" content="${esc(alt)}">`)
    .replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(url)}">`);
}

/* Chrome o Chromium: el de --chrome, el de $CHROME, o el primero que aparezca. */
function buscarChrome(pedido) {
  const candidatos = [pedido, process.env.CHROME, "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].filter(Boolean);
  for (const c of candidatos) {
    try { if (path.isAbsolute(c) ? fs.existsSync(c) : execFileSync("which", [c], { stdio: "pipe" }).length) return c; } catch (e) { /* sigue */ }
  }
  return "";
}

function capturar(chrome, html, png) {
  execFileSync(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    `--window-size=${ANCHO},${ALTO}`, "--virtual-time-budget=10000", `--screenshot=${path.resolve(png)}`, require("url").pathToFileURL(html).href],
    { stdio: "pipe", timeout: 90000 });
}

function main(argv) {
  const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
  const ruta = argv[0] && !argv[0].startsWith("--") ? argv[0] : "_sitio/ofertas.json";
  const salida = arg("salida", path.dirname(ruta));
  let texto;
  try { texto = fs.readFileSync(ruta, "utf8"); } catch (e) { console.log(`::warning::No hay ${ruta}: /hoy/ queda con la imagen general`); return 0; }
  const datos = JSON.parse(texto);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vista-hoy-"));
  const html = path.join(tmp, "vista.html");
  fs.writeFileSync(html, paginaVista(datos), "utf8");
  if (argv.includes("--solo-html")) { console.log(html); return 0; }
  const chrome = buscarChrome(arg("chrome", ""));
  if (!chrome) { console.log("::warning::Sin Chrome: /hoy/ queda con la imagen general del sitio"); return 0; }
  const png = path.join(salida, "hoy", "og.png");
  fs.mkdirSync(path.dirname(png), { recursive: true });
  try { capturar(chrome, html, png); } catch (e) { /* se mira abajo si quedo la imagen */ }
  if (!fs.existsSync(png) || fs.statSync(png).size < 10000) {
    try { fs.rmSync(png, { force: true }); } catch (e) { /* nada */ }
    console.log("::warning::No se pudo sacar la imagen de /hoy/: queda la imagen general del sitio");
    return 0;
  }
  const pagina = path.join(salida, "hoy", "index.html");
  const base = String(datos.sitio || "").replace(/\/?$/, "/");
  const sup = (datos.ofertas || [])[mejorDe(datos.ofertas || [])];
  const alt = sup ? `Pichinchas del día: ${sup.titulo || sup.nombre} a $${miles(sup.precio)}${+sup.descuento > 0 ? `, −${sup.descuento} %` : ""}, en ${sup.comercio}`
    : "Pichinchas del día";
  if (fs.existsSync(pagina)) fs.writeFileSync(pagina, conVista(fs.readFileSync(pagina, "utf8"), `${base}hoy/og.png?v=${version(texto)}`, alt), "utf8");
  console.log(`imagen de /hoy/: ${png} (${Math.round(fs.statSync(png).size / 1024)} KB)`);
  return 0;
}

module.exports = { paginaVista, conVista, version, mejorDe, main, ANCHO, ALTO };
if (require.main === module) process.exit(main(process.argv.slice(2)));
