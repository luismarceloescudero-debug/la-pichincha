const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/* aria-selected solo vale en tab, option, row, gridcell, columnheader o rowheader (Lighthouse aria-allowed-attr).
   Un boton que se prende y se apaga, como los segmentos de orden, va con aria-pressed. */
const JS = path.join(__dirname, "../../js");
const fuentes = fs.readdirSync(JS).filter(f => f.endsWith(".js")).map(f => [f, fs.readFileSync(path.join(JS, f), "utf8")]);

test("ninguna etiqueta escrita en js/ lleva aria-selected sin un rol que lo admita", () => {
  for (const [f, s] of fuentes)
    for (const [etiqueta] of s.matchAll(/<[a-z]+\b[^<>]*aria-selected[^<>]*>/g))
      assert.match(etiqueta, /role="(tab|option|row|gridcell|columnheader|rowheader)"/, `${f}: ${etiqueta.slice(0, 120)}`);
});

test("los segmentos de orden y de Ofertas son botones de alternar", () => {
  const busqueda = fuentes.find(([f]) => f === "busqueda.js")[1], ofertas = fuentes.find(([f]) => f === "indice-ofertas.js")[1];
  assert.match(busqueda, /class="seg" data-orden="\$\{o\.id\}" aria-pressed=/);
  assert.match(busqueda, /class="seg" data-orden2="\$\{o\.id\}" aria-pressed=/);
  assert.match(ofertas, /class="seg" data-of="\$\{k\}:\$\{v\}" aria-pressed=/);
  assert.match(fs.readFileSync(path.join(__dirname, "../../css/sitio.css"), "utf8"), /\.seg\[aria-pressed="true"\]\{/);
});
