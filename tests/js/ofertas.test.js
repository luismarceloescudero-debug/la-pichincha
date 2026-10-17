const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../../js/ofertas.js");
const B = require("../../js/buscador.js");

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

test("destacadas deja afuera los enlaces que no son http(s)", () => {
  const idx = { productos: [fila("js", 7000, { antes: 10000, url: "javascript:alert(1)" }),
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

// El piso es relativo al propio indice: "reciente" es la generacion mas nueva que hay a la venta o la anterior.
const REF = O.referencia([
  "Celular iPhone 17 256GB", "Celular Samsung Galaxy S26 12GB 256GB", "Celular Pixel 10 12GB 256GB",
  "Notebook Apple MacBook Air M5 16GB 512GB", "Notebook Lenovo Core i7-14700H 16GB 512GB",
  "Notebook Asus Ryzen 7 8845HS 16GB 512GB", "Celular Xiaomi Poco X8 Snapdragon 8 Gen 5 12GB 2026"].map(n => [n]));
const p = n => O.pisoDeGama(n, REF);

test("piso de gama: la RAM manda cuando el titulo la dice (celular 6 GB y 128 GB, notebook 16 GB y 512 GB)", () => {
  assert.equal(p("Celular Samsung Galaxy A06 4GB RAM 128GB").pasa, false);
  assert.match(p("Celular Samsung Galaxy A06 4GB RAM 128GB").motivo, /4 GB de RAM/);
  assert.equal(p("Celular Motorola Moto G15 6GB/128GB").pasa, true);
  assert.equal(p("Smartphone Xiaomi Redmi Note 14 8+256GB").pasa, true);
  assert.equal(p("Celular Xiaomi Redmi 14C 8GB RAM 64GB").pasa, false);
  assert.equal(p("Notebook Lenovo IdeaPad 8GB RAM 256GB SSD").pasa, false);
  assert.equal(p("Notebook Lenovo IdeaPad 16GB 512GB SSD").pasa, true);
  assert.equal(p("Notebook Asus Vivobook 32 GB de RAM 1TB").pasa, true);
  assert.equal(p("Memoria Kingston Fury DDR5 16GB").pasa, true);          // sin piso
  assert.equal(p("Auriculares Logitech 4gb").rubro, null);
});

test("piso de gama: sin RAM en el titulo decide la generacion del procesador, no se descarta de entrada", () => {
  assert.equal(p("Celular Apple iPhone 17 256GB").pasa, true);             // la mas nueva
  assert.equal(p("Celular Apple iPhone 16 128GB").pasa, true);             // la anterior
  const viejo = p("Celular Apple iPhone 14 128GB");
  assert.equal(viejo.pasa, false);
  assert.match(viejo.motivo, /iphone 14.*generaci/i);
  assert.equal(p("Notebook Apple MacBook Air M5 13 512GB").pasa, true);
  assert.equal(p("Notebook Apple MacBook Air M1 256GB").pasa, false);
  assert.equal(p("Celular Samsung Galaxy A16 128GB").pasa, false);        // ni RAM, ni procesador, ni año
  assert.match(p("Celular Samsung Galaxy A16 128GB").motivo, /sin datos/);
});

test("piso de gama: con RAM suficiente igual cuentan procesador viejo, bateria, refresco, pantalla y año", () => {
  assert.equal(p("Notebook Lenovo Core i5-8250U 16GB 512GB").pasa, false);
  assert.match(p("Notebook Lenovo Core i5-8250U 16GB 512GB").motivo, /core.*generaci/i);
  assert.equal(p("Notebook Asus Ryzen 7 8845HS 16GB 512GB").pasa, true);
  assert.equal(p("Celular Xiaomi Redmi 8GB 256GB 4000mAh").pasa, false);
  assert.match(p("Celular Xiaomi Redmi 8GB 256GB 4000mAh").motivo, /4000 mAh/);
  assert.equal(p("Celular Xiaomi Redmi 8GB 256GB 5500mAh 120Hz").pasa, true);
  assert.equal(p("Celular Xiaomi Redmi 8GB 256GB 60Hz").pasa, false);
  assert.equal(p("Notebook Lenovo 16GB 512GB 15.6 HD").pasa, false);
  assert.equal(p("Celular Moto G 8GB 256GB modelo 2023").pasa, false);
  assert.equal(p("Celular Moto G 8GB 256GB modelo 2026").pasa, true);
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

test("las compras internacionales no quedan afuera de destacadas: van despues de las locales y rotuladas", () => {
  const idx = { productos: [fila("intl", 7000, { antes: 10000, sellos: "i" }), fila("local", 8000, { antes: 10000 })] };
  const d = O.destacadas(idx);
  assert.deepEqual(d.map(o => o.f[0]), ["local", "intl"]);
  assert.deepEqual(d.map(o => !!o.internacional), [false, true]);
});

test("gama alta: varias señales juntas (RAM ideal, almacenamiento grande, ultima generacion, OLED, 120 Hz, linea Pro)", () => {
  assert.equal(p("Celular Apple iPhone 17 Pro 512GB").alta, true);
  assert.equal(p("Celular Samsung Galaxy S26 12GB 256GB").alta, true);   // RAM ideal + 256 GB + ultima generacion
  assert.equal(p("Celular Moto G15 6GB/128GB").alta, false);
  assert.equal(p("Celular Xiaomi Redmi 8GB 256GB AMOLED 120Hz").alta, true);
  assert.equal(p("Celular Xiaomi Redmi 8GB 128GB").alta, false);
});

test("cruce de gamas: la mediana de la media se compara por capacidad (128 y 256 GB por separado)", () => {
  const m128 = Array.from({ length: 8 }, (_, i) => fila(`Celular Moto G${i} 6GB/128GB`, 200000 + i * 1000));
  const m256 = Array.from({ length: 8 }, (_, i) => fila(`Celular Realme ${i} 8GB/256GB`, 400000 + i * 1000));
  const idx = { productos: [...m128, ...m256,
    fila("Celular Samsung Galaxy S26 12GB 256GB", 300000, { antes: 450000 }),   // alta de 256: bajo la mediana de 256 (400k)
    fila("Celular Pixel 10 Pro 12GB 256GB", 420000, { antes: 500000 }),         // alta de 256: sobre esa mediana, aunque bajo la mezcla
    fila("Celular Apple iPhone 17 Pro 512GB", 300000, { antes: 450000 })] };    // sin media de 512 con que compararse
  const r = O.calcularOfertas(idx);
  assert.deepEqual([...r.cruces].map(f => f[0]), ["Celular Samsung Galaxy S26 12GB 256GB"]);
  assert.equal(r.medianas["celular:128"], B.mediana(m128.map(f => f[1])));
  assert.equal(r.medianas["celular:256"], B.mediana(m256.map(f => f[1])));
  assert.equal(r.medianas["celular:512"], undefined);
  assert.equal(O.destacadas(idx).find(o => o.cruce).f[0], "Celular Samsung Galaxy S26 12GB 256GB");
});

test("cruce de gamas: con poca muestra de gama media no se afirma nada", () => {
  const idx = { productos: [fila("Celular Moto G15 6GB/128GB", 300000), fila("Celular Samsung Galaxy S26 12GB 256GB", 280000, { antes: 450000 })] };
  assert.equal(O.calcularOfertas(idx).cruces.size, 0);
});

// Salto entre generaciones, medido con los propios titulos del indice.
const titulos = n => n.map(x => [x]);
const SALTO_CHICO = O.referencia(titulos([
  "Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP", "Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP",
  "Celular Pixel 10 12GB 256GB 120Hz 4700mAh 50MP", "Celular Pixel 10 12GB 256GB 120Hz 4800mAh 50MP"]));
const SALTO_GRANDE = O.referencia(titulos([
  "Celular Galaxy S25 12GB 256GB 120Hz 4000mAh 50MP", "Celular Galaxy S25 12GB 256GB 120Hz 4000mAh 50MP",
  "Celular Galaxy S26 16GB 512GB 120Hz 4500mAh 200MP", "Celular Galaxy S26 16GB 512GB 120Hz 4500mAh 200MP"]));

test("salto entre generaciones: cuantos apartados mejoro la ultima contra la anterior", () => {
  assert.deepEqual([SALTO_GRANDE.salto["galaxy-s"].mejoras, SALTO_GRANDE.salto["galaxy-s"].comparados], [4, 5]);
  assert.equal(SALTO_CHICO.salto.pixel.mejoras, 1);          // solo la bateria, y poco
});

test("gama alta: si la ultima generacion no mejora varios apartados, la anterior sigue vigente", () => {
  const q = (n, ref) => O.pisoDeGama(n, ref);
  // salto chico: Pixel 9 y Pixel 10 compiten entre si, las dos reciben el punto de vigencia
  assert.equal(q("Celular Pixel 9 12GB 256GB", SALTO_CHICO).alta, true);
  assert.equal(q("Celular Pixel 9 12GB 256GB", SALTO_CHICO).vigente, true);
  assert.equal(q("Celular Pixel 10 12GB 256GB", SALTO_CHICO).alta, true);
  assert.equal(q("Celular Pixel 10 12GB 256GB", SALTO_CHICO).vigente, false);
  // salto grande: solo la ultima es novedad, la anterior queda atras con las mismas señales
  assert.equal(q("Celular Galaxy S26 12GB 256GB", SALTO_GRANDE).alta, true);
  assert.equal(q("Celular Galaxy S25 12GB 256GB", SALTO_GRANDE).alta, false);
});

test("cruce de gamas: una gama alta del año anterior vigente tambien cruza y queda marcada", () => {
  const media = Array.from({ length: 8 }, (_, i) => fila(`Celular Moto G${i} 6GB/256GB`, 400000 + i * 1000));
  const nuevos = ["Celular Pixel 10 12GB 256GB 120Hz 4700mAh 50MP", "Celular Pixel 10 12GB 256GB 120Hz 4800mAh 50MP"].map(n => fila(n, 700000));
  const idx = { productos: [...media, ...nuevos,
    fila("Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP", 380000, { antes: 600000 }),
    fila("Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP 2", 700000)] };
  const r = O.calcularOfertas(idx);
  assert.deepEqual([...r.cruces].map(f => f[0]), ["Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP"]);
  assert.deepEqual([...r.vigentes].map(f => f[0]), ["Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP"]);
  assert.equal(O.destacadas(idx)[0].vigente, true);
});

test("contra que mediana cruza cada oferta: rubro, capacidad, valor y cantidad de avisos", () => {
  const m256 = Array.from({ length: 8 }, (_, i) => fila(`Celular Realme ${i} 8GB/256GB`, 400000 + i * 1000));
  const idx = { productos: [...m256, fila("Celular Samsung Galaxy S26 12GB 256GB", 300000, { antes: 450000 })] };
  const [o] = O.destacadas(idx);
  assert.deepEqual(o.contra, { rubro: "celular", rom: 256, mediana: B.mediana(m256.map(f => f[1])), avisos: 8 });
  const pesos = n => "$" + n;
  assert.equal(O.textoContra(o.contra, pesos), `mediana de los celulares de gama media de 256 GB: $${o.contra.mediana} (8 avisos)`);
  assert.match(O.textoContra({ rubro: "notebook", rom: 1000, mediana: 1, avisos: 9 }, pesos), /las notebooks de gama media de 1 TB/);
});

test("cada modelo explica por que cuenta o no como gama alta este año respecto del anterior", () => {
  const q = (n, ref) => O.pisoDeGama(n, ref).nota;
  assert.match(q("Celular Pixel 10 12GB 256GB", SALTO_CHICO), /Pixel 10 mejoró solo 1 de 5 apartados contra el 9.*misma gama que el año anterior/);
  assert.match(q("Celular Pixel 9 12GB 256GB", SALTO_CHICO), /el Pixel 10 mejoró solo 1 de 5.*sigue vigente/);
  assert.match(q("Celular Galaxy S26 12GB 256GB", SALTO_GRANDE), /Galaxy S 26 mejoró 4 de 5 apartados.*novedad real/);
  assert.match(q("Celular Galaxy S25 12GB 256GB", SALTO_GRANDE), /el Galaxy S 26 mejoró 4 de 5.*ya no cuenta como gama alta/);
  assert.equal(q("Celular Moto G15 6GB/128GB", SALTO_GRANDE), "");        // sin generacion comparable
});

test("la nota viaja con las ofertas y con el feed", () => {
  const productos = [...titulos(["Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP", "Celular Pixel 9 12GB 256GB 120Hz 4700mAh 50MP",
    "Celular Pixel 10 12GB 256GB 120Hz 4700mAh 50MP", "Celular Pixel 10 12GB 256GB 120Hz 4800mAh 50MP"]).map(([n]) => fila(n, 700000)),
    fila("Celular Pixel 9 12GB 256GB 8", 500000, { antes: 700000 })];
  const [o] = O.destacadas({ productos });
  assert.match(o.nota, /sigue vigente/);
});

test("rubro: los accesorios y otros productos que nombran un celular o una notebook no son celulares", () => {
  const r = n => O.pisoDeGama(n, REF).rubro;
  for (const n of ["Funda Silicona iPhone 15 Pro Max", "Cargador rapido Samsung Galaxy S25 45W", "Vidrio templado Redmi Note 14",
    "Protector de pantalla para iPhone 17", "Case notebook Lenovo ThinkPad 16GB", "Soporte para notebook plegable",
    "Mochila para notebook 15.6", "Monitor Samsung 27 pixel perfect", "Auricular Tecnomaster 8GB"])
    assert.equal(r(n), null, n);
  assert.equal(r("Celular Tecno Spark 20 6GB 128GB"), "celular");
  assert.equal(r("Samsung Galaxy S26 12GB 256GB"), "celular");
  assert.equal(r("Google Pixel 10 Pro 16GB 256GB"), "celular");
});

test("los accesorios de un celular no entran a la mediana de la gama media ni a los descartados", () => {
  const fundas = Array.from({ length: 8 }, (_, i) => fila(`Funda iPhone 17 Pro 512GB ${i}`, 5000 + i));
  const idx = { productos: [...fundas, fila("Celular Apple iPhone 17 Pro 512GB", 900000, { antes: 1100000 })] };
  const r = O.calcularOfertas(idx);
  assert.equal(r.descartadas, 0);
  assert.deepEqual(r.medianas, {});
});
