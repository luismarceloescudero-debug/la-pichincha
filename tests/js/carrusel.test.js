const test = require("node:test");
const assert = require("node:assert/strict");
const Car = require("../../js/carrusel.js");

const pesos = n => "$" + Math.round(n).toLocaleString("es-AR").replace(/,/g, ".");
const almacen = () => { const d = {}; return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, d }; };

test("gesto: deslizar a los costados, arriba y abajo, con umbral", () => {
  assert.equal(Car.gesto({ dx: -120, dy: 10, ms: 200 }), "izq");
  assert.equal(Car.gesto({ dx: 120, dy: -10, ms: 200 }), "der");
  assert.equal(Car.gesto({ dx: 5, dy: -150, ms: 200 }), "arriba");
  assert.equal(Car.gesto({ dx: 0, dy: 150, ms: 200 }), "abajo");
  assert.equal(Car.gesto({ dx: -30, dy: 20, ms: 200 }), "toque", "un movimiento corto no es un deslizamiento");
  assert.equal(Car.gesto({ dx: -80, dy: -75, ms: 200 }), "izq", "gana el eje con mas recorrido");
});

test("gesto: mantener apretado solo si el dedo no se movio", () => {
  assert.equal(Car.gesto({ dx: 2, dy: 3, ms: 700 }), "mantener");
  assert.equal(Car.gesto({ dx: 2, dy: 3, ms: 200 }), "toque");
  assert.equal(Car.gesto({ dx: 90, dy: 3, ms: 900 }), "der", "moverse cancela el mantener");
  assert.equal(Car.gesto(), "toque");
});

test("mover: no da la vuelta, la primera y la ultima son bordes", () => {
  assert.equal(Car.mover(0, "der", 3), 0);
  assert.equal(Car.mover(0, "izq", 3), 1);
  assert.equal(Car.mover(2, "izq", 3), 2);
  assert.equal(Car.mover(1, "ArrowLeft", 3), 0);
  assert.equal(Car.mover(1, "ArrowRight", 3), 2);
  assert.equal(Car.mover(0, "izq", 0), 0, "sin tarjetas no se rompe");
  assert.equal(Car.indiceDe(820, 410), 2);
  assert.equal(Car.indiceDe(10, 0), 0);
});

test("diferencia contra la primera opcion", () => {
  assert.equal(Car.diferencia(2284999, 2162861, "A", pesos), "+$122.138 que la A");
  assert.equal(Car.diferencia(1899000, 2162861, "A", pesos), "−$263.861 que la A");
  assert.equal(Car.diferencia(100, 100, "A", pesos), "igual que la A");
  assert.equal(Car.diferencia(100, 0, "A", pesos), "");
});

test("seguidos: se siguen y se dejan de seguir, y quedan guardados", () => {
  const a = almacen();
  const item = { id: "https://t.test/a", nombre: "Notebook A", tienda: "OnCity", precio: 2162861, url: "https://t.test/a" };
  assert.deepEqual(Car.leerSeguidos(a), []);
  let r = Car.alternarSeguido(item, a);
  assert.equal(r.siguiendo, true);
  assert.equal(Car.sigue(item.id, a), true);
  assert.equal(JSON.parse(a.d[Car.CLAVE])[0].precio, 2162861);
  r = Car.alternarSeguido({ id: "https://t.test/b", nombre: "B", precio: 1 }, a);
  assert.deepEqual(r.lista.map(x => x.id), ["https://t.test/b", "https://t.test/a"], "el ultimo seguido va primero");
  r = Car.alternarSeguido(item, a);
  assert.equal(r.siguiendo, false);
  assert.deepEqual(Car.leerSeguidos(a).map(x => x.id), ["https://t.test/b"]);
});

test("seguidos: un almacen roto o con basura no rompe la app", () => {
  const roto = { getItem() { throw new Error("modo privado"); }, setItem() { throw new Error("cuota"); } };
  assert.doesNotThrow(() => Car.alternarSeguido({ id: "x", nombre: "X", precio: 1 }, roto));
  const basura = almacen(); basura.setItem(Car.CLAVE, "{no es json");
  assert.deepEqual(Car.leerSeguidos(basura), []);
  basura.setItem(Car.CLAVE, JSON.stringify([{ id: 5 }, null, { id: "ok", nombre: "ok" }]));
  assert.deepEqual(Car.leerSeguidos(basura).map(x => x.id), ["ok"]);
});

test("esMovil: sin matchMedia (Node, navegadores viejos) es falso", () => {
  assert.equal(Car.esMovil(), false);
});
