/* Worker «Afuera» (spec 022): GET /buscar?q= consulta en paralelo las fuentes internacionales que tengan credenciales y devuelve
   los avisos normalizados, de menor a mayor precio (nunca por comision). Cloudflare Workers Free: 10 ms de CPU por pedido (la
   espera de red no cuenta), 50 subpedidos por pedido, 100 mil pedidos por dia.
   - Solo APIs oficiales: eBay Browse, AliExpress Portals y Amazon Creators (apagada hasta tener acceso). Nada de scraping.
   - La consulta se valida con los mismos criterios que lo mas buscado (js/buscadas.js): sin mails, links, telefonos ni documentos.
   - CORS solo para el sitio y localhost; cache de 8 horas por consulta normalizada; tope de 30 busquedas por minuto por IP. */
import Buscadas from "../../js/buscadas.js";
import { AGENTE } from "./fuentes/comun.js";
import * as ebay from "./fuentes/ebay.js";
import * as aliexpress from "./fuentes/aliexpress.js";
import * as amazon from "./fuentes/amazon.js";

const FUENTES = [["ebay", ebay], ["aliexpress", aliexpress], ["amazon", amazon]];
const CACHE_SEG = 8 * 3600;                    // entre 6 y 12 h: los precios de afuera no cambian por minuto
const TOPE = 30, VENTANA_MS = 60 * 1000;       // busquedas por IP por minuto
const ORIGEN_OK = /^(?:https:\/\/pichinchadeldia\.com\.ar|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?)$/;

function cors(origen) {
  const h = { Vary: "Origin" };
  if (ORIGEN_OK.test(origen || "")) Object.assign(h, { "Access-Control-Allow-Origin": origen, "Access-Control-Allow-Methods": "GET, OPTIONS" });
  return h;
}

const json = (datos, estado, extra) => new Response(JSON.stringify(datos), { status: estado,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", ...extra } });

/* Atiende un pedido. deps: fetch, cache (con match/put, la Cache API), ahora() en ISO y tiempoMaximo por fuente en ms.
   El tope por IP y los tokens viven en esta instancia (un isolate del Worker). */
export function crearAtender({ fetch, cache, ahora, tiempoMaximo = 5000 }) {
  const porIp = new Map(), tokens = new Map();

  function excedido(ip, ms) {
    if (porIp.size > 5000) porIp.clear();       // no crece sin limite en un isolate que vive mucho
    const v = porIp.get(ip);
    if (!v || ms - v.inicio >= VENTANA_MS) { porIp.set(ip, { inicio: ms, n: 1 }); return false; }
    return ++v.n > TOPE;
  }

  /* Un pedido a una API con nuestro user-agent; corta a tiempoMaximo y falla si la respuesta no es 2xx. */
  function pedir({ url, method = "GET", headers = {}, body }) {
    let reloj;
    const corte = new Promise((_, no) => { reloj = setTimeout(() => no(new Error("tiempo agotado")), tiempoMaximo); });
    const ida = fetch(url, { method, headers: { ...headers, "User-Agent": AGENTE, Accept: "application/json" }, body })
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    return Promise.race([ida, corte]).finally(() => clearTimeout(reloj));
  }

  /* Tokens de aplicacion: se reusan hasta un minuto antes de vencer. */
  async function token(clave, pedirToken) {
    const ms = Date.parse(ahora()), t = tokens.get(clave);
    if (t && t.vence > ms) return t.valor;
    const r = await pedirToken();
    tokens.set(clave, { valor: r.access_token, vence: ms + ((Number(r.expires_in) || 3600) - 60) * 1000 });
    return r.access_token;
  }

  return async function atender(request, env) {
    const url = new URL(request.url), origen = request.headers.get("Origin"), h = cors(origen);
    if (url.pathname !== "/buscar") return json({ error: "no existe" }, 404, h);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "GET") return json({ error: "solo GET" }, 405, h);
    const fecha = ahora(), ms = Date.parse(fecha);
    if (excedido(request.headers.get("CF-Connecting-IP") || "sin-ip", ms)) return json({ error: "demasiadas busquedas" }, 429, { ...h, "Retry-After": "60" });
    const q = Buscadas.terminoLimpio(url.searchParams.get("q") || "");
    if (!q) return json({ error: "consulta no valida" }, 400, h);

    const clave = "https://afuera.cache/buscar?q=" + encodeURIComponent(q);
    const guardada = await cache.match(clave);
    if (guardada) {
      const r = new Response(guardada.body, guardada);
      for (const [k, v] of Object.entries(h)) r.headers.set(k, v);
      return r;
    }

    const activas = FUENTES.filter(([, f]) => f.activa(env));
    const res = await Promise.allSettled(activas.map(([, f]) => f.buscar(q, env, { pedir, token, fecha, ahoraMs: ms })));
    const fuentes = activas.map(([id], i) => ({ id, ok: res[i].status === "fulfilled", n: res[i].status === "fulfilled" ? res[i].value.length : 0 }));
    const items = res.flatMap(r => (r.status === "fulfilled" ? r.value : [])).sort((a, z) => a.precio - z.precio);
    const salida = json({ consulta: q, fecha, fuentes, items }, 200, {});
    if (fuentes.some(f => f.ok)) {
      const copia = salida.clone();
      copia.headers.set("Cache-Control", `public, max-age=${CACHE_SEG}`);
      await cache.put(clave, copia);
    }
    for (const [k, v] of Object.entries(h)) salida.headers.set(k, v);
    return salida;
  };
}

let instancia = null;
export default {
  fetch(request, env) {
    if (!instancia) instancia = crearAtender({ fetch: (u, i) => fetch(u, i), cache: caches.default, ahora: () => new Date().toISOString() });
    return instancia(request, env);
  },
};
