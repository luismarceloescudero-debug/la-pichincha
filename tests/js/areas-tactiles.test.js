// Plan v4, auditoria A3 y A10: los botones se tocan con el dedo (48 px) y el precio pesa mas que el porcentaje.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "..", "..", "css", "sitio.css"), "utf8");
const regla = (sel) => css.split("\n").find((l) => l.startsWith(sel + "{")) || "";
const rem = (txt, re) => { const m = txt.match(re); return m ? parseFloat(m[1]) : NaN; };

test("pestanas, segmentos y enlaces de 'mismo modelo' miden al menos 48 px", () => {
  assert.match(regla(".tab"), /min-height:48px/);
  assert.match(regla(".seg"), /min-height:48px/);
  assert.match(css, /\.mismo a\{display:inline-flex;align-items:center;min-height:48px/);
});

test("en las tarjetas de oferta el precio es mas grande que el porcentaje en cada nivel", () => {
  const pct = { normal: /\.ocard\.n-normal \.o-off b\{font-size:([\d.]+)rem\}$/m, fuerte: /\.ocard\.n-fuerte \.o-off b\{font-size:([\d.]+)rem\}$/m, heroe: /^\.ocard\.n-heroe \.o-off b\{font-size:([\d.]+)rem;color:var\(--a1\)\}/m };
  const precio = { normal: /^\.ocard\.n-normal \.o-precios \.ahora\{font-size:([\d.]+)rem/m, fuerte: /^\.ocard\.n-fuerte \.o-precios \.ahora\{font-size:([\d.]+)rem/m, heroe: /^\.ocard\.n-heroe \.o-precios \.ahora\{font-size:([\d.]+)rem;letter/m };
  for (const nivel of ["normal", "fuerte", "heroe"]) {
    const p = rem(css, precio[nivel]), d = rem(css, pct[nivel]);
    assert.ok(p > d, `${nivel}: precio ${p}rem debe superar al porcentaje ${d}rem`);
  }
});
