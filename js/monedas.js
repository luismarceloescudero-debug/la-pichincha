/* Monedas y cotizaciones para la calculadora de costos (plan v3, K2; specs/010-costos).
   "Tiempo real" quiere decir lo ultimo que publica cada fuente, con su hora a la vista: el dolar en pesos se mueve por
   minutos (dolarapi.com) y las demas monedas por dia (open.er-api.com, con frankfurter.dev de reserva). Si una fuente
   cae se usa la copia que escribe el build (cotizaciones.json) y se dice de hace cuanto es; sin copia, no se inventa nada.
   Las funciones son puras salvo cotizar(), que recibe el fetch por parametro: los tests nunca van a la red.
   Se carga como script comun (queda en window.Monedas; K3 lo suma a la pagina) y los tests lo cargan con require(). */
(function (raiz) {
  "use strict";

  const URLS = {
    dolarapi: "https://dolarapi.com/v1/dolares",
    erapi: "https://open.er-api.com/v6/latest/USD",
    frankfurter: "https://api.frankfurter.dev/v1/latest?base=USD",
  };
  // En el orden en que se ofrecen en el selector: el de uso mas comun primero.
  const TIPOS_DOLAR = [
    { id: "oficial", nombre: "Oficial" }, { id: "tarjeta", nombre: "Tarjeta" }, { id: "bolsa", nombre: "MEP (bolsa)" },
    { id: "contadoconliqui", nombre: "Contado con liqui" }, { id: "blue", nombre: "Blue" },
    { id: "mayorista", nombre: "Mayorista" }, { id: "cripto", nombre: "Cripto" },
  ];
  const TIEMPO_MAXIMO_MS = 8000;      // una fuente que no responde en ese tiempo se da por caida
  const MAX_HORAS_VIEJA = 24;         // pasado ese tiempo una cotizacion se marca como vieja

  const esNumero = n => typeof n === "number" && Number.isFinite(n);
  const positivo = n => esNumero(n) && n > 0;     // una cotizacion en cero o negativa daria infinito o plata negativa
  const propio = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave);   // "constructor" no es una moneda
  const iso = x => { const t = Date.parse(x); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
  const redondear = n => Math.round(n * 100) / 100;
  const esObjeto = x => x !== null && typeof x === "object" && !Array.isArray(x);

  // Una moneda util: codigo de tres letras (el peso se cotiza por los tipos de dolar) y una tasa positiva.
  const esMonedaUtil = (codigo, valor) => /^[A-Z]{3}$/.test(codigo) && codigo !== "ARS" && codigo !== "USD" && positivo(valor);
  const traeMonedas = x => esObjeto(x) && esObjeto(x.rates) && Object.entries(x.rates).some(([c, v]) => esMonedaUtil(c, v));
  const valida = {
    dolarapi: x => Array.isArray(x) && x.some(d => d && positivo(d.venta)),
    erapi: x => esObjeto(x) && x.result === "success" && traeMonedas(x),   // sin ninguna moneda util cuenta como caida: sigue la reserva
    frankfurter: traeMonedas,
  };

  /* Arma las tasas con lo que haya: { dolares: {tipo: {compra, venta, actualizado}}, porUsd: {EUR: 0,89...},
     fuentes, actualizados }. Lo que falta queda vacio o en null: no se inventa. */
  function normalizar(crudas) {
    const { dolarapi, erapi, frankfurter } = crudas || {};
    const dolares = {};
    if (Array.isArray(dolarapi)) {
      for (const d of dolarapi) {
        if (d && typeof d.casa === "string" && d.casa !== "__proto__" && positivo(d.venta)) {
          dolares[d.casa] = { compra: positivo(d.compra) ? d.compra : null, venta: d.venta, actualizado: iso(d.fechaActualizacion) };
        }
      }
    }
    let rates = null, fuenteMonedas = null, actualizadoMonedas = null;
    if (valida.erapi(erapi)) {
      rates = erapi.rates; fuenteMonedas = "open.er-api.com"; actualizadoMonedas = iso(erapi.time_last_update_utc);
    } else if (valida.frankfurter(frankfurter)) {
      rates = frankfurter.rates; fuenteMonedas = "frankfurter.dev"; actualizadoMonedas = iso(frankfurter.date);
    }
    const porUsd = { USD: 1 };
    for (const [codigo, valor] of Object.entries(rates || {})) {
      if (esMonedaUtil(codigo, valor)) porUsd[codigo] = valor;
    }
    const horasDolares = Object.values(dolares).map(d => d.actualizado).filter(Boolean).sort();
    return {
      dolares, porUsd,
      fuentes: { dolares: Object.keys(dolares).length ? "dolarapi.com" : null, monedas: fuenteMonedas },
      actualizados: { dolares: horasDolares[0] || null, monedas: actualizadoMonedas },
    };
  }

  /* Convierte un monto entre dos monedas pasando por el dolar. Los pesos usan la VENTA del tipo de dolar elegido (lo que
     cuesta comprar dolares). Devuelve el monto redondeado al centavo, la tasa efectiva, de donde sale y la hora mas vieja
     de lo que uso. Si falta algo, falla con un mensaje claro. */
  function convertir(monto, de, a, tasas, opciones) {
    if (!esNumero(monto) || monto < 0) throw new Error("el monto tiene que ser un numero desde cero");
    const tipo = (opciones && opciones.tipoDolar) || "oficial";
    const conoce = codigo => codigo === "USD" || codigo === "ARS" || Boolean(tasas.porUsd && propio(tasas.porUsd, codigo));
    for (const codigo of [de, a]) if (!conoce(codigo)) throw new Error(`moneda desconocida "${codigo}"`);

    const fuentes = new Set(), horas = [];
    const ventaDolar = () => {
      const d = tasas.dolares && propio(tasas.dolares, tipo) ? tasas.dolares[tipo] : null;
      if (!d) throw new Error(`no hay cotizacion del dolar "${tipo}"`);
      fuentes.add("dolarapi.com"); if (d.actualizado) horas.push(d.actualizado);
      return d.venta;
    };
    const unidadesPorUsd = codigo => {
      if (codigo === "USD") return 1;
      if (codigo === "ARS") return ventaDolar();
      fuentes.add(tasas.fuentes.monedas); if (tasas.actualizados.monedas) horas.push(tasas.actualizados.monedas);
      return tasas.porUsd[codigo];
    };
    const convertirValor = valor => {
      if (de === a) return valor;
      const enUsd = de === "USD" ? valor : de === "ARS" ? valor / ventaDolar() : valor / unidadesPorUsd(de);
      return a === "USD" ? enUsd : a === "ARS" ? enUsd * ventaDolar() : enUsd * unidadesPorUsd(a);
    };
    const resultado = convertirValor(monto);
    return {
      monto: redondear(resultado), tasa: convertirValor(1), tipoDolar: de === "ARS" || a === "ARS" ? tipo : null,
      fuentes: [...fuentes], actualizado: horas.length ? horas.sort()[0] : null,
    };
  }

  /* Hace cuanto se actualizo algo. null si la fecha no sirve. Un reloj que atrasa unos segundos no da «hace -1 min». */
  function antiguedad(actualizado, ahora, opciones) {
    const t = Date.parse(actualizado), n = Date.parse(ahora);
    if (!Number.isFinite(t) || !Number.isFinite(n)) return null;
    const maxHoras = (opciones && opciones.maxHoras) || MAX_HORAS_VIEJA;
    const minutos = Math.max(0, Math.floor((n - t) / 60000));
    const dias = Math.floor(minutos / 1440);
    const texto = minutos < 1 ? "ahora" : minutos < 60 ? `hace ${minutos} min` : minutos < 1440 ? `hace ${Math.floor(minutos / 60)} h`
      : `hace ${dias} dia${dias > 1 ? "s" : ""}`;
    return { minutos, texto, vieja: minutos > maxHoras * 60 };
  }

  /* Pide una fuente con tiempo maximo. Cualquier falla (red, HTTP, JSON roto, forma rara, demora) da null, nunca una excepcion. */
  async function pedir(fetchFn, url, esValida, tiempoMaximoMs) {
    let temporizador;
    try {
      const respuesta = await Promise.race([
        (async () => {
          const r = await fetchFn(url);
          if (!r || !r.ok) throw new Error("http");
          return r.json();
        })(),
        new Promise((_, rechazar) => { temporizador = setTimeout(() => rechazar(new Error("tiempo")), tiempoMaximoMs); }),
      ]);
      return esValida(respuesta) ? respuesta : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(temporizador);
    }
  }

  /* Trae las cotizaciones: en vivo si se puede, de la copia del build (snapshot, con las respuestas crudas de las APIs y su
     fecha `generado`) si no. Nunca lanza. Devuelve { tasas, origen: vivo | mixto | copia | sin_datos, avisos }. */
  async function cotizar(opciones) {
    const { fetch: fetchFn, snapshot } = opciones || {};
    const ahora = (opciones && opciones.ahora) || new Date().toISOString();
    const tiempoMaximoMs = (opciones && opciones.tiempoMaximoMs) || TIEMPO_MAXIMO_MS;
    const [dolarapi, erapi] = await Promise.all([
      pedir(fetchFn, URLS.dolarapi, valida.dolarapi, tiempoMaximoMs), pedir(fetchFn, URLS.erapi, valida.erapi, tiempoMaximoMs)]);
    const frankfurter = erapi ? null : await pedir(fetchFn, URLS.frankfurter, valida.frankfurter, tiempoMaximoMs);

    const copia = esObjeto(snapshot) ? snapshot : null;
    const edad = copia ? antiguedad(copia.generado, ahora) : null;
    const deLaCopia = edad ? `, de ${edad.texto}${edad.vieja ? " (ya es vieja)" : ""}` : "";
    const avisos = [], crudas = { dolarapi, erapi, frankfurter };
    const vivoDolares = Boolean(dolarapi), vivoMonedas = Boolean(erapi || frankfurter);

    if (!vivoDolares && copia && copia.dolarapi) crudas.dolarapi = copia.dolarapi;
    if (!vivoMonedas && copia) { crudas.erapi = copia.erapi || null; crudas.frankfurter = copia.frankfurter || null; }
    if (!erapi && frankfurter) avisos.push({ codigo: "fuente_alternativa", texto: "open.er-api.com no respondio: las monedas salen de frankfurter.dev." });
    if (!vivoDolares && !vivoMonedas && copia) {
      avisos.push({ codigo: "sin_conexion", texto: `No pude conectar con las cotizaciones: uso la copia del build${deLaCopia}.` });
    } else {
      if (!vivoDolares && copia) avisos.push({ codigo: "copia", texto: `No pude traer dolarapi.com: los dolares salen de la copia del build${deLaCopia}.` });
      if (!vivoMonedas && copia) avisos.push({ codigo: "copia", texto: `No pude traer las monedas: salen de la copia del build${deLaCopia}.` });
    }

    const tasas = normalizar(crudas);
    const hayDolares = Boolean(tasas.fuentes.dolares), hayMonedas = Boolean(tasas.fuentes.monedas);
    if (!hayDolares && !hayMonedas) {
      avisos.push({ codigo: "sin_datos", texto: "No hay cotizaciones: sin conexion y sin copia. No se puede convertir de moneda." });
      return { tasas, origen: "sin_datos", avisos };
    }
    if (hayDolares && !hayMonedas) avisos.push({ codigo: "sin_monedas", texto: "No hay cotizaciones de otras monedas: solo se puede convertir entre pesos y dolares." });
    if (!hayDolares && hayMonedas) avisos.push({ codigo: "sin_dolares", texto: "No hay cotizacion del dolar: no se puede convertir a pesos." });
    const origen = vivoDolares && vivoMonedas ? "vivo" : vivoDolares || vivoMonedas ? "mixto" : "copia";
    return { tasas, origen, avisos };
  }

  const api = { URLS, TIPOS_DOLAR, normalizar, convertir, antiguedad, cotizar };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Monedas = api;
})(this);
