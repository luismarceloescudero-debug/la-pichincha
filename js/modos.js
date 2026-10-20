/* Los tres modos de la busqueda (spec 013): Recomendacion, Super Oferta y Primera Linea, y el orden de adentro
   (Precio, Novedades, Premium). Logica pura, sin DOM: la usan la pagina (js/busqueda.js) y las paginas por busqueda.
   - Recomendacion: precio-calidad. Pasa el piso de gama, marca reconocida y no esta muy por debajo del resto.
   - Super Oferta: una oferta real de js/ofertas.js (baja propia o rebaja publicada, ya con piso de gama, segundo
     chequeo y tachado fijo) de gama media. La generacion anterior cuenta cuando la actual mejoro poco (vigenciaDe).
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
    { id: "super", eti: "Súper Oferta", ayuda: "ofertas reales de gama media" },
    { id: "primera", eti: "Primera Línea", ayuda: "lo más premium por especificaciones y tecnología (pantalla, procesador, batería, materiales), no por marca" },
  ];
  const SECUNDARIOS = [
    { id: "precio", eti: "Precio ↓" },
    { id: "novedades", eti: "Novedades" },
    { id: "premium", eti: "Premium" },
  ];
  const MODO_BASE = "recomendacion", SECUNDARIO_BASE = "precio";

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
      for (const f of [...of.propias, ...of.publicadas]) ofertas.set(f[2], of.categorias.get(f));
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

  /* Las filas que entran en un modo. med es la mediana de lo comparable de la busqueda. */
  function filtrar(filas, modo, ctx, med) {
    const niv = ctx.nivelMarca;
    if (modo === "super") { const of = ctx.ofertas(); return filas.filter(f => { const g = of.get(f[2]); return g && g.pasa && g.nivel === "media"; }); }
    if (modo === "primera") return filas.filter(f => ctx.premium(f[0]).premium);
    return filas.filter(f => ctx.gama(f[0]).pasa && niv(f[0]) >= 1 && !B.pisoDeGama(f[1], niv(f[0]), med));
  }

  function ordenar(filas, secundario, ctx) {
    const clave = secundario === "novedades" ? f => novedadDe(f[0], ctx.ref)
      : secundario === "premium" ? f => premiumDe(f[0], ctx) : () => 0;
    return [...filas].sort((a, b) => (esInternacional(a) - esInternacional(b)) || (clave(b) - clave(a)) || (b[1] - a[1]));
  }

  /* Cuantas filas da cada modo: para decir, cuando uno queda vacio, que otro si tiene resultados. */
  function contar(filas, ctx, med) {
    return Object.fromEntries(MODOS.map(m => [m.id, filtrar(filas, m.id, ctx, med).length]));
  }

  /* Mensaje de un modo sin resultados: nunca una pantalla vacia, siempre con otro modo para probar. */
  function textoVacio(modo, cuentas) {
    const m = MODOS.find(x => x.id === modo) || MODOS[0];
    const otros = MODOS.filter(x => x.id !== m.id && cuentas[x.id] > 0);
    const razon = modo === "super" ? "ninguna es una oferta real de gama media hoy"
      : modo === "primera" ? "ningún aviso llega al puntaje premium (pantalla, procesador, batería, materiales o generación); en periféricos y otros rubros no hay puntaje"
      : "ningún aviso pasa el piso de gama con marca reconocida";
    return { razon, otros, texto: `En «${m.eti}» no hay nada para esta búsqueda: ${razon}.` };
  }

  const api = { MODOS, SECUNDARIOS, MODO_BASE, SECUNDARIO_BASE, esModo, esSecundario, migrarModo, migrarSecundario,
                preparar, novedadDe, premiumDe, filtrar, ordenar, contar, textoVacio };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Modos = api;
})(this);
