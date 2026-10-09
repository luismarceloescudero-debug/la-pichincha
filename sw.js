/* Service worker de La Pichincha: red primero.

   Con conexion manda SIEMPRE el dato nuevo (principio II: un precio no puede quedar viejo sin que
   la persona lo sepa). Lo guardado solo responde si la red falla o tarda mas de LIMITE_MS, y
   entonces js/app.js muestra el aviso con la fecha de los precios.

   Cada publicacion estampa una version nueva (publicar_app.py reemplaza __VERSION__): al activarse,
   se borran las caches de las versiones anteriores, asi nunca se mezclan archivos de dos versiones.
   Solo atiende GET del mismo origen: nada de fotos de tiendas, fuentes ni analitica. */
(function (raiz) {
  "use strict";

  const VERSION = "__VERSION__";
  const PREFIJO = "pichincha-";
  const CACHE = PREFIJO + VERSION;
  const LIMITE_MS = 4000;
  /* La cascara y el ultimo indice: lo necesario para abrir y buscar sin conexion. */
  const CASCARA = ["./", "index.html", "css/sitio.css", "js/buscador.js", "js/pagina.js", "js/analisis.js", "js/app.js",
    "manifest.webmanifest", "sin-red.html", "img/icono-192.png", "img/icono-512.png", "img/apple-touch-icon.png", "indice.json"];

  const conLimite = (promesa, ms) => new Promise((resolver, rechazar) => {
    const t = setTimeout(() => rechazar(new Error("la red no respondio en " + ms + " ms")), ms);
    promesa.then(r => { clearTimeout(t); resolver(r); }, e => { clearTimeout(t); rechazar(e); });
  });

  /* Decide que responder a un pedido. Devuelve null si no es cosa del service worker. */
  async function responder(pedido, env) {
    const { caches, fetch, origen, base, cache = CACHE, limiteMs = LIMITE_MS } = env;
    if (pedido.method !== "GET" || new URL(pedido.url).origin !== origen) return null;
    const almacen = await caches.open(cache);
    const guardada = () => almacen.match(pedido);
    try {
      const enCurso = fetch(pedido);
      // La copia se hace apenas llega, aunque la persona ya haya recibido lo guardado por la demora.
      enCurso.then(r => { if (r && r.ok) almacen.put(pedido, r.clone()); }).catch(() => {});
      const r = await conLimite(enCurso, limiteMs);
      if (r.status >= 500) return (await guardada()) || r;       // el servidor fallo: no es "red buena"
      return r;                                                  // incluso un 404: no resucita paginas borradas
    } catch (e) {
      const vieja = await guardada();
      if (vieja) return vieja;
      if (pedido.mode === "navigate") {
        const aviso = await almacen.match(new URL("sin-red.html", base).href);
        if (aviso) return aviso;
      }
      throw e;
    }
  }

  /* Guarda lo que puede de la cascara: si algo falta (por ejemplo no hay indice) no se cae la instalacion. */
  async function precargar(cache, fetch, base) {
    let ok = 0;
    await Promise.all(CASCARA.map(async ruta => {
      try {
        const url = new URL(ruta, base).href;
        const r = await fetch(url);
        if (r && r.ok) { await cache.put(url, r); ok++; }
      } catch (e) { /* sigue con el resto */ }
    }));
    return ok;
  }

  /* Borra las caches de versiones anteriores y deja las ajenas al sitio. */
  async function limpiar(caches, actual) {
    for (const nombre of await caches.keys()) if (nombre.startsWith(PREFIJO) && nombre !== actual) await caches.delete(nombre);
  }

  const api = { responder, precargar, limpiar, CASCARA, VERSION, CACHE, LIMITE_MS };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  // En el navegador: el service worker de verdad.
  const sw = raiz;
  sw.addEventListener("install", ev => {
    ev.waitUntil(sw.caches.open(CACHE).then(c => precargar(c, f => fetch(f), sw.registration.scope)).then(() => sw.skipWaiting()));
  });
  sw.addEventListener("activate", ev => {
    ev.waitUntil(limpiar(sw.caches, CACHE).then(() => sw.clients.claim()));
  });
  sw.addEventListener("fetch", ev => {
    const entorno = { caches: sw.caches, fetch: p => fetch(p), origen: sw.location.origin, base: sw.registration.scope };
    if (ev.request.method !== "GET" || new URL(ev.request.url).origin !== entorno.origen) return;
    ev.respondWith(responder(ev.request, entorno));
  });
})(this);
