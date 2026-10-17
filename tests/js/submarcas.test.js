const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");

const AEROFIT = "Soundcore AeroFit 2 by Anker Auriculares Bluetooth Abiertos Con Gancho Soundcore";

test("limpiar el titulo: quita «by Marca», palabras repetidas y espacios de mas", () => {
  assert.equal(B.limpiarTitulo("Soundcore AeroFit 2 by Anker"), "Soundcore AeroFit 2");
  assert.equal(B.limpiarTitulo("  Soundcore   AeroFit 2  by  Anker Auriculares Soundcore  auriculares "), "Soundcore AeroFit 2 Auriculares");
  assert.equal(B.limpiarTitulo("Mouse Logitech G502 Hero"), "Mouse Logitech G502 Hero");
});

test("submarca y marca madre: Soundcore es de Anker, y «by X» manda cuando esta", () => {
  assert.equal(B.submarcaDe("Auriculares Soundcore AeroFit 2 by Anker"), "soundcore");
  assert.equal(B.submarcaDe("Celular Xiaomi Redmi Note 14"), "redmi");
  assert.equal(B.submarcaDe("Mouse Logitech G502"), "");
  assert.equal(B.marcaMadreDe("Soundcore AeroFit 2"), "Anker");
  assert.equal(B.marcaMadreDe("Soundcore AeroFit 2 by Anker"), "Anker");
});

test("consultas: primero submarca + modelo, despues solo el modelo y por ultimo marca madre + modelo", () => {
  const c = B.consultasDe(AEROFIT);
  assert.deepEqual(c.consultas, ["Soundcore AeroFit 2", "AeroFit 2", "Anker AeroFit 2"]);
  assert.equal(c.submarca, "Soundcore");
  assert.equal(c.madre, "Anker");
  assert.equal(c.modelo, "AeroFit 2");
});

test("consultas: el modelo conserva su numero, asi AeroFit 2 no se confunde con AeroFit Pro ni con AeroClip", () => {
  const modelo = B.consultasDe("Soundcore AeroClip by Anker Auriculares de clip").modelo;
  assert.equal(modelo, "AeroClip");
  const coincide = B.filtroDe("Soundcore AeroFit 2");
  const n = t => B.normalBusq(t);
  assert.equal(coincide(n("Auriculares Soundcore AeroFit 2 by Anker")), true);
  assert.equal(coincide(n("Auriculares Soundcore AeroClip by Anker")), false);
  assert.equal(coincide(n("Auriculares Soundcore AeroFit Pro by Anker")), false);          // sin el 2
  assert.equal(B.filtroDe("AeroFit 2")(n("Auriculares Soundcore AeroClip")), false);
  assert.equal(B.filtroDe("Anker AeroFit 2")(n("Soundcore AeroFit 2 by Anker")), true);
});

test("consultas: la madre sale de «by X» o de la tabla, y sin submarca ni «by» no hay cadena", () => {
  assert.equal(B.consultasDe("Eufy Clean X8 Pro").madre, "Anker");
  assert.deepEqual(B.consultasDe("Eufy Clean X8 Pro").consultas, ["Eufy Clean X8 Pro", "Clean X8 Pro", "Anker Clean X8 Pro"]);
  assert.equal(B.consultasDe("Memoria Kingston Fury DDR5 16GB"), null);
  assert.deepEqual(B.consultasDe("Foobar Zeta 3 by Bazcorp Auriculares").consultas, ["Foobar Zeta 3", "Zeta 3", "Bazcorp Zeta 3"]);
});

test("el modelo se corta en las palabras genericas y en las especificaciones", () => {
  assert.equal(B.consultasDe("Auriculares Soundcore Liberty 4 Pro Bluetooth 50hs by Anker").modelo, "Liberty 4 Pro");
  assert.equal(B.consultasDe("Soundcore Space One 40hs inalambricos by Anker").modelo, "Space One");
});

test("al filtrar por marca se usa la submarca, que es como figura en los filtros", () => {
  const re = B.armarMarcasRe(["anker", "soundcore", "xiaomi"]);
  assert.equal(B.marcaDe("Auriculares Soundcore AeroFit 2 by Anker", re), "soundcore");
  assert.equal(B.marcaDe("Cargador Anker 65W", re), "anker");
  assert.equal(B.marcaDe("Celular Xiaomi Redmi Note 14", re), "redmi");
  assert.equal(B.marcaDe("Mouse generico", re), "");
});

test("Comparar: prueba la cadena y se queda con la primera consulta que encuentra algo", () => {
  const nombre = "Soundcore AeroFit 2 by Anker Auriculares";
  const solo = qs => q => qs.includes(q);
  assert.equal(B.consultaDeOferta(nombre, solo(["Soundcore AeroFit 2", "AeroFit 2"])), "Soundcore AeroFit 2");
  assert.equal(B.consultaDeOferta(nombre, solo(["AeroFit 2", "Anker AeroFit 2"])), "AeroFit 2");
  assert.equal(B.consultaDeOferta(nombre, solo(["Anker AeroFit 2"])), "Anker AeroFit 2");
  assert.equal(B.consultaDeOferta(nombre, () => false), "Soundcore AeroFit 2");          // sin resultados en ninguna: la mas precisa
});

test("Comparar: sin marca y submarca busca como antes, sin el codigo de modelo", () => {
  assert.equal(B.consultaDeOferta("Memoria Kingston Fury Beast DDR5 16GB 5600MHz", () => true), "Memoria Kingston Fury");
  assert.equal(B.consultaDeOferta("Ssd 480gb", () => true), "Ssd");
});
