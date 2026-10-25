/* Worker «Afuera» (specs 022 y 023). Cloudflare Workers Free: 10 ms de CPU por pedido (la espera de red no cuenta), 50
   subpedidos por pedido, 100 mil pedidos por dia.
   - GET /buscar?q= consulta en paralelo las fuentes activas y devuelve los avisos normalizados, de menor a mayor precio (nunca
     por comision): eBay Browse, AliExpress Portals y Amazon Creators por sus APIs oficiales (cada una con sus credenciales) y
     Tiendamia leyendo tiendamia.com.ar dentro de su robots.txt (sin credenciales; se apaga con TIENDAMIA = "apagada").
   - GET /enlace?url= lee UNA pagina que pego una persona: la ficha de Tiendamia o de Loquieroaca (dentro de su robots.txt), o
     el producto por la API de Amazon o de eBay si hay credenciales. Solo se pide la URL canonica que arma js/importar.js
     (host fijo, nunca la que llega), asi que no sirve para pedirle otra cosa a nadie. Amazon nunca se lee sin su API.
   - La consulta se valida con los mismos criterios que lo mas buscado (js/buscadas.js): sin mails, links, telefonos ni documentos.
   - CORS solo para el sitio y localhost; cache de 8 horas por consulta o por enlace; tope de 30 pedidos por minuto por IP. */
import Buscadas from "../../js/buscadas.js";
import Importar from "../../js/importar.js";
import { AGENTE, POR_FUENTE, relevantes } from "./fuentes/comun.js";
import * as ebay from "./fuentes/ebay.js";
import * as aliexpress from "./fuentes/aliexpress.js";
import * as amazon from "./fuentes/amazon.js";
import * as tiendamia from "./fuentes/tiendamia.js";
import { parsearFichaLoquieroaca } from "./fuentes/loquieroaca.js";

const FUENTES = [["ebay", ebay], ["aliexpress", aliexpress], ["amazon", amazon], ["tiendamia", tiendamia]];
const CACHE_SEG = 8 * 3600;                    // entre 6 y 12 h: los precios de afuera no cambian por minuto
const CACHE_PARCIAL_SEG = 900;                 // si alguna fuente fallo, poco: una caida pasajera no queda 8 horas
const CACHE_VERSION = "031";                   // cambia cuando cambian las reglas: lo guardado con las anteriores no se usa
const TOPE = 30, VENTANA_MS = 60 * 1000;       // pedidos por IP por minuto
const ORIGEN_OK = /^(?:https:\/\/pichinchadeldia\.com\.ar|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?)$/;

/* Defensa propia, ademas de la URL canonica de js/importar.js: solo se leen paginas de estos dos hosts y por https. */
const PAGINAS = new Set(["tiendamia.com.ar", "www.loquieroaca.com"]);
export function paginaPermitida(url) {
  try { const u = new URL(url); return u.protocol === "https:" && PAGINAS.has(u.hostname); } catch (e) { return false; }
}

function cors(origen) {
  const h = { Vary: "Origin" };
  if (ORIGEN_OK.test(origen || "")) Object.assign(h, { "Access-Control-Allow-Origin": origen, "Access-Control-Allow-Methods": "GET, OPTIONS" });
  return h;
}

// Un error (400, 404, 429) no se guarda: un «demasiadas busquedas» no tiene que quedar 15 minutos en el navegador.
const json = (datos, estado, extra) => new Response(JSON.stringify(datos), { status: estado,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": estado >= 400 ? "no-store" : "public, max-age=900", ...extra } });

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

  /* Un pedido afuera con nuestro user-agent; corta a tiempoMaximo y falla si la respuesta no es 2xx. JSON o HTML. */
  function traer({ url, method = "GET", headers = {}, body }, html) {
    let reloj;
    const corte = new Promise((_, no) => { reloj = setTimeout(() => no(new Error("tiempo agotado")), tiempoMaximo); });
    const ida = fetch(url, { method, body, headers: { ...headers, "User-Agent": AGENTE, Accept: html ? "text/html" : "application/json" } })
      .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        // fetch sigue las redirecciones: una pagina que termina en otro host no se lee (paginaPermitida vale tambien para el destino)
        if (html && r.url && !paginaPermitida(r.url)) throw new Error("redireccion a otro sitio");
        return html ? r.text() : r.json();
      });
    return Promise.race([ida, corte]).finally(() => clearTimeout(reloj));
  }
  const pedir = p => traer(p, false), pedirTexto = url => traer({ url }, true);

  /* Tokens de aplicacion: se reusan hasta un minuto antes de vencer. */
  async function token(clave, pedirToken) {
    const ms = Date.parse(ahora()), t = tokens.get(clave);
    if (t && t.vence > ms) return t.valor;
    const r = await pedirToken();
    tokens.set(clave, { valor: r.access_token, vence: ms + ((Number(r.expires_in) || 3600) - 60) * 1000 });
    return r.access_token;
  }

  /* Lo que se cachea responde con los permisos CORS de quien pregunta. */
  async function desdeCache(clave, h) {
    const guardada = await cache.match(clave);
    if (!guardada) return null;
    const r = new Response(guardada.body, guardada);
    for (const [k, v] of Object.entries(h)) r.headers.set(k, v);
    return r;
  }
  /* segundos: cuanto se guarda en la cache del Worker (0: no se guarda). */
  async function responder(datos, clave, segundos, h) {
    const salida = json(datos, 200, {});
    if (segundos > 0) {
      const copia = salida.clone();
      copia.headers.set("Cache-Control", `public, max-age=${segundos}`);
      await cache.put(clave, copia);
    }
    for (const [k, v] of Object.entries(h)) salida.headers.set(k, v);
    return salida;
  }

  async function buscar(url, env, h, fecha, ms) {
    const q = Buscadas.terminoLimpio(url.searchParams.get("q") || "");
    if (!q) return json({ error: "consulta no valida" }, 400, h);
    const clave = `https://afuera.cache/${CACHE_VERSION}/buscar?q=` + encodeURIComponent(q);
    const guardada = await desdeCache(clave, h);
    if (guardada) return guardada;
    const activas = FUENTES.filter(([, f]) => f.activa(env));
    const res = await Promise.allSettled(activas.map(([, f]) => f.buscar(q, env, { pedir, pedirTexto, token, fecha, ahoraMs: ms })
      .then(items => relevantes(items, q).slice(0, POR_FUENTE))));
    // Una fuente que falla dice por que («HTTP 401», «tiempo agotado»): son nuestros propios mensajes, sin claves ni respuestas.
    const fuentes = activas.map(([id], i) => res[i].status === "fulfilled" ? { id, ok: true, n: res[i].value.length }
      : { id, ok: false, n: 0, motivo: String((res[i].reason && res[i].reason.message) || "error").slice(0, 80) });
    const items = res.flatMap(r => (r.status === "fulfilled" ? r.value : [])).sort((a, z) => a.precio - z.precio);
    const segundos = !fuentes.some(f => f.ok) ? 0 : fuentes.every(f => f.ok) ? CACHE_SEG : CACHE_PARCIAL_SEG;
    return responder({ consulta: q, fecha, fuentes, items }, clave, segundos, h);
  }

  /* Un link pegado: que se puede leer de cada tienda y con que. Devuelve el aviso, o un motivo si no se lee. */
  async function leer(e, env, fecha) {
    const deps = { pedir, token, fecha };
    if ((e.tienda === "tiendamia" || e.tienda === "loquieroaca") && !paginaPermitida(e.url)) return { motivo: "Ese link no se puede leer." };
    if (e.tienda === "tiendamia") return { item: tiendamia.parsearFichaTiendamia(await pedirTexto(e.url), e.url, fecha) };
    if (e.tienda === "loquieroaca") return { item: parsearFichaLoquieroaca(await pedirTexto(e.url), e.url, fecha) };
    if (e.tienda === "amazon") {
      if (!e.id || e.dominio || !amazon.activa(env)) return { motivo: "Amazon no se lee sin su API (Creators API): escribí el precio a mano." };
      return { item: await amazon.leerItem(e.id, env, deps) };
    }
    if (!ebay.activa(env)) return { motivo: "eBay se lee con su API, que todavía no está configurada: escribí el precio a mano." };
    return { item: await ebay.leerItem(e.id, env, deps) };
  }

  async function enlace(url, env, h, fecha) {
    const e = Importar.parsearEnlace(url.searchParams.get("url") || "");
    if (!e) return json({ error: "enlace no reconocido" }, 400, h);
    const clave = `https://afuera.cache/${CACHE_VERSION}/enlace?u=` + encodeURIComponent(e.url);
    const guardada = await desdeCache(clave, h);
    if (guardada) return guardada;
    let r;
    // 24/10: Tiendamia y Loquieroaca pasaron a responder 403 con el desafio anti-bots de Cloudflare: no se saltea, se dice.
    try { r = await leer(e, env, fecha); } catch (err) {
      r = { motivo: /HTTP 403/.test(String(err && err.message)) && (e.tienda === "tiendamia" || e.tienda === "loquieroaca")
        ? `${e.tienda === "tiendamia" ? "Tiendamia" : "Loquieroacá"} no deja leer su página automáticamente: escribí el precio a mano.`
        : "La tienda no respondió: escribí el precio a mano." };
    }
    if (!r.motivo && !r.item) r = { motivo: "No se pudo leer el precio de esa página: escribí el precio a mano." };
    return responder({ enlace: e, leido: Boolean(r.item), item: r.item || null, motivo: r.motivo || null, fecha }, clave, r.item ? CACHE_SEG : 0, h);
  }

  return async function atender(request, env) {
    const url = new URL(request.url), origen = request.headers.get("Origin"), h = cors(origen);
    if (url.pathname !== "/buscar" && url.pathname !== "/enlace") return json({ error: "no existe" }, 404, h);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "GET") return json({ error: "solo GET" }, 405, h);
    const fecha = ahora(), ms = Date.parse(fecha);
    if (excedido(request.headers.get("CF-Connecting-IP") || "sin-ip", ms)) return json({ error: "demasiadas busquedas" }, 429, { ...h, "Retry-After": "60" });
    return url.pathname === "/buscar" ? buscar(url, env, h, fecha, ms) : enlace(url, env, h, fecha);
  };
}

let instancia = null;
export default {
  fetch(request, env) {
    if (!instancia) instancia = crearAtender({ fetch: (u, i) => fetch(u, i), cache: caches.default, ahora: () => new Date().toISOString() });
    return instancia(request, env);
  },
};
