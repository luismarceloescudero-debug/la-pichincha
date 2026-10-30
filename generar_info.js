#!/usr/bin/env node
/* Paginas de informacion: /estado/ (cuando se relevo cada fuente), /legal/ (terminos, privacidad y
   afiliados) y, desde la spec 046, /contacto/ (el formulario que manda el Worker), /acerca/ y /.well-known/security.txt.

   Uso: node generar_info.js --indice indice.json --salud salud.json --salida _sitio [--fiabilidad fiabilidad.json] [--base-url URL]

   /estado/ sale del indice (tiendas.<clave>.relevado) y, si es de la misma corrida, de salud.json
   (cuanto trajo cada fuente, ver salud.py). Sin indice no hay estado que mostrar y se escriben
   solo las demas. Con --fiabilidad (la escribe fiabilidad.py) suma, por comercio, cuantas de las ofertas verificadas en los
   ultimos dias estaban caidas o con otro precio. */
"use strict";

const fs = require("fs");
const path = require("path");
const G = require("./generar_paginas.js");
const SITIO = require("./sitio.json");
const P = require("./js/pagina.js");
const Buscadas = require("./js/buscadas.js");   // el minimo y la ventana de «lo mas buscado»: la politica y el codigo dicen lo mismo

const BASE_URL = G.BASE_URL;
const esc = G.esc;

const ETIQUETAS = {
  fallo: "No respondió en el último relevamiento: se muestran sus precios anteriores, con su fecha.",
  baja: "Trajo menos de lo habitual: puede faltar parte de su catálogo.",
  atrasada: "Sin datos nuevos: se muestran sus precios anteriores, con su fecha.",
  "sin-datos": "Todavía sin relevar.",
  ok: "Al día.",
};
const ORDEN = ["fallo", "sin-datos", "atrasada", "baja", "ok"];

/* Una fila por fuente del indice. El estado medido en salud.json manda solo si es de la misma corrida
   que el indice; si no, lo dice la fecha del ultimo relevamiento. */
function estadoFuentes(idx, salud) {
  const medido = salud && salud.fecha === idx.generado ? salud.fuentes || {} : {};
  const avisos = {};
  for (const f of idx.productos || []) avisos[f[3]] = (avisos[f[3]] || 0) + 1;
  const filas = Object.entries(idx.tiendas || {}).map(([clave, t]) => {
    // Los indices anteriores a tiendas.relevado no la traen: si la fuente tiene avisos, son del indice.
    const relevado = t.relevado || (avisos[clave] ? idx.generado : null);
    let estado = !relevado ? "sin-datos" : P.precioDel(relevado, idx.generado) ? "atrasada" : "ok";
    if (medido[clave] && medido[clave].estado !== "ok") estado = medido[clave].estado;
    return { clave, nombre: t.nombre || clave, avisos: avisos[clave] || 0, relevado, estado, segunda: !!t.segunda };
  });
  return filas.sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado));
}

/* Fiabilidad del dato por comercio (fiabilidad.py): de las ofertas verificadas en la ventana, cuantas estaban caidas o con otro
   precio. El porcentaje solo se calcula con la muestra minima que dice el propio archivo: con menos no se rotula a nadie. */
function fiabilidadComercios(fiab) {
  const cs = fiab && fiab.comercios && typeof fiab.comercios === "object" ? fiab.comercios : {};
  return Object.entries(cs).map(([host, c]) => ({
    nombre: host.replace(/^www\./, ""), verificadas: c.verificadas || 0, caidas: c.caidas || 0,
    sinComprobar: c.sin_comprobar || 0, ultima: c.ultima || null, suficiente: !!c.suficiente,
    pct: c.suficiente && c.verificadas ? Math.round(100 * c.caidas / c.verificadas) : null,
  })).sort((a, b) => b.verificadas - a.verificadas || a.nombre.localeCompare(b.nombre));
}

const diaMes = iso => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${+m[2]}/${+m[1]}` : ""; };

function seccionFiabilidad(fiab) {
  const filas = fiabilidadComercios(fiab);
  if (!filas.length) return "";
  const { dias, minimo } = fiab;
  const celda = f => {
    if (!f.verificadas && f.sinComprobar) return `<span class="est">Ninguno se pudo comprobar todavía (sin comprobar: ${f.sinComprobar}).</span>`;
    if (!f.verificadas) return `<span class="est">Sin revisiones en los últimos ${dias} días.</span>`;
    if (!f.suficiente) return `<span class="est">Pocas revisiones: ${f.verificadas} de ${minimo} (sin porcentaje).</span>`;
    return `${f.caidas} (${f.pct}%)` + (f.sinComprobar ? `<span class="est">sin comprobar: ${f.sinComprobar}</span>` : "");
  };
  const cuerpo = filas.map(f => `    <tr><td>${esc(f.nombre)}` +
    (f.ultima ? `<span class="cuando">Última revisión: ${esc(diaMes(f.ultima))}</span>` : "") +
    `</td><td class="num">${f.verificadas.toLocaleString("es-AR")}</td><td class="num">${celda(f)}</td></tr>`).join("\n");
  return `
  <section>
    <h2 id="fiabilidad">Ofertas que ya no estaban en pie</h2>
    <p>Antes de publicar una oferta, se abre su publicación en la tienda (o se consulta su API pública) para ver si sigue en pie y al precio que decía. Esta tabla cuenta, por comercio, las ofertas verificadas en los últimos ${dias} días (hasta el ${esc(diaMes(fiab.hasta))}) y cuántas estaban caídas o con otro precio. Las que no pasan la revisión se descartan y no se muestran en el sitio.</p>
    <p>Es un conteo propio de lo que revisó este sitio, no es una opinión sobre la tienda ni sobre su atención. Se revisan las mejores ofertas del día, que son las más propensas a haberse agotado, y lo que llega por un comparador puede traer un precio viejo. «Sin comprobar» son los avisos que se descartaron porque la tienda bloqueó la revisión o no respondió: no prueban nada en contra de ella y no entran en el porcentaje. Con menos de ${minimo} verificadas no se muestra un porcentaje.</p>
    <table class="fiab">
      <thead><tr><th>Comercio</th><th class="num">Verificadas</th><th class="num">Caídas o con otro precio</th></tr></thead>
      <tbody>
${cuerpo}
      </tbody>
    </table>
  </section>`;
}

const ESTILO = `<style>
.info table{width:100%;min-width:0;border-collapse:collapse}
.info th,.info td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.info .num{text-align:right}
.info td.num .est{white-space:normal;max-width:12em;margin-left:auto}
@media (max-width:520px){.info table.fiab th,.info table.fiab td{padding:10px 4px}.info table.fiab .num{font-size:.85rem;white-space:normal}}
.info .est{display:block;font-size:.82rem;color:var(--ink-2)}
.info .est.mal{color:var(--bad)}
.info td:first-child{font-family:var(--font-sans)}
.info .agr{font-size:.75rem;color:var(--ink-3)}
.info .cuando{display:block;font:500 .78rem var(--font-mono);color:var(--ink-3);margin-top:2px}
.info section{margin:28px 0}
.info section p,.info section li{line-height:1.55}
</style>`;

const pie = `<p class="nota"><a href="../">Volver a La Pichincha</a> · <a href="../estado/">Estado de las fuentes</a> · <a href="../legal/">Términos y privacidad</a> · <a href="../contacto/">Contacto</a> · <a href="../acerca/">Acerca de</a></p>`;

/* La cabeza comun de las paginas generadas, con el estilo de estas dos adentro del <head>. */
const cabeza = opciones => G.cabeza(opciones).replace("</head>", ESTILO + "\n</head>");

function renderEstado(idx, salud, { baseUrl = BASE_URL, fiabilidad = null } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const filas = estadoFuentes(idx, salud).map(f => `    <tr><td>${esc(f.nombre)}${f.segunda ? ' <span class="agr">(agregador)</span>' : ""}` +
    `<span class="est${f.estado === "ok" ? "" : " mal"}">${esc(ETIQUETAS[f.estado] || f.estado)}</span>` +
    (f.relevado ? `<span class="cuando">Último dato: ${esc(P.fechaHora(f.relevado))}</span>` : "") +
    `</td><td class="num">${f.avisos.toLocaleString("es-AR")}</td></tr>`).join("\n");
  return cabeza({ titulo: "Estado de las fuentes | La Pichincha",
    descripcion: "Cuándo se relevó por última vez cada tienda que compara La Pichincha y cuántos avisos trajo.",
    canonica: `${base}/estado/`, baseUrl: base, rel: "../" }) + `
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap info">
  <h1>Estado de las fuentes</h1>
  <p class="sub">Precios del ${esc(P.fechaHora(idx.generado))} (hora argentina). Cada tienda se releva una vez por día; si una no responde, se conservan sus precios anteriores y se muestran con su fecha, nunca como si fueran de hoy.</p>
  <table>
    <thead><tr><th>Tienda</th><th class="num">Avisos</th></tr></thead>
    <tbody>
${filas}
    </tbody>
  </table>${seccionFiabilidad(fiabilidad)}
  ${pie}
</main>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

function renderLegal({ baseUrl = BASE_URL } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  return cabeza({ titulo: "Términos, privacidad y afiliados | La Pichincha",
    descripcion: "Cómo funciona La Pichincha: de dónde salen los precios, qué datos se miden y cómo se rotulan los enlaces de afiliado.",
    canonica: `${base}/legal/`, baseUrl: base, rel: "../" }) + `
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap info">
  <h1>Términos, privacidad y afiliados</h1>
  <section>
    <h2 id="terminos">Términos de uso</h2>
    <p>La Pichincha compara precios publicados por tiendas argentinas. No vende nada: cada compra se hace en la tienda, con sus condiciones, su stock y su garantía.</p>
    <p>Cada precio dice de dónde sale y cuándo se verificó. Los precios con IVA y sin envío cambian rápido: confirmalos en la tienda antes de pagar. Si una tienda no responde, se muestran sus precios anteriores con su fecha (ver <a href="../estado/">estado de las fuentes</a>).</p>
    <p>El análisis ("qué conviene") es una orientación hecha con los datos del día, no un consejo profesional.</p>
  </section>
  <section>
    <h2 id="privacidad">Privacidad</h2>
    <p>El sitio no tiene cuentas y no guarda datos personales. Las visitas, las búsquedas y los clics a tiendas se miden con GoatCounter, sin cookies y sin identificar a nadie, para saber qué se busca y qué sirve.</p>
    <p><b>Lo más buscado.</b> La portada muestra las búsquedas más frecuentes. Se calculan con conteos agregados de GoatCounter de los últimos ${Buscadas.VENTANA_DIAS} días (cuántas personas distintas hicieron cada búsqueda). Una búsqueda solo se publica si la hicieron al menos ${Buscadas.MINIMO_VISITANTES} personas distintas y corresponde a un producto del catálogo; se descartan las que parecen datos personales (mails, teléfonos, números largos o direcciones web). Se publica solo la lista, sin conteos, sin fechas y sin nada de quién buscó.</p>
    <p>Las preferencias (por ejemplo, el tema claro u oscuro) quedan solo en tu navegador.</p>
    <p id="contacto"><b>Formulario de contacto.</b> Lo que escribís en <a href="../contacto/">Contacto</a> (tu nombre si lo ponés, tu correo, el motivo y el mensaje) se manda por correo a quien hace el sitio, solo para poder responderte. El sitio no lo guarda en ninguna base ni lo usa para otra cosa, y no pasa por GoatCounter.</p>
  </section>
  <section>
    <h2 id="afiliados">Enlaces de afiliado</h2>
    <p>Algunos enlaces a tiendas pueden ser de afiliado: si comprás, la tienda le paga una comisión a La Pichincha, sin costo extra para vos. Cada uno de esos enlaces va rotulado.</p>
    <p>El orden de los resultados nunca depende de una comisión: sale solo del modo que elegís (Recomendación, Súper Oferta o Primera Línea), del precio y de las reglas de comparación.</p>
    <p><b>Amazon:</b> como Asociado de Amazon, La Pichincha gana una comisión con las compras que califican hechas desde sus enlaces a amazon.com. Esos enlaces llevan el rótulo «enlace de afiliado».</p>
    <p><b>Mercado Libre:</b> La Pichincha es parte del Programa de Afiliados de Mercado Libre. En las ofertas del día (la página /hoy/, el feed y el canal de Telegram) los enlaces a mercadolibre.com.ar llevan su código de afiliado y el rótulo «enlace de afiliado».</p>
  </section>
  ${pie}
</main>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

/* --- Spec 046: /contacto/, /acerca/ y /.well-known/security.txt --- */

/* Los mismos limites que valida el Worker (worker/src/index.js, LARGOS y MOTIVOS): un test exige que coincidan. */
const CONTACTO = { nombre: 80, correo: 254, mensajeMin: 10, mensaje: 4000, esperaMin: 3000 };
const MOTIVOS = [["consulta", "Una consulta"], ["error", "Un precio o dato mal"], ["tienda", "Soy de una tienda"],
  ["prensa", "Prensa"], ["otro", "Otro"]];

const ESTILO_CONTACTO = `<style>
.contacto form{max-width:36rem;margin-top:22px}
.contacto .campo{margin:0 0 18px}
.contacto label{display:block;font-weight:600;margin-bottom:6px}
.contacto .opc{font-weight:400;color:var(--ink-3);font-size:.86rem}
.contacto input,.contacto select,.contacto textarea{width:100%;box-sizing:border-box;font:400 1rem var(--font-sans);color:var(--ink);
  background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:11px 13px}
.contacto textarea{min-height:10rem;resize:vertical;line-height:1.5}
.contacto input:focus-visible,.contacto select:focus-visible,.contacto textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-color:var(--accent)}
.contacto [aria-invalid="true"]{border-color:var(--bad)}
.contacto .ayuda{display:block;font-size:.84rem;color:var(--ink-2);margin-top:5px}
.contacto .error{display:block;font-size:.88rem;color:var(--bad);margin-top:5px;font-weight:500}
.contacto .error:empty{display:none}
.contacto .trampa{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
.contacto button{font:600 1rem var(--font-sans);color:#fff;background:var(--accent);border:0;border-radius:10px;padding:12px 22px;cursor:pointer}
.contacto button[disabled]{opacity:.6;cursor:progress}
.contacto fieldset{border:0;margin:0;padding:0;min-width:0}
.contacto fieldset[disabled] button{cursor:not-allowed}
.contacto .estado{margin:18px 0 0;padding:12px 14px;border-radius:10px;max-width:36rem;line-height:1.5}
.contacto .estado:empty{display:none}
.contacto .estado.ok{background:var(--good-soft);color:var(--good)}
.contacto .estado.mal{background:var(--surface-2);color:var(--bad)}
.contacto .estado.enviando{background:var(--accent-soft);color:var(--accent)}
</style>`;

/* El envio. Sin JavaScript el formulario queda deshabilitado (fieldset disabled) y nada viaja en la URL: un form sin JS
   haria un GET con el mensaje y el correo a la vista. */
const SCRIPT_CONTACTO = `(function () {
  var form = document.getElementById("form-contacto"), caja = document.getElementById("campos");
  var estado = document.getElementById("estado"), boton = document.getElementById("enviar");
  var endpoint = form.getAttribute("data-endpoint"), inicio = Date.now();
  var L = { nombre: ${CONTACTO.nombre}, correo: ${CONTACTO.correo}, mensajeMin: ${CONTACTO.mensajeMin}, mensaje: ${CONTACTO.mensaje} };
  if (!endpoint || !window.fetch) {
    estado.className = "estado mal";
    estado.textContent = "El formulario de contacto no está disponible en este momento. Probá de nuevo más tarde.";
    return;
  }
  caja.disabled = false;
  function avisar(clase, texto) { estado.className = "estado " + clase; estado.textContent = texto; }
  function marcar(campo, texto) {
    var el = form.elements[campo], err = document.getElementById("error-" + campo);
    if (!el || !err) return;
    err.textContent = texto || "";
    if (texto) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
  }
  function revisar(d) {
    if (d.nombre.length > L.nombre) return ["nombre", "El nombre puede tener hasta " + L.nombre + " caracteres."];
    if (!d.correo) return ["correo", "Falta tu correo para poder responderte."];
    if (d.correo.length > L.correo || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(d.correo)) return ["correo", "Revisá el correo: no parece una dirección válida."];
    if (!d.motivo) return ["motivo", "Elegí un motivo."];
    if (d.mensaje.length < L.mensajeMin) return ["mensaje", "El mensaje es muy corto: escribí al menos " + L.mensajeMin + " caracteres."];
    if (d.mensaje.length > L.mensaje) return ["mensaje", "El mensaje puede tener hasta " + L.mensaje + " caracteres."];
    return null;
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var d = { nombre: form.elements.nombre.value.trim(), correo: form.elements.correo.value.trim(), motivo: form.elements.motivo.value,
      mensaje: form.elements.mensaje.value.trim(), sitio: form.elements.sitio.value, espera: Date.now() - inicio };
    ["nombre", "correo", "motivo", "mensaje"].forEach(function (c) { marcar(c, ""); });
    var mal = revisar(d);
    if (mal) { marcar(mal[0], mal[1]); avisar("mal", "Revisá el formulario: " + mal[1]); form.elements[mal[0]].focus(); return; }
    boton.disabled = true;
    form.setAttribute("aria-busy", "true");
    avisar("enviando", "Enviando el mensaje…");
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; }); })
      .then(function (x) {
        if (x.r.ok && x.j.ok) {
          form.reset();
          caja.disabled = true;
          avisar("ok", "¡Listo! Tu mensaje se envió. Te respondemos a tu correo, por lo general en unos días.");
          estado.focus();
          return;
        }
        if (x.j.campo) { marcar(x.j.campo, x.j.error); form.elements[x.j.campo] && form.elements[x.j.campo].focus(); }
        avisar("mal", x.j.error || "No se pudo enviar el mensaje. Probá de nuevo más tarde.");
      })
      .catch(function () { avisar("mal", "No se pudo conectar para enviar el mensaje. Revisá tu conexión y probá de nuevo."); })
      .then(function () { boton.disabled = false; form.removeAttribute("aria-busy"); });
  });
})();`;

/* endpoint: la direccion del Worker (sitio.json, afuera_url) + /contacto. Vacia: el formulario dice que no esta disponible. */
function renderContacto({ baseUrl = BASE_URL, workerUrl = SITIO.afuera_url } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const endpoint = workerUrl ? workerUrl.replace(/\/$/, "") + "/contacto" : "";
  const opciones = MOTIVOS.map(([v, t]) => `          <option value="${v}">${esc(t)}</option>`).join("\n");
  return cabeza({ titulo: "Contacto | La Pichincha",
    descripcion: "Escribile a La Pichincha: consultas, un precio mal, propuestas de tiendas o prensa. Te respondemos por correo.",
    canonica: `${base}/contacto/`, baseUrl: base, rel: "../" }).replace("</head>", ESTILO_CONTACTO + "\n</head>") + `
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap info contacto">
  <h1>Contacto</h1>
  <p class="sub">¿Viste un precio mal, querés sumar tu tienda o tenés una consulta? Escribinos acá y te respondemos a tu correo. Para avisar de un problema de seguridad del sitio, usá este mismo formulario con el motivo «Otro».</p>
  <noscript><p class="estado mal">Este formulario necesita JavaScript para enviarse. Activalo y recargá la página.</p></noscript>
  <form id="form-contacto" method="post" novalidate data-endpoint="${esc(endpoint)}" aria-describedby="nota-contacto">
    <fieldset id="campos" disabled>
      <legend class="trampa">Tu mensaje</legend>
      <div class="campo">
        <label for="nombre">Nombre <span class="opc">(opcional)</span></label>
        <input id="nombre" name="nombre" type="text" autocomplete="name" maxlength="${CONTACTO.nombre}" aria-describedby="error-nombre">
        <span class="error" id="error-nombre"></span>
      </div>
      <div class="campo">
        <label for="correo">Tu correo</label>
        <input id="correo" name="correo" type="email" autocomplete="email" inputmode="email" required aria-required="true" maxlength="${CONTACTO.correo}" aria-describedby="ayuda-correo error-correo">
        <span class="ayuda" id="ayuda-correo">Solo para responderte. No se publica.</span>
        <span class="error" id="error-correo"></span>
      </div>
      <div class="campo">
        <label for="motivo">Motivo</label>
        <select id="motivo" name="motivo" required aria-required="true" aria-describedby="error-motivo">
          <option value="">Elegí uno</option>
${opciones}
        </select>
        <span class="error" id="error-motivo"></span>
      </div>
      <div class="campo">
        <label for="mensaje">Mensaje</label>
        <textarea id="mensaje" name="mensaje" required aria-required="true" minlength="${CONTACTO.mensajeMin}" maxlength="${CONTACTO.mensaje}" aria-describedby="ayuda-mensaje error-mensaje"></textarea>
        <span class="ayuda" id="ayuda-mensaje">Entre ${CONTACTO.mensajeMin} y ${CONTACTO.mensaje.toLocaleString("es-AR")} caracteres. Si es por un precio, pegá el link del producto.</span>
        <span class="error" id="error-mensaje"></span>
      </div>
      <div class="trampa" aria-hidden="true">
        <label for="sitio">No completes este campo</label>
        <input id="sitio" name="sitio" type="text" tabindex="-1" autocomplete="off">
      </div>
      <button type="submit" id="enviar">Enviar mensaje</button>
    </fieldset>
  </form>
  <p class="estado" id="estado" role="status" aria-live="polite" tabindex="-1"></p>
  <p class="nota" id="nota-contacto">Lo que escribís se manda por correo a quien hace el sitio y no se guarda en ningún otro lado. Más en <a href="../legal/#contacto">privacidad</a>.</p>
  ${pie}
</main>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
<script>${SCRIPT_CONTACTO}</script>
</body>
</html>
`;
}

/* «Acerca de»: quien hace el sitio y como. Lo personal lo escribe el dueño: va marcado [COMPLETAR] y no se inventa. */
function renderAcerca({ baseUrl = BASE_URL } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  return cabeza({ titulo: "Acerca de | La Pichincha",
    descripcion: "Quién hace La Pichincha, cómo compara los precios de hardware en Argentina y cómo escribirnos.",
    canonica: `${base}/acerca/`, baseUrl: base, rel: "../" }) + `
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
<main id="contenido" class="wrap info">
  <h1>Acerca de La Pichincha</h1>
  <section>
    <h2 id="quien">Quién lo hace</h2>
    <p>La Pichincha es un proyecto independiente hecho en Argentina. No es una tienda ni pertenece a ninguna: no vende nada y no cobra por aparecer.</p>
    <p>[COMPLETAR: en dos o tres frases, quién hace el sitio y por qué lo armó.]</p>
  </section>
  <section>
    <h2 id="como">Cómo funciona</h2>
    <p>Todos los días se relevan los precios publicados por tiendas argentinas de hardware y se comparan producto por producto. Cada precio dice de qué tienda sale y cuándo se verificó; si una tienda no responde, se muestran sus precios anteriores con su fecha (ver <a href="../estado/">estado de las fuentes</a>).</p>
    <p>El orden de los resultados nunca depende de una comisión. Algunos enlaces son de afiliado y van rotulados: está explicado en <a href="../legal/#afiliados">términos, privacidad y afiliados</a>.</p>
  </section>
  <section>
    <h2 id="escribinos">Escribinos</h2>
    <p>Para consultas, un precio mal, sumar una tienda o prensa, usá el <a href="../contacto/">formulario de contacto</a>. Te respondemos a tu correo.</p>
  </section>
  ${pie}
</main>
<script src="../js/pagina.js"></script>
<script>${G.SCRIPT_MEDICION}</script>
</body>
</html>
`;
}

/* RFC 9116: Contact y Expires son obligatorios; Expires a un año de la corrida (cada publicacion lo renueva). */
function securityTxt({ baseUrl = BASE_URL, ahora = new Date() } = {}) {
  const base = baseUrl.replace(/\/$/, "");
  const vence = new Date(ahora.getTime() + 365 * 24 * 3600 * 1000);
  vence.setUTCHours(3, 0, 0, 0);
  return `Contact: ${base}/contacto/\nExpires: ${vence.toISOString().replace(/\.\d{3}Z$/, "Z")}\nPreferred-Languages: es, en\n` +
    `Canonical: ${base}/.well-known/security.txt\n`;
}

function main(argv) {
  const arg = (nombre, defecto) => { const i = argv.indexOf("--" + nombre); return i >= 0 ? argv[i + 1] : defecto; };
  const indicePath = arg("indice", path.join(__dirname, "indice.json"));
  const saludPath = arg("salud", path.join(__dirname, "salud.json"));
  const salida = arg("salida", path.join(__dirname, "_sitio"));
  const baseUrl = arg("base-url", BASE_URL);
  const escribir = (dir, html) => {
    fs.mkdirSync(path.join(salida, dir), { recursive: true });
    fs.writeFileSync(path.join(salida, dir, "index.html"), html, "utf8");
  };
  escribir("legal", renderLegal({ baseUrl }));
  escribir("contacto", renderContacto({ baseUrl }));
  escribir("acerca", renderAcerca({ baseUrl }));
  fs.mkdirSync(path.join(salida, ".well-known"), { recursive: true });
  fs.writeFileSync(path.join(salida, ".well-known", "security.txt"), securityTxt({ baseUrl }), "utf8");
  if (!fs.existsSync(indicePath)) { console.log("sin indice de precios: no se genera /estado/ (si /legal/, /contacto/, /acerca/ y security.txt)"); return 0; }
  const idx = JSON.parse(fs.readFileSync(indicePath, "utf8"));
  const salud = fs.existsSync(saludPath) ? JSON.parse(fs.readFileSync(saludPath, "utf8")) : null;
  let fiabilidad = null;                                   // opcional: sin ella (o rota) /estado/ sale sin esa seccion
  try { fiabilidad = JSON.parse(fs.readFileSync(arg("fiabilidad", path.join(__dirname, "fiabilidad.json")), "utf8")); } catch (_) { /* sin telemetria */ }
  escribir("estado", renderEstado(idx, salud, { baseUrl, fiabilidad }));
  console.log(`paginas de informacion: /legal/, /contacto/, /acerca/, security.txt y /estado/ (${Object.keys(idx.tiendas || {}).length} fuentes)`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { estadoFuentes, fiabilidadComercios, renderEstado, renderLegal, renderContacto, renderAcerca, securityTxt, main, ETIQUETAS, CONTACTO, MOTIVOS };
