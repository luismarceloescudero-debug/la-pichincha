const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../../js/categorias.js");
const P = require("../../js/premium.js");

// Titulos reales del indice del 20/10/2026. La referencia fija cual es la ultima generacion a la venta.
const REF = C.referencia([
  "Celular Samsung Galaxy S26 12GB 256GB", "Celular Samsung Galaxy S25 12GB 256GB", "Celular iPhone 17 256GB",
  "Notebook Msi KATANA 15 i7-14650HX 24GB 2TB RTX 5070", "Notebook Lenovo i7-13620H 16GB 512GB",
  "Notebook Apple MacBook Air M5 16GB 512GB"].map(n => [n]));
const pt = n => P.puntaje(n, REF, C.evaluar(n, REF));

test("premium: sale de la tecnologia y la construccion del titulo, no de la marca", () => {
  const top = pt("Celular Xiaomi Poco F8 Pro Dual Sim 256 Gb Titanio Plata 12 Gb Ram 6.59'' Amoled Snapdragon 8 Gen 3 6210 Mah 100W");
  assert.equal(top.premium, true);
  assert.ok(top.senales.some(s => /procesador de punta/.test(s)) && top.senales.some(s => /OLED/.test(s)) && top.senales.some(s => /materiales/.test(s)));
  // una marca "de primera linea" sin tecnologia que lo respalde no es premium
  assert.equal(pt("Celular Samsung Galaxy A06 4GB 128GB").premium, false);
  assert.equal(pt("Notebook Lenovo IdeaPad Slim 3 Core i5-1235U 16GB 512GB").premium, false);
  // y una marca desconocida con tecnologia de punta si
  assert.equal(pt("Notebook Gamer Generica Core Ultra 9 275HX 2TB SSD 64GB RTX 5090 OLED 240Hz").premium, true);
});

test("premium: la memoria sola no alcanza, por mas RAM y almacenamiento que traiga", () => {
  const poco = pt("Xiaomi POCO X7 5G 512GB 12GB RAM 6.67 Pulgadas Black");
  assert.equal(poco.premium, false);
  assert.ok(poco.puntos <= P.TOPE_MEMORIA);
  assert.equal(pt("Celular Samsung Galaxy S26 5G 12 Gb 512 Gb Nfc Dual Sim Negro").premium, true, "con la ultima generacion si");
});

test("premium: lo que no llega al minimo de su gama no es premium aunque sume señales", () => {
  const n = "Notebook Gamer Core Ultra 9 275HX 8GB 256GB RTX 5090 OLED 240Hz";
  assert.equal(C.evaluar(n, REF).pasa, false);
  assert.equal(pt(n).premium, false);
});

test("premium: monitores por panel, resolucion y refresco; componentes por su gama alta", () => {
  assert.equal(pt("Monitor Gamer Samsung Odyssey OLED G8 32 QD-OLED 4K UHD 240Hz HDR True Black").premium, true);
  assert.equal(pt("Monitor LG 24 IPS 144Hz").premium, false);
  assert.equal(pt("Placa De Video Gigabyte GeForce RTX 5080 Windforce OC 16g Gddr7").premium, true);
  assert.equal(pt("Placa de video Asus GeForce RTX 3050 6GB").premium, false);
  assert.equal(pt("Procesador AMD Ryzen 9 9950X").premium, true);
  assert.equal(pt("Fuente Corsair 750W 80 Plus Gold").premium, true);
});

test("premium: perifericos y otros no tienen puntaje y no entran", () => {
  for (const n of ["Auriculares Logitech G733 Lightspeed", "Mouse Razer DeathAdder V3 Pro", "Smart Tv Samsung 55 OLED 4K"]) {
    const r = pt(n);
    assert.deepEqual([r.premium, r.puntos, r.umbral], [false, 0, 0], n);
  }
});

test("premium: selectivo (los umbrales salen de medir el indice y ninguna categoria supera ~25%)", () => {
  assert.deepEqual(P.UMBRAL, { smartphone: 3, notebook: 4, pc: 4, monitor: 3, componente: 3 });
  const idx = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "../fixtures/indice-muestra.json"), "utf8"));
  const ref = C.referencia(idx.productos), n = {}, p = {};
  for (const f of idx.productos) { const g = C.evaluar(f[0], ref); n[g.categoria] = (n[g.categoria] || 0) + 1; if (P.puntaje(f[0], ref, g).premium) p[g.categoria] = (p[g.categoria] || 0) + 1; }
  for (const c of Object.keys(p)) assert.ok(p[c] / n[c] <= 0.25, `${c}: ${p[c]} de ${n[c]}`);
});

test("ganadores en pruebas: un modelo de datos/ganadores.json suma y dice la fuente; sin archivo no pasa nada", () => {
  const ganadores = { ganadores: [{ modelo: "Galaxy S25 Ultra", fuente: "DXOMARK", categoria: "smartphone" }] };
  const n = "Celular Samsung Galaxy S25 Ultra 12GB 256GB";
  const con = P.puntaje(n, REF, C.evaluar(n, REF), ganadores), sin = P.puntaje(n, REF, C.evaluar(n, REF));
  assert.equal(con.puntos - sin.puntos, P.PUNTOS_GANADOR);
  assert.match(con.ganador.texto, /ganador en pruebas: DXOMARK/);
  assert.equal(sin.ganador, null);
  assert.equal(P.ganadorDe(n, null), null);
  assert.equal(P.ganadorDe(n, [{ modelo: "S2", fuente: "x" }]), null, "un modelo demasiado corto no coincide por casualidad");
  assert.ok(P.ganadorDe(n, [{ modelo: "galaxy s25 ultra" }]));
});
