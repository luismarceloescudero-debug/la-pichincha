const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../../js/ofertas.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, { lista = 0, antes = 0, sellos = "", url } = {}) =>
  [nombre, precio, url || "https://t.test/" + encodeURIComponent(nombre), "cg", "", lista, antes, "", sellos, ""];

test("una baja propia de al menos 3% y mil pesos es oferta propia", () => {
  const idx = { productos: [fila("A", 9000, { antes: 10000 }), fila("B", 9900, { antes: 10000 }),
                            fila("C", 99500, { antes: 100000 }), fila("D", 50000)] };
  const { propias, publicadas } = O.calcularOfertas(idx);
  assert.deepEqual(propias.map(f => f[0]), ["A"]);          // B baja 1%, C baja 0,5%: no
  assert.deepEqual(publicadas, []);
});

test("una rebaja publicada va entre 15% y 60% y desde 15.000 pesos; una propia no se repite como publicada", () => {
  const idx = { productos: [fila("X", 20000, { lista: 30000 }), fila("Y", 20000, { lista: 21000 }),
                            fila("Z", 10000, { lista: 20000 }), fila("W", 20000, { lista: 100000 }),
                            fila("V", 20000, { lista: 30000, antes: 25000 })] };
  const { propias, publicadas } = O.calcularOfertas(idx);
  assert.deepEqual(publicadas.map(f => f[0]), ["X"]);       // Y poco, Z bajo el piso, W sospechosa
  assert.deepEqual(propias.map(f => f[0]), ["V"]);
});

test("destacadas: primero las bajas propias, despues las publicadas, cada grupo por descuento", () => {
  const idx = { productos: [fila("pub-20", 24000, { lista: 30000 }), fila("pub-40", 18000, { lista: 30000 }),
                            fila("prop-10", 9000, { antes: 10000 }), fila("prop-30", 7000, { antes: 10000 })] };
  assert.deepEqual(O.destacadas(idx).map(o => o.f[0]), ["prop-30", "prop-10", "pub-40", "pub-20"]);
  assert.deepEqual(O.destacadas(idx).map(o => o.tipo), ["propia", "propia", "publicada", "publicada"]);
  assert.equal(O.destacadas(idx, 2).length, 2);
});

test("destacadas deja afuera compras internacionales y enlaces que no son http(s)", () => {
  const idx = { productos: [fila("intl", 7000, { antes: 10000, sellos: "i" }),
                            fila("js", 7000, { antes: 10000, url: "javascript:alert(1)" }),
                            fila("ok", 8000, { antes: 10000 })] };
  assert.deepEqual(O.destacadas(idx).map(o => o.f[0]), ["ok"]);
});

test("lo usado o de caja abierta no es oferta: ni en la lista ni en las destacadas", () => {
  const idx = { productos: [
    fila("Smart Tv Samsung 85 Qled Qn800d (Nuevo con caja abierta)", 5999000, { lista: 8999000 }),
    fila("Notebook Samsung Galaxy Book 3 512gb-caja Abierta", 1400000, { antes: 2000000 }),
    fila("Playstation 5 Slim 1tb", 900000, { lista: 1300000, sellos: "eu" }),       // la fuente dice que es usada
    fila("Iphone 14 Reacondicionado", 700000, { antes: 900000 }),
    fila("Smart Tv Samsung 85 Qled Qn800d", 6999000, { lista: 9999000 })] };
  const { propias, publicadas } = O.calcularOfertas(idx);
  assert.deepEqual(publicadas.map(f => f[0]), ["Smart Tv Samsung 85 Qled Qn800d"]);
  assert.deepEqual(propias, []);
  assert.deepEqual(O.destacadas(idx).map(o => o.f[0]), ["Smart Tv Samsung 85 Qled Qn800d"]);
});

test("destacadas trae el descuento y el ahorro de cada una", () => {
  const [o] = O.destacadas({ productos: [fila("A", 7500, { antes: 10000 })] });
  assert.equal(Math.round(o.off * 100), 25);
  assert.equal(o.ahorro, 2500);
  assert.equal(o.ref, 6);
});

test("el mismo aviso que llega directo y por ComparaYa cuenta una sola vez, y gana la fila directa", () => {
  const url = "https://t.test/monitor-acer";
  const directa = fila("Monitor Acer", 216200, { antes: 292817, url });
  const viaComparaya = ["Monitor Acer", 216200, url, "comparaya", "CompraGamer", 240222, 292817, "", "", ""];
  for (const productos of [[directa, viaComparaya], [viaComparaya, directa]]) {
    const { propias } = O.calcularOfertas({ productos });
    assert.equal(propias.length, 1);
    assert.equal(propias[0][3], "cg");                       // la de la tienda, no la del agregador
    assert.equal(O.destacadas({ productos }).length, 1);
  }
});

test("piso de gama: un celular necesita 6 GB de RAM y 128 GB, una notebook 16 GB y 512 GB", () => {
  const p = n => O.pisoDeGama(n);
  assert.equal(p("Celular Samsung Galaxy A06 4GB RAM 128GB").pasa, false);
  assert.match(p("Celular Samsung Galaxy A06 4GB RAM 128GB").motivo, /4 GB de RAM/);
  assert.equal(p("Celular Motorola Moto G15 6GB/128GB").pasa, true);
  assert.equal(p("Smartphone Xiaomi Redmi Note 14 8+256GB").pasa, true);
  assert.equal(p("Celular Xiaomi Redmi 14C 8GB RAM 64GB").pasa, false);          // poca memoria interna
  assert.equal(p("Notebook Lenovo IdeaPad 8GB RAM 256GB SSD").pasa, false);
  assert.equal(p("Notebook Lenovo IdeaPad 16GB 512GB SSD").pasa, true);
  assert.equal(p("Notebook Asus Vivobook 32 GB de RAM 1TB").pasa, true);
});

test("piso de gama: sin RAM en el titulo no se destaca; lo que no tiene piso pasa", () => {
  assert.equal(O.pisoDeGama("Celular Samsung Galaxy A16 128GB").pasa, false);
  assert.match(O.pisoDeGama("Celular Samsung Galaxy A16 128GB").motivo, /sin RAM/);
  assert.equal(O.pisoDeGama("Memoria Kingston Fury DDR5 16GB").pasa, true);       // no es celular ni notebook
  assert.equal(O.pisoDeGama("Auriculares Logitech 4gb").rubro, null);
});

test("lo que no llega al piso de gama no es oferta y se cuenta aparte", () => {
  const idx = { productos: [fila("Celular Samsung Galaxy A06 4GB RAM 128GB", 100000, { lista: 150000 }),
                            fila("Celular Moto G15 6GB/128GB", 100000, { lista: 150000 }),
                            fila("Notebook HP 8GB RAM 256GB", 500000, { antes: 700000 })] };
  const r = O.calcularOfertas(idx);
  assert.deepEqual(r.publicadas.map(f => f[0]), ["Celular Moto G15 6GB/128GB"]);
  assert.deepEqual(r.propias, []);
  assert.equal(r.descartadas, 2);
  assert.deepEqual(O.destacadas(idx).map(o => o.f[0]), ["Celular Moto G15 6GB/128GB"]);
});
