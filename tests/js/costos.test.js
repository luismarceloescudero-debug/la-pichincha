const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const C = require("../../js/costos.js");
const REGLAS = require("../../importacion.json");

/* Casos de referencia de specs/010-costos/spec.md. ARCA no publica ejemplos numericos: se derivan de las reglas.
   El derecho de importacion de los casos B y D (20%) es un supuesto del test, no una regla verificada. */

const calc = (entrada, reglas = REGLAS) => C.calcular({ fobUsd: 0, derechoImportacionPct: 0, ...entrada }, reglas);
const renglon = (r, clave) => r.renglones.find(x => x.clave === clave);

test("A. dentro de la franquicia solo se paga IVA", () => {
  const r = calc({ fobUsd: 300 });
  assert.equal(r.valido, true);
  assert.equal(r.regimen, "franquicia");
  assert.equal(renglon(r, "iva").montoUsd, 63);
  assert.equal(renglon(r, "derecho_importacion").exento, true);
  assert.equal(renglon(r, "tasa_estadistica").exento, true);
  assert.equal(renglon(r, "derecho_importacion").montoUsd, 0);
  assert.equal(r.tributosUsd, 63);
  assert.equal(r.totalUsd, 363);
});

test("B. el excedente paga derechos y tasa solo sobre lo que pasa de la franquicia, y el IVA sobre todo el valor mas esos tributos", () => {
  const r = calc({ fobUsd: 800, derechoImportacionPct: 20 });
  assert.equal(r.regimen, "excedente");
  assert.equal(renglon(r, "derecho_importacion").baseUsd, 400);
  assert.equal(renglon(r, "derecho_importacion").montoUsd, 80);
  assert.equal(renglon(r, "tasa_estadistica").montoUsd, 12);
  assert.equal(renglon(r, "iva").baseUsd, 892);
  assert.equal(renglon(r, "iva").montoUsd, 187.32);
  assert.equal(r.tributosUsd, 279.32);
  assert.equal(r.totalUsd, 1079.32);
});

test("C. el excedente de un celular, con derecho 0%, paga solo tasa e IVA", () => {
  const r = calc({ fobUsd: 500, derechoImportacionPct: 0 });
  assert.equal(renglon(r, "derecho_importacion").montoUsd, 0);
  assert.equal(renglon(r, "tasa_estadistica").montoUsd, 3);
  assert.equal(renglon(r, "iva").baseUsd, 503);
  assert.equal(renglon(r, "iva").montoUsd, 105.63);
  assert.equal(r.tributosUsd, 108.63);
});

test("D. con el cupo anual agotado no hay franquicia: todo cae sobre el valor total", () => {
  const r = calc({ fobUsd: 300, derechoImportacionPct: 20, enviosUsadosEsteAnio: 5 });
  assert.equal(r.regimen, "cupo_agotado");
  assert.equal(renglon(r, "derecho_importacion").baseUsd, 300);
  assert.equal(renglon(r, "derecho_importacion").montoUsd, 60);
  assert.equal(renglon(r, "tasa_estadistica").montoUsd, 9);
  assert.equal(renglon(r, "iva").baseUsd, 369);
  assert.equal(renglon(r, "iva").montoUsd, 77.49);
  assert.equal(r.tributosUsd, 146.49);
});

test("el quinto envio todavia tiene franquicia y el sexto no", () => {
  assert.equal(calc({ fobUsd: 300, enviosUsadosEsteAnio: 4 }).regimen, "franquicia");
  assert.equal(calc({ fobUsd: 300, enviosUsadosEsteAnio: 5 }).regimen, "cupo_agotado");
});

test("justo en la franquicia (USD 400) no hay excedente", () => {
  const r = calc({ fobUsd: 400, derechoImportacionPct: 20 });
  assert.equal(r.regimen, "franquicia");
  assert.equal(r.tributosUsd, 84);
});

test("E. sobre el tope de USD 3.000 no entra al regimen de pequeños envios", () => {
  const r = calc({ fobUsd: 3500, derechoImportacionPct: 20 });
  assert.equal(r.regimen, "fuera_de_regimen");
  assert.equal(r.tributosUsd, null);
  assert.deepEqual(r.renglones, []);
  assert.ok(r.avisos.some(a => a.codigo === "tope" && /despachante/.test(a.texto)));
});

test("mas de 3 unidades iguales o mas de 50 kg tampoco entran, y lo dice", () => {
  const unidades = calc({ fobUsd: 300, unidades: 4 });
  assert.equal(unidades.regimen, "fuera_de_regimen");
  assert.ok(unidades.avisos.some(a => a.codigo === "unidades"));
  const peso = calc({ fobUsd: 300, pesoKg: 51 });
  assert.equal(peso.regimen, "fuera_de_regimen");
  assert.ok(peso.avisos.some(a => a.codigo === "peso"));
  assert.equal(calc({ fobUsd: 300, unidades: 3, pesoKg: 50 }).regimen, "franquicia");
});

test("un derecho que no se informo queda como no incluido y el calculo se marca incompleto", () => {
  const r = C.calcular({ fobUsd: 800 }, REGLAS);                  // sin derechoImportacionPct
  assert.equal(r.completo, false);
  assert.equal(renglon(r, "derecho_importacion").montoUsd, null);
  assert.ok(r.noIncluido.some(n => n.clave === "derecho_importacion_hardware_pct" && /posicion|NCM/i.test(n.motivo)));
  assert.equal(renglon(r, "tasa_estadistica").montoUsd, 12);     // lo demas se calcula igual
});

test("dentro de la franquicia no hace falta el derecho: el calculo sale completo sin el", () => {
  const r = C.calcular({ fobUsd: 300 }, REGLAS);
  assert.equal(r.completo, true);
  assert.ok(!r.noIncluido.some(n => n.clave === "derecho_importacion_hardware_pct"));
});

test("las percepciones del courier y los honorarios, que son pendientes, se avisan y no se suman", () => {
  const r = calc({ fobUsd: 300 });
  const claves = r.noIncluido.map(n => n.clave);
  assert.ok(claves.includes("percepciones_courier"));
  assert.ok(claves.includes("honorarios_courier"));
  assert.equal(r.totalUsd, 363);
  const con = calc({ fobUsd: 300, honorariosUsd: 25 });
  assert.ok(!con.noIncluido.some(n => n.clave === "honorarios_courier"));
  assert.equal(con.totalUsd, 388);                                  // lo que escribe la persona se suma
  assert.equal(renglon(con, "honorarios").nivel, "dato");
});

test("el impuesto interno lo escribe la persona; si lo pide y no lo escribe, queda como no incluido", () => {
  const sin = calc({ fobUsd: 300, aplicaImpuestoInterno: true });
  assert.ok(sin.noIncluido.some(n => n.clave === "base_impuesto_interno"));
  const con = calc({ fobUsd: 300, aplicaImpuestoInterno: true, impuestoInternoUsd: 28.5 });
  assert.ok(!con.noIncluido.some(n => n.clave === "base_impuesto_interno"));
  assert.equal(renglon(con, "impuesto_interno").montoUsd, 28.5);
  assert.equal(con.totalUsd, 363 + 28.5);
});

test("el flete y el seguro se muestran con y sin integrar el valor en aduana, y el resultado trae el rango", () => {
  const r = calc({ fobUsd: 300, fleteUsd: 40, seguroUsd: 10 });
  assert.equal(r.escenarios.fleteFueraDeBase.tributosUsd, 63);
  assert.equal(r.escenarios.fleteEnBase.tributosUsd, 73.5);        // IVA sobre 350
  assert.equal(r.totalUsd, 300 + 50 + 63);                         // el principal es el declarado FOB
  assert.equal(r.escenarios.fleteEnBase.totalUsd, 300 + 50 + 73.5);
  assert.ok(r.rangoUsd.minUsd <= r.totalUsd && r.rangoUsd.maxUsd >= r.escenarios.fleteEnBase.totalUsd);
  assert.ok(renglon(r, "iva").nivel === "oficial");
});

test("con el flete en la base, la franquicia se mide con el FOB y los derechos incluyen el flete del excedente", () => {
  // FOB 800 y flete 100: excedente FOB 400 + flete 100 = 500 de base de derechos (20% = 100) y tasa (3% = 15);
  // el IVA cae sobre todo el valor en aduana (900) mas esos tributos: 1.015 -> 213,15.
  const r = calc({ fobUsd: 800, fleteUsd: 100, derechoImportacionPct: 20, fleteEnValorAduana: "si" });
  assert.equal(renglon(r, "derecho_importacion").baseUsd, 500);
  assert.equal(renglon(r, "derecho_importacion").montoUsd, 100);
  assert.equal(renglon(r, "tasa_estadistica").montoUsd, 15);
  assert.equal(renglon(r, "iva").baseUsd, 1015);
  assert.equal(renglon(r, "iva").montoUsd, 213.15);
});

test("la percepcion del 30% se calcula aparte sobre lo que se paga con tarjeta en pesos y no es un tributo", () => {
  const r = calc({ fobUsd: 300, fleteUsd: 40, seguroUsd: 10 });
  assert.equal(r.percepcionUsd, 105);                              // 30% de 350
  assert.equal(r.totalConPercepcionUsd, r.totalUsd + 105);
  assert.equal(r.tributosUsd, 63);                                 // no entra en los tributos
  assert.equal(r.percepcionNota.includes("pago a cuenta"), true);
  assert.equal(r.rangoUsd.maxUsd, r.escenarios.fleteEnBase.totalUsd + 105);
});

test("si se sabe como se paga, el rango cuenta la percepcion en los dos extremos o en ninguno", () => {
  // FOB 300 y flete 100: sin flete en la base el total es 463 y con flete en la base 484; la percepcion es 30% de 400 = 120.
  const tarjeta = calc({ fobUsd: 300, fleteUsd: 100, medioPago: "tarjeta_pesos" });
  assert.deepEqual(tarjeta.rangoUsd, { minUsd: 583, maxUsd: 604 });
  const dolares = calc({ fobUsd: 300, fleteUsd: 100, medioPago: "dolares_propios" });
  assert.deepEqual(dolares.rangoUsd, { minUsd: 463, maxUsd: 484 });
});

test("si no se sabe como se paga, el rango va del que no tiene percepcion al que la tiene", () => {
  const r = calc({ fobUsd: 300 });                                // sin flete: la unica incertidumbre es el medio de pago
  assert.deepEqual(r.rangoUsd, { minUsd: 363, maxUsd: 453 });
});

test("el medio de pago solo puede ser uno de los dos conocidos", () => {
  const r = calc({ fobUsd: 300, medioPago: "cripto" });
  assert.equal(r.valido, false);
  assert.ok(r.avisos.some(a => /medio de pago/.test(a.texto)));
});

test("los montos se redondean al centavo", () => {
  assert.equal(renglon(calc({ fobUsd: 100.01 }), "iva").montoUsd, 21);
  assert.equal(renglon(calc({ fobUsd: 100.03 }), "iva").montoUsd, 21.01);
  assert.equal(renglon(calc({ fobUsd: 333.33 }), "iva").montoUsd, 70);
});

test("entradas invalidas: negativos, no numeros y valor cero", () => {
  for (const entrada of [{ fobUsd: -5 }, { fobUsd: NaN }, { fobUsd: "mucho" }, { fobUsd: 100, fleteUsd: -1 }, { fobUsd: 100, derechoImportacionPct: -3 }]) {
    const r = calc(entrada);
    assert.equal(r.valido, false, JSON.stringify(entrada));
    assert.ok(r.avisos.length >= 1);
    assert.equal(r.tributosUsd, null);
  }
  assert.equal(calc({ fobUsd: 0 }).valido, false);
});

test("las reglas mandan: con otra franquicia el mismo envio da otro resultado, sin tocar el codigo", () => {
  const otras = JSON.parse(JSON.stringify(REGLAS));
  otras.reglas.franquicia_usd.valor = 500;
  const r = calc({ fobUsd: 600, derechoImportacionPct: 20 }, otras);
  assert.equal(renglon(r, "derecho_importacion").baseUsd, 100);
  assert.equal(calc({ fobUsd: 600, derechoImportacionPct: 20 }).regimen, "excedente");
  const bajaTasa = JSON.parse(JSON.stringify(REGLAS));
  bajaTasa.reglas.iva_general_pct.valor = 10.5;
  assert.equal(renglon(calc({ fobUsd: 300 }, bajaTasa), "iva").montoUsd, 31.5);
});

test("sin reglas, o con una regla firme que falta, falla con un mensaje claro", () => {
  assert.throws(() => C.calcular({ fobUsd: 100 }), /reglas/i);
  const rotas = JSON.parse(JSON.stringify(REGLAS));
  delete rotas.reglas.tasa_estadistica_pct;
  assert.throws(() => C.calcular({ fobUsd: 100 }, rotas), /tasa_estadistica_pct/);
  const pendiente = JSON.parse(JSON.stringify(REGLAS));
  pendiente.reglas.iva_general_pct = { ...pendiente.reglas.iva_general_pct, nivel: "pendiente", valor: null };
  assert.throws(() => C.calcular({ fobUsd: 100 }, pendiente), /iva_general_pct/);
});

test("cada renglon trae su regla y su nivel de confianza, tomados de importacion.json", () => {
  const r = calc({ fobUsd: 800, derechoImportacionPct: 20 });
  assert.equal(renglon(r, "iva").nivel, REGLAS.reglas.iva_general_pct.nivel);
  assert.equal(renglon(r, "iva").regla, "iva_general_pct");
  assert.equal(renglon(r, "tasa_estadistica").regla, "tasa_estadistica_pct");
  assert.equal(renglon(r, "tasa_estadistica").alicuotaPct, REGLAS.reglas.tasa_estadistica_pct.valor);
});

test("ningun numero de normativa esta escrito en el codigo: todo sale de importacion.json", () => {
  const fuente = fs.readFileSync(path.join(__dirname, "..", "..", "js", "costos.js"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const numero of ["400", "3000", "3\\.000", "21", "0\\.21", "0\\.03", "30", "0\\.3", "50", "10\\.5", "20"]) {
    assert.doesNotMatch(fuente, new RegExp(`(?<![\\w.])${numero}(?![\\w.])`), `el numero ${numero} no puede estar en costos.js`);
  }
});
