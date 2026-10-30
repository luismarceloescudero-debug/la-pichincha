const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/* Un script que se baja de un CDN tiene que llegar con su hash (SRI): si el CDN lo cambia, el navegador no lo corre. */
const JS = path.join(__dirname, "../../js");

test("todo script que js/ baja de un CDN lleva integrity y crossorigin", () => {
  const conCdn = fs.readdirSync(JS).filter(f => f.endsWith(".js"))
    .map(f => [f, fs.readFileSync(path.join(JS, f), "utf8")])
    .filter(([, s]) => /https:\/\/cdnjs\.cloudflare\.com\/[^"']+\.js/.test(s));
  assert.ok(conCdn.length > 0, "se esperaba al menos ExcelJS");
  for (const [f, s] of conCdn) {
    assert.match(s, /\.integrity = "sha(384|512)-[A-Za-z0-9+/]{60,}={0,2}"|\.integrity = [A-Z_]+_SRI/, `${f} sin integrity`);
    assert.match(s, /\.crossOrigin = "anonymous"/, `${f} sin crossOrigin`);
  }
});

test("el hash de ExcelJS es el de cdnjs para la version que se pide", () => {
  const s = fs.readFileSync(path.join(JS, "exportar.js"), "utf8");
  assert.match(s, /exceljs\/4\.4\.0\/exceljs\.min\.js/);
  assert.match(s, /"sha512-dlPw\+ytv\/6JyepmelABrgeYgHI0O\+frEwgfnPdXDTOIZz\+eDgfW07QXG02\/O8COfivBdGNINy\+Vex\+lYmJ5rxw=="/);
});
