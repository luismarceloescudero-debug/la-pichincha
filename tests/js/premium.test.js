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

const GAN = { ganadores: [
  { modelo: "Samsung Galaxy S25 Ultra", alias: ["galaxy s25 ultra"], categoria: "smartphone", puntaje: 99.4, fuente: { nombre: "DXOMARK, ranking de smartphones", url: "https://www.dxomark.com/smartphones/" }, confianza: "confirmado" },
  { modelo: "GeForce RTX 5080", alias: ["rtx 5080"], fuente: { nombre: "PassMark G3D Mark, ranking" }, confianza: "confirmado" },
  { modelo: "GeForce RTX 5070 Ti", alias: ["rtx 5070 ti"], fuente: { nombre: "PassMark G3D Mark" }, confianza: "confirmado" },
  { modelo: "Apple MacBook Air 13 (M5, 2026)", alias: ["macbook air 13"], fuente: { nombre: "RTINGS, laptops" }, confianza: "confirmado" },
  { modelo: "Sony WH-1000XM6", alias: ["wh-1000xm6"], fuente: { nombre: "RTINGS, headphones" }, confianza: "confirmado" },
  { modelo: "Modelo sin confirmar X900", alias: ["x900"], fuente: { nombre: "Otra" }, confianza: "sin confirmar" },
] };

test("ganadores en pruebas: un modelo de datos/ganadores.json suma, dice la fuente corta y sin archivo no pasa nada", () => {
  const n = "Celular Samsung Galaxy S25 Ultra 12GB 256GB";
  const con = P.puntaje(n, REF, C.evaluar(n, REF), GAN), sin = P.puntaje(n, REF, C.evaluar(n, REF));
  assert.equal(con.puntos - sin.puntos, P.PUNTOS_GANADOR);
  assert.equal(con.ganador.texto, "ganador en pruebas: DXOMARK");
  assert.equal(sin.ganador, null);
  assert.equal(P.ganadorDe(n, null), null);
  assert.ok(P.ganadorDe(n, GAN.ganadores), "tambien acepta la lista sola");
});

test("ganadores: palabras enteras, sin variantes ni chips distintos, solo lo confirmado", () => {
  const g = t => P.ganadorDe(t, GAN);
  assert.ok(g("Placa de Video Gigabyte GeForce RTX 5080 Windforce OC 16G"));
  assert.equal(g("Placa de Video MSI RTX 5080 SUPER 16G"), null, "la SUPER no es la 5080");
  assert.equal(g("Placa de Video MSI RTX 5080 Ti 16G"), null);
  assert.ok(g("Placa de Video Asus RTX 5070 Ti Prime 16G"));
  assert.equal(g("Notebook Apple MacBook Air 13 M4 16GB 512GB"), null, "el ganador es el de M5");
  assert.ok(g("Notebook Apple MacBook Air 13 M5 16GB 512GB"));
  assert.equal(g("Notebook X x900 Pro"), null, "lo «sin confirmar» no cuenta");
  assert.equal(g("Funda para Galaxy S25 Ultra5"), null);
});

test("ganadores: un periferico sin puntaje (auriculares) que gano pruebas es premium por si solo", () => {
  const r = P.puntaje("Auriculares Sony WH-1000XM6 Bluetooth Negro", REF, C.evaluar("Auriculares Sony WH-1000XM6", REF), GAN);
  assert.deepEqual([r.premium, r.puntos, r.ganador.fuente], [true, P.PUNTOS_GANADOR, "RTINGS"]);
  assert.equal(P.puntaje("Auriculares Sony WH-CH520", REF, C.evaluar("Auriculares Sony WH-CH520", REF), GAN).premium, false);
});

test("ganadores: el archivo real de datos/ganadores.json se lee y reconoce a su primer ganador", () => {
  const real = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "../../datos/ganadores.json"), "utf8"));
  assert.ok(real.ganadores.length >= 13);
  assert.ok(P.ganadorDe("Placa de Video Gigabyte GeForce RTX 5090 Aorus 32G", real));
});
