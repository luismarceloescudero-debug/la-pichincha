/* Funciones puras del buscador: no tocan el DOM ni variables de la pagina.
   index.html las carga como script comun (quedan en window.Buscador) y los
   tests las cargan con require() desde Node: node --test "tests/js/*.test.js". */
(function (raiz) {
  "use strict";

  const normal = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  /* "1 TB" y "1TB" son lo mismo: se pegan la cifra y la unidad antes de comparar. */
  const pegarUnidades = t => t.replace(/(\d)\s+(gb|tb|mb|mhz|ghz|hz|w)\b/g, "$1$2");
  const normalBusq = t => pegarUnidades(normal(t));
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

  /* Ordena el resultado segun el criterio elegido. "recomendado" pone primero la
     marca mas confiable al menor precio, y manda al fondo lo que esta tan por
     debajo del resto que probablemente no sea comparable. */
  function ordenar(filas, med, orden, nivelMarca) {
    const copia = [...filas];
    if (orden === "precio") return copia.sort((a, b) => a[1] - b[1]);
    if (orden === "marca") return copia.sort((a, b) =>
      nivelMarca(b[0]) - nivelMarca(a[0]) || a[1] - b[1]);
    // Las compras internacionales no compiten con lo que se compra aca: van al final.
    const intl = f => typeof f[8] === "string" && f[8].includes("i") ? 1 : 0;
    return copia.sort((a, b) => {
      const na = nivelMarca(a[0]), nb = nivelMarca(b[0]);
      const sa = pisoDeGama(a[1], na, med), sb = pisoDeGama(b[1], nb, med);
      return (intl(a) - intl(b)) || (sa - sb) || (nb - na) || (a[1] - b[1]);
    });
  }

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

  const ALIAS_MARCA = { xpg: "adata", gskill: "g.skill", tplink: "tp-link", "western digital": "wd" };
  const armarMarcasRe = lista => lista.map(m => [m, new RegExp("\\b" + escaparRe(m) + "\\b")]);

  /* La marca es la que aparece primero en el nombre: "Notebook HP Intel Core" es HP. */
  function marcaDe(nombre, marcasRe, alias = ALIAS_MARCA) {
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
    if ((m = n.match(/\b(\d{2}(?:\.\d)?)\s?(?:"|”|″|pulgadas|pulg\b)/i))) s["Pantalla"] = m[1] + '"';
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

  /* Avisos que no son comparables con el resto aunque coincidan con la busqueda,
     salvo que la propia busqueda los pida. */
  const REGLAS_EXCLUSION = [
    { id: "formato", re: /so-?dimm/, pide: /so-?dimm|notebook|laptop/ },
    // Un aviso que EMPIEZA con "Notebook", "PC" o "Combo" es un equipo completo: el
    // componente que buscas solo aparece de pasada. Anclado al inicio a proposito,
    // porque "SSD para notebook" si es un SSD.
    { id: "equipos", re: /^(notebook|laptop|netbook|pc\b|computadora|all in one|mini pc|combo|kit\b|equipo)/,
      pide: /notebook|laptop|netbook|\bpc\b|computadora|all in one|combo|armad|equipo|kit/ },
    { id: "usados", re: /outlet|usado|reacondicionad|refurb|open box|exhibicion/,
      pide: /outlet|usado|reacondicionad|refurb|open box|exhibicion/ },
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
  const SELLOS = [["i", "ojo", "compra internacional"], ["o", "conocida", "tienda oficial"],
                  ["e", "off2", "envío gratis"],
                  // de la serie de precios (serie.py): solo salen con historial suficiente
                  ["m", "baja", "mínimo de 30 días"], ["h", "baja", "mínimo de 90 días"],
                  ["x", "ojo", "subió antes de la oferta"]];
  const sellosDe = s => typeof s !== "string" ? []
    : SELLOS.filter(([l]) => s.includes(l)).map(([, clase, texto]) => [clase, texto]);

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

  /* Devuelve { filas, otras }: cada grupo (2 o mas tiendas) queda como su fila mas barata, y `otras` dice,
     por esa fila, las demas tiendas de menor a mayor precio. Todo lo demas queda igual y en su lugar. */
  function agruparPorModelo(filas) {
    const porModelo = new Map();
    for (const f of filas) if (f[9]) (porModelo.get(f[9]) || porModelo.set(f[9], []).get(f[9])).push(f);
    const representante = new Map(), otras = new Map(), colapsadas = new Set();
    for (const lote of porModelo.values()) {
      let resto = [...lote].sort(antes);
      while (resto.length) {
        const cabeza = resto[0];
        const mios = resto.filter(x => compatibles(cabeza, x));
        resto = resto.filter(x => !mios.includes(x));
        const porTienda = new Map();
        for (const x of mios) if (!porTienda.has(x[3])) porTienda.set(x[3], x);
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

  const textoConteo = (productos, avisos) => productos === avisos
    ? `${productos} resultado${productos > 1 ? "s" : ""}` : `${productos} productos en ${avisos} avisos`;

  const api = { normal, normalBusq, esMedida, filtroDe, mediana, pisoDeGama, ordenar,
                ALIAS_MARCA, crearNivelMarca, armarMarcasRe, marcaDe, specsDe, motivoExclusion, sellosDe, categoriaDe, capacidadGB, agruparPorModelo, textoConteo };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Buscador = api;
})(this);
