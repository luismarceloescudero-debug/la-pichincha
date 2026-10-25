const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");

test("mediana con cantidad par, impar y vacia, sin tocar el original", () => {
  const nums = [4, 1, 3, 2];
  assert.equal(B.mediana([]), 0);
  assert.equal(B.mediana([3, 1, 2]), 2);
  assert.equal(B.mediana(nums), 2.5);
  assert.deepEqual(nums, [4, 1, 3, 2]);
});

test("normalBusq saca acentos y pega la cifra con su unidad", () => {
  assert.equal(B.normalBusq("Memoria 16 GB Ñandú 3200 MHz"), "memoria 16gb nandu 3200mhz");
});

test("una medida tiene que ser palabra entera", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("2tb")(n("Disco 12TB Seagate")), false);
  assert.equal(B.filtroDe("2tb")(n("Disco Seagate 2 TB")), true);
  assert.equal(B.filtroDe("27")(n("Monitor Vp227hf")), false);
  assert.equal(B.filtroDe("monitor 27")(n('Monitor Samsung 27" Curvo')), true);
  assert.equal(B.filtroDe("kingston")(n("Memoria KINGSTON Fury")), true);
  assert.equal(B.filtroDe("   "), null);
});

test("una palabra no se encuentra adentro de otra", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("ipad")(n("Memoria Ram 16Gb DDR4 Con Disipador")), false);
  assert.equal(B.filtroDe("ipad")(n("Apple iPad 10.9 64GB")), true);
});

test("una palabra encuentra las que empiezan con ella", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("notebook")(n("Notebooks Lenovo IdeaPad")), true);
  assert.equal(B.filtroDe("rtx")(n("Placa de Video RTX3060 12GB")), true);
});

test("una palabra pegada a una cifra cuenta como palabra aparte", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("ssd")(n("Notebook Lenovo V15 8gb 512ssd")), true);
});

test("una palabra pegada a una capacidad cuenta como palabra aparte", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("ssd")(n("Notebook Acer 32gb 1tbssd 14''")), true);
  assert.equal(B.filtroDe("rtx")(n("Notebook MSI Cyborg 15 8GB DDR4 512GBRTX 5050")), true);
});

test("pisoDeGama es mas exigente sin marca reconocida", () => {
  assert.equal(B.pisoDeGama(400, 0, 1000), true);
  assert.equal(B.pisoDeGama(400, 2, 1000), false);
  assert.equal(B.pisoDeGama(300, 2, 1000), true);
});

/* --- Los tres modos y su orden (spec 013), con titulos reales del indice del 19/10/2026 --- */
const Modos = require("../../js/modos.js");

// fila del indice: [nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo, desde]
const f = (nombre, precio, extra = {}) => [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), extra.tienda || "cg", "",
  extra.lista || 0, extra.antes || 0, "", extra.sellos || "", extra.modelo || "", ""];
const MARCAS = { primera: ["samsung", "lenovo", "asus", "kingston"], conocida: ["hiksemi", "acer", "logitech"] };
const PRODUCTOS = [
  f("Celular Samsung Galaxy S26 256/12GB Black", 2699999),
  f("Celular Samsung Galaxy S25 256/12GB Black", 1900000),
  f("Celular Samsung Galaxy A57 5G 8GB 256GB Gray", 1149999, { antes: 1300000 }),       // baja propia de 11%: oferta de gama media
  f("Celular Hiksemi X1 Pro 8GB 256GB", 400000),                                       // marca conocida, muy por debajo del resto
  f("Notebook Lenovo LOQ Ryzen 7 7735HS 16GB 512GB SSD RTX 4050", 1500000, { antes: 1800000 }),   // oferta de gama media
  f("Notebook Asus Zenbook Core Ultra 9 32GB 1TB OLED RTX 5070", 5000000),             // gama alta
  f("Notebook Generica Core i5-13420H 16GB 512GB", 900000),                            // marca sin reconocer
  f("Notebook Acer Nitro Core i7-14650HX 16GB 512GB RTX 4060", 1700000, { sellos: "i" }),   // compra internacional
  f("Auriculares Logitech G733 Lightspeed", 312615),
  f("Auriculares Generico Bluetooth", 20000),
];
const IDX = { generado: "2026-10-19T10:00-03:00", productos: PRODUCTOS, tiendas: {} };
const nivel = B.crearNivelMarca(MARCAS);
const nombres = r => r.map(x => x[0].split(" ").slice(0, 3).join(" "));
const med = B.mediana(PRODUCTOS.map(x => x[1]));
const descendente = r => r.map(x => x[1]).every((p, i, a) => !i || a[i - 1] >= p);

test("migrar: lo guardado por la version anterior cae en Recomendacion y lo desconocido tambien", () => {
  for (const viejo of ["recomendado", "precio", "marca", null, "", "otra cosa", undefined]) assert.equal(Modos.migrarModo(viejo), "recomendacion");
  for (const bueno of ["recomendacion", "super", "primera"]) assert.equal(Modos.migrarModo(bueno), bueno);
  assert.equal(Modos.migrarSecundario("marca"), "mejor");
  assert.equal(Modos.migrarSecundario("premium"), "premium");
  assert.deepEqual(Modos.MODOS.map(m => m.id), ["recomendacion", "super", "primera"]);
});

test("Recomendacion: pasa el piso de gama, marca reconocida y no esta muy por debajo; de mayor a menor precio", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const r = Modos.ordenar(Modos.filtrar(PRODUCTOS, "recomendacion", ctx, med), "precio", ctx);
  const locales = r.filter(x => !/Acer Nitro/.test(x[0]));
  assert.ok(descendente(locales));
  assert.ok(!nombres(r).includes("Notebook Generica Core"), "sin marca reconocida no entra");
  assert.ok(!nombres(r).includes("Auriculares Generico Bluetooth"));
  assert.ok(!nombres(r).includes("Celular Hiksemi X1"), "400.000 es menos del 35% de la mediana con marca conocida: piso de gama");
  const audio = PRODUCTOS.filter(x => /^Auriculares/.test(x[0]));
  assert.deepEqual(nombres(Modos.filtrar(audio, "recomendacion", ctx, B.mediana(audio.map(x => x[1])))), ["Auriculares Logitech G733"],
    "un periferico entra solo por marca y piso, sin gama");
});

test("lo internacional va siempre al final, en cualquier modo y orden", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const r = Modos.ordenar(Modos.filtrar(PRODUCTOS, "recomendacion", ctx, med), "precio", ctx);
  assert.equal(r[r.length - 1][0].startsWith("Notebook Acer Nitro"), true);
  assert.ok(r[r.length - 1][1] < r[0][1], "la internacional vale mas que otras y aun asi queda ultima");
  for (const sec of ["precio", "novedades", "premium"])
    assert.equal(Modos.ordenar(PRODUCTOS, sec, ctx).pop()[8], "i", sec);
});

test("Super Oferta: solo ofertas reales de gama media, de mayor a menor precio", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const r = Modos.ordenar(Modos.filtrar(PRODUCTOS, "super", ctx, med), "precio", ctx);
  assert.deepEqual(nombres(r), ["Notebook Lenovo LOQ", "Celular Samsung Galaxy"]);
  assert.deepEqual(r.map(x => x[1]), [1500000, 1149999]);
});

test("Super Oferta (spec 014): suma el precio contra el mismo modelo en otras tiendas y el cruce por generacion, y cada fila trae sus razones", () => {
  const m = (nombre, precio, tienda, modelo) => { const x = f(nombre, precio, { tienda, modelo }); x[2] = `https://${tienda}.test/${modelo}/${precio}`; return x; };
  const ram = [m("Memoria Kingston Fury DDR5 32GB 6000MHz", 80000, "cg", "KF560"), m("Memoria Kingston Fury DDR5 32GB 6000MHz", 100000, "mx", "KF560"),
    m("Memoria Kingston Fury DDR5 32GB 6000MHz", 104000, "vx", "KF560")];
  const media = Array.from({ length: 8 }, (_, i) => f(`Celular Realme ${i} 8GB 512GB`, 700000 + i * 1000));
  const anterior = f("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED", 690000);
  const actual = f("Celular Samsung Galaxy S26 Ultra 16GB 1TB 144Hz OLED 200MP", 1500000);
  const idx = { generado: "2026-10-19T10:00-03:00", productos: [...ram, ...media, anterior, actual], tiendas: {} };
  const ctx = Modos.preparar(idx, nivel);
  const r = Modos.filtrar(idx.productos, "super", ctx, B.mediana(idx.productos.map(x => x[1])));
  assert.deepEqual(r.map(x => x[0]).sort(), [anterior[0], ram[0][0]].sort());
  const razones = x => ctx.ofertas().get(x[2]).razones;
  assert.match(razones(ram[0])[0].texto, /22% bajo la mediana de las otras 2 tiendas/);
  assert.equal(razones(ram[0])[0].tipo, "modelo");
  assert.match(razones(anterior)[0].texto, /gama alta del año pasado al precio de una media de hoy/);
  assert.equal(razones(anterior)[0].tipo, "generacion");
});

test("Super Oferta incluye la gama alta si la oferta es real, y no inventa ofertas: sin ninguna queda vacia", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const zen = PRODUCTOS.find(x => /Zenbook/.test(x[0]));
  assert.equal(Modos.filtrar([zen], "super", ctx, med).length, 0, "gama alta sin baja ni rebaja ni otras tiendas: no es oferta");
  const baja = [...zen]; baja[6] = 5600000;                                           // bajo 11% contra su precio mas bajo de los 30 dias anteriores
  const idx = { ...IDX, productos: [baja] };
  assert.equal(Modos.filtrar([baja], "super", Modos.preparar(idx, nivel), med).length, 1);
});

test("Super Oferta no calcula ofertas si el modo no las pide (el calculo caro es perezoso) y lo hace una sola vez", () => {
  let calculos = 0;
  const ctx = Modos.preparar(IDX, nivel, () => { calculos++; return require("../../js/ofertas.js").calcularOfertas(IDX); });
  Modos.filtrar(PRODUCTOS, "recomendacion", ctx, med); Modos.filtrar(PRODUCTOS, "primera", ctx, med);
  assert.equal(calculos, 0);
  Modos.filtrar(PRODUCTOS, "super", ctx, med); Modos.filtrar(PRODUCTOS, "super", ctx, med);
  assert.equal(calculos, 1);
});

// el indice real tiene Ryzen de la serie 9000: sin eso, el Ryzen 7 7735HS de la LOQ pareceria la ultima generacion
const IDX_REAL = { ...IDX, productos: [...PRODUCTOS, f("Notebook Asus Ryzen 7 9955HX 16GB 512GB", 1)] };

test("Primera Linea: lo premium por especificaciones y tecnologia, sin mirar la marca (spec 014)", () => {
  const ctx = Modos.preparar(IDX_REAL, nivel);
  const r = Modos.ordenar(Modos.filtrar(PRODUCTOS, "primera", ctx, med), "precio", ctx);
  // Samsung y Lenovo estan en marcas.primera y no entran por eso: la A57 y la LOQ no tienen tecnologia de punta
  assert.deepEqual(nombres(r), ["Notebook Asus Zenbook", "Celular Samsung Galaxy", "Notebook Acer Nitro"]);
  assert.match(r[1][0], /S26/);
  assert.ok(descendente(r));
  // una marca sin reconocer con tecnologia de punta entra
  const nueva = f("Notebook Generica Core Ultra 9 275HX 64GB 2TB RTX 5090 OLED 240Hz", 6000000);
  assert.ok(Modos.filtrar([nueva], "primera", ctx, med).length === 1);
  assert.equal(nivel(nueva[0]), 0);
});

test("orden Novedades: la generacion mas nueva primero; sin dato de generacion ni año, al final", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const celus = Modos.ordenar(PRODUCTOS.filter(x => /Galaxy S2\d/.test(x[0])), "novedades", ctx);
  assert.ok(celus[0][0].includes("S26") && celus[1][0].includes("S25"), "S26 antes que S25");
  assert.equal(Modos.novedadDe("Celular Samsung Galaxy S26", ctx.ref), 0);
  assert.equal(Modos.novedadDe("Celular Samsung Galaxy S25", ctx.ref), -1);
  assert.equal(Modos.novedadDe("Auriculares Logitech G733", ctx.ref), -Infinity);
  const todo = Modos.ordenar(PRODUCTOS.filter(x => !/Acer/.test(x[0])), "novedades", ctx);
  assert.equal(todo[todo.length - 1][1] <= todo[todo.length - 2][1], true, "sin dato de novedad: de mayor a menor precio");
});

test("orden Novedades usa el año del titulo cuando no hay generacion", () => {
  const idx = { productos: [f("Monitor Samsung Odyssey 27 2025 144Hz IPS", 500000), f("Monitor Samsung Odyssey 27 2026 144Hz IPS", 600000)] };
  const ctx = Modos.preparar(idx, nivel);
  assert.equal(Modos.novedadDe(idx.productos[0][0], ctx.ref), -1);
  assert.equal(Modos.novedadDe(idx.productos[1][0], ctx.ref), 0);
});

test("orden Premium: mas señales de gama alta primero; a igual señal, el mas caro", () => {
  const ctx = Modos.preparar(IDX_REAL, nivel);
  const r = Modos.ordenar(PRODUCTOS.filter(x => !/Acer/.test(x[0])), "premium", ctx);
  assert.equal(r[0][0].startsWith("Notebook Asus Zenbook"), true);
  assert.ok(Modos.premiumDe("Notebook Asus Zenbook Core Ultra 9 32GB 1TB OLED RTX 5070", ctx) >= 4);
  assert.ok(Modos.premiumDe("Notebook Lenovo LOQ Ryzen 7 7735HS 16GB 512GB SSD RTX 4050", ctx) < 4);
  assert.equal(Modos.premiumDe("Auriculares Logitech G733", ctx), 0);
  assert.equal(Modos.premiumDe("Monitor LG 27 OLED 240Hz", ctx), 5, "OLED (3) y 240 Hz (2)");
});

test("un modo vacio explica por que y nombra los modos que si tienen resultados", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const audio = PRODUCTOS.filter(x => /^Auriculares/.test(x[0]));
  const cuentas = Modos.contar(audio, ctx, B.mediana(audio.map(x => x[1])));
  assert.equal(cuentas.super, 0);
  const v = Modos.textoVacio("super", cuentas);
  assert.match(v.texto, /Súper Oferta.*no hay nada.*oferta real hoy.*No se inventan ofertas/);
  assert.ok(v.otros.length > 0 && v.otros.every(m => cuentas[m.id] > 0));
  assert.match(Modos.textoVacio("primera", cuentas).razon, /puntaje premium/);
  assert.match(Modos.textoVacio("recomendacion", cuentas).razon, /piso de gama/);
  assert.match(Modos.textoVacio("inventado", cuentas).texto, /Recomendación/);
});

test("crearNivelMarca: 2 primera linea, 1 conocida, 0 sin reconocer, con palabra entera", () => {
  const nivel = B.crearNivelMarca({ primera: ["kingston", "xpg"], conocida: ["hiksemi"] });
  assert.equal(nivel("Memoria KINGSTON Fury 16GB"), 2);
  assert.equal(nivel("Memoria Hiksemi Hiker"), 1);
  assert.equal(nivel("Memoria generica"), 0);
  assert.equal(nivel("Memoria Kingstonxyz"), 0);
  assert.equal(B.crearNivelMarca({})("Kingston"), 0);
});

test("la marca es la primera que aparece, con alias", () => {
  const re = B.armarMarcasRe(["intel", "hp", "kingston", "xpg", "western digital"]);
  assert.equal(B.marcaDe("Notebook HP Intel Core i5", re), "hp");
  assert.equal(B.marcaDe("Memoria XPG Gammix D35", re), "adata");
  assert.equal(B.marcaDe("Disco Western Digital Blue 1TB", re), "wd");
  assert.equal(B.marcaDe("Mouse generico", re), "");
});

test("specsDe lee lo que dice el nombre", () => {
  assert.deepEqual(B.specsDe("Memoria Kingston Fury DDR4 16GB 3200MHz CL16 RGB"),
    { Tipo: "DDR4", Capacidad: "16GB", Velocidad: "3200 MHz", Latencia: "CL16", Luces: "RGB" });
  assert.deepEqual(B.specsDe("SSD Kingston NV2 1TB M.2 NVMe"), { Capacidad: "1TB", Formato: "M.2 NVMe" });
  assert.deepEqual(B.specsDe('Monitor Samsung 27" 165Hz FHD'),
    { Pantalla: '27"', Refresco: "165 Hz", "Resolución": "FHD" });
});

test("motivoExclusion respeta lo que pide la busqueda", () => {
  const m = (nombre, q) => {
    const nq = B.normalBusq(q);
    return B.motivoExclusion(B.normalBusq(nombre), nq, nq.split(/\s+/).filter(Boolean));
  };
  assert.equal(m("SSD Kingston 480GB para notebook", "ssd 480gb"), null);
  assert.equal(m("Notebook Lenovo 16GB SSD 512GB", "ssd 512gb"), "equipos");
  assert.equal(m("Notebook Lenovo 16GB SSD 512GB", "notebook lenovo"), null);
  assert.equal(m("HD SSD 960GB Kingston SIMIL 1TB", "ssd 1tb"), "similares");
  assert.equal(m("Silla gamer simil cuero negra", "silla"), null);
  assert.equal(m("Cable SATA para SSD", "ssd"), "accesorios");
  assert.equal(m("Cable SATA para SSD", "cable sata"), null);
  assert.equal(m("Disco rigido WD Blue 1TB", "ssd 1tb"), "tipo");
  assert.equal(m("SSD Kingston A400 1TB", "disco rigido 1tb"), "tipo");
  assert.equal(m("Memoria Kingston 16GB SODIMM", "memoria 16gb"), "formato");
  assert.equal(m("Memoria Kingston 16GB SODIMM", "memoria sodimm 16gb"), null);
  assert.equal(m("Placa de video RTX 3060 outlet", "rtx 3060"), "usados");
});

test("lo usado, reacondicionado o de caja abierta queda afuera salvo que se pida", () => {
  const m = (nombre, q, sellos) => {
    const nq = B.normalBusq(q);
    return B.motivoExclusion(B.normalBusq(nombre), nq, nq.split(/\s+/).filter(Boolean), sellos);
  };
  const tv = "Smart Tv Samsung 85 Qled Qn800d 8k (Nuevo con caja abierta)";
  assert.equal(m(tv, "tv samsung 85"), "usados");
  assert.equal(m("Notebook Samsung Galaxy Book 3 Pro 360 I7 512gb-caja Abierta", "notebook samsung"), "usados");
  assert.equal(m("Monitor Viewsonic 22 (Nuevo con caja abierta)", "monitor 22", ""), "usados");
  assert.equal(m(tv, "tv samsung 85 caja abierta"), null);
  assert.equal(m("Smart Tv Samsung 85", "tv samsung 85", "u"), "usados");          // lo dice la fuente (condition)
  assert.equal(m("Smart Tv Samsung 85", "tv samsung 85 usado", "u"), null);
  assert.equal(m("Smart Tv Samsung 85", "tv samsung 85", "oe"), null);
  assert.equal(m("Smart Tv Samsung 85", "tv samsung 85", 0), null);
});

test("esUsado mira el nombre y el sello u, y no confunde cajas con productos nuevos", () => {
  const fila = (nombre, sellos = "") => [nombre, 1, "https://t.test", "cy", "", 0, 0, "", sellos, ""];
  assert.equal(B.esUsado(fila("Laptop Dell Latitude 5440 (Nuevo con caja abierta)")), true);
  assert.equal(B.esUsado(fila("Notebook Samsung Galaxy Book 3 512gb-caja Abierta")), true);
  assert.equal(B.esUsado(fila("Iphone 14 Pro Max Reacondicionado")), true);
  assert.equal(B.esUsado(fila("Placa de video RTX 3060 outlet")), true);
  assert.equal(B.esUsado(fila("PlayStation 5 Slim Digital 1tb", "eu")), true);
  assert.equal(B.esUsado(fila("PlayStation 5 Slim Digital 1tb", "e")), false);
  assert.equal(B.esUsado(fila("Gabinete con caja de vidrio templado")), false);
  assert.equal(B.esUsado(fila("Memoria Kingston Fury 16GB")), false);
  assert.equal(B.esUsado([]), false);
});

test("las compras internacionales quedan afuera salvo que se pidan", () => {
  const m = (nombre, q, sellos) => {
    const nq = B.normalBusq(q);
    return B.motivoExclusion(B.normalBusq(nombre), nq, nq.split(/\s+/).filter(Boolean), sellos);
  };
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060", "ie"), "internacionales");
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060", "oe"), null);
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060"), null);
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060 importada", "i"), null);
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060 internacional", "i"), null);
  assert.equal(m("Notebook Lenovo 16GB", "ssd 512gb", "i"), "internacionales");
  // Filas de un indice viejo pueden traer otra cosa en el lugar de los sellos.
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060", 0), null);
  assert.equal(m("Placa de video RTX 4060 8GB", "rtx 4060", null), null);
});

test("sellosDe traduce las letras a sellos, en orden fijo", () => {
  assert.deepEqual(B.sellosDe("eoi"), [["ojo", "compra internacional"], ["conocida", "tienda oficial"],
    ["off2", "envío gratis"]]);
  assert.deepEqual(B.sellosDe("e"), [["off2", "envío gratis"]]);
  assert.deepEqual(B.sellosDe(""), []);
  assert.deepEqual(B.sellosDe(undefined), []);
  assert.deepEqual(B.sellosDe("qz"), []);      // una letra que no conocemos no sale
  assert.deepEqual(B.sellosDe("k"), [["ojo", "en seguimiento: menos de una semana de historial"]]);
});

test("sellosDe: el sello s avisa cuotas sin interes", () => {
  assert.deepEqual(B.sellosDe("s"), [["off2", "cuotas sin interés"]]);
  assert.deepEqual(B.sellosDe("es"), [["off2", "envío gratis"], ["off2", "cuotas sin interés"]]);
});

test("plusDe junta lo que suma a favor de un aviso: envio gratis y cuotas sin interes, en ese orden", () => {
  assert.deepEqual(B.plusDe("se"), ["envío gratis", "cuotas sin interés"]);
  assert.deepEqual(B.plusDe("e"), ["envío gratis"]);
  assert.deepEqual(B.plusDe("ios"), ["cuotas sin interés"]);        // lo internacional o usado no es un plus
  assert.deepEqual(B.plusDe(""), []);
  assert.deepEqual(B.plusDe(undefined), []);
  assert.deepEqual(B.plusDe(0), []);
});

test("sellosDe: el sello u avisa que es usado o de caja abierta", () => {
  assert.deepEqual(B.sellosDe("u"), [["ojo", "usado o caja abierta"]]);
  assert.deepEqual(B.sellosDe("ue"), [["ojo", "usado o caja abierta"], ["off2", "envío gratis"]]);
});

test("sellosDe: los sellos de la serie de precios (m, h, x)", () => {
  assert.deepEqual(B.sellosDe("m"), [["baja", "mínimo de 30 días"]]);
  assert.deepEqual(B.sellosDe("h"), [["baja", "mínimo de 90 días"]]);
  assert.deepEqual(B.sellosDe("x"), [["ojo", "subió antes de la oferta"]]);
  assert.deepEqual(B.sellosDe("mxe"), [["off2", "envío gratis"], ["baja", "mínimo de 30 días"],
    ["ojo", "subió antes de la oferta"]]);
});

test("categoriaDe es la primera palabra en singular", () => {
  assert.equal(B.categoriaDe("Auriculares Samsung Galaxy"), "auricular");
  assert.equal(B.categoriaDe("Monitores LG 27"), "monitor");
  assert.equal(B.categoriaDe("Memorias Kingston"), "memoria");
  assert.equal(B.categoriaDe("SSD Kingston"), "ssd");
  assert.equal(B.categoriaDe("Mouse Logitech"), "mouse");
});

/* --- Spec 014 PR 3: orden «Mejor oferta entre lo mejor» y «nada resta» --- */

test("el orden por defecto es «Mejor oferta» y Precio, Novedades y Premium siguen elegibles", () => {
  assert.equal(Modos.SECUNDARIO_BASE, "mejor");
  assert.deepEqual(Modos.SECUNDARIOS.map(s => s.id), ["mejor", "baja", "baja7", "baja31", "precio", "novedades", "premium"]);
  assert.equal(Modos.migrarSecundario(null), "mejor");
  assert.equal(Modos.migrarSecundario("precio"), "precio");
});

test("Mejor oferta: primero lo premium, dentro de eso lo mas nuevo y despues la mayor baja; lo internacional al final", () => {
  const ref = [f("Celular Samsung Galaxy S26 Ultra 16GB 1TB 144Hz OLED 200MP", 1), f("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED", 1)];
  const a = f("Celular Samsung Galaxy S26 Ultra 16GB 1TB 144Hz OLED 200MP", 2000000);                 // premium, ultima generacion, sin baja
  const b = f("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED", 1700000, { antes: 2000000 }); // premium, generacion anterior, bajo 15%
  const c = f("Celular Realme 11 8GB 256GB", 400000, { antes: 600000 });                              // no premium, bajo 33%
  const d = f("Celular Samsung Galaxy S25 Ultra 12GB 512GB 120Hz OLED 2", 1650000, { antes: 1700000, tienda: "mx" }); // misma generacion que b, baja 3%
  d[2] = "https://t.test/d"; d[6] = 1700000;
  const idx = { generado: "2026-10-19T10:00-03:00", productos: [...ref, a, b, c, d], tiendas: {} };
  const ctx = Modos.preparar(idx, nivel);
  const r = Modos.ordenar([c, d, b, a], "mejor", ctx);
  assert.deepEqual(r.map(x => x[1]), [2000000, 1700000, 1650000, 400000], "S26 primero (premium y nuevo); entre S25, la mayor baja; lo no premium al final");
  const inter = [...c]; inter[8] = "i";
  assert.equal(Modos.ordenar([inter, a], "mejor", ctx).pop()[8], "i");
});

test("notaDe: cada modo dice que deja afuera y cuanto", () => {
  assert.match(Modos.notaDe("recomendacion", 100, 60), /40 avisos más/);
  assert.doesNotMatch(Modos.notaDe("recomendacion", 100, 60), /Incluir/, "el piso de gama se mantiene: no hay control para saltearlo");
  assert.match(Modos.notaDe("super", 100, 7), /7 de 100/);
  assert.match(Modos.notaDe("primera", 100, 12), /premium.*12 de 100/);
  assert.equal(Modos.notaDe("recomendacion", 50, 50), "", "si no deja nada afuera no hay nota");
});

/* --- Spec 014 PR 4: Mayor baja y desempate por tiendas --- */

test("orden Mayor baja: el mayor % de baja contra el precio mas bajo de los 30 dias anteriores primero; sin baja, al final por precio", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const a = f("Celular Moto G15 6GB/128GB", 300000, { antes: 400000 }), b = f("Celular Moto G15 6GB/128GB azul", 500000, { antes: 530000 }), c = f("Celular Moto G15 6GB/128GB rojo", 700000);
  assert.deepEqual(Modos.ordenar([c, b, a], "baja", ctx).map(x => x[1]), [300000, 500000, 700000]);
  assert.ok(Modos.SECUNDARIOS.some(s => s.id === "baja" && /30 días anteriores/.test(s.ayuda)));
  assert.equal(Modos.migrarSecundario("baja"), "baja");
});

test("Mejor oferta: a igual nivel, novedad y baja, desempata el modelo que esta en mas tiendas", () => {
  const ctx = Modos.preparar(IDX, nivel);
  const a = f("Memoria Kingston Fury DDR5 16GB 6000MHz", 100000), b = f("Memoria Corsair Vengeance DDR5 16GB 6000MHz", 100000);
  ctx.tiendasDe = x => (x === b ? 4 : 1);
  assert.equal(Modos.ordenar([a, b], "mejor", ctx)[0], b);
});

test("Baja 7 días y Baja 31 días ordenan por su ventana; sin historia de la ventana queda al final", () => {
  // Columnas: nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo, desde, baja7, baja31
  const filas = [
    ["Sin historia", 100, "u1", "t", "", 0, 0, "", "", "", "", "", ""],
    ["Baja 5 y 40", 100, "u2", "t", "", 0, 0, "", "", "", "", 5, 40],
    ["Baja 20 y 10", 100, "u3", "t", "", 0, 0, "", "", "", "", 20, 10],
  ];
  const nombres = sec => Modos.ordenar(filas, sec, {}).map(f => f[0]);
  assert.deepEqual(nombres("baja7"), ["Baja 20 y 10", "Baja 5 y 40", "Sin historia"]);
  assert.deepEqual(nombres("baja31"), ["Baja 5 y 40", "Baja 20 y 10", "Sin historia"]);
});
