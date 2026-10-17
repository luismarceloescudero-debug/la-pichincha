/* Que es una oferta: la misma logica para la pestaña Ofertas, el feed RSS y el canal de Telegram.
   Dos señales distintas:
   1. Bajas propias: lo que valia en el relevamiento anterior contra lo que vale hoy. No depende de lo que
      publique la tienda y no se puede inflar.
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

  /* ComparaYa vuelve a listar avisos de las tiendas que ya relevamos directo: misma URL (aunque venga con "www", barra
     final o parametros de seguimiento), mismo precio. Uno por URL, y gana la fila de la tienda sobre la del agregador. */
  const unaPorUrl = B.unaPorUrl;

  const MUESTRA_MEDIA = 8;   // con menos avisos de gama media no hay mediana que valga
  const esInternacional = f => typeof f[8] === "string" && f[8].includes("i");

  /* "mediana de los smartphones de gama media de 256 GB: $350.000 (12 avisos)" */
  const PLURAL = { smartphone: "los smartphones", notebook: "las notebooks", pc: "las PC completas" };
  function textoContra(c, pesos) {
    const cap = c.rom >= 1000 ? c.rom / 1000 + " TB" : c.rom + " GB";
    return `mediana de ${PLURAL[c.rubro] || "los equipos"} de gama media de ${cap}: ${pesos(c.mediana)} (${c.avisos} avisos)`;
  }

  function calcularOfertas(idx) {
    const propias = [], publicadas = [];
    let descartadas = 0;
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
    for (const f of filas) {
      const g = gama.get(f);
      if (!g.pasa) { descartadas++; continue; }
      const d = C.DESCUENTO[g.categoria];
      const ayer = f[6] || 0;
      if (ayer > f[1] && ayer - f[1] >= BAJA_MIN_PESOS && 1 - f[1] / ayer + EPS >= d.propia) {
        propias.push(f);
        continue;                     // una baja propia ya es noticia: no la repito abajo
      }
      const lista = f[5] || 0;
      if (!lista || lista <= f[1] || f[1] < PISO_OFERTA) continue;
      const off = 1 - f[1] / lista;
      if (off + EPS >= d.publicada && off <= DESCUENTO_MAX) publicadas.push(f);
    }
    // Cruce de gamas: una oferta real de gama alta que cuesta lo mismo o menos que la mediana de la gama media.
    const cruces = new Set([...propias, ...publicadas].filter(f => {
      const g = gama.get(f);
      return g.alta && medianas[g.categoria + ":" + g.rom] && f[1] <= medianas[g.categoria + ":" + g.rom];
    }));
    const vigentes = new Set([...cruces].filter(f => gama.get(f).vigente));
    // contra que se cruza cada una: la mediana de su categoria y capacidad, y de cuantos avisos sale
    const contra = new Map([...cruces].map(f => { const g = gama.get(f), k = g.categoria + ":" + g.rom;
      return [f, { rubro: g.categoria, rom: g.rom, mediana: medianas[k], avisos: muestras[k] }]; }));
    // el porque de cada modelo con generacion comparable, para que se entienda que califique o no como gama alta
    const notas = new Map([...propias, ...publicadas].filter(f => gama.get(f).nota).map(f => [f, gama.get(f).nota]));
    const categorias = new Map([...propias, ...publicadas].map(f => [f, gama.get(f)]));
    return { propias, publicadas, descartadas, cruces, vigentes, contra, notas, categorias, medianas };   // sin recortar: cada uso filtra y pagina
  }

  /* Las mejores para publicar afuera (feed, canal, /hoy/). Cada categoria tiene lugar reservado (C.CUPO): primero
     el mejor de cada una, despues el segundo, y recien despues se reparte lo que sobra, con tope por categoria, para
     que los componentes (que son casi todo el catalogo) no acaparen el resumen. Dentro de una categoria: primero las
     bajas propias, despues las publicadas; a igual señal la gama alta antes que la media y despues por descuento. Las
     compras internacionales van al final de su categoria y rotuladas. Sin enlaces que no sean http(s). */
  function destacadas(idx, max = 20) {
    const { propias, publicadas, cruces, vigentes, contra, notas, categorias } = calcularOfertas(idx);
    const rango = { alta: 2, media: 1 };
    const nuevo = (f, ref, tipo) => { const g = categorias.get(f);
      return { f, ref, tipo, off: 1 - f[1] / f[ref], ahorro: f[ref] - f[1], categoria: g.categoria, nivel: g.nivel,
        cruce: cruces.has(f), vigente: vigentes.has(f), contra: contra.get(f), nota: notas.get(f), internacional: esInternacional(f) }; };
    const por = (a, b) => a.internacional - b.internacional || (a.tipo === b.tipo ? 0 : a.tipo === "propia" ? -1 : 1)
      || (rango[b.nivel] || 0) - (rango[a.nivel] || 0) || b.off - a.off || b.ahorro - a.ahorro || (a.f[2] < b.f[2] ? -1 : 1);
    const todas = [...propias.map(f => nuevo(f, 6, "propia")), ...publicadas.map(f => nuevo(f, 5, "publicada"))].filter(o => esUrl(o.f[2]));
    // El mismo producto en varias tiendas (mismo codigo de modelo exacto, nunca por parecido) ocupa un solo lugar:
    // gana el mejor ubicado.
    const unico = lista => { const vistos = new Set(); return lista.filter(o => !o.f[9] || (!vistos.has(o.f[9]) && vistos.add(o.f[9]))); };
    const grupos = new Map(C.ORDEN.map(c => [c, unico(todas.filter(o => o.categoria === c).sort(por))]));
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
    for (const o of unico([...todas].sort(por))) if (elegidas.size < max) elegidas.add(o);   // si aun falta, lo mejor que quede
    return [...elegidas].sort((a, b) => C.ORDEN.indexOf(a.categoria) - C.ORDEN.indexOf(b.categoria) || por(a, b));
  }

  const api = { PISO_OFERTA, DESCUENTO_MAX, BAJA_MIN_PESOS, DESCUENTO: C.DESCUENTO,
                referencia: C.referencia, aspectosDe: C.aspectosDe, pisoDeGama: C.evaluar, textoContra, calcularOfertas, destacadas };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Ofertas = api;
})(this);
