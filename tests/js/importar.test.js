const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../../js/importar.js");
const C = require("../../js/calculadora.js");

const RUBROS = ["smartphone", "notebook", "pc", "monitor", "componente", "periferico", "otro"];

test("cada rubro tiene un peso tipico positivo, y el que no conoce cae en «otro»", () => {
  for (const r of RUBROS) assert.ok(I.PESO_TIPICO[r] > 0, r);
  const sinRubro = I.hrefCalculadora(100, "rubro-raro", "/");
  assert.equal(C.estadoDeUrl(sinRubro.split("#")[0].split("?")[1]).peso, String(I.PESO_TIPICO.otro));
});

test("el estado precargado trae el precio en dolares y el peso del rubro, el resto por defecto", () => {
  const e = I.estadoImportar(199.5, "notebook");
  assert.equal(e.valor, "199.5");
  assert.equal(e.moneda, "USD");
  assert.equal(e.peso, "2.5");
  assert.equal(e.pago, C.POR_DEFECTO.pago);
  assert.equal(e.aduana, C.POR_DEFECTO.aduana);
});

test("el precio se redondea a centavos y nunca sale en notacion cientifica", () => {
  assert.equal(I.estadoImportar(1234.5678, "pc").valor, "1234.57");
  assert.equal(I.estadoImportar(3, "monitor").valor, "3");
});

test("el enlace abre #costo con la calculadora precargada, y se lee de vuelta igual", () => {
  const href = I.hrefCalculadora(250, "smartphone", "/buscador/");
  assert.ok(href.startsWith("/buscador/?"), href);
  assert.ok(href.endsWith("#costo"), href);
  const leido = C.estadoDeUrl(href.split("?")[1].split("#")[0]);
  assert.equal(leido.valor, "250");
  assert.equal(leido.moneda, "USD");
  assert.equal(leido.peso, "0.3");
});

test("solo Amazon lleva el tag de afiliado; con termino, va a la busqueda de ese producto", () => {
  const amazon = I.FUENTES.find(f => f.id === "amazon");
  assert.equal(amazon.afiliado, true);
  assert.equal(I.enlaceFuente(amazon), "https://www.amazon.com/?tag=lapichincha-20");
  assert.equal(I.enlaceFuente(amazon, "usb c hub"), "https://www.amazon.com/s?k=usb%20c%20hub&tag=lapichincha-20");
  for (const f of I.FUENTES.filter(f => f.id !== "amazon")) {
    assert.equal(f.afiliado, false, f.id);
    assert.equal(I.enlaceFuente(f, "algo"), f.url, f.id);
  }
});

test("las fuentes son https y estan las tres que pide el dueño", () => {
  assert.deepEqual(I.FUENTES.map(f => f.id).sort(), ["amazon", "loquieroaca", "tiendamia"]);
  for (const f of I.FUENTES) assert.match(f.url, /^https:\/\//, f.id);
});
