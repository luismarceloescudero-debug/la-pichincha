/* Importar desde la busqueda (spec 015): lo que une un aviso internacional con la calculadora de costos (js/calculadora.js).
   Dos cosas: (1) el enlace «Calcular con este precio» abre la calculadora con el precio del aviso ya cargado (en dolares, al
   dolar oficial, igual que js/puesto.js) y un peso tipico por rubro; (2) la lista de donde comprar afuera (Amazon, Tiendamia,
   Loquieroaca). Solo enlaces: no leemos esas tiendas ni sacamos precios de ellas (Tiendamia y Loquieroaca bloquean al lector;
   no se esquiva). Funciones puras: no tocan el DOM ni la red. Estimacion, no asesoramiento. */
(function (raiz) {
  "use strict";

  const C = typeof module === "object" && module.exports ? require("./calculadora.js") : raiz.Calculadora;
  const AMAZON_TAG = "lapichincha-20";   // el mismo ID que js/pagina.js; va en cada enlace de afiliado

  /* Peso tipico en kg, solo para precargar el campo: la persona lo cambia. No es una regla: importacion.json solo fija el tope
     de 50 kg por paquete (peso_max_kg). Las dimensiones no entran al calculo, asi que no se precargan. */
  const PESO_TIPICO = { smartphone: 0.3, notebook: 2.5, pc: 8, monitor: 6, componente: 1, periferico: 0.5, otro: 1 };

  /* Donde comprar afuera. `afiliado` marca el enlace que cobra comision (se rotula en la pagina, rel=sponsored). */
  const FUENTES = [
    { id: "amazon", nombre: "Amazon (EE.UU.)", url: "https://www.amazon.com/", afiliado: true,
      texto: "Compra directa en la tienda de EE.UU. El envío y los impuestos los pagás vos o el courier: calculalos acá antes de comprar." },
    { id: "tiendamia", nombre: "Tiendamia", url: "https://www.tiendamia.com/", afiliado: false,
      texto: "Intermediario: compra en tiendas del exterior por vos. Antes de pagar, revisá en el resumen qué impuestos suma y si ya vienen incluidos." },
    { id: "loquieroaca", nombre: "Loquieroaca", url: "https://www.loquieroaca.com/", afiliado: false,
      texto: "Intermediario argentino para comprar en tiendas del exterior. Mismo chequeo: el resumen dice qué impuestos y cargos suma." },
  ];

  const redondear = n => Math.round(n * 100) / 100;

  /* El estado que precarga la calculadora: el precio en dolares y el peso tipico del rubro. Todo lo demas, por defecto. */
  function estadoImportar(fobUsd, categoria) {
    const peso = PESO_TIPICO[categoria] !== undefined ? PESO_TIPICO[categoria] : PESO_TIPICO.otro;
    return { ...C.POR_DEFECTO, valor: String(redondear(fobUsd)), moneda: "USD", peso: String(peso) };
  }

  /* Enlace a la pestaña de costo con el precio cargado. pathname: la pagina actual (location.pathname). */
  function hrefCalculadora(fobUsd, categoria, pathname) {
    return C.urlDeEstado(pathname || "/", estadoImportar(fobUsd, categoria));
  }

  /* Enlace de una fuente. Amazon lleva el tag de afiliado y, si hay termino, la busqueda de ese producto. */
  function enlaceFuente(fuente, termino) {
    if (!fuente.afiliado) return fuente.url;
    const q = termino ? `s?k=${encodeURIComponent(termino)}&` : "?";
    return `${fuente.url}${q}tag=${AMAZON_TAG}`;
  }

  const api = { PESO_TIPICO, FUENTES, AMAZON_TAG, estadoImportar, hrefCalculadora, enlaceFuente };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Importar = api;
})(this);
