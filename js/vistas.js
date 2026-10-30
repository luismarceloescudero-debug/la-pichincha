/* --- Enlace de afiliado a Amazon (E1): siempre rotulado y aparte de los resultados, que no cambian de orden --- */
function amazonHtml(termino, texto) {
  const url = Pagina.enlaceAmazon(termino);
  if (!url) return "";
  return `<p class="afiliado"><a href="${esc(url)}" target="_blank" rel="noopener sponsored">${icono("fuera")} ${esc(texto)}</a>
    <span class="rotulo">enlace de afiliado · <a href="legal/#afiliados">qué es</a></span></p>`;
}

/* --- Tarjeta --- */
function tarjeta(p, i) {
  const t = T[p.tienda] || {};
  return `<button class="card c-${t.color || "fh"}${p.destacado ? " dest" : ""}" style="--i:${i}"
      data-abrir="${p.id}" aria-label="Ver análisis de ${esc(p.nombre)}">
    <div class="barra"></div>
    ${p.destacado ? `<span class="cinta">${icono("trofeo")} mejor</span>` : ""}
    <span class="rank">${p.podio}</span>
    <div class="foto"><img src="${esc(p.img)}" alt="${esc(p.nombre)}" loading="${i < 2 ? "eager" : "lazy"}"${i === 0 ? ' fetchpriority="high"' : ""}></div>
    <div class="cuerpo">
      <h3>${esc(p.nombre)}</h3>
      <span class="tienda">${icono("store")} ${esc(t.nombre || "")}</span>
      <div><span class="precio">${pesos(p.precio)}</span>${p.precio_lista ? `<span class="antes">${pesos(p.precio_lista)}</span>` : ""}</div>
      <p class="titular">${esc(p.titular || "")}</p>
      <div class="chips">${chipOjo(avisoDe(p))}${(p.chips || []).map(c => `<span class="chip${/ns|retiro|stock|OFF/.test(c) ? " ok" : ""}">${esc(c)}</span>`).join("")}</div>
      <div class="pie">
        <span class="ver">Ver análisis ${icono("der")}</span>
        <span class="ir">${icono("fuera")} ${esc(t.nombre || "")}</span>
      </div>
    </div>
  </button>`;
}

/* --- Tabla comparativa, resaltando el producto abierto --- */
function comparativa(grupo, foco) {
  const filas = Object.keys(grupo[0].specs || {});
  const color = T[foco.tienda].color;
  const mejor = {
    "Latencia real": v => v === "10,0 ns", "Disipador": v => v.startsWith("sí"),
    "Garantía local": v => parseInt(v) >= 36, "Retiro en Mendoza": v => v.startsWith("sí"),
    "Voltaje del perfil": v => v.includes("1,2"), "Rangos": v => v.startsWith("doble")
  };
  return `<div class="scroll"><table>
    <thead><tr><th>&nbsp;</th>${grupo.map(p =>
      `<th class="${p.id === foco.id ? "foco" : ""}">${esc(p.corto)}</th>`).join("")}</tr></thead>
    <tbody>
      <tr><th>Precio</th>${grupo.map(p => celda(pesos(p.precio) + (avisoDe(p) ? ` · ${avisoDe(p)}` : ""), p, foco, p.precio === Math.min(...grupo.map(x => x.precio)))).join("")}</tr>
      ${filas.map(f => `<tr><th>${esc(f)}</th>${grupo.map(p =>
        celda(p.specs[f], p, foco, mejor[f] ? mejor[f](p.specs[f]) : false)).join("")}</tr>`).join("")}
    </tbody></table></div>`.replace(/class="scroll"/, `class="scroll c-${color}"`);
}
const celda = (v, p, foco, destacar) =>
  `<td class="${p.id === foco.id ? "foco" : ""}${destacar ? " mejor" : ""}">${esc(v)}</td>`;

/* --- Vista de analisis --- */
function detalle(p) {
  const t = T[p.tienda], grupo = p.tipo === "ram" ? rams : cams;
  return `<div class="detalle c-${t.color}">
    <button class="volver" data-volver>${icono("izq")} Volver a la comparativa</button>
    ${barraAcciones(p.id)}
    <div class="dcab">
      <div class="dfoto"><img src="${esc(p.img)}" alt="${esc(p.nombre)}"></div>
      <div>
        <h2>${esc(p.nombre)}</h2>
        <p class="dsku">${esc(p.sku || "")}</p>
        <span class="tienda">${icono("store")} ${esc(t.nombre)} · ${esc(t.entrega)}</span>
      </div>
      <div class="dprecio">
        <a class="v" href="${enlace(p.url)}" target="_blank" rel="noopener">${pesos(p.precio)}</a>
        ${avisoDe(p) ? `<span class="l">${selloOjo(avisoDe(p))}</span>` : ""}
        <span class="l">${p.precio_lista ? "lista " + pesos(p.precio_lista) + " · " : ""}${esc(t.promo)}</span>
        <span class="l"><a class="ir" href="${enlace(p.url)}" target="_blank" rel="noopener">${icono("fuera")} abrir en ${esc(t.nombre)}</a></span>
      </div>
    </div>
    ${amazonHtml(p.corto || p.nombre, `Comparar con Amazon (EE.UU.): ${p.corto || p.nombre}`)}
    <div class="dos">
      <div class="bloque"><h3>${icono("check")} A favor</h3>
        <ul class="lista">${(p.pros || []).map(x => `<li class="p">${esc(x)}</li>`).join("")}</ul></div>
      <div class="bloque"><h3>${icono("aviso")} En contra</h3>
        <ul class="lista">${(p.contras || []).map(x => `<li class="m">${esc(x)}</li>`).join("")}</ul></div>
    </div>
    <div class="panel-head"><h2>${icono("balanza")} Lo que cambia entre las tres</h2>
      <p class="sub">La columna resaltada es la que estás mirando. En verde, el mejor valor de cada fila.</p></div>
    ${comparativa(grupo, p)}
  </div>`;
}

/* --- Pestañas y sello: los arma el JS al arrancar y, en la portada publicada, generar_portada.js --- */
/* Patron de pestañas de ARIA: cada una controla #vista (el tabpanel) y solo la elegida entra en el orden de Tab
   (tabindex itinerante); entre ellas se va con las flechas, Inicio y Fin (js/arranque.js). Sin elegida, entra la primera. */
function pestanasHtml(activa) {
  return VISTAS.map((v, i) => {
    const n = v.n(), enTab = activa ? v.id === activa : i === 0;
    return `<button class="tab" role="tab" id="tab-${v.id}" aria-controls="vista" tabindex="${enTab ? 0 : -1}" data-ir="${v.id}" data-dina="${DINAMICAS.includes(v.id) ? 1 : 0}" aria-selected="${v.id === activa}">
      ${icono(v.ico)} ${v.eti}${n ? ` <span class="n">${n}</span>` : ""}</button>`;
  }).join("");
}

/* A que pestaña pasa el foco con una tecla, o null si la tecla no es de las pestañas. Se activa con Enter o espacio
   (activacion manual): pasar por Ofertas con las flechas no tiene que bajar el indice. */
function tabDestino(ids, actual, tecla) {
  const i = ids.indexOf(actual), n = ids.length;
  if (i < 0 || !n) return null;
  if (tecla === "ArrowRight") return ids[(i + 1) % n];
  if (tecla === "ArrowLeft") return ids[(i - 1 + n) % n];
  if (tecla === "Home") return ids[0];
  if (tecla === "End") return ids[n - 1];
  return null;
}

function selloTexto() {
  return (DATOS.verificado
    ? `Precios verificados en cada sitio ${Pagina.cuando(DATOS.verificado)}`
    : `Precios verificados en cada sitio · actualizado ${DATOS.actualizado}`) + ` · ${P.length} productos seguidos`
    + (P.some(p => p.falla_desde) ? ` · ${P.filter(p => p.falla_desde).length} sin verificar` : "");
}

/* --- Vistas --- */
function vistaComparativa() {
  // Tu ultima busqueda (spec 021) necesita el indice: solo se baja si hay busquedas guardadas (la portada no lo espera).
  setTimeout(() => { if (leerHistCompleto().length) asegurarIndice().then(() => { pintarTira(); pintarReciente(); }).catch(() => {}); }, 0);
  // Lo ultimo en tecnologia (spec 017, fase 2): lo calcula el build (NOVEDADES) y va primero. Sin esos datos no hay panel.
  const novedades = typeof NOVEDADES !== "undefined" ? Novedades.novedadesHtml(NOVEDADES, { esc, pesos, enlace, icono }) : "";
  // Lo mas buscado (fase 3): terminos agregados y filtrados por el build (BUSCADAS, js/buscadas.js). Primero, antes de las novedades.
  const buscado = typeof BUSCADAS !== "undefined" ? Novedades.masBuscadasHtml(BUSCADAS, { esc }) : "";
  // Lo mas vendido en las tiendas (spec 019): lo calcula el build (VENDIDOS) con el orden de cada tienda. Despues de lo mas buscado.
  const vendido = typeof VENDIDOS !== "undefined" ? Novedades.masVendidosHtml(VENDIDOS, { esc, pesos, enlace, icono }) : "";
  // Al final, lo tuyo: la tira de tus busquedas y la comparativa de la mas reciente. El analisis curado del primer relevamiento
  // (memorias DDR4 y webcams) ya no se muestra: quedaba fijo y parecia una busqueda tuya.
  return buscado + vendido + novedades + `<div class="panel"><div class="ultimas" id="ultimas">${tiraHtml(false)}</div>
    <div id="reciente"></div></div>`;
}

/* Veredicto sin una busqueda activa (spec 021): se escribe con la busqueda mas reciente. Mientras llega el indice avisa; si no hay
   ninguna busqueda con resultados, invita a buscar. Ya no repite el veredicto fijo del primer relevamiento. */
function vistaVeredicto() {
  setTimeout(() => abrirReciente("veredicto"), 0);
  return veredictoVacio(IDX ? "" : "Armando el veredicto de tu última búsqueda…");
}

function veredictoVacio(aviso) {
  return `<div class="panel"><div class="panel-head"><h2>${icono("trofeo")} Veredicto</h2>
    <p class="sub">${esc(aviso || "Buscá un producto y el veredicto se escribe solo con los precios de hoy: qué comprar, dónde y qué descartar.")}</p></div>
    ${aviso ? "" : `<button class="acc" data-ir-vista="buscar">${icono("lupa")} Buscar un producto</button>`}</div>`;
}
