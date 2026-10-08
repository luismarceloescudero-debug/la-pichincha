/* Funciones puras de la pagina: la URL compartible, la hora en Argentina y
   los eventos de analitica. Sin DOM, para poder probarlas con node --test. */
(function (raiz) {
  "use strict";

  const ZONA = "America/Argentina/Buenos_Aires";
  const TOPE_Q = 100;          // un link no necesita mas para reproducir la busqueda
  const TOPE_TERMINO = 60;     // GoatCounter agrupa por path: mas largo no aporta

  /* ?q=ssd+1tb#comparativa -> { q: "ssd 1tb", vista: "comparativa" } */
  function leerUrl(search, hash) {
    const q = (new URLSearchParams(search || "").get("q") || "").replace(/\s+/g, " ").trim().slice(0, TOPE_Q);
    return { q: q.length >= 2 ? q : "", vista: (hash || "").replace(/^#/, "") };
  }

  function armarUrl(pathname, q, vista) {
    const t = (q || "").trim();
    return pathname + (t ? "?" + new URLSearchParams({ q: t }) : "") + (vista ? "#" + vista : "");
  }

  const formato = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, year: "numeric", month: "numeric",
    day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const partes = d => Object.fromEntries(formato.formatToParts(d).map(p => [p.type, p.value]));
  const diaDe = p => Date.UTC(+p.year, +p.month - 1, +p.day);

  /* "hoy 15:25", "ayer 15:25" o "7/10 15:25", siempre en hora argentina. Un
     indice viejo trae solo la fecha ("2026-10-07"): ahi dice "el 7/10". */
  function cuando(iso, ahora = new Date()) {
    if (!iso) return "";
    const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (solo) return `el ${+solo[3]}/${+solo[2]}`;
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const a = partes(d), h = partes(ahora);
    const dias = Math.round((diaDe(h) - diaDe(a)) / 864e5);
    const hora = `${a.hour}:${a.minute}`;
    return dias === 0 ? `hoy ${hora}` : dias === 1 ? `ayer ${hora}` : `${+a.day}/${+a.month} ${hora}`;
  }

  /* El dia argentino de una fecha ISO, con o sin hora, o null si no se entiende. */
  function diaAr(iso) {
    const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (solo) return { n: Date.UTC(+solo[1], +solo[2] - 1, +solo[3]), dia: +solo[3], mes: +solo[2] };
    const d = new Date(iso || "");
    if (!iso || isNaN(d)) return null;
    const p = partes(d);
    return { n: diaDe(p), dia: +p.day, mes: +p.month };
  }

  /* Una fuente que no se pudo relevar sigue publicando su ultimo precio, pero no
     como si fuera de hoy: "precio del 7/10". Mismo dia que el indice: nada. */
  function precioDel(relevado, referencia) {
    const a = diaAr(relevado), r = diaAr(referencia);
    return a && r && a.n < r.n ? `precio del ${a.dia}/${a.mes}` : "";
  }

  /* La comparativa curada guarda desde cuando falla cada producto (ver
     actualizar.relevar): "sin verificar hoy" o "sin verificar desde el 8/10". */
  function sinVerificar(desde, referencia) {
    const a = diaAr(desde), r = diaAr(referencia);
    if (!a) return "";
    return r && a.n >= r.n ? "sin verificar hoy" : `sin verificar desde el ${a.dia}/${a.mes}`;
  }

  /* El comercio es el dominio: articulo.mercadolibre.com.ar -> mercadolibre.com.ar */
  function comercioDeUrl(href) {
    let host = "";
    try { host = new URL(href).hostname.toLowerCase(); } catch (e) { return ""; }
    if (!host) return "";
    const p = host.replace(/^www\./, "").split(".");
    return p.slice(/\.(com|net|org|gob|edu|tur)\.ar$/.test(host) ? -3 : -2).join(".");
  }

  /* GoatCounter: el nombre del evento va en path y el detalle en title. */
  function eventoBusqueda(termino, n) {
    const t = (termino || "").replace(/\s+/g, " ").trim().slice(0, TOPE_TERMINO);
    if (!t) return null;
    return n > 0
      ? { path: "busqueda/" + t, title: n + (n === 1 ? " resultado" : " resultados"), event: true }
      : { path: "busqueda_vacia/" + t, title: "sin resultados", event: true };
  }

  function eventoClic(href, rubro) {
    const c = comercioDeUrl(href);
    return c ? { path: `clic_saliente/${c}/${rubro || "otro"}`, title: c, event: true } : null;
  }

  const ACCIONES = { compartir: ["compartir", "nativo"], copiar: ["compartir", "copiar"],
                     excel: ["exportar", "excel"], csv: ["exportar", "csv"], imprimir: ["exportar", "imprimir"] };

  function eventoAccion(accion, vista) {
    const a = ACCIONES[accion];
    return a ? { path: `${a[0]}/${a[1]}/${vista || "pagina"}`, title: vista || "", event: true } : null;
  }

  const api = { leerUrl, armarUrl, cuando, precioDel, sinVerificar, comercioDeUrl, eventoBusqueda, eventoClic, eventoAccion };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Pagina = api;
})(this);
