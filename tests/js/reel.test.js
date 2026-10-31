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
