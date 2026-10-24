/* Lo comun a las fuentes del Worker «Afuera» (spec 022): el aviso normalizado y el user-agent con el que nos presentamos.
   Primera version de `aviso` y de los parsers de cada fuente: OmniRoute `revision` (gpt-oss-120b), corrida contra los tests. */
import Buscador from "../../../js/buscador.js";

export const AGENTE = "LaPichincha-verificador/1.0 (+https://pichinchadeldia.com.ar)";
export const POR_FUENTE = 5;   // avisos por fuente: la pagina muestra pocos y la cache guarda poco

const aHttps = s => (typeof s === "string" && s.startsWith("http://") ? "https://" + s.slice(7) : s);
const esHttps = s => { try { return new URL(s).protocol === "https:"; } catch (e) { return false; } };
const dos = n => Math.round(n * 100) / 100;

/* Un aviso como lo devuelve el Worker, o null si le falta lo indispensable (nombre, precio positivo, moneda ISO, url https).
   La imagen es opcional: si no es https, va null. precioArs, solo si la fuente ya da el precio puesto en pesos (Loquieroaca). */
export function aviso({ fuente, nombre, precio, moneda, envio, precioArs, url, imagen, afiliado, fecha }) {
  if (typeof nombre !== "string") return null;
  nombre = nombre.replace(/\s+/g, " ").trim().slice(0, 160);
  const p = Number(String(precio));
  if (!nombre || !Number.isFinite(p) || p <= 0) return null;
  if (typeof moneda !== "string" || !/^[A-Z]{3}$/.test(moneda)) return null;
  const e = envio === undefined || envio === null || envio === "" ? NaN : Number(envio);
  url = aHttps(url);
  if (typeof url !== "string" || !esHttps(url)) return null;
  const img = aHttps(imagen);
  return { fuente, nombre, precio: dos(p), moneda, envio: Number.isFinite(e) && e >= 0 ? dos(e) : null, precioArs: Number(precioArs) > 0 ? dos(Number(precioArs)) : null, url,
    imagen: typeof img === "string" && esHttps(img) ? img : null, afiliado: Boolean(afiliado), fecha };
}

export const sinNulos = lista => lista.filter(Boolean);

/* Relevancia (spec 023): entra el aviso cuyo nombre tiene todas las palabras significativas de la consulta. Los conectores
   («by», «de», «con»...) no cuentan: «soundcore aeroclip 2 by anker» encuentra «Soundcore Anker AeroClip 2 - ...». Las fuentes
   que buscan por texto suelto (Tiendamia) traen de todo; sin esto, ordenar por precio pone arriba lo que no se busco. */
const CONECTORES = new Set(["by", "de", "del", "la", "el", "los", "las", "con", "para", "y", "en", "the", "for", "and", "with", "of"]);
const palabras = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);

/* Un accesorio nombra primero lo que es y despues el producto («Funda de silicona para ... AeroClip 2»); el producto, al reves
   («Soundcore Anker AeroClip 2 y estuche...»). Se corta el nombre en la primera palabra de accesorio: si lo de antes no nombra
   todo lo buscado, es un accesorio. Vale salvo que se busque justamente esa palabra («funda aeroclip 2»).
   «para», «for» y «compatible» cortan igual (24/10: «AKNK Compatible con estación de carga GPW para Logitech G502» salia primero
   buscando «logitech g502»), salvo que la consulta los diga («mouse para notebook»). */
const ACCESORIOS = new Set(["funda", "fundas", "estuche", "case", "cover", "protector", "carcasa", "correa", "almohadillas", "puntas",
  "repuesto", "soporte", "cable", "cargador", "adaptador", "skin", "sticker", "vinilo", "mica", "vidrio", "estacion", "dock",
  "reemplazo", "replacement"]);
const NEXOS = new Set(["para", "for", "compatible", "compatibles"]);

export function relevantes(items, q) {
  const dichas = palabras(q), claves = dichas.filter(p => !CONECTORES.has(p));
  if (!claves.length) return items;
  const buscaAccesorio = dichas.some(p => ACCESORIOS.has(p));
  // Lo reacondicionado («Renewed», «renovada») no compite con lo nuevo salvo que se pida, como en el indice (24/10: buscando
  // «rtx 4070», la primera de Tiendamia era una «(renovada)»).
  const pideUsado = Buscador.RE_USADO.test(Buscador.normal(String(q)));
  return items.filter(i => {
    const w = palabras(i.nombre);
    if (!claves.every(c => w.includes(c))) return false;
    if (!pideUsado && Buscador.RE_USADO.test(Buscador.normal(String(i.nombre || "")))) return false;
    if (buscaAccesorio) return true;
    const corte = w.findIndex(p => (ACCESORIOS.has(p) || NEXOS.has(p)) && !dichas.includes(p));
    return corte < 0 || claves.every(c => w.slice(0, corte).includes(c));
  });
}
