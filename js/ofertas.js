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
     `ideal` es la gama alta de cada rubro. Sin RAM legible en el titulo no se afirma nada, asi que no se destaca. */
  const PISOS = {
    celular:  { ram: 6,  ideal: 8,  rom: 128, re: /\b(celular|smartphone|iphone|redmi|poco\s?[a-z]\d|moto\s?[gex]\d|galaxy\s?[samzf]\d|realme|infinix|tecno|pixel)/i },
    notebook: { ram: 16, ideal: 32, rom: 512, re: /\b(notebook|laptop|macbook|portatil|ideapad|thinkpad|vivobook|zenbook)/i }
  };
  const aGB = (n, u) => Math.round(parseFloat(n) * (/t/i.test(u) ? 1000 : 1));

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
    return caps.length >= 2 && caps[0] <= 64 ? { ram: caps[0], rom: caps[caps.length - 1] } : { ram: 0, rom: 0 };
  }

  /* { rubro, pasa, motivo }: solo celulares y notebooks tienen piso; el resto pasa. */
  function pisoDeGama(nombre) {
    const rubro = Object.keys(PISOS).find(k => PISOS[k].re.test(nombre)) || null;
    if (!rubro) return { rubro, pasa: true };
    const pi = PISOS[rubro], { ram, rom } = memoriaDe(nombre);
    if (!ram) return { rubro, pasa: false, motivo: "sin RAM en el título" };
    if (ram < pi.ram) return { rubro, pasa: false, motivo: `solo ${ram} GB de RAM (mínimo ${pi.ram})` };
    // una memoria interna que no se lee no descalifica: la RAM es lo que decide
    if (rom && rom < pi.rom) return { rubro, pasa: false, motivo: `solo ${rom} GB de almacenamiento (mínimo ${pi.rom})` };
    return { rubro, pasa: true, ideal: ram >= pi.ideal };
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

  function calcularOfertas(idx) {
    const propias = [], publicadas = [];
    let descartadas = 0;
    for (const f of unaPorUrl(idx.productos)) {
      if (B.esUsado(f)) continue;       // usado, reacondicionado o de caja abierta: no es una oferta de lo nuevo
      if (!pisoDeGama(f[0]).pasa) { descartadas++; continue; }
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
    return { propias, publicadas, descartadas };   // sin recortar: cada uso filtra y pagina
  }

  /* Las mejores para publicar afuera (feed, canal): primero las bajas propias, despues las publicadas,
     cada grupo por descuento. Sin compras internacionales ni enlaces que no sean http(s). */
  function destacadas(idx, max = 20) {
    const { propias, publicadas } = calcularOfertas(idx);
    const nuevo = (f, ref, tipo) => ({ f, ref, tipo, off: 1 - f[1] / f[ref], ahorro: f[ref] - f[1] });
    const buenas = f => esUrl(f[2]) && !(typeof f[8] === "string" && f[8].includes("i"));
    const por = (a, b) => b.off - a.off || b.ahorro - a.ahorro || (a.f[2] < b.f[2] ? -1 : 1);
    return [...propias.filter(buenas).map(f => nuevo(f, 6, "propia")).sort(por),
            ...publicadas.filter(buenas).map(f => nuevo(f, 5, "publicada")).sort(por)].slice(0, max);
  }

  const api = { PISO_OFERTA, DESCUENTO_MIN, DESCUENTO_MAX, BAJA_MIN_PCT, BAJA_MIN_PESOS, PISOS, pisoDeGama, calcularOfertas, destacadas };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Ofertas = api;
})(this);
