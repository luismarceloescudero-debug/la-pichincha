/* --- Analitica: GoatCounter, sin cookies ni banner ------------------------
   El script es async: lo que se mide antes de que cargue espera en una cola.
   Si un bloqueador lo frena, los eventos se pierden sin romper nada. */
const COLA_GC = [];
function vaciarCola() {
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== "function") return;
  while (COLA_GC.length) { try { gc.count(COLA_GC.shift()); } catch (e) { /* no frena la pagina */ } }
}
function medir(ev) { if (ev) { COLA_GC.push(ev); vaciarCola(); } }
(() => { const s = document.getElementById("gc"); if (s) s.addEventListener("load", vaciarCola); })();

/* Una busqueda cuenta cuando se asienta, no por cada tecla. */
let ULTIMO_MEDIDO = "";
function registrarBusqueda(q) {
  const t = normalBusq(q || "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || t === ULTIMO_MEDIDO || !IDX) return;
  ULTIMO_MEDIDO = t;
  medir(Pagina.eventoBusqueda(t, buscarTodo(q).length));
}

/* Clic hacia una tienda: el comercio sale del dominio y el rubro del producto,
   buscado por URL en el indice o en los curados. */
let RUBROS = null;
function rubroDeUrl(url) {
  if (!RUBROS || RUBROS.idx !== IDX) {
    const m = new Map();
    P.forEach(p => m.set(p.url, /^ram/.test(p.tipo) ? "memoria" : /^webcam/.test(p.tipo) ? "webcam" : "otro"));
    if (IDX) IDX.productos.forEach(f => { if (!m.has(f[2])) m.set(f[2], categoriaDe(f[0]) || "otro"); });
    RUBROS = { idx: IDX, m };
  }
  return RUBROS.m.get(url) || "otro";
}
function alClicSaliente(ev) {
  if (ev.type === "auxclick" && ev.button !== 1) return;
  const a = ev.target.closest && ev.target.closest("a[href]");
  if (!a || !/^https?:$/.test(a.protocol) || a.host === location.host) return;
  medir(Pagina.eventoClic(a.href, rubroDeUrl(a.getAttribute("href"))));
}
document.addEventListener("click", alClicSaliente, true);
document.addEventListener("auxclick", alClicSaliente, true);

/* Abrir un link con ?q=: se baja el indice, se arma la consulta y se muestra
   la pestaña del link. Sin resultados va al buscador con el termino escrito. */
async function abrirConsultaDeUrl(q, vista) {
  $("#vista").innerHTML = `<p class="sub">Armando la comparación de «${esc(q)}»…</p>`;
  try { await asegurarIndice(); } catch (e) { return aplicar(vista); }
  fijarConsulta(q);
  registrarBusqueda(q);
  // Se pinta ya y se reemplaza la entrada del historial en lugar de sumar una:
  // Atras vuelve a donde estaba la persona antes de abrir el link.
  const destino = ANALISIS ? (vista || "comparativa") : "buscar";
  try { history.replaceState(history.state, "", Pagina.armarUrl(location.pathname, CONSULTA, destino)); } catch (e) {}
  aplicar(destino);
  if (ANALISIS) guardarHist(q);
  else consultar(q);              // sin resultados: el buscador lo dice, con el termino escrito
}

/* Atras y Adelante pueden cambiar la consulta, no solo la pestaña. popstate y
   hashchange llegan juntos: se atiende una vez. */
let navegando = false;
function alNavegar() {
  if (navegando) return;
  navegando = true;
  setTimeout(async () => {
    navegando = false;
    const { q, vista } = Pagina.leerUrl(location.search, location.hash);
    if (q !== CONSULTA) {
      if (!q) limpiarConsulta();
      else { try { await asegurarIndice(); fijarConsulta(q); } catch (e) { /* queda el curado */ } }
    }
    aplicar(vista);
  }, 0);
}
