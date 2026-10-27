/* --- Pegar un link en «Buscalo afuera» (spec 040) -------------------------------------------------
   js/importar.js reconoce la tienda y arma la ficha; aca se pide al Worker (GET /enlace, spec 023) el precio de la pagina
   pegada y se muestra la referencia: el precio final de Tiendamia (con el porcentaje contra Amazon) o el de Loquieroaca, en
   pesos. Sin formulario ni calculadora. El bloque se repinta con cada busqueda: el campo se escucha desde el documento. */
const ENLACES = new Map();      // url de /enlace -> promesa de la respuesta
let ENLACE_TURNO = 0, ENLACE_ESPERA = null;

/* Un pedido por link y por sesion; si falla o no hay Worker, queda la ficha con sus enlaces. */
function pedirPrecioEnlace(res, e) {
  const turno = ++ENLACE_TURNO, url = Importar.urlLeerEnlace(AFUERA_URL, e.url), linea = $(".pl-leido", res);
  clearTimeout(ENLACE_ESPERA);
  if (!url || !linea) return;
  linea.textContent = `Leyendo el precio en ${Importar.datosDeEnlace(e).tiendaNombre}…`;
  ENLACE_ESPERA = setTimeout(() => {
    if (!ENLACES.has(url)) {
      const corte = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? { signal: AbortSignal.timeout(10000) } : {};
      ENLACES.set(url, fetch(url, corte).then(r => (r.ok ? r.json() : null)).catch(() => null)
        .then(r => { if (!r) ENLACES.delete(url); return r; }));       // un fallo se puede reintentar pegando de nuevo
    }
    ENLACES.get(url).then(r => {
      if (turno === ENLACE_TURNO) linea.textContent = Importar.lineaLeida(Importar.leidoDeEnlace(r), e);
    });
  }, 400);
}

function leerEnlace(res, texto) {
  if (!texto.trim()) { ++ENLACE_TURNO; res.innerHTML = ""; return; }
  const e = Importar.parsearEnlace(texto);
  res.innerHTML = Importar.fichaEnlaceHtml(e, { esc, icono });
  if (e) pedirPrecioEnlace(res, e);
  else ++ENLACE_TURNO;
}

document.addEventListener("input", ev => {
  const campo = ev.target;
  if (!campo || campo.id !== "pl-link") return;
  const res = $("#pl-res", campo.closest(".pegar-link") || document);
  if (res) leerEnlace(res, campo.value);
});
