#!/usr/bin/env node
/* Pre-renderiza la portada publicada: escribe en _sitio/index.html las pestañas, el sello y la
   Comparativa de memorias, que antes armaba el JS al abrir. En la CPU lenta del runner ese armado
   bloqueaba el hilo principal 0,5-0,8 s (TBT) y el LCP esperaba al JS (A3, CONSTRAINTS.md).

   Uso: node generar_portada.js --salida _sitio

   El HTML sale de las mismas funciones de js/ que usa la pagina (pestanasHtml, selloTexto y
   vistaComparativa en js/vistas.js), cargadas con los datos de la pagina en un contexto de Node: no
   hay una segunda plantilla que se pueda desfasar. #vista queda marcado con data-pre y js/arranque.js
   no la vuelve a armar si es la que toca (ver usarPrerender). index.html del repo y la copia del
   artifact quedan sin pre-renderizar: el JS arma todo como siempre. */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const INICIO = "/* === DATOS: generado por actualizar.py, no editar a mano === */";
const FINAL = "/* === FIN DATOS === */";
const TABLIST = '<div class="tablist" role="tablist" id="tablist"></div>';
const VISTA = '<div id="vista"></div>';
const SELLO = /(<p class="meta" id="sello">)[^<]*(<\/p>)/;
// Los scripts de la pagina, en orden: los de js/ y el bloque de datos. Analitica y JSON-LD llevan
// atributos y quedan afuera.
const SCRIPT = /<script(?: src="(js\/[\w.-]+\.js)")?>([\s\S]*?)<\/script>/g;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Lo minimo del navegador para cargar los scripts sin pintar nada: sin storage (ni busquedas guardadas
   ni categoria elegida) y sin temporizadores. `entorno` lo pisa para los tests del arranque. */
function contexto(html, leer, entorno = {}, { conArranque = false, suelta = true, antesDeArrancar } = {}) {
  const nada = () => null;
  const ctx = vm.createContext({
    console, URL, URLSearchParams,
    document: { addEventListener() {}, getElementById: nada, querySelector: nada, querySelectorAll: () => [] },
    localStorage: { getItem: nada, setItem() {} },
    location: { hash: "", search: "", pathname: "/", origin: "" },
    navigator: {}, setTimeout() {}, clearTimeout() {}, addEventListener() {},
    ...entorno,
  });
  ctx.window = ctx.self = ctx;
  ctx.top = suelta ? ctx : {};
  for (const [, src, codigo] of html.matchAll(SCRIPT)) {
    if (src === "js/arranque.js") {
      if (!conArranque) continue;
      if (antesDeArrancar) antesDeArrancar(ctx);
    }
    vm.runInContext(src ? leer(src) : codigo, ctx, { filename: src || "index.html" });
  }
  return ctx;
}

/* La portada con su vista inicial escrita. Sin los marcadores (ya pre-renderizada, u otra pagina) o
   sin productos, devuelve el HTML tal cual. */
function prerender(html, leer) {
  if (!html.includes(TABLIST) || !html.includes(VISTA) || !SELLO.test(html)) return html;
  const ctx = contexto(html, leer);
  if (!vm.runInContext("P.length", ctx)) return html;
  const pestanas = vm.runInContext('pestanasHtml("comparativa")', ctx);
  const sello = vm.runInContext("selloTexto()", ctx);
  // Sin animacion de entrada: ya esta al pintar (.panel.quieta en css/sitio.css).
  const vista = vm.runInContext("vistaComparativa()", ctx).replace('<div class="panel">', '<div class="panel quieta">');
  const cat = vm.runInContext("CAT", ctx);
  return html
    .replace(TABLIST, () => TABLIST.replace("></div>", `>${pestanas}</div>`))
    .replace(SELLO, (_, abre, cierra) => abre + esc(sello) + cierra)
    .replace(VISTA, () => `<div id="vista" data-pre="comparativa:${cat}">${vista}</div>`);
}

function main(argv) {
  const i = argv.indexOf("--salida");
  if (i < 0 || !argv[i + 1]) {
    console.error("Uso: node generar_portada.js --salida _sitio");
    return 2;
  }
  const salida = argv[i + 1];
  const pagina = path.join(salida, "index.html");
  const html = fs.readFileSync(pagina, "utf8");
  const nuevo = prerender(html, ruta => fs.readFileSync(path.join(salida, ruta), "utf8"));
  fs.writeFileSync(pagina, nuevo, "utf8");
  console.log(nuevo === html ? "Portada sin cambios" : "Portada pre-renderizada");
  return 0;
}

module.exports = { prerender, contexto, main, INICIO, FINAL };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
