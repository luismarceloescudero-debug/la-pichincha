/* Amazon por la Creators API (la PA-API se retiro). Apagada hasta que existan AMAZON_CREATORS_ID y AMAZON_CREATORS_SECRET: la doc
   oficial pide 10 ventas calificadas en los ultimos 30 dias para usarla. Nada de scraping de Amazon.
   Verificado en la doc el 23/10/2026: el token (api.amazon.com/auth/o2/token, client credentials, scope creatorsapi::default),
   la cabecera x-marketplace y los campos de SearchItems. La ruta catalog/v1/searchItems sale por analogia con el ejemplo
   documentado (catalog/v1/getItems): confirmarla con la primera llamada real. */
import { aviso, sinNulos, POR_FUENTE } from "./comun.js";

export const activa = env => Boolean(env.AMAZON_CREATORS_ID && env.AMAZON_CREATORS_SECRET);
const TAG = "lapichincha-20";

export function pedidoTokenAmazon(env) {
  return { url: "https://api.amazon.com/auth/o2/token", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials", client_id: env.AMAZON_CREATORS_ID, client_secret: env.AMAZON_CREATORS_SECRET,
      scope: "creatorsapi::default" }) };
}

export function pedidoAmazon(q, env, token) {
  return { url: "https://creatorsapi.amazon/catalog/v1/searchItems", method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "x-marketplace": "www.amazon.com" },
    body: JSON.stringify({ partnerTag: TAG, keywords: q, marketplace: "www.amazon.com", itemCount: POR_FUENTE,
      resources: ["itemInfo.title", "images.primary.medium", "offersV2.listings.price"] }) };
}

/* Un item de SearchItems o de GetItems (mismos campos), como aviso. Se rotula afiliado solo si el link lleva el tag. */
function deItem(it, fecha) {
  const m = it.offersV2 && it.offersV2.listings && it.offersV2.listings[0] && it.offersV2.listings[0].price
    && it.offersV2.listings[0].price.money || {};
  const img = it.images && it.images.primary && it.images.primary.medium;
  return aviso({ fuente: "amazon", nombre: it.itemInfo && it.itemInfo.title && it.itemInfo.title.displayValue, precio: m.amount,
    moneda: m.currency, envio: null, url: it.detailPageURL, imagen: img && img.url,
    afiliado: /[?&]tag=/.test(it.detailPageURL || ""), fecha });
}

export function parsearAmazon(json, fecha) {
  const items = json && json.searchResult && Array.isArray(json.searchResult.items) ? json.searchResult.items : [];
  return sinNulos(items.map(it => deItem(it, fecha)));
}

/* GetItems, el unico ejemplo con ruta documentada (catalog/v1/getItems): para un link pegado con su ASIN (spec 023).
   La respuesta (itemsResult.items) sigue la forma de SearchItems: confirmarla con la primera llamada real. */
export function pedidoGetItems(asin, env, token) {
  return { url: "https://creatorsapi.amazon/catalog/v1/getItems", method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "x-marketplace": "www.amazon.com" },
    body: JSON.stringify({ itemIds: [asin], itemIdType: "ASIN", marketplace: "www.amazon.com", partnerTag: TAG,
      resources: ["itemInfo.title", "images.primary.medium", "offersV2.listings.price"] }) };
}

export async function leerItem(asin, env, { pedir, token, fecha }) {
  const t = await token("amazon", () => pedir({ ...pedidoTokenAmazon(env), method: "POST" }));
  const j = await pedir(pedidoGetItems(asin, env, t));
  const it = j && j.itemsResult && Array.isArray(j.itemsResult.items) ? j.itemsResult.items[0] : null;
  return it ? deItem(it, fecha) : null;
}

export async function buscar(q, env, { pedir, token, fecha }) {
  const t = await token("amazon", () => pedir({ ...pedidoTokenAmazon(env), method: "POST" }));
  return parsearAmazon(await pedir(pedidoAmazon(q, env, t)), fecha);
}
