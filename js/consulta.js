/* --- Una busqueda arma su propia comparativa, ranking y veredicto -------
   Antes la busqueda era una lista y las otras pestañas mostraban siempre lo
   mismo. Ahora lo que buscas gobierna las tres: la comparativa sale de los
   resultados, el ranking de comercios sale de los resultados y el veredicto
   lo escribe la propia busqueda. Sin consulta vuelve el contenido curado. */
let CONSULTA = "", ANALISIS = null;
const DINAMICAS = ["comparativa", "tiendas", "veredicto"];
const LETRAS = ["A", "B", "C", "D"];
const MARCAS_RE = Buscador.armarMarcasRe([...(MARCAS.primera || []), ...(MARCAS.conocida || [])]);

const comercioDe = f => f[4] || (IDX.tiendas[f[3]] || {}).nombre || f[3];
/* Un precio que no se pudo verificar en el ultimo relevamiento lo dice, en vez de
   pasar por uno de hoy: "precio del 7/10" en el indice, "sin verificar desde el
   8/10" en la comparativa curada. */
const viejoDe = f => IDX ? Pagina.precioDel((IDX.tiendas[f[3]] || {}).relevado, IDX.generado) : "";
const avisoDe = p => Pagina.sinVerificar(p.falla_desde, DATOS.verificado);
const selloOjo = txt => txt ? `<span class="sello ojo">${esc(txt)}</span>` : "";
const chipOjo = txt => txt ? `<span class="chip ojo">${esc(txt)}</span>` : "";
const colorDe = f => (IDX.tiendas[f[3]] || {}).color || "fh";

/* La marca es la que aparece primero en el nombre: "Notebook HP Intel Core" es HP. */
function marcaDe(nombre) { return Buscador.marcaDe(nombre, MARCAS_RE); }

/* La logica vive en js/analisis.js: la comparten esta pagina y las paginas por busqueda. */
function analizarConsulta(q) {
  return Analisis.analizarConsulta(q, { buscarTodo, colorDe, comercioDe, marcaDe, nivelMarca, pesos });
}

function fijarConsulta(q) {
  const t = q.trim();
  if (t.length < 2) return limpiarConsulta();
  CONSULTA = t;
  ANALISIS = analizarConsulta(t);
  if (!ANALISIS) CONSULTA = "";
  marcarConsulta();
}
function limpiarConsulta() { CONSULTA = ""; ANALISIS = null; marcarConsulta(); }
function marcarConsulta() {
  const t = $(".tabs"); if (t) t.dataset.consulta = CONSULTA ? "1" : "0";
  sincronizarUrl();
}

/* ---- Vistas ---- */
function bannerConsulta() {
  const A = ANALISIS, partes = Analisis.partesExclusion(A.excl);
  return `<div class="consulta-activa"><span class="txt">${icono("lupa")} Armado para tu búsqueda <b>«${esc(CONSULTA)}»</b>:
    ${A.total} avisos, ${A.base.length} comparables en ${A.comercios.length} comercios.${partes.length ? ` Dejamos afuera ${partes.join(", ")}.` : ""}</span>
    <button class="acc" data-cambiar-consulta>${icono("lupa")} Cambiar búsqueda</button>
    <button class="acc" data-quitar-consulta>Ver el análisis curado</button></div>`;
}

function cardPick(p, i) {
  const f = p.m.f, t = IDX.tiendas[f[3]] || { nombre: f[3], color: "fh" };
  const specs = Object.values(specsDe(f[0])).slice(0, 5);
  const sello = ["sin marca reconocida", "marca conocida", "primera línea"][p.m.niv];
  const antes = f[5] && f[5] > f[1] ? `<span class="antes">${pesos(f[5])}</span>` : "";
  return `<a class="dcard c-${t.color}${p.clave === "mejor" ? " mejor" : ""}" style="--i:${i}" href="${f[2]}" target="_blank" rel="noopener">
    <span class="rol"><b class="letra">${LETRAS[i]}</b> ${icono(p.ico)} ${esc(p.rol)}</span>
    <h3>${esc(f[0])}</h3>
    <span class="tienda">${icono("store")} ${esc(comercioDe(f))}${f[4] ? ` · vía ${esc(t.nombre)}` : ""}</span>
    <div><span class="precio">${pesos(f[1])}</span>${antes}</div>
    <div class="chips">${chipOjo(viejoDe(f))}${specs.map(v => `<span class="chip">${esc(v)}</span>`).join("")}<span class="chip${p.m.niv === 2 ? " ok" : ""}">${sello}</span>${sellosDe(f[8]).map(([clase, texto]) =>
      `<span class="chip${clase === "off2" ? " ok" : clase === "ojo" ? " ojo" : ""}">${texto}</span>`).join("")}</div>
    <p class="razon">${esc(p.razon)}</p>
    <span class="ver">Abrir en ${esc(comercioDe(f))} ${icono("fuera")}</span>
  </a>`;
}

function franja(picks) {
  const ps = ANALISIS.base.map(m => m.f[1]).sort((a, b) => a - b);
  const lo = ps[0], hi = ps[Math.floor(0.95 * (ps.length - 1))], span = Math.max(1, hi - lo);
  const x = v => Math.min(97, Math.max(3, (v - lo) / span * 100)).toFixed(1);
  const marcas = picks.map((p, i) => `<span class="mk c-${colorDe(p.m.f)}" style="left:${x(p.m.f[1])}%"
    title="${esc(p.rol)}: ${pesos(p.m.f[1])}">${LETRAS[i]}</span>`).join("");
  return `<div class="franja"><h3>Dónde cae cada opción en el rango de precios</h3>
    <div class="pista"><span class="med" style="left:${x(ANALISIS.med)}%"></span>${marcas}</div>
    <div class="extremos"><span>${pesos(lo)} · el más barato</span><span>${pesos(hi)} · hasta acá llega el 95%</span></div></div>`;
}

function tablaPicks(picks) {
  const A = ANALISIS, med = A.med;
  const specs = picks.map(p => specsDe(p.m.f[0]));
  const claves = [...new Set(specs.flatMap(s => Object.keys(s)))];
  const precios = picks.map(p => p.m.f[1]), minP = Math.min(...precios);
  const maxNiv = Math.max(...picks.map(p => p.m.niv));
  const bajo = picks.map(p => Math.round((1 - p.m.f[1] / med) * 100)), maxBajo = Math.max(...bajo);
  const fila = (nombre, vals, mejor) => `<tr><th>${esc(nombre)}</th>${vals.map((v, i) =>
    `<td class="${mejor && mejor[i] ? "mejor" : ""}">${v}</td>`).join("")}</tr>`;
  let h = `<div class="scroll"><table><thead><tr><th>&nbsp;</th>${picks.map((p, i) =>
    `<th>${LETRAS[i]} · ${esc(p.rolCorto)}</th>`).join("")}</tr></thead><tbody>`;
  h += fila("Precio", picks.map(p => pesos(p.m.f[1])), precios.map(v => v === minP));
  h += fila("Comercio", picks.map(p => esc(comercioDe(p.m.f))));
  h += fila("Marca", picks.map(p => `${esc(marcaDe(p.m.f[0]) || "—")} <span class="tenue">(${["sin reconocer", "conocida", "primera línea"][p.m.niv]})</span>`),
    picks.map(p => p.m.niv === maxNiv && maxNiv > 0));
  h += fila("Contra la mediana", bajo.map(x => x === 0 ? "igual" : `${Math.abs(x)}% ${x > 0 ? "menos" : "más"}`), bajo.map(x => x === maxBajo));
  h += fila("Movimiento", picks.map(p => {
    const f = p.m.f;
    return f[6] > f[1] ? `bajó ${Math.round((1 - f[1] / f[6]) * 100)}%`
         : f[5] > f[1] ? `${Math.round((1 - f[1] / f[5]) * 100)}% OFF publicado` : "—";
  }));
  claves.forEach(k => { h += fila(k, specs.map(s => esc(s[k] || "—"))); });
  return h + "</tbody></table></div>";
}

function vistaComparativaDin() {
  const A = ANALISIS;
  setTimeout(pintarTira, 0);
  return `<div class="panel"><div class="ultimas" id="ultimas">${tiraHtml(true)}</div>${bannerConsulta()}
    <div class="panel-head"><h2>${icono("balanza")} Comparativa: ${esc(CONSULTA)}</h2>
      <p class="sub">De ${A.total} avisos que coinciden, ${A.base.length} son comparables entre sí. Estas son las opciones que valen la pena y en qué se diferencian.</p></div>
    ${barraAcciones("comparativa")}
    <div class="dgrid">${A.picks.map(cardPick).join("")}</div>
    ${franja(A.picks)}
    <div class="panel-head" style="margin-top:26px"><h2>${icono("chip")} En qué se diferencian</h2>
      <p class="sub">Las especificaciones se leen del texto del aviso, así que algunas pueden faltar: abrí la ficha para confirmarlas.</p></div>
    ${tablaPicks(A.picks)}</div>`;
}

function vistaTiendasDin() {
  const A = ANALISIS, top = A.comercios.slice(0, 6), resto = A.comercios.length - top.length;
  const cards = top.map((c, i) => `<a class="dcard c-${c.color}${i === 0 ? " mejor" : ""}" style="--i:${i}" href="${c.mejorItem.f[2]}" target="_blank" rel="noopener">
    <span class="rol"><b class="letra">${i + 1}</b> ${icono("store")} ${i === 0 ? "Más barata en primera línea" : "Comercio"}</span>
    <h3>${esc(c.nom)}</h3>
    <div><span class="precio">${pesos(c.mejorItem.f[1])}</span> ${selloOjo(viejoDe(c.mejorItem.f))}</div>
    <p class="razon">${c.conPrimera ? "Su opción de primera línea más barata" : "Sin marca de primera línea acá: su opción más barata"}: ${esc(c.mejorItem.f[0].slice(0, 80))}</p>
    <dl><dt>Avisos comparables</dt><dd>${c.n}</dd><dt>Precio típico</dt><dd>${pesos(c.med)}</dd>
      <dt>De primera línea</dt><dd>${Math.round(c.pctPrimera * 100)}%</dd><dt>Bajaron de precio</dt><dd>${c.bajas}</dd></dl>
    <span class="ver">Abrir ${icono("fuera")}</span></a>`).join("");
  return `<div class="panel">${bannerConsulta()}
    <div class="panel-head"><h2>${icono("store")} Dónde conviene comprar: ${esc(CONSULTA)}</h2>
      <p class="sub">Ranking de comercios con lo que realmente vende cada uno de esta búsqueda. Gana quien tiene la marca más confiable al menor precio; el precio típico y la cantidad de avisos muestran cuánto margen de elección da.${resto > 0 ? ` Hay ${resto} comercio${resto > 1 ? "s" : ""} más con menos opciones.` : ""}</p></div>
    ${barraAcciones("tiendas")}
    <div class="dgrid">${cards}</div></div>`;
}

function vistaVeredictoDin() {
  const A = ANALISIS, mejor = A.picks[0], f = mejor.m.f;
  const barato = A.picks.find(p => p.clave === "barato"), alt = A.picks.find(p => p.clave === "alt");
  const x = Math.round((1 - f[1] / A.med) * 100);
  const c0 = A.comercios[0], c1 = A.comercios[1];
  const items = [];

  items.push({ t: `Comprá ${f[0].slice(0, 72)}.`,
    d: `${mejor.razon} Sale ${pesos(f[1])} en ${comercioDe(f)}${viejoDe(f) ? `, ${viejoDe(f)}: hoy no lo pudimos verificar` : ""}.` + (f[6] > f[1] ? ` Además bajó ${Math.round((1 - f[1] / f[6]) * 100)}% desde el relevamiento anterior.` : "") });
  if (barato) items.push({ t: "Si el precio es lo único que importa.",
    d: `${barato.m.f[0].slice(0, 72)} a ${pesos(barato.m.f[1])}. ${barato.razon}` });
  if (alt) items.push({ t: "Una alternativa de otra marca.",
    d: `${alt.m.f[0].slice(0, 72)} a ${pesos(alt.m.f[1])}. ${alt.razon}` });
  items.push({ t: "Dónde conviene comprar.",
    d: `${c0.nom} tiene la opción ${c0.conPrimera ? "de primera línea" : "de menor precio"} más barata: ${pesos(c0.mejorItem.f[1])}.`
      + (c1 ? ` Le sigue ${c1.nom} con ${pesos(c1.mejorItem.f[1])}, ${Math.round((c1.mejorItem.f[1] / c0.mejorItem.f[1] - 1) * 100)}% más.` : "")
      + ` Hay ${A.comercios.length} comercio${A.comercios.length > 1 ? "s" : ""} con opciones comparables.` });

  const descartar = [];
  if (A.excl.raros) descartar.push(`${A.excl.raros} avisos cuestan menos del 45% de lo habitual y no son de una marca que reconozcamos: suelen ser otro producto, un accesorio o una variante inferior.`);
  if (A.excl.caros) descartar.push(`${A.excl.caros} avisos cuestan más del triple de lo habitual: casi siempre son equipos completos que solo mencionan el componente en el nombre.`);
  if (A.excl.similares) descartar.push(`${A.excl.similares} avisos dicen «simil» o «similar»: no son lo que buscaste, por más parecido que sea.`);
  const caras = A.primeras.map(m => m.f[1]);
  if (caras.length > 1) {
    const sobre = Math.round((Math.max(...caras) / f[1] - 1) * 100);
    if (sobre >= 25) descartar.push(`Entre las marcas de primera línea, la más cara cuesta ${sobre}% más que la mejor compra: antes de pagar esa diferencia, fijate si trae mejores especificaciones.`);
  }
  if (descartar.length) items.push({ t: "Lo que descartaría.", d: descartar.join(" ") });
  items.push({ t: "Lo que esta lectura no sabe.",
    d: "Sale del nombre y el precio de cada aviso. No ve garantía, reseñas ni especificaciones finas, y las especificaciones las lee del texto. Sirve para decidir a quién mirar primero, no para cerrar la compra sin abrir la ficha." });

  const tiles = [
    { k: "Mejor compra", v: pesos(f[1]), d: comercioDe(f) + (viejoDe(f) ? ` · ${viejoDe(f)}` : ""), ok: true },
    { k: "Mediana de la búsqueda", v: pesos(A.med), d: `${A.base.length} avisos comparables` },
    { k: "Contra la mediana", v: `${x >= 0 ? "−" : "+"}${Math.abs(x)}%`, d: "la mejor compra frente a lo típico", ok: x > 0 },
    { k: "Comercios", v: String(A.comercios.length), d: "con opciones comparables" },
  ];
  return `<div class="panel">${bannerConsulta()}
    <div class="panel-head"><h2>${icono("trofeo")} Veredicto: ${esc(CONSULTA)}</h2>
      <p class="sub">Escrito a partir de los resultados de tu búsqueda, con los precios de hoy.</p></div>
    ${barraAcciones("veredicto")}
    <div class="tiles">${tiles.map((t, i) => `<div class="tile${t.ok ? " ok" : ""}" style="--i:${i}">
      <div class="k">${esc(t.k)}</div><div class="v">${t.v}</div><div class="d">${esc(t.d)}</div></div>`).join("")}</div>
    ${items.map((v, i) => `<div class="ver-item" style="--i:${i}"><b>${esc(v.t)}</b><p>${esc(v.d)}</p></div>`).join("")}</div>`;
}

function vistaDinamica(id) {
  return id === "comparativa" ? vistaComparativaDin()
       : id === "tiendas" ? vistaTiendasDin() : vistaVeredictoDin();
}

/* --- La busqueda va a la URL ---------------------------------------------
   ?q= guarda la consulta activa y el hash la pestaña: un link copiado
   reproduce la vista. replaceState para no llenar el historial al tipear. */
function sincronizarUrl() {
  const destino = Pagina.armarUrl(location.pathname, CONSULTA, location.hash.slice(1));
  if (destino === location.pathname + location.search + location.hash) return;
  try { history.replaceState(history.state, "", destino); } catch (e) { /* Safari limita las llamadas */ }
}

/* El link de lo que estas mirando: en Buscar vale lo que esta escrito. */
function enlaceActual() {
  const q = CONSULTA || ($("#q") || {}).value || "";
  return location.origin + Pagina.armarUrl(location.pathname, q, location.hash.slice(1));
}
