/* Que es una oferta: la misma logica para la pestaña Ofertas, el feed RSS y el canal de Telegram.
   Dos señales distintas:
   1. Bajas propias: lo que valia en el relevamiento anterior contra lo que vale hoy. No depende de lo que
      publique la tienda y no se puede inflar.
   2. Rebajas publicadas: el precio tachado del comercio, acotado entre 15% y 60% porque arriba de ahi el
      precio anterior suele estar inventado.
   Antes de eso, un piso de gama: un descuento no vuelve oferta a un equipo que en 2026 se queda corto.
   El orden nunca depende de comisiones. */
(function (raiz) {
  "use strict";

  const PISO_OFERTA = 15000, DESCUENTO_MIN = 0.15, DESCUENTO_MAX = 0.6;
  const BAJA_MIN_PCT = 0.03, BAJA_MIN_PESOS = 1000;

  /* Piso de gama (spec 012): lo minimo para que un celular o una notebook sean una oferta en 2026.
     1. Si el titulo dice la RAM, manda: no llega, no es oferta.
     2. Procesador, año, bateria, refresco y pantalla: "reciente" es relativo al propio indice, la generacion
        mas nueva que hay a la venta o la anterior (no hay una tabla de años que envejezca).
     3. Sin RAM, hace falta al menos una señal reciente (procesador o año); sin ninguna no se afirma nada. */
  const PISOS = {
    celular:  { ram: 6,  ideal: 8,  rom: 128, rom_alta: 256, bateria: 4500, hz: 90, re: /\b(celular|smartphone|iphone|redmi|poco\s?[a-z]\d|moto\s?[gex]\d|galaxy\s?[samzf]\d|realme|infinix|tecno|pixel)/i },
    notebook: { ram: 16, ideal: 32, rom: 512, rom_alta: 1000, re: /\b(notebook|laptop|macbook|portatil|ideapad|thinkpad|vivobook|zenbook)/i }
  };
  const aGB = (n, u) => Math.round(parseFloat(n) * (/t/i.test(u) ? 1000 : 1));

  /* [familia, nombre legible, regex, numero de generacion a partir del match] */
  const GENERACIONES = [
    ["iphone", "iPhone", /\biphone\s?(\d{1,2})\b/i, m => +m[1]],
    ["apple-m", "chip M", /\b(?:macbook|imac|mac\s?mini|ipad)\b.*?\bm([1-9])\b/i, m => +m[1]],
    ["galaxy-s", "Galaxy S", /\bgalaxy\s?s(\d{1,2})\b/i, m => +m[1]],
    ["pixel", "Pixel", /\bpixel\s?(\d{1,2})\b/i, m => +m[1]],
    ["snapdragon", "Snapdragon 8", /\bsnapdragon\s?8\s?(?:gen\s?(\d)|elite(?:\s?gen\s?(\d))?)/i, m => m[1] ? +m[1] : m[2] ? +m[2] + 1 : 5],
    ["intel-core", "Core i", /\bcore\s?i[3579][-\s](\d{4,5})/i, m => m[1].length === 5 ? +m[1].slice(0, 2) : +m[1][0]],
    ["core-ultra", "Core Ultra", /\bcore\s?ultra\s?[3579]\s?(\d)\d{2}/i, m => +m[1]],
    ["ryzen", "Ryzen", /\bryzen\s?[3579]\s?(\d)\d{3}/i, m => +m[1]]
  ];
  const generacionesDe = nombre => GENERACIONES.flatMap(([fam, et, re, gen]) => {
    const m = String(nombre).match(re);
    return m ? [{ fam, et, gen: gen(m) }] : [];
  });
  const aniosDe = nombre => [...String(nombre).matchAll(/\b(20[12]\d)\b/g)].map(m => +m[1]);

  /* Lo mas nuevo que hay a la venta, por familia y en años, mirando los titulos del indice. */
  function referencia(productos) {
    const gen = {}; let anio = 0;
    for (const f of productos) {
      for (const g of generacionesDe(f[0])) gen[g.fam] = Math.max(gen[g.fam] || 0, g.gen);
      for (const a of aniosDe(f[0])) anio = Math.max(anio, a);
    }
    return { gen, anio };
  }

  function memoriaDe(nombre) {
    const n = String(nombre).replace(/(\d),(\d)/g, "$1.$2");
    let m;
    const caps = [...n.matchAll(/\b(\d{1,4})\s?(gb|tb)\b/gi)].map(x => aGB(x[1], x[2])).sort((a, b) => a - b);
    if ((m = n.match(/(\d{1,3})\s?gb\s*(?:de\s*)?ram\b/i) || n.match(/\bram\s*(?:de\s*)?(\d{1,3})\s?gb/i))) {
      const otras = caps.filter(c => c !== +m[1]);       // lo que no es la RAM es el almacenamiento
      return { ram: +m[1], rom: otras.length ? otras[otras.length - 1] : 0 };
    }
    if ((m = n.match(/\b(\d{1,2})\s?(?:gb)?\s*[+\/]\s*(\d{2,4})\s?(gb|tb)\b/i)) && +m[1] <= 64)
      return { ram: +m[1], rom: aGB(m[2], m[3]) };
    if (caps.length >= 2 && caps[0] <= 64) return { ram: caps[0], rom: caps[caps.length - 1] };
    return { ram: 0, rom: caps.length === 1 && caps[0] >= 64 ? caps[0] : 0 };   // una sola capacidad grande: es el almacenamiento
  }

  /* { rubro, pasa, motivo }: solo celulares y notebooks tienen piso; el resto pasa. */
  function pisoDeGama(nombre, ref = { gen: {}, anio: 0 }) {
    const rubro = Object.keys(PISOS).find(k => PISOS[k].re.test(nombre)) || null;
    if (!rubro) return { rubro, pasa: true };
    const pi = PISOS[rubro], { ram, rom } = memoriaDe(nombre);
    const no = motivo => ({ rubro, pasa: false, motivo });
    if (ram && ram < pi.ram) return no(`solo ${ram} GB de RAM (mínimo ${pi.ram})`);
    // una memoria interna que no se lee no descalifica; una que se lee y no llega, si
    if (ram && rom && rom < pi.rom) return no(`solo ${rom} GB de almacenamiento (mínimo ${pi.rom})`);
    let reciente = false;
    for (const g of generacionesDe(nombre)) {
      const tope = ref.gen[g.fam] || g.gen;
      if (g.gen < tope - 1) return no(`${g.et} ${g.gen}: la generación vigente es la ${tope}`);
      reciente = true;
    }
    const anios = aniosDe(nombre);
    if (anios.length) {
      const a = Math.max(...anios);
      if (ref.anio && a < ref.anio - 1) return no(`modelo ${a}: lo vigente es de ${ref.anio}`);
      reciente = true;
    }
    let m;
    if (pi.bateria && (m = nombre.match(/\b(\d{4,5})\s?mah\b/i)) && +m[1] < pi.bateria) return no(`batería de ${m[1]} mAh (mínimo ${pi.bateria})`);
    if (pi.hz && (m = nombre.match(/\b(\d{2,3})\s?hz\b/i)) && +m[1] < pi.hz) return no(`pantalla de ${m[1]} Hz (mínimo ${pi.hz})`);
    if (rubro === "notebook" && /\bhd\b(?!\+)/i.test(nombre) && !/\b(?:f|u|w)hd\b/i.test(nombre)) return no("pantalla HD de baja resolución");
    if (!ram && !reciente) return no("sin datos de RAM, procesador ni año en el título");
    // gama alta: tres señales o mas (RAM ideal, almacenamiento grande, la ultima generacion, linea Pro, OLED, 120 Hz)
    const puntos = [ram >= pi.ideal, rom >= pi.rom_alta,
      generacionesDe(nombre).some(g => g.gen >= (ref.gen[g.fam] || 0)),
      /\b(pro|ultra|max|fold|flip)\b/i.test(nombre), /\bamoled|\boled\b/i.test(nombre),
      (m = nombre.match(/\b(\d{2,3})\s?hz\b/i)) && +m[1] >= 120].filter(Boolean).length;
    return { rubro, pasa: true, ideal: ram >= pi.ideal, alta: puntos >= 3 };
  }

  const esUrl = u => /^https?:\/\//i.test(String(u));
  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;

  /* ComparaYa vuelve a listar avisos de las tiendas que ya relevamos directo: misma URL, mismo
     precio. Uno por URL, y gana la fila de la tienda (sin "via") sobre la del agregador. */
  function unaPorUrl(productos) {
    const por = new Map();
    for (const f of productos) {
      const ya = por.get(f[2]);
      if (!ya || (ya[4] && !f[4])) por.set(f[2], f);
    }
    return [...por.values()];
  }

  const MUESTRA_MEDIA = 8;   // con menos avisos de gama media no hay mediana que valga

  function calcularOfertas(idx) {
    const propias = [], publicadas = [];
    let descartadas = 0;
    const ref = referencia(idx.productos);
    const filas = unaPorUrl(idx.productos).filter(f => !B.esUsado(f));   // usado, reacondicionado o de caja abierta: no es una oferta de lo nuevo
    const gama = new Map(filas.map(f => [f, pisoDeGama(f[0], ref)]));
    // Mediana de la gama media por rubro (sin internacionales, que traen otro costo): contra eso se mide el cruce.
    const precios = {};
    for (const f of filas) {
      const g = gama.get(f);
      if (g.rubro && g.pasa && !g.alta && !(typeof f[8] === "string" && f[8].includes("i"))) (precios[g.rubro] = precios[g.rubro] || []).push(f[1]);
    }
    const medianas = {};
    for (const k of Object.keys(precios)) if (precios[k].length >= MUESTRA_MEDIA) medianas[k] = B.mediana(precios[k]);
    for (const f of filas) {
      if (!gama.get(f).pasa) { descartadas++; continue; }
      const ayer = f[6] || 0;
      if (ayer > f[1] && ayer - f[1] >= BAJA_MIN_PESOS && 1 - f[1] / ayer >= BAJA_MIN_PCT) {
        propias.push(f);
        continue;                     // una baja propia ya es noticia: no la repito abajo
      }
      const lista = f[5] || 0;
      if (!lista || lista <= f[1] || f[1] < PISO_OFERTA) continue;
      const off = 1 - f[1] / lista;
      if (off >= DESCUENTO_MIN && off <= DESCUENTO_MAX) publicadas.push(f);
    }
    // Cruce de gamas: una oferta real de gama alta que cuesta lo mismo o menos que la mediana de la gama media.
    const cruces = new Set([...propias, ...publicadas].filter(f => {
      const g = gama.get(f);
      return g.alta && medianas[g.rubro] && f[1] <= medianas[g.rubro];
    }));
    return { propias, publicadas, descartadas, cruces, medianas };   // sin recortar: cada uso filtra y pagina
  }

  /* Las mejores para publicar afuera (feed, canal): primero las bajas propias, despues las publicadas,
     cada grupo por descuento; las compras internacionales al final y rotuladas. Sin enlaces que no sean http(s). */
  function destacadas(idx, max = 20) {
    const { propias, publicadas, cruces } = calcularOfertas(idx);
    const nuevo = (f, ref, tipo) => ({ f, ref, tipo, off: 1 - f[1] / f[ref], ahorro: f[ref] - f[1], cruce: cruces.has(f) });
    const intl = f => typeof f[8] === "string" && f[8].includes("i");
    const por = (a, b) => b.off - a.off || b.ahorro - a.ahorro || (a.f[2] < b.f[2] ? -1 : 1);
    const armar = esIntl => [...propias.filter(f => esUrl(f[2]) && intl(f) === esIntl).map(f => nuevo(f, 6, "propia")).sort(por),
                             ...publicadas.filter(f => esUrl(f[2]) && intl(f) === esIntl).map(f => nuevo(f, 5, "publicada")).sort(por)]
      .map(o => esIntl ? { ...o, internacional: true } : o);
    // las compras internacionales no se esconden (a igual precio dan mas opciones), pero van despues y rotuladas
    return [...armar(false), ...armar(true)].slice(0, max);
  }

  const api = { PISO_OFERTA, DESCUENTO_MIN, DESCUENTO_MAX, BAJA_MIN_PCT, BAJA_MIN_PESOS, PISOS, referencia, pisoDeGama, calcularOfertas, destacadas };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Ofertas = api;
})(this);
