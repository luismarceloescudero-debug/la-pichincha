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

test("destacadas trae el descuento y el ahorro de cada una", () => {
  const [o] = O.destacadas({ productos: [fila("A", 7500, { antes: 10000 })] });
  assert.equal(Math.round(o.off * 100), 25);
  assert.equal(o.ahorro, 2500);
  assert.equal(o.ref, 6);
});
