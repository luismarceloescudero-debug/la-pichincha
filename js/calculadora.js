/* La calculadora de costos en la pagina (plan v3, K3; specs/010-costos): lo que une el formulario con el motor (js/costos.js)
   y las cotizaciones (js/monedas.js). Funciones puras: leen y escriben texto (la URL compartible, el HTML del formulario y del
   desglose) y no tocan el DOM ni la red; el pegamento con la pagina vive en js/vista-costo.js.
   Ninguna cifra de normativa vive aca: todo sale de importacion.json a traves del motor.
   Se carga como script comun (queda en window.Calculadora) y los tests lo cargan con require(). */
(function (raiz) {
  "use strict";

  // Nombre del campo -> parametro corto de la URL. "q" queda para el buscador.
  const PARAMETROS = {
    valor: "v", moneda: "m", flete: "f", seguro: "s", envios: "e", unidades: "u", peso: "p", derecho: "d", pago: "pg",
    aduana: "a", honorarios: "h", consulta: "hc", interno: "i", internoMonto: "im", cobro: "c", dolar: "td",
  };
  const POR_DEFECTO = {
    valor: "", moneda: "USD", flete: "", seguro: "", envios: "0", unidades: "1", peso: "", derecho: "", pago: "",
    aduana: "ambos", honorarios: "", consulta: "", interno: "", internoMonto: "", cobro: "", dolar: "oficial",
  };
  const OPCIONES = {
    pago: [["", "No sé todavía"], ["tarjeta_pesos", "Tarjeta en pesos"], ["dolares_propios", "Dólares propios (tarjeta en dólares o cuenta)"]],
    aduana: [["ambos", "No sé (muestro los dos casos)"], ["si", "Sí, el envío suma"], ["no", "No, solo el producto"]],
    cobro: [["", "No sé"], ["checkout", "En el checkout de la tienda (Amazon, eBay, Tiendamia)"], ["entrega", "Al recibir (courier o Correo)"]],
    interno: [["", "No"], ["si", "Sí: celular, TV o aire acondicionado"]],
  };
  // Las monedas de las tiendas del exterior mas comunes; cualquiera que traigan las cotizaciones sirve.
  const MONEDAS = [["USD", "Dólares (USD)"], ["EUR", "Euros (EUR)"], ["GBP", "Libras (GBP)"], ["CNY", "Yuanes (CNY)"],
    ["BRL", "Reales (BRL)"], ["CLP", "Pesos chilenos (CLP)"], ["JPY", "Yenes (JPY)"]];
  const MONTOS = ["valor", "flete", "seguro", "honorarios", "internoMonto"];   // en la moneda elegida
  const TOPE = 20;                     // caracteres por parametro: un monto no necesita mas
  const NIVELES = { oficial: "oficial", dato: "dato tuyo", pendiente: "sin dato", dudoso: "dudoso", prensa: "prensa" };
  // Los nombres que ve la persona; el motor los escribe sin tildes.
  const CONCEPTOS = { derecho_importacion: "Derecho de importación", tasa_estadistica: "Tasa de estadística", iva: "IVA",
    impuesto_interno: "Impuesto interno", honorarios: "Honorarios del courier o tasa del Correo" };
  const PERCEPCION = "Es un pago a cuenta de Ganancias o Bienes Personales que se puede recuperar según tu situación: no es un impuesto de la importación.";
  const REGIMENES = { franquicia: "Dentro de la franquicia", excedente: "Supera la franquicia", cupo_agotado: "Cupo anual agotado",
    fuera_de_regimen: "Fuera del régimen de pequeños envíos" };

  const valido = (campo, v) => {
    if (OPCIONES[campo]) return OPCIONES[campo].some(([id]) => id === v);
    if (campo === "moneda") return /^[A-Z]{3}$/.test(v);
    if (campo === "dolar") return /^[a-z]{3,20}$/.test(v);
    if (campo === "consulta") return v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v);
    return true;
  };

  /* Un numero como lo escribe una persona: "1.234,56", "1234.5", "1.500" (miles), "US$ 300". Vacio: null; otra cosa: NaN. */
  function numero(texto) {
    const crudo = String(texto === undefined || texto === null ? "" : texto).trim();
    if (!crudo) return null;
    const t = crudo.replace(/^(US\$|U\$S|USD|\$|€)/i, "").replace(/\s/g, "");
    let n = t;
    const coma = n.lastIndexOf(","), punto = n.lastIndexOf(".");
    if (coma >= 0 && punto >= 0) {
      n = coma > punto ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, "");
    } else if (coma >= 0) {
      n = n.replace(",", ".");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(n)) {
      n = n.replace(/\./g, "");
    }
    return /^\d+(\.\d+)?$/.test(n) ? Number(n) : NaN;
  }

  function estadoDeUrl(search) {
    const p = new URLSearchParams(search || "");
    const e = { ...POR_DEFECTO };
    for (const [campo, clave] of Object.entries(PARAMETROS)) {
      const v = (p.get(clave) || "").slice(0, TOPE);
      if (p.has(clave) && valido(campo, v)) e[campo] = v;
    }
    return e;
  }

  const tieneEstado = search => Object.values(PARAMETROS).some(clave => new URLSearchParams(search || "").has(clave));

  function urlDeEstado(pathname, estado) {
    const p = new URLSearchParams();
    for (const [campo, clave] of Object.entries(PARAMETROS)) {
      if (estado[campo] !== POR_DEFECTO[campo]) p.set(clave, estado[campo]);
    }
    const s = p.toString();
    return pathname + (s ? "?" + s : "") + "#costo";
  }

  /* El estado sale del formulario leyendo cada campo por nombre (en la pagina, form.elements[nombre].value). */
  function estadoDeFormulario(leer) {
    const e = { ...POR_DEFECTO };
    for (const campo of Object.keys(PARAMETROS)) {
      const v = leer(campo);
      if (typeof v === "string" && valido(campo, v.slice(0, TOPE))) e[campo] = v.slice(0, TOPE);
    }
    return e;
  }

  const ETIQUETA = { valor: "el precio del producto", flete: "el envío", seguro: "el seguro", envios: "los envíos de este año",
    unidades: "las unidades", peso: "el peso", derecho: "el derecho de importación", honorarios: "los honorarios",
    internoMonto: "el impuesto interno" };

  /* De lo que escribio la persona a la entrada del motor, todo en dolares. Devuelve los errores por campo. */
  function entradaDe(estado, tasas, convertir) {
    const errores = [];
    const leido = {};
    for (const campo of Object.keys(ETIQUETA)) {
      const n = numero(estado[campo]);
      if (Number.isNaN(n)) errores.push({ campo, texto: `Revisá ${ETIQUETA[campo]}: tiene que ser un número, por ejemplo 1.234,56.` });
      leido[campo] = n;
    }
    if (leido.valor === null) errores.push({ campo: "valor", texto: "Escribí el precio del producto para calcular." });
    let conversion = null;
    if (estado.moneda !== "USD" && !errores.length) {
      try {
        if (!tasas) throw new Error("sin cotizaciones");
        const r = convertir(1, estado.moneda, "USD", tasas);
        conversion = { moneda: estado.moneda, tasa: r.tasa, fuentes: r.fuentes, actualizado: r.actualizado };
      } catch (e) {
        errores.push({ campo: "moneda", texto: `No tengo la cotización de ${estado.moneda} ahora: escribí los montos en dólares.` });
      }
    }
    const aUsd = n => n === null || !conversion ? n : Math.round(n * conversion.tasa * 100) / 100;
    const entrada = {
      fobUsd: aUsd(leido.valor), fleteUsd: aUsd(leido.flete), seguroUsd: aUsd(leido.seguro),
      derechoImportacionPct: leido.derecho, enviosUsadosEsteAnio: leido.envios, unidades: leido.unidades, pesoKg: leido.peso,
      medioPago: estado.pago || undefined, fleteEnValorAduana: estado.aduana, honorariosUsd: aUsd(leido.honorarios),
      aplicaImpuestoInterno: estado.interno === "si", impuestoInternoUsd: aUsd(leido.internoMonto),
    };
    return { entrada, errores, conversion };
  }

  const fmt = (n, decimales) => n.toLocaleString("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  const usd = n => (n === null || n === undefined ? "—" : "US$ " + fmt(n, 2));
  const ars = n => (n === null || n === undefined ? "—" : "$ " + fmt(Math.round(n), 0));

  /* --- Formulario --- */
  function formularioHtml(estado, { esc, tiposDolar }) {
    const id = c => `k-${c}`;
    const texto = (campo, etiqueta, ayuda, extra = "") => `<div class="k-campo">
        <label for="${id(campo)}">${etiqueta}</label>
        <input id="${id(campo)}" name="${campo}" type="text" inputmode="decimal" autocomplete="off" value="${esc(estado[campo])}"${extra}
          aria-describedby="${id(campo)}-ayuda ${id(campo)}-error">
        <small id="${id(campo)}-ayuda">${ayuda}</small><small class="k-error" id="${id(campo)}-error"></small></div>`;
    const lista = (campo, etiqueta, opciones, ayuda = "") => `<div class="k-campo">
        <label for="${id(campo)}">${etiqueta}</label>
        <select id="${id(campo)}" name="${campo}"${ayuda ? ` aria-describedby="${id(campo)}-ayuda"` : ""}>${opciones.map(([v, t]) =>
          `<option value="${esc(v)}"${v === estado[campo] ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
        ${ayuda ? `<small id="${id(campo)}-ayuda">${ayuda}</small>` : ""}</div>`;
    const dolares = (tiposDolar || []).map(t => [t.id, t.nombre]);
    return `<form class="k-form" id="k-form" novalidate>
      <fieldset><legend>Lo que comprás</legend>
        ${texto("valor", "Precio del producto", "El precio en la tienda, sin el envío.", ' required')}
        ${lista("moneda", "Moneda", MONEDAS, "Los montos de este formulario van en esta moneda.")}
        ${texto("flete", "Envío", "Lo que cobra la tienda o el courier por traerlo.")}
        ${texto("seguro", "Seguro", "Si lo pagás aparte. Si no, dejalo vacío.")}
        ${texto("unidades", "Unidades iguales", "El régimen permite hasta 3 de la misma especie.")}
        ${texto("peso", "Peso del paquete (kg)", "Opcional: el límite es por paquete.")}
      </fieldset>
      <fieldset><legend>Tu situación</legend>
        ${texto("envios", "Envíos que ya usaste este año", "Por courier o Correo, a tu nombre.")}
        ${lista("pago", "Cómo pagás", OPCIONES.pago, "Con tarjeta en pesos se suma la percepción, que se puede recuperar.")}
        ${lista("cobro", "Dónde se pagan los impuestos", OPCIONES.cobro)}
        ${lista("dolar", "Dólar para pasar a pesos", dolares)}
      </fieldset>
      <fieldset><legend>Lo que no publica ARCA (opcional)</legend>
        ${texto("derecho", "Derecho de importación (%)", "Depende de la posición arancelaria. Vacío = no lo sé: lo marco como no incluido.")}
        ${lista("aduana", "¿El envío suma al valor en aduana?", OPCIONES.aduana, "La norma no es clara: por defecto muestro los dos casos.")}
        ${texto("honorarios", "Honorarios del courier o tasa del Correo", "Lo que te dijeron que cobran. Nunca lo supongo.")}
        <div class="k-campo"><label for="${id("consulta")}">Cuándo lo consultaste</label>
          <input id="${id("consulta")}" name="consulta" type="date" value="${esc(estado.consulta)}"></div>
        ${lista("interno", "¿Paga impuesto interno?", OPCIONES.interno)}
        ${texto("internoMonto", "Monto del impuesto interno", "Si lo sabés. La base del cálculo está pendiente de confirmar.")}
      </fieldset>
    </form>`;
  }

  /* --- Desglose --- */
  const nivelHtml = (nivel, esc) => `<span class="k-nivel k-${esc(nivel)}">${esc(NIVELES[nivel] || nivel)}</span>`;

  function cobroHtml(cobro) {
    if (cobro === "checkout") {
      return "La tienda cobra los impuestos por adelantado: es un depósito estimado por la tienda, y si la aduana liquida otra cosa la diferencia la ajusta la tienda según su política.";
    }
    if (cobro === "entrega") {
      return "Los impuestos se pagan al recibir: pagás lo que liquide la aduana, que puede ser más o menos que esta estimación.";
    }
    return "Antes de pagar, preguntá si la tienda cobra los impuestos en el checkout o si se pagan al recibir: cambia quién absorbe la diferencia con la liquidación real.";
  }

  function resultadoHtml(res, { esc, aPesos, dolarNombre, estado }) {
    if (!res) return "";
    if (!res.valido || res.regimen === "fuera_de_regimen") {
      const titulo = res.valido ? REGIMENES.fuera_de_regimen : "Revisá los datos";
      return `<div class="flaco k-alerta" role="alert"><div><b>${esc(titulo)}</b><ul>${res.avisos.map(a =>
        `<li>${esc(a.texto)}</li>`).join("")}</ul></div></div>`;
    }
    const enPesos = n => { const p = n === null ? null : aPesos(n); return p === null || p === undefined ? "sin cotización" : ars(p); };
    const productoUsd = res.totalUsd - res.tributosUsd - (res.renglones.find(r => r.clave === "honorarios") || { montoUsd: 0 }).montoUsd;
    const filas = [`<tr><th scope="row">Producto, envío y seguro</th><td>—</td><td>—</td><td>${usd(productoUsd)}</td><td>${enPesos(productoUsd)}</td><td>${nivelHtml("dato", esc)}</td></tr>`]
      .concat(res.renglones.map(r => `<tr><th scope="row">${esc(CONCEPTOS[r.clave] || r.concepto)}</th>
        <td>${r.baseUsd === null ? "—" : usd(r.baseUsd)}</td>
        <td>${r.exento ? "exento" : r.alicuotaPct === null ? "—" : esc(String(r.alicuotaPct).replace(".", ",")) + " %"}</td>
        <td>${r.montoUsd === null ? "sin dato" : usd(r.montoUsd)}</td><td>${r.montoUsd === null ? "—" : enPesos(r.montoUsd)}</td>
        <td>${nivelHtml(r.exento ? "oficial" : r.nivel, esc)}</td></tr>`));
    const queCubre = [];
    if (res.escenarios.fleteFueraDeBase.totalUsd !== res.escenarios.fleteEnBase.totalUsd && (!estado || estado.aduana === "ambos")) {
      queCubre.push("si el envío suma al valor en aduana");
    }
    if (res.percepcionAplica === null) queCubre.push("si pagás con tarjeta en pesos (percepción)");
    const nota = res.percepcionAplica === true ? " Los dos extremos ya incluyen la percepción." : "";
    const rango = res.rangoUsd && res.rangoUsd.minUsd !== res.rangoUsd.maxUsd && queCubre.length
      ? `<div class="tile"><div class="k">Rango</div><div class="v">${usd(res.rangoUsd.minUsd)} a ${usd(res.rangoUsd.maxUsd)}</div>
         <div class="d">Cubre lo que no se sabe: ${queCubre.join(" y ")}.${nota}</div></div>` : "";
    const conTarjeta = res.percepcionAplica === true
      ? `<div class="tile"><div class="k">Lo que sale de tu tarjeta</div><div class="v">${usd(res.totalConPercepcionUsd)}</div>
         <div class="d">${enPesos(res.totalConPercepcionUsd)}, con la percepción</div></div>` : "";
    const percepcion = res.percepcionAplica === false
      ? "<p class=\"sub chico\">Con dólares propios no corresponde percepción.</p>"
      : `<p class="sub chico"><b>Percepción${res.percepcionAplica ? "" : " (si pagás con tarjeta en pesos)"}:</b> ${usd(res.percepcionUsd)}
         (${enPesos(res.percepcionUsd)}). ${PERCEPCION}</p>`;
    const noIncluido = res.noIncluido.length ? `<div class="bloque k-pendiente"><h3>No incluido</h3><ul class="lista">${res.noIncluido.map(n =>
      `<li class="m">${esc(n.motivo)}</li>`).join("")}</ul></div>` : "";
    const consulta = estado && estado.consulta && estado.honorarios ? ` Los honorarios los consultaste el ${esc(estado.consulta)}.` : "";
    return `<div class="k-res">
      <p class="k-regimen"><span class="chip${res.completo ? " ok" : " ojo"}">${esc(REGIMENES[res.regimen])}</span>
        <span class="chip${res.completo ? " ok" : " ojo"}">${res.completo ? "cálculo completo" : "cálculo incompleto: falta un dato"}</span></p>
      <div class="tiles">
        <div class="tile ok"><div class="k">Total estimado puesto en casa</div><div class="v">${usd(res.totalUsd)}</div>
          <div class="d">${enPesos(res.totalUsd)}${dolarNombre ? ` · dólar ${esc(dolarNombre)}` : ""}</div></div>
        <div class="tile"><div class="k">Impuestos</div><div class="v">${usd(res.tributosUsd)}</div><div class="d">${enPesos(res.tributosUsd)}</div></div>
        ${conTarjeta}
        ${rango}
      </div>
      <div class="scroll"><table class="k-tabla"><caption>Desglose renglón por renglón</caption>
        <thead><tr><th scope="col">Concepto</th><th scope="col">Base</th><th scope="col">Alícuota</th><th scope="col">Dólares</th>
          <th scope="col">Pesos</th><th scope="col">Confianza</th></tr></thead>
        <tbody>${filas.join("")}</tbody>
        <tfoot><tr><th scope="row">Total</th><td></td><td></td><td>${usd(res.totalUsd)}</td><td>${enPesos(res.totalUsd)}</td><td></td></tr></tfoot>
      </table></div>
      ${percepcion}
      ${noIncluido}
      <p class="sub chico">${esc(cobroHtml(estado && estado.cobro))}${consulta}</p>
      <p class="sub chico"><b>Estimación, no asesoramiento.</b> La liquidación real puede variar; los renglones «sin dato» no están sumados.</p>
    </div>`;
  }

  /* GoatCounter: el regimen y si la cuenta quedo completa. Nada de montos ni datos de la persona. */
  function eventoCalculo(res) {
    if (!res || !res.valido || !res.regimen) return null;
    return { path: "calculadora/" + res.regimen, title: res.completo ? "completo" : "incompleto", event: true };
  }

  /* Hace cuantos dias se verificaron las reglas y si ya hay que avisar (FR-004: a los 60 dias). */
  function vigencia(reglas, ahora) {
    const t = Date.parse((reglas && reglas.verificado) || ""), n = Date.parse(ahora);
    if (!Number.isFinite(t) || !Number.isFinite(n)) return { verificado: null, dias: null, vieja: false };
    const dias = Math.floor((n - t) / 864e5);
    return { verificado: reglas.verificado, dias, vieja: dias > (reglas.vence_a_los_dias || 60) };
  }

  const api = { PARAMETROS, POR_DEFECTO, MONEDAS, numero, estadoDeUrl, tieneEstado, urlDeEstado, estadoDeFormulario, entradaDe,
    formularioHtml, resultadoHtml, eventoCalculo, vigencia, usd, ars };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Calculadora = api;
})(this);
