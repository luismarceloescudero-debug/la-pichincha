const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../../generar_reel.js");

const DATOS = { generado: "2026-10-29T13:08-03:00", ofertas: [
  { nombre: "Celular Samsung Galaxy A17 5g Gray 8/256gb 6.7''", precio: 669999, antes: 769999, descuento: 13, comercio: "Naldo" },
  { nombre: "SSD </script><b>x</b>", titulo: "KINGSTON NV2", chips: ["1 TB"], icono: "disco", precio: 90000, antes: 120000, descuento: 25,
    comercio: "Compra<Gamer>", contra: "bajo la mediana de otras 3 tiendas" }] };

test("el estilo depende solo del dia y cambia de un dia al siguiente", () => {
  assert.deepEqual(R.estilo("2026-10-30"), R.estilo("2026-10-30"));
  const dias = ["2026-10-30", "2026-10-31", "2026-11-01"].map(d => R.estilo(d));
  assert.equal(new Set(dias.map(e => e.paleta.nombre)).size, 3);
  assert.equal(new Set(dias.map(e => e.fondo)).size, 3);
});

test("cada oferta lleva el nombre legible: el de ofertas.json o, si no viene, el de js/titulo.js", () => {
  const [a, b] = R.ofertasReel(DATOS);
  assert.equal(a.titulo, "SAMSUNG GALAXY A17");
  assert.deepEqual(a.chips, ["8/256 GB", "5G", "6.7″"]);
  assert.equal(a.icono, "celular");
  assert.equal(b.titulo, "KINGSTON NV2");
  assert.equal(b.contra, "bajo la mediana de otras 3 tiendas");
  assert.equal(R.ofertasReel({ ofertas: Array(14).fill(DATOS.ofertas[0]) }).length, 10);
});

test("la pagina es 1080x1920, trae los datos sin poder cerrar el script y dura intro + ofertas + cierre", () => {
  const html = R.paginaReel(DATOS);
  assert.match(html, /width:1080px;height:1920px/);
  assert.ok(!html.includes("</script><b>"));
  assert.ok(html.includes("Compra\\u003cGamer>"));   // el «<» de un comercio va escapado en el JSON
  assert.match(html, /window\.pintar = pintar/);
  assert.equal(R.duracion(10), R.MS.intro + 10 * R.MS.oferta + R.MS.cierre);
});

test("sin ofertas no arma nada y no falla", async () => {
  const fs = require("fs"), os = require("os"), path = require("path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reel-"));
  fs.writeFileSync(path.join(dir, "o.json"), JSON.stringify({ ofertas: [] }));
  assert.equal(await R.main([path.join(dir, "o.json"), "--salida", dir]), 0);
  assert.equal(fs.existsSync(path.join(dir, "instagram")), false);
  assert.equal(await R.main([path.join(dir, "o.json"), "--salida", dir, "--solo-html"]), 0);
});

test("cada dia cambia tambien la letra, el ritmo y la disposicion; la duracion sigue al ritmo", () => {
  const dias = ["2026-10-30", "2026-10-31", "2026-11-01"].map(d => R.estilo(d));
  assert.equal(new Set(dias.map(e => e.letra.nombre)).size, 3);
  assert.equal(new Set(dias.map(e => e.ritmo.nombre)).size, 3);
  assert.notEqual(dias[0].disposicion, dias[1].disposicion);
  const html = R.paginaReel(DATOS);
  assert.match(html, /fonts\.googleapis\.com\/css2\?family=/);
  assert.match(html, /<body class="disp-(tarjeta|plena)">/);
  const r = R.estilo("2026-10-29").ritmo;
  assert.equal(R.duracion(10, r), r.intro + 10 * r.oferta + r.cierre);
});

test("la foto de la tienda entra solo si es https limpia", () => {
  const o = (imagen) => R.ofertasReel({ ofertas: [{ ...DATOS.ofertas[0], imagen }] })[0].imagen;
  assert.equal(o("https://img.test/a.jpg"), "https://img.test/a.jpg");
  assert.equal(o("http://img.test/a.jpg"), "");
  assert.equal(o('https://img.test/a".jpg'), "");
  assert.equal(o("https://img.test/a).jpg"), "");
});

test("el titulo del Reel es marca y nombre, sin codigos de modelo; las caracteristicas van al segundo titulo", () => {
  const R2 = require("../../generar_reel.js");
  assert.equal(R2.sinCodigos("SAMSUNG ODYSSEY G8 G81SF", "monitor"), "SAMSUNG ODYSSEY G8");
  assert.equal(R2.sinCodigos("LENOVO LEGION 5 15AKP10", "notebook"), "LENOVO LEGION 5");
  assert.equal(R2.sinCodigos("LENOVO LOQ ESSENTIAL 15ARP11", "notebook"), "LENOVO LOQ ESSENTIAL");
  // nombres de linea, chipsets y la primera palabra no son codigos
  assert.equal(R2.sinCodigos("KINGSTON KC600", "disco"), "KINGSTON KC600");
  assert.equal(R2.sinCodigos("LOGITECH M190", "mouse"), "LOGITECH M190");
  assert.equal(R2.sinCodigos("GIGABYTE B860M E", "mother"), "GIGABYTE B860M E");
  // si sacar el codigo deja una sola palabra, se le suma el tipo
  assert.equal(R2.sinCodigos("GIGABYTE GO27Q24A", "monitor"), "GIGABYTE MONITOR");
  const [a] = R2.ofertasReel({ ofertas: [{ nombre: "Monitor Gamer Samsung Odyssey G8 G81SF 27\" UHD 4K QD-OLED 240Hz", precio: 1, antes: 2, descuento: 50, comercio: "X" }] });
  assert.equal(a.titulo, "SAMSUNG ODYSSEY G8");
  assert.deepEqual(a.chips, ["27″", "4K", "QD-OLED", "240 Hz"]);
  const html = R2.paginaReel({ generado: "2026-10-30T09:00-03:00", ofertas: [{ nombre: "SSD Kingston 1TB", precio: 1, antes: 2, descuento: 50, comercio: "X" }] });
  assert.match(html, /<p class="sub2"><\/p>/);
  assert.doesNotMatch(html, /class="chip"/);
});

/* --- v4 (04/11): mas lento, colores combinados, numeros enormes y la super oferta --- */
const luz = hex => { const c = hex.match(/\w\w/g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contraste = (a, b) => { const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("v4: cada paleta combina tres acentos y todos se leen sobre los dos tonos de la tarjeta (>= 3:1)", () => {
  for (const p of R.PALETAS) {
    assert.equal(new Set([p.acento, p.acento2, p.acento3]).size, 3, p.nombre);
    for (const fondo of ["tarjeta", "tarjeta2"])
      for (const k of ["tinta", "acento", "acento2", "acento3"])
        assert.ok(contraste(p[k], p[fondo]) >= 3, `${p.nombre}: ${k} sobre ${fondo} = ${contraste(p[k], p[fondo]).toFixed(2)}`);
    for (const k of ["acento2", "acento3"])
      assert.ok(contraste(p.sobre, p[k]) >= 3, `${p.nombre}: sobre en ${k} = ${contraste(p.sobre, p[k]).toFixed(2)}`);
  }
});

test("v4: mas lento que la v3 (2,3-3,1 s por oferta, ~29 s): cada ritmo deja la tarjeta mas tiempo", () => {
  for (const r of R.RITMOS) assert.ok(r.oferta > 3100 && r.paso > 1, r.nombre);
  assert.ok(R.duracion(10, R.RITMOS[0]) > 40000);
  const html = R.paginaReel(DATOS, { ritmo: "agil" });
  assert.match(html, /"paso":1\.5/);
});

test("v4: la super oferta es la de mayor descuento si llega al 20 %, una sola, y dura mas por su tipeo", () => {
  const o = (descuento, chips = ["27″", "4K", "QD-OLED"]) => ({ nombre: "Monitor X", titulo: "SAMSUNG ODYSSEY G8", chips, icono: "monitor", precio: 1, antes: 2, descuento, comercio: "X" });
  const lista = R.ofertasReel({ ofertas: [o(30), o(45), o(45), o(10)] });
  assert.deepEqual(lista.map(x => x.super), [false, true, false, false]);
  assert.equal(R.superDe(R.ofertasReel({ ofertas: [o(19), o(12)] })), -1);
  const s = lista[1];
  assert.equal(s.tipeo, R.tipeoDe(s.chips));
  assert.equal(R.tipeoDe(["A"]), 600);                       // con pocas letras no se espera de mas
  assert.equal(R.tipeoDe(["x".repeat(80)]), R.TIPEO);       // ni se pasa del tope
  const r = R.RITMOS[1];
  assert.deepEqual(R.tiempos(lista, r), [r.oferta, r.oferta + Math.round(s.tipeo * r.paso), r.oferta, r.oferta]);
  assert.equal(R.duracion(lista, r), r.intro + 4 * r.oferta + Math.round(s.tipeo * r.paso) + r.cierre);
  const html = R.paginaReel({ generado: "2026-11-04T10:00-03:00", ofertas: [o(30), o(45)] });
  assert.match(html, /<i class="s"><b><\/b><\/i>/);           // su barra va con el color de la super oferta
  assert.match(html, /SÚPER OFERTA/);
  assert.match(html, /<span class="h">HASTA<\/span><span class="sig">−<\/span><span class="num">45<\/span><span class="por">%<\/span>/);
});

test("v4: las caracteristicas premium se marcan (las que brillan en la super oferta)", () => {
  for (const c of ["QD-OLED", "4K", "240 Hz", "RTX 5070", "Ryzen AI 7 350", "Core i7", "Core Ultra 9", "DDR5", "2 TB", "32 GB RAM", "Mecánico", "15.1″ OLED 165 Hz"])
    assert.ok(R.chipPremium(c), c);
  for (const c of ["8/256 GB", "FHD", "IPS", "75 Hz", "RTX 3050", "Core i5", "DDR4", "512 GB SSD", "16 GB RAM", "SODIMM", "CL22", "7.1"])
    assert.ok(!R.chipPremium(c), c);
  const [a] = R.ofertasReel({ ofertas: [{ nombre: "x", chips: ["27″", "QD-OLED"], titulo: "A B", icono: "monitor", precio: 1, antes: 2, descuento: 5, comercio: "X" }] });
  assert.deepEqual(a.premium, [false, true]);
});
