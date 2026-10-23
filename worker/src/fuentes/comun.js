/* Lo comun a las fuentes del Worker «Afuera» (spec 022): el aviso normalizado y el user-agent con el que nos presentamos.
   Primera version de `aviso` y de los parsers de cada fuente: OmniRoute `revision` (gpt-oss-120b), corrida contra los tests. */
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
