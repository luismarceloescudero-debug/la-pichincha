/* Monitor de monedas (spec 043): el dolar oficial, tarjeta y MEP y el euro contra el peso, en vivo desde DolarApi (publica,
   gratuita y con CORS abierto: verificado el 28/10/2026), con su fuente y su hora a la vista. Con eso los desgloses de la
   spec 042 en dolares o euros pasan a pesos. Si DolarApi no responde no hay cotizacion: no se convierte con un valor viejo
   (no hay copia guardada) y la pagina lo dice. Funciones puras: no tocan el DOM ni la red; el pedido vive en
   js/vista-afuera.js. Antecedente: el js/monedas.js de la spec 010, que se fue con la calculadora en la spec 040. */
(function (raiz) {
  "use strict";

  const FUENTE = "DolarApi";
  const URLS = { dolares: "https://dolarapi.com/v1/dolares", eur: "https://dolarapi.com/v1/cotizaciones/eur" };
  /* Los tres dolares que se ofrecen para pasar a pesos, en este orden. Tarjeta por defecto: es el que cobra el banco al
     pagar con tarjeta en una tienda del exterior (Amazon, eBay). MEP: la referencia si se paga con dolares propios. */
  const TIPOS = [
    { id: "tarjeta", nombre: "Tarjeta", corto: "tarjeta", ayuda: "lo que cobra el banco al pagar afuera con tarjeta en pesos" },
    { id: "bolsa", nombre: "MEP", corto: "MEP", ayuda: "si pagás con dólares propios comprados en la bolsa" },
    { id: "oficial", nombre: "Oficial", corto: "oficial", ayuda: "el del banco, sin percepciones" },
  ];
  const POR_DEFECTO = "tarjeta";
  const HORAS_VIEJA = 96;     // un fin de semana largo sin publicar todavia no es «viejo»; mas que eso, se avisa

  const positivo = n => typeof n === "number" && Number.isFinite(n) && n > 0;
  const iso = x => { const t = Date.parse(x); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

  /* Las respuestas de DolarApi -> { dolares: { tarjeta: { venta, actualizado }, ... }, eur: { venta, actualizado } | null }
     o null si no hay ni un dolar util. Solo los tres tipos de TIPOS; lo que falta no se inventa. */
  function normalizar(dolares, eur) {
    const salida = { dolares: {}, eur: null, fuente: FUENTE };
    if (Array.isArray(dolares)) {
      for (const d of dolares) {
        if (d && TIPOS.some(t => t.id === d.casa) && positivo(d.venta)) salida.dolares[d.casa] = { venta: d.venta, actualizado: iso(d.fechaActualizacion) };
      }
    }
    if (eur && eur.moneda === "EUR" && positivo(eur.venta)) salida.eur = { venta: eur.venta, actualizado: iso(eur.fechaActualizacion) };
    return Object.keys(salida.dolares).length ? salida : null;
  }

  /* La hora en Argentina («14:00»), con la fecha si no es de hoy («27/10 14:00»). */
  function horaAr(actualizado, ahora = new Date()) {
    const t = Date.parse(actualizado);
    if (!Number.isFinite(t)) return "";
    const zona = { timeZone: "America/Argentina/Buenos_Aires" };
    const dia = d => new Date(d).toLocaleDateString("es-AR", { ...zona, day: "2-digit", month: "2-digit" });
    const hora = new Date(t).toLocaleTimeString("es-AR", { ...zona, hour: "2-digit", minute: "2-digit", hour12: false });
    return dia(t) === dia(ahora) ? hora : `${dia(t)} ${hora}`;
  }

  const vieja = (actualizado, ahora = new Date()) => {
    const t = Date.parse(actualizado);
    return Number.isFinite(t) && new Date(ahora).getTime() - t > HORAS_VIEJA * 3600000;
  };

  const tipoDe = id => TIPOS.find(t => t.id === id) || TIPOS.find(t => t.id === POR_DEFECTO);

  /* Pesos por unidad de `moneda` (USD o EUR) al dolar `tipo` -> { valor, nombre, fuente, hora } para filasDetalle (spec 042),
     o null si falta el dato. El euro pasa por el dolar: euro oficial / dolar oficial (el cruce que publica DolarApi) x el
     dolar elegido; con el oficial es el euro oficial tal cual. */
  function cotizacion(tasas, moneda, tipo = POR_DEFECTO, ahora = new Date()) {
    if (!tasas) return null;
    const t = tipoDe(tipo), d = tasas.dolares[t.id];
    if (!d) return null;
    const marca = a => horaAr(a, ahora) + (vieja(a, ahora) ? ", vieja" : "");
    if (moneda === "USD") return { valor: d.venta, nombre: `dólar ${t.corto}`, fuente: tasas.fuente, hora: marca(d.actualizado) };
    if (moneda === "EUR") {
      const of = tasas.dolares.oficial;
      if (!tasas.eur || !of) return null;
      const valor = t.id === "oficial" ? tasas.eur.venta : tasas.eur.venta / of.venta * d.venta;
      return { valor, nombre: t.id === "oficial" ? "euro oficial" : `euro al dólar ${t.corto}`, fuente: tasas.fuente,
        hora: marca([tasas.eur.actualizado, d.actualizado].filter(Boolean).sort()[0]) };
    }
    return null;
  }

  const pesos = n => "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  /* El monitor: los tres dolares y el euro, cada uno con su hora, y la eleccion del dolar para pasar a pesos. `tasas` null
     con `cargando` -> «consultando»; null sin cargar -> «sin cotización». */
  function monitorHtml(tasas, { esc, tipo = POR_DEFECTO, cargando = false, ahora = new Date() }) {
    const tit = `<p class="mn-tit"><b>Monedas en vivo</b> <span class="sub chico">contra el peso · fuente ${esc(FUENTE)}</span></p>`;
    if (!tasas) {
      return `<div class="monedas">${tit}<p class="sub chico mn-sin">${cargando ? "Consultando la cotización…"
        : "Sin cotización: DolarApi no respondió. Los totales en dólares o euros no se pasan a pesos."}</p></div>`;
    }
    const celda = (nombre, x) => `<li><span class="mn-nombre">${esc(nombre)}</span> <span class="mn-valor">${x ? esc(pesos(x.venta)) : "sin cotización"}</span>`
      + (x && x.actualizado ? ` <span class="mn-hora${vieja(x.actualizado, ahora) ? " mn-vieja" : ""}">${esc(horaAr(x.actualizado, ahora))}${vieja(x.actualizado, ahora) ? " · vieja" : ""}</span>` : "") + "</li>";
    const lista = [...TIPOS.map(t => celda(`Dólar ${t.corto}`, tasas.dolares[t.id])), celda("Euro", tasas.eur)].join("");
    const elegido = tipoDe(tipo).id;
    const radios = TIPOS.map(t => `<label class="mn-op"><input type="radio" name="mn-tipo" value="${t.id}"${t.id === elegido ? " checked" : ""}${tasas.dolares[t.id] ? "" : " disabled"}> ${esc(t.nombre)}</label>`).join("");
    return `<div class="monedas">${tit}<ul class="mn-lista">${lista}</ul>
        <fieldset class="mn-elegir"><legend class="sub chico">Para pasar a pesos lo que está en dólares o euros, usar el dólar:</legend>${radios}</fieldset>
        <p class="sub chico">${esc(`Tarjeta: ${TIPOS[0].ayuda}. MEP: ${TIPOS[1].ayuda}. Valor de venta; la hora es la de cada cotización.`)}</p></div>`;
  }

  const api = { FUENTE, URLS, TIPOS, POR_DEFECTO, HORAS_VIEJA, normalizar, horaAr, cotizacion, monitorHtml };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Monedas = api;
})(this);
