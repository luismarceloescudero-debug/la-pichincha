/* --- Historial de busquedas: vive solo en este navegador --------------
   Cada entrada guarda, ademas del texto, la mejor compra de ese momento. Asi,
   cuando volves, se ve si el precio se movio desde la ultima vez. */
const TOPE_HIST = 8;
function leerHistCompleto() {
  try {
    const nuevo = JSON.parse(localStorage.getItem("hist2") || "null");
    if (Array.isArray(nuevo)) return nuevo.filter(x => x && typeof x.q === "string");
    const viejo = JSON.parse(localStorage.getItem("hist") || "[]");   // formato anterior: solo textos
    return viejo.filter(x => typeof x === "string").map(q => ({ q }));
  } catch (e) { return []; }
}
const leerHist = () => leerHistCompleto().map(h => h.q);
function escribirHist(h) { try { localStorage.setItem("hist2", JSON.stringify(h)); } catch (e) { /* sin storage no persiste */ } }

function guardarHist(q) {
  q = (q || "").trim();
  if (q.length < 2) return;
  const previo = leerHistCompleto();
  const ya = previo.find(x => x.q === q);
  const mejor = ANALISIS && CONSULTA === q ? ANALISIS.picks[0].m.f : null;
  const entrada = { ...(ya || {}), q, t: Date.now() };
  if (mejor) { entrada.p = mejor[1]; entrada.n = mejor[0].slice(0, 90); entrada.c = comercioDe(mejor); }
  escribirHist([entrada, ...previo.filter(x => x.q !== q)].slice(0, TOPE_HIST));
  pintarHist();
  pintarTira();
}
function olvidar(q) {
  escribirHist(leerHistCompleto().filter(x => x.q !== q));
  pintarHist();
  pintarTira();
}
function pintarHist() {
  const caja = $("#hist");
  if (!caja) return;
  const h = leerHist();
  caja.innerHTML = !h.length ? "" :
    `<span class="et">${icono("reloj")} tus búsquedas</span>` + h.map(q =>
      `<button class="hist" data-rep="${esc(q)}">${esc(q)}<span class="x" data-olvidar="${esc(q)}" title="Quitar">×</span></button>`).join("") +
    `<button class="hist" data-refrescar="1">${icono("refrescar")} actualizar precios</button>` +
    `<button class="hist borrar" data-borrar-hist>borrar búsquedas</button>`;
}

/* Precio de hoy de la mejor compra de una busqueda guardada. */
function fotoVivaDe(q) {
  if (!IDX) return null;
  if (CONSULTA === q && ANALISIS) { const f = ANALISIS.picks[0].m.f; return { p: f[1], n: f[0], c: comercioDe(f) }; }
  IDX._h = IDX._h || {};
  if (!(q in IDX._h)) {
    const A = analizarConsulta(q);
    IDX._h[q] = A ? { p: A.picks[0].m.f[1], n: A.picks[0].m.f[0], c: comercioDe(A.picks[0].m.f) } : null;
  }
  return IDX._h[q];
}

/* La tira de la pestaña Comparativa: tus ultimas busquedas. Las comparaciones curadas del primer relevamiento ya no van (spec 021). */
function tiraHtml(conPrecios) {
  const hist = leerHistCompleto();
  const buscadas = hist.map(h => {
    const vivo = conPrecios ? fotoVivaDe(h.q) : null;
    let delta = "";
    if (vivo && h.p && Math.abs(vivo.p / h.p - 1) >= 0.01) {
      const x = Math.round((vivo.p / h.p - 1) * 100);
      delta = `<span class="ult-d ${x < 0 ? "baja" : "sube"}">${x < 0 ? "▼" : "▲"} ${Math.abs(x)}% desde que lo viste</span>`;
    }
    const precio = vivo ? `<span class="ult-p">${pesos(vivo.p)}</span>` : h.p ? `<span class="ult-p tenue">${pesos(h.p)}</span>` : "";
    return `<button class="ult${CONSULTA === h.q ? " activa" : ""}" data-comparar="${esc(h.q)}">
      <span class="ult-q">${icono("lupa")} ${esc(h.q)}</span>${precio}${delta}
      <span class="ult-sub">${esc(((vivo && vivo.n) || h.n || "").slice(0, 38))}</span>
      <span class="ult-x" data-olvidar="${esc(h.q)}" title="Quitar">×</span></button>`;
  }).join("");
  if (!hist.length) return `<div class="ult-cab">${icono("reloj")} Tus búsquedas van a aparecer acá, con la comparativa y el precio de hoy.
    <button class="acc" data-ir-vista="buscar">${icono("lupa")} Buscar un producto</button></div>`;
  return `<div class="ult-cab">${icono("reloj")} Tus últimas búsquedas
    <button class="acc borrar-hist" data-borrar-hist>Borrar búsquedas</button></div>
    <div class="ult-fila">${buscadas}</div>`;
}
function pintarTira() {
  const c = $("#ultimas");
  if (c) c.innerHTML = tiraHtml(true);
}

/* ---- Lo reciente gobierna las pestañas (spec 021) ----
   Sin una consulta activa, la Comparativa termina con tu ultima busqueda y el Veredicto se escribe con ella. Sin historial,
   el Veredicto usa la primera de «Lo mas buscado» que tenga resultados. Hace falta el indice: sin el, no hay nada reciente. */
function consultaReciente() {
  if (!IDX) return "";
  const buscadas = typeof BUSCADAS !== "undefined" && Array.isArray(BUSCADAS) ? BUSCADAS : [];
  return [...leerHist(), ...buscadas].find(q => hayResultados(q)) || "";
}

/* La comparativa corta de tu ultima busqueda, al final de la portada: sus opciones y el boton a la completa. Se calcula
   aparte, sin fijar la consulta: mirar la portada no cambia las pestañas ni la URL. */
function recienteHtml(q) {
  const A = q ? analizarConsulta(q) : null;
  if (!A) return "";
  return `<div class="panel-head" style="margin-top:6px"><h2>${icono("balanza")} Tu última búsqueda: ${esc(q)}</h2>
      <p class="sub">De ${A.total} avisos, ${A.base.length} son comparables en ${A.comercios.length} comercio${A.comercios.length > 1 ? "s" : ""}. Precios de hoy.</p></div>
    <div class="dgrid">${A.picks.map(cardPick).join("")}</div>
    <p class="mas-reciente"><button class="acc" data-comparar="${esc(q)}">${icono("balanza")} Ver la comparativa completa, dónde comprar y el veredicto</button></p>`;
}
function pintarReciente() {
  const c = $("#reciente");
  if (!c) return;
  const q = !CONSULTA && IDX ? leerHist().find(x => hayResultados(x)) : "";   // en la portada, solo lo que buscaste vos
  c.innerHTML = q ? recienteHtml(q) : "";
}

/* El Veredicto sin consulta activa: espera el indice y se escribe con lo reciente. Si mientras tanto la persona busco otra
   cosa o se fue de la pestaña, no pisa nada. */
function abrirReciente(id) {
  const sigueAca = () => (location.hash.slice(1) || "comparativa") === id;
  asegurarIndice().then(() => {
    if (!(CONSULTA && ANALISIS)) {
      const q = consultaReciente();
      if (q) { fijarConsulta(q); RECIENTE_DE_BUSCADAS = !leerHist().includes(q); }
    }
    if (sigueAca()) $("#vista").innerHTML = CONSULTA && ANALISIS ? vistaDinamica(id) : veredictoVacio("");
  }).catch(() => { if (sigueAca()) $("#vista").innerHTML = veredictoVacio(""); });
}

/* ---- Borrar tus busquedas ----
   Un bicho cruza la fila y se las va comiendo; despues se borran. Cada vez sale otro. Con «reducir movimiento» se borran sin
   animacion. El torbellino es un homenaje al demonio de Tasmania, sin el personaje. */
const COMILONES = [
  { clase: "pacman", eti: "Pac-Man" },
  { clase: "torbellino", eti: "un torbellino" },
  { clase: "escoba", eti: "una escoba" },
];
const comilonDe = i => COMILONES[i % COMILONES.length];
const DURACION_COMILON = 1300;
let comilonesUsados = 0;

function borrarHistorial() {
  escribirHist([]);
  limpiarConsulta();
  pintarHist();
  pintarTira();
  pintarReciente();
}

function borrarConAnimacion(boton, despues) {
  const fin = () => { borrarHistorial(); if (despues) despues(); };
  const caja = boton.closest(".ultimas, .historial");
  const quieto = !caja || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (quieto) return fin();
  const c = comilonDe(comilonesUsados++), ancho = caja.clientWidth, base = caja.getBoundingClientRect().left;
  const bicho = document.createElement("span");
  bicho.className = "comilon " + c.clase;
  bicho.setAttribute("aria-hidden", "true");
  bicho.style.setProperty("--hasta", ancho + "px");
  bicho.style.setProperty("--dur", DURACION_COMILON + "ms");
  // cada boton desaparece cuando el bicho pasa por encima
  caja.querySelectorAll(".ult, .hist, [data-borrar-hist]").forEach(el => {
    const x = (el.getBoundingClientRect().left - base + 34) / (ancho + 34);
    el.style.setProperty("--d", Math.round(Math.max(0, Math.min(1, x)) * DURACION_COMILON) + "ms");
    el.classList.add("comida");
  });
  boton.disabled = true;
  caja.classList.add("comiendo");
  caja.appendChild(bicho);
  void caja.offsetWidth;          // fija el estado inicial para que la transicion arranque aunque no haya un cuadro de por medio
  caja.querySelectorAll(".comida").forEach(el => el.classList.add("comido"));
  setTimeout(() => { caja.classList.remove("comiendo"); fin(); }, DURACION_COMILON + 150);
}
/* Abre la comparativa de una busqueda guardada sin pasar por el buscador. `referencia` (opcional): la fila de la tarjeta
   desde la que se compara; la comparativa queda con sus mismas especificaciones (spec 017). */
async function compararConsulta(q, referencia = null) {
  try { await asegurarIndice(); } catch (e) { return; }
  fijarConsulta(q, referencia);
  if (!ANALISIS) return;
  guardarHist(q);
  registrarBusqueda(q);
  ir("comparativa", true);
}

/* «Comparar» desde una fila de la lista de Buscar (o de la portada): esa fila es la tarjeta de referencia y la comparativa
   queda con sus mismas especificaciones. Se busca por la URL del aviso, que es lo unico que lleva el boton. */
async function compararFila(url) {
  try { await asegurarIndice(); } catch (e) { return; }
  const f = IDX.productos.find(p => p[2] === url);
  if (f) return compararConsulta(Buscador.consultaDeOferta(f[0], hayResultados), f);
}
