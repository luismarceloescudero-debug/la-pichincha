/* Importar desde la busqueda (spec 015): lo que une un aviso internacional con la calculadora de costos (js/calculadora.js).
   Dos cosas: (1) el enlace «Calcular con este precio» abre la calculadora con el precio del aviso ya cargado (en dolares, al
   dolar oficial, igual que js/puesto.js) y un peso tipico por rubro; (2) la lista de donde comprar afuera (Amazon, Tiendamia,
   Loquieroaca). Solo enlaces: no leemos esas tiendas ni sacamos precios de ellas (Tiendamia y Loquieroaca bloquean al lector;
   no se esquiva). Funciones puras: no tocan el DOM ni la red. Estimacion, no asesoramiento. */
(function (raiz) {
  "use strict";

  const C = typeof module === "object" && module.exports ? require("./calculadora.js") : raiz.Calculadora;
  const AMAZON_TAG = "lapichincha-20";   // el mismo ID que js/pagina.js; va en cada enlace de afiliado

  /* Peso tipico en kg, solo para precargar el campo: la persona lo cambia. No es una regla: importacion.json solo fija el tope
     de 50 kg por paquete (peso_max_kg). Las dimensiones no entran al calculo, asi que no se precargan. */
  const PESO_TIPICO = { smartphone: 0.3, notebook: 2.5, pc: 8, monitor: 6, componente: 1, periferico: 0.5, otro: 1 };

  /* Donde comprar afuera. `afiliado` marca el enlace que cobra comision (se rotula en la pagina, rel=sponsored). `busqueda`: la
     URL de busqueda de cada tienda, a la que se le pegan las palabras unidas con "+" (verificadas en la fuente el 23/10/2026:
     las dos devolvieron el Soundcore AeroClip 2; www.tiendamia.com da 403, tiendamia.com.ar responde). */
  const FUENTES = [
    { id: "amazon", nombre: "Amazon (EE.UU.)", url: "https://www.amazon.com/", afiliado: true,
      texto: "Compra directa en la tienda de EE.UU. El envío y los impuestos los pagás vos o el courier: calculalos acá antes de comprar." },
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

  const redondear = n => Math.round(n * 100) / 100;

  /* El estado que precarga la calculadora: el precio en dolares y el peso tipico del rubro. Todo lo demas, por defecto. */
  function estadoImportar(fobUsd, categoria) {
    const peso = PESO_TIPICO[categoria] !== undefined ? PESO_TIPICO[categoria] : PESO_TIPICO.otro;
    return { ...C.POR_DEFECTO, valor: String(redondear(fobUsd)), moneda: "USD", peso: String(peso) };
  }

  /* Enlace a la pestaña de costo con el precio cargado. pathname: la pagina actual (location.pathname). */
  function hrefCalculadora(fobUsd, categoria, pathname) {
    return C.urlDeEstado(pathname || "/", estadoImportar(fobUsd, categoria));
  }

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
     se lee: el navegador no puede (las tiendas no lo permiten) y no copiamos precios ajenos. El precio lo escribe la persona.
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

  /* Lo que la pestaña muestra de un link reconocido: a donde abrirlo, una ayuda de una linea sobre que precio escribir y que
     campos de la calculadora pisa. `calcula: false` cuando la tienda ya publica el precio final (Loquieroaca, en pesos). */
  function datosDeEnlace(e) {
    if (!e) return null;
    const base = { tiendaNombre: "", ayuda: "", abrir: e.url, afiliado: false, calcula: true, mismoEnAmazon: null,
      pisar: ["valor", "moneda", "cobro"] };
    if (e.tienda === "amazon" && e.dominio) return { ...base, tiendaNombre: `Amazon (${e.dominio})`,
      ayuda: `Escribí el precio del producto en ${AMAZON_PAISES[e.dominio]}, como lo muestra ${e.dominio}, sin el envío: el envío va en su campo.` };
    if (e.tienda === "amazon") return { ...base, tiendaNombre: "Amazon (EE.UU.)", abrir: e.id ? amazonDp(e.id) : e.url, afiliado: !!e.id,
      ayuda: "Escribí el precio del producto que muestra Amazon, sin el envío ni el depósito de impuestos («Import Fees Deposit»): el envío va en su campo." };
    if (e.tienda === "tiendamia") return { ...base, tiendaNombre: "Tiendamia", mismoEnAmazon: e.origen === "amz" ? amazonDp(e.id) : null,
      pisar: [...base.pisar, "flete"],
      ayuda: "Tiendamia muestra el precio con el envío incluido: elegí U$S arriba de su página y escribí ese número (el envío queda vacío acá). Los impuestos los suma en el resumen de pago." };
    if (e.tienda === "loquieroaca") return { ...base, tiendaNombre: "Loquieroaca", calcula: false, pisar: [],
      ayuda: "Loquieroaca publica el precio final en pesos, con impuestos y envío incluidos: no hace falta calcularlo, comparalo directo con las tiendas de acá." };
    return { ...base, tiendaNombre: "eBay (EE.UU.)",
      ayuda: "Escribí el precio del producto en dólares; el envío que muestra eBay va en su campo." };
  }

  /* El estado de la calculadora para un link y el precio que escribio la persona: en dolares y con los impuestos cobrados en el
     checkout (Amazon, eBay y Tiendamia los cobran ahi). null si la tienda ya da el precio final. */
  function estadoDeEnlace(e, precio) {
    const d = datosDeEnlace(e);
    if (!d || !d.calcula) return null;
    return { ...C.POR_DEFECTO, valor: normalTermino(precio), moneda: e.dominio ? AMAZON_PAISES[e.dominio] : "USD", cobro: "checkout" };
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
      <p class="sub chico">Cada enlace abre en otra pestaña la búsqueda de «${esc(t)}» en esa tienda. No leemos sus páginas ni sus precios.</p>
      <ul class="afuera-lista">${[...fuentes, ...propias].join("")}</ul></section>`;
  }

  const api = { PESO_TIPICO, FUENTES, OFICIALES, AMAZON_TAG, estadoImportar, hrefCalculadora, enlaceFuente, urlBusqueda,
    parsearEnlace, datosDeEnlace, estadoDeEnlace, oficialesPara, buscarAfueraHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Importar = api;
})(this);
