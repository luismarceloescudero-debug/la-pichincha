/* Buscar afuera (spec 020) y pegar un link (spec 023): la lista de donde comprar afuera (Amazon, Tiendamia, Loquieroaca) con la
   busqueda ya armada, y lo que se muestra de un link pegado. Desde la spec 040 no hay calculadora local: la referencia del costo
   importado es el precio final que publican Tiendamia y Loquieroaca (lo lee el Worker, GET /enlace). Funciones puras: no tocan
   el DOM ni la red; el pegamento vive en js/vista-afuera.js. */
(function (raiz) {
  "use strict";

  const AMAZON_TAG = "lapichincha-20";   // el mismo ID que js/pagina.js; va en cada enlace de afiliado

  /* Donde comprar afuera. `afiliado` marca el enlace que cobra comision (se rotula en la pagina, rel=sponsored). `busqueda`: la
     URL de busqueda de cada tienda, a la que se le pegan las palabras unidas con "+" (verificadas en la fuente el 23/10/2026:
     las dos devolvieron el Soundcore AeroClip 2; www.tiendamia.com da 403, tiendamia.com.ar responde). */
  const FUENTES = [
    { id: "amazon", nombre: "Amazon (EE.UU.)", url: "https://www.amazon.com/", afiliado: true,
      texto: "Compra directa en la tienda de EE.UU. El envío y los impuestos los pagás vos o el courier: revisá el total del checkout antes de pagar." },
    { id: "tiendamia", nombre: "Tiendamia", url: "https://tiendamia.com.ar/", afiliado: false,
      busqueda: "https://tiendamia.com.ar/search/amazon/",
      texto: "Intermediario: compra en tiendas del exterior por vos. Antes de pagar, revisá en el resumen qué impuestos suma y si ya vienen incluidos." },
    { id: "loquieroaca", nombre: "Loquieroaca", url: "https://www.loquieroaca.com/", afiliado: false,
      busqueda: "https://www.loquieroaca.com/products?search=",
      texto: "Intermediario argentino para comprar en tiendas del exterior. Mismo chequeo: el resumen dice qué impuestos y cargos suma." },
  ];

  /* Tiendas oficiales de una marca, solo si su propia pagina de envios dice que manda a Argentina: cada entrada lleva esa
     pagina (`envios`) y la fecha en que se leyo (`verificado`). Lo no confirmado no se muestra. Forma de una entrada:
     { marca, claves: ["palabra en minusculas"], nombre, url, busqueda (opcional, se le pega el termino), envios, verificado }.
     Vacia el 23/10/2026: Soundcore/Anker (soundcore.com/policies/shipping-policy) y Keychron (keychron.com/pages/where-to-buy)
     no nombran a Argentina. */
  const OFICIALES = [];

  const normalTermino = t => String(t === undefined || t === null ? "" : t).trim().replace(/\s+/g, " ");

  /* La busqueda de un termino en una fuente; sin termino (o sin busqueda conocida), su portada. Amazon, con el tag. */
  function urlBusqueda(fuente, termino) {
    const t = normalTermino(termino);
    if (fuente.afiliado) return `${fuente.url}${t ? `s?k=${encodeURIComponent(t)}&` : "?"}tag=${AMAZON_TAG}`;
    if (!t || !fuente.busqueda) return fuente.url;
    return fuente.busqueda + t.split(" ").map(encodeURIComponent).join("+");
  }

  /* Enlace de una fuente. Amazon lleva el tag de afiliado y, si hay termino, la busqueda de ese producto. */
  function enlaceFuente(fuente, termino) {
    return fuente.afiliado ? urlBusqueda(fuente, termino) : fuente.url;
  }

  /* --- Pegar un link (spec 020) ---
     Del link sale lo que dice la propia direccion: la tienda, el codigo del producto y un nombre legible del slug. La pagina no
     se lee desde el navegador (las tiendas no lo permiten): el precio, cuando se puede, lo lee el Worker (spec 023).
     Primera version de parsearEnlace y urlBusqueda: OmniRoute `revision` (gpt-oss-120b), corrida contra los tests antes de usarla. */
  function nombreDeSlug(slug) {
    if (!slug) return "";
    let t;
    try { t = decodeURIComponent(slug); } catch (e) { t = slug; }
    return t.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120).trim();
  }

  /* ASIN y slug de una ruta de Amazon: con idioma (/-/es/...), varios segmentos antes de /dp/, /gp/product/, /gp/aw/d/ y los
     patrocinados (/sspa/click?url=/.../dp/ASIN, solo como ruta dentro de Amazon). Spec 023; primera version de OmniRoute
     `revision` (gpt-oss-120b), 16/16 casos. */
  function amazonDeRuta(ruta, busqueda, profundidad = 0) {
    const s = ruta.split("/").filter(Boolean), asin = x => /^[a-z0-9]{10}$/i.test(x || "");
    for (let i = 0; i < s.length - 1; i++) {
      if (s[i].toLowerCase() === "dp" && asin(s[i + 1])) {
        const previo = s[i - 1];
        return { asin: s[i + 1].toUpperCase(), slug: previo && previo !== "-" && !/^[a-z]{2}(?:[_-][a-z]{2})?$/i.test(previo) ? previo : "" };
      }
    }
    for (let i = 0; i < s.length; i++) {
      if (s[i].toLowerCase() !== "gp") continue;
      const sig = (s[i + 1] || "").toLowerCase();
      if (sig === "product" && asin(s[i + 2])) return { asin: s[i + 2].toUpperCase(), slug: "" };
      if (sig === "aw" && (s[i + 2] || "").toLowerCase() === "d" && asin(s[i + 3])) return { asin: s[i + 3].toUpperCase(), slug: "" };
    }
    if ((s[0] || "").toLowerCase() === "sspa" && (s[1] || "").toLowerCase() === "click" && profundidad < 2) {
      const destino = new URLSearchParams(busqueda || "").get("url") || "";
      if (!destino.startsWith("/") || destino.startsWith("//")) return null;
      const [camino, resto] = destino.split("?", 2);
      return amazonDeRuta(camino, resto ? "?" + resto : "", profundidad + 1);
    }
    return null;
  }

  /* Amazon de otros paises: se reconoce con su dominio y su moneda; el tag de afiliado es solo de amazon.com. */
  const AMAZON_PAISES = { "amazon.es": "EUR", "amazon.de": "EUR", "amazon.fr": "EUR", "amazon.it": "EUR", "amazon.co.uk": "GBP",
    "amazon.com.mx": "MXN", "amazon.com.br": "BRL", "amazon.co.jp": "JPY" };

  const HOSTS = {
    amazon: ["amazon.com", "www.amazon.com", "smile.amazon.com"],
    tiendamia: ["tiendamia.com.ar", "www.tiendamia.com.ar", "tiendamia.com", "www.tiendamia.com"],
    loquieroaca: ["loquieroaca.com", "www.loquieroaca.com"],
    ebay: ["ebay.com", "www.ebay.com"],
  };

  /* Lo que se pego -> { tienda, id, nombre, url } (Tiendamia suma `origen`: amz, ebay...), o null si no es un link conocido.
     El host tiene que ser exacto: amazon.com.otro.com no es Amazon. */
  function parsearEnlace(texto) {
    if (texto === undefined || texto === null) return null;
    let s = String(texto).trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = "https://" + s;
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase(), ruta = u.pathname;
    const es = tienda => HOSTS[tienda].includes(host);
    let m;
    const pais = host.replace(/^www\./, "");
    if (es("amazon") || AMAZON_PAISES[pais]) {
      const a = amazonDeRuta(ruta, u.search);
      if (!a) return null;
      if (es("amazon")) return { tienda: "amazon", id: a.asin, nombre: nombreDeSlug(a.slug), url: "https://www.amazon.com/dp/" + a.asin };
      return { tienda: "amazon", id: a.asin, nombre: nombreDeSlug(a.slug), url: `https://www.${pais}/dp/${a.asin}`, dominio: pais };
    }
    // Links cortos (amzn.to, y a.co del «Compartir» de la app): sin abrirlos no se sabe el producto.
    if (host === "amzn.to" || host === "a.co") return ruta.length > 1 ? { tienda: "amazon", id: null, nombre: "", url: u.href } : null;
    if (es("tiendamia")) {
      m = ruta.match(/^\/p\/([a-z]+)\/([a-z0-9]+)(?:\/([^/]+))?/i);
      if (!m) return null;
      const origen = m[1].toLowerCase();
      return { tienda: "tiendamia", id: origen === "amz" ? m[2].toUpperCase() : m[2], origen, nombre: nombreDeSlug(m[3]),
        url: `https://tiendamia.com.ar/p/${origen}/${m[2]}${m[3] ? "/" + m[3] : ""}` };
    }
    if (es("loquieroaca")) {
      m = ruta.match(/^\/products\/(?:([^/]+)-)?(\d+)\/?$/i);
      if (!m) return null;
      return { tienda: "loquieroaca", id: m[2], nombre: nombreDeSlug(m[1]),
        url: `https://www.loquieroaca.com/products/${m[1] ? m[1] + "-" : ""}${m[2]}` };
    }
    if (es("ebay")) {
      m = ruta.match(/^\/itm\/(?:([^/]+)\/)?(\d{9,15})(?:\/|$)/i);
      if (!m) return null;
      return { tienda: "ebay", id: m[2], nombre: nombreDeSlug(m[1]), url: "https://www.ebay.com/itm/" + m[2] };
    }
    return null;
  }

  const amazonDp = asin => `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;

  /* Lo que se muestra de un link reconocido: la tienda, a donde abrirlo (Amazon con el tag) y, si Tiendamia lo trae de Amazon,
     el mismo producto en Amazon. */
  function datosDeEnlace(e) {
    if (!e) return null;
    const base = { tiendaNombre: "", abrir: e.url, afiliado: false, mismoEnAmazon: null };
    if (e.tienda === "amazon" && e.dominio) return { ...base, tiendaNombre: `Amazon (${e.dominio})` };
    if (e.tienda === "amazon") return { ...base, tiendaNombre: "Amazon (EE.UU.)", abrir: e.id ? amazonDp(e.id) : e.url, afiliado: !!e.id };
    if (e.tienda === "tiendamia") return { ...base, tiendaNombre: "Tiendamia", mismoEnAmazon: e.origen === "amz" ? amazonDp(e.id) : null };
    if (e.tienda === "loquieroaca") return { ...base, tiendaNombre: "Loquieroaca" };
    return { ...base, tiendaNombre: "eBay (EE.UU.)" };
  }

  /* --- Lo que el Worker lee del link pegado (spec 023, GET /enlace) --- */
  const usdTexto = n => "US$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pesosTexto = n => "$" + Math.round(n).toLocaleString("es-AR");
  const POR_API = { amazon: "Amazon", ebay: "eBay" };

  /* La consulta al Worker; "" sin Worker configurado (sitio.json afuera_url) o sin link. */
  function urlLeerEnlace(base, texto) {
    const t = String(texto === undefined || texto === null ? "" : texto).trim();
    return base && t ? base + "/enlace?url=" + encodeURIComponent(t) : "";
  }

  /* La respuesta de /enlace -> { precio (en dolares, texto) o null, ars, nombre, linea } o null si no hay que mostrar nada. La
     linea es la referencia: el precio final de Tiendamia (y el porcentaje contra Amazon) o el de Loquieroaca, en pesos. */
  function leidoDeEnlace(r) {
    if (!r || !r.enlace) return null;
    if (!r.leido) return r.motivo ? { precio: null, ars: false, nombre: "", linea: r.motivo } : null;
    const it = r.item;
    if (!it || !(it.precio > 0)) return null;
    if (it.moneda === "ARS") {
      return { precio: null, ars: true, nombre: it.nombre || "", linea: `Loquieroacá: ${pesosTexto(it.precioArs || it.precio)} en un pago`
        + (it.precioCuotas > 0 ? ` o ${pesosTexto(it.precioCuotas)} en cuotas` : "") + ", ya puesto en casa (impuestos y envío incluidos)." };
    }
    // Spec 039: la ficha de Tiendamia publica su precio final y el precio base de Amazon; de ahi sale el porcentaje del recargo.
    const recargo = it.precioBase > 0 && it.recargoPct != null
      ? ` En Amazon sale ${usdTexto(it.precioBase)}: un ${it.recargoPct} % más con envío e impuestos incluidos (aproximado).` : "";
    if (it.fuente === "tiendamia") {
      if (r.enlace.tienda === "amazon")       // un link de Amazon cruzo a la ficha de Tiendamia (sin la Creators API)
        return { precio: it.precioBase > 0 ? String(it.precioBase) : "", ars: false, nombre: it.nombre || "",
          linea: `Tiendamia tiene este producto a ${usdTexto(it.precio)}, con el envío incluido.${recargo} Revisalo antes de pagar: puede cambiar.` };
      return { precio: String(it.precio), ars: false, nombre: it.nombre || "",
        linea: `Precio leído en Tiendamia: ${usdTexto(it.precio)}, con el envío incluido.${recargo} Revisalo antes de pagar: puede cambiar.` };
    }
    const tienda = r.enlace.tienda;
    const linea = `Precio leído por la API de ${POR_API[tienda] || tienda}: ${usdTexto(it.precio)}.`;
    return { precio: String(it.precio), ars: false, nombre: it.nombre || "", linea };
  }

  /* --- El bloque de pegar un link (spec 040): vive en «Buscalo afuera», sin formulario ni desglose --- */
  const NO_RECONOCIDO = "No reconozco ese link. Por ahora leo los de Amazon, Tiendamia, Loquieroacá y eBay.";

  function pegarLinkHtml() {
    return `<div class="pegar-link">
        <h4>¿Ya lo encontraste? Pegá el link</h4>
        <label for="pl-link">Link del producto en Amazon, Tiendamia, Loquieroacá o eBay</label>
        <input id="pl-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://tiendamia.com.ar/p/amz/…" aria-describedby="pl-ayuda">
        <small id="pl-ayuda" class="sub chico">De Tiendamia y Loquieroacá leemos el precio final de la página que pegás; de Amazon y eBay, solo por su API cuando esté activa.</small>
        <div id="pl-res" aria-live="polite"></div></div>`;
  }

  /* La ficha de un link: tienda, codigo, enlaces y el lugar de la linea leida (la llena js/vista-afuera.js). */
  function fichaEnlaceHtml(e, { esc, icono = () => "" }) {
    const d = datosDeEnlace(e);
    if (!d) return `<p class="sub chico">${esc(NO_RECONOCIDO)}</p>`;
    const abrir = `<a class="acc" href="${esc(d.abrir)}" target="_blank" rel="${d.afiliado ? "sponsored noopener" : "noopener"}">${icono("fuera")} Abrir en ${esc(d.tiendaNombre)}</a>`
      + (d.afiliado ? ' <span class="rotulo">enlace de afiliado · <a href="legal/#afiliados">qué es</a></span>' : "")
      + (d.mismoEnAmazon ? ` <a class="acc" href="${esc(d.mismoEnAmazon)}" target="_blank" rel="sponsored noopener">El mismo en Amazon</a> <span class="rotulo">enlace de afiliado</span>` : "");
    return `<div class="pl-ficha">
        <p><b>${esc(d.tiendaNombre)}</b>${e.id ? ` · código ${esc(e.id)}` : " · link corto: abrilo para ver el producto"}${e.nombre ? `<br><span class="sub">«${esc(e.nombre)}»</span>` : ""}</p>
        <p class="pl-acciones">${abrir}</p>
        <p class="sub chico pl-leido" aria-live="polite"></p></div>`;
  }

  /* La linea de la ficha con lo que leyo el Worker; el nombre leido va solo si el link no lo traia. */
  function lineaLeida(l, e) {
    if (!l) return "";
    return (l.nombre && !(e && e.nombre) ? `«${l.nombre}» · ` : "") + l.linea;
  }

  /* --- Buscar afuera (spec 020): cuando ninguna tienda del indice tiene el termino --- */
  const normalMarca = t => normalTermino(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const verificada = o => /^https:\/\//.test(o.url || "") && /^https:\/\//.test(o.envios || "") && /^\d{4}-\d{2}-\d{2}$/.test(o.verificado || "");

  /* Las tiendas oficiales verificadas cuya marca nombra el termino (palabra entera). */
  function oficialesPara(termino, lista = OFICIALES) {
    const t = ` ${normalMarca(termino).replace(/[^a-z0-9]+/g, " ")} `;
    if (!t.trim()) return [];
    return lista.filter(o => verificada(o) && (o.claves || []).some(c => t.includes(` ${normalMarca(c)} `)));
  }

  const fecha = iso => iso.split("-").reverse().join("/");

  /* El bloque con la busqueda ya armada en cada fuente (y en la tienda oficial verificada, si la hay). Solo enlaces. */
  function buscarAfueraHtml(termino, { esc, icono = () => "", oficiales = OFICIALES }) {
    const t = normalTermino(termino);
    const fuentes = FUENTES.map(f => `<li><a href="${esc(urlBusqueda(f, t))}" target="_blank" rel="${f.afiliado ? "sponsored noopener" : "noopener"}">${icono("fuera")} ${esc(f.nombre)}</a>
        ${f.afiliado ? '<span class="rotulo">enlace de afiliado · <a href="legal/#afiliados">qué es</a></span>' : ""}
        <span class="sub chico">${esc(f.texto)}</span></li>`);
    const propias = oficialesPara(t, oficiales).map(o => `<li><a href="${esc(o.busqueda ? o.busqueda + encodeURIComponent(t) : o.url)}" target="_blank" rel="noopener">${icono("fuera")} ${esc(o.nombre)}</a>
        <span class="sub chico">Tienda oficial de ${esc(o.marca)}: envía a Argentina según <a href="${esc(o.envios)}" target="_blank" rel="noopener">su página de envíos</a> (verificado el ${esc(fecha(o.verificado))}).</span></li>`);
    return `<section class="afuera" aria-labelledby="afuera-tit">
      <h3 id="afuera-tit">Buscalo afuera: la búsqueda ya está armada</h3>
      <p class="sub chico">Cada enlace abre en otra pestaña la búsqueda de «${esc(t)}» en esa tienda.</p>
      <ul class="afuera-lista">${[...fuentes, ...propias].join("")}</ul>
      ${pegarLinkHtml()}</section>`;
  }

  const api = { FUENTES, OFICIALES, AMAZON_TAG, NO_RECONOCIDO, enlaceFuente, urlBusqueda, parsearEnlace, datosDeEnlace, oficialesPara,
    buscarAfueraHtml, pegarLinkHtml, fichaEnlaceHtml, lineaLeida, urlLeerEnlace, leidoDeEnlace };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Importar = api;
})(this);
