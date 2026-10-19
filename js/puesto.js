/* Costo puesto en casa de una compra internacional, para ponerlo al lado del equivalente local (spec 012, plan v3 K4).
   Une el motor de costos (js/costos.js, K1), las cotizaciones (js/monedas.js, K2) y las reglas de importacion.json.
   Funciones puras: no tocan el DOM ni la red; quien las llama les pasa { reglas, tasas }.

   Lo que NO sabemos, y por eso el resultado es un rango y no un numero:
   - Si el precio en pesos que publica la plataforma ya trae los impuestos o no (el indice no lo dice). El minimo del rango
     es el precio publicado (si ya los trae) y el maximo es ese precio mas los tributos que calcula el motor (si no los trae).
   - El derecho de importacion del hardware y la base del impuesto interno estan pendientes en importacion.json: no se
     inventan, se listan en `faltan` y el maximo es un piso de lo que puede costar.
   Supuestos fijos, dichos en el texto: dolar oficial, ningun envio usado en el año, sin flete ni honorarios aparte y sin
   percepcion de tarjeta (se paga en pesos a la plataforma). Es una estimacion, no asesoramiento. */
(function (raiz) {
  "use strict";

  const K = typeof module === "object" && module.exports ? require("./costos.js") : raiz.Costos;
  const TIPO_DOLAR = "oficial";
  // Rubros que pagan impuesto interno segun las reglas (celulares, monitores, TV, aires: spec 010); su base esta pendiente.
  const PAGA_INTERNO = new Set(["smartphone", "monitor"]);
  // El unico derecho confirmado es el de los celulares (importacion.json: derecho_importacion_celulares_pct).
  const DERECHO_CONFIRMADO = { smartphone: "derecho_importacion_celulares_pct" };

  const pesos = n => "$" + Math.round(n).toLocaleString("es-AR");
  const pct = n => n.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const no = motivo => ({ ok: false, motivo });

  /* fila: una fila del indice; categoria: la de js/categorias.js; ctx: { reglas, tasas }. Nunca lanza. */
  function estimar(fila, categoria, ctx) {
    const { reglas, tasas } = ctx || {};
    if (!reglas || !reglas.reglas) return no("faltan las reglas de importación");
    const venta = tasas && tasas.dolares && tasas.dolares[TIPO_DOLAR] && tasas.dolares[TIPO_DOLAR].venta;
    if (!(venta > 0)) return no("falta la cotización del dólar");
    const precio = fila && fila[1];
    if (!(precio > 0)) return no("el aviso no tiene precio");
    const claveDerecho = DERECHO_CONFIRMADO[categoria];
    const regla = claveDerecho && reglas.reglas[claveDerecho];
    const derecho = regla && regla.nivel === "oficial" && typeof regla.valor === "number" ? regla.valor : null;
    const fobUsd = Math.round(precio / venta * 100) / 100;
    let r;
    try {
      r = K.calcular({ fobUsd, derechoImportacionPct: derecho, aplicaImpuestoInterno: PAGA_INTERNO.has(categoria),
        medioPago: "dolares_propios", fleteEnValorAduana: "ambos", enviosUsadosEsteAnio: 0, unidades: 1, pesoKg: 0 }, reglas);
    } catch (e) {
      return no("no se pudo calcular con las reglas actuales");
    }
    if (!r.valido) return no(r.avisos.map(a => a.texto).join(" "));
    if (r.regimen === "fuera_de_regimen") return no(r.avisos.map(a => a.texto).join(" "));
    const faltan = [];
    if (r.noIncluido.some(n => n.clave === "derecho_importacion_hardware_pct")) faltan.push("derecho de importación");
    if (r.noIncluido.some(n => n.clave === "base_impuesto_interno")) faltan.push("impuesto interno");
    return {
      ok: true, fobUsd, regimen: r.regimen, completo: r.completo, faltan, dolar: { tipo: TIPO_DOLAR, venta },
      minPesos: precio, maxPesos: Math.max(precio, Math.round(r.rangoUsd.maxUsd * venta)),
    };
  }

  /* El equivalente local contra la estimacion: cuanto mas barato (+) o mas caro (-) sale importarlo, en cada extremo. */
  function comparar(est, local) {
    if (!est || !est.ok || !local || !(local[1] > 0)) return null;
    const p = x => Math.round((local[1] - x) / local[1] * 1000) / 10;
    return { localPesos: local[1], minPct: p(est.minPesos), maxPct: p(est.maxPesos) };
  }

  const queFalta = est => est.faltan.length ? `, sin contar el ${est.faltan.join(" ni el ")} (todavía sin regla confirmada)` : "";

  function texto(est) {
    if (!est || !est.ok) return `No se estima el costo puesto en casa: ${est && est.motivo ? est.motivo : "faltan datos"}.`;
    const extremos = est.minPesos === est.maxPesos ? pesos(est.minPesos) : `${pesos(est.minPesos)} (si el precio ya trae los impuestos) y ${pesos(est.maxPesos)} (si no los trae)`;
    return `Costo puesto en casa, estimación: entre ${extremos}${queFalta(est)}. Dólar ${est.dolar.tipo} a ${pesos(est.dolar.venta)}, sin flete aparte ni percepción. ` +
      "Es una estimación, no asesoramiento: la liquidación real puede variar.";
  }

  const frase = p => `${pct(Math.abs(p))}% ${p >= 0 ? "más barato" : "más caro"}`;
  function textoComparacion(c, tienda) {
    if (!c) return "";
    const contra = `El mismo modelo en ${tienda || "una tienda local"} cuesta ${pesos(c.localPesos)}`;
    const mismo = (c.minPct >= 0) === (c.maxPct >= 0);
    const rango = mismo ? `entre ${pct(Math.abs(c.minPct))}% y ${pct(Math.abs(c.maxPct))}% ${c.minPct >= 0 ? "más barato" : "más caro"}`
      : `entre ${frase(c.minPct)} y ${frase(c.maxPct)}`;
    return `${contra}: traerlo sale ${rango}.`;
  }

  const api = { estimar, comparar, texto, textoComparacion };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Puesto = api;
})(this);
