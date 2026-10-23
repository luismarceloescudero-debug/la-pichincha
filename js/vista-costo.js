/* --- Pestaña «Costo de importar» (K3): el formulario, el desglose y el enlace para compartir ---------
   La cuenta la hace js/costos.js con las reglas de importacion.json; las cotizaciones, js/monedas.js
   (en vivo, o la copia del build cotizaciones.json si no hay red). Lo puro vive en js/calculadora.js. */
const COSTO = { listo: false, reglas: null, tasas: null, origen: null, avisos: [], carga: null, medido: "", temporizador: null };

/* Reglas y cotizaciones se piden una sola vez, cuando se abre la pestaña. */
function cargarCosto() {
  if (COSTO.carga) return COSTO.carga;
  const json = url => fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null);
  COSTO.carga = Promise.all([json("importacion.json"), json("cotizaciones.json")]).then(async ([reglas, copia]) => {
    COSTO.reglas = reglas && reglas.reglas ? reglas : null;
    const c = await Monedas.cotizar({ fetch: url => fetch(url), snapshot: copia });
    COSTO.tasas = c.origen === "sin_datos" ? null : c.tasas;
    COSTO.origen = c.origen;
    COSTO.avisos = c.avisos;
    COSTO.listo = true;
  });
  return COSTO.carga;
}

function vistaCosto() {
  const estado = Calculadora.estadoDeUrl(location.search);
  return `<div class="panel"><div class="k-hero">
      <span class="k-hero-ico" aria-hidden="true">${icono("calc")}</span>
      <div><h2>Costo de importar</h2>
        <p class="sub">Cuánto pagás de verdad por algo comprado afuera y traído por courier o por Correo: impuestos renglón por renglón,
          con la norma de cada uno y lo que todavía no se sabe.</p>
        <ol class="k-pasos">
          <li><a href="#k-sec-1" data-k-ir="k-sec-1"><span>1</span> Lo que comprás</a></li>
          <li><a href="#k-sec-2" data-k-ir="k-sec-2"><span>2</span> Tu situación</a></li>
          <li><a href="#k-sec-3" data-k-ir="k-sec-3"><span>3</span> Lo que no publica ARCA</a></li>
        </ol></div></div>
    <section class="k-link" aria-labelledby="k-link-tit">
      <h3 id="k-link-tit">¿Ya lo encontraste afuera? Pegá el link</h3>
      <div class="k-campo"><label for="k-link">Link del producto en Amazon, Tiendamia, Loquieroacá o eBay</label>
        <input id="k-link" type="url" inputmode="url" autocomplete="off" spellcheck="false" placeholder="https://www.amazon.com/…/dp/B0…" aria-describedby="k-link-ayuda">
        <small id="k-link-ayuda">De Tiendamia y Loquieroacá leemos el precio de la página que pegás; de Amazon y eBay, solo por su API cuando esté activa. Si no, lo escribís vos, y siempre lo podés cambiar.</small></div>
      <div id="k-link-res" aria-live="polite"></div>
    </section>
    <div class="k-grid">
      ${Calculadora.formularioHtml(estado, { esc, tiposDolar: Monedas.TIPOS_DOLAR, icono })}
      <section class="k-salida" aria-labelledby="k-titulo">
        <h3 id="k-titulo">Resultado</h3>
        <div id="k-resultado" aria-live="polite"><p class="sub">Cargando las reglas y las cotizaciones…</p></div>
        <div class="acciones"><button type="button" class="acc" id="k-compartir">${icono("compartir")} Copiar el enlace de esta cuenta</button></div>
        <p class="sub chico" id="k-fuentes"></p>
      </section>
    </div>
    <section class="panel k-importando" aria-labelledby="k-imp-titulo">
      <h3 id="k-imp-titulo">Importando: dónde comprar afuera</h3>
      <p class="sub">Enlaces a cada tienda. Si pegás arriba el link de un producto, leemos su precio cuando la tienda lo permite (Tiendamia y Loquieroacá); si no, lo escribís vos y acá se calcula el costo final.</p>
      <ul class="k-fuentes-lista">
        ${Importar.FUENTES.map(f => `<li><a href="${esc(Importar.enlaceFuente(f))}" target="_blank" rel="${f.afiliado ? "sponsored noopener" : "noopener"}">${esc(f.nombre)}</a>
          ${f.afiliado ? '<small class="chico">(enlace de afiliado)</small>' : ""}
          <span class="sub chico">${esc(f.texto)}</span></li>`).join("")}
      </ul>
    </section></div>`;
}

const leerFormulario = form => Calculadora.estadoDeFormulario(nombre => (form.elements[nombre] || {}).value);

function fuentesTexto(estado) {
  const partes = [];
  const v = Calculadora.vigencia(COSTO.reglas, new Date().toISOString());
  if (v.verificado) {
    partes.push(`Reglas verificadas en el Boletín Oficial y en ARCA el ${v.verificado.split("-").reverse().join("/")}` +
      (v.vieja ? ` — hace ${v.dias} días: pueden haber cambiado, confirmá antes de pagar.` : "."));
  }
  const d = COSTO.tasas && COSTO.tasas.dolares[estado.dolar];
  if (d) {
    const edad = d.actualizado ? Monedas.antiguedad(d.actualizado, new Date().toISOString()) : null;
    partes.push(`Dólar ${estado.dolar} ${Calculadora.ars(d.venta)} (venta, dolarapi.com${edad ? ", " + edad.texto : ""}).`);
  }
  for (const a of COSTO.avisos) partes.push(a.texto);
  return partes.join(" ");
}

function recalcularCosto(raiz) {
  const form = $("#k-form", raiz), salida = $("#k-resultado", raiz);
  if (!form || !salida) return;
  const estado = leerFormulario(form);
  form.querySelectorAll(".k-error").forEach(e => { e.textContent = ""; });
  form.querySelectorAll("[aria-invalid]").forEach(e => e.removeAttribute("aria-invalid"));
  try { history.replaceState(history.state, "", Calculadora.urlDeEstado(location.pathname, estado)); } catch (e) { /* sin history */ }
  if (!COSTO.reglas) {
    salida.innerHTML = COSTO.listo
      ? '<p class="sub" role="alert">No pude cargar las reglas de importación. Probá recargar la página.</p>'
      : '<p class="sub">Cargando las reglas y las cotizaciones…</p>';
    return;
  }
  $("#k-fuentes", raiz).textContent = fuentesTexto(estado);   // de donde salen las reglas y el dolar, aun sin precio escrito
  const { entrada, errores } = Calculadora.entradaDe(estado, COSTO.tasas, Monedas.convertir);
  if (errores.length) {
    for (const e of errores) {
      const campo = form.elements[e.campo], aviso = $(`#k-${e.campo}-error`, form);
      if (aviso) aviso.textContent = e.texto;
      if (campo && estado[e.campo] !== "") campo.setAttribute("aria-invalid", "true");
    }
    salida.innerHTML = `<p class="sub">${esc(errores[0].texto)}</p>`;
    return;
  }
  const res = Costos.calcular(entrada, COSTO.reglas);
  const aPesos = usd => {
    try { return COSTO.tasas ? Monedas.convertir(usd, "USD", "ARS", COSTO.tasas, { tipoDolar: estado.dolar }).monto : null; }
    catch (e) { return null; }
  };
  const tipo = Monedas.TIPOS_DOLAR.find(t => t.id === estado.dolar);
  const antes = ($("#k-total .k-total-v", raiz) || {}).textContent;
  salida.innerHTML = Calculadora.resultadoHtml(res, { esc, aPesos, dolarNombre: tipo ? tipo.nombre : estado.dolar, estado, icono });
  // El total es lo unico que se anima al cambiar: un pulso corto que marca que la cuenta se rehizo.
  const total = $("#k-total", raiz);
  if (total && antes !== undefined && antes !== ($(".k-total-v", total) || {}).textContent) total.classList.add("k-cambio");
  form.querySelectorAll(".k-prefijo").forEach(p => { p.textContent = estado.moneda; });
  // Se mide cuando la cuenta se asienta, no por cada tecla.
  clearTimeout(COSTO.temporizador);
  COSTO.temporizador = setTimeout(() => {
    const ev = Calculadora.eventoCalculo(res);
    if (ev && ev.path + ev.title !== COSTO.medido) { COSTO.medido = ev.path + ev.title; medir(ev); }
  }, 1500);
}

async function compartirCosto(boton) {
  const url = location.origin + Calculadora.urlDeEstado(location.pathname, leerFormulario($("#k-form")));
  const previo = boton.innerHTML;
  try {
    await navigator.clipboard.writeText(url);
    boton.textContent = "Enlace copiado";
  } catch (e) {
    boton.textContent = "Copiá la dirección de la barra: ya tiene la cuenta";
  }
  medir(Pagina.eventoAccion("copiar", "costo"));
  setTimeout(() => { boton.innerHTML = previo; }, 2500);
}

/* --- Pegar un link (spec 020): js/importar.js reconoce la tienda y el producto; aca se muestra y se precarga la calculadora --- */
function fichaEnlace(e) {
  const d = Importar.datosDeEnlace(e);
  const abrir = `<a class="acc" href="${esc(d.abrir)}" target="_blank" rel="${d.afiliado ? "sponsored noopener" : "noopener"}">${icono("fuera")} Abrir en ${esc(d.tiendaNombre)}</a>`
    + (d.afiliado ? ' <span class="rotulo">enlace de afiliado · <a href="legal/#afiliados">qué es</a></span>' : "")
    + (d.mismoEnAmazon ? ` <a class="acc" href="${esc(d.mismoEnAmazon)}" target="_blank" rel="sponsored noopener">El mismo en Amazon</a> <span class="rotulo">enlace de afiliado</span>` : "");
  const precio = !d.calcula ? "" : `<div class="k-campo"><label for="k-link-precio">Precio que ves en la página (${esc(d.moneda)})</label>
      <div class="k-entrada con-prefijo"><span class="k-prefijo" aria-hidden="true">${esc(d.moneda)}</span><input id="k-link-precio" type="text" inputmode="decimal" autocomplete="off" aria-describedby="k-link-precio-ayuda"></div>
      <small id="k-link-precio-ayuda">${esc(d.ayuda)}</small></div>`;
  return `<div class="k-link-ficha">
      <p><b>${esc(d.tiendaNombre)}</b>${e.id ? ` · código ${esc(e.id)}` : " · link corto: abrilo para ver el producto"}${e.nombre ? `<br><span class="sub">«${esc(e.nombre)}»</span>` : ""}</p>
      <p class="k-link-acciones">${abrir}</p>
      <p class="sub chico k-link-leido" id="k-link-leido" aria-live="polite"></p>
      ${precio || `<p class="sub chico">${esc(d.ayuda)}</p>`}</div>`;
}

/* Pisa en el formulario solo los campos que el link decide (moneda, donde se cobra, el envio en Tiendamia) y el precio cuando hay. */
function aplicarEnlace(raiz, e, precio) {
  const form = $("#k-form", raiz), estado = Importar.estadoDeEnlace(e, precio);
  if (!form || !estado) return;
  for (const campo of Importar.datosDeEnlace(e).pisar) {
    if (campo === "valor" && !estado.valor) continue;
    if (form.elements[campo]) form.elements[campo].value = estado[campo];
  }
  recalcularCosto(raiz);
}

/* Spec 023: el Worker lee la pagina pegada (ficha de Tiendamia o de Loquieroaca) o el producto por su API (Amazon, eBay). Un pedido
   por link y por sesion; lo leido precarga el precio, que se puede cambiar. Si falla o no hay Worker, se escribe a mano como antes. */
const ENLACES = new Map();      // url de /enlace -> promesa de la respuesta
let ENLACE_TURNO = 0, ENLACE_ESPERA = null;
function pedirPrecioEnlace(raiz, e) {
  const turno = ++ENLACE_TURNO, url = Importar.urlLeerEnlace(AFUERA_URL, e.url), linea = $("#k-link-leido", raiz);
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
      const l = Importar.leidoDeEnlace(r), precio = $("#k-link-precio", raiz);
      linea.textContent = l ? (l.nombre && !e.nombre ? `«${l.nombre}» · ` : "") + l.linea : "";   // el nombre, si el link no lo traia
      if (l && l.precio && precio && !precio.dataset.tocado) { precio.value = l.precio; aplicarEnlace(raiz, e, l.precio); }
    });
  }, 400);
}

function leerEnlace(raiz, texto) {
  const res = $("#k-link-res", raiz), e = Importar.parsearEnlace(texto);
  if (!texto.trim()) { res.innerHTML = ""; return; }
  if (!e) {
    res.innerHTML = '<p class="sub chico">No reconozco ese link. Por ahora leo los de Amazon, Tiendamia, Loquieroacá y eBay: escribí el precio abajo, en «Precio del producto».</p>';
    return;
  }
  res.innerHTML = fichaEnlace(e);
  aplicarEnlace(raiz, e, "");
  pedirPrecioEnlace(raiz, e);
  const precio = $("#k-link-precio", res), valor = ($("#k-form", raiz) || { elements: {} }).elements.valor;
  if (!precio) return;
  if (valor) precio.value = valor.value;    // el precio que ya estaba en la calculadora, para que los dos campos digan lo mismo
  precio.addEventListener("input", () => { precio.dataset.tocado = "1"; aplicarEnlace(raiz, e, precio.value); });
}

function activarCosto(raiz) {
  const form = $("#k-form", raiz);
  if (!form) return;
  form.addEventListener("input", () => recalcularCosto(raiz));
  form.addEventListener("change", () => recalcularCosto(raiz));
  form.addEventListener("submit", ev => ev.preventDefault());
  // Los pasos del encabezado llevan a su seccion sin tocar el hash, que es la pestaña.
  raiz.querySelectorAll("[data-k-ir]").forEach(a => a.addEventListener("click", ev => {
    ev.preventDefault();
    const destino = document.getElementById(a.dataset.kIr);
    destino.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    const primero = destino.querySelector("input, select");
    if (primero) primero.focus({ preventScroll: true });
  }));
  $("#k-compartir", raiz).addEventListener("click", ev => compartirCosto(ev.currentTarget));
  const link = $("#k-link", raiz);
  if (link) link.addEventListener("input", () => leerEnlace(raiz, link.value));
  cargarCosto().then(() => recalcularCosto(raiz));
}
