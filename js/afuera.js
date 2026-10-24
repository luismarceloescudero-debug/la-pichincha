/* Seccion «Afuera» de la busqueda (spec 022): lo que pinta la pagina con la respuesta del Worker (worker/). Funciones puras: no
   tocan el DOM ni la red; el pedido y el pegamento viven en js/busqueda.js. Sin Worker configurado o sin respuesta queda el
   `respaldo`: el bloque de busquedas armadas de la spec 020. Si el Worker responde pero ninguna fuente pudo leerse (24/10:
   Tiendamia y Loquieroaca pasaron a pedir el desafio anti-bots de Cloudflare), se dice y va el respaldo: la seccion no
   desaparece sin explicacion. El orden es por precio, nunca por comision.
   Primera version: OmniRoute `revision` (gpt-oss-120b), 10/10 tests; a mano, el mensaje sin avisos y los precios no numericos. */
(function (raiz) {
  "use strict";

  const I = typeof module === "object" && module.exports ? require("./importar.js") : raiz.Importar;
  const C = typeof module === "object" && module.exports ? require("./calculadora.js") : raiz.Calculadora;

  const NOMBRES = { ebay: "eBay (EE.UU.)", aliexpress: "AliExpress", amazon: "Amazon (EE.UU.)", loquieroaca: "Loquieroacá", tiendamia: "Tiendamia" };
  const MAX = 8;
  const nombre = id => NOMBRES[id] || id;
  const monto = (n, moneda) => (moneda === "USD" ? "US$ " : moneda + " ")
    + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");
  const unir = l => (l.length > 1 ? l.slice(0, -1).join(", ") + " y " + l[l.length - 1] : l.join(""));

  /* La consulta al Worker; "" si no hay Worker configurado (sitio.json afuera_url) o no hay termino. */
  function urlConsulta(base, q) {
    const t = typeof q === "string" ? q.trim() : "";
    return base && t ? base + "/buscar?q=" + encodeURIComponent(t) : "";
  }

  /* La calculadora con el precio, el envio (si la fuente lo da) y los impuestos cobrados en el checkout. */
  function hrefCalcular(item, pathname) {
    return C.urlDeEstado(pathname || "/", { ...I.estadoImportar(item.precio, "otro"), moneda: item.moneda,
      flete: item.envio != null ? String(item.envio) : "", cobro: "checkout" });
  }

  function itemHtml(it, { esc, pathname }) {
    const img = typeof it.imagen === "string" && it.imagen.startsWith("https://")
      ? `<img src="${esc(it.imagen)}" alt="" loading="lazy" width="64" height="64">` : "";
    const puesto = it.precioArs > 0
      ? `<span class="afv-puesto">${pesos(it.precioArs)} puesto en casa</span>`
      : `<a class="acc" href="${esc(hrefCalcular(it, pathname))}">Calcular puesto en casa</a>`;
    return `<li class="afv-item">${img}<div class="afv-txt"><a href="${esc(it.url)}" target="_blank" rel="${it.afiliado ? "sponsored noopener" : "noopener"}">${esc(it.nombre)}</a>`
      + (it.afiliado ? '<span class="rotulo">enlace de afiliado</span>' : "")
      + `<span class="afv-precio">${monto(it.precio, it.moneda)}</span>`
      + (it.envio === 0 ? '<span class="sub chico">con envío incluido</span>'      // Tiendamia: su precio ya trae el envio
        : it.envio != null ? `<span class="sub chico">+ envío ${monto(it.envio, it.moneda)}</span>` : "")
      + `<span class="sub chico">${esc(nombre(it.fuente))}</span>${puesto}</div></li>`;
  }

  /* datos: la respuesta del Worker { consulta, fecha, fuentes: [{ id, ok, n }], items }. mejorAca: { precio, tienda } o null.
     respaldo: HTML que va cuando no hay avisos para mostrar (las busquedas armadas), o "". */
  function afueraHtml(datos, { esc, icono = () => "", mejorAca = null, pathname = "/", respaldo = "" } = {}) {
    if (!datos || !Array.isArray(datos.items) || !Array.isArray(datos.fuentes)) return respaldo;
    const ok = datos.fuentes.filter(f => f.ok), caidas = datos.fuentes.filter(f => !f.ok);
    if (!datos.fuentes.length) return respaldo;
    const titulo = `<section class="afuera-vivo" aria-labelledby="afv-tit"><h3 id="afv-tit">${icono("fuera")} Afuera, en vivo</h3>`;
    const pie = caidas.map(f => `${esc(nombre(f.id))} no respondió.`).join(" ");
    if (!ok.length)
      return `${titulo}<p class="sub chico">Ahora no pudimos leer precios de afuera: ${pie}</p></section>${respaldo}`;
    const items = datos.items.filter(i => typeof i.url === "string" && i.url.startsWith("https://") && typeof i.precio === "number")
      .slice().sort((a, z) => a.precio - z.precio).slice(0, MAX);
    if (!items.length) {
      return `${titulo}<p class="sub chico">No encontramos ofertas con envío a Argentina en ${esc(unir(ok.map(f => nombre(f.id))))}.`
        + `${pie ? " " + pie : ""}</p></section>${respaldo}`;
    }
    return titulo
      + (mejorAca ? `<p class="sub">Mejor precio acá: <b>${pesos(mejorAca.precio)}</b> en ${esc(mejorAca.tienda)}.</p>` : "")
      + `<ul class="afv-lista">${items.map(it => itemHtml(it, { esc, pathname })).join("")}</ul>`
      + `<p class="sub chico">${pie ? pie + " " : ""}El orden es por precio, nunca por comisión. Los precios son de cada tienda; impuestos y envío a Argentina aparte salvo que se indique.</p></section>`;
  }

  const api = { NOMBRES, urlConsulta, hrefCalcular, afueraHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Afuera = api;
})(this);
