#!/usr/bin/env node
/* Lo mas buscado de la portada (spec 017, fase 3): lee de GoatCounter cuantas personas distintas hicieron cada busqueda en
   los ultimos 30 dias y escribe _sitio/buscadas.json con los terminos que pasan los filtros de privacidad (js/buscadas.js).

   Uso: GOATCOUNTER_TOKEN=... node generar_buscadas.js --salida _sitio [--indice _sitio/indice.json] [--dias 30] [--minimo 5] [--max 8]

   Buenas costumbres con los datos:
   - solo lee conteos agregados de GoatCounter (visitantes distintos por termino), nunca visitas individuales;
   - el token es de solo lectura y vive en los secretos de GitHub (GOATCOUNTER_TOKEN): no se imprime ni se guarda;
   - lo que se escribe es la lista de terminos, sin conteos, sin fechas y sin nada de quien busco;
   - los errores del servicio se informan con el codigo, nunca con el cuerpo de la respuesta;
   - sin token, sin indice o con un fallo, no se escribe nada y la portada sigue con las sugerencias fijas. */
"use strict";

const fs = require("fs");
const path = require("path");
const Buscadas = require("./js/buscadas.js");

const POR_PAGINA = 100;       // maximo de la API
const MAX_PAGINAS = 10;
const PAUSA_MS = 300;         // la API admite 4 pedidos por segundo
const dormir = ms => new Promise(r => setTimeout(r, ms));

/* La URL base de GoatCounter, la del propio index.html (data-goatcounter="https://<sitio>.goatcounter.com/count"). */
function baseDe(html) {
  const m = /data-goatcounter="(https:\/\/[^"\/]+)\/count"/.exec(html);
  return m ? m[1] : null;
}

/* Todas las rutas de la ventana, paginando con exclude_paths hasta que la API diga que no hay mas (o no aparezca nada nuevo). */
async function pedirHits({ base, token, desde, hasta, pedir = fetch, esperar = dormir }) {
  const hits = [], vistos = new Set();
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const url = new URL("/api/v0/stats/hits", base);
    url.searchParams.set("start", desde);
    url.searchParams.set("end", hasta);
    url.searchParams.set("limit", String(POR_PAGINA));
    for (const id of vistos) url.searchParams.append("exclude_paths", String(id));
    const r = await pedir(url, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    if (!r.ok) throw new Error(`GoatCounter respondio ${r.status}`);   // el codigo, no el cuerpo
    const d = await r.json();
    const nuevos = (d.hits || []).filter(h => !vistos.has(h.path_id));
    for (const h of nuevos) { vistos.add(h.path_id); hits.push({ path: h.path, count: h.count, event: h.event }); }
    if (!d.more || !nuevos.length) break;
    await esperar(PAUSA_MS);
  }
  return hits;
}

const horaRedonda = ms => new Date(Math.floor(ms / 36e5) * 36e5);

async function main(argv, env = process.env, { pedir = fetch, ahora = Date.now(), esperar = dormir } = {}) {
  const opcion = (nombre, porDefecto) => { const i = argv.indexOf(nombre); return i >= 0 && argv[i + 1] ? argv[i + 1] : porDefecto; };
  const salida = opcion("--salida");
  if (!salida) { console.error("Uso: GOATCOUNTER_TOKEN=... node generar_buscadas.js --salida _sitio [--indice indice.json]"); return 2; }
  const token = env.GOATCOUNTER_TOKEN;
  if (!token) { console.log("Sin GOATCOUNTER_TOKEN: la portada sigue con las busquedas sugeridas fijas"); return 0; }

  const rutaIndice = opcion("--indice", path.join(salida, "indice.json"));
  const pagina = path.join(salida, "index.html");
  if (!fs.existsSync(rutaIndice) || !fs.existsSync(pagina)) {
    // Sin catalogo no se puede comprobar que un termino sea un producto: no se publica nada.
    console.warn("Sin indice o sin index.html: no se arma lo mas buscado");
    return 0;
  }
  const base = baseDe(fs.readFileSync(pagina, "utf8"));
  if (!base) { console.warn("No se encontro la direccion de GoatCounter en index.html"); return 0; }

  const dias = Number(opcion("--dias", Buscadas.VENTANA_DIAS)), minimo = Number(opcion("--minimo", Buscadas.MINIMO_VISITANTES));
  const max = Number(opcion("--max", Buscadas.MAX_TERMINOS));
  const hasta = horaRedonda(ahora), desde = new Date(hasta.getTime() - dias * 864e5);
  let terminos;
  try {
    const hits = await pedirHits({ base, token, desde: desde.toISOString(), hasta: hasta.toISOString(), pedir, esperar });
    const productos = JSON.parse(fs.readFileSync(rutaIndice, "utf8")).productos || [];
    terminos = Buscadas.masBuscadas(hits, { productos, minimo, max });
  } catch (e) {
    console.warn("No se armo lo mas buscado: " + e.message);   // sin detalles de la respuesta
    return 0;
  }
  fs.writeFileSync(path.join(salida, "buscadas.json"), JSON.stringify(
    { generado: hasta.toISOString().slice(0, 10), ventana_dias: dias, minimo_visitantes: minimo, terminos }, null, 1) + "\n", "utf8");
  console.log(`Lo mas buscado: ${terminos.length} terminos (minimo ${minimo} personas distintas en ${dias} dias)`);
  return 0;
}

module.exports = { main, pedirHits, baseDe };

if (require.main === module) main(process.argv.slice(2)).then(c => { process.exitCode = c; });
