#!/usr/bin/env node
// Mide las reglas de ofertas, categorias, premium y titulos contra el indice publicado (o uno local)
// y compara el codigo de esta carpeta con el de otra rama (main por defecto).
// Uso: node .claude/skills/medir-indice/medir.js [--base main] [--indice ruta] [--ofertas ruta] [--todo]
// Solo Node (fetch nativo) y git. No escribe nada en el repo: lo bajado y la copia de la base van a la carpeta temporal.
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), { execFileSync } = require("child_process");

const args = process.argv.slice(2);
const opcion = (n, d) => (args.includes(n) && args[args.indexOf(n) + 1]) || d;
const RAIZ = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const BASE = opcion("--base", "main"), TODO = args.includes("--todo"), SITIO = "https://pichinchadeldia.com.ar/";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "medir-indice-"));

async function json(ruta, nombre) {
  if (ruta) return JSON.parse(fs.readFileSync(ruta, "utf8"));
  const r = await fetch(SITIO + nombre, { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(nombre + ": HTTP " + r.status);
  return r.json();
}

function modulos(dir) {
  const js = n => require(path.join(dir, "js", n + ".js"));
  return { O: js("ofertas"), C: js("categorias"), P: js("premium"), T: js("titulo") };
}

function codigoBase() {
  // Copia js/ de la base a la carpeta temporal (sin tocar el arbol de trabajo).
  const dir = path.join(TMP, "base");
  fs.mkdirSync(path.join(dir, "js"), { recursive: true });
  const archivos = execFileSync("git", ["-C", RAIZ, "ls-tree", "--name-only", BASE, "js/"], { encoding: "utf8" }).split("\n").filter(Boolean);
  for (const a of archivos) fs.writeFileSync(path.join(dir, a), execFileSync("git", ["-C", RAIZ, "show", BASE + ":" + a]));
  return dir;
}

const cuenta = (arr, k) => arr.reduce((m, x) => (m[k(x)] = (m[k(x)] || 0) + 1, m), {});
const pct = x => Math.round(x * 100) + "%";

function pestaña(M, idx) {
  const of = M.O.calcularOfertas(idx);
  const nuevo = (f, ref, tipo) => ({ f, tipo, off: 1 - f[1] / f[ref], cat: of.categorias.get(f).categoria });
  const lista = M.O.unico([...of.propias.map(f => nuevo(f, 6, "propia")), ...of.publicadas.map(f => nuevo(f, 5, "publicada")),
    ...of.seguimiento.map(f => nuevo(f, 6, "seguimiento"))].sort((a, b) => b.off - a.off));
  return { of, lista };
}

function informe(M, idx, ofj) {
  const { of, lista } = pestaña(M, idx);
  console.log("\n## Pestaña Ofertas:", lista.length, "avisos");
  console.log("por tipo", JSON.stringify(cuenta(lista, o => o.tipo)));
  console.log("por categoria", JSON.stringify(cuenta(lista, o => o.cat)));
  console.log("por tienda", JSON.stringify(cuenta(lista, o => o.f[3])));
  const vistas = new Map(), rep = [];
  for (const o of lista) {
    const ks = [M.O.familia(o.f), M.O.ficha(o.f)].filter(Boolean), p = ks.find(k => vistas.has(k));
    if (p) rep.push([vistas.get(p).f[0], o.f[0]]); else ks.forEach(k => vistas.set(k, o));
  }
  console.log("repetidas (misma ficha o familia):", rep.length, rep.slice(0, 5));
  const lotes = cuenta(lista.filter(o => o.tipo !== "publicada"), o => o.f[3] + " " + pct(o.off));
  console.log("grupos de 4+ con el mismo % y tienda:", Object.entries(lotes).filter(([, n]) => n >= 4));
  console.log("descartadas: en lote", of.enLote, "| no tecnologia", of.noTecnologia);
  const otros = lista.filter(o => o.cat === "otro");
  console.log("en «Otros»:", otros.length);
  otros.forEach(o => console.log("  ", pct(o.off), o.f[3], "|", o.f[0].slice(0, 90)));
  const caros = idx.productos.filter(f => f[1] >= 1e8);
  console.log("precios de 9 cifras o mas en el indice (posible relleno):", caros.length, caros.slice(0, 3).map(f => f[3] + " $" + f[1]));

  const ref = M.C.referencia(idx.productos), prem = {}, tot = {};
  for (const f of idx.productos) {
    const g = M.C.evaluar(f[0], ref);
    tot[g.categoria] = (tot[g.categoria] || 0) + 1;
    if (M.P.puntaje(f[0], ref, g).premium) prem[g.categoria] = (prem[g.categoria] || 0) + 1;
  }
  console.log("\n## Premium por categoria (todo el indice)");
  for (const k of Object.keys(tot)) console.log("  ", k.padEnd(14), ((prem[k] || 0) / tot[k] * 100).toFixed(1) + "% de", tot[k]);

  if (ofj) console.log("\n## ofertas.json publicado:", ofj.ofertas.length, JSON.stringify(cuenta(ofj.ofertas, o => o.tienda)));
  if (TODO) {
    console.log("\n## Titulos de la pestaña");
    for (const o of lista) {
      const tp = M.T.tipoDe(o.f[0]);
      console.log("  ", o.f[3].padEnd(12), pct(o.off).padStart(4), "|", M.T.tituloDe(o.f[0], tp), "|", (M.T.chipsDe(o.f[0], tp) || []).join(" · "));
    }
  }
  return lista;
}

function comparar(A, B, idx) {
  const refA = A.C.referencia(idx.productos), refB = B.C.referencia(idx.productos);
  const titulos = [], categorias = [];
  for (const f of idx.productos) {
    const ta = A.T.tituloDe(f[0], A.T.tipoDe(f[0])), tb = B.T.tituloDe(f[0], B.T.tipoDe(f[0]));
    if (ta !== tb) titulos.push([tb, ta, f[0]]);
    const ca = A.C.evaluar(f[0], refA).categoria, cb = B.C.evaluar(f[0], refB).categoria;
    if (ca !== cb) categorias.push([cb, ca, f[0]]);
  }
  const la = pestaña(A, idx).lista, lb = pestaña(B, idx).lista;
  const enA = new Set(la.map(o => o.f[2])), enB = new Set(lb.map(o => o.f[2]));
  console.log("\n## Este codigo contra", BASE);
  console.log("titulos distintos:", titulos.length, "de", idx.productos.length);
  titulos.slice(0, TODO ? 200 : 15).forEach(([b, a, n]) => console.log("  ", b, "→", a, "|", n.slice(0, 60)));
  console.log("categorias distintas:", categorias.length, cuenta(categorias, ([b, a]) => b + "→" + a));
  categorias.slice(0, TODO ? 200 : 10).forEach(([b, a, n]) => console.log("  ", b, "→", a, "|", n.slice(0, 70)));
  console.log("pestaña:", lb.length, "→", la.length, "| entran", la.filter(o => !enB.has(o.f[2])).length,
    "| salen", lb.filter(o => !enA.has(o.f[2])).length);
}

(async () => {
  const [idx, ofj] = await Promise.all([json(opcion("--indice"), "indice.json"), json(opcion("--ofertas"), "ofertas.json").catch(() => null)]);
  console.log("indice", idx.generado, "|", idx.productos.length, "avisos | codigo:", RAIZ, "| base:", BASE);
  const actual = modulos(RAIZ);
  informe(actual, idx, ofj);
  comparar(actual, modulos(codigoBase()), idx);
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch(e => { console.error("medir-indice:", e.message); process.exit(1); });
