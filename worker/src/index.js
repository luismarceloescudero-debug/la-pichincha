/* Worker «Afuera» (specs 022 y 023). Cloudflare Workers Free: 10 ms de CPU por pedido (la espera de red no cuenta), 50
   subpedidos por pedido, 100 mil pedidos por dia.
   - GET /buscar?q= consulta en paralelo las fuentes activas y devuelve los avisos normalizados, de menor a mayor precio (nunca
     por comision): eBay Browse, AliExpress Portals y Amazon Creators por sus APIs oficiales (cada una con sus credenciales) y
     Tiendamia leyendo tiendamia.com.ar dentro de su robots.txt (sin credenciales; se apaga con TIENDAMIA = "apagada").
   - GET /enlace?url= lee UNA pagina que pego una persona: la ficha de Tiendamia o de Loquieroaca (dentro de su robots.txt), o
     el producto por la API de Amazon o de eBay si hay credenciales. Solo se pide la URL canonica que arma js/importar.js
     (host fijo, nunca la que llega), asi que no sirve para pedirle otra cosa a nadie. Amazon nunca se lee sin su API.
   - La consulta se valida con los mismos criterios que lo mas buscado (js/buscadas.js): sin mails, links, telefonos ni documentos.
   - POST /contacto (spec 046) manda el formulario de /contacto/ por correo con el binding send_email de Cloudflare (Email
     Routing): destino y remitente salen de CONTACTO_DESTINO y CONTACTO_REMITENTE, nunca del codigo; sin binding o sin esas
     variables responde 503. Campo trampa, tiempo minimo desde que se cargo el formulario y un tope propio por IP.
   - Spec 053: con el secreto RESEND_API_KEY, tras mandar el mensaje se manda un acuse de texto fijo a quien escribio (por Resend);
     la respuesta suma acuse: true/false. Sin la clave todo sigue como antes.
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
const CACHE_VERSION = "033";                   // cambia cuando cambian las reglas: lo guardado con las anteriores no se usa
const TOPE = 30, VENTANA_MS = 60 * 1000;       // pedidos por IP por minuto
const TOPE_CONTACTO = 5, VENTANA_CONTACTO_MS = 10 * 60 * 1000;   // mensajes por IP cada 10 minutos
const ORIGEN_OK = /^(?:https:\/\/pichinchadeldia\.com\.ar|http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?)$/;

/* Defensa propia, ademas de la URL canonica de js/importar.js: solo se leen paginas de estos dos hosts y por https. */
const PAGINAS = new Set(["tiendamia.com.ar", "www.loquieroaca.com"]);
export function paginaPermitida(url) {
  try { const u = new URL(url); return u.protocol === "https:" && PAGINAS.has(u.hostname); } catch (e) { return false; }
}

function cors(origen, contacto) {
  const h = { Vary: "Origin" };
  if (ORIGEN_OK.test(origen || "")) Object.assign(h, { "Access-Control-Allow-Origin": origen, "Access-Control-Allow-Methods": contacto ? "POST, OPTIONS" : "GET, OPTIONS" },
    contacto ? { "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" } : {});
  return h;
}

/* --- Spec 046: el formulario de contacto --- */
export const MOTIVOS = { consulta: "Consulta", error: "Un precio o dato mal", tienda: "Soy de una tienda", prensa: "Prensa", otro: "Otro" };
export const LARGOS = { nombre: 80, correo: 254, mensajeMin: 10, mensaje: 4000, cuerpo: 16000 };
export const ESPERA_MIN_MS = 3000;            // un formulario enviado antes de 3 s de cargado lo lleno un programa
const CORREO_OK = /^[^\s@<>()[\]",;:\\]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;     // el mensaje conserva sus saltos de linea; el resto, nada

/* Valida lo que llega del formulario. Devuelve { datos } limpios o { error, campo } con un texto para mostrarle a la persona.
   Nombre y correo van a cabeceras del mail: sin saltos de linea, asi no se puede inyectar otra cabecera. */
export function validarContacto(c) {
  if (!c || typeof c !== "object") return { error: "Faltan los datos del formulario." };
  const texto = v => (typeof v === "string" ? v : "");
  const nombre = texto(c.nombre).replace(/[\r\n\t]+/g, " ").replace(CONTROL, "").trim();
  const correo = texto(c.correo).trim();
  const mensaje = texto(c.mensaje).replace(/\r\n?/g, "\n").replace(CONTROL, "").trim();
  if (nombre.length > LARGOS.nombre) return { error: `El nombre puede tener hasta ${LARGOS.nombre} caracteres.`, campo: "nombre" };
  if (!correo) return { error: "Falta tu correo para poder responderte.", campo: "correo" };
  if (correo.length > LARGOS.correo || !CORREO_OK.test(correo)) return { error: "Revisá el correo: no parece una dirección válida.", campo: "correo" };
  if (!Object.prototype.hasOwnProperty.call(MOTIVOS, c.motivo)) return { error: "Elegí un motivo.", campo: "motivo" };
  if (mensaje.length < LARGOS.mensajeMin) return { error: `El mensaje es muy corto: escribí al menos ${LARGOS.mensajeMin} caracteres.`, campo: "mensaje" };
  if (mensaje.length > LARGOS.mensaje) return { error: `El mensaje puede tener hasta ${LARGOS.mensaje} caracteres.`, campo: "mensaje" };
  return { datos: { nombre, correo, motivo: c.motivo, mensaje } };
}

const base64 = s => { let b = ""; for (const x of new TextEncoder().encode(s)) b += String.fromCharCode(x); return btoa(b); };
const encabezado = s => (/^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${base64(s)}?=`);   // RFC 2047 si no es ASCII

/* El mail en crudo (RFC 5322), en texto plano UTF-8 y base64. Reply-To es quien escribio: se contesta desde el correo. */
export function armarCorreo({ nombre, correo, motivo, mensaje }, { remitente, destino, fecha, id }) {
  const dominio = remitente.split("@")[1];
  const asunto = `[La Pichincha] ${MOTIVOS[motivo]}${nombre ? " de " + nombre : ""}`.slice(0, 150);
  const cuerpo = [`Motivo: ${MOTIVOS[motivo]}`, `Nombre: ${nombre || "(sin nombre)"}`, `Correo: ${correo}`, `Enviado: ${fecha}`, "",
    mensaje.replace(/\n/g, "\r\n"), "", "-- ", "Llegó por el formulario de https://pichinchadeldia.com.ar/contacto/. Respondé este correo para contestarle."].join("\r\n");
  const lineas = base64(cuerpo).match(/.{1,76}/g) || [];
  return [`From: ${encabezado("La Pichincha (contacto)")} <${remitente}>`, `To: <${destino}>`, `Reply-To: <${correo}>`,
    `Subject: ${encabezado(asunto)}`, `Date: ${new Date(fecha).toUTCString()}`, `Message-ID: <${id}@${dominio}>`, "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", ...lineas, ""].join("\r\n");
}

/* --- Spec 053: el acuse de recibo. Asunto y cuerpo fijos: no llevan nada de lo que escribio la persona. --- */
export const RESEND_URL = "https://api.resend.com/emails";
export const VENTANA_ACUSE_MS = 60 * 60 * 1000;     // un acuse por direccion por hora
export const TIEMPO_ACUSE_MS = 4000;
export const ACUSE_ASUNTO = "Recibimos tu consulta";
export const ACUSE_CUERPO = ["¡Hola!", "",
  "Gracias por escribirnos: tu mensaje llegó a La Pichincha.",
  "Lo leemos y te respondemos por correo en unos días.", "",
  "Este es un aviso automático: no hace falta que contestes este correo.", "",
  "La Pichincha", "https://pichinchadeldia.com.ar"].join("\n");

/* El cuerpo del pedido a Resend. El remitente lleva el nombre del codigo y la direccion de CONTACTO_REMITENTE; reply_to es esa misma. */
export function armarAcuse(para, remitente) {
  const direccion = String(remitente).replace(/^.*<([^>]+)>\s*$/, "$1").trim();
  return { from: `La Pichincha <${direccion}>`, to: [para], reply_to: direccion, subject: ACUSE_ASUNTO, text: ACUSE_CUERPO };
}

// Un error (400, 404, 429) no se guarda: un «demasiadas busquedas» no tiene que quedar 15 minutos en el navegador.
// Es una API JSON: sin referrer, y una CSP que no deja cargar nada si alguien la abre como pagina (057).
const json = (datos, estado, extra) => new Response(JSON.stringify(datos), { status: estado,
  headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Cache-Control": estado >= 400 ? "no-store" : "public, max-age=900", ...extra } });

/* Atiende un pedido. deps: fetch, cache (con match/put, la Cache API), ahora() en ISO, tiempoMaximo por fuente en ms y
   crearMensaje(de, para, crudo), que arma el EmailMessage de cloudflare:email (en los tests, uno falso).
   El tope por IP y los tokens viven en esta instancia (un isolate del Worker). */
export function crearAtender({ fetch, cache, ahora, tiempoMaximo = 5000, crearMensaje }) {
  const porIp = new Map(), contactosPorIp = new Map(), acusesPorCorreo = new Map(), tokens = new Map();

  function excedido(ip, ms, mapa = porIp, tope = TOPE, ventana = VENTANA_MS) {
    if (mapa.size > 5000) mapa.clear();         // no crece sin limite en un isolate que vive mucho
    const v = mapa.get(ip);
    if (!v || ms - v.inicio >= ventana) { mapa.set(ip, { inicio: ms, n: 1 }); return false; }
    return ++v.n > tope;
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
      if (!e.id || e.dominio) return { motivo: "Amazon no se lee sin su API (Creators API): escribí el precio a mano." };
      if (amazon.activa(env)) return { item: await amazon.leerItem(e.id, env, deps) };
      // Spec 039: sin la Creators API, la referencia del costo importado es la ficha de Tiendamia de ese mismo ASIN
      // (ella publica su precio final y el merchant_price de Amazon). Si no lo tiene o no responde, se cae al mensaje de siempre.
      if (tiendamia.activa(env)) {
        const ficha = `https://tiendamia.com.ar/p/amz/${e.id.toLowerCase()}`;
        try {
          const item = tiendamia.parsearFichaTiendamia(await pedirTexto(ficha), ficha, fecha);
          if (item) return { item };
        } catch (err) { /* Tiendamia no respondió o no tiene el producto: sin referencia */ }
      }
      return { motivo: "Amazon no se lee sin su API (Creators API): escribí el precio a mano." };
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

  /* POST /contacto: JSON con nombre, correo, motivo, mensaje, el campo trampa `sitio` (vacio para una persona) y `espera`
     (ms desde que se abrio el formulario). Un error se dice con un texto para mostrar y, si corresponde, el campo. */
  async function contacto(request, env, h, fecha, ms, ip) {
    const salir = (datos, estado, extra = {}) => json(datos, estado, { ...h, "Cache-Control": "no-store", ...extra });
    if (!/^application\/json\b/i.test(request.headers.get("Content-Type") || "")) return salir({ error: "El formulario tiene que llegar como JSON." }, 415);
    const crudo = await request.text();
    if (crudo.length > LARGOS.cuerpo) return salir({ error: "El mensaje es demasiado largo." }, 413);
    let c;
    try { c = JSON.parse(crudo); } catch (e) { return salir({ error: "Faltan los datos del formulario." }, 400); }
    // El campo trampa: un programa lo llena, una persona no lo ve. Se le dice que salio bien y no se manda nada.
    if (c && typeof c.sitio === "string" && c.sitio.trim()) return salir({ ok: true }, 200);
    // La espera la mide el navegador (ms desde que cargo el formulario): asi un reloj adelantado no deja afuera a nadie.
    const espera = typeof (c && c.espera) === "number" ? c.espera : NaN;
    if (!Number.isFinite(espera) || espera < 0) return salir({ error: "Recargá la página y probá de nuevo." }, 400);
    if (espera < ESPERA_MIN_MS) return salir({ error: "Lo mandaste demasiado rápido: esperá unos segundos y probá de nuevo." }, 400);
    const v = validarContacto(c);
    if (v.error) return salir({ error: v.error, campo: v.campo || null }, 400);
    if (excedido(ip, ms, contactosPorIp, TOPE_CONTACTO, VENTANA_CONTACTO_MS))
      return salir({ error: "Ya mandaste varios mensajes seguidos: esperá unos minutos y probá de nuevo." }, 429, { "Retry-After": "600" });
    const remitente = env.CONTACTO_REMITENTE, destino = env.CONTACTO_DESTINO;
    if (!env.CORREO || typeof env.CORREO.send !== "function" || !remitente || !destino || !crearMensaje)
      return salir({ error: "El formulario de contacto todavía no está activo. Probá de nuevo en unos días." }, 503);
    const id = crypto.randomUUID();
    const mail = armarCorreo(v.datos, { remitente, destino, fecha, id });
    try { await env.CORREO.send(await crearMensaje(remitente, destino, mail)); } catch (e) {
      return salir({ error: "No se pudo enviar el mensaje. Probá de nuevo más tarde." }, 502);
    }
    // El mensaje al dueño ya salió: el acuse es un extra y nunca hace fallar el formulario.
    return salir({ ok: true, acuse: await acusar(v.datos.correo, { env, remitente, destino, ms, id }) }, 200);
  }

  /* Spec 053: el acuse de recibo por Resend. Devuelve true solo si Resend lo aceptó. No se manda sin RESEND_API_KEY, a las
     direcciones del dueño ni a la misma dirección dos veces en una hora. El texto es fijo: nada de lo que escribio la persona. */
  async function acusar(correo, { env, remitente, destino, ms, id }) {
    if (!env.RESEND_API_KEY) return false;
    const dir = correo.toLowerCase(), propias = [destino, remitente].map(x => String(x).trim().toLowerCase());
    if (propias.includes(dir)) return false;
    if (excedido(dir, ms, acusesPorCorreo, 1, VENTANA_ACUSE_MS)) return false;
    try {
      const r = await fetch(RESEND_URL, { method: "POST", signal: AbortSignal.timeout(TIEMPO_ACUSE_MS),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `acuse-contacto/${id}` },
        body: JSON.stringify(armarAcuse(correo, remitente)) });
      if (!r.ok) console.warn("acuse: Resend respondio " + r.status);   // solo el codigo: ni la clave ni la direccion
      return r.ok;
    } catch (e) { console.warn("acuse: Resend no respondio"); return false; }
  }

  return async function atender(request, env) {
    const url = new URL(request.url), origen = request.headers.get("Origin"), esContacto = url.pathname === "/contacto";
    const h = cors(origen, esContacto);
    if (url.pathname !== "/buscar" && url.pathname !== "/enlace" && !esContacto) return json({ error: "no existe" }, 404, h);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== (esContacto ? "POST" : "GET")) return json({ error: esContacto ? "solo POST" : "solo GET" }, 405, h);
    const fecha = ahora(), ms = Date.parse(fecha), ip = request.headers.get("CF-Connecting-IP") || "sin-ip";
    if (excedido(ip, ms)) return json({ error: "demasiadas busquedas" }, 429, { ...h, "Retry-After": "60" });
    if (esContacto) return contacto(request, env, h, fecha, ms, ip);
    return url.pathname === "/buscar" ? buscar(url, env, h, fecha, ms) : enlace(url, env, h, fecha);
  };
}

let instancia = null;
export default {
  fetch(request, env) {
    // cloudflare:email existe solo dentro de Workers: se importa recien al mandar un mensaje (asi los tests corren en Node).
    const crearMensaje = async (de, para, crudo) => { const { EmailMessage } = await import("cloudflare:email"); return new EmailMessage(de, para, crudo); };
    if (!instancia) instancia = crearAtender({ fetch: (u, i) => fetch(u, i), cache: caches.default, ahora: () => new Date().toISOString(), crearMensaje });
    return instancia(request, env);
  },
};
