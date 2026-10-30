/* --- Indice compartido: lo usan Buscar y Ofertas ---------------------
   Se baja una sola vez, recien cuando abris alguna de las dos. */
let IDX = null, pidiendo = null, OFERTAS = null;
const SUGERIDAS = ["ddr4 16gb", "ssd 1tb", "rtx 4060", "ryzen 5", "monitor 27", "fuente 650w", "webcam logitech"];
/* Lo mas buscado, si el build lo trajo (BUSCADAS: agregado, con minimo de personas distintas y sin datos personales, spec 017
   fase 3); si no, las de siempre. Se pide al pintar: BUSCADAS lo define el bloque de datos, que carga despues de este script. */
const sugeridas = () => (typeof BUSCADAS !== "undefined" && Array.isArray(BUSCADAS) && BUSCADAS.length ? BUSCADAS : SUGERIDAS);

function asegurarIndice(forzar) {
  if (IDX && !forzar) return Promise.resolve(IDX);
  if (pidiendo && !forzar) return pidiendo;
  // no-cache revalida; reload ignora la copia local y trae la del servidor.
  pidiendo = fetch("indice.json", { cache: forzar ? "reload" : "no-cache" })
    .then(r => r.json())
    .then(j => {
      IDX = j;
      OFERTAS = null;
      document.querySelectorAll(".tab[data-ir='buscar'] .n").forEach(n => { n.textContent = j.productos.length; });
      programarOfertas(j);
      return j;
    })
    .finally(() => { pidiendo = null; });
  return pidiendo;
}

/* Las ofertas de todo el indice (un segundo de CPU en un telefono, Lighthouse del 24/10) no frenan la busqueda: se calculan cuando
   el navegador queda libre, o enseguida si las pide la pestaña Ofertas o el modo Súper Oferta (ofertasListas). Al terminar,
   la pestaña muestra su numero y la busqueda vuelve a pintarse con «otra tienda lo tiene más barato». */
function ofertasListas() {
  if (!OFERTAS && IDX) {
    OFERTAS = calcularOfertas(IDX);
    document.querySelectorAll(".tab[data-ir='ofertas'] .n").forEach(n => { n.textContent = OFERTAS.propias.length + OFERTAS.publicadas.length + OFERTAS.seguimiento.length; });
  }
  return OFERTAS;
}
function programarOfertas(j) {
  const correr = () => {
    if (IDX !== j || OFERTAS) return;
    ofertasListas();
    if (typeof CONSULTA === "string" && CONSULTA.trim() && location.hash.slice(1) === "buscar" && typeof pintarResultados === "function")
      pintarResultados(CONSULTA);
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(correr, { timeout: 4000 });
  else setTimeout(correr, 300);
}

/* --- Ofertas: tarjetas que se filtran, se ordenan y se abren ------------
   Que es una oferta (bajas propias y rebajas publicadas) vive en js/ofertas.js, compartido con el
   feed RSS y el canal de Telegram. */
const { PISO_OFERTA, DESCUENTO_MAX, BAJA_MIN_PESOS, calcularOfertas } = Ofertas;
const POR_PAGINA = 24;
const OF = { tipo: "todas", orden: "descuento", com: "", cat: "", primera: false, cruce: false, marcadas: false, pagina: 1 };
let OF_ACTUAL = [];

const leerEstrellas = () => {
  try { return new Set(JSON.parse(localStorage.getItem("estrellas") || "[]")); } catch (e) { return new Set(); }
};
let ESTRELLAS = leerEstrellas();

function listaOfertas() {
  if (!ofertasListas()) return [];
  if (OFERTAS._lista) return OFERTAS._lista;
  const nuevo = (f, ref, tipo) => ({ f, ref, tipo, off: 1 - f[1] / f[ref], ahorro: f[ref] - f[1],
    cruce: OFERTAS.cruces.has(f), vigente: OFERTAS.vigentes.has(f), contra: OFERTAS.contra.get(f), nota: OFERTAS.notas.get(f), niv: nivelMarca(f[0]), cat: OFERTAS.categorias.get(f).categoria, com: comercioDe(f) });
  return (OFERTAS._lista = [...OFERTAS.propias.map(f => nuevo(f, 6, "propia")),
                            ...OFERTAS.publicadas.map(f => nuevo(f, 5, "publicada")),
                            ...OFERTAS.seguimiento.map(f => nuevo(f, 6, "seguimiento"))]);
}

function ofertasFiltradas() {
  let l = listaOfertas();
  if (OF.tipo !== "todas") l = l.filter(o => o.tipo === OF.tipo);
  if (OF.com) l = l.filter(o => o.com === OF.com);
  if (OF.cat) l = l.filter(o => o.cat === OF.cat);
  if (OF.primera) l = l.filter(o => o.niv === 2);
  if (OF.cruce) l = l.filter(o => o.cruce);
  if (OF.marcadas) l = l.filter(o => ESTRELLAS.has(o.f[2]));
  const por = { descuento: (a, b) => b.off - a.off, ahorro: (a, b) => b.ahorro - a.ahorro,
                precio: (a, b) => a.f[1] - b.f[1] }[OF.orden];
  // Cuando se ven todas, las bajas (propias y en seguimiento, que dicen su historial) van primero, y las rebajas publicadas despues.
  const rango = { propia: 0, seguimiento: 0, publicada: 1 };
  return [...l].sort((a, b) => OF.tipo === "todas" && a.tipo !== b.tipo ? rango[a.tipo] - rango[b.tipo] : por(a, b));
}

function controlesOfertas(todas) {
  const n = { todas: todas.length, propia: todas.filter(o => o.tipo === "propia").length, seguimiento: todas.filter(o => o.tipo === "seguimiento").length };
  n.publicada = n.todas - n.propia - n.seguimiento;
  const seg = (k, v, txt, cnt) => `<button class="seg" data-of="${k}:${v}" aria-selected="${OF[k] === v}">${txt}${cnt != null ? ` <span class="n">${cnt}</span>` : ""}</button>`;
  const cuenta = key => {
    const m = new Map();
    todas.forEach(o => m.set(o[key], (m.get(o[key]) || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const coms = cuenta("com").slice(0, 6);
  // Las categorias de la pagina (monitores, PCs, notebooks, smartphones, componentes y perifericos), no la primera palabra del titulo.
  const porCat = new Map(cuenta("cat"));
  const cats = Categorias.ORDEN.filter(c => porCat.has(c)).map(c => [c, porCat.get(c)]);
  const chip = (k, v, txt, cnt, on) => `<button class="of-chip" data-of="${k}:${esc(v)}" aria-pressed="${on}">${esc(txt)} <span class="n">${cnt}</span></button>`;
  return `<div class="of-ctrl">
    <div class="segmentos chico">${seg("tipo", "todas", "Todas", n.todas)}${seg("tipo", "propia", "Bajaron de precio", n.propia)}${seg("tipo", "publicada", "Rebajas publicadas", n.publicada)}${n.seguimiento ? seg("tipo", "seguimiento", "En seguimiento", n.seguimiento) : ""}</div>
    <div class="segmentos chico">${seg("orden", "descuento", "Mayor descuento")}${seg("orden", "ahorro", "Mayor ahorro $")}${seg("orden", "precio", "Menor precio")}</div>
    <div class="of-fila"><span class="of-et">Comercio</span>${coms.map(([c, k]) => chip("com", c, c, k, OF.com === c)).join("")}</div>
    <div class="of-fila"><span class="of-et">Rubro</span>${cats.map(([c, k]) => chip("cat", c, Categorias.ETIQUETAS[c], k, OF.cat === c)).join("")}</div>
    <div class="of-fila">
      <button class="of-chip" data-of="primera:1" aria-pressed="${OF.primera}">${icono("trofeo")} Solo primera línea</button>
      <button class="of-chip" data-of="cruce:1" aria-pressed="${OF.cruce}" title="Ofertas reales de gama alta que cuestan lo mismo o menos que la mediana de la gama media">Gama alta al precio de media <span class="n">${todas.filter(o => o.cruce).length}</span></button>
      <button class="of-chip" data-of="marcadas:1" aria-pressed="${OF.marcadas}">★ Marcadas <span class="n">${ESTRELLAS.size}</span></button>
    </div></div>`;
}

function cardOferta(o, i, desde) {
  const f = o.f, t = IDX.tiendas[f[3]] || { nombre: f[3], color: "fh" };
  const pct = Math.round(o.off * 100);
  const anillo = Math.min(100, Math.round(o.off / DESCUENTO_MAX * 100));
  const marcada = ESTRELLAS.has(f[2]);
  const nivTxt = ["sin marca reconocida", "marca conocida", "primera línea"][o.niv];
  const origen = o.tipo === "propia"
    ? "El precio anterior es lo que valía en nuestro relevamiento previo: lo calculamos nosotros."
    : o.tipo === "seguimiento"
      ? "Lo seguimos hace menos de una semana: el precio anterior es el más bajo que vimos desde entonces. Todavía no alcanza para decir que bajó contra sus 30 días."
      : "El precio anterior es el tachado que publica el comercio: tomalo como referencia, no como verdad.";
  const foto = fondo(f[7]);
  const img = foto ? `<div class="o-img" style="background-image:url(&quot;${foto}&quot;)" title="${esc(f[0])}"></div>` : `<div class="o-img o-sin-img">${icono("fuera")}</div>`;
  return `<article class="ocard c-${t.color} ${o.tipo}${i < desde ? " quieta" : ""}" style="--i:${i - desde}" tabindex="0" aria-label="${esc(f[0])}">
    ${img}
    <div class="o-top">
      <span class="o-cinta">${o.tipo === "propia" ? icono("flechaAbajo") + " bajó de precio" : o.tipo === "seguimiento" ? icono("flechaAbajo") + " bajó desde que lo seguimos" : icono("fuego") + " rebaja publicada"}</span>
      <button class="o-star${marcada ? " on" : ""}" data-estrella="${esc(f[2])}" title="Marcar esta oferta" aria-label="Marcar esta oferta">${marcada ? "★" : "☆"}</button>
    </div>
    <div class="o-main">
      <div class="o-off" style="--p:${anillo}"><b data-n="${pct}">${pct}%</b></div>
      <h3 class="o-nom">${Titulo.html(f[0], esc)}</h3>
    </div>
    <span class="tienda">${icono("store")} ${esc(comercioDe(f))}${f[4] ? ` · vía ${esc(t.nombre)}` : ""}</span>
    <div class="o-precios"><span class="ahora">${pesos(f[1])}</span><span class="antes">${pesos(f[o.ref])}</span></div>
    ${selloOjo(viejoDe(f))}
    ${o.contra ? `<p class="o-contra">Cruza contra la ${esc(Ofertas.textoContra(o.contra, pesos))}</p>` : ""}
    ${o.nota ? `<p class="o-contra">${esc(o.nota[0].toUpperCase() + o.nota.slice(1))}.</p>` : ""}
    <div class="o-ahorro">Ahorrás <b>${pesos(o.ahorro)}</b></div>
    ${historialHtml(f)}
    <div class="o-detalle"><div class="o-in">
      <div class="chips"><span class="chip${o.niv === 2 ? " ok" : ""}">${nivTxt}</span>${o.cruce ? `<span class="chip ok">${o.vigente ? "gama alta del año anterior, vigente, " : "gama alta "}al precio de media</span>` : ""}</div>
      <p>${origen}</p></div></div>
    <div class="o-acciones">
      <a class="acc" href="${hrefTienda(f[2])}" target="_blank" rel="${relTienda(f[2])}">${icono("fuera")} Abrir</a>${selloAfiliado(f[2])}
      <button class="acc" data-comparar-oferta="${i}">${icono("balanza")} Comparar</button>
    </div>
  </article>`;
}

function animarCuentas() {
  const reducir = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".ocard:not(.quieta) .o-off b[data-n]").forEach(b => {
    const n = +b.dataset.n;
    if (reducir) return;
    const t0 = performance.now();
    const paso = t => {
      const k = Math.min(1, (t - t0) / 650);
      b.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))) + "%";
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  });
}

function vistaOfertas() {
  setTimeout(async () => {
    try { await asegurarIndice(); pintarOfertas(); }
    catch (e) { const el = $("#estadoOf"); if (el) el.textContent = "no pude cargar el índice"; }
  }, 0);
  return `<div class="panel"><div class="panel-head"><h2>${icono("fuego")} Ofertas imperdibles</h2>
    <p class="sub">Dos señales distintas. Las que <b>bajaron de precio</b> las detecta la propia app comparando contra el precio más bajo de los 30 días anteriores,
    así que no dependen de lo que publique la tienda. Las <b>rebajas publicadas</b> son el precio tachado del comercio: una referencia, no una verdad.
    Tocá una tarjeta para ver el detalle.</p></div>
    <p class="estado" id="estadoOf">buscando rebajas…</p>
    ${barraAcciones("ofertas")}
    <div id="resOf"></div></div>`;
}

function pintarOfertas(append) {
  const caja = $("#resOf"), est = $("#estadoOf");
  if (!caja || !IDX) return;
  const todas = listaOfertas();
  if (!todas.length) {
    const sinCampo = !(IDX.campos || []).includes("antes");
    est.textContent = sinCampo ? "el índice todavía no registra precios anteriores" : "no hay rebajas en este relevamiento: en Buscar ves los precios y desde cuándo no cambian";
    caja.innerHTML = sinCampo ? `<p class="sub">Hace falta volver a indexar con <code>python indexar.py</code>.</p>`
                              : `<p class="sub">Volvé mañana: el índice se rearma una vez por día. El último relevamiento fue ${Pagina.cuando(IDX.generado)}.</p>`;
    return;
  }
  OF_ACTUAL = ofertasFiltradas();
  const visibles = OF_ACTUAL.slice(0, OF.pagina * POR_PAGINA);
  const desde = append ? (OF.pagina - 1) * POR_PAGINA : 0;
  const ahorro = OF_ACTUAL.reduce((a, o) => a + o.ahorro, 0);
  // Una categoria sin ofertas no es un error: puede no haber habido descuentos. Se dice, y se manda al buscador, que muestra
  // desde cuando no cambia el precio.
  const conOferta = new Set([...OFERTAS.categorias.values()].map(g => g.categoria));
  const sin = ["smartphone", "notebook", "monitor", "pc"].filter(c => !conOferta.has(c)).map(c => Categorias.ETIQUETAS[c].toLowerCase());
  const nota = sin.length ? ` · hoy sin ofertas en ${sin.join(", ")}: en Buscar ves sus precios y desde cuándo no cambian` : "";
  est.textContent = `${OF_ACTUAL.length} ofertas`
    + (OF_ACTUAL.length ? ` · ahorro promedio ${pesos(ahorro / OF_ACTUAL.length)} por producto` : "")
    + nota
    + (OFERTAS.descartadas ? ` · ${OFERTAS.descartadas} con descuento quedaron afuera por no llegar a los mínimos de su categoría` : "");
  const resto = OF_ACTUAL.length - visibles.length;
  caja.innerHTML = controlesOfertas(todas)
    + (visibles.length
      ? `<div class="ogrid">${visibles.map((o, i) => cardOferta(o, i, desde)).join("")}</div>`
        + (resto > 0 ? `<div class="mas"><button class="acc" data-of="mas:1">Ver ${Math.min(POR_PAGINA, resto)} más · quedan ${resto}</button></div>` : "")
      : `<p class="sub">Ninguna oferta coincide con esos filtros. Probá sacando alguno.</p>`);
  animarCuentas();
}

function ofertasAccion(el) {
  const raw = el.dataset.of, i = raw.indexOf(":");
  const k = raw.slice(0, i), v = raw.slice(i + 1);
  if (k === "mas") { OF.pagina++; return pintarOfertas(true); }
  if (k === "tipo" || k === "orden") OF[k] = v;
  else if (k === "com" || k === "cat") OF[k] = OF[k] === v ? "" : v;
  else if (k === "primera") OF.primera = !OF.primera;
  else if (k === "cruce") OF.cruce = !OF.cruce;
  else if (k === "marcadas") OF.marcadas = !OF.marcadas;
  OF.pagina = 1;
  pintarOfertas();
}

function marcarEstrella(btn) {
  const u = btn.dataset.estrella;
  if (ESTRELLAS.has(u)) ESTRELLAS.delete(u); else ESTRELLAS.add(u);
  try { localStorage.setItem("estrellas", JSON.stringify([...ESTRELLAS].slice(-200))); } catch (e) { /* sin storage no persiste */ }
  if (OF.marcadas) return pintarOfertas();
  btn.classList.toggle("on", ESTRELLAS.has(u));
  btn.textContent = ESTRELLAS.has(u) ? "★" : "☆";
  const n = document.querySelector("[data-of='marcadas:1'] .n");
  if (n) n.textContent = ESTRELLAS.size;
}

/* "Comparar" desde una oferta: con marca y submarca («Soundcore AeroFit 2 by Anker») prueba submarca + modelo, despues
   el modelo y por ultimo marca madre + modelo; sin ellas busca la categoria y la marca, sin el codigo de modelo, y
   abre la comparativa de esos resultados, solo con los avisos de las mismas especificaciones que la oferta (spec 017). */
function compararOferta(i) {
  const o = OF_ACTUAL[i];
  if (!o) return;
  compararConsulta(Buscador.consultaDeOferta(o.f[0], hayResultados), o.f);
}

document.addEventListener("keydown", ev => {
  if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("ocard")) {
    ev.preventDefault();
    ev.target.classList.toggle("abierta");
  }
});
