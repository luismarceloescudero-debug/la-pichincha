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
    `<button class="hist" data-refrescar="1">${icono("refrescar")} actualizar precios</button>`;
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

/* La tira de la pestaña Comparativa: las curadas y tus ultimas busquedas. */
function tiraHtml(conPrecios) {
  const hist = leerHistCompleto();
  const curadas = CATEGORIAS.map(c =>
    `<button class="ult curada${!CONSULTA && c.id === CAT ? " activa" : ""}" data-cat="${c.id}">
      <span class="ult-q">${icono(c.ico)} ${esc(c.eti)}</span><span class="ult-sub">análisis a fondo</span></button>`).join("");
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
  return `<div class="ult-cab">${icono("reloj")} ${hist.length ? "Comparaciones: curadas y tus últimas búsquedas" : "Comparaciones curadas. Tus búsquedas van a aparecer acá"}</div>
    <div class="ult-fila">${curadas}${buscadas}</div>`;
}
function pintarTira() {
  const c = $("#ultimas");
  if (c) c.innerHTML = tiraHtml(true);
}
/* Abre la comparativa de una busqueda guardada sin pasar por el buscador. */
async function compararConsulta(q) {
  try { await asegurarIndice(); } catch (e) { return; }
  fijarConsulta(q);
  if (!ANALISIS) return;
  guardarHist(q);
  registrarBusqueda(q);
  ir("comparativa", true);
}
