// Mide la Comparativa con el codigo REAL de index.html (T001) y deja el resultado en JSON.
// Uso: node specs/001-paginas-por-busqueda/medir-base.js <indice.json> <salida.json>
// Sirve despues (T005) para comprobar que mover analizarConsulta no cambia ni un numero.
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const raiz = path.resolve(__dirname, "../..");
const [indicePath, salida] = process.argv.slice(2);
const B = require(raiz + "/js/buscador.js");
const P = require(raiz + "/js/pagina.js");
const html = fs.readFileSync(raiz + "/index.html", "utf8");
const datos = JSON.parse(fs.readFileSync(raiz + "/datos.json", "utf8"));
const IDX = JSON.parse(fs.readFileSync(indicePath, "utf8"));

// El cuerpo de analizarConsulta, tal como esta en index.html.
const ini = html.indexOf("function analizarConsulta(q) {");
const fin = html.indexOf("\nfunction fijarConsulta", ini);
if (ini < 0 || fin < 0) throw new Error("no encuentro analizarConsulta en index.html");
const codigo = html.slice(ini, fin);

const MARCAS = datos.marcas || { primera: [], conocida: [] };
const esc = s => s;
const reMarca = lista => lista.length
  ? new RegExp("\\b(" + lista.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b") : /$^/;
const RE_PRIMERA = reMarca(MARCAS.primera || []), RE_CONOCIDA = reMarca(MARCAS.conocida || []);
const nivelMarca = nombre => RE_PRIMERA.test(B.normal(nombre)) ? 2 : RE_CONOCIDA.test(B.normal(nombre)) ? 1 : 0;
const MARCAS_RE = B.armarMarcasRe([...(MARCAS.primera || []), ...(MARCAS.conocida || [])]);
const N = IDX.productos.map(f => B.normalBusq(f[0]));
const ctx = {
  IDX, Buscador: B, Pagina: P, ...B, nivelMarca, esc,
  pesos: n => "$" + Math.round(n).toLocaleString("es-AR"),
  comercioDe: f => f[4] || (IDX.tiendas[f[3]] || {}).nombre || f[3],
  colorDe: f => (IDX.tiendas[f[3]] || {}).color || "fh",
  marcaDe: nombre => B.marcaDe(nombre, MARCAS_RE),
  buscarTodo: q => { const c = B.filtroDe(q); return c ? IDX.productos.filter((f, k) => c(N[k])) : []; },
};
vm.createContext(ctx);
vm.runInContext(codigo + "\nthis.analizarConsulta = analizarConsulta;", ctx);

const consultas = ["ssd 1tb", "rtx 4060", "ryzen 5", "monitor 27", "ddr4 16gb", "fuente 650w", "ipad",
  "mouse inalambrico", "webcam", "silla gamer"];
const sal = {};
for (const q of consultas) {
  const A = ctx.analizarConsulta(q);
  sal[q] = !A ? null : { total: A.total, comparables: A.base.length, mediana: A.med,
    picks: A.picks.map(p => [p.clave, p.m.f[2], p.m.f[1]]), excl: A.excl,
    comercios: A.comercios.map(c => [c.nom, c.n]), internacionales: (A.internacionales || []).length };
}
fs.writeFileSync(salida, JSON.stringify(sal, null, 1));
for (const [q, v] of Object.entries(sal)) console.log(q.padEnd(18), v ? `${v.total} avisos, ${v.comparables} comparables, mediana ${v.mediana}` : "sin resultados");
