/* Pegamento del grafico de historial (plan v2, D2) con la pagina: el boton de cada aviso, la descarga del fragmento de
   la serie (series/NN.json, una sola vez) y el panel. Todo lo que dibuja vive en js/serie-precios.js, que es puro. */
const FRAGMENTOS_SERIE = new Map();     // nombre del fragmento -> promesa del JSON (o null si no se pudo)
const ESTADO_HIST = new WeakMap();      // caja del panel -> { h, rango }

/* El boton y la caja del panel de un aviso (fila del indice). Sin `desde` el indice no tiene historia de ese aviso: no hay boton. */
function historialHtml(f) {
  if (!f || !f[10]) return "";
  return `<div class="hp"><button type="button" class="acc hp-abrir" data-hp-tienda="${esc(f[3])}" data-hp-url="${esc(f[2])}" aria-expanded="false">`
    + `${icono("reloj")} Historial de precio</button><div class="hp-cuerpo" hidden></div></div>`;
}

function pedirFragmento(nombre) {
  if (!FRAGMENTOS_SERIE.has(nombre)) {
    FRAGMENTOS_SERIE.set(nombre, fetch(nombre, { cache: "no-cache" })
      .then(r => (r.ok ? r.json() : r.status === 404 ? {} : Promise.reject(new Error("HTTP " + r.status))))
      .catch(() => { FRAGMENTOS_SERIE.delete(nombre); return null; }));
  }
  return FRAGMENTOS_SERIE.get(nombre);
}

function pintarHistorial(caja) {
  const e = ESTADO_HIST.get(caja);
  caja.innerHTML = SeriePrecios.panelHtml(e.h, e.rango, {});
}

async function abrirHistorial(boton) {
  const caja = boton.parentElement.querySelector(".hp-cuerpo");
  if (!caja.hidden) { caja.hidden = true; boton.setAttribute("aria-expanded", "false"); return; }
  boton.setAttribute("aria-expanded", "true");
  caja.hidden = false;
  if (ESTADO_HIST.has(caja)) return;
  caja.innerHTML = '<p class="hp-vacio" role="status">Cargando el historial…</p>';
  const tienda = boton.dataset.hpTienda, url = boton.dataset.hpUrl;
  const frag = await pedirFragmento(SeriePrecios.nombreFragmento(SeriePrecios.fragmento(tienda, url)));
  if (frag === null) { caja.innerHTML = SeriePrecios.panelError(); return; }
  ESTADO_HIST.set(caja, { h: SeriePrecios.leer(frag, tienda, url), rango: "todo" });
  pintarHistorial(caja);
}

document.addEventListener("click", ev => {
  const abrir = ev.target.closest && ev.target.closest(".hp-abrir");
  if (abrir) { ev.stopPropagation(); abrirHistorial(abrir); return; }
  const rango = ev.target.closest && ev.target.closest("[data-hp-rango]");
  if (rango) {
    const caja = rango.closest(".hp-cuerpo");
    const e = ESTADO_HIST.get(caja);
    if (!e) return;
    e.rango = rango.dataset.hpRango === "todo" ? "todo" : Number(rango.dataset.hpRango);
    pintarHistorial(caja);
    const otro = caja.querySelector(`[data-hp-rango="${rango.dataset.hpRango}"]`);
    if (otro) otro.focus();
  }
}, true);
