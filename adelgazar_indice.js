/* Adelgaza el indice que viaja al navegador (spec 057): la busqueda no muestra fotos, y el campo `imagen` es el 29 % del indice
   comprimido (520 KB de 1.790 KB). Se saca de `_sitio/indice.json` (queda la columna, vacia, para no mover las posiciones) y las fotos
   de lo que puede aparecer en la pestaña Ofertas viajan aparte en `_sitio/imagenes.json` ({ url: imagen }), que el sitio pide recien
   al abrir Ofertas. El `indice.json` de la raiz (con todo) no se toca: lo siguen usando el feed, Telegram y las paginas.

   Uso: node adelgazar_indice.js --indice indice.json --salida _sitio
   Si algo falla, no se escribe nada y el sitio sale con el indice completo (el navegador cae a la foto del propio indice). */
"use strict";
const fs = require("fs");
const path = require("path");
const Ofertas = require("./js/ofertas.js");

function adelgazar(idx) {
  const campos = idx.campos || [];
  const iImg = campos.indexOf("imagen"), iUrl = campos.indexOf("url");
  if (iImg < 0 || iUrl < 0) return { indice: idx, imagenes: {}, sacadas: 0 };
  // Todo lo que la pestaña Ofertas puede mostrar: bajas propias, rebajas publicadas, en seguimiento y las de «contra el modelo».
  const r = Ofertas.calcularOfertas(idx);
  const filas = new Set([...r.propias, ...r.publicadas, ...r.seguimiento, ...r.contraModelo.keys()]);
  const imagenes = {};
  filas.forEach(f => { if (f[iImg]) imagenes[f[iUrl]] = f[iImg]; });
  let sacadas = 0;
  const productos = idx.productos.map(f => {
    if (!f[iImg]) return f;
    sacadas++;
    const g = f.slice();
    g[iImg] = "";
    return g;
  });
  return { indice: { ...idx, productos }, imagenes, sacadas };
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const entrada = arg("indice", path.join(__dirname, "indice.json"));
  const salida = arg("salida", path.join(__dirname, "_sitio"));
  if (!fs.existsSync(entrada)) { console.log("sin indice: nada que adelgazar"); return 0; }
  const idx = JSON.parse(fs.readFileSync(entrada, "utf8"));
  const { indice, imagenes, sacadas } = adelgazar(idx);
  if (!sacadas) { console.log("el indice no trae fotos: queda como esta"); return 0; }
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, "imagenes.json"), JSON.stringify(imagenes), "utf8");
  fs.writeFileSync(path.join(salida, "indice.json"), JSON.stringify(indice), "utf8");
  const kb = f => Math.round(fs.statSync(f).size / 1024);
  console.log(`indice adelgazado: ${sacadas} fotos sacadas; imagenes.json con ${Object.keys(imagenes).length} (${kb(path.join(salida, "imagenes.json"))} KB); indice.json ${kb(entrada)} -> ${kb(path.join(salida, "indice.json"))} KB`);
  return 0;
}

module.exports = { adelgazar, main };
if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error("::warning::No se adelgazo el indice: " + e.message); process.exit(0); }
}
