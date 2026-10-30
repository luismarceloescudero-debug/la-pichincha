#!/usr/bin/env node
/* El Reel de las Pichinchas del dia (spec 045): un video vertical 1080x1920 con las 10 ofertas de ofertas.json.

Uso:
    node generar_reel.js _sitio/ofertas.json [--salida _sitio] [--fps 30] [--chrome RUTA] [--solo-html]

Arma una pagina (instagram/reel-AAAA-MM-DD.html) que se pinta en funcion del tiempo (`pintar(ms)`), la abre en Chrome
sin interfaz, saca un cuadro por cada 1/fps de segundo por el protocolo de DevTools (el WebSocket de Node 22+, sin
dependencias) y los une con ffmpeg en instagram/AAAA-MM-DD.mp4 (H.264 + audio AAC mudo, lo que pide Instagram para
un Reel), mas la portada instagram/AAAA-MM-DD-portada.jpg.

Formato: 9:16 (1080x1920) es lo que Instagram muestra entero en Reels e historias. Lo importante queda en la franja
del medio (y 250-1500): arriba y abajo van los controles de Instagram, y la grilla del perfil recorta a 3:4.
Cada dia cambian la paleta, la tipografia, el ritmo, el fondo, la transicion y la disposicion (`estilo`), siempre con
contraste para leerse en el celular. De fondo va la foto del producto (la de la tienda, desenfocada) y, nitida, en la tarjeta.

No publica nada: solo arma el archivo. Publicarlo es del job de Instagram (PR #126), que espera el OK del dueño. */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const T = require("./js/titulo.js");

const ANCHO = 1080, ALTO = 1920;
// El ritmo «normal»; cada dia elige uno de RITMOS.
const MS = { intro: 2200, oferta: 1700, cierre: 3000 };
const RITMOS = [
  { nombre: "agil", intro: 1900, oferta: 1450, cierre: 2600 },
  { nombre: "normal", ...MS },
  { nombre: "pausado", intro: 2400, oferta: 2050, cierre: 3200 },
];
// Juegos de letras de Google Fonts con acentos y ñ: titulo (condensada o de impacto), texto y numeros (monoespaciada).
// `escala` iguala el ancho: una letra ancha (Archivo Black) va mas chica para que el nombre entre en tres lineas.
const LETRAS = [
  { nombre: "plex", titulo: "IBM Plex Sans Condensed", peso: 700, texto: "IBM Plex Sans", mono: "IBM Plex Mono", escala: 1 },
  { nombre: "bebas", titulo: "Bebas Neue", peso: 400, texto: "Inter", mono: "JetBrains Mono", escala: 1.12 },
  { nombre: "anton", titulo: "Anton", peso: 400, texto: "Work Sans", mono: "Space Mono", escala: 0.92 },
  { nombre: "archivo", titulo: "Archivo Black", peso: 400, texto: "Archivo", mono: "DM Mono", escala: 0.78 },
  { nombre: "oswald", titulo: "Oswald", peso: 700, texto: "Source Sans 3", mono: "Roboto Mono", escala: 0.95 },
  { nombre: "barlow", titulo: "Barlow Condensed", peso: 800, texto: "Barlow", mono: "IBM Plex Mono", escala: 1.05 },
];
const DISPOSICIONES = ["tarjeta", "plena"];

/* --- El estilo del dia ------------------------------------------------------- */
// Paletas con contraste AA para texto grande sobre su fondo (tinta sobre fondo, acento sobre fondo).
const PALETAS = [
  { nombre: "noche", fondo: "#0b1020", fondo2: "#1a2a6c", tinta: "#f5f7ff", suave: "#aab4d6", acento: "#5ee7a0", chip: "#22305e", tachado: "#ff8a8a" },
  { nombre: "papel", fondo: "#fbf6ec", fondo2: "#f0e3c8", tinta: "#1d1a16", suave: "#5e5548", acento: "#c2410c", chip: "#efe2c6", tachado: "#9f1239" },
  { nombre: "neon", fondo: "#120018", fondo2: "#3b0a57", tinta: "#fff4ff", suave: "#d7b8e6", acento: "#ffd23f", chip: "#43105f", tachado: "#ff7eb6" },
  { nombre: "pizarra", fondo: "#0f1f1a", fondo2: "#1e4d3f", tinta: "#effaf5", suave: "#a7cfc0", acento: "#ffb347", chip: "#21463a", tachado: "#ff9b85" },
  { nombre: "cielo", fondo: "#eaf3ff", fondo2: "#bcd8ff", tinta: "#0b1b33", suave: "#3f5675", acento: "#0b4fd8", chip: "#d3e5ff", tachado: "#b42318" },
  { nombre: "atardecer", fondo: "#2a0f12", fondo2: "#7a2e1f", tinta: "#fff3ea", suave: "#f0c7b0", acento: "#ffd166", chip: "#5a2420", tachado: "#ffb4a2" },
];
const FONDOS = ["grilla", "rayas", "puntos"];
const TRANSICIONES = ["deslizar", "zoom", "cortina"];

/* El estilo de una fecha AAAA-MM-DD. Cada parte avanza con el dia a su propio paso, asi dos dias seguidos nunca se
   parecen y la misma fecha da siempre el mismo Reel. */
function estilo(fecha) {
  const d = new Date(fecha + "T12:00:00Z");
  const n = Math.floor((d - new Date(Date.UTC(d.getUTCFullYear(), 0, 0))) / 864e5) || 0;
  const de = (lista, salto) => lista[(n * salto) % lista.length];
  return { paleta: de(PALETAS, 1), letra: de(LETRAS, 5), ritmo: de(RITMOS, 1), fondo: de(FONDOS, 2),
    transicion: TRANSICIONES[Math.floor(n / 2) % TRANSICIONES.length], disposicion: de(DISPOSICIONES, 1) };
}

/* --- Los datos ----------------------------------------------------------------- */
const pesos = n => "$" + Math.round(n).toLocaleString("es-AR").replace(/,/g, ".");
const fechaDe = datos => String(datos.generado || "").slice(0, 10);

// La foto va en un src y en un url() de CSS: solo https, sin comillas, espacios ni parentesis.
const URL_FOTO = /^https:\/\/[^\s"'()<>\\]+$/;

/* Lo que pinta el Reel por oferta. Con un ofertas.json de antes de la spec 044 lo calcula desde el nombre. */
function ofertasReel(datos, max = 10) {
  return (datos.ofertas || []).slice(0, max).map(o => {
    const t = T.de(o.nombre);
    return { titulo: o.titulo || t.titulo, chips: o.chips || t.chips, icono: o.icono || t.tipo,
      precio: o.precio, antes: o.antes, descuento: o.descuento, comercio: o.comercio,
      contra: o.contra || "", imagen: URL_FOTO.test(o.imagen || "") ? o.imagen : "" };
  });
}

const duracion = (n, ritmo = MS) => ritmo.intro + n * ritmo.oferta + ritmo.cierre;

/* --- La pagina ----------------------------------------------------------------- */
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function paginaReel(datos, { sitio = "pichinchadeldia.com.ar/hoy" } = {}) {
  const fecha = fechaDe(datos);
  const est = estilo(fecha);
  const p = est.paleta;
  const ofertas = ofertasReel(datos);
  const iconos = Object.fromEntries([...new Set(ofertas.map(o => o.icono))].map(k => [k, T.ICONOS[k] || T.ICONOS.otro]));
  const dia = fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : "";
  // Los datos van como JSON dentro de un <script type="application/json">: se escapa «<» para que no cierre la etiqueta.
  const ms = { intro: est.ritmo.intro, oferta: est.ritmo.oferta, cierre: est.ritmo.cierre };
  const L = est.letra, fam = f => f.replace(/ /g, "+");
  const fuentes = `family=${fam(L.titulo)}:wght@${L.peso}&family=${fam(L.texto)}:wght@600;700;800&family=${fam(L.mono)}:wght@500;700`;
  const json = JSON.stringify({ ofertas, iconos, dia, sitio, ms, transicion: est.transicion }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=${ANCHO}">
<title>Reel ${escHtml(dia)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fuentes}&display=block">
<style>
:root{--f-tit:"${L.titulo}",sans-serif;--f-txt:"${L.texto}",sans-serif;--f-mono:"${L.mono}",monospace;--p-tit:${L.peso};--esc:${L.escala};
  --fondo:${p.fondo};--fondo2:${p.fondo2};--tinta:${p.tinta};--suave:${p.suave};--acento:${p.acento};--chip:${p.chip};--tachado:${p.tachado}}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${ANCHO}px;height:${ALTO}px;overflow:hidden;background:var(--fondo)}
body{font-family:var(--f-txt);color:var(--tinta)}
#esc{position:relative;width:${ANCHO}px;height:${ALTO}px;overflow:hidden;
  background:radial-gradient(120% 70% at 50% 35%,var(--fondo2),var(--fondo) 70%)}
.patron{position:absolute;inset:-80px;opacity:.16;will-change:transform}
.patron.grilla{background-image:linear-gradient(var(--suave) 2px,transparent 2px),linear-gradient(90deg,var(--suave) 2px,transparent 2px);background-size:90px 90px}
.patron.rayas{background-image:repeating-linear-gradient(-45deg,var(--suave) 0 3px,transparent 3px 46px)}
.patron.puntos{background-image:radial-gradient(var(--suave) 3.5px,transparent 4px);background-size:54px 54px}
section{position:absolute;inset:0;display:none}
/* Franja segura: y 250-1500 */
.marca{position:absolute;left:90px;right:90px;top:250px;display:flex;justify-content:space-between;align-items:center;
  font:700 34px var(--f-mono);letter-spacing:.12em;color:var(--acento)}
.barras{position:absolute;left:90px;right:90px;top:200px;display:flex;gap:10px}
.barras i{flex:1;height:8px;border-radius:4px;background:color-mix(in srgb,var(--suave) 35%,transparent);overflow:hidden}
.barras i b{display:block;height:100%;width:0;background:var(--acento)}
#intro h1{position:absolute;left:80px;right:60px;top:560px;font:var(--p-tit) calc(150px * var(--esc))/0.95 var(--f-tit);letter-spacing:-.02em}
#intro h1 span{display:block}
#intro .sub{position:absolute;left:90px;right:90px;top:920px;font:600 48px/1.3 var(--f-txt);color:var(--suave)}
#intro .fecha{position:absolute;left:90px;top:1120px;font:700 56px var(--f-mono);color:var(--fondo);background:var(--acento);
  padding:10px 26px;border-radius:18px}
#oferta .tarjeta{position:absolute;left:60px;right:60px;top:330px;height:1200px;border-radius:56px;padding:60px 60px 56px;
  display:flex;flex-direction:column;align-items:flex-start;overflow:hidden;
  background:color-mix(in srgb,var(--fondo) 72%,transparent);border:3px solid color-mix(in srgb,var(--suave) 40%,transparent);
  backdrop-filter:blur(6px);will-change:transform,opacity,clip-path}
.pct{display:inline-block;font:var(--p-tit) calc(140px * var(--esc))/1 var(--f-tit);color:var(--fondo);background:var(--acento);
  padding:18px 34px 22px;border-radius:34px;transform-origin:20% 60%}
.ico{display:block;flex:none;width:120px;height:120px;margin:30px 0 12px;color:var(--acento)}
.ico *{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.nom{flex:none;font:var(--p-tit) calc(106px * var(--esc))/1 var(--f-tit);letter-spacing:-.005em;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.cursor{display:inline-block;width:.08em;height:.9em;margin-left:.06em;background:var(--acento);vertical-align:-.08em}
.chips{flex:none;display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
.chip{font:700 38px/1 var(--f-mono);background:var(--chip);color:var(--tinta);padding:16px 22px;border-radius:18px;
  border:2px solid color-mix(in srgb,var(--acento) 45%,transparent)}
.precios{margin-top:auto;display:flex;align-items:baseline;gap:8px 28px;flex-wrap:wrap}
.ahora{font:700 120px/1 var(--f-mono);letter-spacing:-.02em}
.antes{position:relative;font:600 46px var(--f-mono);color:var(--suave)}
.antes i{position:absolute;left:-4px;top:52%;height:6px;width:0;background:var(--tachado);border-radius:3px}
.tienda{margin-top:18px;font:600 40px/1.25 var(--f-txt);color:var(--suave)}
.tienda b{color:var(--tinta)}
#cierre h2{position:absolute;left:90px;right:90px;top:470px;font:800 120px/0.98 var(--f-txt);letter-spacing:-.02em}
#cierre .link{position:absolute;left:70px;right:70px;top:900px;font:700 50px var(--f-mono);color:var(--tinta);
  background:var(--chip);border:3px solid var(--acento);border-radius:28px;padding:34px 36px;overflow:hidden;white-space:nowrap}
#cierre .onda{position:absolute;width:40px;height:40px;border-radius:50%;background:var(--acento);opacity:0;pointer-events:none}
#cierre .bio{position:absolute;left:90px;right:90px;top:1110px;font:800 70px var(--f-txt);color:var(--acento)}
#cierre .bio span{display:inline-block}
#cierre .letra{position:absolute;left:90px;right:90px;top:1300px;font:600 34px/1.4 var(--f-txt);color:var(--suave)}
/* La foto del producto: de fondo, desenfocada bajo un velo del color del dia; nitida en la tarjeta. */
.fotofondo{position:absolute;inset:-60px;background:center/cover no-repeat;filter:blur(26px) saturate(1.25);opacity:0;transform:scale(1.08)}
.velo{position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--fondo) 70%,transparent),color-mix(in srgb,var(--fondo) 88%,transparent))}
.foto{position:absolute;right:52px;top:52px;width:280px;height:280px;object-fit:contain;background:#fff;border-radius:36px;padding:18px;
  box-shadow:0 18px 50px rgba(0,0,0,.35);opacity:0}
.foto.sin{display:none}
/* Disposicion «plena»: sin caja, la foto grande arriba y el descuento encima */
.disp-plena #oferta .tarjeta{background:transparent;border:none;backdrop-filter:none;padding-top:0}
.disp-plena .foto{position:relative;right:auto;top:auto;width:100%;height:560px;margin:0 0 26px;order:-1;padding:30px;border-radius:44px}
.disp-plena .pct{position:absolute;left:28px;top:28px;z-index:1;box-shadow:0 12px 40px rgba(0,0,0,.35)}
.disp-plena .ico{display:none}
.disp-plena .nom{-webkit-line-clamp:2}
</style></head>
<body class="disp-${est.disposicion}"><div id="esc">
<div class="fotofondo"></div><div class="velo"></div>
<div class="patron ${est.fondo}"></div>
<div class="barras">${ofertas.map(() => "<i><b></b></i>").join("")}</div>
<section id="intro">
  <div class="marca"><span>LA PICHINCHA</span><span class="d"></span></div>
  <h1><span>PICHINCHAS</span><span>DEL DÍA</span></h1>
  <p class="sub">${ofertas.length} bajas de precio en hardware, verificadas en cada tienda.</p>
  <span class="fecha"></span>
</section>
<section id="oferta"><div class="tarjeta">
  <span class="pct"></span>
  <img class="foto" alt="">
  <svg class="ico" viewBox="0 0 24 24"></svg>
  <h2 class="nom"></h2>
  <div class="chips"></div>
  <div class="precios"><span class="ahora"></span><span class="antes"><span class="a"></span><i></i></span></div>
  <p class="tienda"></p>
</div></section>
<section id="cierre">
  <div class="marca"><span>LA PICHINCHA</span><span class="d"></span></div>
  <h2>Las ${ofertas.length}, con su link a la tienda</h2>
  <div class="link"><span class="txt"></span><span class="cursor"></span></div>
  <span class="onda"></span>
  <p class="bio"><span>↗</span> Link en la bio</p>
  <p class="letra">Precios con IVA y sin envío; cambian rápido: verificá en la tienda antes de comprar. El orden no depende de comisiones.</p>
</section>
</div>
<script type="application/json" id="datos">${json}</script>
<script>
"use strict";
const D = JSON.parse(document.getElementById("datos").textContent);
const $ = (s, r = document) => r.querySelector(s);
const clamp = x => Math.max(0, Math.min(1, x));
const tramo = (u, a, b) => clamp((u - a) / (b - a));
const salir = x => 1 - Math.pow(1 - x, 3);                      // ease-out cubica
const rebote = x => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const pesos = n => "$" + Math.round(n).toLocaleString("es-AR").replace(/,/g, ".");
const mostrar = id => { for (const s of document.querySelectorAll("section")) s.style.display = s.id === id ? "block" : "none"; };
document.querySelectorAll(".marca .d").forEach(e => e.textContent = D.dia);
$("#intro .fecha").textContent = "HOY " + D.dia;

let actual = -1;
function cargar(i) {
  if (i === actual) return;
  actual = i;
  const o = D.ofertas[i], c = $("#oferta");
  // La foto: nitida en la tarjeta y desenfocada de fondo; sin foto (o si no bajo) queda el fondo del dia.
  const ok = o.imagen && FOTOS[i];
  $(".foto", c).classList.toggle("sin", !ok);
  if (ok) $(".foto", c).src = o.imagen;
  $(".fotofondo").style.backgroundImage = ok ? 'url("' + o.imagen + '")' : "none";
  $(".pct", c).textContent = "−" + o.descuento + "%";
  $(".ico", c).innerHTML = D.iconos[o.icono] || "";
  $(".ico", c).querySelectorAll("*").forEach(e => e.setAttribute("pathLength", "1"));
  $(".chips", c).innerHTML = o.chips.map(t => '<span class="chip"></span>').join("");
  $(".chips", c).querySelectorAll(".chip").forEach((e, j) => e.textContent = o.chips[j]);
  $(".antes .a", c).textContent = o.antes ? pesos(o.antes) : "";
  $(".tienda", c).innerHTML = "en <b></b>" + (o.contra ? " · " : "");
  $(".tienda b", c).textContent = o.comercio;
  if (o.contra) $(".tienda", c).append(o.contra);
}

/* Todo depende de t (ms): el mismo t da siempre el mismo cuadro. */
function pintar(t) {
  const n = D.ofertas.length, ms = D.ms;
  const fin = ms.intro + n * ms.oferta;
  $(".patron").style.transform = "translate(" + (-(t / 40) % 90) + "px," + (-(t / 55) % 90) + "px)";
  document.querySelectorAll(".barras b").forEach((b, j) => {
    b.style.width = (100 * clamp((t - ms.intro - j * ms.oferta) / ms.oferta)) + "%";
  });
  $(".barras").style.opacity = t < ms.intro ? 0 : 1;
  if (t < ms.intro) {
    mostrar("intro");
    $(".fotofondo").style.opacity = 0;
    const h = document.querySelectorAll("#intro h1 span");
    h.forEach((s, j) => { const p = salir(tramo(t, 150 + j * 170, 650 + j * 170)); s.style.transform = "translateY(" + (90 * (1 - p)) + "px)"; s.style.opacity = p; });
    const sub = salir(tramo(t, 900, 1400)); $("#intro .sub").style.opacity = sub; $("#intro .sub").style.transform = "translateY(" + (30 * (1 - sub)) + "px)";
    const f = rebote(tramo(t, 1200, 1650)); $("#intro .fecha").style.transform = "scale(" + (0.4 + 0.6 * f) + ")"; $("#intro .fecha").style.opacity = clamp(f * 2);
    const out = tramo(t, ms.intro - 250, ms.intro); $("#intro").style.opacity = 1 - out;
    return;
  }
  if (t < fin) {
    mostrar("oferta");
    const i = Math.floor((t - ms.intro) / ms.oferta), u = (t - ms.intro) % ms.oferta;
    cargar(i);
    const o = D.ofertas[i], c = $("#oferta"), tj = $(".tarjeta", c), uu = u * 1700 / ms.oferta;
    // Entrada y salida de la tarjeta segun la transicion del dia
    const ent = salir(tramo(u, 0, 260)), sal = tramo(u, ms.oferta - 200, ms.oferta);
    if (D.transicion === "zoom") { tj.style.transform = "scale(" + (0.85 + 0.15 * ent + 0.1 * sal) + ")"; tj.style.opacity = ent * (1 - sal); tj.style.clipPath = "none"; }
    else if (D.transicion === "cortina") { tj.style.transform = "none"; tj.style.opacity = 1 - sal; tj.style.clipPath = "inset(0 0 " + (100 * (1 - ent)) + "% 0 round 56px)"; }
    else { tj.style.transform = "translateX(" + (900 * (1 - ent) - 900 * sal * sal) + "px)"; tj.style.opacity = 1; tj.style.clipPath = "none"; }
    // La foto aparece y se acerca despacio (efecto Ken Burns); de fondo, la misma foto desenfocada
    const fo = salir(tramo(uu, 60, 420));
    $(".foto", c).style.opacity = fo;
    $(".foto", c).style.transform = "scale(" + (0.9 + 0.1 * fo + 0.04 * tramo(uu, 420, 1700)) + ")";
    $(".fotofondo").style.opacity = 0.9 * salir(tramo(u, 0, 300)) * (1 - 0.5 * sal);
    $(".fotofondo").style.transform = "scale(" + (1.08 + 0.06 * tramo(u, 0, ms.oferta)) + ")";
    // El descuento se estampa
    const pc = rebote(tramo(uu, 120, 460)); $(".pct", c).style.transform = "scale(" + (uu < 120 ? 0 : 0.3 + 0.7 * pc) + ") rotate(" + (-6 * (1 - pc)) + "deg)";
    // El icono se dibuja
    const di = salir(tramo(uu, 160, 640)); $(".ico", c).querySelectorAll("*").forEach(e => { e.style.strokeDasharray = "1"; e.style.strokeDashoffset = String(1 - di); });
    // El nombre se escribe en vivo
    const k = Math.round(o.titulo.length * tramo(uu, 260, 760)), escribiendo = k < o.titulo.length && uu >= 260;
    $(".nom", c).textContent = o.titulo.slice(0, k);
    if (escribiendo || (uu > 760 && uu < 1000 && Math.floor(uu / 120) % 2 === 0)) { const cur = document.createElement("span"); cur.className = "cursor"; $(".nom", c).append(cur); }
    // Las chips aparecen de a una
    c.querySelectorAll(".chip").forEach((e, j) => { const p = rebote(tramo(uu, 700 + j * 90, 960 + j * 90)); e.style.opacity = clamp(p); e.style.transform = "scale(" + (0.6 + 0.4 * p) + ")"; });
    // El precio cuenta del de antes al de hoy, y el de antes se tacha
    const pr = salir(tramo(uu, 760, 1180)), desde = o.antes || o.precio;
    $(".ahora", c).textContent = pesos(desde + (o.precio - desde) * pr);
    $(".ahora", c).style.opacity = clamp(tramo(uu, 700, 820));
    $(".antes", c).style.opacity = clamp(tramo(uu, 980, 1100));
    $(".antes i", c).style.width = "calc(" + (100 * salir(tramo(uu, 1100, 1320))) + "% + 8px)";
    $(".tienda", c).style.opacity = clamp(tramo(uu, 1000, 1150));
    return;
  }
  mostrar("cierre");
  $(".fotofondo").style.opacity = 0;
  const v = t - fin, cz = $("#cierre");
  const h2 = salir(tramo(v, 0, 450)); $("h2", cz).style.opacity = h2; $("h2", cz).style.transform = "translateY(" + (60 * (1 - h2)) + "px)";
  // El link se escribe y se «toca»: una onda sale del link y abre
  const lk = $(".link", cz), k = Math.round(D.sitio.length * tramo(v, 400, 1300));
  lk.style.opacity = clamp(tramo(v, 300, 450));
  $(".txt", lk).textContent = D.sitio.slice(0, k);
  $(".cursor", lk).style.opacity = v < 1300 || Math.floor(v / 200) % 2 ? 1 : 0;
  const toque = tramo(v, 1450, 2050), on = $(".onda", cz);
  on.style.left = (90 + 700) + "px"; on.style.top = (900 + 40) + "px";
  on.style.opacity = toque > 0 && toque < 1 ? 0.55 * (1 - toque) : 0;
  on.style.transform = "translate(-50%,-50%) scale(" + (1 + 26 * salir(toque)) + ")";
  lk.style.transform = "scale(" + (1 - 0.04 * Math.sin(Math.PI * tramo(v, 1450, 1650))) + ")";
  lk.style.background = toque > 0.15 ? "var(--acento)" : "var(--chip)";
  lk.style.color = toque > 0.15 ? "var(--fondo)" : "var(--tinta)";
  const bio = salir(tramo(v, 1600, 2000)); $(".bio", cz).style.opacity = bio;
  $(".bio span", cz).style.transform = "translate(" + (12 * Math.sin(v / 140)) + "px," + (-12 * Math.sin(v / 140)) + "px)";
  $(".letra", cz).style.opacity = clamp(tramo(v, 1900, 2300));
}
window.pintar = pintar;
window.DURACION = D.ms.intro + D.ofertas.length * D.ms.oferta + D.ms.cierre;
// «#t=4000» pinta ese momento al abrir: sirve para revisar un cuadro con una captura de Chrome.
const T0 = +(location.hash.match(/t=(\d+)/) || [0, 0])[1];
// Se espera a las letras y a las fotos (cada una con 8 s de tope: una tienda lenta no frena el Reel, esa oferta va sin foto).
const FOTOS = [];
const bajar = (u, i) => new Promise(ok => {
  if (!u) return ok();
  const im = new Image(), corte = setTimeout(() => ok(), 8000);
  im.onload = () => { clearTimeout(corte); FOTOS[i] = im.naturalWidth > 0; ok(); };
  im.onerror = () => { clearTimeout(corte); ok(); };
  im.src = u;
});
window.listo = Promise.all([document.fonts ? document.fonts.ready : 0, ...D.ofertas.map((o, i) => bajar(o.imagen, i))])
  .then(() => { actual = -1; pintar(T0); return true; });
pintar(T0);
</script></body></html>
`;
}

/* --- La captura ----------------------------------------------------------------- */
const NAVEGADORES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
function navegador(dado) {
  if (dado) return dado;
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
  for (const n of NAVEGADORES) {
    if (n.includes("/") ? fs.existsSync(n) : (() => { try { execFileSync(process.platform === "win32" ? "where" : "which", [n], { stdio: "ignore" }); return true; } catch (e) { return false; } })()) return n;
  }
  return null;
}

/* Abre Chrome sin interfaz con el puerto de DevTools y devuelve { proceso, ws } con el WebSocket de la pestaña. */
async function abrirChrome(chrome) {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "reel-chrome-"));
  const proceso = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--mute-audio",
    "--remote-debugging-port=0", `--user-data-dir=${perfil}`, `--window-size=${ANCHO},${ALTO}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const puerto = await new Promise((ok, mal) => {
    let txt = "";
    const t = setTimeout(() => mal(new Error("Chrome no abrio el puerto de DevTools")), 20000);
    proceso.stderr.on("data", d => { txt += d; const m = txt.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//); if (m) { clearTimeout(t); ok(+m[1]); } });
    proceso.on("exit", c => { clearTimeout(t); mal(new Error("Chrome termino (" + c + ")")); });
  });
  const pestanas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  const pagina = pestanas.find(p => p.type === "page");
  const ws = new WebSocket(pagina.webSocketDebuggerUrl);
  await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pendientes.has(m.id)) { const [ok, mal] = pendientes.get(m.id); pendientes.delete(m.id); m.error ? mal(new Error(m.error.message)) : ok(m.result); } };
  const cdp = (metodo, params = {}) => new Promise((ok, mal) => { const n = ++id; pendientes.set(n, [ok, mal]); ws.send(JSON.stringify({ id: n, method: metodo, params })); });
  const cerrar = () => { try { ws.close(); } catch (e) { /* ya cerrado */ } proceso.kill(); try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* Chrome a veces tarda en soltar el perfil */ } };
  return { cdp, cerrar };
}

/* Cuadros sueltos (--fotos 1900,7350): para revisar el diseño sin armar el video. */
async function fotos(html, tiempos, prefijo, { chrome } = {}) {
  const { cdp, cerrar } = await abrirChrome(chrome);
  try {
    await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.enable");
    await cdp("Page.navigate", { url: "file:///" + path.resolve(html).split(path.sep).join("/") });
    await new Promise(r => setTimeout(r, 1500));
    await cdp("Runtime.evaluate", { expression: "window.listo", awaitPromise: true });
    for (const t of tiempos) {
      await cdp("Runtime.evaluate", { expression: `pintar(${t})` });
      const { data } = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 90, clip: { x: 0, y: 0, width: ANCHO, height: ALTO, scale: 1 } });
      fs.writeFileSync(`${prefijo}-${t}.jpg`, Buffer.from(data, "base64"));
    }
  } finally { cerrar(); }
}

async function capturar(html, carpetaCuadros, { chrome, fps = 30 } = {}) {
  const { cdp, cerrar } = await abrirChrome(chrome);
  try {
    await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
    await cdp("Page.enable");
    await cdp("Page.navigate", { url: "file:///" + path.resolve(html).replace(/\\/g, "/") });
    await new Promise(r => setTimeout(r, 1500));
    await cdp("Runtime.evaluate", { expression: "window.listo", awaitPromise: true });
    const total = (await cdp("Runtime.evaluate", { expression: "window.DURACION", returnByValue: true })).result.value;
    const cuadros = Math.ceil(total / 1000 * fps);
    for (let i = 0; i < cuadros; i++) {
      await cdp("Runtime.evaluate", { expression: `pintar(${(i * 1000 / fps).toFixed(3)})` });
      const { data } = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 92, clip: { x: 0, y: 0, width: ANCHO, height: ALTO, scale: 1 } });
      fs.writeFileSync(path.join(carpetaCuadros, `c${String(i).padStart(5, "0")}.jpg`), Buffer.from(data, "base64"));
    }
    return { cuadros, total };
  } finally { cerrar(); }
}

/* Une los cuadros en un MP4 que Instagram acepta como Reel: H.264 yuv420p, AAC mudo, faststart. */
function video(carpetaCuadros, destino, fps) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(carpetaCuadros, "c%05d.jpg"),
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest", "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-crf", "19", "-preset", "slow", "-r", String(fps), "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", destino], { stdio: "inherit" });
}

async function main(argv) {
  const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
  const ruta = argv[0] && !argv[0].startsWith("--") ? argv[0] : "_sitio/ofertas.json";
  const salida = arg("salida", "_sitio"), fps = +arg("fps", "30") || 30;
  let datos;
  try { datos = JSON.parse(fs.readFileSync(ruta, "utf8")); } catch (e) { console.log(`sin ${ruta}: no se arma el Reel`); return 0; }
  if (!(datos.ofertas || []).length) { console.log("sin ofertas: no se arma el Reel"); return 0; }
  const fecha = fechaDe(datos), carpeta = path.join(salida, "instagram");
  fs.mkdirSync(carpeta, { recursive: true });
  const html = path.join(carpeta, `reel-${fecha}.html`);
  fs.writeFileSync(html, paginaReel(datos), "utf8");
  if (argv.includes("--solo-html")) { console.log(`Reel (solo la pagina): ${html}`); return 0; }
  const chrome = navegador(arg("chrome"));
  if (!chrome) { console.log("::warning::No hay Chrome: no se arma el Reel"); return 0; }
  if (arg("fotos")) {
    await fotos(html, arg("fotos").split(",").map(Number), path.join(carpeta, `foto-${fecha}`), { chrome });
    console.log(`Fotos del Reel en ${carpeta}`);
    return 0;
  }
  const cuadros = fs.mkdtempSync(path.join(os.tmpdir(), "reel-cuadros-"));
  try {
    const { cuadros: n, total } = await capturar(html, cuadros, { chrome, fps });
    const mp4 = path.join(carpeta, `${fecha}.mp4`);
    video(cuadros, mp4, fps);
    // Portada: el cuadro de la primera oferta ya armada (se ve el descuento, el nombre y el precio).
    const r = estilo(fecha).ritmo, portada = Math.min(n - 1, Math.round((r.intro + r.oferta * 0.9) / 1000 * fps));
    fs.copyFileSync(path.join(cuadros, `c${String(portada).padStart(5, "0")}.jpg`), path.join(carpeta, `${fecha}-portada.jpg`));
    console.log(`Reel armado: ${mp4} (${(total / 1000).toFixed(1)} s, ${n} cuadros, estilo ${Object.values(estilo(fecha)).map(x => typeof x === "string" ? x : x.nombre).join("/")})`);
  } finally { fs.rmSync(cuadros, { recursive: true, force: true }); }
  return 0;
}

module.exports = { estilo, ofertasReel, paginaReel, duracion, PALETAS, MS, main };
if (require.main === module) main(process.argv.slice(2)).then(c => process.exit(c), e => { console.log(`::warning::No se pudo armar el Reel: ${e.message}`); process.exit(0); });
