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
