/* Que es una oferta: la misma logica para la pestaña Ofertas, el feed RSS y el canal de Telegram.
   Dos señales distintas:
   1. Bajas propias: lo que vale hoy contra el precio mas bajo de los 30 dias anteriores (indexar.py, spec 029: volver al
      precio de siempre despues de una suba no es una baja). No depende de lo que publique la tienda y no se puede inflar.
   2. Rebajas publicadas: el precio tachado del comercio, acotado entre el minimo de su categoria y 60% porque
      arriba de ahi el precio anterior suele estar inventado.
   Antes de eso, cada aviso se evalua en SU categoria (js/categorias.js: monitores, PCs, notebooks, smartphones,
   componentes y perifericos), con minimos y descuento propios: un descuento no vuelve oferta a un equipo que en 2026
   se queda corto, y un 10% ya es buena oferta en una notebook pero poco en un componente.
   El orden nunca depende de comisiones. */
(function (raiz) {
  "use strict";

  // El descuento minimo es de cada categoria (Categorias.DESCUENTO); estos valen para todas.
  const PISO_OFERTA = 15000, DESCUENTO_MAX = 0.6, BAJA_MIN_PESOS = 1000;
  const EPS = 1e-9;   // 24.000 contra 30.000 es 20% justo, no 19,99999%

  const esUrl = u => /^https?:\/\//i.test(String(u));
  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;
  const C = typeof module === "object" && module.exports ? require("./categorias.js") : raiz.Categorias;
  const T = typeof module === "object" && module.exports ? require("./titulo.js") : raiz.Titulo;

  /* ComparaYa vuelve a listar avisos de las tiendas que ya relevamos directo: misma URL (aunque venga con "www", barra
     final o parametros de seguimiento), mismo precio. Uno por URL, y gana la fila de la tienda sobre la del agregador. */
  const unaPorUrl = B.unaPorUrl;

  const MUESTRA_MEDIA = 8;   // con menos avisos de gama media no hay mediana que valga
  /* Oferta contra el mismo modelo en otras tiendas (spec 014, idea #1 del relevamiento; PriceSpy exige 3 tiendas): el modelo
     tiene que estar en MIN_TIENDAS_MODELO tiendas (la propia y otras dos que se leen directo). Mas de DESCUENTO_MODELO_MAX
     bajo el resto es mas facil un error de carga o un precio viejo que una oferta (como el 60% del tachado); y si las otras
     tiendas no coinciden entre si (DISPERSION_MODELO) la referencia no es confiable. El minimo de baja es el de su categoria. */
  const MIN_TIENDAS_MODELO = 3, DESCUENTO_MODELO_MAX = 0.4, DISPERSION_MODELO = 1.35;
  const TOLERANCIA_MODELO = 0.02;
  const AGREGADOR = "comparaya";
  const DIAS_TACHADO_FIJO = 7;     // dias con el mismo precio para que una rebaja publicada deje de ser noticia   // centavos y redondeos entre tiendas: menos que eso no la descalifica
  const esInternacional = f => typeof f[8] === "string" && f[8].includes("i");
  const esMercadoLibre = u => /^https?:\/\/(?:[a-z]+\.)?mercadolibre\.com\.ar\//i.test(String(u));

  /* "mediana de los smartphones de gama media de 256 GB: $350.000 (12 avisos)" */
  const PLURAL = { smartphone: "los smartphones", notebook: "las notebooks", pc: "las PC completas" };
  function textoContra(c, pesos) {
    const cap = c.rom >= 1000 ? c.rom / 1000 + " TB" : c.rom + " GB";
    return `mediana de ${PLURAL[c.rubro] || "los equipos"} de gama media de ${cap}: ${pesos(c.mediana)} (${c.avisos} avisos)`;
  }

  /* En un equipo, el codigo de modelo puede ser el de la familia (19/10: "15IRH10" juntaba i5 e i7, 8 y 16 GB):
     para decir que otro aviso es "el mismo, mas barato" tienen que coincidir la RAM, el almacenamiento y el procesador
     cuando los dos lo dicen. Si alguno no se puede leer, no se comparan. Los demas rubros comparan por el codigo. */
  // el procesador en una sola forma, como lo escriba la tienda: "R5-7535HS" y "Ryzen 5 7535HS" son r57535hs (como modelo.cpu_de)
  const cpuDe = nombre => { const n = String(nombre).toLowerCase(); let m;
    if ((m = n.match(/\b(?:core\s?)?(ultra\s?|i)([3579])[-\s_]?(\d{3,5}[a-z]{0,2})\b/))) return (m[1][0] === "u" ? "u" : "i") + m[2] + m[3];
    return (m = n.match(/\b(?:ryzen\s?|r)([3579])[-\s]?(\d{4}[a-z]{0,2})\b/)) ? "r" + m[1] + m[2] : ""; };
  function mismaConfiguracion(a, b) {
    const cat = C.categoriaDe(a[0]);
    if (cat !== "smartphone" && cat !== "notebook" && cat !== "pc") return true;
    const ma = C.memoriaDe(a[0]), mb = C.memoriaDe(b[0]);
    if (!ma.ram || !mb.ram || ma.ram !== mb.ram || !ma.rom || !mb.rom || ma.rom !== mb.rom) return false;
    const ca = cpuDe(a[0]), cb = cpuDe(b[0]);
    return !ca || !cb || ca === cb;
  }

  /* «22% bajo la mediana de las otras 2 tiendas ($102.000)» */
  const textoContraModelo = (c, pesos) => `${Math.round(c.off * 100)}% bajo la mediana de las otras ${c.tiendas} tiendas (${pesos(c.mediana)})`;
  /* «gama alta del año pasado al precio de una media de hoy: mediana de los smartphones de gama media de 512 GB: $703.500 (8 avisos)» */
  const textoCruceGen = (c, pesos) => `gama alta del año pasado al precio de una media de hoy — ${textoContra(c, pesos)}`;

  /* Una baja de un producto que se sigue hace menos de una semana (sello «k», spec 038): es una oferta de hoy, con poco
     historial. Se cuenta aparte, «desde que lo seguimos», y compite con las bajas propias; no pasa de 40%: con tan poca
     historia, una baja mayor casi siempre es el precio de otro vendedor (la webcam de Mercado Libre que salio «−53%» el 24/10). */
  const DESCUENTO_SEGUIMIENTO_MAX = 0.4;
  const enSeguimiento = f => typeof f[8] === "string" && f[8].includes("k");

  function calcularOfertas(idx) {
    const propias = [], publicadas = [], seguimiento = [];
    let descartadas = 0, tachadoFijo = 0, sospechosas = 0;
    const hoy = Date.parse(String(idx.generado || "").slice(0, 10));
    const ref = C.referencia(idx.productos);
    const filas = unaPorUrl(idx.productos).filter(f => !B.esUsado(f));   // usado, reacondicionado o de caja abierta: no es una oferta de lo nuevo
    // El mismo producto (mismo codigo de modelo) publicado por otra tienda con mas datos: una tienda que no escribe la RAM o los
    // Hz en el titulo no deja afuera a un modelo cuya ficha otra si trae. Solo se mira a otra cuando a esta le falta el dato.
    const porModelo = new Map();
    for (const f of filas) if (f[9]) (porModelo.get(f[9]) || porModelo.set(f[9], []).get(f[9])).push(f);
    const sinDato = g => !g.pasa && /^sin dato/.test(g.motivo || "");
    const evaluar = f => {
      const propio = C.evaluar(f[0], ref);
      if (!sinDato(propio) || !f[9]) return propio;
      for (const otro of porModelo.get(f[9])) {
        if (otro === f) continue;
        const g = C.evaluar(otro[0], ref);
        if (!sinDato(g)) return { ...g, heredada: true };
      }
      return propio;
    };
    const gama = new Map(filas.map(f => [f, evaluar(f)]));
    // Mediana de la gama media por categoria y capacidad (128 y 256 GB por separado; sin internacionales, que traen otro costo).
    const precios = {};
    for (const f of filas) {
      const g = gama.get(f);
      if (g.pasa && g.nivel === "media" && g.rom && !esInternacional(f))
        (precios[g.categoria + ":" + g.rom] = precios[g.categoria + ":" + g.rom] || []).push(f[1]);
    }
    const medianas = {}, muestras = {};
    for (const k of Object.keys(precios)) if (precios[k].length >= MUESTRA_MEDIA) { medianas[k] = B.mediana(precios[k]); muestras[k] = precios[k].length; }
    // La media de HOY, para el cruce por generacion: sin la que es del año pasado (la gama alta anterior se compara con lo que se vende ahora).
    const preciosHoy = {};
    for (const f of filas) {
      const g = gama.get(f);
      if (g.pasa && g.nivel === "media" && g.rom && !g.anterior && !esInternacional(f))
        (preciosHoy[g.categoria + ":" + g.rom] = preciosHoy[g.categoria + ":" + g.rom] || []).push(f[1]);
    }
    const medianasHoy = {}, muestrasHoy = {};
    for (const k of Object.keys(preciosHoy)) if (preciosHoy[k].length >= MUESTRA_MEDIA) { medianasHoy[k] = B.mediana(preciosHoy[k]); muestrasHoy[k] = preciosHoy[k].length; }
    // Segundo chequeo: el mismo modelo (codigo exacto, nunca por parecido) mas barato en otro aviso local quiere decir que
    // esta no es la oferta, por mas tachado que muestre (19/10: la RTX 5080 Gaming Trio a $4.268.709 con Maxtecno a
    // $3.679.312). Lo internacional no cuenta como mas barato: paga impuestos al llegar. Lo que llega por un agregador
    // (ComparaYa) tampoco: trae precios viejos (19/10: 4 de 11 avisos de Mercado Libre ya no existian a ese precio) y
    // dejaria afuera una oferta real. Comparan las tiendas que se leen directo, con el precio del dia.
    const masBarato = new Map();
    for (const f of filas) {
      if (!f[9]) continue;
      const otro = porModelo.get(f[9]).filter(x => x !== f && !esInternacional(x) && x[3] !== AGREGADOR && mismaConfiguracion(f, x)).reduce((a, x) => !a || x[1] < a[1] ? x : a, null);
      if (otro && f[1] > otro[1] * (1 + TOLERANCIA_MODELO)) masBarato.set(f, otro);
    }
    // Contra el mismo modelo en otras tiendas: el mas barato (o casi) de un modelo que esta en 3 tiendas o mas, a mas del minimo
    // de su categoria bajo la mediana de las otras. Las otras tienen que ser tiendas que se leen directo (como en masBarato).
    const contraModelo = new Map();
    for (const f of filas) {
      const g = gama.get(f);
      if (!f[9] || !g.pasa || esInternacional(f) || f[3] === AGREGADOR || masBarato.has(f)) continue;
      const otros = porModelo.get(f[9]).filter(x => x !== f && !esInternacional(x) && x[3] !== AGREGADOR && x[3] !== f[3] && mismaConfiguracion(f, x) && B.compatibles(f, x));
      if (new Set(otros.map(x => x[3])).size < MIN_TIENDAS_MODELO - 1) continue;
      const precios = otros.map(x => x[1]), minimo = Math.min(...precios), mediana = B.mediana(precios), off = 1 - f[1] / mediana;
      if (f[1] > minimo * (1 + TOLERANCIA_MODELO) || Math.max(...precios) / minimo > DISPERSION_MODELO) continue;
      if (off + EPS >= C.DESCUENTO[g.categoria].propia && off <= DESCUENTO_MODELO_MAX) contraModelo.set(f, { tiendas: new Set(otros.map(x => x[3])).size, mediana, minimo, off });
    }
    for (const f of filas) {
      const g = gama.get(f);
      if (!g.pasa || masBarato.has(f)) { descartadas++; continue; }
      const d = C.DESCUENTO[g.categoria];
      const ayer = f[6] || 0;
      if (ayer > f[1] && ayer - f[1] >= BAJA_MIN_PESOS && 1 - f[1] / ayer + EPS >= d.propia) {
        // Una baja de mas de 60% (de 40% si la trae un agregador, que arrastra precios viejos) es mas facil un error de carga que
        // una oferta: 31/10, una RTX 5080 «−70 %» y una 5070 Ti a $1.330.114 las dos, via ComparaYa. No es oferta ni se repite abajo.
        if (1 - f[1] / ayer > (f[3] === AGREGADOR ? DESCUENTO_SEGUIMIENTO_MAX : DESCUENTO_MAX)) { sospechosas++; continue; }
        if (enSeguimiento(f)) { if (1 - f[1] / ayer <= DESCUENTO_SEGUIMIENTO_MAX) seguimiento.push(f); }
        else propias.push(f);
        continue;                     // una baja propia ya es noticia: no la repito abajo
      }
      if (enSeguimiento(f)) continue;
      // El tachado de un agregador o de Mercado Libre no cuenta (spec 035): lo pone cada vendedor, ComparaYa lo trae sin la
      // regla de cada tienda (el de Carrefour u OnCity leidas directo no cuenta y via ComparaYa si contaba), y el 24/10 eran
      // 8 de las 10 ofertas del dia, de 33% a 58%. Sus bajas propias y la comparacion contra otras tiendas siguen valiendo.
      if (f[3] === AGREGADOR || esMercadoLibre(f[2])) continue;
      const lista = f[5] || 0;
      if (!lista || lista <= f[1] || f[1] < PISO_OFERTA) continue;
      // Un tachado que no se mueve en una semana es el precio de siempre con un tachado de adorno (19/10: la impresora
      // Brother con 55% y los auriculares Philips con 54% tenian el mismo precio desde el 8/10 y el 7/10).
      const off = 1 - f[1] / lista;
      if (!(off + EPS >= d.publicada && off <= DESCUENTO_MAX)) continue;
      // Se cuenta recien aca: solo lo que habria sido oferta (un tachado de 2% con precio viejo no es un descarte de la regla).
      if (hoy && f[10] && (hoy - Date.parse(f[10])) / 864e5 >= DIAS_TACHADO_FIJO) { tachadoFijo++; continue; }
      publicadas.push(f);
    }
    // Cruce de gamas: una oferta real de gama alta que cuesta lo mismo o menos que la mediana de la gama media.
    const cruces = new Set([...propias, ...publicadas, ...seguimiento].filter(f => {
      const g = gama.get(f);
      return g.alta && medianas[g.categoria + ":" + g.rom] && f[1] <= medianas[g.categoria + ":" + g.rom];
    }));
    const vigentes = new Set([...cruces].filter(f => gama.get(f).vigente));
    // contra que se cruza cada una: la mediana de su categoria y capacidad, y de cuantos avisos sale
    const contra = new Map([...cruces].map(f => { const g = gama.get(f), k = g.categoria + ":" + g.rom;
      return [f, { rubro: g.categoria, rom: g.rom, mediana: medianas[k], avisos: muestras[k] }]; }));
    // Cruce por generacion: una gama alta del año pasado (3 señales o mas sin el punto de novedad, que la generacion anterior no
    // tiene) que hoy cuesta lo mismo o menos que la mediana de la gama media de hoy de su categoria y capacidad. No necesita
    // baja ni tachado: el precio contra lo que se vende ahora es la oferta. Si otra tienda lo vende mas barato, esa es la oferta.
    const cruceGen = new Map();
    for (const f of filas) {
      const g = gama.get(f), k = g.categoria + ":" + g.rom;
      if (g.pasa && g.alta && g.anterior && !g.vigente && !masBarato.has(f) && !esInternacional(f) && medianasHoy[k] && f[1] <= medianasHoy[k])
        cruceGen.set(f, { rubro: g.categoria, rom: g.rom, mediana: medianasHoy[k], avisos: muestrasHoy[k] });
    }
    // el porque de cada modelo con generacion comparable, para que se entienda que califique o no como gama alta
    const notas = new Map([...propias, ...publicadas, ...seguimiento].filter(f => gama.get(f).nota).map(f => [f, gama.get(f).nota]));
    const categorias = new Map([...propias, ...publicadas, ...seguimiento].map(f => [f, gama.get(f)]));
    return { propias, publicadas, seguimiento, descartadas, sospechosas, cruces, vigentes, contra, notas, categorias, medianas, masBarato, tachadoFijo, contraModelo, cruceGen, gama };   // sin recortar: cada uso filtra y pagina
  }

  /* Las mejores para publicar afuera (feed, canal, /hoy/). Cada categoria tiene lugar reservado (C.CUPO): primero
     el mejor de cada una, despues el segundo, y recien despues se reparte lo que sobra, con tope por categoria, para
     que los componentes (que son casi todo el catalogo) no acaparen el resumen. Dentro de una categoria: primero las
     bajas propias, despues las publicadas; a igual señal la gama alta antes que la media y despues por descuento. Las
     compras internacionales van al final de su categoria y rotuladas. Sin enlaces que no sean http(s). */
  /* Que equipo es, para no ofrecer el mismo dos veces en el resumen del dia (23/10: Mexx publica la misma Lenovo V15 con y
     sin Windows 11 Pro, y las dos salieron). Con codigo de modelo, el codigo. Sin codigo, el nombre normalizado como lo
     compara el buscador, sin lo que no cambia el equipo: sistema operativo, color, «#» y «nuevo». Otra RAM, otro disco u
     otro procesador siguen siendo otro equipo. */
  const RUIDO_FAMILIA = /\b(?:win(?:d|dows)?\s?1[01](?:\s?(?:pro|home))?|w1[01](?:\s?(?:pro|home))?|free\s?dos|sin\s(?:sistema(?:\soperativo)?|so)|nuev[oa]|negr[oa]|black|blanc[oa]|white|gris|grey|gray|platead[oa]|silver|azul|blue|roj[oa]|red|luna)\b/g;
  const nombreFamilia = f => B.normalBusq(String(f[0] || "")).replace(/#/g, " ").replace(RUIDO_FAMILIA, " ").replace(/[^a-z0-9]+/g, " ").trim();
  function familia(f) {
    if (f[9]) return "modelo:" + f[9];
    return nombreFamilia(f);
  }

  /* La ficha legible (spec 044): marca y modelo mas lo que define la compra. Dos tiendas que escriben distinto el mismo
     equipo («HP 250 C5-120U 16GB SSD512GB» y «HP 250 Core 5 120U 16GB 512GB», 30/10) dan la misma ficha. Solo cuenta si
     el titulo tiene un modelo (un numero) y hay al menos dos datos: «KINGSTON · 1 TB» no alcanza para decir que es lo mismo. */
  function ficha(f) {
    const t = T.de(f[0]), datos = t.chips.filter(c => !/″|Usado|Reacondicionado/.test(c));
    return /\d/.test(t.titulo) && datos.length >= 2 ? t.tipo + "|" + t.titulo + "|" + datos.join("|") : "";
  }

  /* El mismo producto con el titulo escrito distinto (23/10: «Auricular In-Ear Tronsmart Ony Ace Pro Blanco» y «Auricular
     Tronsmart Onyx Ace Pro Negro», los dos a $58.050 contra $129.000): mismo precio y misma referencia, los mismos numeros
     en el nombre (capacidad, modelo) y casi todas las palabras del nombre mas corto en el otro. */
  const COMPARTIDAS_GEMELO = 0.75;
  // Por el nombre aunque haya codigo de modelo: cada color trae su codigo («…Z40» y «…Z40G», 30/10) y son el mismo producto.
  function palabras(f) { return new Set(nombreFamilia(f).split(" ").filter(Boolean)); }
  function gemelos(a, b) {
    const numeros = s => [...s].filter(w => /\d/.test(w)).sort().join(" ");
    if (numeros(a) !== numeros(b)) return false;
    const [corto, largo] = a.size <= b.size ? [a, b] : [b, a];
    return corto.size > 0 && [...corto].filter(w => largo.has(w)).length / corto.size >= COMPARTIDAS_GEMELO;
  }

  // El mismo equipo (misma familia: mismo codigo de modelo o, sin codigo, el mismo nombre sin sistema operativo ni color)
  // ocupa un solo lugar, en una tienda o en varias: gana el mejor ubicado y el otro deja lugar al siguiente.
  // Ademas, a igual precio y referencia, el gemelo con el titulo escrito distinto.
  // Entre las del mismo producto queda la mas barata (30/10: la HP 250 salio de Max Tecno a $1.596.165 y Click Gaming la
  // tenia a $1.545.000); a igual precio, la mejor ubicada.
  const unico = lista => { const vistos = new Set(), porPrecio = new Map(), minimo = new Map();
    const claves = o => [familia(o.f), ficha(o.f)].filter(Boolean);
    for (const o of lista) for (const k of claves(o)) minimo.set(k, Math.min(minimo.get(k) ?? Infinity, o.f[1]));
    return lista.filter(o => {
      if (claves(o).some(k => o.f[1] > minimo.get(k))) return false;
      const k = familia(o.f), fi = ficha(o.f), p = o.f[1] + "|" + (o.antes ?? o.f[o.ref]), w = palabras(o.f), mismos = porPrecio.get(p) || [];
      if (vistos.has(k) || (fi && vistos.has(fi)) || mismos.some(x => gemelos(x, w))) return false;
      vistos.add(k); if (fi) vistos.add(fi); porPrecio.set(p, [...mismos, w]); return true;
    }); };

  function destacadas(idx, max = 20) {
    const { propias, publicadas, seguimiento, cruces, vigentes, contra, notas, gama, contraModelo } = calcularOfertas(idx);
    const rango = { alta: 2, media: 1 };
    // `antes` es contra que se compara: el piso de 30 dias (propia), el tachado (publicada) o la mediana del mismo modelo en
    // otras tiendas (modelo, spec 035: la señal que se puede comprobar, y hasta el 24/10 el resumen del dia no la usaba).
    const nuevo = (f, antes, tipo, modelo) => { const g = gama.get(f);
      return { f, antes, tipo, modelo, off: 1 - f[1] / antes, ahorro: antes - f[1], categoria: g.categoria, nivel: g.nivel,
        cruce: cruces.has(f), vigente: vigentes.has(f), contra: contra.get(f), nota: notas.get(f), internacional: esInternacional(f) }; };
    const ORDEN_TIPO = { propia: 0, seguimiento: 0, modelo: 1, publicada: 2 };
    const por = (a, b) => a.internacional - b.internacional || ORDEN_TIPO[a.tipo] - ORDEN_TIPO[b.tipo]
      || (rango[b.nivel] || 0) - (rango[a.nivel] || 0) || b.off - a.off || b.ahorro - a.ahorro || (a.f[2] < b.f[2] ? -1 : 1);
    const todas = [...propias.map(f => nuevo(f, f[6], "propia")), ...[...contraModelo].map(([f, c]) => nuevo(f, c.mediana, "modelo", c)),
      ...publicadas.map(f => nuevo(f, f[5], "publicada")), ...seguimiento.map(f => nuevo(f, f[6], "seguimiento"))].filter(o => esUrl(o.f[2]));
    // Global, no por categoria: el mismo codigo puede caer en dos categorias si los titulos se leen distinto.
    const unicas = unico([...todas].sort(por));
    const grupos = new Map(C.ORDEN.map(c => [c, unicas.filter(o => o.categoria === c)]));
    const elegidas = new Set(), puestos = new Map(C.ORDEN.map(c => [c, 0]));
    // Cada categoria avanza por su propia lista: "otro" no tiene lugar reservado, pero cuando entra lo hace con su mejor oferta.
    const ronda = (hasta, cats) => {
      for (let vuelta = 0; vuelta < hasta; vuelta++)
        for (const c of cats) {
          const k = puestos.get(c), o = grupos.get(c)[k];
          if (o && k < hasta && elegidas.size < max) { elegidas.add(o); puestos.set(c, k + 1); }
        }
    };
    ronda(C.CUPO.reservado, C.ORDEN.filter(c => c !== "otro"));          // lugar reservado de cada categoria
    ronda(C.CUPO.tope, C.ORDEN);                                           // lo que sobra, hasta el tope
    for (const o of unicas) if (elegidas.size < max) elegidas.add(o);   // si aun falta, lo mejor que quede
    return [...elegidas].sort((a, b) => C.ORDEN.indexOf(a.categoria) - C.ORDEN.indexOf(b.categoria) || por(a, b));
  }

  const api = { PISO_OFERTA, DESCUENTO_MAX, BAJA_MIN_PESOS, DESCUENTO: C.DESCUENTO,
                referencia: C.referencia, aspectosDe: C.aspectosDe, esMercadoLibre, pisoDeGama: C.evaluar, textoContra, textoContraModelo, textoCruceGen, MIN_TIENDAS_MODELO, DESCUENTO_MODELO_MAX, DISPERSION_MODELO, calcularOfertas, destacadas, unico, enSeguimiento, DESCUENTO_SEGUIMIENTO_MAX, familia, ficha, esInternacional, mismaConfiguracion };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Ofertas = api;
})(this);
