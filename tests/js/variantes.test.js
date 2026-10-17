const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");
const C = require("../../js/categorias.js");
const O = require("../../js/ofertas.js");

// Cada tienda publica el mismo producto con otra tipografia. Lo que se busca tiene que encontrarlo igual.
const halla = (consulta, titulo) => B.filtroDe(consulta)(B.normalBusq(titulo));

test("busqueda: guiones, espacios duros y guiones largos no cambian el resultado", () => {
  assert.equal(halla("b840m h", "Mother GIGABYTE B840M-H DDR5"), true);
  assert.equal(halla("b840m-h", "Motherboard GIGABYTE B840M H AM5 DDR5"), true);
  assert.equal(halla("b840m-h", "Mother GIGABYTE B840M–H DDR5"), true);
  assert.equal(halla("h410m-a pro", "MOTHER MSI H410M-A PRO DDR4 LGA1200"), true);
  assert.equal(halla("h410m a", "MOTHER MSI H410M A PRO DDR4"), true);
  assert.equal(halla("i5-13420h", "Notebook HP Intel Core i5 13420H 16GB"), true);
  assert.equal(halla("ddr4 3200", "Memoria Kingston DDR4-3200 16GB"), true);
  assert.equal(halla("tp-link", "Router TP Link Archer"), true);
});

test("busqueda: UDIMM, SODIMM y sus variantes de escritura", () => {
  for (const t of ["Hiksemi Hiker Ddr4 32Gb 3200Mhz U-Dimm", "Memoria Patriot Udimm Pc", "Memoria U DIMM 16GB"]) assert.equal(halla("udimm", t), true, t);
  for (const t of ["SODIMM DDR5 8GB", "Memoria SO-DIMM DDR4", "Memoria so dimm 8gb"]) assert.equal(halla("sodimm", t), true, t);
  assert.equal(halla("u-dimm", "Memoria Patriot Udimm Pc"), true);
  assert.equal(halla("so-dimm", "SODIMM DDR5 8GB"), true);
  assert.equal(halla("udimm", "SODIMM DDR5 8GB"), false);
});

test("busqueda: las capacidades se escriben de muchas formas y son la misma", () => {
  for (const t of ["SSD Kingston 1TB", "SSD Kingston 1 Tb", "SSD Kingston 1000GB", "SSD Kingston 1024 GB", "SSD Kingston 1tb"]) {
    assert.equal(halla("ssd 1tb", t), true, t);
    assert.equal(halla("ssd 1000gb", t), true, t);
  }
  assert.equal(halla("ssd 2tb", "SSD WD 2048GB"), true);
  assert.equal(halla("ssd 1tb", "SSD WD 2TB"), false);
  assert.equal(halla("ssd 500gb", "SSD WD 1000GB"), false);
  assert.equal(halla("16gb", "VGA RTX 5070 Ti 16G GDDR7"), true);
  assert.equal(halla("rtx 5070 ti 16g", "Placa de video RTX 5070 Ti 16GB"), true);
  assert.equal(halla("1tb", "Disco 11TB"), false);                        // una medida es palabra entera
});

test("busqueda: lo que ya andaba sigue andando", () => {
  assert.equal(halla("sa400s37/480g", "SSD Kingston SA400S37/480G"), true);
  assert.equal(halla("ipad", "Disipador Cooler"), false);
  assert.equal(halla("27", "Monitor Vp227hf"), false);
  assert.equal(halla("27", 'Monitor 27" Led'), true);
});

test("categorias: pulgadas con todas las comillas y con coma decimal", () => {
  for (const [titulo, esperado] of [['Monitor LG 27" IPS 165Hz', 27], ["Monitor LG 27″ IPS 165Hz", 27], ["Monitor LG 27” IPS 165Hz", 27],
      ["Monitor LG 27'' IPS 165Hz", 27], ["Monitor LG 27 pulgadas IPS 165Hz", 27], ["Monitor LG 23,8″ IPS 165Hz", 23.8], ["Monitor LG 23.8 IPS 165Hz", 23.8]]) {
    const e = C.evaluar(titulo);
    if (esperado < 24) assert.equal(e.pasa, false, titulo);
    else assert.equal(e.pasa, true, titulo);
  }
  assert.match(C.evaluar("Monitor LG 23,8″ IPS 165Hz").motivo, /23\.8" \(mínimo 24"\)/);
});

test("categorias: la VRAM se lee tambien como 6G y la RAM de un celular con otras palabras", () => {
  assert.equal(C.evaluar("VGA RTX 4050 6G GDDR6").pasa, false);
  assert.equal(C.evaluar("VGA 16GB RTX 5070 TI ASUS TUF GAMING OC 16G GDDR7").nivel, "alta");
  const ref = C.referencia([]);
  for (const t of ["Celular Moto G 8GB de memoria RAM 256GB", "Celular Moto G RAM: 8 GB 256GB", "Celular Moto G Memoria RAM 8 GB Almacenamiento 256 GB",
      "Celular Moto G 256GB 8GB RAM", "Celular Moto G 8GB | 256GB", "Celular Moto G 8 GB + 256 GB"]) {
    assert.equal(C.memoriaDe(t).ram, 8, t);
    assert.equal(C.memoriaDe(t).rom, 256, t);
    assert.equal(C.evaluar(t, ref).pasa, true, t);
  }
});

test("el mismo aviso con la URL escrita distinto cuenta una sola vez (www, barra final, parametros de seguimiento)", () => {
  const fila = (url, via = "") => ["Smart Tv Acer 55", 216200, url, via ? "comparaya" : "cg", via, 0, 292817, "", "", ""];
  const a = fila("https://www.tienda.test/producto/tv-acer-55/");
  const b = fila("http://tienda.test/producto/tv-acer-55?utm_source=comparaya&utm_medium=cpc", "Tienda");
  const c = fila("https://tienda.test/producto/tv-acer-55?variante=2");
  assert.equal(O.calcularOfertas({ productos: [a, b] }).propias.length, 1);
  assert.equal(O.calcularOfertas({ productos: [b, a] }).propias[0][3], "cg");                      // gana la fila directa
  assert.equal(O.calcularOfertas({ productos: [a, c] }).propias.length, 2);                        // otra variante: otro aviso
});

test("categorias: las unidades pegadas a lo que sigue (165Hz1ms, 5000mAh120Hz) se leen igual", () => {
  assert.equal(C.evaluar("Monitor Gamer 27 IPS 165Hz1ms").nivel, "media");
  assert.equal(C.evaluar("Monitor Gamer 27 IPS 165HZ").nivel, "media");
  assert.equal(C.evaluar("Monitor Gamer MSI 24\" MAG 245F FHD Rapid IPS 240Hz 0.5ms 2xHDMI + 1xDP (II) (3242)").pasa, true);
  assert.equal(C.evaluar("Celular Redmi 8GB 256GB 5000mAh120Hz").pasa, true);
  assert.equal(C.evaluar("Celular Redmi 8GB 256GB 4000mAh90Hz").pasa, false);
  assert.equal(C.aspectosDe("Celular Redmi 8GB 256GB 5000mAh120Hz 108MP").camara, 108);
});

test("categorias: el mismo equipo escrito con otras palabras", () => {
  const cat = n => C.categoriaDe(n);
  for (const n of ["Teléfono Celular Motorola Edge 50", "Motorola Edge 50 Fusion 8GB 256GB", "Honor 400 Lite 8GB 256GB", "Oppo Reno 13 12GB 512GB",
      "Samsung Galaxy Z Flip7 12GB 256GB", "Nothing Phone (3) 12GB 256GB", "Vivo Y29 8GB 256GB", "OnePlus 13 16GB 512GB"]) assert.equal(cat(n), "smartphone", n);
  for (const n of ["HP Victus 15 Ryzen 5 16GB 512GB", "Dell Inspiron 15 3520 Core i5 16GB 512GB", "Lenovo LOQ 15 RTX 4050 16GB 512GB", "Portátil Acer Aspire 5", "Chromebook Samsung 4GB"])
    assert.equal(cat(n), "notebook", n);
  for (const n of ["LG UltraGear 27GP850 Monitor Gaming 165Hz", "Samsung Odyssey G5 Monitor Curvo 27", "Monitor 27 IPS 100Hz"]) assert.equal(cat(n), "monitor", n);
  assert.equal(cat("Pc Gamer Ryzen 5 con monitor 24 16GB 512GB"), "pc");
  assert.equal(cat("Combo teclado mouse y monitor"), "periferico");
  assert.notEqual(cat("Soporte para monitor doble"), "monitor");
  assert.notEqual(cat("Cable HDMI para monitor 2m"), "monitor");
});

test("usado: las mismas palabras que en Python, y el formato SODIMM con otras grafias", () => {
  for (const n of ["SSD Kingston 480GB seminuevo", "SSD Kingston 480GB semi nuevo", "Placa MSI RTX 4060 (Caja Abierta)", "Disco WD 1TB segunda mano", "SSD 2da mano"])
    assert.equal(B.esUsado([n, 1, "u", "cg", "", 0, 0, "", "", ""]), true, n);
  const motivo = n => B.motivoExclusion(B.normal(n), "memoria ddr4 8gb", ["memoria", "ddr4", "8gb"], "");
  for (const n of ["Memoria SO DIMM DDR4 8GB", "Memoria S.O.DIMM DDR4 8GB", "Memoria SODIMM DDR4 8GB", "Memoria SO-DIMM DDR4 8GB"]) assert.equal(motivo(n), "formato", n);
  assert.equal(B.specsDe("Monitor LG 21,5'' IPS 100Hz").Pantalla, '21.5"');
  assert.equal(B.specsDe("Monitor LG 27″ IPS").Pantalla, '27"');
});

test("busqueda: S.O.DIMM tambien es SODIMM", () => {
  assert.equal(halla("sodimm", "Memoria S.O.DIMM DDR4 8GB"), true);
});

test("revision: los hallazgos de code-review quedan cubiertos", () => {
  // RAM y SSD para notebook son componentes, con sus minimos; una funda para notebook es un accesorio
  assert.equal(C.categoriaDe("Memoria RAM de Notebook Kingston 8GB DDR4"), "componente");
  assert.equal(C.evaluar("Memoria RAM de Notebook Kingston 8GB DDR4").pasa, false);
  assert.equal(C.categoriaDe("Disco SSD para notebook 240GB"), "componente");
  assert.equal(C.evaluar("Disco SSD para notebook 240GB").pasa, false);
  assert.equal(C.categoriaDe("Funda para notebook 15.6"), "periferico");
  // el chip A17+ es de Apple: un Galaxy A55 no suma el punto de chip tope
  assert.equal(C.evaluar("Celular Samsung Galaxy A55 8GB 128GB 5G").alta, false);
  // en una PC, HD es el disco o la grafica Intel HD, no la pantalla
  assert.equal(C.evaluar("PC Armada Intel Core i5 12400 16GB HD 1TB").pasa, true);
  assert.equal(C.evaluar("Notebook HP Core i5 12450H 16GB 512GB 15.6 HD").pasa, false);
  // poco y nitro no son marcas sueltas; ROG y TUF siguen siendo Asus
  const re = B.armarMarcasRe(["asus", "sapphire", "motorola", "xiaomi"]);
  assert.equal(B.marcaDe("Placa de video Sapphire Nitro+ RX 7800 XT", re), "sapphire");
  assert.equal(B.marcaDe("Celular poco uso Motorola Edge 8GB", re), "motorola");
  assert.equal(B.marcaDe("Celular Xiaomi Poco X7 Pro 12GB 512GB", re), "poco");
  assert.equal(B.marcaDe("Notebook Asus ROG Strix G16", re), "asus");
  assert.equal(B.marcaDe("Placa de video Asus TUF RTX 4070", re), "asus");
  // 4G y 5G son la red, no una capacidad
  assert.equal(halla("4gb", "Celular Motorola 5G 4G LTE 8GB"), false);
  assert.equal(halla("5g", "Celular Motorola Edge 5G"), true);
  assert.equal(halla("16gb", "VGA RTX 5070 Ti 16G"), true);
  assert.equal(halla("8gb", "Placa RTX 4060 8G"), true);
  // los umbrales globales que ya no rigen no se exportan
  assert.equal(O.DESCUENTO_MIN, undefined);
  assert.equal(O.BAJA_MIN_PCT, undefined);
});

test("trail of bits: el cupo, el comercio no textual y la busqueda de las paginas /precios/", () => {
  const f = (n, p, l) => [n, p, "https://t.test/" + encodeURIComponent(n), "cg", "", l, 0, "", "", ""];
  // "otro" no tiene lugar reservado, pero cuando entra lo hace con su mejor oferta, no con la tercera
  const comp = Array.from({ length: 12 }, (_, i) => f(`Memoria Kingston Fury DDR5 32GB v${i}`, 100000 + i, 200000));
  const otros = [f("Smart Tv A 55", 45000, 100000), f("Smart Tv B 55", 50000, 100000), f("Smart Tv C 55", 55000, 100000)];
  const d = O.destacadas({ productos: [...comp, ...otros] }, 6);
  const tv = d.filter(o => o.categoria === "otro").map(o => Math.round(o.off * 100));
  assert.ok(tv.length >= 1 && tv[0] === 55, JSON.stringify(tv));
  // un comercio que no es texto no rompe la busqueda
  assert.doesNotThrow(() => B.agruparPorModelo([["x", 1, "u", "comparaya", 123, 0, 0, "", "", "M"], ["y", 2, "v", "cg", "", 0, 0, "", "", "M"]]));
});
