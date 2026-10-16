/* Motor de calculo del costo de importar por courier o por Correo (plan v3, K1; specs/010-costos).
   Funciones puras: no tocan el DOM ni la red. Los numeros de la normativa NO estan aca: salen de importacion.json
   (franquicia, tope, IVA, tasa de estadistica, percepcion), que trae la fuente, la fecha y la confianza de cada regla.
   Se carga como script comun (queda en window.Costos; K3 lo suma a la pagina) y los tests lo cargan con require(). */
(function (raiz) {
  "use strict";

  const centavos = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const esNumero = n => typeof n === "number" && Number.isFinite(n);
  const falta = n => n === null || n === undefined;
  const MEDIOS_DE_PAGO = ["tarjeta_pesos", "dolares_propios"];
  const FLETE_EN_ADUANA = ["si", "no", "ambos"];
  // Un campo vacio de un formulario llega como undefined o null: vale lo mismo que no haberlo escrito.
  const POR_DEFECTO = { fleteUsd: 0, seguroUsd: 0, enviosUsadosEsteAnio: 0, unidades: 1, pesoKg: 0, fleteEnValorAduana: "ambos" };

  /* Una regla firme: tiene que existir, no estar pendiente y traer valor. Sin ella no se calcula. */
  function firme(reglas, clave) {
    const r = reglas.reglas[clave];
    if (!r || r.nivel === "pendiente" || falta(r.valor)) {
      throw new Error(`falta la regla firme "${clave}" en importacion.json: no se puede calcular sin ella`);
    }
    return r;
  }

  const motivoDe = (reglas, clave) => {
    const r = reglas.reglas[clave] || {};
    return r.nota || r.descripcion || "sin dato";
  };

  function entradaInvalida(e) {
    const avisos = [];
    if (!esNumero(e.fobUsd) || e.fobUsd <= 0) avisos.push("el valor FOB tiene que ser un numero mayor que cero");
    for (const campo of ["fleteUsd", "seguroUsd", "honorariosUsd", "impuestoInternoUsd"]) {
      if (!falta(e[campo]) && (!esNumero(e[campo]) || e[campo] < 0)) avisos.push(`${campo} tiene que ser un numero desde cero`);
    }
    if (!falta(e.derechoImportacionPct) && (!esNumero(e.derechoImportacionPct) || e.derechoImportacionPct < 0)) {
      avisos.push("el derecho de importacion tiene que ser un porcentaje desde cero");
    }
    if (!Number.isInteger(e.enviosUsadosEsteAnio) || e.enviosUsadosEsteAnio < 0) avisos.push("los envios usados tienen que ser un numero entero desde cero");
    if (!Number.isInteger(e.unidades) || e.unidades < 1) avisos.push("las unidades tienen que ser un numero entero, al menos una");
    if (!esNumero(e.pesoKg) || e.pesoKg < 0) avisos.push("el peso tiene que ser un numero desde cero");
    if (!falta(e.medioPago) && !MEDIOS_DE_PAGO.includes(e.medioPago)) avisos.push("el medio de pago tiene que ser tarjeta en pesos o dolares propios");
    if (!FLETE_EN_ADUANA.includes(e.fleteEnValorAduana)) avisos.push("fleteEnValorAduana tiene que ser si, no o ambos");
    return avisos.map(texto => ({ codigo: "entrada", texto }));
  }

  const sinCalculo = (regimen, valido, avisos) => ({
    valido, regimen, avisos, renglones: [], tributosUsd: null, totalUsd: null, completo: false,
    noIncluido: [], escenarios: null, rangoUsd: null, percepcionUsd: null, totalConPercepcionUsd: null,
    percepcionAplica: null, percepcionNota: null,
  });

  /* El rango cubre lo que no se sabe: si el flete integra el valor en aduana (dos escenarios) y, solo si la persona no dijo como
     paga, si hay percepcion. Con el medio de pago conocido, la percepcion entra en los dos extremos o en ninguno. */
  function rangoDe(totales, percepcionUsd, medioPago) {
    const conPercepcion = totales.map(t => centavos(t + percepcionUsd));
    if (medioPago === "tarjeta_pesos") return { minUsd: Math.min(...conPercepcion), maxUsd: Math.max(...conPercepcion) };
    if (medioPago === "dolares_propios") return { minUsd: Math.min(...totales), maxUsd: Math.max(...totales) };
    return { minUsd: Math.min(...totales), maxUsd: Math.max(...conPercepcion) };
  }

  /* entrada: { fobUsd, fleteUsd, seguroUsd, derechoImportacionPct (null = no se sabe), enviosUsadosEsteAnio, unidades,
       pesoKg, aplicaImpuestoInterno, impuestoInternoUsd, honorariosUsd, fleteEnValorAduana: "si" | "no" | "ambos",
       medioPago: "tarjeta_pesos" | "dolares_propios" (opcional) }
     reglas: el contenido de importacion.json. Todo en dolares; la conversion a pesos es de js/monedas.js (K2). */
  function calcular(entrada, reglas) {
    if (!reglas || !reglas.reglas) throw new Error("faltan las reglas de importacion (importacion.json)");
    const franquicia = firme(reglas, "franquicia_usd").valor;
    const cupo = firme(reglas, "envios_por_anio").valor;
    const tope = firme(reglas, "tope_fob_usd").valor;
    const unidadesMax = firme(reglas, "unidades_max_misma_especie").valor;
    const pesoMax = firme(reglas, "peso_max_kg").valor;
    const tasa = firme(reglas, "tasa_estadistica_pct");
    const iva = firme(reglas, "iva_general_pct");
    const percepcion = firme(reglas, "percepcion_tarjeta_pct").valor;

    const e = { ...entrada };
    for (const [campo, valor] of Object.entries(POR_DEFECTO)) if (falta(e[campo])) e[campo] = valor;
    const invalidos = entradaInvalida(e);
    if (invalidos.length) return sinCalculo(null, false, invalidos);

    const avisos = [];
    if (e.fobUsd > tope) {
      avisos.push({ codigo: "tope", texto: `Un valor FOB mayor que USD ${tope} no entra al regimen de pequeños envios: se importa por el regimen general, con un despachante.` });
    }
    if (e.unidades > unidadesMax) {
      avisos.push({ codigo: "unidades", texto: `El regimen permite hasta ${unidadesMax} unidades de la misma especie por envio.` });
    }
    if (e.pesoKg > pesoMax) {
      avisos.push({ codigo: "peso", texto: `El regimen permite hasta ${pesoMax} kg por paquete.` });
    }
    if (avisos.length) return sinCalculo("fuera_de_regimen", true, avisos);

    const regimen = e.enviosUsadosEsteAnio >= cupo ? "cupo_agotado" : e.fobUsd > franquicia ? "excedente" : "franquicia";
    const exento = regimen === "franquicia";
    const fleteSeguro = e.fleteUsd + e.seguroUsd;
    const sabeDerecho = !falta(e.derechoImportacionPct);
    const interno = !falta(e.impuestoInternoUsd) ? centavos(e.impuestoInternoUsd) : null;
    const honorarios = !falta(e.honorariosUsd) ? centavos(e.honorariosUsd) : null;

    function escenario(fleteEnBase) {
      const extra = fleteEnBase ? fleteSeguro : 0;
      const valorAduana = e.fobUsd + extra;
      // La franquicia se mide con el FOB; el flete y el seguro, si integran el valor en aduana, suman a lo que paga derechos.
      const baseDerechos = exento ? 0 : (regimen === "cupo_agotado" ? e.fobUsd : e.fobUsd - franquicia) + extra;
      const derecho = exento ? 0 : sabeDerecho ? centavos(baseDerechos * e.derechoImportacionPct / 100) : null;
      const tasaMonto = exento ? 0 : centavos(baseDerechos * tasa.valor / 100);
      const baseIva = valorAduana + (derecho || 0) + tasaMonto;   // el IVA cae sobre todo el valor, tambien sobre la franquicia
      const ivaMonto = centavos(baseIva * iva.valor / 100);
      const tributos = centavos((derecho || 0) + tasaMonto + ivaMonto + (interno || 0));
      const total = centavos(e.fobUsd + fleteSeguro + tributos + (honorarios || 0));
      const renglones = [
        { clave: "derecho_importacion", concepto: "Derecho de importacion", baseUsd: centavos(baseDerechos),
          alicuotaPct: sabeDerecho ? e.derechoImportacionPct : null, montoUsd: derecho, exento,
          nivel: exento ? reglas.reglas.exento_en_franquicia.nivel : sabeDerecho ? "dato" : "pendiente",
          regla: exento ? "exento_en_franquicia" : "derecho_importacion_hardware_pct" },
        { clave: "tasa_estadistica", concepto: "Tasa de estadistica", baseUsd: centavos(baseDerechos), alicuotaPct: tasa.valor,
          montoUsd: tasaMonto, exento, nivel: tasa.nivel, regla: "tasa_estadistica_pct" },
        { clave: "iva", concepto: "IVA", baseUsd: centavos(baseIva), alicuotaPct: iva.valor, montoUsd: ivaMonto, exento: false,
          nivel: iva.nivel, regla: "iva_general_pct" },
      ];
      if (interno !== null) {
        renglones.push({ clave: "impuesto_interno", concepto: "Impuesto interno", baseUsd: null, alicuotaPct: null, montoUsd: interno,
          exento: false, nivel: "dato", regla: "base_impuesto_interno" });
      }
      if (honorarios !== null) {
        renglones.push({ clave: "honorarios", concepto: "Honorarios del courier o tasa del Correo", baseUsd: null, alicuotaPct: null,
          montoUsd: honorarios, exento: false, nivel: "dato", regla: "honorarios_courier" });
      }
      return { renglones, tributosUsd: tributos, totalUsd: total };
    }

    const fueraDeBase = escenario(false);
    const enBase = escenario(true);
    const principal = e.fleteEnValorAduana === "si" ? enBase : fueraDeBase;

    const faltaDerecho = !exento && !sabeDerecho;
    const faltaInterno = e.aplicaImpuestoInterno === true && interno === null;
    const noIncluido = [];
    if (faltaDerecho) noIncluido.push({ clave: "derecho_importacion_hardware_pct", motivo: motivoDe(reglas, "derecho_importacion_hardware_pct") });
    if (faltaInterno) noIncluido.push({ clave: "base_impuesto_interno", motivo: motivoDe(reglas, "base_impuesto_interno") });
    noIncluido.push({ clave: "percepciones_courier", motivo: motivoDe(reglas, "percepciones_courier") });
    if (honorarios === null) noIncluido.push({ clave: "honorarios_courier", motivo: motivoDe(reglas, "honorarios_courier") });

    // Percepcion sobre lo que se paga con tarjeta en pesos al exterior: va aparte, no es un tributo de la importacion.
    const percepcionAplica = e.medioPago === "tarjeta_pesos" ? true : e.medioPago === "dolares_propios" ? false : null;   // null: no se sabe como paga
    const percepcionUsd = percepcionAplica === false ? 0 : centavos((e.fobUsd + fleteSeguro) * percepcion / 100);
    // Si la persona dijo si el flete integra el valor en aduana, eso ya no es incertidumbre: queda un solo caso (FR-009).
    const totales = e.fleteEnValorAduana === "ambos" ? [fueraDeBase.totalUsd, enBase.totalUsd] : [principal.totalUsd];

    return {
      valido: true, regimen, avisos: [], renglones: principal.renglones, tributosUsd: principal.tributosUsd, totalUsd: principal.totalUsd,
      completo: !faltaDerecho && !faltaInterno, noIncluido,
      escenarios: { fleteFueraDeBase: { tributosUsd: fueraDeBase.tributosUsd, totalUsd: fueraDeBase.totalUsd },
                    fleteEnBase: { tributosUsd: enBase.tributosUsd, totalUsd: enBase.totalUsd } },
      percepcionAplica, percepcionUsd, totalConPercepcionUsd: centavos(principal.totalUsd + percepcionUsd),
      percepcionNota: "Es un pago a cuenta de Ganancias o Bienes Personales (se recupera segun tu situacion) y no un tributo de la importacion; solo si pagas en pesos con tarjeta.",
      rangoUsd: rangoDe(totales, percepcionUsd, e.medioPago),
    };
  }

  const api = { calcular, centavos };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Costos = api;
})(this);
