/* Funciones puras de la pagina: la URL compartible, la hora en Argentina y
   los eventos de analitica. Sin DOM, para poder probarlas con node --test. */
(function (raiz) {
  "use strict";

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

  /* Argentina no tiene horario de verano: UTC-3 fijo (constitucion). Sin Intl.DateTimeFormat con zona
     horaria, que al abrir la portada cargaba los datos de ICU en una tarea larga. */
  const dos = n => String(n).padStart(2, "0");
  function partes(d) {
    const a = new Date(d.getTime() - 3 * 36e5);
    return { year: String(a.getUTCFullYear()), month: String(a.getUTCMonth() + 1), day: String(a.getUTCDate()),
             hour: dos(a.getUTCHours()), minute: dos(a.getUTCMinutes()) };
  }
  const diaDe = p => Date.UTC(+p.year, +p.month - 1, +p.day);

  /* "hoy 15:25", "ayer 15:25" o "7/10 15:25", siempre en hora argentina. Un
     indice viejo trae solo la fecha ("2026-10-07"): ahi dice "el 7/10". */
  /* "12/10 18:05": fecha y hora fijas en Argentina, para el texto que queda escrito (paginas generadas,
     descripciones para buscadores). Un indice viejo trae solo la fecha: "7/10". */
  function fechaHora(iso) {
    if (!iso) return "";
    const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (solo) return `${+solo[3]}/${+solo[2]}`;
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const a = partes(d);
    return `${+a.day}/${+a.month} ${a.hour}:${a.minute}`;
  }

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

  /* Desde cuando tiene el aviso el precio de hoy, para el buscador: "precio sin cambios desde el 7/10". El historial empezo
     en una fecha; antes de eso no sabemos, y se dice. `desde` y `inicio` son fechas AAAA-MM-DD. Sin dato: nada. */
  function cambioDe(desde, inicio) {
    const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(desde || "");
    if (!f) return "";
    const txt = `precio sin cambios desde el ${+f[3]}/${+f[2]}`;
    return inicio && desde <= inicio ? `${txt} (cuando empezamos a seguirlo; puede ser más antiguo)` : txt;
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

  /* Afiliado de Amazon (plan v2, E1): una busqueda en amazon.com con el Store ID. No es secreto: va en cada link.
     La constitucion (principio II) pide que todo enlace de afiliado se rotule y que nunca cambie el orden. */
  const AMAZON_TAG = "lapichincha-20";
  function enlaceAmazon(termino) {
    const t = String(termino || "").replace(/\s+/g, " ").trim().slice(0, TOPE_Q);
    return t ? "https://www.amazon.com/s?" + new URLSearchParams({ k: t, tag: AMAZON_TAG }) : null;
  }

  const api = { AMAZON_TAG, enlaceAmazon, leerUrl, armarUrl, cuando, fechaHora, precioDel, sinVerificar, cambioDe, comercioDeUrl, eventoBusqueda, eventoClic, eventoAccion };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Pagina = api;
})(this);
