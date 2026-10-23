/* Tiendamia (spec 023): se lee tiendamia.com.ar dentro de su robots.txt (permite /p/ y /search/; prohibe /producto, /api/, /ajax/,
   carrito y cuenta). www.tiendamia.com da 403 y no se usa. Sin credenciales: se puede apagar con TIENDAMIA = "apagada" en el
   entorno del Worker. Sus precios en dolares ya traen el envio (la ficha dice «U$S 198,88 … con envío»), asi que envio va en 0.
   Primera version de los parsers: OmniRoute `revision` (gpt-oss-120b), corrida contra fixtures reales del 23/10/2026. */
import { aviso, sinNulos, POR_FUENTE } from "./comun.js";

export const activa = env => env.TIENDAMIA !== "apagada";

export function decodificar(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta\\s+property=["']${prop}["']\\s+content=["']([^"']*)["']`, "i"));
  return m ? decodificar(m[1]) : null;
};

/* La ficha /p/<origen>/<id>/<slug>: el nombre completo y el precio salen de los datos de la pagina (item_name, final_price). */
export function parsearFichaTiendamia(html, url, fecha) {
  let nombre = null;
  const n = html.match(/"item_name"\s*:\s*"([^"]*)"/);
  if (n) { try { nombre = JSON.parse(`"${n[1]}"`); } catch (e) { nombre = n[1]; } }
  if (!nombre) nombre = meta(html, "og:title");
  const p = html.match(/"final_price"\s*:\s*(\d+(?:\.\d+)?)/) || html.match(/"price"\s*:\s*"(\d+(?:\.\d+)?)"/);
  if (!nombre || !p) return null;
  const img = meta(html, "og:image");
  return aviso({ fuente: "tiendamia", nombre, precio: Number(p[1]), moneda: "USD", envio: 0, url, afiliado: false, fecha,
    imagen: img ? img.replace(/UXTMWIDTH/g, "UX438").replace(/UYTMHEIGHT/g, "UY408") : null });
}

/* La busqueda /search/amazon/<palabras>: una tarjeta por producto, sin repetir el mismo producto en otro color. */
export function parsearBusquedaTiendamia(html, fecha, max = POR_FUENTE) {
  const vistos = new Set(), salida = [];
  for (const t of String(html).split('<div class="product-card"').slice(1)) {
    if (salida.length >= max) break;
    const precio = t.match(/data-price\s*=\s*"([^"]*)"/i), nombre = t.match(/data-name\s*=\s*"([^"]*)"/i);
    const enlace = t.match(/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*product-card__link/i);
    if (!precio || !nombre || !enlace) continue;
    const clave = decodificar(nombre[1]) + "|" + precio[1];
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const img = t.match(/<img[^>]*class=["'][^"']*product-card__image[^"']*["'][^>]*src=["']([^"']+)["']/i);
    salida.push(aviso({ fuente: "tiendamia", nombre: decodificar(nombre[1]), precio: precio[1], moneda: "USD", envio: 0,
      url: enlace[1], imagen: img ? img[1] : null, afiliado: false, fecha }));
  }
  return sinNulos(salida);
}

export const urlBusqueda = q => "https://tiendamia.com.ar/search/amazon/" + q.split(" ").map(encodeURIComponent).join("+");

export async function buscar(q, env, { pedirTexto, fecha }) {
  return parsearBusquedaTiendamia(await pedirTexto(urlBusqueda(q)), fecha, 40);   // toda la pagina: index.js filtra y recorta
}
