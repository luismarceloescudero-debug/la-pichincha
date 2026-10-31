const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../../js/titulo.js");

// Titulos reales de las ofertas publicadas el 29/10 y del indice del 22/10.
const caso = (nombre, tipo, titulo, chips) => test(`${tipo}: ${titulo}`, () => {
  const t = T.de(nombre);
  assert.equal(t.tipo, tipo);
  assert.equal(t.titulo, titulo);
  assert.deepEqual(t.chips, chips);
});

caso("Celular Samsung Galaxy A17 5g Gray 8/256gb 6.7''", "celular", "SAMSUNG GALAXY A17", ["8/256 GB", "5G", "6.7″"]);
caso("Celular Samsung Galaxy S25 256 Gb 12 Ram Navy", "celular", "SAMSUNG GALAXY S25", ["12/256 GB"]);
caso('Notebook Gamer Lenovo Legion 5 15AKP10 15.1" OLED WQXGA 165Hz AMD Ryzen AI 7 350 16GB DDR5 SSD 512GB RTX 5050 8GB Win11 83F1005FAR',
  "notebook", "LENOVO LEGION 5 15AKP10", ["Ryzen AI 7 350", "RTX 5050", "16 GB RAM", "512 GB SSD", "15.1″ OLED 165 Hz"]);
caso("NOTEBOOK HP PROBOOK G10 14″ RYZEN 5 16GB RAM, 512GB WIFI6-E WIN11P", "notebook", "HP PROBOOK G10", ["Ryzen 5", "16 GB RAM", "512 GB SSD", "14″"]);
caso('Monitor Gamer Samsung Odyssey G8 G81SF 27" UHD 4K QD-OLED 240Hz 0,03ms G-SYNC AMD FreeSync Premium Pro',
  "monitor", "SAMSUNG ODYSSEY G8 G81SF", ["27″", "4K", "QD-OLED", "240 Hz"]);
caso('Monitor GIGABYTE 27" QD-OLED QHD GO27Q24A - 240hz 0.03ms', "monitor", "GIGABYTE GO27Q24A", ["27″", "QHD", "QD-OLED", "240 Hz"]);
caso("MONITOR LG 27 ULTRAGEAR 27GS60F FULL HD 180 Hz (II) (1816)", "monitor", "LG ULTRAGEAR 27GS60F", ["27″", "FHD", "180 Hz"]);
caso("Notebook LENOVO YOGA 14″ INTEL Ultra 5 125H 16GB 512G SSD – Windows 11 Home", "notebook", "LENOVO YOGA", ["Core Ultra 5 125H", "16 GB RAM", "512 GB SSD", "14″"]);
caso("Motherboard Gigabyte Ga-a520m-h 1.0 Am4 Ddr4", "mother", "GIGABYTE GA-A520M-H", ["AM4", "DDR4"]);
caso("Procesador AMD Ryzen 5 5600 3.50GHz AM4 DDR4", "procesador", "AMD RYZEN 5 5600", ["AM4", "3.5 GHz"]);
caso("Procesador Intel Core i7 12700 4.9GHz Turbo Socket 1700 Alder Lake", "procesador", "INTEL CORE I7 12700", ["LGA1700", "4.9 GHz"]);
caso("Placa De Video Msi Nvidia Geforce Rtx 5070 Ti Gaming Trio 16", "placa-video", "MSI RTX 5070 TI", []);
caso("Mouse Inalámbrico Satechi OntheGo™ Bluetooth Batería Recargable USB-C Negro", "mouse", "SATECHI ONTHEGO", ["Inalámbrico", "Bluetooth", "USB-C"]);
caso("MOUSE WIRELESS LOGITECH M190 005904 RED/BLACK Rojo", "mouse", "LOGITECH M190", ["Inalámbrico"]);
caso("FUENTE 750W THERMALTAKE TOUGHPOWER GT 80 PLUS GOLD FULL MODULAR", "fuente", "THERMALTAKE TOUGHPOWER GT", ["750 W", "80+ Gold", "Modular"]);
caso("Memoria RAM DDR4 CORSAIR 8GB 3200MHz Vengeance LPX", "memoria", "CORSAIR VENGEANCE LPX", ["8 GB", "DDR4", "3200 MHz"]);
caso("Gabinete Cooler Master Elite 600 Mid Tower 4 Fans ARGB Tempered Glass White s/Fuente", "gabinete", "COOLER MASTER ELITE 600", []);

test("lo usado o reacondicionado sale del titulo pero se dice primero", () => {
  const t = T.de("Smartphone Reacondicionado Google Pixel 6 Pro 5g 128gb Storm");
  assert.equal(t.titulo, "GOOGLE PIXEL 6 PRO");
  assert.equal(t.chips[0], "Reacondicionado");
  assert.equal(T.de("Monitor Hikvision 21.5'' D5022FN IPS Full HD - Usado en evento").chips[0], "Usado");
});

test("pulgadas: '' \" ” y «pulgadas» pasan a ″; unas comillas sueltas no", () => {
  assert.equal(T.pulgadas(`Monitor 27'' y 24" y 32” y 21.5 Pulgadas`), "Monitor 27″ y 24″ y 32″ y 21.5″");
  assert.equal(T.pulgadas(`Mouse "Pro"`), `Mouse "Pro"`);
  assert.equal(T.de('Notebook Asus 15.6" i5').completo, "Notebook Asus 15.6″ i5");
});

test("icono y emoji por tipo; linea de texto para el canal", () => {
  assert.match(T.svg("notebook"), /^<svg class="ico" viewBox="0 0 24 24"[^>]*aria-label="Notebook">/);
  assert.match(T.svg("inexistente"), /aria-label="Producto"/);
  assert.equal(T.linea("Celular Samsung Galaxy A17 5g Gray 8/256gb 6.7''"), "📱 SAMSUNG GALAXY A17 · 8/256 GB · 5G · 6.7″");
  assert.equal(T.linea("MOUSE WIRELESS LOGITECH M190 005904", { emoji: false }), "LOGITECH M190 · Inalámbrico");
});

test("un titulo raro no queda vacio", () => {
  assert.equal(T.de("").titulo, "");
  assert.ok(T.de("Notebook").titulo.length);
  assert.equal(T.de("Estabilizador Desktop TCA-1200N LYONN AV").tipo, "otro");
});

test("una placa sin «placa de video» al principio es placa de video, y el punto suelto del final no queda en el nombre (31/10)", () => {
  assert.equal(T.de("GIGABYTE RTX 5080 16 GB GDDR7").tipo, "placa-video");
  assert.equal(T.de("Gigabyte Radeon RX 9070 XT 16GB").tipo, "placa-video");
  assert.equal(T.de("Notebook Lenovo RTX 4050 16GB").tipo, "notebook");
  assert.equal(T.de("Tarjeta De Video Gigabyte Rtx 5080 16gb Gddr7 .").completo, "Tarjeta De Video Gigabyte Rtx 5080 16gb Gddr7");
});

test("«SSD512GB» pegado es un dato y no parte del titulo (31/10: «HP SSD512GB 250»)", () => {
  const t = T.de("Notebook HP 15.6 C5-120U 16GB SSD512GB 250 Sin Sistema Operativo");
  assert.equal(t.titulo, "HP 250");
  assert.ok(t.chips.includes("512 GB SSD"));
});
