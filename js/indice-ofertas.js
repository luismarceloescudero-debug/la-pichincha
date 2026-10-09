/* --- Indice compartido: lo usan Buscar y Ofertas ---------------------
   Se baja una sola vez, recien cuando abris alguna de las dos. */
let IDX = null, pidiendo = null, OFERTAS = null;
const SUGERIDAS = ["ddr4 16gb", "ssd 1tb", "rtx 4060", "ryzen 5", "monitor 27", "fuente 650w", "webcam logitech"];

function asegurarIndice(forzar) {
  if (IDX && !forzar) return Promise.resolve(IDX);
  if (pidiendo && !forzar) return pidiendo;
  // no-cache revalida; reload ignora la copia local y trae la del servidor.
  pidiendo = fetch("indice.json", { cache: forzar ? "reload" : "no-cache" })
    .then(r => r.json())
    .then(j => {
      IDX = j;
      OFERTAS = calcularOfertas(j);
      document.querySelectorAll(".tab[data-ir='buscar'] .n").forEach(n => { n.textContent = j.productos.length; });
      document.querySelectorAll(".tab[data-ir='ofertas'] .n").forEach(n => { n.textContent = OFERTAS.propias.length + OFERTAS.publicadas.length; });
      return j;
    })
    .finally(() => { pidiendo = null; });
  return pidiendo;
}

/* --- Ofertas: tarjetas que se filtran, se ordenan y se abren ------------
   Que es una oferta (bajas propias y rebajas publicadas) vive en js/ofertas.js, compartido con el
   feed RSS y el canal de Telegram. */
const { PISO_OFERTA, DESCUENTO_MIN, DESCUENTO_MAX, BAJA_MIN_PCT, BAJA_MIN_PESOS, calcularOfertas } = Ofertas;
const POR_PAGINA = 24;
const OF = { tipo: "todas", orden: "descuento", com: "", cat: "", primera: false, marcadas: false, pagina: 1 };
let OF_ACTUAL = [];

const leerEstrellas = () => {
  try { return new Set(JSON.parse(localStorage.getItem("estrellas") || "[]")); } catch (e) { return new Set(); }
};
let ESTRELLAS = leerEstrellas();

function listaOfertas() {
  if (!OFERTAS) return [];
  if (OFERTAS._lista) return OFERTAS._lista;
  const nuevo = (f, ref, tipo) => ({ f, ref, tipo, off: 1 - f[1] / f[ref], ahorro: f[ref] - f[1],
    niv: nivelMarca(f[0]), cat: categoriaDe(f[0]), com: comercioDe(f) });
  return (OFERTAS._lista = [...OFERTAS.propias.map(f => nuevo(f, 6, "propia")),
                            ...OFERTAS.publicadas.map(f => nuevo(f, 5, "publicada"))]);
}

function ofertasFiltradas() {
  let l = listaOfertas();
  if (OF.tipo !== "todas") l = l.filter(o => o.tipo === OF.tipo);
  if (OF.com) l = l.filter(o => o.com === OF.com);
  if (OF.cat) l = l.filter(o => o.cat === OF.cat);
  if (OF.primera) l = l.filter(o => o.niv === 2);
  if (OF.marcadas) l = l.filter(o => ESTRELLAS.has(o.f[2]));
  const por = { descuento: (a, b) => b.off - a.off, ahorro: (a, b) => b.ahorro - a.ahorro,
                precio: (a, b) => a.f[1] - b.f[1] }[OF.orden];
  // Cuando se ven todas, las bajas propias van primero: son la señal mas confiable.
  return [...l].sort((a, b) => OF.tipo === "todas" && a.tipo !== b.tipo ? (a.tipo === "propia" ? -1 : 1) : por(a, b));
}

function controlesOfertas(todas) {
  const n = { todas: todas.length, propia: todas.filter(o => o.tipo === "propia").length };
  n.publicada = n.todas - n.propia;
  const seg = (k, v, txt, cnt) => `<button class="seg" data-of="${k}:${v}" aria-selected="${OF[k] === v}">${txt}${cnt != null ? ` <span class="n">${cnt}</span>` : ""}</button>`;
  const cuenta = key => {
    const m = new Map();
    todas.forEach(o => m.set(o[key], (m.get(o[key]) || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const coms = cuenta("com").slice(0, 6);
  // "Outlet" o "Combo" son condiciones del aviso, no rubros.
  const NO_RUBRO = ["outlet", "combo", "kit", "nuevo", "oferta", "usado"];
  const cats = cuenta("cat").filter(([c, k]) => k >= 5 && c.length > 2 && !NO_RUBRO.includes(c)).slice(0, 8);
  const chip = (k, v, txt, cnt, on) => `<button class="of-chip" data-of="${k}:${esc(v)}" aria-pressed="${on}">${esc(txt)} <span class="n">${cnt}</span></button>`;
  return `<div class="of-ctrl">
    <div class="segmentos chico">${seg("tipo", "todas", "Todas", n.todas)}${seg("tipo", "propia", "Bajaron de precio", n.propia)}${seg("tipo", "publicada", "Rebajas publicadas", n.publicada)}</div>
    <div class="segmentos chico">${seg("orden", "descuento", "Mayor descuento")}${seg("orden", "ahorro", "Mayor ahorro $")}${seg("orden", "precio", "Menor precio")}</div>
    <div class="of-fila"><span class="of-et">Comercio</span>${coms.map(([c, k]) => chip("com", c, c, k, OF.com === c)).join("")}</div>
    <div class="of-fila"><span class="of-et">Rubro</span>${cats.map(([c, k]) => chip("cat", c, c[0].toUpperCase() + c.slice(1), k, OF.cat === c)).join("")}</div>
    <div class="of-fila">
      <button class="of-chip" data-of="primera:1" aria-pressed="${OF.primera}">${icono("trofeo")} Solo primera línea</button>
      <button class="of-chip" data-of="marcadas:1" aria-pressed="${OF.marcadas}">★ Marcadas <span class="n">${ESTRELLAS.size}</span></button>
    </div></div>`;
}

function cardOferta(o, i, desde) {
  const f = o.f, t = IDX.tiendas[f[3]] || { nombre: f[3], color: "fh" };
  const pct = Math.round(o.off * 100);
  const anillo = Math.min(100, Math.round(o.off / DESCUENTO_MAX * 100));
  const specs = Object.values(specsDe(f[0])).slice(0, 5);
  const marcada = ESTRELLAS.has(f[2]);
  const nivTxt = ["sin marca reconocida", "marca conocida", "primera línea"][o.niv];
  const origen = o.tipo === "propia"
    ? "El precio anterior es lo que valía en nuestro relevamiento previo: lo calculamos nosotros."
    : "El precio anterior es el tachado que publica el comercio: tomalo como referencia, no como verdad.";
  const img = f[7] ? `<div class="o-img" style="background-image:url(&quot;${esc(f[7])}&quot;)" title="${esc(f[0])}"></div>` : `<div class="o-img o-sin-img">${icono("fuera")}</div>`;
  return `<article class="ocard c-${t.color} ${o.tipo}${i < desde ? " quieta" : ""}" style="--i:${i - desde}" tabindex="0" aria-label="${esc(f[0])}">
    ${img}
    <div class="o-top">
      <span class="o-cinta">${o.tipo === "propia" ? icono("flechaAbajo") + " bajó de precio" : icono("fuego") + " rebaja publicada"}</span>
      <button class="o-star${marcada ? " on" : ""}" data-estrella="${esc(f[2])}" title="Marcar esta oferta" aria-label="Marcar esta oferta">${marcada ? "★" : "☆"}</button>
    </div>
    <div class="o-main">
      <div class="o-off" style="--p:${anillo}"><b data-n="${pct}">${pct}%</b></div>
      <h3 class="o-nom">${esc(f[0])}</h3>
    </div>
    <span class="tienda">${icono("store")} ${esc(comercioDe(f))}${f[4] ? ` · vía ${esc(t.nombre)}` : ""}</span>
    <div class="o-precios"><span class="ahora">${pesos(f[1])}</span><span class="antes">${pesos(f[o.ref])}</span></div>
    ${selloOjo(viejoDe(f))}
    <div class="o-ahorro">Ahorrás <b>${pesos(o.ahorro)}</b></div>
    <div class="o-detalle"><div class="o-in">
      <div class="chips">${specs.map(v => `<span class="chip">${esc(v)}</span>`).join("")}<span class="chip${o.niv === 2 ? " ok" : ""}">${nivTxt}</span></div>
      <p>${origen}</p></div></div>
    <div class="o-acciones">
      <a class="acc" href="${f[2]}" target="_blank" rel="noopener">${icono("fuera")} Abrir</a>
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
    <p class="sub">Dos señales distintas. Las que <b>bajaron de precio</b> las detecta la propia app comparando contra el relevamiento anterior,
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
    est.textContent = sinCampo ? "el índice todavía no registra precios anteriores" : "no hay rebajas en este relevamiento";
    caja.innerHTML = sinCampo ? `<p class="sub">Hace falta volver a indexar con <code>python indexar.py</code>.</p>`
                              : `<p class="sub">Volvé mañana: el índice se rearma una vez por día. El último relevamiento fue ${Pagina.cuando(IDX.generado)}.</p>`;
    return;
  }
  OF_ACTUAL = ofertasFiltradas();
  const visibles = OF_ACTUAL.slice(0, OF.pagina * POR_PAGINA);
  const desde = append ? (OF.pagina - 1) * POR_PAGINA : 0;
  const ahorro = OF_ACTUAL.reduce((a, o) => a + o.ahorro, 0);
  est.textContent = `${OF_ACTUAL.length} ofertas`
    + (OF_ACTUAL.length ? ` · ahorro promedio ${pesos(ahorro / OF_ACTUAL.length)} por producto` : "");
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

/* "Comparar" desde una oferta: busca la categoria y la marca, sin el codigo de modelo,
   y abre la comparativa de esos resultados. */
function compararOferta(i) {
  const o = OF_ACTUAL[i];
  if (!o) return;
  const palabras = o.f[0].split(/\s+/).filter(w => w.length >= 2 && !/\d/.test(w));
  compararConsulta((palabras.slice(0, 3).join(" ") || o.f[0].split(/\s+/).slice(0, 2).join(" ")));
}

document.addEventListener("keydown", ev => {
  if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("ocard")) {
    ev.preventDefault();
    ev.target.classList.toggle("abierta");
  }
});
