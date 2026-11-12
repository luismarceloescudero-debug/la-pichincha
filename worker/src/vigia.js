/* Vigia del sitio (spec 065; plan v4, secciones 7.1, 7.4 y 7.5). Corre con el Cron Trigger de Cloudflare cada 5 minutos
   (worker/wrangler.toml) y, cuando algo se rompe, avisa al chat PRIVADO del dueno por Telegram en el momento.

   Que mira (seccion 7.1): la portada, /hoy/, una ficha de /precios/, que indice.json sea de hoy y, cuando la app este
   publicada (Fase 3), /.well-known/assetlinks.json.

   Reglas propias de esta pieza:
   - El indice pesa mas de 6 MB: se piden solo los primeros bytes con Range y se corta la descarga. Nunca se parsea entero
     (el Worker gratis tiene 10 ms de CPU por pedido).
   - La corrida diaria sale a las 00:23 y a las 02:47 (hora argentina). Antes de las 03:00 un indice de ayer todavia puede
     ser normal; despues, no. Con dos dias de atraso se avisa a cualquier hora.
   - El aviso va UNA vez por problema: se guarda una huella (que fallo) y no se repite hasta que cambie o pasen 6 horas.
     Cuando vuelve a andar, un solo mensaje verde. Sin estado (la cache se puede vaciar), lo peor es un aviso de mas.
   - Nunca al canal publico: si TELEGRAM_CHAT_DUENO es igual a TELEGRAM_CHAT_ID no se manda. Sin los secretos, el vigia
     no falla: deja el aviso en el log y no se anota como avisado, asi la proxima corrida lo reintenta. */

export const BASE = "https://pichinchadeldia.com.ar";
export const INDICE = "/indice.json";
export const ASSETLINKS = "/.well-known/assetlinks.json";
export const PAQUETE = "ar.com.pichinchadeldia.app";
export const AGENTE = "LaPichincha-Vigia/1.0 (+https://pichinchadeldia.com.ar)";
export const DESFASE_AR_MS = -3 * 3600 * 1000;     // la hora es la argentina (UTC-3 fijo)
export const HORA_MINIMA = 3;                      // desde esta hora el indice tiene que ser de hoy
export const TIEMPO_MAXIMO = 10000;                // por chequeo, en ms: uno que no responde no frena a los demas
export const BYTES_INDICE = 512;                   // alcanza para {"generado":"..."} (es la primera clave del indice)
export const RECORDAR_MS = 6 * 3600 * 1000;        // el mismo problema se recuerda cada 6 horas
export const ESPERA_RUTA_MS = 30 * 1000;           // GET /vigia seguido no vuelve a pedir el sitio
export const CLAVE_ESTADO = "https://vigia.cache/estado";
export const TELEGRAM = "https://api.telegram.org/bot";

/* Las tres paginas. La marca es un texto que solo esta en la pagina buena: un 200 con una pantalla de mantenimiento no
   cuenta como sitio andando. La ficha es una consulta fija de /precios/ (344 comparables en 23 comercios al 09/10). */
export const PAGINAS = [
  { id: "portada", titulo: "Portada", ruta: "/", marca: "La Pichincha" },
  { id: "hoy", titulo: "La página de hoy (/hoy/)", ruta: "/hoy/", marca: "Pichinchas del" },
  { id: "precios", titulo: "Una ficha de precios (/precios/placa-de-video/)", ruta: "/precios/placa-de-video/", marca: "La Pichincha" },
];

/* La fecha y la hora del sitio, corran donde corran el Worker y los tests. */
export function fechaArgentina(ms) { return new Date(ms + DESFASE_AR_MS).toISOString().slice(0, 10); }
export function horaArgentina(ms) { return new Date(ms + DESFASE_AR_MS).getUTCHours(); }

/* La fecha de `generado`, que indexar.py escribe como primera clave del indice. null si el archivo no empieza asi. */
export function leerGenerado(texto) {
  const m = /^\s*\{\s*"generado"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(String(texto || ""));
  return m ? m[1] : null;
}

const diaMes = fecha => fecha.slice(8, 10) + "/" + fecha.slice(5, 7);
const diasEntre = (desde, hasta) => Math.round((Date.parse(hasta + "T00:00:00Z") - Date.parse(desde + "T00:00:00Z")) / 86400000);
const falla = (pagina, detalle) => ({ id: pagina.id, titulo: pagina.titulo, detalle });

/* Lee solo el principio de la respuesta y corta: con el indice entero serian 6 MB de CPU en un Worker gratis. */
async function primerosBytes(respuesta, limite) {
  const cuerpo = respuesta.body;
  if (!cuerpo || typeof cuerpo.getReader !== "function") return String(await respuesta.text()).slice(0, limite);
  const lector = cuerpo.getReader(), partes = [];
  let largo = 0;
  try {
    while (largo < limite) {
      const { value, done } = await lector.read();
      if (done) break;
      partes.push(value);
      largo += value.length;
    }
  } finally {
    try { await lector.cancel(); } catch (e) { /* ya estaba cerrada */ }
  }
  const todo = new Uint8Array(largo);
  let desde = 0;
  for (const parte of partes) { todo.set(parte, desde); desde += parte.length; }
  return new TextDecoder().decode(todo.slice(0, limite));
}

function crearTraer(fetch) {
  return function traer(url, init = {}) {
    return fetch(url, { ...init, headers: { "User-Agent": AGENTE, ...(init.headers || {}) }, signal: AbortSignal.timeout(TIEMPO_MAXIMO) });
  };
}

async function revisarPagina(traer, base, pagina) {
  try {
    const r = await traer(base + pagina.ruta, { headers: { Accept: "text/html" } });
    if (!r.ok) return falla(pagina, `respondió ${r.status}`);
    if (!String(await r.text()).includes(pagina.marca)) return falla(pagina, "no es la página del sitio");
    return null;
  } catch (e) {
    return falla(pagina, "no respondió");
  }
}

async function revisarIndice(traer, base, ms) {
  const pagina = { id: "indice", titulo: "El índice de precios" };
  try {
    const r = await traer(base + INDICE, { headers: { Range: `bytes=0-${BYTES_INDICE - 1}`, Accept: "application/json" } });
    if (!r.ok) return falla(pagina, `respondió ${r.status}: el buscador se queda sin precios`);
    const generado = leerGenerado(await primerosBytes(r, BYTES_INDICE));
    if (!generado) return falla(pagina, "no se pudo leer la fecha: el archivo no parece el índice");
    const hoy = fechaArgentina(ms);
    const atraso = diasEntre(generado, hoy);
    if (atraso <= 0) return null;
    // Antes de HORA_MINIMA la corrida del dia todavia puede estar saliendo; con dos dias de atraso ya no hay duda.
    if (atraso >= 2 || horaArgentina(ms) >= HORA_MINIMA)
      return falla(pagina, `es del ${diaMes(generado)} y la corrida de hoy no lo rearmó`);
    return null;
  } catch (e) {
    return falla(pagina, "no respondió");
  }
}

/* assetlinks.json: la prueba de que la app es nuestra. Recien se revisa cuando la app esta publicada (Fase 3). */
async function revisarAssetlinks(traer, base, env) {
  if (String(env.APP_PUBLICADA || "") !== "si") return null;
  const pagina = { id: "assetlinks", titulo: "La prueba de la app (assetlinks.json)" };
  try {
    const r = await traer(base + ASSETLINKS, { headers: { Accept: "application/json" } });
    if (!r.ok) return falla(pagina, `respondió ${r.status}: falta el archivo (¿.nojekyll en la carpeta .well-known?)`);
    let datos;
    try { datos = JSON.parse(await r.text()); } catch (e) { return falla(pagina, "no es JSON"); }
    const nuestro = Array.isArray(datos) && datos.some(e => e && e.target && e.target.namespace === "android_app"
      && e.target.package_name === PAQUETE && Array.isArray(e.target.sha256_cert_fingerprints) && e.target.sha256_cert_fingerprints.length);
    return nuestro ? null : falla(pagina, `no está el paquete ${PAQUETE} con su huella`);
  } catch (e) {
    return falla(pagina, "no respondió");
  }
}

/* Los chequeos, todos a la vez. Devuelve { cuando, ok, fallas: [{ id, titulo, detalle }] }. */
export async function revisar({ fetch, ahora, env = {} }) {
  const cuando = ahora();
  const ms = Date.parse(cuando);
  const base = String(env.VIGIA_BASE || BASE).replace(/\/+$/, "");
  const traer = crearTraer(fetch);
  const fallas = (await Promise.all([
    ...PAGINAS.map(p => revisarPagina(traer, base, p)),
    revisarIndice(traer, base, ms),
    revisarAssetlinks(traer, base, env),
  ])).filter(Boolean);
  return { cuando, ok: fallas.length === 0, fallas };
}

/* Que fallo, para no avisar veinte veces lo mismo: los identificadores ordenados. */
export function huella(resultado) {
  return (resultado && resultado.fallas ? resultado.fallas : []).map(f => f.id).sort().join(",");
}

const lista = fallas => (Array.isArray(fallas) && fallas.length ? fallas.join(", ") : "algo del sitio");

/* El texto del aviso, o "" si no hay nada que mandar. `anterior` es lo ultimo que se aviso ({ huella, avisado, fallas }). */
export function textoAviso(resultado, anterior, ms) {
  const antes = anterior && typeof anterior.huella === "string" ? anterior : null;
  if (!resultado.fallas.length) {
    if (!antes || !antes.huella) return "";
    return `🟢 <b>La Pichincha volvió a andar</b>. El vigía no encuentra problemas (fallaba: ${html(lista(antes.fallas))}).\n\n${html(BASE)}`;
  }
  if (antes && antes.huella === huella(resultado) && ms - (Number(antes.avisado) || 0) < RECORDAR_MS) return "";
  const lineas = resultado.fallas.map(f => `• <b>${html(f.titulo)}</b>: ${html(f.detalle)}`).join("\n");
  return `⚠️ <b>La Pichincha: el vigía encontró un problema</b>\n\n${lineas}\n\n${html(BASE)}`;
}

const html = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Manda el texto al chat privado del dueno con el bot del canal. Devuelve true solo si Telegram lo acepto. El token
   nunca se imprime (va en la direccion), y sin el secreto del chat privado no se manda nada. */
export async function avisar(texto, { fetch, env = {} }) {
  const token = env.TELEGRAM_BOT_TOKEN, chat = env.TELEGRAM_CHAT_DUENO, canal = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.warn("vigia: falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_DUENO: el aviso no se manda (spec 065). Texto del aviso:");
    console.warn(String(texto).replace(/<[^>]+>/g, ""));
    return false;
  }
  if (canal && String(chat).trim() === String(canal).trim()) {
    console.warn("vigia: TELEGRAM_CHAT_DUENO es el canal publico: el aviso privado no se manda ahi (spec 065)");
    return false;
  }
  try {
    const r = await fetch(TELEGRAM + token + "/sendMessage", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chat), text: texto, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO) });
    if (!r.ok) { console.warn("vigia: Telegram respondio " + r.status); return false; }
    return true;
  } catch (e) {
    console.warn("vigia: Telegram no respondio");
    return false;
  }
}

async function leerEstado(cache) {
  try {
    const r = await cache.match(CLAVE_ESTADO);
    return r ? JSON.parse(await r.text()) : null;
  } catch (e) {
    return null;
  }
}

async function guardarEstado(cache, estado) {
  try {
    await cache.put(CLAVE_ESTADO, new Response(JSON.stringify(estado), { headers: { "Content-Type": "application/json",
      "Cache-Control": "max-age=2592000" } }));
  } catch (e) {
    console.warn("vigia: no se pudo guardar el estado");
  }
}

/* La corrida entera: revisar, comparar con lo ultimo, avisar y anotar. La llama el Cron Trigger del Worker.
   Con VIGIA = "no" no hace nada (interruptor general); por defecto esta prendido. */
export async function vigilar({ fetch, cache, ahora, env = {} }) {
  if (String(env.VIGIA || "si") === "no") {
    console.log("vigia: apagado (VIGIA=no)");
    return { corrio: false, cuando: ahora(), ok: true, fallas: [], avisado: false };
  }
  const resultado = await revisar({ fetch, ahora, env });
  const anterior = await leerEstado(cache);
  const texto = textoAviso(resultado, anterior, Date.parse(resultado.cuando));
  const avisado = texto ? await avisar(texto, { fetch, env }) : false;
  // Si el aviso no salio no se anota: la proxima corrida lo vuelve a intentar (y queda la advertencia en el log).
  if (texto && !avisado) return { ...resultado, avisado: false, texto };
  await guardarEstado(cache, { huella: huella(resultado), avisado: avisado ? Date.parse(resultado.cuando) : (anterior && anterior.avisado) || 0,
    fallas: resultado.fallas.map(f => f.id) });
  return { ...resultado, avisado, texto };
}
