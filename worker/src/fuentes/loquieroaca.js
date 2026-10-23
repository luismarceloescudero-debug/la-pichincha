/* Loquieroaca (spec 023): solo la ficha /products/<id> que pega una persona, de a una y con cache. robots.txt permite todo;
   una ficha no es una busqueda, asi que no toca su cupo de busquedas (por ese cupo su buscador no se consulta: spec 022).
   La ficha trae el precio final en pesos, con impuestos y envio: en cuotas, en un pago (el mas bajo, como el precio de
   transferencia del indice) y uno tachado que no es un precio real y no se usa.
   Primera version del parser: OmniRoute `revision` (gpt-oss-120b), corrida contra un fixture real del 23/10/2026. */
import { aviso } from "./comun.js";
import { decodificar } from "./tiendamia.js";

/* "$ 598.462,33" -> 598462.33 */
export function pesosDe(texto) {
  const m = String(texto === undefined || texto === null ? "" : texto).match(/\$\s*([\d.]+(?:,\d{1,2})?)/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
}

export function parsearFichaLoquieroaca(html, url, fecha) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const nombre = h1 ? decodificar(h1[1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()) : "";
  const grande = html.match(/<p[^>]*class="[^"]*font-bold[^"]*text-3xl[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const precioCuotas = grande ? pesosDe(grande[1]) : null;
  const pago = html.match(/o\s*(\$\s*[\d.,]+)\s*en un pago/i);
  const unPago = pago ? pesosDe(pago[1]) : precioCuotas;
  if (!nombre || !unPago) return null;
  const img = html.match(/https:\/\/images-na\.ssl-images-amazon\.com\/images\/I\/[^"'\s]+/i);
  const a = aviso({ fuente: "loquieroaca", nombre, precio: unPago, moneda: "ARS", envio: 0, precioArs: unPago, url,
    imagen: img ? img[0] : null, afiliado: false, fecha });
  return a && { ...a, precioCuotas };
}
