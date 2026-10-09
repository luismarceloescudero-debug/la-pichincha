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

function buscarTodo(q) {
  const coincide = Buscador.filtroDe(q);
  if (!IDX || !coincide) return [];
  // Los nombres normalizados se calculan una sola vez por indice cargado.
  const N = IDX._n || (IDX._n = IDX.productos.map(f => normalBusq(f[0])));
  const halla = [];
  IDX.productos.forEach((f, i) => { if (coincide(N[i])) halla.push(f); });
  return halla;
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
  const r = ordenar(conjunto, med).slice(0, 60);
  ULTIMA_BUSQUEDA = r;

  const fuentes = new Set(r.map(f => f[3]));
  const conMarca = r.filter(f => nivelMarca(f[0]) === 2).length;
  const afuera = A ? A.total - A.base.length - A.internacionales.length : 0;
  const nInt = A ? A.internacionales.length : 0;
  est.innerHTML = (conjunto.length > r.length ? `Mostrando ${r.length} de ${conjunto.length}` : `${r.length} resultado${r.length > 1 ? "s" : ""}`)
    + ` en ${fuentes.size} fuente${fuentes.size > 1 ? "s" : ""}`
    + ` · mediana ${pesos(med)} · ${conMarca} de marca de primera línea`
    + (afuera ? ` · ${afuera} avisos quedaron afuera por no ser comparables (el detalle está en Comparativa)` : "")
    + (nInt ? ` · ${nInt} compra${nInt > 1 ? "s" : ""} internacional${nInt > 1 ? "es" : ""}, marcada${nInt > 1 ? "s" : ""} y fuera de la comparativa` : "");
  const cat = CATEGORIAS.find(c => (c.claves || []).some(k => normal(q).includes(normal(k))));
  $("#puente").innerHTML = !A ? "" :
    `<div class="puente">
      <div class="p-txt">
        <span class="p-tit">${icono("balanza")} Armamos la comparación para «${esc(q.trim())}»</span>
        <span>Mejor compra: <b>${esc(A.picks[0].m.f[0].slice(0, 64))}</b> · ${pesos(A.picks[0].m.f[1])} · ${esc(comercioDe(A.picks[0].m.f))}</span>
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
    return `<a class="fila c-${t.color}${i === 0 ? " top" : ""}" style="--i:${i}" href="${f[2]}" target="_blank" rel="noopener">
      <span class="nom">${esc(f[0])}${marcas.length ? `<span class="sellos">${marcas.join("")}</span>` : ""}</span>
      <span class="tie">${sello}</span>
      <span class="pre">${pesos(f[1])}</span>
    </a>`;
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
    try {
      await asegurarIndice();
      pintarResultados(campo ? campo.value : "");
    } catch (e) {
      $("#estado").textContent = "no pude cargar el índice";
      $("#res").innerHTML = `<p class="sub">Falta <code>indice.json</code>. Generalo con <code>python indexar.py</code>.</p>`;
    }
  }, 0);

  return `<div class="panel"><div class="panel-head"><h2>${icono("lupa")} Buscar en las 5 fuentes</h2>
    <p class="sub">Un solo cuadro sobre los catálogos de CompraGamer, Gaming City, Mexx y FullH4rd, más <strong>ComparaYa</strong> como segunda opinión, que agrega otros comercios como Mercado Libre, Frávega y OnCity. Los resultados salen ordenados por conveniencia, y con ellos la app arma la <b>comparativa</b>, el <b>ranking de comercios</b> y el <b>veredicto</b> de lo que busques.</p></div>
    <div class="buscador">${icono("lupa")}<input type="search" id="q" value="${esc(CONSULTA)}" placeholder="Buscá lo que sea: ssd 1tb, ryzen 5, monitor 27…" autocomplete="off" spellcheck="false"></div>
    <div class="historial" id="hist"></div>
    <div class="sugeridas">${SUGERIDAS.map(x => `<button class="sug">${x}</button>`).join("")}</div>
    <div class="segmentos chico">${ORDENES.map(o =>
      `<button class="seg" data-orden="${o.id}" aria-selected="${o.id === ORDEN}">${esc(o.eti)}</button>`).join("")}</div>
    <div id="puente"></div>
    <p class="estado" id="estado">cargando índice…</p>
    ${barraAcciones("buscar")}
    <div class="res" id="res"></div></div>`;
}
