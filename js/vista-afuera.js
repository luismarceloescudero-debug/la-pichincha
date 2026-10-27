/* --- Pegar un link en «Buscalo afuera» (spec 040) -------------------------------------------------
   js/importar.js reconoce la tienda y arma la ficha; aca se pide al Worker (GET /enlace, spec 023) el precio de la pagina
   pegada y se muestra la referencia: el precio de Tiendamia (y el de Amazon que cita) o el final de Loquieroaca, en pesos. En la
   ficha de Tiendamia, el detalle del carrito que pega la persona (spec 041) se lee aca, sin salir del navegador. Sin
   calculadora. El bloque se repinta con cada busqueda: los campos se escuchan desde el documento. */
const ENLACES = new Map();      // url de /enlace -> promesa de la respuesta
let ENLACE_TURNO = 0, ENLACE_ESPERA = null;
let ENLACE_ITEM = null;         // lo que el Worker leyo del link de Tiendamia que esta en pantalla (precio y precioBase)

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
      if (turno !== ENLACE_TURNO) return;
      linea.textContent = Importar.lineaLeida(Importar.leidoDeEnlace(r), e);
      ENLACE_ITEM = r && r.leido && r.item && r.item.fuente === "tiendamia" ? r.item : null;
      pintarCarrito(res);       // si ya habia un detalle pegado, ahora suma la cuenta de Amazon
    });
  }, 400);
}

/* El detalle del carrito pegado (spec 041): la linea con el total de Tiendamia y, si la ficha se leyo, Amazon aprox. */
function pintarCarrito(res) {
  const campo = $("#pl-carrito", res), salida = $(".pl-carrito-res", res);
  if (!campo || !salida) return;
  const d = campo.value.trim() ? Importar.parsearDetalleTiendamia(campo.value) : null;
  salida.textContent = d ? Importar.referenciaCarrito(d, ENLACE_ITEM)
    : campo.value.trim() ? "No encuentro «Productos» con su monto en AR$: copiá el «Detalle de la compra» completo." : "";
}

function leerEnlace(res, texto) {
  ENLACE_ITEM = null;
  if (!texto.trim()) { ++ENLACE_TURNO; res.innerHTML = ""; return; }
  const e = Importar.parsearEnlace(texto);
  res.innerHTML = Importar.fichaEnlaceHtml(e, { esc, icono });
  if (e) pedirPrecioEnlace(res, e);
  else ++ENLACE_TURNO;
}

document.addEventListener("input", ev => {
  const campo = ev.target;
  if (!campo || (campo.id !== "pl-link" && campo.id !== "pl-carrito")) return;
  const res = $("#pl-res", campo.closest(".pegar-link") || document);
  if (!res) return;
  if (campo.id === "pl-link") leerEnlace(res, campo.value);
  else pintarCarrito(res);
});
