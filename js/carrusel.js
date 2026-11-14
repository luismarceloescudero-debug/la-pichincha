/* Comparativa en el celular: una tarjeta grande por pantalla (14/11, pedido del dueño; maqueta en docs/plan-comparativa-tarjetas.md).
   Este archivo tiene dos partes:
   1. Logica pura, sin DOM (se prueba en Node): leer un gesto, moverse entre tarjetas, el diferencial contra la anterior y la
      lista de Seguidos (se guarda solo en este celular, en localStorage; no hay cuenta ni avisos).
   2. Comportamiento (solo navegador): el desplazamiento lateral lo hace el propio navegador (scroll-snap, sin librerias);
      aca se suma deslizar hacia arriba para abrir la ficha, mantener apretado para seguir (con vibracion corta), las etiquetas
      flotantes para cambiar de seccion y el teclado. Todo gesto tiene tambien su boton: ninguno es la unica via. */
(function (raiz) {
  "use strict";

  const CLAVE = "pichincha.seguidos";
  const MAX_SEGUIDOS = 50;
  const UMBRAL = { lateral: 50, vertical: 60, quieto: 10, mantener: 550 };
  const SECCIONES = ["tarjetas", "diferencias", "tiendas", "seguidos"];
  const MOVIL = "(max-width: 700px) and (pointer: coarse)";

  /* --- Logica pura --- */

  /* Que gesto fue: dx y dy en pixeles desde que se apoyo el dedo, ms lo que estuvo apoyado. */
  function gesto({ dx = 0, dy = 0, ms = 0 } = {}) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < UMBRAL.quieto && ay < UMBRAL.quieto) return ms >= UMBRAL.mantener ? "mantener" : "toque";
    if (ax >= UMBRAL.lateral && ax > ay) return dx < 0 ? "izq" : "der";
    if (ay >= UMBRAL.vertical && ay > ax) return dy < 0 ? "arriba" : "abajo";
    return "toque";
  }

  /* El indice al que se pasa con un gesto o una tecla; no da la vuelta: la primera y la ultima son bordes. */
  function mover(i, dir, n) {
    const paso = dir === "izq" || dir === "ArrowRight" ? 1 : dir === "der" || dir === "ArrowLeft" ? -1 : 0;
    return Math.min(Math.max(0, i + paso), Math.max(0, n - 1));
  }
  const indiceDe = (scrollLeft, ancho) => ancho > 0 ? Math.round(scrollLeft / ancho) : 0;

  /* «+$122.138 que la A» / «−$263.861 que la A» / «igual que la A»; la primera no se compara con nadie. */
  function diferencia(precio, ref, letra, pesos) {
    if (!(ref > 0) || !(precio > 0)) return "";
    const d = Math.round(precio - ref);
    return d === 0 ? `igual que la ${letra}` : `${d > 0 ? "+" : "−"}${pesos(Math.abs(d))} que la ${letra}`;
  }

  /* Seguidos: un arreglo de {id, nombre, tienda, precio, url, fecha}. `almacen` es localStorage o algo igual; si falla
     (modo privado, cuota) la lista queda en memoria y la app sigue andando. */
  const memoria = {};
  function leerSeguidos(almacen) {
    let crudo;
    try { crudo = (almacen || raiz.localStorage).getItem(CLAVE); }
    catch (e) { return Array.isArray(memoria[CLAVE]) ? memoria[CLAVE] : []; }     // el almacen no responde: lo de esta sesion
    try {
      const v = JSON.parse(crudo || "[]");
      return Array.isArray(v) ? v.filter(x => x && typeof x.id === "string") : [];
    } catch (e) { return []; }                                                     // basura guardada: se empieza de cero
  }
  function guardarSeguidos(lista, almacen) {
    memoria[CLAVE] = lista;
    try { (almacen || raiz.localStorage).setItem(CLAVE, JSON.stringify(lista)); } catch (e) { /* queda en memoria */ }
  }
  /* Sigue o deja de seguir; devuelve {lista, siguiendo}. */
  function alternarSeguido(item, almacen) {
    const lista = leerSeguidos(almacen), i = lista.findIndex(x => x.id === item.id);
    const nueva = i >= 0 ? lista.filter((x, k) => k !== i) : [{ ...item }, ...lista].slice(0, MAX_SEGUIDOS);
    guardarSeguidos(nueva, almacen);
    return { lista: nueva, siguiendo: i < 0 };
  }
  const sigue = (id, almacen) => leerSeguidos(almacen).some(x => x.id === id);

  const esMovil = () => { try { return !!(raiz.matchMedia && raiz.matchMedia(MOVIL).matches); } catch (e) { return false; } };

  /* --- Comportamiento (solo navegador) --- */

  /* `ctx` = { esc, pesos, aviso(texto), alAbrirFicha(el) opcional }: lo que necesita del resto de la app. */
  function armar(cont, ctx = {}) {
    const doc = cont.ownerDocument, pista = cont.querySelector("[data-car-pista]");
    if (!pista) return () => {};
    const tarjetas = [...pista.querySelectorAll("[data-car-card]")];
    const pos = cont.querySelector("[data-car-pos]"), puntos = [...cont.querySelectorAll("[data-car-punto]")];
    const ficha = cont.querySelector("[data-car-hoja]"), aviso = cont.querySelector("[data-car-aviso]");
    const seg = cont.querySelector("[data-car-seguidos]"), listaSeg = cont.querySelector("[data-car-lista-seguidos]");
    const reducido = !!(raiz.matchMedia && raiz.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let actual = 0, esperando = null, ultimaFicha = null;

    const decir = texto => { if (aviso) { aviso.textContent = texto; aviso.classList.add("ver"); clearTimeout(decir.t); decir.t = setTimeout(() => aviso.classList.remove("ver"), 2400); } };
    const pintarPos = () => {
      if (pos) pos.textContent = `${actual + 1} / ${tarjetas.length}`;
      puntos.forEach((p, i) => { p.classList.toggle("on", i === actual); if (i === actual) p.setAttribute("aria-current", "true"); else p.removeAttribute("aria-current"); });
    };
    const irA = (i, suave = true) => {
      const k = Math.min(Math.max(0, i), tarjetas.length - 1);
      if (!tarjetas[k]) return;
      pista.scrollTo ? pista.scrollTo({ left: tarjetas[k].offsetLeft - pista.offsetLeft, behavior: suave && !reducido ? "smooth" : "auto" }) : (pista.scrollLeft = tarjetas[k].offsetLeft);
      actual = k; pintarPos();
    };
    const pintarSeguidos = () => {
      const lista = leerSeguidos();
      if (seg) seg.textContent = `${lista.length ? "♥" : "♡"} ${lista.length}`;
      tarjetas.forEach(t => {
        const si = lista.some(x => x.id === t.dataset.id), b = t.querySelector("[data-car-seguir]");
        t.classList.toggle("sigue", si);
        if (b) { b.setAttribute("aria-pressed", si ? "true" : "false"); b.querySelector("[data-car-seguir-txt]").textContent = si ? "Siguiendo" : "Seguir"; b.querySelector("[data-car-corazon]").textContent = si ? "♥" : "♡"; }
      });
      if (listaSeg) {
        const esc = ctx.esc || (x => x), pesos = ctx.pesos || String;
        listaSeg.innerHTML = lista.length ? lista.map(x => `<li class="car-seg-item"><span class="car-seg-nom">${esc(x.nombre)}</span>
          <span class="car-seg-det">${esc(x.tienda || "")} · lo seguías a ${pesos(x.precio)}</span>
          <a class="car-seg-ir" href="${esc(x.url)}" target="_blank" rel="noopener">Abrir ↗</a>
          <button type="button" class="car-seg-quitar" data-car-quitar="${esc(x.id)}" aria-label="Dejar de seguir ${esc(x.nombre)}">Quitar</button></li>`).join("")
          : `<li class="car-vacio">Todavía no seguís nada. Mantené apretada una tarjeta, o tocá «Seguir», y queda guardada acá (solo en este celular).</li>`;
      }
    };
    const seguir = t => {
      const r = alternarSeguido({ id: t.dataset.id, nombre: t.dataset.nombre, tienda: t.dataset.tienda, precio: +t.dataset.precio, url: t.dataset.url, fecha: new Date().toISOString().slice(0, 10) });
      pintarSeguidos();
      decir(r.siguiendo ? "Guardado en Seguidos" : "Ya no lo seguís");
      try { if (r.siguiendo && raiz.navigator && raiz.navigator.vibrate) raiz.navigator.vibrate(15); } catch (e) { /* sin vibracion */ }
    };
    const abrirFicha = t => {
      if (!ficha) return;
      const datos = t.querySelector("[data-car-ficha-datos]");
      ficha.querySelector("[data-car-ficha-cuerpo]").innerHTML = datos ? datos.innerHTML : "";
      ficha.hidden = false; ultimaFicha = doc.activeElement;
      requestAnimationFrame && requestAnimationFrame(() => ficha.classList.add("abierta"));
      const cerrar = ficha.querySelector("[data-car-cerrar]"); if (cerrar) cerrar.focus();
    };
    const cerrarFicha = () => {
      if (!ficha || ficha.hidden) return;
      ficha.classList.remove("abierta");
      setTimeout(() => { ficha.hidden = true; }, reducido ? 0 : 220);
      if (ultimaFicha && ultimaFicha.focus) ultimaFicha.focus();
    };
    const verSeccion = nombre => {
      if (!SECCIONES.includes(nombre)) return;
      cont.querySelectorAll("[data-car-vista]").forEach(v => { v.hidden = v.dataset.carVista !== nombre; });
      cont.querySelectorAll("[data-car-ir]").forEach(b => b.setAttribute("aria-pressed", b.dataset.carIr === nombre ? "true" : "false"));
      cont.dataset.seccion = nombre;
      if (nombre === "tarjetas") irA(actual, false);
    };

    /* gestos sobre cada tarjeta */
    const alApoyar = e => {
      const t = e.currentTarget;
      if (e.target.closest("a,button")) return;       // los botones y enlaces hacen lo suyo
      const ini = { x: e.clientX, y: e.clientY, ms: Date.now() };
      let hecho = false;
      esperando = setTimeout(() => { hecho = true; seguir(t); }, UMBRAL.mantener);
      const mover_ = ev => { if (Math.abs(ev.clientX - ini.x) > UMBRAL.quieto || Math.abs(ev.clientY - ini.y) > UMBRAL.quieto) clearTimeout(esperando); };
      const soltar = ev => {
        clearTimeout(esperando); t.removeEventListener("pointermove", mover_); t.removeEventListener("pointerup", soltar); t.removeEventListener("pointercancel", soltar);
        if (hecho || ev.type === "pointercancel") return;
        if (gesto({ dx: ev.clientX - ini.x, dy: ev.clientY - ini.y, ms: Date.now() - ini.ms }) === "arriba") abrirFicha(t);
      };
      t.addEventListener("pointermove", mover_); t.addEventListener("pointerup", soltar); t.addEventListener("pointercancel", soltar);
    };
    tarjetas.forEach(t => t.addEventListener("pointerdown", alApoyar));

    cont.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b || !cont.contains(b)) return;
      if (b.dataset.carSeguir !== undefined) seguir(b.closest("[data-car-card]"));
      else if (b.dataset.carFicha !== undefined) abrirFicha(b.closest("[data-car-card]"));
      else if (b.dataset.carCerrar !== undefined) cerrarFicha();
      else if (b.dataset.carIr) verSeccion(b.dataset.carIr);
      else if (b.dataset.carQuitar) { const sel = tarjetas.find(t => t.dataset.id === b.dataset.carQuitar); alternarSeguido(sel ? { id: sel.dataset.id } : { id: b.dataset.carQuitar }); pintarSeguidos(); }
      else if (b.dataset.carPunto !== undefined) irA(+b.dataset.carPunto);
    });
    cont.addEventListener("keydown", e => {
      if (e.key === "Escape") return cerrarFicha();
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && e.target.closest("[data-car-pista]")) { e.preventDefault(); irA(mover(actual, e.key, tarjetas.length)); }
      if (e.key === "ArrowUp" && e.target.closest("[data-car-card]")) { e.preventDefault(); abrirFicha(e.target.closest("[data-car-card]")); }
    });
    /* la posicion sale del propio desplazamiento: sirve igual con el dedo, el teclado o los puntos */
    let cuadro = 0;
    pista.addEventListener("scroll", () => {
      if (cuadro) return;
      cuadro = (raiz.requestAnimationFrame || (f => setTimeout(f, 16)))(() => { cuadro = 0; const i = indiceDe(pista.scrollLeft, pista.clientWidth); if (i !== actual && tarjetas[i]) { actual = i; pintarPos(); } });
    }, { passive: true });

    pintarPos(); pintarSeguidos(); verSeccion("tarjetas");
    if (cont.scrollIntoView) cont.scrollIntoView({ block: "start" });     // la tarjeta entra entera en la pantalla, bajo las pestañas
    return () => { clearTimeout(esperando); };
  }

  const api = { gesto, mover, indiceDe, diferencia, leerSeguidos, guardarSeguidos, alternarSeguido, sigue, esMovil, armar, UMBRAL, SECCIONES, CLAVE, MOVIL };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Carrusel = api;
})(this);
