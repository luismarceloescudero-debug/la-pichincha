/* AliExpress Portals: aliexpress.affiliate.product.query por https://api-sg.aliexpress.com/sync (Business Interface), verificado
   en la doc del Open Platform el 23/10/2026. ship_to_country «Filter products that can be sent to that country»; la firma es
   HMAC-SHA256 de los parametros ordenados (clave+valor), en hexa mayuscula. Secretos: ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET y
   ALIEXPRESS_TRACKING_ID (el promotion_link que devuelve ya es el enlace de afiliado). */
import { aviso, sinNulos, POR_FUENTE } from "./comun.js";

export const activa = env => Boolean(env.ALIEXPRESS_APP_KEY && env.ALIEXPRESS_APP_SECRET && env.ALIEXPRESS_TRACKING_ID);

export async function firmar(params, secreto) {
  const cod = new TextEncoder();
  const texto = Object.keys(params).sort().filter(k => params[k] !== "" && params[k] !== null && params[k] !== undefined)
    .map(k => k + params[k]).join("");
  const clave = await crypto.subtle.importKey("raw", cod.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = new Uint8Array(await crypto.subtle.sign("HMAC", clave, cod.encode(texto)));
  return [...firma].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export async function pedidoAliexpress(q, env, ahoraMs) {
  const p = { method: "aliexpress.affiliate.product.query", app_key: env.ALIEXPRESS_APP_KEY, sign_method: "sha256", timestamp: String(ahoraMs),
    keywords: q, ship_to_country: "AR", target_currency: "USD", target_language: "ES", tracking_id: env.ALIEXPRESS_TRACKING_ID,
    page_size: String(POR_FUENTE) };
  p.sign = await firmar(p, env.ALIEXPRESS_APP_SECRET);
  return { url: "https://api-sg.aliexpress.com/sync?" + new URLSearchParams(p), headers: {} };
}

export function parsearAliexpress(json, fecha) {
  const r = (json && json.aliexpress_affiliate_product_query_response && json.aliexpress_affiliate_product_query_response.resp_result)
    || (json && json.resp_result) || {};
  const prods = r.result && r.result.products;
  const lista = Array.isArray(prods) ? prods : prods && Array.isArray(prods.product) ? prods.product : [];
  return sinNulos(lista.map(p => aviso({ fuente: "aliexpress", nombre: p.product_title, precio: p.target_sale_price || p.sale_price,
    moneda: p.target_sale_price ? p.target_sale_price_currency : p.sale_price_currency, envio: null,
    url: p.promotion_link || p.product_detail_url, imagen: p.product_main_image_url, afiliado: Boolean(p.promotion_link), fecha })));
}

export async function buscar(q, env, { pedir, fecha, ahoraMs }) {
  return parsearAliexpress(await pedir(await pedidoAliexpress(q, env, ahoraMs)), fecha);
}
