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
  assert.equal(o.antes, 10000);
});

test("el mismo aviso que llega directo y por ComparaYa cuenta una sola vez, y gana la fila directa", () => {
  const url = "https://t.test/parlante-acer";
  const directa = fila("Smart Tv Acer", 216200, { antes: 292817, url });
  const viaComparaya = ["Smart Tv Acer", 216200, url, "comparaya", "CompraGamer", 240222, 292817, "", "", ""];
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
  assert.equal(p("Auriculares Logitech 4gb").categoria, "periferico");
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
  assert.equal(r.medianas["smartphone:128"], B.mediana(m128.map(f => f[1])));
  assert.equal(r.medianas["smartphone:256"], B.mediana(m256.map(f => f[1])));
  assert.equal(r.medianas["smartphone:512"], undefined);
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
  assert.deepEqual(o.contra, { rubro: "smartphone", rom: 256, mediana: B.mediana(m256.map(f => f[1])), avisos: 8 });
  const pesos = n => "$" + n;
  assert.equal(O.textoContra(o.contra, pesos), `mediana de los smartphones de gama media de 256 GB: $${o.contra.mediana} (8 avisos)`);
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

test("categoria: los accesorios y otros productos que nombran un celular o una notebook no son celulares ni notebooks", () => {
  const r = n => O.pisoDeGama(n, REF).categoria;
  for (const n of ["Funda Silicona iPhone 15 Pro Max", "Cargador rapido Samsung Galaxy S25 45W", "Vidrio templado Redmi Note 14",
    "Protector de pantalla para iPhone 17", "Case notebook Lenovo ThinkPad 16GB", "Soporte para notebook plegable",
    "Mochila para notebook 15.6", "Auricular Tecnomaster 8GB"])
    assert.equal(r(n), "periferico", n);
  assert.equal(r("Celular Tecno Spark 20 6GB 128GB"), "smartphone");
  assert.equal(r("Samsung Galaxy S26 12GB 256GB"), "smartphone");
  assert.equal(r("Google Pixel 10 Pro 16GB 256GB"), "smartphone");
});

test("los accesorios de un celular no entran a la mediana de la gama media ni a los descartados", () => {
  const fundas = Array.from({ length: 8 }, (_, i) => fila(`Funda iPhone 17 Pro 512GB ${i}`, 5000 + i));
  const idx = { productos: [...fundas, fila("Celular Apple iPhone 17 Pro 512GB", 900000, { antes: 1100000 })] };
  const r = O.calcularOfertas(idx);
  assert.equal(r.descartadas, 0);
  assert.deepEqual(r.medianas, {});
});

// 19/10, indice publicado: la MSI RTX 5080 Gaming Trio salia como oferta a $4.268.709 (tachado mas alto) mientras
// Maxtecno vendia el mismo modelo a $3.679.312 sin descuento. Con el mismo modelo mas barato en otra tienda local,
// no es una oferta.
const conModelo = (nombre, precio, tienda, modelo, extra = {}) => {
  const f = fila(nombre + " " + tienda, precio, extra); f[3] = tienda; f[9] = modelo; return f;
};

test("una oferta con el mismo modelo mas barato en otra tienda local no es oferta", () => {
  const idx = { productos: [
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 4268709, "comparaya", "RTX5080-GTRIO", { lista: 5600000 }),
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 3679312, "maxtecno", "RTX5080-GTRIO")] };
  const r = O.calcularOfertas(idx);
  assert.deepEqual([...r.propias, ...r.publicadas], []);
  assert.equal(r.masBarato.get(idx.productos[0])[1], 3679312);     // contra que se descarto
});

test("si es el precio mas bajo del modelo (o casi igual) sigue siendo oferta", () => {
  const idx = { productos: [
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 3679312, "maxtecno", "M1", { lista: 4800000 }),
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 3700000, "venex", "M1"),
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 3660000, "mexx", "M1")] };   // 0,5% menos: redondeo
  assert.deepEqual(O.calcularOfertas(idx).publicadas.map(f => f[3]), ["maxtecno"]);
});

test("un precio internacional mas bajo no le quita la oferta a una local (paga impuestos al llegar)", () => {
  const idx = { productos: [
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 3679312, "maxtecno", "M1", { lista: 4800000 }),
    conModelo("Placa de video MSI RTX 5080 Gaming Trio 16GB", 2500000, "comparaya", "M1", { sellos: "i" })] };
  assert.deepEqual(O.calcularOfertas(idx).publicadas.map(f => f[3]), ["maxtecno"]);
});

test("sin codigo de modelo no se compara por parecido", () => {
  const idx = { productos: [fila("Placa de video MSI RTX 5080 16GB A", 4268709, { lista: 5600000 }),
                            fila("Placa de video MSI RTX 5080 16GB B", 3679312)] };
  assert.equal(O.calcularOfertas(idx).publicadas.length, 1);
});

test("un precio mas bajo que llega por el agregador no le quita la oferta a una tienda directa (puede ser viejo)", () => {
  const idx = { productos: [
    conModelo("Notebook Asus Zenbook 14 OLED 16GB 1TB", 2999999, "venex", "UX3405", { lista: 3900000 }),
    conModelo("Notebook Asus Zenbook 14 OLED 16GB 1TB", 2383703, "comparaya", "UX3405")] };
  assert.deepEqual(O.calcularOfertas(idx).publicadas.map(f => f[3]), ["venex"]);
});

test("en equipos solo compara la misma configuracion: el codigo de familia junta i5 e i7, 8 y 16 GB", () => {
  // 19/10: "15IRH10" (la familia IdeaPad Slim 3) agrupaba configuraciones distintas; la i7 16GB de Mercado Libre
  // no es mas cara que la i5 8GB de GoldenTech: son otro producto.
  const idx = { productos: [
    conModelo("Notebook Lenovo Ideapad Slim 3 15IRH10 Intel Core i7-13620H 16GB RAM DDR5 512GB SSD", 1900899, "comparaya", "15IRH10", { lista: 2600000 }),
    conModelo("Notebook Lenovo IP Slim 3 15IRH10 INTEL i5-13420H 8GB 4800MHZ DDR5 512GB NVME", 1464575, "goldentech", "15IRH10")] };
  assert.equal(O.calcularOfertas(idx).masBarato.size, 0);
  // la misma configuracion si se compara
  const igual = { productos: [
    conModelo("Notebook Lenovo Ideapad Slim 3 15IRH10 Intel Core i7-13620H 16GB RAM DDR5 512GB SSD", 2600000, "comparaya", "15IRH10", { lista: 3400000 }),
    conModelo("Notebook Lenovo IP Slim 3 15IRH10 INTEL I7-13620H 16GB 4800MHZ 512GB NVME W11H", 2337228, "goldentech", "15IRH10")] };
  assert.equal(O.calcularOfertas(igual).masBarato.size, 1);
});

// 19/10, resumen publicado: la impresora Brother con 55% y los auriculares Philips con 54% tenian el mismo precio desde el
// 8/10 y el 7/10. Un tachado que no se mueve en una semana es el precio de siempre con un tachado de adorno.
test("una rebaja publicada cuyo precio no cambio en 7 dias o mas no es oferta", () => {
  const conDesde = (nombre, precio, lista, desde) => { const f = fila(nombre, precio, { lista }); f[10] = desde; return f; };
  const idx = { generado: "2026-10-19T09:13-03:00", productos: [
    conDesde("Impresora Brother HL-L2320D", 330000, 729679, "2026-10-08"),       // 11 dias igual: no
    conDesde("Monitor Gamer Level Up 24 IPS 144Hz", 215999, 399999, "2026-10-16"), // cambio hace 3 dias: si
    conDesde("Auriculares Philips TAA1105", 18499, 39999, "2026-10-12")] };     // justo 7 dias: no
  const r = O.calcularOfertas(idx);
  assert.deepEqual(r.publicadas.map(f => f[0]), ["Monitor Gamer Level Up 24 IPS 144Hz"]);
  assert.equal(r.tachadoFijo, 2);
});

test("tachadoFijo cuenta solo lo que habria sido oferta: un tachado de 2% o de 90% con precio viejo no suma", () => {
  const conDesde = (nombre, precio, lista, desde) => { const f = fila(nombre, precio, { lista }); f[10] = desde; return f; };
  const idx = { generado: "2026-10-19T09:13-03:00", productos: [
    conDesde("Mouse Logitech G203 Lightsync", 98000, 100000, "2026-10-01"),      // 2%: nunca fue oferta
    conDesde("Mouse Logitech G502 Hero", 100000, 1000000, "2026-10-01"),          // 90%: pasa el tope de descuento
    conDesde("Impresora Brother HL-L2320D", 330000, 729679, "2026-10-08")] };     // 55% viejo: este si
  const r = O.calcularOfertas(idx);
  assert.equal(r.publicadas.length, 0);
  assert.equal(r.tachadoFijo, 1);
});

test("una baja propia no se descarta por la fecha: la medimos nosotros", () => {
  const f = fila("Fuente Thermaltake 850W 80 Plus Gold", 155000, { antes: 266000 }); f[10] = "2026-10-01";
  assert.equal(O.calcularOfertas({ generado: "2026-10-19T09:13-03:00", productos: [f] }).propias.length, 1);
});

test("el mismo procesador escrito distinto es la misma configuracion (R5-7535HS y Ryzen 5 7535HS)", () => {
  const idx = { productos: [
    conModelo("Notebook Acer Nitro V15 Ryzen 5 7535HS 16GB 512GB RTX 4050", 1500000, "venex", "ANV15", { lista: 2100000 }),
    conModelo("Notebook Acer Nitro V15 R5-7535HS 16GB 512GB RTX 4050", 1300000, "maxtecno", "ANV15")] };
  assert.equal(O.calcularOfertas(idx).masBarato.size, 1);
});

// ---- costo puesto en casa de lo internacional (spec 012) ----
const fs = require("fs");
const path = require("path");
const M = require("../../js/monedas.js");
const leerFx = n => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "monedas", n), "utf8"));
const COSTO = { reglas: JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "importacion.json"), "utf8")),
  tasas: M.normalizar({ dolarapi: leerFx("dolarapi-dolares.json"), erapi: leerFx("erapi-usd.json"), frankfurter: leerFx("frankfurter-usd.json") }) };
const SSD = "SSD Kingston NV3 1TB M.2 NVMe";
const par = (nombre, precio, modelo, o) => { const f = fila(nombre, precio, o); f[9] = modelo; return f; };

test("destacadas: una oferta internacional trae su costo puesto en casa y la comparacion con el equivalente local", () => {
  const idx = { productos: [
    par(SSD, 306000, "SNV3S-1000G", { lista: 450000, sellos: "ie" }),
    par(SSD, 400000, "SNV3S-1000G", { url: "https://venex.test/ssd" }),
  ].map((f, i) => { if (i) f[3] = "venex"; return f; }) };
  const [o] = O.destacadas(idx, 20, { costo: COSTO }).filter(x => x.internacional);
  assert.equal(o.puesto.est.ok, true);
  assert.equal(o.puesto.est.maxPesos, 370260);
  assert.equal(o.puesto.contra.localPesos, 400000);
  assert.equal(o.puesto.tienda, "venex");
  assert.match(o.puesto.texto, /estimación/);
  assert.match(o.puesto.comparacion, /Venex|venex/i);
});

test("destacadas: sin equivalente local solo trae el costo; las locales no traen nada", () => {
  const idx = { productos: [fila(SSD + " imp", 306000, { lista: 450000, sellos: "ie" }),
                            fila("SSD WD Black SN770 1TB NVMe", 70000, { lista: 100000 })] };
  const d = O.destacadas(idx, 20, { costo: COSTO });
  const intl = d.find(x => x.internacional), loc = d.find(x => !x.internacional);
  assert.equal(intl.puesto.contra, null);
  assert.equal(loc.puesto, undefined);
});

test("destacadas: sin reglas ni cotizaciones no cambia nada (el feed sigue como antes)", () => {
  const idx = { productos: [fila(SSD, 306000, { lista: 450000, sellos: "ie" })] };
  for (const opts of [undefined, {}, { costo: null }]) assert.equal(O.destacadas(idx, 20, opts)[0].puesto, undefined);
});

test("el equivalente local es el mas barato de las tiendas directas con la misma configuracion; el agregador no cuenta", () => {
  const d = (n, p, tienda, modelo = "ABC123") => { const f = par("Notebook Lenovo " + n + " Ryzen 5 7535HS 16GB 512GB", p, modelo); f[3] = tienda; return f; };
  const intl = d("i", 1000000, "comparaya"); intl[8] = "ie";
  const idx = { productos: [intl, d("a", 1500000, "venex"), d("b", 1400000, "maximus"), d("c", 1200000, "comparaya")] };
  assert.equal(O.calcularOfertas(idx).equivalente.get(intl)[3], "maximus");
  const soloAgregador = { productos: [intl, d("c", 1200000, "comparaya")] };   // su precio puede ser viejo: no se compara contra el
  assert.equal(O.calcularOfertas(soloAgregador).equivalente.has(intl), false);
});

test("el equivalente local no mezcla configuraciones de un mismo codigo de familia", () => {
  const intl = par("Notebook Lenovo IdeaPad Ryzen 5 7535HS 16GB 512GB", 1000000, "FAM1", { sellos: "ie" });
  const otra = par("Notebook Lenovo IdeaPad Ryzen 5 7535HS 8GB 512GB", 900000, "FAM1"); otra[3] = "venex";
  assert.equal(O.calcularOfertas({ productos: [intl, otra] }).equivalente.has(intl), false);
});

/* --- Spec 014: oferta contra el mismo modelo en otras tiendas y cruce por generacion --- */

test("anterior: la generacion que ya no es la ultima, solo si ningun apartado del titulo es de la ultima", () => {
  const ref = O.referencia(titulos(["Celular Galaxy S26 12GB 256GB", "Celular Galaxy S25 12GB 256GB"]));
  assert.equal(O.pisoDeGama("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED", ref).anterior, true);
  assert.equal(O.pisoDeGama("Celular Samsung Galaxy S26 Ultra 12GB 512GB 120Hz OLED", ref).anterior, false);
  assert.equal(O.pisoDeGama("Celular Moto G15 6GB/128GB", ref).anterior, false, "sin generacion no hay anterior");
  // un modelo de la serie 2025 cuando lo vigente es 2026
  const ref2 = O.referencia(titulos(["Notebook Lenovo Yoga 16GB 1TB OLED 2026", "Notebook Lenovo Yoga 16GB 1TB OLED 2025"]));
  assert.equal(O.pisoDeGama("Notebook Lenovo Yoga 16GB 1TB OLED 2025", ref2).anterior, true);
  assert.equal(O.pisoDeGama("Notebook Lenovo Yoga 16GB 1TB OLED 2026", ref2).anterior, false);
});

const conTienda = (nombre, precio, tienda, modelo, extra = {}) => {
  const f = fila(nombre, precio, extra);
  f[2] = "https://" + tienda + ".test/" + encodeURIComponent(nombre + precio); f[3] = tienda; f[9] = modelo;
  return f;
};
const TRES = (precios, nombre = "Memoria Kingston Fury DDR5 32GB 6000MHz") =>
  precios.map(([t, p]) => conTienda(nombre, p, t, "KF560C36-32"));

test("contra el mismo modelo: «X% bajo la mediana de las otras N tiendas» con el modelo en 3 tiendas o mas", () => {
  const idx = { productos: TRES([["cg", 80000], ["mx", 100000], ["vx", 104000]]) };
  const r = O.calcularOfertas(idx);
  const c = r.contraModelo.get(idx.productos[0]);
  assert.deepEqual([c.tiendas, c.mediana, c.minimo], [2, 102000, 100000]);
  assert.ok(Math.abs(c.off - (1 - 80000 / 102000)) < 1e-9);
  assert.equal(r.contraModelo.size, 1, "las otras dos no estan bajo la mediana de las demas");
  assert.match(O.textoContraModelo(c, n => "$" + n), /22% bajo la mediana de las otras 2 tiendas/);
});

test("contra el mismo modelo: con dos tiendas no se afirma nada, ni con una baja menor al minimo de la categoria", () => {
  assert.equal(O.calcularOfertas({ productos: TRES([["cg", 80000], ["mx", 100000]]) }).contraModelo.size, 0);
  assert.equal(O.calcularOfertas({ productos: TRES([["cg", 97000], ["mx", 100000], ["vx", 101000]]) }).contraModelo.size, 0, "3% en un componente: menos del 8%");
});

test("contra el mismo modelo: una diferencia de mas del 40% o tiendas que no coinciden entre si es un dato dudoso, no una oferta", () => {
  assert.equal(O.calcularOfertas({ productos: TRES([["cg", 50000], ["mx", 100000], ["vx", 104000]]) }).contraModelo.size, 0, "52% bajo: mas facil un error que una oferta");
  assert.equal(O.calcularOfertas({ productos: TRES([["cg", 70000], ["mx", 90000], ["vx", 140000]]) }).contraModelo.size, 0, "las otras dos difieren 56% entre si");
});

test("contra el mismo modelo: no cuentan el agregador, lo internacional ni lo usado, y en equipos solo la misma configuracion", () => {
  const ajenas = [conTienda("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, "comparaya", "KF560C36-32"),
    conTienda("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, "cg", "KF560C36-32", { sellos: "i" }),
    conTienda("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, "mx", "KF560C36-32", { sellos: "u" })];
  const mia = conTienda("Memoria Kingston Fury DDR5 32GB 6000MHz", 80000, "vx", "KF560C36-32");
  assert.equal(O.calcularOfertas({ productos: [mia, ...ajenas] }).contraModelo.size, 0);
  const nb = (ram, p, t) => conTienda(`Notebook Lenovo IdeaPad Core i5-13420H ${ram}GB 512GB`, p, t, "15IRH10");
  const r = O.calcularOfertas({ productos: [nb(8, 500000, "cg"), nb(16, 900000, "mx"), nb(16, 950000, "vx"), nb(16, 960000, "gc")] });
  assert.deepEqual([...r.contraModelo.keys()].map(f => f[3]), ["mx"], "el de 16 GB mas barato; el de 8 GB no se compara con los de 16");
});

test("contra el mismo modelo: solo el mas barato (o casi) del modelo, y no si otra tienda lo tiene mas barato", () => {
  const idx = { productos: TRES([["cg", 80000], ["mx", 81000], ["vx", 100000], ["gc", 102000]]) };
  const r = O.calcularOfertas(idx);
  assert.deepEqual([...r.contraModelo.keys()].map(f => f[3]).sort(), ["cg", "mx"]);
  const mas = O.calcularOfertas({ productos: TRES([["cg", 80000], ["mx", 70000], ["vx", 100000], ["gc", 102000]]) });
  assert.deepEqual([...mas.contraModelo.keys()].map(f => f[3]), ["mx"], "cg no es oferta: mx lo tiene mas barato");
});

test("contra el mismo modelo: un celular que no llega al minimo de su gama no es oferta aunque este bajo el resto", () => {
  const c = (p, t) => conTienda("Celular Moto G05 4GB 64GB", p, t, "XT2547");
  assert.equal(O.calcularOfertas({ productos: [c(100000, "cg"), c(150000, "mx"), c(152000, "vx")] }).contraModelo.size, 0);
});

test("cruce por generacion: gama alta del año pasado a precio de media de hoy, solo con muestra de la media actual", () => {
  const media = Array.from({ length: 8 }, (_, i) => fila(`Celular Realme ${i} 8GB 512GB`, 700000 + i * 1000));
  const anterior = fila("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED", 690000);
  const actual = fila("Celular Samsung Galaxy S26 Ultra 16GB 1TB 144Hz OLED 200MP", 1500000);   // mejora la RAM, el almacenamiento y los Hz
  const caro = fila("Celular Samsung Galaxy S25 12GB 512GB 120Hz OLED", 900000);
  const idx = { productos: [...media, anterior, actual, caro] };
  const r = O.calcularOfertas(idx);
  assert.deepEqual([...r.cruceGen.keys()].map(f => f[0]), [anterior[0]]);
  const x = r.cruceGen.get(anterior);
  assert.deepEqual([x.rubro, x.rom, x.mediana, x.avisos], ["smartphone", 512, B.mediana(media.map(f => f[1])), 8]);
  assert.match(O.textoCruceGen(x, n => "$" + n), /gama alta del año pasado al precio de una media de hoy/);
  assert.equal(O.calcularOfertas({ productos: [...media.slice(0, 5), anterior, actual] }).cruceGen.size, 0, "con 5 avisos de media no hay mediana");
});

test("cruce por generacion: la media de la generacion anterior no es la media de hoy", () => {
  const mediaVieja = Array.from({ length: 8 }, (_, i) => fila(`Celular Samsung Galaxy S25 FE ${i} 8GB 512GB`, 600000 + i * 1000));
  const referencia = [fila("Celular Samsung Galaxy S26 Ultra 16GB 1TB 144Hz OLED 200MP", 1500000)];
  const anterior = fila("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED", 700000);
  assert.equal(O.calcularOfertas({ productos: [...mediaVieja, ...referencia, anterior] }).cruceGen.size, 0,
    "la media de la generacion anterior no es la media de hoy");
});

// ---- Una oferta por modelo y familia (23/10): Mexx publica la misma Lenovo V15 con y sin Windows 11 Pro y las dos salieron
// en las ofertas del dia, con el nombre recortado en la imagen se veian identicas. Fixture: el indice publicado ese dia. ----
const LENOVO = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "ofertas", "lenovo-v15-2026-10-23.json"), "utf8"));
const lenovo = id => LENOVO.productos.find(f => f[2].includes("/" + id + "-"));

test("familia: el mismo equipo con o sin sistema operativo, color o «#» es la misma familia; otra RAM no", () => {
  assert.equal(O.familia(lenovo(50758)), O.familia(lenovo(50761)));
  assert.notEqual(O.familia(lenovo(50758)), O.familia(lenovo(50757)));        // 32GB contra 16GB
  for (const [a, b] of [["Notebook HP 15 i5 16GB 512GB Negro", "Notebook HP 15 i5 16GB 512GB Silver"],
                        ["Notebook HP 15 i5 16GB 512GB FreeDOS", "Notebook HP 15 i5 16GB 512GB Windows 11 Home"],
                        ["Notebook HP 15 i5 16GB 512GB W11 Pro", "Notebook HP 15 i5 16GB 512GB #"],
                        ["Notebook HP 15 i5 16GB 512GB Sin Sistema Operativo", "Notebook HP 15 i5 16 GB 512 GB"]])
    assert.equal(O.familia([a]), O.familia([b]), `${a} / ${b}`);
  assert.notEqual(O.familia(["Notebook HP 15 i5 16GB 512GB"]), O.familia(["Notebook HP 15 i7 16GB 512GB"]));
});

test("familia: con codigo de modelo manda el codigo", () => {
  const f = [...lenovo(50758)]; f[9] = "83CC0123AR";
  const g = [...lenovo(50737)]; g[9] = "83CC0123AR";
  assert.equal(O.familia(f), O.familia(g));
});

test("destacadas: la misma Lenovo con y sin Windows ocupa un solo lugar, el de la mejor oferta", () => {
  const nombres = O.destacadas(LENOVO, 10).map(o => o.f[2]);
  assert.equal(nombres.filter(u => /\/5075[8]-|\/50761-/.test(u)).length, 1);
  assert.ok(nombres.some(u => u.includes("/50758-")), "queda la de mayor descuento (16,3% contra 15,9%)");
});

test("destacadas: el mismo nombre en dos tiendas, sin codigo, tambien ocupa un solo lugar", () => {
  const a = fila("SSD Kingston NV3 1TB NVMe Gen4 Negro", 90000, { antes: 120000 });
  const b = fila("SSD Kingston NV3 1TB NVMe Gen4", 95000, { antes: 120000 }); b[3] = "otra";
  const lista = O.destacadas({ productos: [a, b] }, 10);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].f, a);
});

test("una familia ocupa un solo lugar aunque caiga en dos categorias (revision del 24/10)", () => {
  const f = (n, p, antes, cod) => [n, p, "https://t.test/" + encodeURIComponent(n), "mexx", "", 0, antes, "", "", cod, "", null, null, 0];
  const idx = { productos: [f("Mouse Gamer Logitech G502 X Hero", 50000, 60000, "910-006136"),
    f("Logitech 910-006136 G502 X", 51000, 62000, "910-006136"), f("Teclado Redragon K552", 30000, 36000, "")] };
  const d = O.destacadas(idx);
  assert.notEqual(new Set(d.map(o => o.categoria)).size, 1, "el caso de verdad cruza categorias");
  assert.equal(d.filter(o => o.f[9] === "910-006136").length, 1);
});

test("el ofertas.json deja de repetir un producto de catalogo de Mercado Libre con dos textos de direccion (24/10)", () => {
  // una baja propia (el tachado de Mercado Libre ya no cuenta, spec 035)
  const ml = (slug, n) => [n, 729999, `https://www.mercadolibre.com.ar/${slug}/p/MLA79317178`, "comparaya", "Mercado Libre", 0, 829999, "", "", "", "", null, null, 0];
  const idx = { productos: [ml("monitor-gamer-asrock-phantom-gaming-de-315-2k-qhd-ips-180hz-1ms", "Monitor Gamer ASRock Phantom Gaming de 31.5\" 2K QHD IPS 180Hz 1ms"),
    ml("monitor-gamer-asrock-phantom-gaming-pg32qft2a-315", "Monitor Gamer ASRock Phantom Gaming PG32QFT2A 31.5\" 2K QHD IPS 180Hz 1ms HDMI DP")] };
  assert.equal(O.destacadas(idx).length, 1);
});

test("el tachado de un agregador o de Mercado Libre no es una oferta; el de una tienda directa si (spec 035)", () => {
  const f = (n, url, tienda) => [n, 600000, url, tienda, tienda === "comparaya" ? "Fravega" : "", 1300000, 0, "", "", "", "", null, null, 0];
  const idx = { productos: [f("Monitor Gamer ASRock Phantom 31.5 QHD 180Hz", "https://www.mercadolibre.com.ar/x/p/MLA1", "mercadolibre"),
    f("Monitor MSI Pro 24 IPS 144Hz", "https://www.fravega.com/p/monitor-msi-1/", "comparaya"),
    f("Monitor LG 27 IPS 180Hz", "https://www.gamingcity.com.ar/monitor-lg-27", "gamingcity")] };
  assert.deepEqual(O.calcularOfertas(idx).publicadas.map(x => x[3]), ["gamingcity"]);
});

test("destacadas suma el mismo modelo mas barato que en otras tiendas, con la mediana como referencia (spec 035)", () => {
  const f = (tienda, precio) => ["Procesador AMD Ryzen 5 7600X 100-100000593WOF", precio, `https://${tienda}.test/r5-7600x`, tienda, "", 0, 0, "", "", "100-100000593WOF", "", null, null, 0];
  const idx = { productos: [f("venex", 270000), f("mexx", 310000), f("maximus", 315000), f("compragamer", 320000)] };
  const [o] = O.destacadas(idx);
  assert.equal(o.tipo, "modelo");
  assert.equal(o.f[3], "venex");
  assert.equal(o.antes, 315000);
  assert.equal(o.modelo.tiendas, 3);
  assert.equal(Math.round(o.off * 100), 14);
});
