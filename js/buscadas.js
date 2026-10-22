/* Lo mas buscado (spec 017, fase 3), con las buenas costumbres de privacidad. Funciones puras: no tocan el DOM ni la red.
   Parte de conteos AGREGADOS de GoatCounter (cuantas personas distintas hicieron cada busqueda) y deja pasar solo lo que no
   puede identificar a nadie:
   - un minimo de personas distintas (k): una busqueda que hizo una sola persona nunca se publica;
   - solo terminos que son productos: tienen que devolver resultados en el catalogo (el texto libre queda afuera);
   - nada que parezca un dato personal: mails, direcciones web, telefonos o numeros largos, ni palabras como DNI o CBU;
   - lo que se publica es la lista de terminos, sin conteos, sin fechas y sin nada de quien busco.
   Constitucion: analitica sin cookies y sin guardar datos personales. */
(function (raiz) {
  "use strict";

  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;

  const MINIMO_VISITANTES = 5;   // personas distintas en la ventana para que un termino se publique
  const MAX_TERMINOS = 8;
  const VENTANA_DIAS = 30;
  const MIN_RESULTADOS = 3;      // un termino de producto tiene resultados en el catalogo
  const LARGO_MAX = 40, PALABRAS_MAX = 6;

  // «tarjeta» y «clave» no van: en este sitio «tarjeta de video» es un producto.
  const PERSONAL = /\b(?:dni|cuil|cuit|cbu|cvu|cvv)\b|contrasena|passw/;   // «password123» tambien: sin limite de palabra al final
  const WEB = /@|https?:|www\.|\.(?:com|ar|net|org|io|app)\b/;
  const SOLO_NUMERO = /^[\d.\-+()]+$/;
  const digitos = p => p.replace(/\D/g, "").length;

  /* Telefono, DNI o numero de tarjeta: una palabra con 7 o mas digitos, o tres o mas palabras seguidas que son solo numeros
     ("11 5555 1234"). Los digitos de un producto van mezclados con letras ("i7 14700 32gb", "rtx 4060 16gb") y no entran. */
  function pareceNumeroPersonal(t) {
    const palabras = t.split(" ");
    if (palabras.some(p => digitos(p) >= 7)) return true;
    let corrida = [];
    for (const p of [...palabras, ""]) {            // la "" del final cierra la ultima corrida
      if (SOLO_NUMERO.test(p)) { corrida.push(p); continue; }
      if (corrida.length >= 3 && corrida.reduce((n, x) => n + digitos(x), 0) >= 7) return true;
      corrida = [];
    }
    return false;
  }

  /* El termino como se publica, o "" si hay que descartarlo. */
  function terminoLimpio(texto) {
    const t = B.normalBusq(String(texto || "")).replace(/\s+/g, " ").trim();
    if (t.length < 2 || t.length > LARGO_MAX || t.split(" ").length > PALABRAS_MAX) return "";
    if (!/[a-z]/.test(t)) return "";                                   // solo numeros: no es un producto
    if (WEB.test(t) || PERSONAL.test(t) || pareceNumeroPersonal(t)) return "";
    return t;
  }

  /* hits: [{ path, count, event }] de GoatCounter; solo cuentan los eventos «busqueda/<termino>» (no «busqueda_vacia/»).
     productos: las filas del indice. Devuelve los terminos mas buscados, de mas a menos, sin conteos. */
  function masBuscadas(hits, { productos = [], minimo = MINIMO_VISITANTES, max = MAX_TERMINOS, minResultados = MIN_RESULTADOS } = {}) {
    const nombres = productos.map(f => B.normalBusq(String(f[0])));
    const porTermino = new Map();
    for (const h of hits || []) {
      const ruta = String(h.path || "").replace(/^\//, "");
      if (!ruta.startsWith("busqueda/") || !(h.count >= minimo)) continue;
      const t = terminoLimpio(ruta.slice("busqueda/".length));
      if (!t) continue;
      // El mismo termino escrito de dos maneras no suma personas (podrian ser las mismas): se queda la mayor.
      porTermino.set(t, Math.max(porTermino.get(t) || 0, h.count));
    }
    const candidatos = [...porTermino].sort((a, z) => z[1] - a[1] || (a[0] < z[0] ? -1 : 1));
    const salida = [];
    for (const [t] of candidatos) {
      const coincide = B.filtroDe(t);
      if (!coincide) continue;
      let n = 0;
      for (const nombre of nombres) if (coincide(nombre) && ++n >= minResultados) break;
      if (n >= minResultados) salida.push(t);
      if (salida.length === max) break;
    }
    return salida;
  }

  const api = { MINIMO_VISITANTES, MAX_TERMINOS, VENTANA_DIAS, MIN_RESULTADOS, terminoLimpio, masBuscadas };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Buscadas = api;
})(this);
