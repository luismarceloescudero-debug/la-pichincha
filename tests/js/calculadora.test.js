const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const K = require("../../js/calculadora.js");
const Costos = require("../../js/costos.js");
const Monedas = require("../../js/monedas.js");

const RAIZ = path.join(__dirname, "..", "..");
const REGLAS = JSON.parse(fs.readFileSync(path.join(RAIZ, "importacion.json"), "utf8"));
const fixture = n => JSON.parse(fs.readFileSync(path.join(RAIZ, "tests", "fixtures", "monedas", n), "utf8"));
const TASAS = Monedas.normalizar({ dolarapi: fixture("dolarapi-dolares.json"), erapi: fixture("erapi-usd.json") });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const estado = cambios => ({ ...K.POR_DEFECTO, ...cambios });
const calcular = (cambios, tasas = TASAS) => {
  const { entrada, errores } = K.entradaDe(estado(cambios), tasas, Monedas.convertir);
  return { entrada, errores, res: errores.length ? null : Costos.calcular(entrada, REGLAS) };
};

/* --- Numeros como los escribe una persona en Argentina --- */
test("numero entiende coma decimal, punto de miles y punto decimal", () => {
  assert.strictEqual(K.numero("800"), 800);
  assert.strictEqual(K.numero("1.234,56"), 1234.56);
  assert.strictEqual(K.numero("1234,5"), 1234.5);
  assert.strictEqual(K.numero("1234.5"), 1234.5);
  assert.strictEqual(K.numero("1.500"), 1500);            // con tres cifras despues del punto es de miles
  assert.strictEqual(K.numero("1.234.567"), 1234567);
  assert.strictEqual(K.numero("1,234.56"), 1234.56);      // formato ingles completo
  assert.strictEqual(K.numero(" 15 "), 15);
  assert.strictEqual(K.numero("US$ 300"), 300);
  assert.strictEqual(K.numero("100 USD"), 100);
  assert.strictEqual(K.numero(",5"), 0.5);
});

test("numero devuelve null si esta vacio y NaN si no es un numero", () => {
  assert.strictEqual(K.numero(""), null);
  assert.strictEqual(K.numero("   "), null);
  assert.strictEqual(K.numero(undefined), null);
  assert.ok(Number.isNaN(K.numero("abc")));
  assert.ok(Number.isNaN(K.numero("1,2,3")));
  assert.ok(Number.isNaN(K.numero("-5")));
});

/* --- Estado en la URL: el enlace para compartir --- */
test("estadoDeUrl lee los campos y descarta lo que no es valido", () => {
  const e = K.estadoDeUrl("?v=800&m=EUR&f=30&pg=tarjeta_pesos&a=si&c=entrega&td=blue&i=si&q=ssd");
  assert.strictEqual(e.valor, "800");
  assert.strictEqual(e.moneda, "EUR");
  assert.strictEqual(e.flete, "30");
  assert.strictEqual(e.pago, "tarjeta_pesos");
  assert.strictEqual(e.aduana, "si");
  assert.strictEqual(e.cobro, "entrega");
  assert.strictEqual(e.dolar, "blue");
  assert.strictEqual(e.interno, "si");
  const raro = K.estadoDeUrl("?m=eur1&pg=efectivo&a=quizas&td=<script>&v=" + "9".repeat(40));
  assert.strictEqual(raro.moneda, "USD");
  assert.strictEqual(raro.pago, "");
  assert.strictEqual(raro.aduana, "ambos");
  assert.strictEqual(raro.dolar, "oficial");
  assert.ok(raro.valor.length <= 20);
});

test("tieneEstado dice si la URL trae una cuenta para abrir", () => {
  assert.ok(K.tieneEstado("?v=800"));
  assert.ok(!K.tieneEstado("?q=ssd"));
  assert.ok(!K.tieneEstado(""));
});

test("urlDeEstado arma un enlace corto, solo con lo que no es por defecto, y vuelve igual", () => {
  const e = estado({ valor: "800", flete: "30", pago: "dolares_propios" });
  const url = K.urlDeEstado("/la-pichincha/", e);
  assert.ok(url.startsWith("/la-pichincha/?"));
  assert.ok(url.endsWith("#costo"));
  assert.ok(!url.includes("m=USD"), "lo que esta por defecto no va");
  const [search] = url.split("#");
  assert.deepStrictEqual(K.estadoDeUrl(search.slice(search.indexOf("?"))), e);
  assert.strictEqual(K.urlDeEstado("/", K.POR_DEFECTO), "/#costo");
});

/* --- De lo que escribe la persona a la entrada del motor (K1) --- */
test("entradaDe pasa los textos a la entrada del motor en dolares", () => {
  const { entrada, errores, conversion } = K.entradaDe(estado({ valor: "800", flete: "40", seguro: "5", envios: "2",
    unidades: "1", peso: "1,5", derecho: "20", pago: "tarjeta_pesos", aduana: "no", honorarios: "15" }), TASAS, Monedas.convertir);
  assert.deepStrictEqual(errores, []);
  assert.strictEqual(conversion, null);
  assert.deepStrictEqual(entrada, { fobUsd: 800, fleteUsd: 40, seguroUsd: 5, derechoImportacionPct: 20, enviosUsadosEsteAnio: 2,
    unidades: 1, pesoKg: 1.5, medioPago: "tarjeta_pesos", fleteEnValorAduana: "no", honorariosUsd: 15,
    aplicaImpuestoInterno: false, impuestoInternoUsd: null });
});

test("entradaDe deja en null lo que no se escribio: el motor lo trata como no sabido", () => {
  const { entrada } = K.entradaDe(estado({ valor: "300" }), TASAS, Monedas.convertir);
  assert.strictEqual(entrada.derechoImportacionPct, null);
  assert.strictEqual(entrada.honorariosUsd, null);
  assert.strictEqual(entrada.medioPago, undefined);
  assert.strictEqual(entrada.fleteUsd, null);
  assert.strictEqual(entrada.pesoKg, null);
});

test("entradaDe convierte de otra moneda a dolares con la cotizacion del dia", () => {
  const { entrada, conversion } = K.entradaDe(estado({ valor: "100", moneda: "EUR", flete: "10" }), TASAS, Monedas.convertir);
  const eur = TASAS.porUsd.EUR;
  assert.strictEqual(entrada.fobUsd, Math.round(100 / eur * 100) / 100);
  assert.strictEqual(entrada.fleteUsd, Math.round(10 / eur * 100) / 100);
  assert.strictEqual(conversion.moneda, "EUR");
  assert.ok(conversion.fuentes.length);
});

test("entradaDe explica que falta y no inventa si no hay cotizacion de la moneda", () => {
  const { errores } = K.entradaDe(estado({ valor: "100", moneda: "EUR" }), null, Monedas.convertir);
  assert.strictEqual(errores.length, 1);
  assert.match(errores[0].texto, /EUR/);
  assert.strictEqual(errores[0].campo, "moneda");
});

test("entradaDe marca cada campo mal escrito con su nombre", () => {
  const { errores } = K.entradaDe(estado({ valor: "", flete: "mucho", derecho: "x" }), TASAS, Monedas.convertir);
  const campos = errores.map(e => e.campo).sort();
  assert.deepStrictEqual(campos, ["derecho", "flete", "valor"]);
  assert.ok(errores.every(e => e.texto.length > 10));
});

/* --- Los casos de referencia de la spec 010, de punta a punta --- */
test("caso A: USD 300 dentro de la franquicia paga solo IVA (USD 63)", () => {
  const { res } = calcular({ valor: "300", pago: "dolares_propios" });
  assert.strictEqual(res.regimen, "franquicia");
  assert.strictEqual(res.tributosUsd, 63);
});

test("caso B: USD 800 con derecho 20% paga 279,32 de tributos", () => {
  const { res } = calcular({ valor: "800", derecho: "20" });
  assert.strictEqual(res.regimen, "excedente");
  assert.strictEqual(res.tributosUsd, 279.32);
});

test("caso D: con el cupo agotado todo tributa sobre el valor total", () => {
  const { res } = calcular({ valor: "300", derecho: "20", envios: "5" });
  assert.strictEqual(res.regimen, "cupo_agotado");
  assert.strictEqual(res.tributosUsd, 146.49);
});

/* --- El desglose que ve la persona --- */
const html = (cambios, opciones = {}) => {
  const { res } = calcular(cambios);
  return K.resultadoHtml(res, { esc, aPesos: usd => usd * 1000, dolarNombre: "Oficial", ...opciones, estado: estado(cambios) });
};

test("el desglose muestra cada renglon con su confianza y el aviso de estimacion", () => {
  const h = html({ valor: "800", derecho: "20" });
  for (const texto of ["Derecho de importación", "Tasa de estadística", "IVA", "oficial", "dato tuyo", "Estimación, no asesoramiento"]) {
    assert.ok(h.includes(texto), texto);
  }
  assert.ok(h.includes("US$ 279,32"), "tributos en dolares con coma decimal");
  assert.ok(h.includes("$ 279.320"), "tributos en pesos");
});

test("lo pendiente se dice: sin derecho no hay total completo y aparece en «no incluido»", () => {
  const h = html({ valor: "800" });
  assert.ok(h.includes("sin dato"));
  assert.ok(h.includes("No incluido"));
  assert.ok(h.includes("incompleto"));
});

test("dentro de la franquicia el derecho y la tasa figuran como exentos", () => {
  const h = html({ valor: "300" });
  assert.ok(h.includes("exento"));
});

test("la percepcion es un escenario: con tarjeta en pesos se suma aparte y se explica", () => {
  const h = html({ valor: "300", pago: "tarjeta_pesos" });
  assert.match(h, /Percepción/);
  assert.match(h, /pago a cuenta/);
  const sinTarjeta = html({ valor: "300", pago: "dolares_propios" });
  assert.match(sinTarjeta, /no corresponde percepción/i);
});

test("el rango aparece cuando no se sabe si el flete integra el valor en aduana", () => {
  assert.match(html({ valor: "800", derecho: "20", flete: "50" }), /Rango/);
});

test("donde se pagan los tributos cambia quien absorbe la diferencia", () => {
  assert.match(html({ valor: "300", cobro: "checkout" }), /la tienda/);
  assert.match(html({ valor: "300", cobro: "entrega" }), /al recibir/);
  assert.match(html({ valor: "300" }), /pregunt/);
});

test("fuera del regimen avisa y no muestra un desglose", () => {
  const h = html({ valor: "3500" });
  assert.match(h, /despachante/);
  assert.ok(!h.includes("<table"));
});

test("una entrada invalida se muestra como error, no como cuenta", () => {
  const res = Costos.calcular({ fobUsd: 100, unidades: 1.5 }, REGLAS);
  const h = K.resultadoHtml(res, { esc, aPesos: () => null, estado: estado({}) });
  assert.match(h, /role="alert"/);
  assert.match(h, /unidades/);
});

test("sin cotizacion del dolar no inventa pesos: dice que no hay", () => {
  const h = html({ valor: "300" }, { aPesos: () => null });
  assert.match(h, /sin cotización/);
});

test("el desglose escapa lo que viene de afuera", () => {
  const res = Costos.calcular({ fobUsd: 100 }, REGLAS);
  res.noIncluido = [{ clave: "x", motivo: "<img src=x onerror=alert(1)>" }];
  const h = K.resultadoHtml(res, { esc, aPesos: () => 1, estado: estado({}) });
  assert.ok(!h.includes("<img"));
});

/* --- Formulario --- */
test("el formulario trae una etiqueta por campo y los valores del estado, escapados", () => {
  const h = K.formularioHtml(estado({ valor: '8"00', moneda: "EUR", pago: "tarjeta_pesos" }), { esc, tiposDolar: Monedas.TIPOS_DOLAR });
  for (const id of ["k-valor", "k-moneda", "k-flete", "k-seguro", "k-envios", "k-unidades", "k-peso", "k-derecho", "k-pago",
    "k-aduana", "k-honorarios", "k-consulta", "k-interno", "k-internoMonto", "k-cobro", "k-dolar"]) {
    assert.ok(h.includes(`for="${id}"`), "etiqueta de " + id);
    assert.ok(h.includes(`id="${id}"`), "campo " + id);
  }
  assert.ok(h.includes('value="8&quot;00"'));
  assert.match(h, /<option value="EUR" selected>/);
  assert.match(h, /<option value="tarjeta_pesos" selected>/);
  assert.match(h, /<option value="blue">Blue<\/option>/);
});

test("estadoDeFormulario lee los valores por nombre de campo", () => {
  const valores = { valor: "500", moneda: "USD", interno: "si" };
  const e = K.estadoDeFormulario(nombre => valores[nombre]);
  assert.strictEqual(e.valor, "500");
  assert.strictEqual(e.interno, "si");
  assert.strictEqual(e.unidades, K.POR_DEFECTO.unidades);
});

/* --- Medicion y vencimiento de las reglas --- */
test("eventoCalculo cuenta el regimen y si la cuenta quedo completa, sin datos de la persona", () => {
  const { res } = calcular({ valor: "800", derecho: "20" });
  assert.deepStrictEqual(K.eventoCalculo(res), { path: "calculadora/excedente", title: "completo", event: true });
  assert.strictEqual(K.eventoCalculo(Costos.calcular({ fobUsd: -1 }, REGLAS)), null);
  assert.strictEqual(K.eventoCalculo(null), null);
});

test("vigencia avisa cuando las reglas pasan los 60 dias sin verificar", () => {
  const al = K.vigencia(REGLAS, "2026-10-20T12:00:00Z");
  assert.strictEqual(al.vieja, false);
  assert.strictEqual(al.verificado, REGLAS.verificado);
  const despues = K.vigencia(REGLAS, "2027-03-01T12:00:00Z");
  assert.strictEqual(despues.vieja, true);
  assert.ok(despues.dias > 60);
  assert.strictEqual(K.vigencia({}, "2026-10-20").dias, null);
});

test("formatos de plata: dolares con centavos, pesos redondeados", () => {
  assert.strictEqual(K.usd(1234.5), "US$ 1.234,50");
  assert.strictEqual(K.ars(1234567.8), "$ 1.234.568");
  assert.strictEqual(K.usd(null), "—");
  assert.strictEqual(K.ars(null), "—");
});

test("con tarjeta en pesos se ve aparte lo que sale de la tarjeta, y el rango dice que incluye la percepcion", () => {
  const h = html({ valor: "800", derecho: "20", flete: "40", pago: "tarjeta_pesos" });
  assert.match(h, /Lo que sale de tu tarjeta/);
  assert.match(h, /ya incluyen la percepción/);
  assert.match(h, /si el envío suma al valor en aduana/);
  const sinDuda = html({ valor: "800", derecho: "20", flete: "40", aduana: "no", pago: "dolares_propios" });
  assert.ok(!sinDuda.includes("Rango"), "sabiendo todo no hay rango");
});

test("numero no toma un cero inicial como miles ni acepta separadores mal ubicados (revision externa)", () => {
  assert.strictEqual(K.numero("0.500"), 0.5);
  assert.strictEqual(K.numero(".500"), 0.5);
  assert.strictEqual(K.numero("0.001"), 0.001);
  assert.ok(Number.isNaN(K.numero("12.34,50")), "puntos que no separan miles");
  assert.ok(Number.isNaN(K.numero("1.5,5")));
  assert.ok(Number.isNaN(K.numero("1,23.4")));
  assert.strictEqual(K.numero("12.345,50"), 12345.5);
  assert.strictEqual(K.numero("12,345.50"), 12345.5);
});

test("con iconos: cada seccion lleva numero e icono, los montos su moneda y cada renglon su miniatura", () => {
  const icono = n => `<i data-ico="${n}"></i>`;
  const f = K.formularioHtml(estado({ moneda: "EUR" }), { esc, tiposDolar: [], icono });
  for (const n of ["paquete", "persona", "aduana"]) assert.ok(f.includes(`data-ico="${n}"`), n);
  assert.strictEqual((f.match(/class="k-prefijo"[^>]*>EUR</g) || []).length, 5, "valor, flete, seguro, honorarios e interno");
  assert.match(f, /class="k-sec k-sec-3"/);
  const { res } = calcular({ valor: "800", derecho: "20" });
  const h = K.resultadoHtml(res, { esc, aPesos: u => u, estado: estado({}), icono });
  for (const n of ["paquete", "aduana", "tabla", "recibo", "check", "persona"]) assert.ok(h.includes(`data-ico="${n}"`), n);
  assert.match(h, /id="k-total"/);
});
