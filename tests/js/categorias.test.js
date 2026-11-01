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

test("un modelo no queda afuera porque una tienda no escribe el dato: lo hereda del mismo producto publicado por otra", () => {
  const con = (n, p, modelo, tienda) => { const f = fila(n, p, { lista: p * 1.3 }); f[3] = tienda; f[9] = modelo; return f; };
  const idx = { productos: [
    con("Monitor Samsung LS25BG400ELXZB", 300000, "LS25BG400ELXZB", "cy"),                         // sin Hz en el titulo
    con("Monitor Samsung 25 LS25BG400ELXZB IPS 240Hz", 303000, "LS25BG400ELXZB", "mx"),            // otra tienda si los trae
    fila("Monitor Samsung LS24BG300ELXZB", 250000, { lista: 330000 })] };                          // este no tiene de donde sacarlo
  const r = O.calcularOfertas(idx);
  assert.deepEqual(r.publicadas.map(f => f[0]).sort(), ["Monitor Samsung 25 LS25BG400ELXZB IPS 240Hz", "Monitor Samsung LS25BG400ELXZB"]);
  assert.equal(r.descartadas, 1);
});

test("y si la otra tienda dice que no llega al minimo, tampoco llega: es el mismo producto", () => {
  const con = (n, p, tienda) => { const f = fila(n, p, { lista: p * 1.3 }); f[3] = tienda; f[9] = "LS24BG300ELXZB"; return f; };
  const idx = { productos: [con("Monitor Samsung LS24BG300ELXZB", 200000, "cy"), con("Monitor Samsung LS24BG300ELXZB 75Hz IPS", 210000, "mx")] };
  assert.equal(O.calcularOfertas(idx).publicadas.length, 0);
});

// Titulos reales del indice del 18/10 que quedaban "sin datos" aunque dicen la RAM y el procesador.
test("memoriaDe lee capacidades pegadas a letras, con G sola y con barra sin unidad", () => {
  assert.deepEqual(C.memoriaDe("Notebook HP 15.6 R5-7535HS 8GB SSD512GB Victus RTX3050 W11H"), { ram: 8, rom: 512 });
  assert.deepEqual(C.memoriaDe("Notebook LENOVO 15.3 IDEA P I5-13420H 8G 512G TOUCH W11H"), { ram: 8, rom: 512 });
  assert.deepEqual(C.memoriaDe("Notebook HP PB 445G11 14\" R5 7535U 16GB/512 Win11P"), { ram: 16, rom: 512 });
  assert.deepEqual(C.memoriaDe("NOTEBOOK HP 14 840 I5-1335U 16GB SSD512G W11PRO"), { ram: 16, rom: 512 });
  assert.deepEqual(C.memoriaDe("Notebook CX 15.6 INTEL I5 1235U+8G+SSD256G"), { ram: 8, rom: 256 });
  assert.deepEqual(C.memoriaDe("Celular Motorola Moto G06 128/4gb + Auricular De Regalo"), { ram: 4, rom: 128 });
  assert.deepEqual(C.memoriaDe("Xiaomi Redmi Note 15 Pro Plus 512/8+ Auricular"), { ram: 8, rom: 512 });
  // la G de un procesador no es una capacidad
  assert.deepEqual(C.memoriaDe("Pc Armada Gamer Amd Ryzen 5 8600G 16Gb Ram 500Gb Ssd"), { ram: 16, rom: 500 });
  assert.deepEqual(C.memoriaDe("PC PERFORMANCE AMD ATHLON 3000G+8G+SSD240"), { ram: 8, rom: 0 });
  assert.deepEqual(C.memoriaDe("Notebook LENOVO 16 TBOOK R5-7535HS 8G SSD512 GTIA 1PS"), { ram: 8, rom: 0 });
  // lo que ya andaba sigue igual
  assert.deepEqual(C.memoriaDe("Celular Moto G17 4+128GB Evening Blue Motorola"), { ram: 4, rom: 128 });
  assert.deepEqual(C.memoriaDe("Celular Samsung Galaxy S26 12GB 256GB"), { ram: 12, rom: 256 });
});

test("el procesador se reconoce aunque la tienda lo abrevie (I5-1335U, R5-7535HS, INTEL I5 1235U)", () => {
  const gen = n => C.generacionesDe(n).map(g => g.fam + ":" + g.gen).join(",");
  assert.equal(gen("NOTEBOOK HP 14 840 I5-1335U 16GB SSD512G W11PRO"), "intel-core:13");
  assert.equal(gen("Notebook CX 15.6 INTEL I5 1235U+8G+SSD256G"), "intel-core:12");
  assert.equal(gen("Notebook HP 15.6 R5-7535HS 8GB SSD512GB Victus RTX3050 W11H"), "ryzen:7");
  assert.equal(gen("Portátil Lenovo Ideapad Gaming 3 15.6 R5 6600h, Rtx 3050..."), "ryzen:6");
  assert.equal(gen("Notebook Lenovo Core i7-14700H 16GB 512GB"), "intel-core:14");
  // un modelo de placa o de RAM no es un procesador
  assert.equal(gen("Notebook HP PB 445G11 14\" 16GB/512"), "");
  assert.equal(gen("Memoria RAM R5 DDR5 16GB"), "");
});

test("una notebook con RAM y procesador abreviados ya no queda 'sin datos'", () => {
  const g = ev("NOTEBOOK HP 14 840 I5-1335U 16GB SSD512G W11PRO");
  assert.notEqual(g.motivo, "sin datos de RAM, procesador ni año en el título");
  assert.equal(ev("Notebook LENOVO 15.3 IDEA P I5-13420H 8G 512G TOUCH W11H").motivo, "solo 8 GB de RAM (mínimo 16)");
});

test("el motivo de una generacion de Ryzen vieja nombra la serie, no el modelo", () => {
  assert.equal(ev("PC Armada AMD Ryzen 7 5700 16GB 512GB").motivo, "Ryzen serie 5000: la generación vigente es la 9000");
});

test("memoriaDe: la memoria de la placa de video y el numero del procesador no son la RAM (indice del 19/10)", () => {
  assert.deepEqual(C.memoriaDe('Notebook Gamer Lenovo Legion 5 15AKP10 15.1" AMD Ryzen AI 7 350 24GB DDR5 SSD 1TB RTX 5070 8GB Free DOS'),
                   { ram: 24, rom: 1000 });
  assert.deepEqual(C.memoriaDe('Notebook 15.6" Hp 15-FC0235LA AMD Ryzen 3/512GB Azul'), { ram: 0, rom: 512 });
  assert.deepEqual(C.memoriaDe("Notebook Hp 15-Fc0235la R3-7320u Amd 15\"8/512gb"), { ram: 8, rom: 512 });
});

test("MIN: los minimos de gama media estan en un solo lugar y son los del dueño (smartphone: 6-8 GB de RAM y 128-256 GB)", () => {
  const s = C.MIN.smartphone;
  assert.deepEqual([s.ramMin, s.ram, s.rom, s.romAlta, s.bateria, s.hz], [6, 8, 128, 256, 4500, 90]);
  assert.deepEqual([C.MIN.notebook.ram, C.MIN.notebook.rom, C.MIN.pc.ram, C.MIN.pc.rom], [16, 512, 16, 512]);
  assert.deepEqual([C.MIN.monitor.hz, C.MIN.monitor.pulgadas], [144, 24]);
  // un celular con 6 GB y 128 GB pasa; con 4 GB o 64 GB no
  assert.equal(ev("Celular Moto G15 6GB/128GB").pasa, true);
  assert.equal(ev("Celular Moto G05 4GB/128GB").pasa, false);
  assert.equal(ev("Celular Moto G15 6GB/64GB").pasa, false);
});

/* Spec 056: en Ofertas del 31/10 habia tabletas lavavajilla, una desmalezadora, una cuna y un destornillador, y hardware
   que caia en «Otros» (una motherboard, watercoolings, una notebook escrita «Portátil»). */
test("categoria (056): motherboard, watercooling y «Portátil» con tilde son lo que son", () => {
  assert.equal(C.categoriaDe("Motherboard Gigabyte A520i Ac Socket Am4 Color Negro"), "componente");
  assert.equal(C.categoriaDe("Placa Madre ASUS Prime B650M-A"), "componente");
  assert.equal(C.categoriaDe("Watercooling Evolabs Cryogene Pro 240 Argb"), "componente");
  assert.equal(C.categoriaDe("Ordenador Portátil Lenovo Yoga 7i 14 2k Oled I5-322 16 Gb 512 Gb"), "notebook");
  assert.equal(C.categoriaDe("Kit teclado y mouse Trust Ody II blanco 25467"), "periferico");
});

test("esTecnologia (056): en «Otros» queda la tecnologia (TV, tablet, proyector, UPS, router) y no el resto", () => {
  for (const n of ["Smart TV TCL 55 55C6K Mini LED QLED 4K UHD Google TV 144Hz", "Televisor 43 Smart Philips FHD Titan Os 43PDF6910 Negro",
                   "Tablet Blackview Link 8 127 18gb 256gb Android 15", "Tableta Samsung Galaxy Tab S10 Fe Plus De 128 Gb 8 Gb De Ram",
                   "Proyector Yaber L2 Plus 1080P JBL Dolby Audio con Netflix CBK0037", "UPS Forza NT-1002A Int. 1000VA/500W 45-65Hz",
                   "Extensor De Wi-fi 5 Tp-link Re305 Ac1200 Dual Band", "Combo Actualización AMD Ryzen 7 5700G 16GB",
                   "Bafle Activo Mut MT-30A 850R RMS 30\" TWS", "Evolabs Luma X Evo-320Ab - Gabinete Gaming Con 4 Ventiladores Argb",
                   "Consola PlayStation 5 Slim 1TB", "USB Kingston 128GB DataTraveler MicroDuo 3C"])
    assert.ok(C.esTecnologia(n), n);
  for (const n of ["Sun Tabletas Lavavajilla Pro Expert 4 en 1 X38 Lavado Y Brillo", "Tabletas para Maquina Lavavajilla Sun 3 en 1 20 unidades",
                   "Desmalezadora motoguadaña multifunción 4en1 Montana mon-955", "Cuna Multifunción Mega Baby Aurora Balanceo Música Control Gris",
                   "Kit Destornilladores Eléctricos Homecity 47 Piezas 4.8V Batería Litio", "Smartwatch Havit Rosa HVWTH-M9036",
                   "Tira De Led Tp-Link Tapo L930-5 Multicolor Wifi", "Sillón Premium Gamer Ideal P/ Playstation,xbox, Gaming, Pc Negro Cuero Sintético"])
    assert.ok(!C.esTecnologia(n), n);
});

test("categoria (056): un megafono, un proyector o una consola «portátil» no son notebooks", () => {
  for (const n of ["Megáfono Portátil Gadnic Altavoz Bluetooth", "Proyector Portátil ViewSonic M1+, WiFi, BT y p/Harman Kardon",
                   "Consola Gamer Portátil J36 Ultra YouTube WiFi Bluetooth RGB"])
    assert.notEqual(C.categoriaDe(n), "notebook", n);
  assert.equal(C.categoriaDe("Ordenador Portátil HP 15 Core i5 16GB 512GB"), "notebook");
});

test("categoria (058): «1Pc Gamer» de OnCity es una PC completa, no «Otros»", () => {
  const n = "1Pc Gamer Ryzen 7 5700G + 16GB + 480GB SSD + gráficos AMD Radeon™ VEGA SHARE";
  assert.equal(C.categoriaDe(n), "pc");
  // un producto que viene de a uno sigue siendo lo que es
  assert.notEqual(C.categoriaDe("1pc single camera for baby monitor model sm50 sm70ptz"), "pc");
});
