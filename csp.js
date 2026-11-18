"use strict";
/* La CSP de una pagina con los hashes de sus scripts en linea (auditoria B1): script-src no lleva 'unsafe-inline', lleva un
   'sha256-...' por cada <script> sin src que corre (los JSON y JSON-LD no corren y no cuentan) y, si hay manejadores en
   linea (el onload de la hoja de fuentes), 'unsafe-hashes' con el hash de cada uno. Se llama cada vez que se escribe el
   HTML final: el bloque de datos cambia en cada corrida y su hash con el. actualizar.py tiene la misma funcion
   (con_hashes) para index.html del repo; tests/test_sitio.py exige que den lo mismo. */
const crypto = require("crypto");

const META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">)/;
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const MANEJADOR = /<[a-zA-Z][^>]*?\son[a-z]+="([^"]*)"/g;
const NO_CORRE = /\btype="application\/(?:ld\+)?json"/i;

// El navegador hashea el texto ya leido por el parser de HTML, que pasa todo fin de linea a \n.
const hash = texto => "'sha256-" + crypto.createHash("sha256").update(texto.replace(/\r\n?/g, "\n"), "utf8").digest("base64") + "'";

function conHashes(html) {
  const meta = META.exec(html);
  if (!meta) return html;
  const scripts = [...html.matchAll(SCRIPT)].filter(([, attrs]) => !/\bsrc=/i.test(attrs) && !NO_CORRE.test(attrs)).map(m => hash(m[2]));
  const manejadores = [...html.matchAll(MANEJADOR)].map(m => hash(m[1]));
  const csp = meta[2].split(";").map(d => {
    const partes = d.trim().split(/\s+/);
    if (partes[0] !== "script-src") return d.trim();
    const base = partes.filter(t => !["'unsafe-inline'", "'unsafe-hashes'"].includes(t) && !t.startsWith("'sha256-"));
    return [...new Set([...base, ...(manejadores.length ? ["'unsafe-hashes'"] : []), ...manejadores, ...scripts])].join(" ");
  }).join("; ");
  return html.replace(META, (_, a, __, c) => a + csp + c);
}

module.exports = { conHashes, hash };
