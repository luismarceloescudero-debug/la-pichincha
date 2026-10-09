/* --- Ruteo --- */
function pintar(id) {
  const v = $("#vista");
  if (CONSULTA && ANALISIS && DINAMICAS.includes(id)) v.innerHTML = vistaDinamica(id);
  else if (id === "comparativa") v.innerHTML = vistaComparativa();
  else if (id === "ofertas") v.innerHTML = vistaOfertas();
  else if (id === "tiendas") v.innerHTML = vistaTiendas();
  else if (id === "buscar") v.innerHTML = vistaBuscar();
  else if (id === "veredicto") v.innerHTML = vistaVeredicto();
  else if (porId[id]) { v.innerHTML = detalle(porId[id]); return; }
  document.querySelectorAll(".tab").forEach(b =>
    b.setAttribute("aria-selected", String(b.dataset.ir === id)));
}

/* El hash es la unica fuente de verdad: asi andan el boton Atras del
   navegador, los enlaces directos a una tarjeta y recargar la pagina. */
let subirAlPintar = false;

const ALIAS = { memorias: "comparativa", webcams: "comparativa" };  // enlaces viejos que siguen andando

function elegirCategoria(cat) {
  CAT = cat;
  try { localStorage.setItem("cat", cat); } catch (e) { /* sin storage, se pierde al recargar */ }
}

function aplicar(id) {
  if (id === "webcams") elegirCategoria("webcam");
  if (porId[id]) elegirCategoria(catDe(porId[id]));
  id = ALIAS[id] || id;
  pintar(VISTAS.some(v => v.id === id) || porId[id] ? id : "comparativa");
  if (subirAlPintar) $(".tabs").scrollIntoView({ behavior: "smooth", block: "start" });
  subirAlPintar = false;
}

function ir(id, scroll) {
  subirAlPintar = !!scroll;
  if (location.hash.slice(1) === id) aplicar(id);
  else location.hash = id;
}

window.addEventListener("hashchange", alNavegar);
window.addEventListener("popstate", alNavegar);

function arrancar() {
  if (!P.length) { $("#vista").innerHTML = '<p class="sub">No hay datos cargados todavía. Corré <code>python actualizar.py --build</code>.</p>'; return; }
  $("#tablist").innerHTML = VISTAS.map(v => {
    const n = v.n();
    return `<button class="tab" role="tab" data-ir="${v.id}" data-dina="${["comparativa", "tiendas", "veredicto"].includes(v.id) ? 1 : 0}" aria-selected="false">
      ${icono(v.ico)} ${v.eti}${n ? ` <span class="n">${n}</span>` : ""}</button>`;
  }).join("");
  $("#sello").textContent = (DATOS.verificado
    ? `Precios verificados en cada sitio ${Pagina.cuando(DATOS.verificado)}`
    : `Precios verificados en cada sitio · actualizado ${DATOS.actualizado}`) + ` · ${P.length} productos seguidos`
    + (P.some(p => p.falla_desde) ? ` · ${P.filter(p => p.falla_desde).length} sin verificar` : "");
  $("#nota").innerHTML = `Precios con IVA tomados de CompraGamer, Gaming City, Mexx, FullH4rd y Venex, con el precio de
    transferencia o depósito de cada una. Las specs salen de las webs de ADATA, Corsair y Kingston, no de las fichas
    de las tiendas. Para refrescar todo: <code>python actualizar.py</code>. El stock y los precios de hardware se
    mueven rápido: confirmá antes de pagar.`;

  document.addEventListener("click", ev => {
    const tab = ev.target.closest(".tab");
    if (tab) return ir(tab.dataset.ir, false);
    const abrir = ev.target.closest("[data-abrir]");
    if (abrir) return ir(abrir.dataset.abrir, true);
    const seg = ev.target.closest("[data-cat]");
    if (seg) { limpiarConsulta(); elegirCategoria(seg.dataset.cat); return ir("comparativa", false); }
    if (ev.target.closest("[data-volver]")) return ir("comparativa", true);

    // quitar del historial: se maneja antes que repetir, porque la x vive adentro
    const quitar = ev.target.closest("[data-olvidar]");
    if (quitar) { ev.stopPropagation(); return olvidar(quitar.dataset.olvidar); }

    const comparar = ev.target.closest("[data-comparar]");
    if (comparar) return compararConsulta(comparar.dataset.comparar);

    // ---- Ofertas ----
    const ofe = ev.target.closest("[data-of]");
    if (ofe) return ofertasAccion(ofe);
    const estrella = ev.target.closest("[data-estrella]");
    if (estrella) return marcarEstrella(estrella);
    const comparaOf = ev.target.closest("[data-comparar-oferta]");
    if (comparaOf) return compararOferta(+comparaOf.dataset.compararOferta);
    const tarjetaOf = ev.target.closest(".ocard");
    if (tarjetaOf && !ev.target.closest("a,button")) return tarjetaOf.classList.toggle("abierta");

    const repetir = ev.target.closest("[data-rep]");
    if (repetir) return consultar(repetir.dataset.rep);

    const orden = ev.target.closest("[data-orden]");
    if (orden) {
      ORDEN = orden.dataset.orden;
      try { localStorage.setItem("orden", ORDEN); } catch (e) {}
      document.querySelectorAll("[data-orden]").forEach(b =>
        b.setAttribute("aria-selected", String(b.dataset.orden === ORDEN)));
      return pintarResultados(($("#q") || {}).value || "");
    }

    const irCat = ev.target.closest("[data-ir-cat]");
    if (irCat) { limpiarConsulta(); elegirCategoria(irCat.dataset.irCat); return ir("comparativa", true); }

    const irVista = ev.target.closest("[data-ir-vista]");
    if (irVista) return ir(irVista.dataset.irVista, true);

    if (ev.target.closest("[data-cambiar-consulta]")) return ir("buscar", true);

    if (ev.target.closest("[data-quitar-consulta]")) {
      limpiarConsulta();
      return aplicar(location.hash.slice(1));
    }

    const sugerida = ev.target.closest(".sug");
    if (sugerida) return consultar(sugerida.textContent.trim());

    // desde una oferta, saltar al buscador con las palabras distintivas
    const similar = ev.target.closest("[data-similar]");
    if (similar) {
      // Para buscar similares sirven categoria y marca, no el codigo de modelo:
      // "Notebook HP Intel" trae competencia, "15-fd2350la" trae ese producto solo.
      const clave = similar.dataset.similar.split(/\s+/)
        .filter(w => w.length >= 2 && !/\d/.test(w)).slice(0, 3).join(" ");
      ir("buscar", true);
      return setTimeout(() => consultar(clave), 60);
    }

    const refrescar = ev.target.closest("[data-refrescar]");
    if (refrescar) {
      const previo = refrescar.innerHTML;
      refrescar.innerHTML = `${icono("refrescar")} actualizando…`;
      return asegurarIndice(true)
        .then(() => { pintarResultados(($("#q") || {}).value || ""); pintarOfertas(); })
        .catch(() => {})
        .finally(() => { refrescar.innerHTML = previo; });
    }
  });

  const marcarDesborde = () => {
    const l = $(".tablist");
    $(".tabs").dataset.desborda = l.scrollWidth > l.clientWidth + 2 ? "1" : "0";
  };
  marcarDesborde();
  addEventListener("resize", marcarDesborde);
  $("#pie-impresion").textContent =
    `La Pichincha · ${location.origin}${location.pathname} · precios de ${DATOS.actualizado}, con IVA, sin envío.`;

  const inicio = Pagina.leerUrl(location.search, location.hash);
  if (inicio.q) abrirConsultaDeUrl(inicio.q, inicio.vista);
  else aplicar(inicio.vista);
}
arrancar();

/* App instalable (js/app.js): registra el service worker y avisa si no hay conexion, con la fecha
   de los precios que se estan viendo. Solo con la pagina suelta: dentro del visor del artifact no
   hay service worker y el aviso saldria siempre. */
const APP = SUELTA ? App.iniciar(window, document, {
  sw: "sw.js", sonda: "manifest.webmanifest",
  generado: () => (IDX && IDX.generado) || DATOS.verificado || DATOS.actualizado,
}) : null;
