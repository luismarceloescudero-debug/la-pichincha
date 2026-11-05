const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../../js/al-ver.js");

/* Un documento y una ventana de mentira: alcanza para ver que clases pone y que mira. */
function falso({ reducir = false, conIO = true } = {}) {
  const clases = () => { const s = new Set(); return { add: c => s.add(c), contains: c => s.has(c), s }; };
  const tarjetas = [1, 2].map(() => ({ classList: clases() }));
  const doc = { documentElement: { classList: clases() }, body: {}, querySelectorAll: () => tarjetas };
  const mirados = [];
  let avisar;
  const win = {
    matchMedia: () => ({ matches: reducir }),
    MutationObserver: function () { this.observe = () => {}; },
  };
  if (conIO) win.IntersectionObserver = function (cb) { avisar = cb; this.observe = el => mirados.push(el); this.unobserve = () => {}; };
  return { win, doc, tarjetas, mirados, entra: el => avisar([{ isIntersecting: true, target: el }]) };
}

test("marca anima en <html>, mira cada tarjeta y le pone en-vista al entrar en pantalla", () => {
  const f = falso();
  assert.equal(A.iniciar(f.win, f.doc), true);
  assert.ok(f.doc.documentElement.classList.contains("anima"));
  assert.equal(f.mirados.length, 2);
  f.entra(f.tarjetas[0]);
  assert.ok(f.tarjetas[0].classList.contains("en-vista"));
  assert.ok(!f.tarjetas[1].classList.contains("en-vista"));
});

test("con «reducir movimiento» o sin IntersectionObserver no anima: todo queda quieto y a la vista", () => {
  for (const op of [{ reducir: true }, { conIO: false }]) {
    const f = falso(op);
    assert.equal(A.iniciar(f.win, f.doc), false);
    assert.ok(!f.doc.documentElement.classList.contains("anima"));
  }
});

test("la portada y /hoy/ cargan el script, y el service worker lo guarda", () => {
  const raiz = path.join(__dirname, "..", "..");
  assert.match(fs.readFileSync(path.join(raiz, "index.html"), "utf8"), /<script src="js\/al-ver\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(raiz, "generar_feed.js"), "utf8"), /<script src="\.\.\/js\/al-ver\.js"><\/script>/);
  assert.ok(require("../../sw.js").CASCARA.includes("js/al-ver.js"));
});

test("/hoy/: las pastillas llenas llevan letra negra (con la tinta clara del cartel no se leian)", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "generar_feed.js"), "utf8");
  assert.match(css, /\.hoy \.historia \.tit-chips \.tit-chip:not\(\.pr\)\{color:#120018/);
});
