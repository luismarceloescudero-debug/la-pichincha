/* Errores del navegador de la gente (spec 061, etapa 1): window.onerror y unhandledrejection, mandados a Sentry plan gratis.
   APAGADO mientras el meta «errores-dsn» de index.html este vacio (lo carga el dueno con su DSN, ver la spec). Sin SDK: se
   arma a mano el «sobre» (envelope) que recibe Sentry, asi no se baja una biblioteca de terceros en cada visita.
   Privacidad (/legal/#errores):
   - muestreo bajo (MUESTREO) y como mucho MAX_POR_VISITA errores por pagina abierta, sin repetir el mismo;
   - nada de quien es: sin cookies, sin usuario, sin la direccion IP (el dueno activa «Prevent Storing of IP Addresses» en
     Sentry) y sin lo que se busco: la direccion va sin ?consulta ni #ancla;
   - el texto del error se limpia de mails, numeros largos y direcciones con consulta antes de salir.
   Funciones puras exportadas para los tests; en el navegador se engancha solo. */
(function (raiz) {
  "use strict";

  const MUESTREO = 0.1;          // 1 de cada 10 errores
  const MAX_POR_VISITA = 3;
  const LARGO_MAX = 300;

  /* https://CLAVE@oNNN.ingest.sentry.io/PROYECTO -> {url del envelope, dsn}; null si no es un DSN valido. */
  function destino(dsn) {
    const m = /^https:\/\/([0-9a-f]{16,64})@([a-z0-9.-]+)\/(\d+)$/i.exec(String(dsn || "").trim());
    if (!m) return null;
    return { url: `https://${m[2]}/api/${m[3]}/envelope/?sentry_key=${m[1]}&sentry_version=7`, dsn: m[0] };
  }

  /* Sin datos personales: mails, numeros de 7 o mas digitos (telefono, DNI, tarjeta) y la consulta de las direcciones. */
  function limpiar(texto) {
    return String(texto == null ? "" : texto)
      .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi, "[mail]")
      .replace(/(https?:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi, "$1")
      .replace(/\d[\d .-]{5,}\d/g, s => (s.replace(/\D/g, "").length >= 7 ? "[numero]" : s))
      .slice(0, LARGO_MAX);
  }

  function direccion(loc) {
    return loc ? limpiar(String(loc.origin || "") + String(loc.pathname || "")) : "";
  }

  /* Las primeras lineas de la pila (archivo:linea), limpias. Sentry las quiere de la mas vieja a la mas nueva. */
  function cuadros(pila) {
    const lineas = String(pila || "").split("\n").map(l => l.trim()).filter(l => /:\d+:\d+\)?$/.test(l)).slice(0, 8);
    return lineas.reverse().map(l => {
      // Chrome: «at f (url:1:2)» o «at url:1:2»; Firefox y Safari: «f@url:1:2»
      const m = /^(?:at\s+(?:(.*?)\s+\()?|([^@\s]*)@)?((?:https?:)?[^\s()@]+):(\d+):(\d+)\)?$/.exec(l) || [];
      m[1] = m[1] || m[2];
      m[2] = m[3]; m[3] = m[4]; m[4] = m[5];
      return { function: limpiar(m[1] || "?"), filename: limpiar(m[2] || ""), lineno: +m[3] || 0, colno: +m[4] || 0 };
    });
  }

  function evento(tipo, valor, pila, { url = "", version = "", id = "", ahora = Date.now() } = {}) {
    const ev = {
      event_id: id, timestamp: ahora / 1000, platform: "javascript", level: "error", environment: "produccion",
      exception: { values: [{ type: limpiar(tipo || "Error"), value: limpiar(valor) }] },
      request: { url },
      user: { ip_address: null },   // que Sentry no la tome de la conexion (ademas del ajuste del proyecto)
    };
    const st = cuadros(pila);
    if (st.length) ev.exception.values[0].stacktrace = { frames: st };
    if (version) ev.release = "la-pichincha@" + limpiar(version);
    return ev;
  }

  /* El sobre que recibe /envelope/: cabecera, cabecera del item y el evento, una linea cada uno. */
  function sobre(ev, dsn) {
    const cuerpo = JSON.stringify(ev);
    return [JSON.stringify({ event_id: ev.event_id, dsn, sent_at: new Date(ev.timestamp * 1000).toISOString() }),
      JSON.stringify({ type: "event" }), cuerpo].join("\n");
  }

  function nuevoId(rnd = Math.random) {
    let s = "";
    for (let i = 0; i < 32; i++) s += Math.floor(rnd() * 16).toString(16);
    return s;
  }

  /* El que decide si un error sale: muestreo, tope por visita y sin repetir. Devuelve la funcion que lo anota. */
  function captador({ dsn, enviar, rnd = Math.random, loc = null, version = "" }) {
    const d = destino(dsn);
    if (!d) return null;
    const vistos = new Set();
    let mandados = 0;
    return function anotar(tipo, valor, pila) {
      const clave = tipo + "|" + valor;
      if (mandados >= MAX_POR_VISITA || vistos.has(clave)) return false;
      vistos.add(clave);
      if (rnd() >= MUESTREO) return false;
      mandados++;
      const ev = evento(tipo, valor, pila, { url: direccion(loc), version, id: nuevoId(rnd) });
      try { enviar(d.url, sobre(ev, d.dsn)); } catch (e) { /* un aviso que no sale no rompe la pagina */ }
      return true;
    };
  }

  function enganchar(win) {
    const doc = win.document;
    const meta = doc && doc.querySelector('meta[name="errores-dsn"]');
    const version = (doc && doc.querySelector('meta[name="version"]') || {}).content || "";
    const anotar = captador({
      dsn: meta && meta.content, loc: win.location, version,
      enviar: (url, cuerpo) => {
        if (win.navigator && win.navigator.sendBeacon) win.navigator.sendBeacon(url, cuerpo);
        else if (win.fetch) win.fetch(url, { method: "POST", body: cuerpo, keepalive: true, credentials: "omit" }).catch(() => {});
      },
    });
    if (!anotar) return false;   // sin DSN: apagado
    win.addEventListener("error", e => {
      if (!e || !e.message) return;   // un recurso que no cargo (imagen, script) no es un error de JS
      anotar((e.error && e.error.name) || "Error", e.message, e.error && e.error.stack);
    });
    win.addEventListener("unhandledrejection", e => {
      const r = e && e.reason;
      anotar((r && r.name) || "UnhandledRejection", (r && r.message) || String(r), r && r.stack);
    });
    return true;
  }

  const api = { MUESTREO, MAX_POR_VISITA, destino, limpiar, direccion, cuadros, evento, sobre, nuevoId, captador, enganchar };
  if (typeof module === "object" && module.exports) module.exports = api;
  else { raiz.Errores = api; if (raiz.document) enganchar(raiz); }
})(this);
