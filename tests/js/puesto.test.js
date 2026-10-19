const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const P = require("../../js/puesto.js");
const M = require("../../js/monedas.js");

// Las reglas reales (importacion.json) y las cotizaciones reales guardadas el 15/10/2026: nunca la red.
const REGLAS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "importacion.json"), "utf8"));
const leer = n => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "monedas", n), "utf8"));
const TASAS = M.normalizar({ dolarapi: leer("dolarapi-dolares.json"), erapi: leer("erapi-usd.json"), frankfurter: leer("frankfurter-usd.json") });
const CTX = { reglas: REGLAS, tasas: TASAS };   // el dolar oficial vende a $1.530

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, { tienda = "comparaya", sellos = "ie", modelo = "" } = {}) =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", 0, 0, "", sellos, modelo];

test("dentro de la franquicia solo se suma el IVA: 200 dolares son $306.000 y puestos en casa $370.260", () => {
  const e = P.estimar(fila("Monitor 24", 306000), "pc", CTX);
  assert.equal(e.ok, true);
  assert.equal(e.fobUsd, 200);
  assert.equal(e.maxPesos, 370260);          // 200 * 1,21 = 242 dolares * 1530
  assert.equal(e.minPesos, 306000);          // si el precio publicado ya trae los impuestos
  assert.equal(e.regimen, "franquicia");
  assert.equal(e.dolar.venta, 1530);
});

test("un celular tiene derecho de importacion 0% (oficial): sobre el excedente suma tasa e IVA y solo falta el interno", () => {
  const e = P.estimar(fila("Celular", 1530000), "smartphone", CTX);   // 1000 dolares
  assert.equal(e.regimen, "excedente");
  // tasa 3% de 600 = 18; IVA 21% de (1000 + 18) = 213,78; total 1231,78 dolares; impuesto interno sin base: queda como pendiente
  assert.equal(e.maxPesos, Math.round(1231.78 * 1530));
  assert.ok(e.faltan.includes("impuesto interno"), "el interno del celular no tiene base confirmada");
  assert.ok(!e.faltan.includes("derecho de importación"));
});

test("el derecho de importacion del hardware esta pendiente: el maximo es un piso y el texto lo dice", () => {
  const e = P.estimar(fila("Placa de video", 1530000), "componente", CTX);
  assert.ok(e.faltan.includes("derecho de importación"));
  assert.equal(e.completo, false);
  assert.match(P.texto(e), /derecho de importación/);
  assert.match(P.texto(e), /estimaci[oó]n/i);
});

test("un monitor o un celular pagan impuesto interno; un componente no", () => {
  assert.ok(P.estimar(fila("Monitor", 306000), "monitor", CTX).faltan.includes("impuesto interno"));
  assert.ok(!P.estimar(fila("SSD", 306000), "componente", CTX).faltan.includes("impuesto interno"));
});

test("sin percepcion: se paga en pesos a la plataforma y el maximo no suma el 30%", () => {
  const e = P.estimar(fila("SSD", 306000), "componente", CTX);
  assert.equal(e.maxPesos, 370260);
});

test("sobre el tope del regimen no se estima: se dice por que", () => {
  const e = P.estimar(fila("Notebook", 5000000), "notebook", CTX);   // ~3.268 dolares, mas que el tope de las reglas
  assert.equal(e.ok, false);
  assert.match(e.motivo, /3\.?000/);
  assert.equal(P.texto(e).startsWith("No se estima"), true);
});

test("sin reglas o sin cotizacion del dolar no se inventa nada", () => {
  assert.equal(P.estimar(fila("A", 100000), "otro", { reglas: null, tasas: TASAS }).ok, false);
  assert.equal(P.estimar(fila("A", 100000), "otro", { reglas: REGLAS, tasas: null }).ok, false);
  assert.equal(P.estimar(fila("A", 100000), "otro", {}).ok, false);
  assert.equal(P.estimar(fila("A", 100000), "otro").ok, false);
  assert.equal(P.estimar(fila("A", 0), "otro", CTX).ok, false);
});

test("comparar con el equivalente local dice cuanto mas barato o mas caro sale en cada extremo", () => {
  const e = P.estimar(fila("SSD", 306000), "componente", CTX);          // entre 306.000 y 370.260
  const c = P.comparar(e, fila("SSD local", 400000, { tienda: "venex", sellos: "", modelo: "X" }));
  assert.equal(c.localPesos, 400000);
  assert.equal(c.minPct, 23.5);      // (400000-306000)/400000
  assert.equal(c.maxPct, 7.4);       // (400000-370260)/400000
  assert.match(P.textoComparacion(c, "Venex"), /entre 23,5% y 7,4% más barato/);
});

test("si importar puede salir mas caro o mas barato segun el caso, lo dice sin elegir", () => {
  const e = P.estimar(fila("SSD", 306000), "componente", CTX);
  const c = P.comparar(e, fila("SSD local", 330000, { tienda: "venex", sellos: "" }));
  assert.ok(c.minPct > 0 && c.maxPct < 0);
  assert.match(P.textoComparacion(c, "Venex"), /entre 7,3% más barato y 12,2% más caro/);
});

test("sin estimacion no hay comparacion", () => {
  const e = P.estimar(fila("Notebook", 5000000), "notebook", CTX);
  assert.equal(P.comparar(e, fila("N", 1, { sellos: "" })), null);
  assert.equal(P.comparar(P.estimar(fila("A", 100000), "otro", CTX), null), null);
});

test("el texto de una estimacion completa no promete lo que no sabe", () => {
  const t = P.texto(P.estimar(fila("Celular", 306000), "smartphone", CTX));   // franquicia, derecho 0%
  assert.match(t, /\$306\.000/);
  assert.match(t, /\$370\.260/);
  assert.match(t, /ya trae los impuestos/);
});
