const $ = (s, r = document) => r.querySelector(s);
const pesos = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const icono = n => `<svg class="ico"><use href="#i-${n}"/></svg>`;

/* Funciones puras del buscador: viven en js/buscador.js, con sus tests. */
const { normal, normalBusq, mediana, pisoDeGama, specsDe, motivoExclusion, sellosDe, categoriaDe } = Buscador;

const P = DATOS.productos || [];
const T = DATOS.tiendas || {};
const porId = Object.fromEntries(P.map(p => [p.id, p]));
const de = tipo => P.filter(p => p.tipo === tipo).sort((a, b) => a.podio - b.podio);
const rams = de("ram"), cams = de("webcam");

/* Comparativa agrupa las categorias analizadas a fondo. Sumar una es agregar
   una entrada aca y los productos correspondientes en datos.json. */
const CATEGORIAS = [
  { id: "ram", eti: "Memorias DDR4 16GB", lista: rams, ico: "chip",
    claves: ["ddr4", "ddr5", "memoria ram", "memoria ddr", "dimm", "16gb 3200", "ram 16gb"],
    titulo: "Memorias DDR4 16GB: las 3 mejores por marca/precio",
    sub: "Módulo único de 16GB a 3200 MHz para escritorio. El detalle de specs está dentro de cada tarjeta." },
  { id: "webcam", eti: "Webcams", lista: cams, ico: "cam",
    claves: ["webcam", "camara web", "cam web"],
    titulo: "Webcams: las 3 que valen la pena",
    sub: "De las trece relevadas en las mismas tiendas, estas tres son las que justifican lo que cuestan." },
];
const catDe = p => (p && p.tipo === "webcam" ? "webcam" : "ram");
let CAT = (() => { try { return localStorage.getItem("cat") || "ram"; } catch (e) { return "ram"; } })();
if (!CATEGORIAS.some(c => c.id === CAT)) CAT = "ram";

const VISTAS = [
  { id: "comparativa", eti: "Comparativa", ico: "balanza", n: () => CATEGORIAS.length },
  { id: "tiendas", eti: "Tiendas", ico: "store", n: () => 3 },
  { id: "ofertas", eti: "Ofertas", ico: "fuego",
    n: () => OFERTAS ? OFERTAS.propias.length + OFERTAS.publicadas.length : null },
  { id: "buscar", eti: "Buscar", ico: "lupa", n: () => IDX ? IDX.productos.length : null },
  { id: "veredicto", eti: "Veredicto", ico: "trofeo", n: () => null }
];
