const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../../js/categorias.js");
const O = require("../../js/ofertas.js");

// fila: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]
const fila = (nombre, precio, { lista = 0, antes = 0, sellos = "" } = {}) =>
  [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), "cg", "", lista, antes, "", sellos, ""];

const REF = C.referencia([
  "Celular iPhone 17 256GB", "Celular Samsung Galaxy S26 12GB 256GB", "Notebook Apple MacBook Air M5 16GB 512GB",
  "Notebook Lenovo Core i7-14700H 16GB 512GB", "Notebook Asus Ryzen 7 9955HX 16GB 512GB",
  "Procesador AMD Ryzen 9 9950X"].map(n => [n]));
const ev = n => C.evaluar(n, REF);

test("categoria: las seis obligatorias se reconocen por el titulo", () => {
  const cat = n => C.categoriaDe(n);
  assert.equal(cat("Monitor Gamer Samsung Odyssey 27 240Hz"), "monitor");
  assert.equal(cat("Pc Gamer Ryzen 5 16GB 512GB Rtx 4060"), "pc");
  assert.equal(cat("Computadora Intel Core i5 16GB"), "pc");
  assert.equal(cat("Notebook Lenovo IdeaPad 16GB 512GB"), "notebook");
  assert.equal(cat("Macbook Air M5"), "notebook");
  assert.equal(cat("Celular Motorola Moto G15 6GB/128GB"), "smartphone");
  assert.equal(cat("Samsung Galaxy S26 12GB 256GB"), "smartphone");
  assert.equal(cat("Apple iPhone 17 Pro 512GB"), "smartphone");
  assert.equal(cat("Memoria Kingston Fury DDR5 16GB"), "componente");
  assert.equal(cat("Placa de video Gigabyte RTX 4060 8GB"), "componente");
  assert.equal(cat("Fuente Corsair 750W Gold"), "componente");
  assert.equal(cat("Ssd Kingston NV3 1TB Nvme"), "componente");
  assert.equal(cat("Mouse Logitech G502"), "periferico");
  assert.equal(cat("Auricular Xiaomi Redmi Buds 6"), "periferico");   // nombra un celular pero es un periferico
  assert.equal(cat("Teclado Redragon Kumara"), "periferico");
  assert.equal(cat("VGA 16GB RTX 5070 TI ASUS TUF GAMING OC 16G GDDR7"), "componente");
  assert.equal(cat("Memoria RAM Notebook SODIMM Hiksemi DDR5 16GB 4800MHz"), "componente");   // nombra una notebook pero es una memoria
  assert.equal(cat("FAN Cooler GIGABYTE Aorus 3X ARGB"), "componente");
  assert.equal(cat("COMBO AMD 9600X B650 16GB 5600 COOLER DISIPADOR"), "componente");
  assert.equal(cat("Combo Logitech Teclado + Mouse MK270 Wireless"), "periferico");
  assert.equal(cat("Smart Tv Samsung 55"), "otro");
});

test("categoria: lo que se vende para un celular, una notebook o un monitor no es ese equipo", () => {
  for (const n of ["Funda Silicona iPhone 15 Pro Max", "Cargador rapido Samsung Galaxy S25 45W", "Vidrio templado Redmi Note 14",
    "Soporte para notebook plegable", "Mochila para notebook 15.6", "Brazo soporte para monitor doble", "Case notebook Lenovo ThinkPad 16GB"]) {
    const c = C.categoriaDe(n);
    assert.ok(!["smartphone", "notebook", "monitor"].includes(c), n + " => " + c);
  }
  assert.equal(C.categoriaDe("Google Pixel 10 Pro 16GB 256GB"), "smartphone");
  assert.equal(C.categoriaDe("Celular Tecno Spark 20 6GB 128GB"), "smartphone");
  assert.equal(C.categoriaDe("Auricular Tecnomaster 8GB"), "periferico");
});

test("monitor: gama alta = 240 Hz o mas con OLED, QD-OLED o Mini-LED; media = 144 a 239 Hz con IPS o VA", () => {
  assert.equal(ev("Monitor Alienware 27 QD-OLED 360Hz").nivel, "alta");
  assert.equal(ev("Monitor Samsung Odyssey OLED G6 27 240Hz").nivel, "alta");
  assert.equal(ev("Monitor MSI 32 Mini-LED 4K 240Hz").nivel, "alta");
  assert.equal(ev("Monitor LG 27 IPS 180Hz").nivel, "media");
  assert.equal(ev("Monitor AOC 24 VA 144Hz").nivel, "media");
  assert.equal(ev("Monitor Gigabyte 27 Fast IPS 240Hz").nivel, "media");        // 240 Hz pero sin panel premium
  assert.match(ev("Monitor Gigabyte 27 Fast IPS 240Hz").nota, /OLED, QD-OLED o Mini-LED/);
  assert.equal(ev("Monitor Samsung 27 OLED 165Hz").nivel, "media");             // panel premium pero menos de 240 Hz
});

test("monitor: minimos 144 Hz, panel que no sea TN y 24 pulgadas", () => {
  assert.equal(ev("Monitor Samsung 24 IPS 75Hz").pasa, false);
  assert.match(ev("Monitor Samsung 24 IPS 75Hz").motivo, /75 Hz \(mínimo 144\)/);
  assert.equal(ev("Monitor Viewsonic 24 TN 165Hz").pasa, false);
  assert.match(ev("Monitor Viewsonic 24 TN 165Hz").motivo, /TN/);
  assert.equal(ev("Monitor Philips 22 IPS 165Hz").pasa, false);
  assert.equal(ev("Monitor Samsung 27 sin dato").pasa, false);
  assert.match(ev("Monitor Samsung 27 sin dato").motivo, /sin dato de tasa de refresco/);
  assert.equal(ev("Monitor LG 27 IPS 165Hz").pasa, true);
});

test("smartphone: chip, camara y años de actualizaciones cuentan para gama alta, con minimos propios", () => {
  assert.equal(ev("Celular Xiaomi 15T 12GB 256GB Snapdragon 8 Gen 3 200MP").alta, true);        // RAM, ROM, chip, camara
  assert.equal(ev("Celular Samsung Galaxy S26 12GB 256GB 7 años de actualizaciones").alta, true);
  assert.equal(ev("Celular Moto G15 6GB/128GB").alta, false);
  assert.equal(ev("Celular Motorola Edge 6GB/128GB Unisoc").pasa, false);
  assert.match(ev("Celular Motorola Edge 6GB/128GB Unisoc").motivo, /chip de entrada/);
  assert.equal(ev("Celular Samsung A16 6GB/128GB 2 años de actualizaciones").pasa, false);
  assert.match(ev("Celular Samsung A16 6GB/128GB 2 años de actualizaciones").motivo, /actualizaciones/);
  assert.equal(ev("Celular Samsung A36 8GB/128GB Snapdragon 6 Gen 1").pasa, false);
});

test("notebook y pc: CPU, GPU, RAM y pantalla; alta = 3 señales o mas", () => {
  assert.equal(ev("Notebook Asus ROG Core i7-14700H 32GB 1TB RTX 4070 OLED").alta, true);
  assert.equal(ev("Notebook Lenovo IdeaPad Core i5-13420H 16GB 512GB RTX 3050").alta, false);
  assert.equal(ev("Notebook Lenovo IdeaPad Core i5-13420H 16GB 512GB RTX 3050").pasa, true);
  assert.equal(ev("Notebook HP Core i7-14700H 16GB 512GB 15.6 HD").pasa, false);
  assert.equal(ev("Pc Gamer Core i7-14700 32GB 1TB RTX 4070").alta, true);
  assert.equal(ev("Pc Gamer Core i5-14400 16GB 512GB RTX 4060").alta, false);
  assert.equal(ev("Pc Oficina Core i5-14400 8GB 256GB").pasa, false);
  assert.match(ev("Pc Oficina Core i5-14400 8GB 256GB").motivo, /8 GB de RAM \(mínimo 16\)/);
});

test("la generacion de Ryzen avanza de a dos (7000, 9000): la anterior sigue vigente", () => {
  assert.equal(ev("Pc Gamer Ryzen 5 7600 16GB 512GB").pasa, true);
  assert.equal(ev("Pc Gamer Ryzen 5 5600G 16GB 512GB").pasa, false);
  assert.equal(ev("Pc Gamer Core i5-13400 16GB 512GB").pasa, true);
  assert.equal(ev("Pc Gamer Core i5-12400 16GB 512GB").pasa, false);   // Intel avanza de a uno
});

test("componentes: cada requisito aplica solo a su tipo (la VRAM es de las placas de video, no de otras categorias)", () => {
  assert.equal(ev("Placa de video Gigabyte RTX 4050 6GB").pasa, false);
  assert.match(ev("Placa de video Gigabyte RTX 4050 6GB").motivo, /6 GB de VRAM \(mínimo 8\)/);
  assert.equal(ev("Placa de video Gigabyte RTX 5070 Ti 16GB").nivel, "alta");
  assert.equal(ev("Placa de video Gigabyte RTX 4060 8GB").nivel, "media");
  // 4 GB en otra categoria no se lee como VRAM
  assert.equal(ev("Memoria Kingston Fury DDR4 16GB 3200MHz").pasa, true);
  assert.equal(ev("Monitor LG 27 IPS 165Hz 4GB").pasa, true);
  assert.equal(ev("Celular Moto G15 6GB/128GB 4GB virtual").pasa, true);
  assert.equal(ev("Mouse Logitech G502 8GB").pasa, true);
  // memoria, ssd, fuente
  assert.equal(ev("Memoria Kingston Fury DDR4 8GB").pasa, false);
  assert.equal(ev("Memoria Corsair Vengeance DDR5 2x16GB 6000MHz").nivel, "alta");
  assert.equal(ev("Memoria Kingston DDR3 16GB").pasa, false);
  assert.equal(ev("Ssd Kingston A400 240GB").pasa, false);
  assert.equal(ev("Ssd WD Black SN850X 1TB Nvme PCIe Gen4").nivel, "alta");
  assert.equal(ev("Fuente Corsair 450W").pasa, false);
  assert.equal(ev("Fuente Corsair 850W 80 Plus Gold").nivel, "alta");
  assert.equal(ev("Procesador AMD Ryzen 5 5600").pasa, true);          // sin piso de generacion en componentes
  assert.equal(ev("Mouse Logitech G502").pasa, true);                  // los perifericos no tienen minimos
});

test("descuento minimo por categoria: 10% en equipos, mas exigente en componentes", () => {
  assert.equal(C.DESCUENTO.smartphone.publicada, 0.10);
  assert.equal(C.DESCUENTO.notebook.publicada, 0.10);
  assert.equal(C.DESCUENTO.pc.publicada, 0.10);
  assert.ok(C.DESCUENTO.componente.publicada >= 0.20);
  const idx = { productos: [
    fila("Notebook Lenovo Core i7-14700H 16GB 512GB", 1000000, { lista: 1120000 }),    // 10,7%: oferta de notebook
    fila("Placa de video Gigabyte RTX 4060 8GB", 500000, { lista: 560000 }),           // 10,7%: poco para un componente
    fila("Placa de video Gigabyte RTX 4070 12GB", 700000, { lista: 900000 })] };       // 22%
  const r = O.calcularOfertas(idx);
  assert.deepEqual(r.publicadas.map(f => f[0]).sort(), ["Notebook Lenovo Core i7-14700H 16GB 512GB", "Placa de video Gigabyte RTX 4070 12GB"]);
});

test("cupo en el resumen: cada categoria tiene lugar reservado y los componentes no lo acaparan", () => {
  const comp = Array.from({ length: 15 }, (_, i) => fila(`Memoria Kingston Fury DDR5 32GB v${i}`, 100000 + i, { lista: 200000 }));   // 50% off
  const otros = [
    fila("Celular Samsung Galaxy S26 12GB 256GB", 1000000, { lista: 1200000 }),
    fila("Celular Motorola Edge 8GB/256GB", 500000, { lista: 600000 }),
    fila("Celular Motorola Edge 50 8GB/256GB", 520000, { lista: 600000 }),
    fila("Notebook Lenovo Core i7-14700H 16GB 512GB", 1000000, { lista: 1200000 }),
    fila("Notebook Asus Core i7-14700H 16GB 512GB", 1010000, { lista: 1200000 }),
    fila("Notebook HP Core i7-14700H 16GB 512GB", 1020000, { lista: 1200000 }),
    fila("Monitor Samsung Odyssey OLED 27 240Hz", 800000, { lista: 1000000 }),
    fila("Pc Gamer Core i7-14700 32GB 1TB RTX 4070", 2000000, { lista: 2400000 }),
    fila("Mouse Logitech G502", 50000, { lista: 100000 })];
  const idx = { productos: [...comp, ...otros] };
  const d = O.destacadas(idx, 10);
  const por = {};
  d.forEach(o => { por[o.categoria] = (por[o.categoria] || 0) + 1; });
  assert.equal(d.length, 10);
  for (const c of ["smartphone", "notebook", "monitor", "pc", "periferico"]) assert.ok(por[c] >= 1, c);
  assert.ok(por.componente <= 3, JSON.stringify(por));
  assert.ok(por.smartphone >= 2, JSON.stringify(por));
  // salen agrupados por categoria, en el orden fijo
  const orden = d.map(o => o.categoria);
  assert.deepEqual(orden, [...orden].sort((a, b) => C.ORDEN.indexOf(a) - C.ORDEN.indexOf(b)));
});

test("cupo: si una categoria no tiene ofertas, su lugar lo ocupan las demas", () => {
  const comp = Array.from({ length: 12 }, (_, i) => fila(`Memoria Kingston Fury DDR5 32GB v${i}`, 100000 + i, { lista: 200000 }));
  const d = O.destacadas({ productos: comp }, 10);
  assert.equal(d.length, 10);
});

test("dentro de una categoria, la gama alta va antes que la media a igual señal", () => {
  const idx = { productos: [
    fila("Monitor LG 27 IPS 165Hz", 300000, { lista: 450000 }),                 // media, 33%
    fila("Monitor Samsung Odyssey OLED 27 240Hz", 800000, { lista: 1000000 })] };   // alta, 20%
  assert.deepEqual(O.destacadas(idx).map(o => o.nivel), ["alta", "media"]);
});

test("el mismo producto en varias tiendas (mismo codigo de modelo) ocupa un solo lugar del resumen", () => {
  const mismo = (n, p, tienda) => { const f = fila(n, p, { lista: 200000 }); f[3] = tienda; f[9] = "RTX3060-12G"; return f; };
  const idx = { productos: [
    mismo("Placa de Video MSI GeForce RTX 3060 Ventus 2X 12GB", 100000, "scp"),
    mismo("Placa de Video MSI GeForce RTX 3060 12GB VENTUS 2X", 120000, "mt"),
    fila("Placa de Video Gigabyte RTX 4060 8GB", 150000, { lista: 200000 })] };
  const d = O.destacadas(idx, 10);
  assert.equal(d.length, 2);
  assert.equal(d.filter(o => o.f[9] === "RTX3060-12G").length, 1);
  assert.equal(d.find(o => o.f[9] === "RTX3060-12G").f[1], 100000);          // la mejor ubicada: la de mayor descuento
});
