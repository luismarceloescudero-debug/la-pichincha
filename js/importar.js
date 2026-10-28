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
      // Spec 041: no hay filtro de envio internacional en la URL (verificado el 27/10/2026): Amazon muestra lo que se envia segun
      // la direccion «Enviar a» de quien mira. Por eso el aviso y no un parametro.
      texto: "Muchos productos no se envían a Argentina: elegí «Enviar a: Argentina» arriba y Amazon muestra solo los que sí. El envío y los impuestos los pagás vos: revisá el total del checkout antes de pagar." },
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
     linea es la referencia: el precio de Tiendamia (y el de Amazon que cita su ficha) o el final de Loquieroaca, en pesos. */
  function leidoDeEnlace(r) {
    if (!r || !r.enlace) return null;
    if (!r.leido) return r.motivo ? { precio: null, ars: false, nombre: "", linea: r.motivo } : null;
    const it = r.item;
    if (!it || !(it.precio > 0)) return null;
    if (it.moneda === "ARS") {
      return { precio: null, ars: true, nombre: it.nombre || "", linea: `Loquieroacá: ${pesosTexto(it.precioArs || it.precio)} en un pago`
        + (it.precioCuotas > 0 ? ` o ${pesosTexto(it.precioCuotas)} en cuotas` : "") + ", ya puesto en casa (impuestos y envío incluidos)." };
    }
    /* La ficha de Tiendamia publica su precio y el de Amazon (merchant_price, spec 039). El envio internacional y los servicios
       de importacion no estan en la ficha: los suma el carrito (spec 041), que el Worker no lee. */
    const enAmazon = it.precioBase > 0 ? ` En Amazon figura a ${usdTexto(it.precioBase)}.` : "";
    if (it.fuente === "tiendamia") {
      if (r.enlace.tienda === "amazon")       // un link de Amazon cruzo a la ficha de Tiendamia (sin la Creators API)
        return { precio: it.precioBase > 0 ? String(it.precioBase) : "", ars: false, nombre: it.nombre || "",
          linea: `Tiendamia tiene este producto a ${usdTexto(it.precio)}.${enAmazon} Revisalo antes de pagar: puede cambiar.` };
      return { precio: String(it.precio), ars: false, nombre: it.nombre || "", linea: `Precio leído en Tiendamia: ${usdTexto(it.precio)}.`
        + `${enAmazon} El envío internacional y los servicios de importación se suman en el carrito: pegá abajo su detalle para verlos.` };
    }
    const tienda = r.enlace.tienda;
    const linea = `Precio leído por la API de ${POR_API[tienda] || tienda}: ${usdTexto(it.precio)}.`;
    return { precio: String(it.precio), ars: false, nombre: it.nombre || "", linea };
  }

  /* --- El detalle del carrito de Tiendamia (spec 041) ---
     La persona pega el texto del «Detalle de la compra» de su carrito (el Worker no lo lee: el robots.txt lo prohibe). Se lee en
     el navegador y no sale a ningun lado. Cada rotulo toma el primer AR$ que le sigue; miles con punto y decimales con coma. */
  const RE_ARS = String.raw`ar\$\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)`;
  /* Con la direccion cargada, el carrito suma «IVA e impuestos internos» (a veces «+ Aranceles y gestión aduanera»), «Envío
     Estándar a tu dirección» y cierra con «Subtotal» o «Total»; la cantidad viene como «Producto(s) (2)». */
  const ROTULOS = { conCantidad: String.raw`producto(?:s|\(s\))?\s*\((\d+)\)`, productos: "productos()", envio: String.raw`envio\s+internacional`,
    servicios: String.raw`servicios\s+de\s+importacion`, impuestos: String.raw`iva\s+e\s+impuestos`,
    envioLocal: String.raw`envio\s+estandar\s+a\s+tu\s+direccion`, total: String.raw`(?<![a-z])total`, subtotal: "subtotal" };
  const pesosNum = t => Number(t.replace(/\./g, "").replace(",", "."));

  function parsearDetalleTiendamia(texto) {
    if (texto === undefined || texto === null) return null;
    const t = String(texto).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const leer = clave => t.match(new RegExp(`${ROTULOS[clave]}[^$]*?${RE_ARS}`));   // [^$]: no salta al monto de otro rotulo
    const p = leer("conCantidad") || leer("productos");     // «Productos de USA» va antes de «Productos (1)»
    if (!p) return null;
    const monto = clave => { const m = leer(clave); return m ? pesosNum(m[m.length - 1]) : 0; };
    const d = { cantidad: p[1] ? Number(p[1]) : 1, productos: pesosNum(p[2]), envio: monto("envio"), servicios: monto("servicios"),
      impuestos: monto("impuestos"), envioLocal: monto("envioLocal") };
    const cierre = leer("total") || leer("subtotal");
    return { ...d, subtotal: cierre ? pesosNum(cierre[1]) : d.productos + d.envio + d.servicios + d.impuestos + d.envioLocal };
  }

  const milesTexto = n => Math.round(n).toLocaleString("es-AR");

  /* La linea con el detalle pegado. item: lo que el Worker leyo de la ficha (precio = USD de Tiendamia, precioBase =
     merchant_price de Amazon). Dolar implicito = productos / (precio x cantidad); Amazon = merchant_price x cantidad x dolar +
     los mismos cargos (envio, servicios y, si el carrito los trae, impuestos y envio a tu direccion). Sin esos precios, solo el
     total. */
  function referenciaCarrito(d, item) {
    if (!d) return "";
    const impuestos = d.impuestos || 0, envioLocal = d.envioLocal || 0;
    const total = `Tiendamia: AR$ ${milesTexto(d.subtotal)} en total (producto ${milesTexto(d.productos)} + envío ${milesTexto(d.envio)}`
      + ` + servicios de importación ${milesTexto(d.servicios)}`
      + (impuestos ? ` + IVA e impuestos ${milesTexto(impuestos)}` : "") + (envioLocal ? ` + envío a tu dirección ${milesTexto(envioLocal)}` : "") + ").";
    const fin = " Aproximado: revisalo antes de pagar.";
    if (!item || !(item.precio > 0) || !(item.precioBase > 0)) return total + fin;
    const dolar = d.productos / (item.precio * d.cantidad);
    const amazon = item.precioBase * d.cantidad * dolar + d.envio + d.servicios + impuestos + envioLocal;
    const base = (d.cantidad > 1 ? `${d.cantidad} × ` : "") + usdTexto(item.precioBase);
    const mismos = impuestos || envioLocal ? "los mismos envíos, servicios e impuestos" : "el mismo envío y servicios";
    return `${total} Comprado en Amazon saldría aprox. AR$ ${milesTexto(amazon)} (${base} al dólar de Tiendamia + ${mismos}).${fin}`;
  }

  /* --- El detalle pegado, igual para los cuatro proveedores (spec 042) ---
     Cada proveedor tiene su parser y todos devuelven la misma forma: { tienda, moneda, cantidad, producto, envio, importacion,
     impuestos, envioLocal, total, totalLeido, otros: [{ rotulo, monto }], notas: [] }. Tiendamia usa parsearDetalleTiendamia
     (spec 041); Amazon, eBay y Loquieroaca, la lectura por rotulo + monto de abajo. Se lee en el navegador: no sale a ningun lado. */

  /* Un monto con su moneda antes (US$, US $, U$S, USD, AR$, ARS, EUR, €, $) o despues (€, EUR, USD). El signo puede ir antes o
     despues de la moneda («-US$27.10» de la promocion de envio de Amazon). */
  const MONEDA = String.raw`us\s?\$|u\$s|usd|ar\$|ars|eur|€|\$`;
  const RE_MONTO = new RegExp(String.raw`(-)?\s*(${MONEDA})\s*(-)?\s*(\d[\d.,]*\d|\d)|(-)?\s*(\d[\d.,]*\d|\d)\s*(€|eur|usd)(?![a-z])`, "g");
  const MONEDA_DE = m => /^ar|^ars/.test(m) ? "ARS" : /eur|€/.test(m) ? "EUR" : /^\$$/.test(m) ? null : "USD";

  /* «1.234,56», «1,234.56», «168.99», «371.667»: el ultimo separador es decimal si le siguen 1 o 2 cifras; si le siguen 3, es
     de miles. */
  function numeroFlexible(t) {
    const i = Math.max(t.lastIndexOf("."), t.lastIndexOf(","));
    if (i < 0) return Number(t);
    const decimales = t.length - i - 1;
    if (decimales === 3) return Number(t.replace(/[.,]/g, ""));
    return Number(t.slice(0, i).replace(/[.,]/g, "") + "." + t.slice(i + 1));
  }

  /* Las parejas rotulo + monto, en orden. El rotulo es el texto entre el monto anterior y este, en su ultimo renglon o despues
     de la ultima barra (el dueño pego el checkout de Amazon como «Productos: US$168.99 / Envío y manejo: US$27.10 / ...»). */
  const ultimoRenglon = trozo => (trozo.split(/\n|\s\/\s|\|/).map(x => x.trim()).filter(x => x && x.toLowerCase() !== "tooltip").pop() || "")
    .replace(/^[\s:/|·-]+|[\s:·]+$/g, "");
  function parejas(texto, monedaPesos) {
    const original = String(texto);
    // Sin tildes y en minusculas letra por letra: las posiciones son las del original, del que sale el rotulo que se muestra.
    const t = original.toLowerCase().replace(/[áàäâ]/g, "a").replace(/[éèëê]/g, "e").replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o").replace(/[úùüû]/g, "u");
    const salida = [];
    let previo = 0;
    for (const m of t.matchAll(RE_MONTO)) {
      const rotulo = ultimoRenglon(t.slice(previo, m.index)), visible = ultimoRenglon(original.slice(previo, m.index));
      previo = m.index + m[0].length;
      const negativo = !!(m[1] || m[3] || m[5]);
      const moneda = m[2] !== undefined ? MONEDA_DE(m[2].replace(/\s/g, "")) || monedaPesos : MONEDA_DE(m[7]);
      const monto = numeroFlexible(m[4] !== undefined ? m[4] : m[6]);
      if (Number.isFinite(monto)) salida.push({ rotulo, visible, moneda, monto: negativo ? -monto : monto });
    }
    return salida;
  }

  /* A que fila va cada rotulo. Son palabras clave, no rotulos inventados: los unicos rotulos vistos de verdad son los del
     checkout de Amazon.com (28/10/2026) y los del carrito de Tiendamia (spec 041). El orden importa: «Cargos de importacion»
     va antes que «impuestos»; «envio a tu direccion» antes que «envio»; «subtotal» no es «total». */
  const CLASES = [
    ["total", /(^|[^a-z])total(?!\s*parcial)(?![a-z])/],
    ["subtotal", /subtotal|total\s+parcial/],
    ["importacion", /importacion|import|aduan|arancel|customs|dut(y|ies)|servicios/],
    ["impuestos", /impuesto|(^|[^a-z])iva([^a-z]|$)|tax/],
    ["envioLocal", /a tu direccion|a domicilio|envio local|entrega local/],
    ["envio", /envio|shipping|postage|flete|manejo/],
    ["producto", /producto|articulo|item|precio/],
  ];
  const claseDe = rotulo => (CLASES.find(([, re]) => re.test(rotulo)) || [null])[0];

  const montoTexto = (n, moneda) => (n < 0 ? "−" : "") + (moneda === "ARS" ? "AR$ " + milesTexto(Math.abs(n))
    : (moneda === "EUR" ? "€ " : "US$ ") + Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  /* La lectura comun: suma cada rotulo en su fila (la promocion de envio de Amazon resta del envio), toma el total si esta y,
     si no, la suma. Lo que no se sabe a que fila va queda en `otros` (y dentro del total leido). */
  function detallePorRotulos(tienda, texto, monedaPesos) {
    if (texto === undefined || texto === null) return null;
    const pares = parejas(texto, monedaPesos).filter(p => p.moneda);
    if (!pares.length) return null;
    const moneda = (pares.find(p => claseDe(p.rotulo) === "total") || pares[0]).moneda;
    const d = { tienda, moneda, cantidad: 1, producto: 0, envio: 0, importacion: 0, impuestos: 0, envioLocal: 0, total: 0,
      totalLeido: false, otros: [], notas: [] };
    let subtotal = null, hayProducto = false, otraMoneda = false;
    const descuentos = [];
    for (const p of pares) {
      if (p.moneda !== moneda) { otraMoneda = true; continue; }
      const clase = claseDe(p.rotulo);
      if (clase === "total") { if (!d.totalLeido) { d.total = p.monto; d.totalLeido = true; } }
      else if (clase === "subtotal") { if (subtotal === null) subtotal = p.monto; }
      else if (clase) {
        d[clase] += p.monto;
        if (clase === "producto") hayProducto = true;
        if (p.monto < 0) descuentos.push(`«${p.visible}» (${montoTexto(p.monto, moneda)})`);
      }
      else d.otros.push({ rotulo: p.visible, monto: p.monto });
    }
    if (!hayProducto && subtotal !== null) { d.producto = subtotal; hayProducto = true; }
    if (!hayProducto) return null;
    const cant = String(texto).toLowerCase().match(/(\d+)\s*(?:productos|articulos|artículos|items)|(?:productos|art[ií]culos|items)\s*\((\d+)\)/);
    if (cant) d.cantidad = Number(cant[1] || cant[2]) || 1;
    const suma = d.producto + d.envio + d.importacion + d.impuestos + d.envioLocal + d.otros.reduce((s, o) => s + o.monto, 0);
    for (const k of ["producto", "envio", "importacion", "impuestos", "envioLocal"]) d[k] = Math.round(d[k] * 100) / 100;
    if (!d.totalLeido) d.total = Math.round(suma * 100) / 100;
    else if (Math.abs(suma - d.total) > Math.max(1, d.total * 0.01))
      d.notas.push(`La suma de lo pegado (${montoTexto(suma, moneda)}) no da el total: puede faltar un renglón.`);
    if (descuentos.length) d.notas.push(`Ya descontado en su fila: ${descuentos.join(", ")}.`);
    if (d.otros.length) d.notas.push(`No sé en qué fila va ${d.otros.map(o => `«${o.rotulo || "sin rótulo"}»`).join(", ")}: está en el total, no en el desglose.`);
    if (otraMoneda) d.notas.push(`Hay montos en otra moneda que no sumé: el desglose va en ${moneda === "ARS" ? "pesos" : moneda === "EUR" ? "euros" : "dólares"}.`);
    return d;
  }

  /* Amazon.com: el checkout de AmazonGlobal que pego el dueño el 28/10/2026 (Productos, Envío y manejo, Promoción de envío
     GRATIS, Cálculo estimado de impuestos por cobrar, Cargos de importación, Total del pedido). Un «$» solo es dolar. */
  const parsearDetalleAmazon = texto => detallePorRotulos("amazon", texto, "USD");
  /* eBay y Loquieroaca: sin un pegado real todavia (pendiente del dueño); la misma lectura tolerante. En eBay un «$» solo es
     dolar; en Loquieroaca, pesos. */
  const parsearDetalleEbay = texto => detallePorRotulos("ebay", texto, "USD");
  const parsearDetalleLoquieroaca = texto => detallePorRotulos("loquieroaca", texto, "ARS");

  /* El carrito de Tiendamia en la forma comun. */
  function detalleTiendamia(texto) {
    const d = parsearDetalleTiendamia(texto);
    if (!d) return null;
    return { tienda: "tiendamia", moneda: "ARS", cantidad: d.cantidad, producto: d.productos, envio: d.envio, importacion: d.servicios,
      impuestos: d.impuestos, envioLocal: d.envioLocal, total: d.subtotal, totalLeido: true, otros: [], notas: [], tiendamia: d };
  }

  const PARSERS = { amazon: parsearDetalleAmazon, ebay: parsearDetalleEbay, loquieroaca: parsearDetalleLoquieroaca, tiendamia: detalleTiendamia };

  /* El detalle pegado para la tienda del link. */
  function parsearDetalle(tienda, texto) {
    const p = PARSERS[tienda];
    return p ? p(texto) : null;
  }

  /* Las filas, las mismas en todos los proveedores. `cotizacion`: { valor (pesos por unidad de la moneda), nombre, fuente, hora }
     o null; sin ella, un total en dolares o euros queda «sin cotización» (no se convierte con un valor viejo sin decirlo). */
  function filasDetalle(d, cotizacion) {
    if (!d) return [];
    const f = (clave, rotulo, monto) => ({ clave, rotulo, texto: montoTexto(monto, d.moneda), monto });
    const filas = [f("producto", d.cantidad > 1 ? `Producto (${d.cantidad})` : "Producto", d.producto),
      f("envio", "Envío", d.envio), f("importacion", "Importación o servicios", d.importacion), f("impuestos", "Impuestos", d.impuestos),
      f("envioLocal", "Envío local", d.envioLocal), f("total", "Total", d.total)];
    let pesos;
    if (d.moneda === "ARS") pesos = { clave: "pesos", rotulo: "Total en pesos", texto: montoTexto(d.total, "ARS"), monto: d.total };
    else if (cotizacion && cotizacion.valor > 0)
      pesos = { clave: "pesos", rotulo: "Total en pesos", monto: Math.round(d.total * cotizacion.valor),
        texto: montoTexto(d.total * cotizacion.valor, "ARS"), nota: `a ${montoTexto(cotizacion.valor, "ARS")} (${cotizacion.nombre}${cotizacion.hora ? ", " + cotizacion.hora : ""}${cotizacion.fuente ? ", " + cotizacion.fuente : ""})` };
    else pesos = { clave: "pesos", rotulo: "Total en pesos", texto: "sin cotización", monto: null };
    return [...filas, pesos];
  }

  /* El desglose en una tabla, mas las notas y, en Tiendamia, la cuenta de Amazon al dolar de Tiendamia (spec 041). */
  function detalleHtml(d, { esc, cotizacion = null, item = null }) {
    if (!d) return "";
    const filas = filasDetalle(d, cotizacion).map(r => `<tr class="pl-d-${r.clave}"><th scope="row">${esc(r.rotulo)}</th>`
      + `<td${r.monto === null ? ' class="pl-sin"' : ""}>${esc(r.texto)}${r.nota ? `<br><span class="sub chico">${esc(r.nota)}</span>` : ""}</td></tr>`).join("");
    const notas = d.notas.map(n => `<p class="sub chico">${esc(n)}</p>`).join("");
    const extra = d.tiendamia ? `<p class="sub chico">${esc(referenciaCarrito(d.tiendamia, item))}</p>`
      : `<p class="sub chico">Aproximado: revisalo antes de pagar.</p>`;
    return `<table class="pl-detalle"><caption class="sub chico">Desglose de lo que pegaste (${esc(TIENDAS_NOMBRE[d.tienda] || d.tienda)})</caption>`
      + `<tbody>${filas}</tbody></table>${notas}${extra}`;
  }
  const TIENDAS_NOMBRE = { amazon: "Amazon", ebay: "eBay", tiendamia: "Tiendamia", loquieroaca: "Loquieroacá" };

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

  /* Spec 042: el campo para pegar el detalle de la compra, en la ficha de los cuatro proveedores (lo lee js/vista-afuera.js).
     Cambia solo la ayuda: donde se copia el detalle en cada tienda. */
  const AYUDA_DETALLE = {
    amazon: { donde: "En el checkout de Amazon, con «Enviar a: Argentina», copiá el resumen del pedido (Productos, Envío, Cargos de importación, Total del pedido).",
      ejemplo: "Productos: US$… Envío y manejo: US$… Cargos de importación: US$… Total del pedido: US$…" },
    tiendamia: { donde: "Agregá el producto al carrito de Tiendamia y copiá el «Detalle de la compra».",
      ejemplo: "Productos (1) AR$… Envío Internacional AR$… Servicios de Importación AR$… Subtotal AR$…" },
    ebay: { donde: "Copiá el resumen del pago de eBay: cada concepto con su monto (artículo, envío, importación, total).",
      ejemplo: "Artículo US$… Envío US$… Total US$…" },
    loquieroaca: { donde: "Copiá el resumen de la compra de Loquieroacá: cada concepto con su monto.",
      ejemplo: "Producto $… Envío $… Total $…" },
  };
  const carritoHtml = tienda => {
    const a = AYUDA_DETALLE[tienda];
    return `<div class="pl-carrito">
          <label for="pl-carrito">Pegá el detalle de la compra</label>
          <textarea id="pl-carrito" rows="4" spellcheck="false" aria-describedby="pl-carrito-ayuda" placeholder="${a.ejemplo}"></textarea>
          <small id="pl-carrito-ayuda" class="sub chico">${a.donde} Se lee acá, en tu navegador: no se envía a ningún lado.</small>
          <div class="pl-carrito-res" aria-live="polite"></div></div>`;
  };

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
        <p class="sub chico pl-leido" aria-live="polite"></p>${AYUDA_DETALLE[e.tienda] ? carritoHtml(e.tienda) : ""}</div>`;
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
    buscarAfueraHtml, pegarLinkHtml, fichaEnlaceHtml, lineaLeida, urlLeerEnlace, leidoDeEnlace, parsearDetalleTiendamia, referenciaCarrito,
    numeroFlexible, parsearDetalleAmazon, parsearDetalleEbay, parsearDetalleLoquieroaca, parsearDetalle, filasDetalle, detalleHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Importar = api;
})(this);
