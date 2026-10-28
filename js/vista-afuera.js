/* --- Pegar un link en «Buscalo afuera» (spec 040) -------------------------------------------------
   js/importar.js reconoce la tienda y arma la ficha; aca se pide al Worker (GET /enlace, spec 023) el precio de la pagina
   pegada y se muestra la referencia: el precio de Tiendamia (y el de Amazon que cita) o el final de Loquieroaca, en pesos. El
   detalle de la compra que pega la persona (spec 041 para Tiendamia; spec 042, los cuatro proveedores) se lee aca, sin salir
   del navegador, y se muestra con las mismas filas en todos. Sin calculadora. El bloque se repinta con cada busqueda: los
   campos se escuchan desde el documento. */
const ENLACES = new Map();      // url de /enlace -> promesa de la respuesta
let ENLACE_TURNO = 0, ENLACE_ESPERA = null;
let ENLACE_ITEM = null;         // lo que el Worker leyo del link de Tiendamia que esta en pantalla (precio y precioBase)
let ENLACE_ACTUAL = null;       // el link reconocido que esta en pantalla: su tienda elige el parser del detalle

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

/* El detalle pegado (spec 042): el desglose con las mismas filas en los cuatro proveedores. En Tiendamia, si la ficha se leyo,
   suma la cuenta de Amazon al dolar de Tiendamia (spec 041). */
function pintarCarrito(res) {
  const campo = $("#pl-carrito", res), salida = $(".pl-carrito-res", res);
  if (!campo || !salida || !ENLACE_ACTUAL) return;
  const texto = campo.value.trim();
  const d = texto ? Importar.parsearDetalle(ENLACE_ACTUAL.tienda, campo.value) : null;
  salida.innerHTML = d ? Importar.detalleHtml(d, { esc, item: ENLACE_ITEM, cotizacion: cotizacionPara(d.moneda) })
    : texto ? `<p class="sub chico">${esc("No encuentro el producto con su monto: copiá el detalle completo, con cada concepto y su precio.")}</p>` : "";
}

/* --- Monitor de monedas (spec 043) ---
   DolarApi se consulta al aparecer el bloque y de nuevo si lo que hay tiene mas de MONEDAS_VIGENCIA. Si no responde, no hay
   cotizacion: el monitor y el total en pesos lo dicen (no se usa un valor anterior sin avisar). El dolar elegido para
   pasar a pesos se recuerda en este navegador (tarjeta por defecto). */
const MONEDAS_VIGENCIA = 10 * 60 * 1000;
let MONEDAS = { tasas: null, pedido: 0, cargando: false };
let MONEDAS_TIPO = (() => { try { return localStorage.getItem("pichincha-dolar") || Monedas.POR_DEFECTO; } catch (e) { return Monedas.POR_DEFECTO; } })();

const cotizacionPara = moneda => Monedas.cotizacion(MONEDAS.tasas, moneda, MONEDAS_TIPO);

function pintarMonedas() {
  for (const caja of document.querySelectorAll(".pl-monedas"))
    caja.innerHTML = Monedas.monitorHtml(MONEDAS.tasas, { esc, tipo: MONEDAS_TIPO, cargando: MONEDAS.cargando });
  const res = $("#pl-res");
  if (res) pintarCarrito(res);
}

function pedirMonedas() {
  if (MONEDAS.cargando || Date.now() - MONEDAS.pedido < MONEDAS_VIGENCIA) return pintarMonedas();
  MONEDAS = { tasas: null, pedido: Date.now(), cargando: true };
  pintarMonedas();
  const corte = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {};
  const json = url => fetch(url, corte).then(r => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([json(Monedas.URLS.dolares), json(Monedas.URLS.eur)]).then(([dolares, eur]) => {
    const tasas = Monedas.normalizar(dolares, eur);
    MONEDAS = { tasas, pedido: tasas ? Date.now() : 0, cargando: false };    // un fallo se reintenta al volver a pintar
    pintarMonedas();
  });
}

/* El bloque se pinta con innerHTML desde js/busqueda.js: cuando aparece un monitor vacio, se llena. */
if (typeof MutationObserver !== "undefined" && document.body)
  new MutationObserver(() => { if (document.querySelector(".pl-monedas:empty")) pedirMonedas(); })
    .observe(document.body, { childList: true, subtree: true });

document.addEventListener("change", ev => {
  if (!ev.target || ev.target.name !== "mn-tipo") return;
  MONEDAS_TIPO = ev.target.value;
  try { localStorage.setItem("pichincha-dolar", MONEDAS_TIPO); } catch (e) { /* sin almacenamiento, vale para esta visita */ }
  pintarMonedas();
});

function leerEnlace(res, texto) {
  ENLACE_ITEM = null;
  ENLACE_ACTUAL = null;
  if (!texto.trim()) { ++ENLACE_TURNO; res.innerHTML = ""; return; }
  const e = Importar.parsearEnlace(texto);
  ENLACE_ACTUAL = e;
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
