/* Registro de errores con Sentry (spec 061): cuando la pagina se rompe en el celular o la compu de alguien, el error
   (mensaje, archivo y linea) llega a Sentry y el dueño recibe un mail. Solo errores: sin grabar la sesion, sin medir
   rendimiento, sin IP, sin cookies y sin lo que la persona busco (la parte «?q=...» de las direcciones se borra).

   Va en el <head>, antes que todo, para anotar los errores del arranque. El programa de Sentry (unos 32 KB) se baja
   recien cuando la pagina termino de cargar, desde su CDN con la huella `INTEGRIDAD`: si alguien lo cambia, el
   navegador no lo ejecuta. Si no carga (bloqueador de anuncios, sin red) no pasa nada: la pagina sigue igual.

   Se prende solo si hay DSN (el meta `sentry-dsn`, que sale de sitio.json) y solo en el dominio publicado: en
   localhost, en los tests y en la app no manda nada. Para probarlo: abrir https://pichinchadeldia.com.ar/#probar-errores
   y en un minuto aparece «Prueba de errores de La Pichincha» en Sentry. */
(function (raiz) {
  "use strict";

  const VERSION_SDK = "11.8.0";
  const SDK = "https://browser.sentry-cdn.com/" + VERSION_SDK + "/bundle.min.js";
  const INTEGRIDAD = "sha384-H8JEvxJFgnBT9bZucmagyEBKdF3nGnS+LaekpC73o3oRMWpjjMSDksIoLuDRsj/b";
  const DOMINIO = "pichinchadeldia.com.ar";
  const MAX_PENDIENTES = 10;
  const PRUEBA = "#probar-errores";

  /* Sin «?...» ni «#...»: ahi viaja lo que la persona busco o pego. */
  const sinConsulta = url => (typeof url === "string" ? url.replace(/[?#].*$/, "") : url);

  const activo = ubicacion => !!ubicacion && ubicacion.protocol === "https:"
    && (ubicacion.hostname === DOMINIO || ubicacion.hostname === "www." + DOMINIO);

  /* Lo que se manda pasa por aca: se borra todo lo que pueda decir quien es la persona o que busco. */
  function limpiar(evento) {
    if (!evento) return evento;
    delete evento.user;
    if (evento.request) {
      evento.request.url = sinConsulta(evento.request.url);
      delete evento.request.query_string;
      delete evento.request.cookies;
      if (evento.request.headers) delete evento.request.headers.Referer;
    }
    if (evento.breadcrumbs) evento.breadcrumbs = evento.breadcrumbs.map(limpiarMiga).filter(Boolean);
    return evento;
  }

  /* Las «migas» son lo que paso antes del error (clics, navegacion, pedidos): sin direcciones completas. */
  function limpiarMiga(miga) {
    if (!miga) return miga;
    if (miga.category === "console") return null;
    const datos = miga.data;
    if (datos) for (const k of ["url", "from", "to"]) if (k in datos) datos[k] = sinConsulta(datos[k]);
    return miga;
  }

  function opciones(dsn, ubicacion) {
    return {
      dsn,
      environment: "produccion",
      sendDefaultPii: false,
      allowUrls: [ubicacion.origin],
      denyUrls: [/^(chrome|moz|safari)(-web)?-extension:/],
      maxBreadcrumbs: 20,
      beforeSend: limpiar,
      beforeBreadcrumb: limpiarMiga,
    };
  }

  /* Pone todo en marcha en el navegador. Devuelve false si no corresponde (sin DSN o fuera del dominio). */
  function arrancar(r) {
    const doc = r.document;
    const meta = doc && doc.querySelector('meta[name="sentry-dsn"]');
    const dsn = meta && meta.content;
    if (!dsn || !activo(r.location)) return false;

    // Hasta que llegue Sentry, los errores se anotan aca.
    const pendientes = [];
    const anotar = e => { if (pendientes.length < MAX_PENDIENTES) pendientes.push(e); };
    const alError = ev => { if (ev.error) anotar(ev.error); };
    const alRechazo = ev => anotar(ev.reason);
    r.addEventListener("error", alError);
    r.addEventListener("unhandledrejection", alRechazo);
    const soltar = () => { r.removeEventListener("error", alError); r.removeEventListener("unhandledrejection", alRechazo); };

    const cargar = () => {
      const s = doc.createElement("script");
      s.src = SDK;
      s.integrity = INTEGRIDAD;
      s.crossOrigin = "anonymous";
      s.async = true;
      s.onload = () => {
        soltar();
        const S = r.Sentry;
        if (!S || typeof S.init !== "function") return;
        try {
          S.init(opciones(dsn, r.location));
          pendientes.forEach(e => S.captureException(e));
          if (r.location.hash === PRUEBA) S.captureException(new Error("Prueba de errores de La Pichincha"));
        } catch (e) { /* Sentry nunca rompe la pagina */ }
      };
      s.onerror = soltar;
      doc.head.appendChild(s);
    };
    if (doc.readyState === "complete") setTimeout(cargar, 0);
    else r.addEventListener("load", () => setTimeout(cargar, 0), { once: true });
    return true;
  }

  const api = { VERSION_SDK, SDK, INTEGRIDAD, DOMINIO, sinConsulta, activo, limpiar, limpiarMiga, opciones, arrancar };
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.Errores = api; try { arrancar(raiz); } catch (e) { /* nunca rompe la pagina */ } }
})(this);
