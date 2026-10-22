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
function prerender(html, leer, novedades = null, buscadas = null) {
  if (!html.includes(TABLIST) || !html.includes(VISTA) || !SELLO.test(html)) return html;
  // Las novedades premium (spec 017, fase 2) y lo mas buscado (fase 3) viajan en la pagina como NOVEDADES y BUSCADAS: las usa
  // vistaComparativa aca y tambien cuando la persona vuelve a la pestaña, y BUSCADAS son las sugerencias de Buscar.
  // `<` escapado: nada cierra el script.
  const constantes = [["NOVEDADES", novedades], ["BUSCADAS", buscadas]].filter(([, v]) => v && v.length);
  if (constantes.length) {
    const texto = constantes.map(([n, v]) => `const ${n} = ${JSON.stringify(v).replace(/</g, "\\u003c")};\n`).join("");
    html = html.replace(FINAL, () => texto + FINAL);
  }
  const ctx = contexto(html, leer);
  if (!vm.runInContext("P.length", ctx)) return html;
  const pestanas = vm.runInContext('pestanasHtml("comparativa")', ctx);
  const sello = vm.runInContext("selloTexto()", ctx);
  // Sin animacion de entrada: ya esta al pintar (.panel.quieta en css/sitio.css), en cada panel de la vista.
  const vista = vm.runInContext("vistaComparativa()", ctx).replace(/<div class="panel"(?=[\s>])/g, '<div class="panel quieta"');
  const cat = vm.runInContext("CAT", ctx);
  return html
    .replace(TABLIST, () => TABLIST.replace("></div>", `>${pestanas}</div>`))
    .replace(SELLO, (_, abre, cierra) => abre + esc(sello) + cierra)
    .replace(VISTA, () => `<div id="vista" data-pre="comparativa:${cat}">${vista}</div>`);
}

/* Lo ultimo en tecnologia por categoria, calculado sobre el indice de la carpeta de salida (o el de --indice) con las
   mismas funciones de js/ que usa la pagina. Sin indice, o si algo falla, la portada sale sin ese panel y avisa. */
function novedadesDe(salida, argv) {
  const j = argv.indexOf("--indice");
  const ruta = j >= 0 && argv[j + 1] ? argv[j + 1] : path.join(salida, "indice.json");
  if (!fs.existsSync(ruta)) return null;
  try {
    const idx = JSON.parse(fs.readFileSync(ruta, "utf8"));
    // Los ganadores en pruebas: los de la carpeta de salida o, si todavia no se copiaron (la portada se arma antes que la
    // app instalable), los del repo. Sin ellos las novedades no sumarian el bonus que si tiene el buscador.
    const archivo = [path.join(salida, "datos", "ganadores.json"), path.join(__dirname, "datos", "ganadores.json")].find(fs.existsSync);
    const ganadores = archivo ? JSON.parse(fs.readFileSync(archivo, "utf8")) : null;
    return require("./js/novedades.js").novedadesPorCategoria(idx, ganadores);
  } catch (e) {
    console.warn("Portada sin novedades: " + e.message);
    return null;
  }
}

/* Lo mas buscado que dejo generar_buscadas.js (buscadas.json en la carpeta de salida). Cada termino se vuelve a pasar por el
   filtro de privacidad antes de ir a la pagina: aunque el archivo se hubiera editado a mano, no sale nada que parezca un dato
   personal. Sin archivo, la portada sigue con las sugerencias fijas. */
function buscadasDe(salida) {
  const ruta = path.join(salida, "buscadas.json");
  if (!fs.existsSync(ruta)) return null;
  try {
    const B = require("./js/buscadas.js");
    const { terminos } = JSON.parse(fs.readFileSync(ruta, "utf8"));
    return (Array.isArray(terminos) ? terminos : []).map(B.terminoLimpio).filter(Boolean).slice(0, B.MAX_TERMINOS);
  } catch (e) {
    console.warn("Portada sin lo mas buscado: " + e.message);
    return null;
  }
}

function main(argv) {
  const i = argv.indexOf("--salida");
  if (i < 0 || !argv[i + 1]) {
    console.error("Uso: node generar_portada.js --salida _sitio [--indice _sitio/indice.json]");
    return 2;
  }
  const salida = argv[i + 1];
  const pagina = path.join(salida, "index.html");
  const html = fs.readFileSync(pagina, "utf8");
  const nuevo = prerender(html, ruta => fs.readFileSync(path.join(salida, ruta), "utf8"), novedadesDe(salida, argv), buscadasDe(salida));
  fs.writeFileSync(pagina, nuevo, "utf8");
  console.log(nuevo === html ? "Portada sin cambios" : "Portada pre-renderizada");
  return 0;
}

module.exports = { prerender, contexto, main, novedadesDe, buscadasDe, INICIO, FINAL };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
