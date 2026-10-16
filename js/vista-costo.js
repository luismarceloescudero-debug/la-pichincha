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
  return `<div class="panel"><div class="panel-head"><h2>Costo de importar</h2>
    <p class="sub">Cuánto pagás de verdad por algo comprado afuera y traído por courier o por Correo: impuestos renglón por renglón,
      con la norma de cada uno y lo que todavía no se sabe.</p></div>
    <div class="k-grid">
      ${Calculadora.formularioHtml(estado, { esc, tiposDolar: Monedas.TIPOS_DOLAR })}
      <section class="k-salida" aria-labelledby="k-titulo">
        <h3 id="k-titulo">Resultado</h3>
        <div id="k-resultado" aria-live="polite"><p class="sub">Cargando las reglas y las cotizaciones…</p></div>
        <div class="acciones"><button type="button" class="acc" id="k-compartir">${icono("compartir")} Copiar el enlace de esta cuenta</button></div>
        <p class="sub chico" id="k-fuentes"></p>
      </section>
    </div></div>`;
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
  salida.innerHTML = Calculadora.resultadoHtml(res, { esc, aPesos, dolarNombre: tipo ? tipo.nombre : estado.dolar, estado });
  $("#k-fuentes", raiz).textContent = fuentesTexto(estado);
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

function activarCosto(raiz) {
  const form = $("#k-form", raiz);
  if (!form) return;
  form.addEventListener("input", () => recalcularCosto(raiz));
  form.addEventListener("change", () => recalcularCosto(raiz));
  form.addEventListener("submit", ev => ev.preventDefault());
  $("#k-compartir", raiz).addEventListener("click", ev => compartirCosto(ev.currentTarget));
  cargarCosto().then(() => recalcularCosto(raiz));
}
