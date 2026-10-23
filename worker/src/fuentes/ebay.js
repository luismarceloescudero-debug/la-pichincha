/* eBay Browse API (item_summary/search), verificada en la doc el 23/10/2026: token de aplicacion (client credentials, scope
   publico), filter=deliveryCountry:AR («Only items that can be shipped to the specified country are returned») y la cabecera
   X-EBAY-C-ENDUSERCTX con contextualLocation (envio a Argentina) y, si hay campaña de eBay Partner Network, affiliateCampaignId
   (entonces la respuesta trae itemAffiliateWebUrl). Secretos: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET y opcional EBAY_CAMPAIGN_ID. */
import { aviso, sinNulos, POR_FUENTE } from "./comun.js";

export const activa = env => Boolean(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET);

export function pedidoTokenEbay(env) {
  return { url: "https://api.ebay.com/identity/v1/oauth2/token",
    headers: { Authorization: "Basic " + btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope") };
}

export function pedidoEbay(q, env, token) {
  const p = new URLSearchParams({ q, limit: String(POR_FUENTE), filter: "deliveryCountry:AR" });
  const ctx = (env.EBAY_CAMPAIGN_ID ? `affiliateCampaignId=${env.EBAY_CAMPAIGN_ID},` : "") + "contextualLocation=" + encodeURIComponent("country=AR");
  return { url: "https://api.ebay.com/buy/browse/v1/item_summary/search?" + p,
    headers: { Authorization: "Bearer " + token, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US", "X-EBAY-C-ENDUSERCTX": ctx } };
}

export function parsearEbay(json, fecha) {
  const items = json && Array.isArray(json.itemSummaries) ? json.itemSummaries : [];
  return sinNulos(items.map(it => {
    const moneda = it.price && it.price.currency;
    const op = (it.shippingOptions || []).find(s => s.shippingCost && s.shippingCost.currency === moneda && s.shippingCost.value !== undefined);
    return aviso({ fuente: "ebay", nombre: it.title, precio: it.price && it.price.value, moneda, envio: op ? op.shippingCost.value : null,
      url: it.itemAffiliateWebUrl || it.itemWebUrl, imagen: it.image && it.image.imageUrl, afiliado: Boolean(it.itemAffiliateWebUrl), fecha });
  }));
}

/* La busqueda completa. `pedir(pedido)` hace el fetch con el user-agent y el tiempo maximo; `token(clave, pedirToken)` lo reusa. */
export async function buscar(q, env, { pedir, token, fecha }) {
  const t = await token("ebay", () => pedir({ ...pedidoTokenEbay(env), method: "POST" }));
  return parsearEbay(await pedir(pedidoEbay(q, env, t)), fecha);
}
