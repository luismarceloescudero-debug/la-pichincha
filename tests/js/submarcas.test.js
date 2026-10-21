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

test("Comparar: una oferta sin submarca conserva las especificaciones que la hacen comparable", () => {
  assert.equal(B.consultaDeOferta("Monitor Gamer Samsung Odyssey G3 G30D 27\" FHD VA 180Hz", () => true), "monitor 27 fhd 180hz");
  assert.equal(B.consultaDeOferta("Memoria Kingston Fury Beast DDR5 16GB 5600MHz", () => true), "memoria ddr5 16gb 5600mhz");
  assert.equal(B.consultaDeOferta("Ssd 480gb", () => true), "ssd 480gb");
});

test("Comparar: si faltan coincidencias, relaja primero la especificacion menos importante", () => {
  const nombre = "Monitor Gamer Samsung Odyssey G3 G30D 27\" FHD VA 180Hz";
  const solo = qs => q => qs.includes(q);
  assert.equal(B.consultaDeOferta(nombre, solo(["monitor 27 fhd"])), "monitor 27 fhd");
});

test("Comparar: una placa de video conserva el chip y la memoria", () => {
  const c = n => B.consultaDeOferta(n, () => true);
  assert.equal(c("Placa de Video ASUS Dual GeForce RTX 3060 12GB GDDR6 OC V2"), "rtx 3060 12gb");
  assert.equal(c("PLACA DE VIDEO RADEON RX 9070 XT 16GB SAPPHIRE PULSE"), "rx 9070 xt 16gb");
  assert.equal(c("Placa De Video Msi Gaming Rtx 5060 Ti 16gb Gddr7"), "rtx 5060 ti 16gb");
  const solo = qs => q => qs.includes(q);
  assert.equal(B.consultaDeOferta("Placa de Video ASUS Dual GeForce RTX 3060 12GB GDDR6 OC V2", solo(["rtx 3060"])), "rtx 3060");
  // sin ningun resultado, no pierde el chip
  assert.equal(B.consultaDeOferta("Placa de Video ASUS Dual GeForce RTX 3060 12GB GDDR6 OC V2", () => false), "rtx 3060 12gb");
});

test("Comparar: un procesador conserva la familia y el modelo", () => {
  const c = n => B.consultaDeOferta(n, () => true);
  assert.equal(c("Procesador AMD Ryzen 7 9850X3D 5.6GHz Turbo AM5"), "ryzen 7 9850x3d");
  assert.equal(c("Procesador Intel Core I7-14700Kf 14Va Gen S1700"), "i7 14700kf");
  assert.equal(c("Procesador Intel Core Ultra 9 285K"), "core ultra 9 285k");
  const solo = qs => q => qs.includes(q);
  assert.equal(B.consultaDeOferta("Procesador AMD Ryzen 7 9850X3D 5.6GHz Turbo AM5", solo(["ryzen 7"])), "ryzen 7");
});

test("Comparar: un notebook conserva la gama del procesador, la RAM y el almacenamiento", () => {
  const c = n => B.consultaDeOferta(n, () => true);
  assert.equal(c("Notebook Gamer Lenovo LOQ Essential 15ARP11 15.6\" AMD Ryzen 7 170 32GB DDR5 SSD 512GB RTX 5050 8GB"), "notebook ryzen 7 32gb 512gb");
  assert.equal(c("Notebook Hp Probook 450 G5 Core I5 (7ma) 256gb 8gb (Reacondicionado)"), "notebook i5 8gb 256gb");
  const solo = qs => q => qs.includes(q);
  assert.equal(B.consultaDeOferta("Notebook Hp Probook 450 G5 Core I5 (7ma) 256gb 8gb (Reacondicionado)", solo(["notebook i5 8gb"])), "notebook i5 8gb");
});

test("buscar: normaliza resoluciones equivalentes", () => {
  const n = t => B.normalBusq(t);
  assert.equal(B.filtroDe("monitor 27 fhd")(n("Monitor 27 pulgadas Full HD")), true);
  assert.equal(B.filtroDe("monitor 27 fhd")(n("Monitor 27\" 1080p")), true);
  assert.equal(B.filtroDe("monitor 27 4k")(n("Monitor 27 pulgadas UHD")), true);
  assert.equal(B.filtroDe("monitor 27 qhd")(n("Monitor 27\" 1440p")), true);
});
