/* Guardia del error LA-PICHINCHA-4: importScripts falla en dispositivos con red inestable y el
   worker muere sin responder. El codigo tiene que envolver importScripts en try-catch y definir
   self.onmessage de todas formas para que la pagina reciba {ok:false} y haga enHilo(). */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs   = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ofertas-worker.js"), "utf8");

test("ofertas-worker: importScripts esta dentro de un try-catch (LA-PICHINCHA-4)", () => {
  assert.match(src, /try\s*\{[^}]*importScripts/,
    "importScripts debe estar dentro de try { ... } para que un fallo de red no mate al worker sin respuesta");
});

test("ofertas-worker: self.onmessage se define siempre, incluso si importScripts falla", () => {
  assert.match(src, /self\.onmessage\s*=/,
    "self.onmessage tiene que asignarse fuera del bloque try (siempre se ejecuta)");
  // Verifica que onmessage este despues del catch (no anidado dentro del try)
  const tryEnd = src.indexOf("} catch");
  const onmsgIdx = src.lastIndexOf("self.onmessage");
  assert.ok(onmsgIdx > tryEnd,
    "self.onmessage debe definirse despues del bloque try/catch, no dentro del try");
});

test("ofertas-worker: responde {ok:false} si los scripts no cargaron", () => {
  assert.match(src, /if\s*\(!\s*_ok\)\s*return\s*self\.postMessage\(\s*\{\s*ok:\s*false\s*\}\s*\)/,
    "debe haber un guard que responda {ok:false} cuando _ok es false");
});
