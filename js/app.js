/* La Pichincha como app: registra el service worker, avisa cuando no hay conexion (con la fecha de
   los precios que se estan viendo) y mide la instalacion con GoatCounter. Sin cookies ni permisos.

   Lo comparten index.html y las paginas por busqueda. Script clasico, con module.exports para Node
   (node --test "tests/js/*.test.js"): todo el entorno entra por parametro, asi se prueba sin navegador. */
(function (raiz) {
  "use strict";

  const P = typeof module === "object" && module.exports ? require("./pagina.js") : raiz.Pagina;
  const DIAS_VIEJO = 7;           // pasado esto el aviso dice que los precios pueden estar viejos
  const LIMITE_SONDA_MS = 5000;   // una conexion que no contesta en 5 s cuenta como sin conexion

  /* El texto del aviso. `generado` es la hora de los precios que se estan viendo (la del indice o la
     de la pagina); sin una fecha valida avisa igual, sin inventar ninguna. */
  function avisoSinRed(generado, ahora) {
    const cuando = P.cuando(generado, ahora);
    const t = Date.parse(generado);
    const viejo = !!cuando && !isNaN(t) && ahora - t > DIAS_VIEJO * 864e5;
    if (!cuando) return { texto: "Sin conexión: estás viendo lo último que bajaste.", viejo: false };
    return { texto: `Sin conexión: estás viendo los últimos precios que bajaste (${cuando}).` +
      (viejo ? " Pueden estar viejos: confirmalos antes de comprar." : ""), viejo };
  }

  const eventoApp = tipo => ({ path: "app/" + tipo, title: tipo === "instalada" ? "app instalada" : "app abierta", event: true });

  function iniciar(ventana, documento, opc) {
    const ahora = opc.ahora || (() => new Date());
    let instaladaMedida = false;

    const aviso = () => documento.getElementById("sin-red");
    function mostrarAviso() {
      const el = aviso();
      if (!el) return;
      const a = avisoSinRed(opc.generado(), ahora());
      el.textContent = a.texto;
      el.dataset.viejo = a.viejo ? "1" : "0";
      el.hidden = false;
    }
    function ocultarAviso() { const el = aviso(); if (el) el.hidden = true; }

    /* Un HEAD sin cache al manifiesto: el service worker solo atiende GET, asi que llega a la red de
       verdad y dice si hay conexion. navigator.onLine miente con redes que no salen a internet. */
    async function comprobar() {
      let reloj;
      const limite = new Promise((_, rechazar) => { reloj = ventana.setTimeout(() => rechazar(new Error("sin respuesta")), LIMITE_SONDA_MS); });
      try {
        await Promise.race([ventana.fetch(opc.sonda, { method: "HEAD", cache: "no-store" }), limite]);
        ventana.clearTimeout(reloj);
        ocultarAviso();
      } catch (e) {
        mostrarAviso();
      }
    }

    function medir(tipo, reintento) {
      const gc = ventana.goatcounter;
      if (gc && typeof gc.count === "function") { try { gc.count(eventoApp(tipo)); } catch (e) { /* no frena nada */ } return; }
      if (!reintento) ventana.setTimeout(() => medir(tipo, true), 2000);      // GoatCounter carga async
    }

    const enModoApp = () => !!((ventana.matchMedia && ventana.matchMedia("(display-mode: standalone)").matches) ||
      (ventana.navigator && ventana.navigator.standalone));
    function medirApertura() {
      try {
        if (ventana.sessionStorage.getItem("app-abierta")) return;
        ventana.sessionStorage.setItem("app-abierta", "1");
      } catch (e) { /* sin storage: se mide igual, a lo sumo dos veces */ }
      medir("abierta");
    }

    ventana.addEventListener("load", () => {
      const sw = ventana.navigator && ventana.navigator.serviceWorker;
      if (sw) Promise.resolve(sw.register(opc.sw)).catch(() => {});
      comprobar();
      if (enModoApp()) medirApertura();
    });
    ventana.addEventListener("offline", mostrarAviso);
    ventana.addEventListener("online", comprobar);
    ventana.addEventListener("appinstalled", () => {
      if (instaladaMedida) return;
      instaladaMedida = true;
      medir("instalada");
    });

    return { mostrarAviso, ocultarAviso, comprobar };
  }

  const api = { avisoSinRed, eventoApp, iniciar, DIAS_VIEJO };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.App = api;
})(this);
