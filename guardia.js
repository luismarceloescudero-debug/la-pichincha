#!/usr/bin/env node
/* Guardia del indice: mide sobre el indice real lo que tiene que dar la publicacion y avisa cuando algo no cierra.

   Uso: node guardia.js --indice indice.json --salida _sitio/guardia.json [--previa guardia-anterior.json]
                        [--ofertas _sitio/ofertas.json] [--alarma alarma.md] [--resumen $GITHUB_STEP_SUMMARY]

   Nacio del 18/10/2026: el indice publicado salio con 0 bajas propias en 22.533 avisos (el historial tenia 29) y nadie
   lo vio, porque los tests pasaban con datos de mentira. Cada corrida mide bajas propias y, por categoria, avisos, cuantos
   pasan, cuantos quedan "sin datos" y cuantas ofertas hay; lo compara con la medicion anterior (la `guardia.json`
   publicada) y sale con 3 si encuentra una alarma, para que la corrida no mande Telegram y abra un issue. */
"use strict";

const fs = require("fs");
const B = require("./js/buscador.js");
const C = require("./js/categorias.js");
const O = require("./js/ofertas.js");

const MIN_DESTACADAS = 10;     // menos que esto en el resumen es que algo filtro de mas
// Version de las reglas de que es una oferta: si cambia, la cantidad de ofertas por categoria no se compara con la corrida
// anterior (spec 035: sin el tachado de Mercado Libre los smartphones pasaron de 41 a 0, a proposito, y no es una falla).
const REGLAS = "035";
const SALTO_SIN_DATOS = 0.10;  // puntos que puede subir el "sin datos" de una categoria de un dia para otro
const MIN_AVISOS = 20;         // con menos avisos en la categoria, un porcentaje no dice nada

function medir(idx) {
  const productos = idx.productos || [];
  const ref = C.referencia(productos);
  const categorias = Object.fromEntries(C.ORDEN.map(c => [c, { avisos: 0, pasan: 0, sinDatos: 0, ofertas: 0 }]));
  for (const f of productos) {
    if (B.esUsado(f)) continue;
    const g = C.evaluar(f[0], ref), c = categorias[g.categoria];
    c.avisos++;
    if (g.pasa) c.pasan++;
    else if (/^sin dato/.test(g.motivo || "")) c.sinDatos++;
  }
  const r = O.calcularOfertas(idx);
  // las tres señales del resumen del dia: baja propia, el mismo modelo mas barato que en otras tiendas y tachado (spec 035)
  for (const f of new Set([...r.propias, ...r.contraModelo.keys(), ...r.publicadas])) categorias[r.gama.get(f).categoria].ofertas++;
  return { reglas: REGLAS, generado: idx.generado || "", historial: (idx.historial || {}).inicio || "", productos: productos.length,
           bajasPropias: productos.filter(f => (f[6] || 0) > 0).length, destacadas: O.destacadas(idx, 40).length,
           categorias };
}

/* Red de seguridad sobre lo que se va a publicar (23/10: la misma Lenovo con y sin Windows salio dos veces): las ofertas de
   ofertas.json que son el mismo modelo o la misma familia (O.familia), como [primera, repetida]. */
function repetidas(ofertas) {
  const vistas = new Map(), pares = [];
  for (const o of ofertas || []) {
    // La familia y la ficha legible (spec 047): la misma HP 250 con el procesador escrito distinto en dos tiendas, o la
    // misma memoria en dos colores con su codigo cada una, tambien son la misma.
    const f = [o.nombre, 0, "", "", "", 0, 0, "", "", o.modelo || ""];
    const ks = [O.familia(f), O.ficha(f)].filter(Boolean), previa = ks.find(k => vistas.has(k));
    if (previa) pares.push([vistas.get(previa), o]);
    else ks.forEach(k => vistas.set(k, o));
  }
  return pares;
}

const pct = (a, b) => b ? a / b : 0;
const p100 = x => Math.round(x * 100) + "%";

function alarmas(m, previa) {
  const lista = [];
  const dia = String(m.generado).slice(0, 10);
  if (m.historial && dia && m.historial < dia && m.productos > 0 && m.bajasPropias === 0)
    lista.push(`0 bajas propias en todo el índice (${m.productos} avisos) con historial desde el ${m.historial}: ` +
               "la comparación contra el historial no está funcionando (18/10: una segunda corrida en el día las borraba).");
  for (const [a, b] of m.repetidas || [])
    lista.push(`dos ofertas del día son el mismo modelo: «${a.nombre}» y «${b.nombre}».`);
  if (m.destacadas < MIN_DESTACADAS)
    lista.push(`solo ${m.destacadas} ofertas para el resumen (mínimo ${MIN_DESTACADAS}): algo filtra de más.`);
  for (const c of C.ORDEN) {
    const a = m.categorias[c], b = previa && previa.categorias && previa.categorias[c];
    if (!a || !b) continue;
    if (b.ofertas > 0 && a.ofertas === 0 && previa.reglas === m.reglas)
      lista.push(`${C.ETIQUETAS[c]}: sin ofertas hoy (ayer ${b.ofertas}).`);
    if (a.avisos >= MIN_AVISOS && b.avisos >= MIN_AVISOS) {
      const hoy = pct(a.sinDatos, a.avisos), antes = pct(b.sinDatos, b.avisos);
      if (Math.round((hoy - antes) * 1e6) > Math.round(SALTO_SIN_DATOS * 1e6))   // sin el redondeo, 8/20 - 6/20 da 0,10000000000000003
        lista.push(`${C.ETIQUETAS[c]}: los "sin datos" pasaron de ${p100(antes)} a ${p100(hoy)} de los avisos ` +
                   "(¿cambió cómo publica una tienda o se rompió la lectura de títulos?).");
    }
  }
  return lista;
}

function tabla(m) {
  const filas = C.ORDEN.map(c => { const x = m.categorias[c];
    return `| ${C.ETIQUETAS[c]} | ${x.avisos} | ${x.pasan} | ${x.sinDatos} (${p100(pct(x.sinDatos, x.avisos))}) | ${x.ofertas} |`; });
  return [`Índice del ${m.generado}: ${m.productos} avisos, ${m.bajasPropias} bajas propias, ${m.destacadas} ofertas para el resumen.`,
          "", "| Categoría | Avisos | Pasan | Sin datos | Ofertas |", "|---|---:|---:|---:|---:|", ...filas].join("\n");
}

function leer(ruta) {
  try { return JSON.parse(fs.readFileSync(ruta, "utf8")); } catch (e) { return null; }
}

function main(argv) {
  const arg = nombre => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : ""; };
  const idx = leer(arg("indice") || "indice.json");
  if (!idx) { console.log("sin indice: no hay nada que medir"); return 0; }
  const m = medir(idx);
  if (arg("ofertas")) m.repetidas = repetidas((leer(arg("ofertas")) || {}).ofertas);
  const lista = alarmas(m, arg("previa") ? leer(arg("previa")) : null);
  if (arg("salida")) fs.writeFileSync(arg("salida"), JSON.stringify(m), "utf8");
  const texto = "### Guardia del índice\n\n" + tabla(m) + "\n\n" +
    (lista.length ? "**Alarmas:**\n\n" + lista.map(x => "- " + x).join("\n") : "Sin alarmas.") + "\n";
  console.log(texto);
  if (arg("resumen")) fs.appendFileSync(arg("resumen"), texto, "utf8");
  if (!lista.length) return 0;
  if (arg("alarma")) fs.writeFileSync(arg("alarma"), texto, "utf8");
  return 3;
}

module.exports = { medir, alarmas, repetidas, main, MIN_DESTACADAS };
if (require.main === module) process.exitCode = main(process.argv.slice(2));
