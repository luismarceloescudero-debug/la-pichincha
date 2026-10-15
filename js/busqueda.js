/* --- Que tan reconocida es la marca ------------------------------------
   Es juicio editorial y esta en datos.json, no en el indice: ninguna tienda
   publica esto. Lo que no esta en la lista no se castiga, solo no se destaca. */
const MARCAS = DATOS.marcas || { primera: [], conocida: [] };
const nivelMarca = Buscador.crearNivelMarca(MARCAS);

const ORDENES = [
  { id: "recomendado", eti: "Recomendado" },
  { id: "precio", eti: "Más barato" },
  { id: "marca", eti: "Mejor marca" },
];
let ORDEN = (() => { try { return localStorage.getItem("orden") || "recomendado"; } catch (e) { return "recomendado"; } })();

/* "Recomendado" pone primero la marca mas confiable al menor precio y manda al
   fondo el piso de gama. La logica vive en js/buscador.js. */
function ordenar(filas, med) { return Buscador.ordenar(filas, med, ORDEN, nivelMarca); }

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
    <div class="of-fila"><span class="of-et" aria-hidden="true">Marca</span>
      <button class="of-chip" data-filtro="primera" aria-pressed="${FILTROS.primera}">${icono("trofeo")} Solo primera línea</button></div>
    <div class="of-fila"><label class="of-et" for="f-excluir">Excluir</label>
      <input id="f-excluir" class="f-texto" type="text" autocomplete="off" spellcheck="false" placeholder="palabras separadas por coma: kit, usado, simil"></div>
    <div class="of-fila"><button class="acc" data-filtro="quitar">Quitar filtros</button></div>`;
}

/* Refleja FILTROS en los controles (si estan en pantalla) sin volver a armar el panel: asi no se pierde el foco. */
function sincronizarFiltros() {
  const caja = $("#filtros");
  if (!caja) return;
  caja.querySelectorAll('[data-filtro="tienda"]').forEach(b => b.setAttribute("aria-pressed", String(FILTROS.tiendas.includes(b.dataset.valor))));
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
  const g = Buscador.agruparPorModelo(halla);
  OTRAS = g.otras;
  return g.filas;
}

function buscar(q, tope = 60) { return buscarTodo(q).slice(0, tope * 3); }

let ULTIMA_BUSQUEDA = [];

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
    return;
  }
  const crudo = buscarTodo(q);   // se ordena sobre TODO el catalogo, no sobre los primeros 180
  if (!crudo.length) {
    est.textContent = `sin resultados para "${q}"`;
    caja.innerHTML = `<p class="sub">Probá con menos palabras, o con la marca sola. El índice busca por nombre de producto.</p>`;
    $("#puente").innerHTML = "";
    ULTIMA_BUSQUEDA = [];
    return;
  }
  // La busqueda arma la comparativa, el ranking de comercios y el veredicto, y la
  // lista usa el mismo conjunto: sin equipos completos ni avisos que no son
  // comparables, para que la mediana y el orden digan lo mismo que las pestañas.
  fijarConsulta(q);
  const A = ANALISIS;
  const conjunto = A ? [...A.base, ...A.internacionales].map(m => m.f) : crudo;
  const med = A ? A.med : mediana(crudo.map(f => f[1]));
  // Se filtra la lista, no el analisis: la mediana de arriba sigue siendo la de todos los comparables.
  const F = Buscador.filtrarGrupos(conjunto, OTRAS, FILTROS, nivelMarca);
  OTRAS = F.otras;
  const r = ordenar(F.filas, med).slice(0, 60);
  ULTIMA_BUSQUEDA = r;
  if (!r.length) {
    est.textContent = `ningún aviso cumple los filtros (hay ${conjunto.length} sin filtrar)`;
    caja.innerHTML = `<p class="sub">Probá con menos filtros. <button class="acc" data-filtro="quitar">Quitar filtros</button></p>`;
    return;
  }

  const fuentes = new Set(r.map(f => f[3]));
  const conMarca = r.filter(f => nivelMarca(f[0]) === 2).length;
  const afuera = A ? A.total - A.base.length - A.internacionales.length : 0;
  const nInt = A ? A.internacionales.length : 0;
  est.innerHTML = (F.filas.length > r.length ? `Mostrando ${r.length} de ${F.filas.length}` : Buscador.textoConteo(r.length, avisosDe(r)))
    + ` en ${fuentes.size} fuente${fuentes.size > 1 ? "s" : ""}`
    + ` · mediana ${pesos(med)} · ${conMarca} de marca de primera línea`
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
    if (niv === 2) marcas.push('<span class="sello primera">primera línea</span>');
    else if (niv === 1) marcas.push('<span class="sello conocida">marca conocida</span>');
    if (bajo) marcas.push(`<span class="sello baja">bajó ${bajo}%</span>`);
    else if (off) marcas.push(`<span class="sello off2">${off}% OFF</span>`);
    if (sospechoso) marcas.push('<span class="sello ojo">muy por debajo del resto</span>');
    for (const [clase, texto] of sellosDe(f[8])) marcas.push(`<span class="sello ${clase}">${texto}</span>`);
    if (f[1] === barato && ORDEN === "precio") marcas.push('<span class="sello barato">más barato</span>');
    const otras = OTRAS.get(f) || [];
    if (otras.length) marcas.push(`<span class="sello conocida">mismo modelo en ${otras.length + 1} tiendas</span>`);
    return `<a class="fila c-${t.color}${i === 0 ? " top" : ""}" style="--i:${i}" href="${f[2]}" target="_blank" rel="noopener">
      <span class="nom">${esc(f[0])}${marcas.length ? `<span class="sellos">${marcas.join("")}</span>` : ""}</span>
      <span class="tie">${sello}</span>
      <span class="pre">${pesos(f[1])}</span>
    </a>` + (otras.length ? `<div class="mismo"><span>También en</span>${otras.map(o =>
      `<a href="${esc(o[2])}" target="_blank" rel="noopener">${esc(comercioDe(o))} ${pesos(o[1])}</a>`).join("")}</div>` : "");
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
      if (filtros) { filtros.querySelector(".filtros-cuerpo").innerHTML = filtrosHtml(); sincronizarFiltros(); }
      pintarResultados(campo ? campo.value : "");
    } catch (e) {
      $("#estado").textContent = "no pude cargar el índice";
      $("#res").innerHTML = `<p class="sub">Falta <code>indice.json</code>. Generalo con <code>python indexar.py</code>.</p>`;
    }
  }, 0);

  return `<div class="panel"><div class="panel-head"><h2>${icono("lupa")} Buscar en las 6 fuentes</h2>
    <p class="sub">Un solo cuadro sobre los catálogos de CompraGamer, Gaming City, Mexx, FullH4rd y Venex, más <strong>ComparaYa</strong> como segunda opinión, que agrega otros comercios como Mercado Libre, Frávega y OnCity. Los resultados salen ordenados por conveniencia, y con ellos la app arma la <b>comparativa</b>, el <b>ranking de comercios</b> y el <b>veredicto</b> de lo que busques.</p></div>
    <div class="buscador">${icono("lupa")}<input type="search" id="q" value="${esc(CONSULTA)}" placeholder="Buscá lo que sea: ssd 1tb, ryzen 5, monitor 27…" autocomplete="off" spellcheck="false"></div>
    <div class="historial" id="hist"></div>
    <div class="sugeridas">${SUGERIDAS.map(x => `<button class="sug">${x}</button>`).join("")}</div>
    <div class="segmentos chico">${ORDENES.map(o =>
      `<button class="seg" data-orden="${o.id}" aria-selected="${o.id === ORDEN}">${esc(o.eti)}</button>`).join("")}</div>
    <details class="filtros" id="filtros"><summary>Filtros</summary><div class="filtros-cuerpo">${filtrosHtml()}</div></details>
    <div id="puente"></div>
    <p class="estado" id="estado">cargando índice…</p>
    ${barraAcciones("buscar")}
    <div class="res" id="res"></div></div>`;
}
