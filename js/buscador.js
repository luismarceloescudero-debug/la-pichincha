/* Funciones puras del buscador: no tocan el DOM ni variables de la pagina.
   index.html las carga como script comun (quedan en window.Buscador) y los
   tests las cargan con require() desde Node: node --test "tests/js/*.test.js". */
(function (raiz) {
  "use strict";

  const normal = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  /* Cada tienda escribe el mismo producto con otra tipografia: guiones largos, espacios duros, "U-Dimm" o "UDIMM", "16G"
     o "16GB", "1TB" o "1000GB". Todo eso se lleva a una sola forma antes de comparar, en lo que se busca y en los nombres:
     asi "b840m-h" encuentra "B840M H", "udimm" encuentra "U-Dimm" y "ssd 1tb" encuentra "SSD 1000GB". */
  const tipografia = t => t.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u00a0/g, " ")
    .replace(/\bs\.?o[\s.-]?dimm\b/g, "sodimm").replace(/\bu[\s-]?dimm\b/g, "udimm")
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, "$1 ");
  /* "1 TB" y "1TB" son lo mismo, y tambien "16G" y "16GB", y "1000GB" y "1024GB" con "1TB". */
  const pegarUnidades = t => t.replace(/(\d)\s+(gb|tb|mb|mhz|ghz|hz|w)\b/g, "$1$2").replace(/\b(?![345]g\b)(\d{1,3})g\b/g, "$1gb")    // 16G es 16GB; 4G y 5G son la red de un celular
    .replace(/\b(\d{4,5})gb\b/g, (m, n) => +n % 1000 === 0 ? +n / 1000 + "tb" : +n % 1024 === 0 ? +n / 1024 + "tb" : m);
  const normalBusq = t => pegarUnidades(tipografia(normal(t)));
  const esMedida = t => /^\d+(?:gb|tb|mb|mhz|ghz|hz|w|v)?$/.test(t);
  const escaparRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /* Que tiene que tener un nombre (ya pasado por normalBusq) para coincidir.
     Un numero, o un numero con su unidad (27, 1tb, 3200mhz), tiene que ser
     palabra entera: si no, "27" entra en "Vp227hf" y "2tb" en "12tb".
     Una palabra tiene que empezar donde no hay otra letra antes: si no, "ipad"
     entra en "disipador". Una cifra o una capacidad pegada adelante si vale:
     "512ssd" y "1tbssd" son SSD.
     Devuelve null si la consulta no tiene palabras. */
  function filtroDe(q) {
    const toc = normalBusq(q).split(/\s+/).filter(Boolean);
    if (!toc.length) return null;
    const pruebas = toc.map(t => {
      if (/^[a-z]/.test(t)) {
        const re = new RegExp("(^|[^a-z]|\\d(?:gb|tb))" + escaparRe(t));
        return n => re.test(n);
      }
      if (!esMedida(t)) return n => n.includes(t);
      const re = new RegExp("(^|[^0-9a-z])" + t + "([^0-9a-z]|$)");
      return n => re.test(n);
    });
    return n => pruebas.every(p => p(n));
  }

  function mediana(nums) {
    if (!nums.length) return 0;
    const o = [...nums].sort((a, b) => a - b), m = o.length >> 1;
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  }

  /* El piso de una marca buena casi nunca es la mejor compra: suele ser un modelo
     viejo o de entrada. Sin marca reconocida el umbral es mas exigente. */
  const pisoDeGama = (precio, niv, med) => precio < med * (niv === 0 ? 0.45 : 0.35);

  /* Que tan reconocida es la marca: 2 primera linea, 1 conocida, 0 sin reconocer. Es juicio
     editorial (la lista esta en datos.json): lo que no esta en ninguna lista no se castiga,
     solo no se destaca. Devuelve una funcion con memoria. */
  function crearNivelMarca(marcas) {
    const re = lista => lista && lista.length ? new RegExp("\\b(" + lista.map(escaparRe).join("|") + ")\\b") : /$^/;
    const primera = re((marcas || {}).primera), conocida = re((marcas || {}).conocida);
    const memo = new Map();
    return nombre => {
      let v = memo.get(nombre);
      if (v === undefined) {
        const n = normal(nombre);
        v = primera.test(n) ? 2 : conocida.test(n) ? 1 : 0;
        memo.set(nombre, v);
      }
      return v;
    };
  }

  /* Submarcas: la marca con la que el producto figura en los filtros y en el nombre, y su marca madre. */
  /* Solo marcas de verdad: una linea de producto (ROG, TUF, Omen, Nitro) no es una marca y seguiria siendo Asus, HP o Acer. */
  const SUBMARCAS = { soundcore: "anker", eufy: "anker", nebula: "anker", redmi: "xiaomi", poco: "xiaomi", hyperx: "hp",
                      alienware: "dell", cmf: "nothing" };
  const GENERICAS = new Set(["auricular", "auriculares", "inalambrico", "inalambricos", "bluetooth", "tws", "true", "wireless", "abierto",
    "abiertos", "con", "de", "para", "nuevo", "nueva", "original", "oficial", "garantia", "negro", "blanco", "azul", "rojo", "gris", "color",
    "pack", "combo", "cargador", "cable", "funda", "gancho", "clip", "gamer", "gaming"]);
  const ES_SPEC = /^\d+(?:gb|tb|mah|w|hz|mp|mm|cm|hs|h|v|ms)$/;
  const BY_MARCA = /\s+by\s+([a-z0-9&.-]+)/i;
  const capitalizar = t => t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t;

  /* "Soundcore AeroFit 2 by Anker Auriculares Soundcore" -> "Soundcore AeroFit 2 Auriculares": sin «by Marca» y sin
     palabras repetidas. */
  function limpiarTitulo(nombre) {
    const vistas = new Set(), salida = [];
    for (const w of String(nombre).replace(BY_MARCA, " ").split(/\s+/)) {
      const k = normal(w);
      if (!k || vistas.has(k)) continue;
      vistas.add(k);
      salida.push(w);
    }
    return salida.join(" ");
  }

  /* La submarca que nombra el titulo ("soundcore", "redmi"), o "". */
  function submarcaDe(nombre) {
    const toks = normal(String(nombre)).split(/[^a-z0-9]+/);
    for (let i = 0; i < toks.length; i++) {
      // "poco" es tambien una palabra comun ("poco uso"): cuenta solo seguido de un modelo (Poco X7, Poco F6)
      if (toks[i] === "poco" && !/^[a-z]\d/.test(toks[i + 1] || "")) continue;
      if (SUBMARCAS[toks[i]]) return toks[i];
    }
    return "";
  }

  /* La marca madre: la del «by X» si esta, o la de la tabla de submarcas. */
  function marcaMadreDe(nombre) {
    const by = String(nombre).match(BY_MARCA);
    return capitalizar(by ? by[1] : SUBMARCAS[submarcaDe(nombre)] || "");
  }

  /* Para buscar un producto con marca y submarca: la cadena de consultas, de la mas precisa a la mas amplia:
     submarca + modelo, solo el modelo y marca madre + modelo. El modelo conserva su numero (AeroFit 2 no es
     AeroFit Pro ni AeroClip) y se corta en la primera palabra generica o especificacion. Devuelve null si el titulo no
     tiene ni submarca conocida ni «by Marca»: ahi no hay cadena que armar. */
  function consultasDe(nombre) {
    const sub = submarcaDe(nombre);
    if (!sub && !BY_MARCA.test(String(nombre))) return null;
    const toks = limpiarTitulo(nombre).split(" ");
    const marca = sub ? toks.findIndex(t => normal(t) === sub) : -1;
    const i = marca >= 0 ? marca : toks.findIndex(t => !GENERICAS.has(normal(t)) && !/^\d+$/.test(t));
    if (i < 0) return null;
    const modeloToks = [];
    for (const t of toks.slice(i + 1)) {
      if (GENERICAS.has(normal(t)) || ES_SPEC.test(normal(t)) || modeloToks.length >= 4) break;
      modeloToks.push(t);
    }
    if (!modeloToks.length) return null;
    const modelo = modeloToks.join(" "), madre = marcaMadreDe(nombre) || capitalizar(SUBMARCAS[normal(toks[i])] || "");
    const consultas = [...new Set([toks[i] + " " + modelo, modelo, madre && normal(madre) !== normal(toks[i]) ? madre + " " + modelo : ""].filter(Boolean))];
    return { submarca: toks[i], madre, modelo, consultas };
  }

  /* La consulta con la que "Comparar" abre una oferta. Con marca y submarca, la primera de la cadena que encuentra
     algo (`hay(q)` dice si una consulta tiene resultados); sin ellas, la marca y las palabras sin cifras, sin el
     codigo de modelo, para que traiga competencia y no ese producto solo. */
  function consultaDeOferta(nombre, hay) {
    const info = consultasDe(nombre);
    if (info) return info.consultas.find(hay) || info.consultas[0];
    const palabras = String(nombre).split(/\s+/).filter(w => w.length >= 2 && !/\d/.test(w));
    return palabras.slice(0, 3).join(" ") || String(nombre).split(/\s+/).slice(0, 2).join(" ");
  }

  const ALIAS_MARCA = { xpg: "adata", gskill: "g.skill", tplink: "tp-link", "western digital": "wd" };
  const armarMarcasRe = lista => lista.map(m => [m, new RegExp("\\b" + escaparRe(m) + "\\b")]);

  /* La marca es la que aparece primero en el nombre: "Notebook HP Intel Core" es HP. */
  function marcaDe(nombre, marcasRe, alias = ALIAS_MARCA) {
    const sub = submarcaDe(nombre);       // «Soundcore AeroFit 2 by Anker» es Soundcore, que es como figura en los filtros
    if (sub) return sub;
    const n = normal(nombre);
    let mejor = "", pos = 1e9;
    for (const [m, re] of marcasRe) {
      const x = n.search(re);
      if (x >= 0 && x < pos) { pos = x; mejor = m; }
    }
    return alias[mejor] || mejor;
  }

  /* Lee del nombre del aviso lo que se pueda: el indice no tiene fichas tecnicas. */
  function specsDe(nombre) {
    const n = nombre.replace(/(\d),(\d)/g, "$1.$2");
    const s = {};
    let m;
    if ((m = n.match(/\bddr([345])\b/i))) s["Tipo"] = "DDR" + m[1];
    const caps = [...n.matchAll(/\b(\d{1,4})\s?(gb|tb)\b/gi)].map(x => x[1] + x[2].toUpperCase());
    if (caps.length) s["Capacidad"] = [...new Set(caps)].slice(0, 2).join(" + ");
    if ((m = n.match(/\b(\d{3,5})\s?mhz\b/i))) s["Velocidad"] = m[1] + " MHz";
    if ((m = n.match(/\bcl\s?(\d{2})\b/i))) s["Latencia"] = "CL" + m[1];
    if ((m = n.match(/\b(\d{3,4})\s?w\b/i))) s["Potencia"] = m[1] + " W";
    if ((m = n.match(/\b(\d{2}(?:\.\d)?)\s?(?:"|”|″|''|′′|pulgadas|pulg\b)/i))) s["Pantalla"] = m[1] + '"';
    if ((m = n.match(/\b(\d{2,3})\s?hz\b/i))) s["Refresco"] = m[1] + " Hz";
    if ((m = n.match(/\b(4k|uhd|wqhd|qhd|2k|fhd|full\s?hd|1080p|1440p|720p)\b/i)))
      s["Resolución"] = /full/i.test(m[1]) ? "FHD" : m[1].toUpperCase();
    if ((m = n.match(/\b(\d{1,2})\s?(?:nucleos|núcleos|cores)\b/i))) s["Núcleos"] = m[1];
    if (/so-?dimm/i.test(n)) s["Formato"] = "SODIMM";
    else if (/nvme|\bm\.?2\b/i.test(n)) s["Formato"] = "M.2 NVMe";
    else if (/sata/i.test(n)) s["Formato"] = "SATA";
    if (/\bargb\b|\brgb\b/i.test(n)) s["Luces"] = "RGB";
    return s;
  }

  /* Lo usado, reacondicionado o de caja abierta ("Nuevo con caja abierta" de Mercado Libre) no compite con lo nuevo
     ni es una oferta. Lo dice el nombre o, mejor, la fuente (sello u: la condicion de ComparaYa). */
  const RE_USADO = /outlet|usado|seminuev|semi[ -]nuev|segunda mano|2da mano|reacondicionad|refurb|open ?box|caja[ -]?abierta|exhibicion/;
  const esUsado = f => (typeof f[8] === "string" && f[8].includes("u")) || RE_USADO.test(normal(String(f[0] || "")));

  /* Avisos que no son comparables con el resto aunque coincidan con la busqueda,
     salvo que la propia busqueda los pida. */
  const REGLAS_EXCLUSION = [
    { id: "formato", re: /s\.?o[\s.-]?dimm/, pide: /s\.?o[\s.-]?dimm|notebook|laptop/ },
    // Un aviso que EMPIEZA con "Notebook", "PC" o "Combo" es un equipo completo: el
    // componente que buscas solo aparece de pasada. Anclado al inicio a proposito,
    // porque "SSD para notebook" si es un SSD.
    { id: "equipos", re: /^(notebook|laptop|netbook|pc\b|computadora|all in one|mini pc|combo|kit\b|equipo)/,
      pide: /notebook|laptop|netbook|\bpc\b|computadora|all in one|combo|armad|equipo|kit/ },
    { id: "usados", re: RE_USADO, pide: RE_USADO },
  ];

  /* Lo que pediste tiene que ser lo que ves. "SIMIL 1TB" no es 1TB, "Cable para SSD"
     no es un SSD y un disco rigido no es un SSD. */
  const ACCESORIOS_INICIO = /^(carcasa|gabinete|caddy|adaptador|cable|dock|docking|funda|bolso|mochila|soporte|base|bracket)\b/;
  const ES_HDD = /^(hdd|hd\b(?!\s*(?:ssd|solido))|disco (?:rigido|duro|mecanico)|hard ?disk)/;
  const ES_SSD = /^(ssd|hd\s*ssd|disco solido|unidad solida)/;

  /* Una compra internacional viene del exterior: tarda semanas y puede pagar
     impuestos al llegar, asi que no compite con lo que se compra aca. */
  const PIDE_INTERNACIONAL = /importad|internacional|exterior/;

  function motivoExclusion(n, nq, toks, sellos = "") {
    if (typeof sellos === "string" && sellos.includes("i") && !PIDE_INTERNACIONAL.test(nq)) return "internacionales";
    if (typeof sellos === "string" && sellos.includes("u") && !RE_USADO.test(nq)) return "usados";
    for (const r of REGLAS_EXCLUSION) if (r.re.test(n) && !r.pide.test(nq)) return r.id;
    // Si lo que buscas aparece justo despues de "simil", ese aviso dice que NO es eso.
    for (const t of toks) {
      if (new RegExp("\\bsimil(?:ar|es)?\\s+(?:a\\s+|al\\s+|de\\s+)?" + escaparRe(t)).test(n)) return "similares";
    }
    const a = n.match(ACCESORIOS_INICIO);
    if (a && !nq.includes(a[1])) return "accesorios";
    if (/\bssd\b|solido|nvme/.test(nq) && !/\bhdd\b|rigido|duro/.test(nq) && ES_HDD.test(n)) return "tipo";
    if (/\bhdd\b|rigido|disco duro|hard ?disk/.test(nq) && !/\bssd\b|solido/.test(nq) && ES_SSD.test(n)) return "tipo";
    return null;
  }

  /* Las letras que guarda el indice ("ioe") como [clase, texto] de cada sello. */
  const SELLOS = [["i", "ojo", "compra internacional"], ["u", "ojo", "usado o caja abierta"], ["o", "conocida", "tienda oficial"],
                  ["e", "off2", "envío gratis"], ["s", "off2", "cuotas sin interés"],
                  // de la serie de precios (serie.py): solo salen con historial suficiente
                  ["m", "baja", "mínimo de 30 días"], ["h", "baja", "mínimo de 90 días"],
                  ["x", "ojo", "subió antes de la oferta"]];
  const sellosDe = s => typeof s !== "string" ? []
    : SELLOS.filter(([l]) => s.includes(l)).map(([, clase, texto]) => [clase, texto]);

  /* Lo que suma a favor de un aviso y se muestra como "plus" en lo que lidera la comparativa: envio gratis y cuotas sin
     interes. Solo lo que la fuente informa: ComparaYa y sus comercios; las tiendas directas no lo publican por aviso, asi que
     un aviso sin plus no quiere decir que no lo tenga. Nunca cambia el orden (principio II). */
  const PLUS = ["e", "s"];
  const plusDe = s => typeof s !== "string" ? [] : SELLOS.filter(([l]) => PLUS.includes(l) && s.includes(l)).map(([, , texto]) => texto);

  /* "Auriculares Samsung..." -> "auricular": el rubro es la primera palabra, en singular. */
  function categoriaDe(nombre) {
    let w = normal(nombre).split(/\s+/)[0].replace(/[^a-z]/g, "");
    if (/(ores|ares|eres)$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 4 && w.endsWith("s")) w = w.slice(0, -1);
    return w;
  }


  /* --- Identidad por codigo de modelo (columna 9 del indice) ---------------
     El mismo producto en varias tiendas es el que comparte el MISMO codigo de modelo, exacto. Nunca por
     parecido de nombre. Si los nombres dicen capacidades distintas, tampoco se juntan. */
  const capacidadGB = nombre => {
    const caps = [...String(nombre).replace(/(\d),(\d)/g, "$1.$2").matchAll(/(\d+(?:\.\d+)?)\s?(gb|tb)\b/gi)]
      .map(m => Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === "tb" ? 1000 : 1)));
    return caps.length ? Math.max(...caps) : 0;
  };
  const compatibles = (x, y) => { const a = capacidadGB(x[0]), b = capacidadGB(y[0]); return !a || !b || a === b; };
  const antes = (x, y) => x[1] - y[1] || (x[3] < y[3] ? -1 : x[3] > y[3] ? 1 : 0) || (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0)
    || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0);

  /* La misma direccion escrita distinto: sin "www", sin barra final, sin parametros de seguimiento (utm_*, gclid, fbclid, ref...).
     Un parametro que identifica al producto (?variante=2) se conserva: es otro aviso. */
  function urlClave(url) {
    const m = String(url).match(/^https?:\/\/(?:www\.)?([^/?#]*)([^?#]*)(?:\?([^#]*))?/i);
    if (!m) return String(url);
    const params = (m[3] || "").split("&").filter(p => p && !/^(utm_|gclid|fbclid|msclkid|ref=|source=|mc_|_hs)/i.test(p)).sort();
    return m[1].toLowerCase() + m[2].replace(/\/+$/, "") + (params.length ? "?" + params.join("&") : "");
  }

  /* El mismo aviso llega directo y por un agregador (ComparaYa): misma direccion, mismo precio. Uno por direccion, y gana
     la fila de la tienda (sin "via") sobre la del agregador. Conserva el orden. */
  function unaPorUrl(filas) {
    const por = new Map();
    for (const f of filas) {
      const k = urlClave(f[2]), ya = por.get(k);
      if (!ya || (ya[4] && !f[4])) por.set(k, f);
    }
    return [...por.values()];
  }

  /* Devuelve { filas, otras }: cada grupo (2 o mas tiendas) queda como su fila mas barata, y `otras` dice,
     por esa fila, las demas tiendas de menor a mayor precio. Todo lo demas queda igual y en su lugar. */
  function agruparPorModelo(filas, comercio = x => x[4] || x[3]) {
    const porModelo = new Map();
    for (const f of filas) if (f[9]) (porModelo.get(f[9]) || porModelo.set(f[9], []).get(f[9])).push(f);
    const representante = new Map(), otras = new Map(), colapsadas = new Set();
    for (const lote of porModelo.values()) {
      let resto = [...lote].sort(antes);
      while (resto.length) {
        const cabeza = resto[0];
        const mios = resto.filter(x => compatibles(cabeza, x));
        resto = resto.filter(x => !mios.includes(x));
        // Un comercio es una tienda: ComparaYa (f[3]) lista a muchos (f[4]), y uno que llega directo y por ComparaYa es el mismo.
        const porTienda = new Map();
        for (const x of mios) { const k = normal(String(comercio(x) ?? "")); if (!porTienda.has(k)) porTienda.set(k, x); }
        if (porTienda.size < 2) continue;
        const miembros = [...porTienda.values()];
        otras.set(cabeza, miembros.slice(1));
        for (const m of miembros) { representante.set(m, cabeza); colapsadas.add(m); }
      }
    }
    const salida = [], puestos = new Set();
    for (const f of filas) {
      const rep = representante.get(f);
      if (!rep) { salida.push(f); continue; }
      if (!puestos.has(rep)) { puestos.add(rep); salida.push(rep); }
    }
    return { filas: salida, otras };
  }

  /* --- Filtros de la lista (B4) -------------------------------------------
     Acotan lo que se ve, nada mas: la mediana, el orden y el analisis se calculan con todos los avisos.
     Solo usan lo que el indice ya trae (tienda, precio y nombre): ninguna fuente
     publica cuotas sin interes ni envio gratis por aviso, y un filtro de eso mentiria (specs/008-filtros). */
  const filtrosVacios = () => ({ tiendas: [], min: null, max: null, primera: false, excluir: "", sellos: [] });
  const palabrasExcluidas = texto => normal(String(texto || "")).split(/[\s,;]+/).filter(Boolean);
  const hayFiltros = f => f.tiendas.length > 0 || Number.isFinite(f.min) || Number.isFinite(f.max)
    || f.primera || (f.sellos || []).length > 0 || palabrasExcluidas(f.excluir).length > 0;

  /* esPremium(nombre) dice si el titulo llega al puntaje premium (js/premium.js): el filtro `primera` ya no mira la marca (spec 014). */
  function predicadoDeFiltros(f, esPremium) {
    // Las palabras buscan como la busqueda: una medida es palabra entera y "ipad" no esta en "disipador".
    const excluidas = palabrasExcluidas(f.excluir).map(filtroDe), sellos = f.sellos || [];
    return fila => {
      if (f.tiendas.length && !f.tiendas.includes(fila[3])) return false;
      if (Number.isFinite(f.min) && fila[1] < f.min) return false;
      if (Number.isFinite(f.max) && fila[1] > f.max) return false;
      if (f.primera && !esPremium(fila[0])) return false;
      // Sellos (envio gratis e, cuotas s, tienda oficial o): todos los elegidos. Solo ComparaYa y sus comercios los informan.
      if (sellos.length && !(typeof fila[8] === "string" && sellos.every(l => fila[8].includes(l)))) return false;
      if (excluidas.length) {
        const n = normalBusq(fila[0]);
        if (excluidas.some(coincide => coincide(n))) return false;
      }
      return true;
    };
  }

  /* Filtra la salida de agruparPorModelo sin perder productos: un grupo (el mismo codigo en varias tiendas) sale con
     su fila mas barata QUE CUMPLE, en el lugar que tenia, y las demas tiendas quedan como "tambien en". Si ninguna
     cumple, el producto se oculta. Devuelve { filas, otras, ocultas } (ocultas cuenta productos, no avisos). */
  function filtrarGrupos(filas, otras, filtros, esPremium) {
    if (!hayFiltros(filtros)) return { filas, otras, ocultas: 0 };
    const pasa = predicadoDeFiltros(filtros, esPremium);
    const salida = [], nuevas = new Map();
    let ocultas = 0;
    for (const f of filas) {
      const grupo = [f, ...(otras.get(f) || [])];            // f es la mas barata; el resto, de menor a mayor
      const buenas = grupo.filter(pasa);
      if (!buenas.length) { ocultas++; continue; }
      salida.push(buenas[0]);
      const resto = grupo.filter(x => x !== buenas[0]);
      if (resto.length) nuevas.set(buenas[0], resto);
    }
    return { filas: salida, otras: nuevas, ocultas };
  }

  const textoConteo = (productos, avisos) => productos === avisos
    ? `${productos} resultado${productos > 1 ? "s" : ""}` : `${productos} productos en ${avisos} avisos`;

  const api = { normal, normalBusq, esMedida, filtroDe, mediana, pisoDeGama,
                ALIAS_MARCA, SUBMARCAS, limpiarTitulo, submarcaDe, marcaMadreDe, consultasDe, consultaDeOferta, urlClave, unaPorUrl, crearNivelMarca, armarMarcasRe, marcaDe, specsDe, motivoExclusion, esUsado, sellosDe, plusDe, categoriaDe, capacidadGB, compatibles, agruparPorModelo, textoConteo,
                filtrosVacios, palabrasExcluidas, hayFiltros, filtrarGrupos };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Buscador = api;
})(this);
