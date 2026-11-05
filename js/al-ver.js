/* Animaciones al scrollear (pedido del dueño 05/11: «el descuento cae; algo parecido pero otra animacion para la tienda, el
   icono del producto y la caracteristica premium»).

   Cada tarjeta, fila o renglon recibe la clase `en-vista` la primera vez que entra en pantalla, y el CSS (css/sitio.css,
   «Al ver») arranca ahi sus animaciones: el % cae y rebota, la tienda entra de costado, el icono gira y las premium destellan.
   Sin JavaScript, sin IntersectionObserver o con «reducir movimiento» no se marca `anima` en <html> y todo se ve quieto
   desde el principio: nada queda escondido esperando una animacion. */
(function (raiz) {
  "use strict";

  const SELECTOR = ".ogrid>.ocard, table.nov-tabla tbody tr, .res>.fila, .h-lista>li";

  /* Engancha el observador. win y doc se pasan para poder probarlo sin navegador. Devuelve false si no anima. */
  function iniciar(win, doc) {
    if (!win || !doc || typeof win.IntersectionObserver !== "function") return false;
    if (win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    doc.documentElement.classList.add("anima");
    const io = new win.IntersectionObserver(entradas => {
      for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("en-vista"); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    const mirar = base => {
      if (!base || !base.querySelectorAll) return;
      if (base.matches && base.matches(SELECTOR) && !base.classList.contains("en-vista")) io.observe(base);
      base.querySelectorAll(SELECTOR).forEach(el => { if (!el.classList.contains("en-vista")) io.observe(el); });
    };
    mirar(doc);
    // Las pestañas pintan sus tarjetas despues (y «ver mas» suma otras): se miran apenas aparecen.
    if (typeof win.MutationObserver === "function") {
      new win.MutationObserver(cambios => { for (const c of cambios) c.addedNodes.forEach(mirar); })
        .observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    }
    return true;
  }

  const api = { SELECTOR, iniciar };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }
  raiz.AlVer = api;
  iniciar(raiz, raiz.document);
})(this);
