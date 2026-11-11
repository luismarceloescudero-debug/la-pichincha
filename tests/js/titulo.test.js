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

/* Spec 056: titulos del indice del 31/10 que perdian el modelo o tomaban una unidad o el procesador como modelo. */
test("titulo (056): ni «MHZ» ni el procesador hacen de modelo, y el modelo despues de los datos no se pierde", () => {
  const t = n => T.de(n).titulo;
  assert.equal(t("Memoria Ram Sodimm DDR5 - 16Gb 4800 Mhz Adata"), "ADATA");
  assert.equal(t("Fuente Cooler Master 750W 80 Plus Gold Full Modular MWE V3 ATX 3.1 PCIe 5.1"), "COOLER MASTER MWE V3");
  assert.equal(t("Fuente ASUS PRIME 750W 80 Plus Gold AP-750G Full Modular ATX 3.1 PCIe 5.1"), "ASUS PRIME AP-750G");
  assert.equal(t("Notebook Lenovo 15.6 R7-7730U 16GB SSD512GB V15 Sin Sistema Operativo"), "LENOVO V15");
  assert.equal(t("Notebook CX 15,6 U5-115U 16GB SSD512GB Sin Sistema Operativo"), "CX");
  assert.equal(t("Notebook ThinkPad T14 Gen 6 Ryzen AI 5 PRO 16GB RAM 512 SSD 14\" Win 11 Pro 21QK0"), "LENOVO THINKPAD T14 GEN 6");
  // el procesador escrito corto va en las chips
  assert.ok(T.de("Notebook Lenovo 15.6 R7-7730U 16GB SSD512GB V15 Sin Sistema Operativo").chips.includes("Ryzen 7 7730U"));
  assert.ok(T.de("Notebook CX 15,6 U5-115U 16GB SSD512GB Sin Sistema Operativo").chips.includes("Core Ultra 5 115U"));
  assert.ok(T.de("Notebook HP 16 U7-366H 48GB 1TB RTX500 6GB ZBOOK XG2i W11P").chips.includes("Core Ultra 7 366H"));
  // lo que ya andaba sigue igual
  assert.equal(t("Notebook HP 15.6 C5-120U 16GB SSD512GB 250 Sin Sistema Operativo"), "HP 250");
  assert.equal(t("Monitor Gamer Samsung Odyssey G8 G81SF 27\" UHD 4K QD-OLED 240Hz 0,03ms"), "SAMSUNG ODYSSEY G8 G81SF");
  assert.equal(t("Notebook Lenovo ThinkPad E14 Gen 7 Core Ultra 5 225U 16GB 512GB SSD 14\" Sin Windows"), "LENOVO THINKPAD E14 GEN 7");
});

test("titulo (056): la marca de la linea no se repite y «8000 DPI» no deja el numero suelto", () => {
  assert.equal(T.de("MacBook Apple 13\" Neo A18 Pro Chip 8gb 256ssd Indigo").titulo.split(" ").filter(w => w === "APPLE").length, 1);
  assert.equal(T.de("MOUSE RAPTOR STORM GRIP 8000 DPI").titulo, "RAPTOR STORM GRIP");
  assert.ok(T.de("Megáfono Portátil Gadnic Altavoz Bluetooth").chips.includes("Bluetooth"));
});

test("titulo (056): «Ordenador Portátil» es el tipo, no la marca", () => {
  assert.equal(T.de("Ordenador Portátil Lenovo Yoga 7i 14 2k Oled I5-322 16 Gb 512 Gb").titulo, "LENOVO YOGA 7I 14");   // el 14 sin comillas queda: en «HP 14» es el modelo
});

test("titulo (058): «SUPER» es parte del modelo de una placa, el combo dice su procesador (y sigue diciendo COMBO) y «de Escritorio» es el tipo", () => {
  const t = n => T.tituloDe(n, T.tipoDe(n));
  assert.equal(t("Tarjeta Gráfica Pny Geforce Rtx 4070 Ti Super 16gb Xlr8 Gaming"), "PNY RTX 4070 TI SUPER");
  // indice del 31/10: los tres combos de Venex salian «COMBO ACTUALIZACIÓN AMD RYZEN 7» (dos iguales)
  assert.equal(t("Combo Actualización AMD Ryzen 7 5700G 16GB"), "COMBO AMD RYZEN 7 5700G");
  assert.equal(t("Combo Actualización AMD Ryzen 5 8600G 16GB"), "COMBO AMD RYZEN 5 8600G");
  assert.equal(t("Computadora de Escritorio Dell Pro SFF U5-235 16GB SSD512GB W11P"), "DELL PRO SFF");
});

test("prefijo (059): con pocas palabras el titulo lleva adelante el tipo; con muchas, o sin tipo claro, no", () => {
  assert.equal(T.de("Teclado Mecanico VSG Alnilam Blanco RGB").prefijo, "Teclado");          // «Teclado VSG ALNILAM»
  assert.equal(T.de("Auriculares HyperX Cloud III").prefijo, "Auriculares");
  assert.equal(T.de("Placa de Video Gigabyte RTX 5060 8GB").prefijo, "Placa de video");
  assert.equal(T.de("Notebook Lenovo IdeaPad Slim 3 15IAH8 i5 16GB 512GB").prefijo, "");   // cinco palabras: ya se entiende
  assert.equal(T.de("Gadnic Cosa Rara").prefijo, "");                                         // «Producto» no ayuda
  assert.equal(T.conTipo("Teclado Mecanico VSG Alnilam Blanco RGB"), "Teclado VSG ALNILAM");
  assert.equal(T.conTipo("Notebook Lenovo IdeaPad Slim 3 15IAH8 i5 16GB 512GB"), "LENOVO IDEAPAD SLIM 3 15IAH8");
});

test("premium (059): las chips que ponen al producto arriba de su gama, como en el Reel", () => {
  for (const c of ["Mecánico", "27″ · 4K", "QD-OLED", "240 Hz", "RTX 5070", "Ryzen AI 7 350", "DDR5", "1 TB", "32 GB"]) assert.ok(T.premium(c), c);
  for (const c of ["RGB", "8/256 GB", "16 GB RAM", "FHD", "IPS", "Core i5", "DDR4", "60 Hz"]) assert.ok(!T.premium(c), c);
});

test("titulo (04/11): «Rapid» de «Rapid IPS/VA» es el panel, no la marca; el nombre de Venex dice 274QP y se respeta", () => {
  // Maximus, ofertas del 04/11
  assert.equal(T.de('Monitor Gamer Rapid Ips 24" Msi Mag 245f X24 240hz Fhd 0.5ms - Hdmi/dp - Freesync').titulo, "MSI MAG 245F X24");
  assert.equal(T.de('Monitor Gamer Rapid Ips 27" Msi Mag 272f X24 240hz Fhd 0.5ms - Hdmi-Dp').titulo, "MSI MAG 272F X24");
  assert.equal(T.de('Monitor Gamer Rapid Va Msi 34" Mag 346cqdf Wqhd 240hz Curvo - Hdmi - 0.5ms').titulo, "MSI MAG 346CQDF");
  assert.deepEqual(T.de('Monitor Gamer Rapid Ips 24" Msi Mag 245f X24 240hz Fhd 0.5ms - Hdmi/dp - Freesync').chips, ["24″", "FHD", "IPS", "240 Hz"]);
  // Detras del modelo tambien es ficha
  assert.equal(T.de("Monitor Gamer Curvo 27 Msi Mag 276cf 0.5ms 200hz Rapid Va").titulo, "MSI MAG 276CF");
  // Venex: el enlace dice 274qd, pero el nombre del aviso dice 274QP (dato de la tienda, no se corrige)
  assert.equal(T.de('Monitor Gamer MSI MAG 274QP X24 27" WQHD OLED 240Hz').titulo, "MSI MAG 274QP X24");
});

test("capacidad con decimales (11/11): el chip dice la capacidad de la unidad, no lo que sigue al punto", () => {
  // «PACK 6X2.4TB» son unidades de 2.4 TB: salia el chip «4 TB», encima marcado premium. Un dato falso.
  assert.deepEqual(T.chipsDe("SAS HPE MSA PACK 6X2.4TB", "otro"), ["2.4 TB"]);
  assert.deepEqual(T.chipsDe("SSD 7.68TB U.2", "disco"), ["7.68 TB"]);
  assert.deepEqual(T.de("HDD 1.2TB SAS").chips, ["1.2 TB", "HDD"]);
  // La coma decimal tambien: el sitio muestra el punto.
  assert.deepEqual(T.chipsDe("Disco 2,4TB", "disco"), ["2.4 TB"]);
  assert.deepEqual(T.chipsDe("Pendrive 0.5TB", "disco"), ["0.5 TB"]);
});

test("capacidad sin decimales (11/11): sigue igual, y un kit no suma las dos unidades", () => {
  assert.deepEqual(T.chipsDe("SSD 1TB", "disco"), ["1 TB"]);
  assert.deepEqual(T.chipsDe("SSD 2 TB", "disco"), ["2 TB"]);
  assert.deepEqual(T.de("Memoria 16GB").chips, ["16 GB"]);
  assert.deepEqual(T.chipsDe("Memoria RAM 2.4GB", "memoria"), ["2.4 GB"]);
  const kit = T.de("Kit 2x16GB");
  assert.ok(kit.chips.includes("16 GB"), "el chip es la capacidad de cada modulo");
  assert.ok(!kit.chips.some(c => /32 GB/.test(c)), "el kit no inventa el total");
});

test("premium y decimales (11/11): 1 TB o mas sigue siendo premium, 0.5 TB no", () => {
  for (const c of ["2.4 TB", "7.68 TB", "1.2 TB", "1 TB", "10 TB", "128 GB"]) assert.ok(T.premium(c), c);
  for (const c of ["0.5 TB", "0.9 TB", "16 GB", "8/256 GB"]) assert.ok(!T.premium(c), c);
  assert.ok(!T.premium(T.chipsDe("Pendrive 0.5TB", "disco")[0]), "0.5 TB no es premium");
});

test("titulo (05/11): «MagneticoMecanico» pegado se separa en chips, un monitor sin modelo no queda en la marca sola, y una chip que el titulo ya dice no se repite", () => {
  const t = T.de("Teclado MagneticoMecanico Redragon K617 Fizz 60% Rapid Trigger 8K Hz Black RGB");
  assert.equal(t.titulo, "REDRAGON K617 FIZZ");
  assert.ok(t.chips.includes("Magnético") && t.chips.includes("Mecánico"));
  const m = T.de("Monitor MSI 27″ Rapid IPS QHD 240Hz 0.5ms");
  assert.equal(m.titulo, "MSI 27″ RAPID IPS");
  assert.ok(!m.chips.includes("27″") && !m.chips.includes("IPS"), "lo que dice el titulo no se repite en las chips");
  assert.equal(T.de("SSD Kingston 1TB").titulo, "KINGSTON", "fuera de monitores, la marca sola sigue como antes");
});
