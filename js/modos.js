/* Los tres modos de la busqueda (spec 013): Recomendacion, Super Oferta y Primera Linea, y el orden de adentro
   (Precio, Novedades, Premium). Logica pura, sin DOM: la usan la pagina (js/busqueda.js) y las paginas por busqueda.
   - Recomendacion: precio-calidad. Pasa el piso de gama, marca reconocida y no esta muy por debajo del resto.
   - Super Oferta: una oferta REAL de js/ofertas.js que pasa el minimo de su gama (spec 014): precio contra el mismo
     modelo en otras tiendas (la señal principal), baja propia, rebaja publicada (con segundo chequeo y tachado fijo) o
     gama alta del año pasado al precio de una media de hoy. Cada fila trae SUS razones (`ctx.ofertas().get(url).razones`).
   - Primera Linea: el segmento premium por ESPECIFICACIONES Y TECNOLOGIA (js/premium.js), no por marca (spec 014).
   Lo internacional va siempre al final. Ningun modo mira comisiones (principio II). */
(function (raiz) {
  "use strict";

  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;
  const P = typeof module === "object" && module.exports ? require("./premium.js") : raiz.Premium;
  const C = typeof module === "object" && module.exports ? require("./categorias.js") : raiz.Categorias;
  const O = () => typeof module === "object" && module.exports ? require("./ofertas.js") : raiz.Ofertas;   // al usarlo: en la pagina se carga despues

  const MODOS = [
    { id: "recomendacion", eti: "Recomendación", ayuda: "precio-calidad: marca reconocida y dentro de lo normal" },
    { id: "super", eti: "Súper Oferta", ayuda: "ofertas reales: bajo el mismo modelo de otras tiendas, bajas propias, rebajas verificadas o gama alta del año pasado al precio de una media" },
    { id: "primera", eti: "Primera Línea", ayuda: "lo más premium por especificaciones y tecnología (pantalla, procesador, batería, materiales), no por marca" },
  ];
  /* «Mejor oferta» es el orden por defecto (spec 014): ninguna de las mejores apps (PriceSpy Best Match, Amazon Featured,
     Mercado Libre relevancia, Geizhals) usa «precio de mayor a menor» como orden por defecto; todas dejan precio en ambos sentidos. */
  const SECUNDARIOS = [
    { id: "mejor", eti: "Mejor oferta", ayuda: "primero lo más premium y nuevo; dentro de eso, la mayor baja contra el mismo modelo" },
    { id: "baja", eti: "Mayor baja", ayuda: "mayor % de baja contra el relevamiento anterior (24 h)" },
    { id: "baja7", eti: "Baja 7 días", ayuda: "mayor % de baja contra el precio de hace 7 días; sin historia de 7 días no se ordena por este criterio" },
    { id: "baja31", eti: "Baja 31 días", ayuda: "mayor % de baja contra el precio de hace 31 días; sin historia de 31 días no se ordena por este criterio" },
    { id: "precio", eti: "Precio ↓" },
    { id: "novedades", eti: "Novedades" },
    { id: "premium", eti: "Premium" },
  ];
  const MODO_BASE = "recomendacion", SECUNDARIO_BASE = "mejor";

  const esModo = v => MODOS.some(m => m.id === v);
  const esSecundario = v => SECUNDARIOS.some(s => s.id === v);
  /* Lo guardado por la version anterior ("recomendado", "precio", "marca") o por una manipulacion: cae en Recomendacion. */
  const migrarModo = v => esModo(v) ? v : MODO_BASE;
  const migrarSecundario = v => esSecundario(v) ? v : SECUNDARIO_BASE;

  const esInternacional = f => typeof f[8] === "string" && f[8].includes("i");

  /* Lo que se calcula una vez por indice: la referencia de generaciones, la gama de cada titulo y las ofertas. */
  /* Las ofertas se calculan recien cuando un modo las pide (en 25 mil avisos son ~1,4 s): `calculadas` es el resultado de
     calcularOfertas si la pagina ya lo tiene, y si no se calcula aca. */
  function preparar(idx, nivelMarca, calculadas, ganadores) {
    const ref = C.referencia(idx.productos), memo = new Map();
    const gama = nombre => { let g = memo.get(nombre); if (!g) memo.set(nombre, g = C.evaluar(nombre, ref)); return g; };
    const pmemo = new Map();
    const premium = nombre => { let p = pmemo.get(nombre); if (!p) pmemo.set(nombre, p = P.puntaje(nombre, ref, gama(nombre), ganadores)); return p; };
    let ofertas = null;
    const deOfertas = () => {
      if (ofertas) return ofertas;
      const of = (typeof calculadas === "function" ? calculadas() : calculadas) || O().calcularOfertas(idx);
      ofertas = new Map();
      const pone = (f, razon) => {
        const e = ofertas.get(f[2]) || ofertas.set(f[2], { g: (of.gama || of.categorias).get(f), razones: [] }).get(f[2]);
        e.razones.push(razon);
      };
      const O_ = O(), pesos = n => "$" + Math.round(n).toLocaleString("es-AR");
      for (const f of of.propias) pone(f, { tipo: "baja", off: 1 - f[1] / f[6], texto: `bajó ${Math.round((1 - f[1] / f[6]) * 100)}% contra el relevamiento anterior` });
      for (const f of of.publicadas) pone(f, { tipo: "rebaja", off: 1 - f[1] / f[5], texto: `${Math.round((1 - f[1] / f[5]) * 100)}% bajo el precio de lista de la tienda` });
      for (const [f, c] of of.contraModelo || []) pone(f, { tipo: "modelo", off: c.off, texto: O_.textoContraModelo(c, pesos) });
      for (const [f, c] of of.cruceGen || []) pone(f, { tipo: "generacion", off: Math.max(0, 1 - f[1] / c.mediana), texto: O_.textoCruceGen(c, pesos) });
      return ofertas;
    };
    return { ref, gama, premium, ofertas: deOfertas, nivelMarca };
  }

  /* Que tan nuevo es un titulo: 0 es lo ultimo que hay a la venta de su familia, -1 la generacion anterior; sin generacion
     se usa el año. Sin ninguno de los dos, no se sabe: queda al final. */
  function novedadDe(nombre, ref) {
    const gens = C.generacionesDe(nombre);
    if (gens.length) return Math.max(...gens.map(g => (g.gen - (ref.gen[g.fam] || g.gen)) / g.paso));
    const anios = C.aniosDe(nombre);
    return anios.length && ref.anio ? Math.max(...anios) - ref.anio : -Infinity;
  }

  /* El puntaje premium de un titulo (js/premium.js): lo que se ordena en «Premium» y lo que decide Primera Linea. */
  const premiumDe = (nombre, ctx) => ctx.premium(nombre).puntos;

  /* Recomendacion: pasa el piso de gama, marca reconocida y no esta muy por debajo del resto. */
  const enRecomendacion = (f, ctx, med) => ctx.gama(f[0]).pasa && ctx.nivelMarca(f[0]) >= 1 && !B.pisoDeGama(f[1], ctx.nivelMarca(f[0]), med);

  /* La mayor baja de un aviso: la mejor de sus razones de oferta (0 si no es una oferta). Lee las ofertas del indice. */
  const bajaDe = (f, ctx) => { const e = ctx.ofertas().get(f[2]); return e ? Math.max(...e.razones.map(r => r.off || 0)) : 0; };

  /* Las filas que entran en un modo. med es la mediana de lo comparable de la busqueda. El piso de gama SE MANTIENE (decision
     del dueño, spec 014): 4 GB de RAM o 64 GB de almacenamiento no alcanzan hoy y, por ser lo mas barato, parecerian una falsa oferta. */
  function filtrar(filas, modo, ctx, med) {
    const niv = ctx.nivelMarca;
    if (modo === "super") { const of = ctx.ofertas(); return filas.filter(f => { const e = of.get(f[2]); return e && e.g.pasa; }); }
    if (modo === "primera") return filas.filter(f => ctx.premium(f[0]).premium);
    return filas.filter(f => enRecomendacion(f, ctx, med));
  }

  /* «Mejor oferta entre lo mejor»: primero el nivel (premium, despues lo que pasa el minimo de su gama, despues el resto),
     dentro del nivel lo mas nuevo, despues la mayor baja contra el mismo modelo (o propia o publicada) y, a igual baja, el
     puntaje premium. */
  const nivelDe = (f, ctx) => ctx.premium(f[0]).premium ? 2 : ctx.gama(f[0]).pasa && ctx.gama(f[0]).nivel ? 1 : 0;
  function porMejor(ctx) {
    return (a, b) => (nivelDe(b, ctx) - nivelDe(a, ctx)) || (novedadDe(b[0], ctx.ref) - novedadDe(a[0], ctx.ref) || 0)
      || (bajaDe(b, ctx) - bajaDe(a, ctx)) || (premiumDe(b[0], ctx) - premiumDe(a[0], ctx))
      || ((ctx.tiendasDe ? ctx.tiendasDe(b) - ctx.tiendasDe(a) : 0));   // idea #11: a igual todo, el modelo que se puede comparar en mas tiendas
  }

  /* Baja de una ventana (7 o 31 dias) de la columna `pos` del indice, como fraccion (20 = 0,2). Sin dato (historia corta) vale 0: no se ordena por algo que no se afirma. */
  const bajaDeVentana = (f, pos) => (typeof f[pos] === "number" && f[pos] > 0 ? f[pos] / 100 : 0);

  function ordenar(filas, secundario, ctx) {
    const clave = secundario === "novedades" ? f => novedadDe(f[0], ctx.ref)
      : secundario === "premium" ? f => premiumDe(f[0], ctx)
      : secundario === "baja" ? f => (f[6] > f[1] ? 1 - f[1] / f[6] : 0)
      : secundario === "baja7" ? f => bajaDeVentana(f, 11)
      : secundario === "baja31" ? f => bajaDeVentana(f, 12) : () => 0;
    const extra = secundario === "mejor" ? porMejor(ctx) : () => 0;
    const cmp = (a, b) => (esInternacional(a) - esInternacional(b)) || extra(a, b) || (clave(b) - clave(a)) || (b[1] - a[1]);
    return [...filas].sort(cmp);
  }

  /* Lo que deja afuera un modo, dicho siempre (no se esconde nada): vacio si no deja nada afuera. */
  function notaDe(modo, total, enModo) {
    if (modo === "recomendacion") return total > enModo ? `Recomendación deja afuera ${total - enModo} avisos más (no llegan al mínimo de su gama —por ejemplo, menos de 6 GB de RAM o 128 GB en celulares—, no tienen marca reconocida o están muy por debajo del resto).` : "";
    if (modo === "super") return `Súper Oferta muestra solo ofertas reales: ${enModo} de ${total} avisos de esta búsqueda.`;
    return `Primera Línea muestra solo lo premium por especificaciones y tecnología: ${enModo} de ${total} avisos de esta búsqueda.`;
  }

  /* Cuantas filas da cada modo: para decir, cuando uno queda vacio, que otro si tiene resultados. */
  function contar(filas, ctx, med) {
    return Object.fromEntries(MODOS.map(m => [m.id, filtrar(filas, m.id, ctx, med).length]));
  }

  /* Mensaje de un modo sin resultados: nunca una pantalla vacia, siempre con otro modo para probar. */
  function textoVacio(modo, cuentas) {
    const m = MODOS.find(x => x.id === modo) || MODOS[0];
    const otros = MODOS.filter(x => x.id !== m.id && cuentas[x.id] > 0);
    const razon = modo === "super" ? "ninguna es una oferta real hoy (no hay una baja contra el mismo modelo en otras tiendas, ni baja propia, rebaja publicada o gama alta del año pasado al precio de una media de hoy). No se inventan ofertas"
      : modo === "primera" ? "ningún aviso llega al puntaje premium (pantalla, procesador, batería, materiales o generación); en periféricos y otros rubros no hay puntaje"
      : "ningún aviso pasa el piso de gama con marca reconocida";
    return { razon, otros, texto: `En «${m.eti}» no hay nada para esta búsqueda: ${razon}.` };
  }

  const api = { MODOS, SECUNDARIOS, MODO_BASE, SECUNDARIO_BASE, esModo, esSecundario, migrarModo, migrarSecundario,
                preparar, novedadDe, premiumDe, enRecomendacion, bajaDe, filtrar, ordenar, notaDe, contar, textoVacio };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Modos = api;
})(this);
