/* Boton de un clic para copiar el detalle de un carrito (Tiendamia, Amazon, eBay, Loquieroaca).
   Lo corre el dueño, a mano, en su propio navegador y con su propia sesion, sobre el carrito que ya esta mirando. NO recorre la
   tienda, NO arma carritos ni hace pedidos: solo copia al portapapeles el texto que ya esta en pantalla, para pegarlo en la
   pagina «Carritos de Tiendamia» o en el campo de «Buscalo afuera» (el parser de js/importar.js lee rotulo + monto).
   La version de una linea para el marcador esta en docs/copiar-detalle.md. */
(function (raiz) {
  const TOTAL = /total/i;
  const MONTO = /(us\s?\$|u\$s|usd|ar\$|ars|eur|€|\$)\s*\d/i;
  const CLAVES = /detalle de la compra|resumen (de la compra|del pedido|de tu pedido)|order summary|resumen/i;

  /* De una lista de textos de bloques de la pagina, elige el que mejor parece el detalle: tiene un total y un monto, no es
     enorme, y entre los que cumplen gana el que dice «detalle/resumen» y, a igual, el mas corto (el mas cercano al detalle). */
  function elegir(textos) {
    const buenos = textos
      .map(t => String(t || "").replace(/\n{3,}/g, "\n\n").trim())
      .filter(t => t.length >= 40 && t.length <= 4000 && TOTAL.test(t) && MONTO.test(t));
    if (!buenos.length) return "";
    buenos.sort((a, b) => (CLAVES.test(b) - CLAVES.test(a)) || a.length - b.length);
    return buenos[0];
  }

  async function copiar(texto, win) {
    try { await win.navigator.clipboard.writeText(texto); return true; } catch (e) { /* sigue con el plan B */ }
    try {
      const d = win.document, ta = d.createElement("textarea");
      ta.value = texto; ta.style.cssText = "position:fixed;opacity:0"; d.body.appendChild(ta); ta.select();
      const ok = d.execCommand("copy"); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  function aviso(win, mensaje, bien) {
    const d = win.document, el = d.createElement("div");
    el.textContent = mensaje;
    el.style.cssText = "position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);max-width:90vw;padding:10px 16px;"
      + "border-radius:8px;font:600 14px system-ui,sans-serif;color:#fff;background:" + (bien ? "#1f6f4a" : "#a33") + ";box-shadow:0 2px 12px #0006";
    d.body.appendChild(el); win.setTimeout(() => el.remove(), 4000);
  }

  async function correr(win) {
    const sel = String(win.getSelection ? win.getSelection() : "").trim();
    const d = win.document;
    const texto = sel.length >= 20 ? sel : elegir(Array.from(d.querySelectorAll("div,section,aside,table,form,ul")).map(e => e.innerText));
    if (!texto) return aviso(win, "No encontre el detalle de la compra en esta pagina. Selecciona el texto a mano y toca el boton otra vez.", false);
    const ok = await copiar(texto, win);
    aviso(win, ok ? "Copiado (" + texto.length + " caracteres). Pegalo en la pagina de Carritos." : "No pude copiar. Selecciona el texto y usa Ctrl+C.", ok);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { elegir };
  else correr(raiz);
})(typeof window !== "undefined" ? window : this);
