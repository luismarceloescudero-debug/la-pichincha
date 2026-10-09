/* Que es una oferta: la misma logica para la pestaña Ofertas, el feed RSS y el canal de Telegram.
   Dos señales distintas:
   1. Bajas propias: lo que valia en el relevamiento anterior contra lo que vale hoy. No depende de lo que
      publique la tienda y no se puede inflar.
   2. Rebajas publicadas: el precio tachado del comercio, acotado entre 15% y 60% porque arriba de ahi el
      precio anterior suele estar inventado.
   El orden nunca depende de comisiones. */
(function (raiz) {
  "use strict";

  const PISO_OFERTA = 15000, DESCUENTO_MIN = 0.15, DESCUENTO_MAX = 0.6;
  const BAJA_MIN_PCT = 0.03, BAJA_MIN_PESOS = 1000;

  const esUrl = u => /^https?:\/\//i.test(String(u));

  function calcularOfertas(idx) {
    const propias = [], publicadas = [];
    for (const f of idx.productos) {
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
    return { propias, publicadas };   // sin recortar: cada uso filtra y pagina
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

  const api = { PISO_OFERTA, DESCUENTO_MIN, DESCUENTO_MAX, BAJA_MIN_PCT, BAJA_MIN_PESOS, calcularOfertas, destacadas };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Ofertas = api;
})(this);
