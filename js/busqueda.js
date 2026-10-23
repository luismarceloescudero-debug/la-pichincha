/* --- Que tan reconocida es la marca ------------------------------------
   Es juicio editorial y esta en datos.json, no en el indice: ninguna tienda
   publica esto. Lo que no esta en la lista no se castiga, solo no se destaca. */
const MARCAS = DATOS.marcas || { primera: [], conocida: [] };
const nivelMarca = Buscador.crearNivelMarca(MARCAS);

/* Tres modos (Recomendacion, Super Oferta, Primera Linea) y, dentro de cada uno, un orden: Precio (de mayor a menor),
   Novedades o Premium. La logica vive en js/modos.js (spec 013). Lo guardado por la version anterior
   ("recomendado", "precio", "marca") se trata como Recomendacion. */
const guardado = clave => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
let ORDEN = Modos.migrarModo(guardado("orden"));
let ORDEN2 = Modos.migrarSecundario(guardado("orden2"));

/* Lo que se calcula una vez por indice cargado: las generaciones, la gama de cada titulo y (recien si hace falta) las ofertas. */
let CTX_MODOS = null;
/* Ganadores en pruebas reales (datos/ganadores.json, lo arma otra sesion): se piden una vez, al abrir la busqueda. Sin el archivo
   (o sin red) no cambia nada. Cuando llegan, el contexto se rearma y se vuelve a pintar. */
let GANADORES = null, pidiendoGanadores = null;
function cargarGanadores() {
  if (!pidiendoGanadores) pidiendoGanadores = fetch("datos/ganadores.json").then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => { GANADORES = j && j.ganadores ? j : null; return GANADORES; });
  return pidiendoGanadores;
}
function ctxModos() {
  if (!CTX_MODOS || CTX_MODOS.idx !== IDX || CTX_MODOS.ganadores !== GANADORES)
    CTX_MODOS = { idx: IDX, ganadores: GANADORES, ctx: Modos.preparar(IDX, nivelMarca, () => OFERTAS, GANADORES) };
  return CTX_MODOS.ctx;
}

function ordenesHtml() {
  return `<div class="orden" role="group" aria-label="Qué mostrar">
      <div class="segmentos chico">${Modos.MODOS.map(o =>
        `<button class="seg" data-orden="${o.id}" aria-selected="${o.id === ORDEN}" title="${esc(o.ayuda)}">${esc(o.eti)}</button>`).join("")}</div>
    </div>
    <p class="sub chico" id="nota-modo" aria-live="polite"></p>
    <div class="orden2" role="group" aria-label="Ordenar por"><span class="of-et" aria-hidden="true">Ordenar por</span>
      <div class="segmentos chico">${Modos.SECUNDARIOS.map(o =>
        `<button class="seg" data-orden2="${o.id}" aria-selected="${o.id === ORDEN2}">${esc(o.eti)}</button>`).join("")}</div>
    </div>`;
}

/* Elige un modo y/o un orden: lo guarda en el navegador, marca los botones y vuelve a pintar la lista. */
function elegirOrden(modo, secundario) {
  if (modo) ORDEN = Modos.migrarModo(modo);
  if (secundario) ORDEN2 = Modos.migrarSecundario(secundario);
  try { if (modo) localStorage.setItem("orden", ORDEN); if (secundario) localStorage.setItem("orden2", ORDEN2); } catch (e) {}
  document.querySelectorAll("[data-orden]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.orden === ORDEN)));
  document.querySelectorAll("[data-orden2]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.orden2 === ORDEN2)));
  pintarResultados(($("#q") || {}).value || "");
}

/* Un modo sin resultados no deja la pantalla vacia: dice por que y ofrece los que si tienen. */
function vacioHtml(cuentas) {
  const v = Modos.textoVacio(ORDEN, cuentas);
  const otros = v.otros.map(m => `<button class="acc" data-orden="${m.id}">${esc(m.eti)} (${cuentas[m.id]})</button>`).join(" o ");
  return `<p class="sub">${esc(v.texto)} ${otros ? `Probá con ${otros}` : "Probá con otra búsqueda o menos filtros."}</p>`;
}

/* El mismo modelo (mismo codigo exacto) en varias tiendas es UN producto: queda su fila mas barata y
   OTRAS dice, por fila, las demas tiendas. Asi la mediana y el conteo cuentan cada producto una vez. */
let OTRAS = new Map();
const avisosDe = filas => filas.reduce((n, f) => n + 1 + (OTRAS.get(f) || []).length, 0);

/* --- Filtros de la lista (B4) -------------------------------------------
   Acotan lo que se ve: la mediana, el orden y la Comparativa se calculan con todos los avisos. Viven mientras
   la pagina esta abierta y no se guardan. La logica es pura y esta en js/buscador.js. */
let FILTROS = Buscador.filtrosVacios();
const numeroDe = txt => { const n = parseInt(String(txt).replace(/\D/g, ""), 10); return Number.isFinite(n) ? n : null; };

function filtrosHtml() {
  const tiendas = Object.entries((IDX || {}).tiendas || {}).map(([k, t]) =>
    `<button class="of-chip" data-filtro="tienda" data-valor="${esc(k)}" aria-pressed="${FILTROS.tiendas.includes(k)}">${esc(t.nombre)}</button>`).join("");
  return `<div class="of-fila" role="group" aria-label="Tienda"><span class="of-et" aria-hidden="true">Tienda</span>${tiendas || '<span class="sub">cargando…</span>'}</div>
    <div class="of-fila"><span class="of-et" aria-hidden="true">Precio</span>
      <label class="f-campo">Desde $ <input id="f-min" type="text" inputmode="numeric" autocomplete="off" placeholder="sin mínimo"></label>
      <label class="f-campo">Hasta $ <input id="f-max" type="text" inputmode="numeric" autocomplete="off" placeholder="sin máximo"></label></div>
    <div class="of-fila"><span class="of-et" aria-hidden="true">Gama</span>
      <button class="of-chip" data-filtro="primera" aria-pressed="${FILTROS.primera}" title="Lo más premium por especificaciones y tecnología, sin mirar la marca">${icono("trofeo")} Solo premium</button></div>
    <div class="of-fila" role="group" aria-label="Sellos"><span class="of-et" aria-hidden="true">Sellos</span>
      ${[["e", "Envío gratis"], ["s", "Cuotas sin interés"], ["o", "Tienda oficial"]].map(([l, t]) =>
        `<button class="of-chip" data-filtro="sello" data-valor="${l}" aria-pressed="${FILTROS.sellos.includes(l)}">${t}</button>`).join("")}
      <span class="sub chico">Solo ComparaYa y sus comercios informan envío y cuotas: un aviso sin sello no quiere decir que no lo tenga.</span></div>
    <div class="of-fila"><label class="of-et" for="f-excluir">Excluir</label>
      <input id="f-excluir" class="f-texto" type="text" autocomplete="off" spellcheck="false" placeholder="palabras separadas por coma: kit, usado, simil"></div>
    <div class="of-fila"><button class="acc" data-filtro="quitar">Quitar filtros</button></div>`;
}

/* Refleja FILTROS en los controles (si estan en pantalla) sin volver a armar el panel: asi no se pierde el foco. */
function sincronizarFiltros() {
  const caja = $("#filtros");
  if (!caja) return;
  caja.querySelectorAll('[data-filtro="tienda"]').forEach(b => b.setAttribute("aria-pressed", String(FILTROS.tiendas.includes(b.dataset.valor))));
  [...caja.querySelectorAll('[data-filtro="sello"]')].filter(b => b.dataset.filtro === "sello").forEach(b => b.setAttribute("aria-pressed", String(FILTROS.sellos.includes(b.dataset.valor))));
  const pr = caja.querySelector('[data-filtro="primera"]');
  if (pr) pr.setAttribute("aria-pressed", String(FILTROS.primera));
  const pone = (id, v) => { const c = $(id); if (c && document.activeElement !== c) c.value = v; };
  const miles = n => n == null ? "" : n.toLocaleString("es-AR");
  pone("#f-min", miles(FILTROS.min));
  pone("#f-max", miles(FILTROS.max));
  pone("#f-excluir", FILTROS.excluir);
  const hay = Buscador.hayFiltros(FILTROS);
  caja.classList.toggle("activo", hay);
  if (hay) caja.open = true;
}

function cambiarFiltro(que, valor) {
  if (que === "tienda") {
    const i = FILTROS.tiendas.indexOf(valor);
    if (i >= 0) FILTROS.tiendas.splice(i, 1); else FILTROS.tiendas.push(valor);
  } else if (que === "sello") {
    const i = FILTROS.sellos.indexOf(valor);
    if (i >= 0) FILTROS.sellos.splice(i, 1); else FILTROS.sellos.push(valor);
  } else if (que === "primera") FILTROS.primera = !FILTROS.primera;
  else if (que === "quitar") {
    FILTROS = Buscador.filtrosVacios();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // sincronizar no pisa un campo en uso
  }
  sincronizarFiltros();
  pintarResultados(($("#q") || {}).value || "");
}

function engancharFiltros(caja) {
  let t;
  caja.addEventListener("input", ev => {
    if (ev.target.id === "f-min") FILTROS.min = numeroDe(ev.target.value);
    else if (ev.target.id === "f-max") FILTROS.max = numeroDe(ev.target.value);
    else if (ev.target.id === "f-excluir") FILTROS.excluir = ev.target.value;
    else return;
    clearTimeout(t);
    t = setTimeout(() => { sincronizarFiltros(); pintarResultados(($("#q") || {}).value || ""); }, 220);
  });
}

function buscarTodo(q) {
  const coincide = Buscador.filtroDe(q);
  if (!IDX || !coincide) return [];
  // Los nombres normalizados se calculan una sola vez por indice cargado.
  const N = IDX._n || (IDX._n = IDX.productos.map(f => normalBusq(f[0])));
  const halla = [];
  IDX.productos.forEach((f, i) => { if (coincide(N[i])) halla.push(f); });
  const g = Buscador.agruparPorModelo(Buscador.unaPorUrl(halla), comercioDe);          // el aviso que llega directo y por ComparaYa, una vez
  OTRAS = g.otras;
  return g.filas;
}

/* Si una consulta encuentra algo, sin agrupar ni tocar OTRAS: lo usa "Comparar" para elegir entre varias consultas. */
function hayResultados(q) {
  const coincide = Buscador.filtroDe(q);
  if (!IDX || !coincide) return false;
  const N = IDX._n || (IDX._n = IDX.productos.map(f => normalBusq(f[0])));
  return N.some(coincide);
}

function buscar(q, tope = 60) { return buscarTodo(q).slice(0, tope * 3); }

let ULTIMA_BUSQUEDA = [];

/* Afuera en vivo (spec 022): con cada busqueda se le pregunta al Worker (sitio.json afuera_url, en el meta de index.html) por las
   ofertas internacionales con envio a Argentina. Lo puro esta en js/afuera.js. Una consulta se pide una sola vez por sesion y
   recien cuando se deja de escribir; sin Worker, caido o lento, no se pinta nada y queda lo de la spec 020. */
const AFUERA_URL = (document.querySelector('meta[name="afuera-url"]') || {}).content || "";
const AFUERA = new Map();      // url -> respuesta del Worker
const AFUERA_FALLO = new Map(); // url -> cuando fallo: no se reintenta durante un minuto (revision de OmniRoute, spec 022)
let AFUERA_TURNO = 0, AFUERA_ESPERA = null;
function pintarAfuera(q, mejorAca) {
  const caja = $("#afuera"), url = Afuera.urlConsulta(AFUERA_URL, q), turno = ++AFUERA_TURNO;
  clearTimeout(AFUERA_ESPERA);
  if (!caja) return;
  const pintar = d => { if (turno === AFUERA_TURNO) caja.innerHTML = Afuera.afueraHtml(d, { esc, icono, mejorAca, pathname: location.pathname }); };
  if (!url || Date.now() - (AFUERA_FALLO.get(url) || 0) < 60000) { caja.innerHTML = ""; return; }
  if (AFUERA.has(url)) return pintar(AFUERA.get(url));
  caja.innerHTML = `<p class="sub chico afv-cargando">${icono("fuera")} Buscando afuera…</p>`;
  AFUERA_ESPERA = setTimeout(() => {
    const corte = typeof AbortSignal !== "undefined" && AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {};
    fetch(url, corte).then(r => (r.ok ? r.json() : null)).catch(() => null).then(d => {
      if (d) AFUERA.set(url, d); else AFUERA_FALLO.set(url, Date.now());
      pintar(d);
    });
  }, 900);
}

function pintarResultados(q) {
  const caja = $("#res"), est = $("#estado");
  if (!IDX || !caja) return;
  limpiarConsulta();          // si no hay resultados, no queda una consulta vieja gobernando las pestañas
  if (!q.trim()) {
    const viejas = Object.values(IDX.tiendas).filter(t => Pagina.precioDel(t.relevado, IDX.generado));
    est.textContent = `${IDX.productos.length.toLocaleString("es-AR")} productos indexados en ${Object.keys(IDX.tiendas).length} fuentes · actualizado ${Pagina.cuando(IDX.generado)}`
      + (viejas.length ? ` · sin relevar hoy: ${viejas.map(t => `${t.nombre} (${Pagina.precioDel(t.relevado, IDX.generado)})`).join(", ")}` : "");
    caja.innerHTML = "";
    $("#puente").innerHTML = "";
    ULTIMA_BUSQUEDA = [];
    pintarAfuera("", null);
    return;
  }
  const crudo = buscarTodo(q);   // se ordena sobre TODO el catalogo, no sobre los primeros 180
  if (!crudo.length) {
    est.textContent = `sin resultados para "${q}"`;
    // Si la marca o el producto no estan en ninguna fuente, se dice asi y ya se arma la busqueda en cada tienda de afuera
    // (spec 020: solo enlaces, js/importar.js); con el link del que encuentre, la calculadora saca cuanto sale traerlo.
    caja.innerHTML = `<p class="sub">Ninguna de las ${Object.keys(IDX.tiendas).length} tiendas del índice tiene «${esc(q)}». Si es un modelo, probá con la marca sola o con menos palabras.</p>
      ${Importar.buscarAfueraHtml(q, { esc, icono })}
      <p class="sub chico">¿Lo encontraste afuera? <button class="acc" data-ir-vista="costo">${icono("camion")} Pegá el link y calculá cuánto te sale puesto en casa</button></p>`;
    $("#puente").innerHTML = "";
    ULTIMA_BUSQUEDA = [];
    pintarAfuera(q, null);
    return;
  }
  // La busqueda arma la comparativa, el ranking de comercios y el veredicto, y la
  // lista usa el mismo conjunto: sin equipos completos ni avisos que no son
  // comparables, para que la mediana y el orden digan lo mismo que las pestañas.
  fijarConsulta(q);
  const A = ANALISIS;
  pintarAfuera(q, A && A.picks[0] ? { precio: A.picks[0].m.f[1], tienda: comercioDe(A.picks[0].m.f) } : null);
  const conjunto = A ? [...A.base, ...A.internacionales].map(m => m.f) : crudo;
  const med = A ? A.med : mediana(crudo.map(f => f[1]));
  // Se filtra la lista, no el analisis: la mediana de arriba sigue siendo la de todos los comparables.
  const cm = ctxModos();
  const F = Buscador.filtrarGrupos(conjunto, OTRAS, FILTROS, n => cm.premium(n).premium);
  OTRAS = F.otras;
  cm.tiendasDe = f => 1 + (OTRAS.get(f) || []).length;
  const enModo = Modos.filtrar(F.filas, ORDEN, cm, med);
  const r = Modos.ordenar(enModo, ORDEN2, cm).slice(0, 60);
  const nota = $("#nota-modo");
  if (nota) nota.textContent = Modos.notaDe(ORDEN, F.filas.length, enModo.length);
  ULTIMA_BUSQUEDA = r;
  if (!r.length && F.filas.length) {
    est.textContent = `ningún aviso entra en ${Modos.MODOS.find(m => m.id === ORDEN).eti} (hay ${F.filas.length} en esta búsqueda)`;
    caja.innerHTML = vacioHtml(Modos.contar(F.filas, cm, med));
    return;
  }
  if (!r.length) {
    est.textContent = `ningún aviso cumple los filtros (hay ${conjunto.length} sin filtrar)`;
    caja.innerHTML = `<p class="sub">Probá con menos filtros. <button class="acc" data-filtro="quitar">Quitar filtros</button></p>`;
    return;
  }

  const fuentes = new Set(r.map(f => f[3]));
  const nPremium = r.filter(f => cm.premium(f[0]).premium).length;
  const afuera = A ? A.total - A.base.length - A.internacionales.length : 0;
  const nInt = A ? A.internacionales.length : 0;
  est.innerHTML = (enModo.length > r.length ? `Mostrando ${r.length} de ${enModo.length}` : Buscador.textoConteo(r.length, avisosDe(r)))
    + ` en ${fuentes.size} fuente${fuentes.size > 1 ? "s" : ""}`
    + ` · mediana ${pesos(med)} · ${nPremium} premium por especificaciones`
    + (F.ocultas ? ` · ${F.ocultas} oculto${F.ocultas > 1 ? "s" : ""} por los filtros` : "")
    + (afuera ? ` · ${afuera} avisos quedaron afuera por no ser comparables (el detalle está en Comparativa)` : "")
    + (nInt ? ` · ${nInt} compra${nInt > 1 ? "s" : ""} internacional${nInt > 1 ? "es" : ""}, marcada${nInt > 1 ? "s" : ""} y fuera de la comparativa` : "");
  const cat = CATEGORIAS.find(c => (c.claves || []).some(k => normal(q).includes(normal(k))));
  $("#puente").innerHTML = !A ? "" :
    `<div class="puente">
      <div class="p-txt">
        <span class="p-tit">${icono("balanza")} Armamos la comparación para «${esc(q.trim())}»</span>
        <span>Mejor compra: <b>${esc(A.picks[0].m.f[0].slice(0, 64))}</b> · ${pesos(A.picks[0].m.f[1])} · ${esc(comercioDe(A.picks[0].m.f))}${Buscador.plusDe(A.picks[0].m.f[8]).map(t => ` · ＋ ${t}`).join("")}</span>
      </div>
      <div class="botones">
        <button class="acc" data-ir-vista="comparativa">${icono("balanza")} Comparativa</button>
        <button class="acc" data-ir-vista="tiendas">${icono("store")} Tiendas</button>
        <button class="acc" data-ir-vista="veredicto">${icono("trofeo")} Veredicto</button>
      </div>
    </div>` + (!cat ? "" :
    `<div class="puente suave"><span>Esta categoría también tiene análisis a fondo: specs de fábrica y garantía real.</span>
      <button class="acc" data-ir-cat="${cat.id}">Ver el análisis curado de ${esc(cat.eti)}</button></div>`);

  const barato = Math.min(...r.map(f => f[1]));
  caja.innerHTML = r.map((f, i) => {
    const t = IDX.tiendas[f[3]] || { nombre: f[3], color: "fh" };
    const sello = f[4] ? `${esc(t.nombre)} <span class="via">${esc(f[4])}</span>` : esc(t.nombre);
    const niv = nivelMarca(f[0]);
    const bajo = f[6] && f[6] > f[1] ? Math.round((1 - f[1] / f[6]) * 100) : 0;
    const off = f[5] && f[5] > f[1] ? Math.round((1 - f[1] / f[5]) * 100) : 0;
    const sospechoso = pisoDeGama(f[1], niv, med);
    const marcas = [];
    if (viejoDe(f)) marcas.push(selloOjo(viejoDe(f)));
    const prem = cm.premium(f[0]);
    if (prem.premium) marcas.push(`<span class="sello primera" title="${esc(prem.senales.join(" · "))}">premium</span>`);
    if (prem.ganador) marcas.push(`<span class="sello conocida">${esc(prem.ganador.texto)}</span>`);
    if (niv >= 1) marcas.push('<span class="sello conocida">marca reconocida</span>');
    // En Super Oferta cada fila dice POR QUE es una oferta (spec 014); en los otros modos, la baja o rebaja de siempre.
    const por = ORDEN === "super" ? cm.ofertas().get(f[2]) : null;
    if (por) for (const r of por.razones) marcas.push(`<span class="sello baja">${esc(r.texto)}</span>`);
    else if (bajo) marcas.push(`<span class="sello baja">bajó ${bajo}%</span>`);
    else if (off) marcas.push(`<span class="sello off2">${off}% OFF</span>`);
    if (sospechoso) marcas.push('<span class="sello ojo">muy por debajo del resto</span>');
    for (const [clase, texto] of sellosDe(f[8])) marcas.push(`<span class="sello ${clase}">${texto}</span>`);
    if (f[1] === barato && r.length > 1) marcas.push('<span class="sello barato">más barato</span>');
    // Idea #12 (PriceSpy, Geizhals): el mismo modelo mas barato en una tienda que se lee directo (no el agregador ni lo internacional)
    const mb = OFERTAS && OFERTAS.masBarato.get(f);
    if (mb) marcas.push(`<span class="sello ojo">otra tienda lo tiene más barato: ${esc(comercioDe(mb))} ${pesos(mb[1])}</span>`);
    const otras = OTRAS.get(f) || [];
    if (otras.length) marcas.push(`<span class="sello conocida">mismo modelo en ${otras.length + 1} tiendas</span>`);
    // Sin baja ni rebaja, lo que sirve saber es desde cuando esta en este precio (no hace falta que sea una oferta para verlo).
    const quieto = !bajo && !off ? Pagina.cambioDe(f[10], (IDX.historial || {}).inicio) : "";
    // «Comparar» por fila (spec 017): solo si el titulo dice las especificaciones suficientes para una comparacion justa.
    const compara = Especificaciones.mismas(f, f).aplica
      ? `<button class="acc" data-comparar-fila="${esc(f[2])}" title="Compara solo con avisos de las mismas especificaciones">${icono("balanza")} Comparar con las mismas especificaciones</button>` : "";
    return `<a class="fila c-${t.color}${i === 0 ? " top" : ""}" style="--i:${i}" href="${enlace(f[2])}" target="_blank" rel="noopener">
      <span class="nom">${esc(f[0])}${marcas.length ? `<span class="sellos">${marcas.join("")}</span>` : ""}${quieto ? `<span class="precio-hist">${esc(quieto)}</span>` : ""}</span>
      <span class="tie">${sello}</span>
      <span class="pre">${pesos(f[1])}</span>
    </a>` + (otras.length || compara ? `<div class="mismo">${otras.length ? `<span>También en</span>${otras.map(o =>
      `<a href="${enlace(o[2])}" target="_blank" rel="noopener">${esc(comercioDe(o))} ${pesos(o[1])}</a>`).join("")}` : ""}${compara}</div>` : "")
      + historialHtml(f);
  }).join("");
}

let guardarLuego = null;
function consultar(q) {
  const campo = $("#q");
  if (campo && campo.value !== q) campo.value = q;
  pintarResultados(q);
  clearTimeout(guardarLuego);
  guardarLuego = setTimeout(() => { guardarHist(q); registrarBusqueda(q); }, 1200);   // recien cuando dejas de tipear
}

function vistaBuscar() {
  setTimeout(async () => {
    const campo = $("#q");
    if (campo) {
      let t;
      campo.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => consultar(campo.value), 160); });
      campo.focus();
    }
    pintarHist();
    const filtros = $("#filtros");
    if (filtros) engancharFiltros(filtros);
    try {
      await asegurarIndice();
      cargarGanadores().then(g => { if (g) pintarResultados(($("#q") || {}).value || ""); });
      if (filtros) { filtros.querySelector(".filtros-cuerpo").innerHTML = filtrosHtml(); sincronizarFiltros(); }
      pintarResultados(campo ? campo.value : "");
    } catch (e) {
      $("#estado").textContent = "no pude cargar el índice";
      $("#res").innerHTML = `<p class="sub">Falta <code>indice.json</code>. Generalo con <code>python indexar.py</code>.</p>`;
    }
  }, 0);

  return `<div class="panel"><div class="panel-head"><h2>${icono("lupa")} Buscar en las ${IDX ? Object.keys(IDX.tiendas).length : 13} fuentes</h2>
    <p class="sub">Un solo cuadro sobre los catálogos de 12 tiendas de hardware (CompraGamer, Gaming City, Mexx, FullH4rd, Venex, Maximus, Katech, Max Tecno, The Gamer Shop, SCP Hardstore, Click Gaming y GoldenTech), más <strong>ComparaYa</strong> como segunda opinión, que agrega otros comercios como Mercado Libre, Frávega y OnCity. Los resultados se ven en tres modos (Recomendación, Súper Oferta y Primera Línea) y se ordenan por precio, novedades o gama premium; con ellos la app arma la <b>comparativa</b>, el <b>ranking de comercios</b> y el <b>veredicto</b> de lo que busques.</p></div>
    <div class="buscador">${icono("lupa")}<input type="search" id="q" value="${esc(CONSULTA)}" placeholder="Buscá lo que sea: ssd 1tb, ryzen 5, monitor 27…" autocomplete="off" spellcheck="false"></div>
    <div class="historial" id="hist"></div>
    <div class="sugeridas">${sugeridas().map(x => `<button class="sug">${esc(x)}</button>`).join("")}</div>
    ${ordenesHtml()}
    <details class="filtros" id="filtros"><summary>Filtros</summary><div class="filtros-cuerpo">${filtrosHtml()}</div></details>
    <div id="puente"></div>
    <p class="estado" id="estado">cargando índice…</p>
    ${barraAcciones("buscar")}
    <div class="res" id="res"></div>
    <div id="afuera" aria-live="polite"></div></div>`;
}
