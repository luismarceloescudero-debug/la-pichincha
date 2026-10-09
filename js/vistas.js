/* --- Tarjeta --- */
function tarjeta(p, i) {
  const t = T[p.tienda] || {};
  return `<button class="card c-${t.color || "fh"}${p.destacado ? " dest" : ""}" style="--i:${i}"
      data-abrir="${p.id}" aria-label="Ver análisis de ${esc(p.nombre)}">
    <div class="barra"></div>
    ${p.destacado ? `<span class="cinta">${icono("trofeo")} mejor</span>` : ""}
    <span class="rank">${p.podio}</span>
    <div class="foto"><img src="${p.img}" alt="${esc(p.nombre)}" loading="lazy"></div>
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
      <div class="dfoto"><img src="${p.img}" alt="${esc(p.nombre)}"></div>
      <div>
        <h2>${esc(p.nombre)}</h2>
        <p class="dsku">${esc(p.sku || "")}</p>
        <span class="tienda">${icono("store")} ${esc(t.nombre)} · ${esc(t.entrega)}</span>
      </div>
      <div class="dprecio">
        <a class="v" href="${p.url}" target="_blank" rel="noopener">${pesos(p.precio)}</a>
        ${avisoDe(p) ? `<span class="l">${selloOjo(avisoDe(p))}</span>` : ""}
        <span class="l">${p.precio_lista ? "lista " + pesos(p.precio_lista) + " · " : ""}${esc(t.promo)}</span>
        <span class="l"><a class="ir" href="${p.url}" target="_blank" rel="noopener">${icono("fuera")} abrir en ${esc(t.nombre)}</a></span>
      </div>
    </div>
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

/* --- Vistas --- */
function vistaComparativa() {
  const c = CATEGORIAS.find(x => x.id === CAT) || CATEGORIAS[0];
  // Los precios de la tira necesitan el indice; solo se baja si hay busquedas guardadas.
  setTimeout(() => { if (leerHistCompleto().length) asegurarIndice().then(pintarTira).catch(() => {}); }, 0);
  return `<div class="panel"><div class="panel-head"><h2>${esc(c.titulo)}</h2><p class="sub">${esc(c.sub)}</p></div>
    <div class="ultimas" id="ultimas">${tiraHtml(false)}</div>
    ${barraAcciones("comparativa")}
    <div class="grid">${c.lista.map(tarjeta).join("")}</div></div>`;
}

function vistaTiendas() {
  const ganadores = {
    compragamer: ["corsair-lpx", "brio4k", "brio505", "adata-d35"],
    gamingcity: ["kingston-kvr", "c920s", "genius1000x"],
    mexx: ["hiksemi-armor", "c922", "brio100", "gw911"]
  };
  const flaco = {
    compragamer: "Catálogo chico: cuatro webcams en total y no vende módulos Kingston ValueRAM sueltos.",
    gamingcity: "Cuando pierde, pierde feo: la Fury Beast RGB y la MX Brio son los peores precios del relevamiento.",
    mexx: "El catálogo tira a segunda línea y en gama alta se dispara."
  };
  const cards = Object.keys(ganadores).map((k, i) => {
    const t = T[k];
    return `<div class="card c-${t.color}" style="--i:${i};cursor:default">
      <div class="barra"></div>
      <span class="rank">${i + 1}</span>
      <div class="cuerpo" style="padding-top:20px">
        <h3 style="color:var(--c)">${icono("store")} ${esc(t.nombre)}</h3>
        <p class="titular" style="font-family:var(--font-mono);font-size:.8rem">${esc(t.rol)}</p>
        <ul class="wins">${ganadores[k].map(id => {
          const p = porId[id]; if (!p) return "";
          return `<li><a href="${p.url}" target="_blank" rel="noopener">
            <span class="mini"><img src="${p.img}" alt="" loading="lazy"></span>
            <span class="txt">${esc(p.nombre)}${avisoDe(p) ? ` ${selloOjo(avisoDe(p))}` : ""}</span><b>${pesos(p.precio)}</b></a></li>`;
        }).join("")}</ul>
        <p class="flaco">${icono("aviso")} ${esc(flaco[k])}</p>
      </div></div>`;
  }).join("");
  return `<div class="panel"><div class="panel-head"><h2>Las 3 webs que mejor pagan la calidad</h2>
    <p class="sub">Ninguna gana en todo. Esto es lo que cada una tiene más barato que las demás; cada línea abre el producto.</p></div>
    <div class="grid">${cards}</div>
    <p class="flaco" style="margin-top:18px">${icono("aviso")} <span><b>FullH4rd</b> queda afuera del podio pero es imbatible en Hiksemi:
    <a href="${porId["hiksemi-hiker"].url}" target="_blank" rel="noopener">el Hiker a ${pesos(porId["hiksemi-hiker"].precio)}</a>${avisoDe(porId["hiksemi-hiker"]) ? ` ${selloOjo(avisoDe(porId["hiksemi-hiker"]))}` : ""}.</span></p></div>`;
}

function vistaVeredicto() {
  const c = DATOS.calculado || {}, e = DATOS.envio || {};
  const tiles = [
    { k: "Mejor compra", v: pesos(porId["adata-d35"].precio), d: "ADATA XPG D35 · CompraGamer" + (avisoDe(porId["adata-d35"]) ? ` · ${avisoDe(porId["adata-d35"])}` : ""), ok: true },
    { k: `Puesto en ${e.zona}, punto`, v: pesos(c.adata_punto), d: `envío OCA ${pesos(e.punto)}`, ok: true },
    { k: `Puesto en ${e.zona}, domicilio`, v: pesos(c.adata_domicilio), d: `envío OCA ${pesos(e.domicilio)}` },
    { k: "Kingston, retiro gratis", v: pesos(c.kingston_retiro), d: `${pesos(c.kingston_retiro - c.adata_domicilio)} más caro` }
  ];
  return `<div class="panel"><div class="panel-head"><h2>Veredicto</h2>
    <p class="sub">Todo recalculado con los precios de hoy, envío a CP ${esc(e.cp)} incluido.</p></div>
    <div class="tiles">${tiles.map((t, i) => `<div class="tile${t.ok ? " ok" : ""}" style="--i:${i}">
      <div class="k">${esc(t.k)}</div><div class="v">${t.v}</div><div class="d">${esc(t.d)}</div></div>`).join("")}</div>
    <div class="tiles"><div class="tile" style="--i:0"><div class="k">${icono("camion")} Combo RAM + webcam, todo en Gaming City</div>
      <div class="v">${pesos(c.combo_gc)}</div><div class="d">una sola compra, retiro gratis</div></div>
      <div class="tile ok" style="--i:1"><div class="k">${icono("camion")} Combo partido entre dos tiendas</div>
      <div class="v">${pesos(c.combo_partido)}</div><div class="d">${pesos(c.combo_gc - c.combo_partido)} menos, y la RAM mejora</div></div></div>
    ${(DATOS.veredicto || []).map((v, i) => `<div class="ver-item" style="--i:${i}">
      <b>${esc(v.t)}</b><p>${esc(v.d)}</p></div>`).join("")}</div>`;
}
