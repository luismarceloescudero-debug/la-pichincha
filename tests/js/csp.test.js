"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { conHashes, hash } = require("../../csp.js");

const META = c => `<meta http-equiv="Content-Security-Policy" content="${c}">`;
const cspDe = html => /http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)[1];
const scriptSrc = html => cspDe(html).split("; ").find(d => d.startsWith("script-src"));

test("el hash es el sha256 en base64 del texto, con los fines de linea como los deja el navegador", () => {
  assert.equal(hash(""), "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
  assert.equal(hash("a\r\nb"), hash("a\nb"));
});

test("script-src deja 'unsafe-inline' y suma un hash por script en linea que corre", () => {
  const html = META("default-src 'self'; script-src 'self' 'unsafe-inline' https://x.com; style-src 'self' 'unsafe-inline'") +
    '<script>uno()</script><script defer src="js/a.js"></script><script type="application/json">[1]</script>' +
    '<script type="application/ld+json">{}</script><script id="c">dos()</script>';
  const s = scriptSrc(conHashes(html));
  assert.equal(s, `script-src 'self' https://x.com ${hash("uno()")} ${hash("dos()")}`);
  // style-src no se toca
  assert.match(cspDe(conHashes(html)), /style-src 'self' 'unsafe-inline'$/);
});

test("un manejador en linea suma 'unsafe-hashes' con su hash", () => {
  const html = META("script-src 'self'") + `<link rel="stylesheet" href="f.css" media="print" onload="this.media='all'">`;
  assert.equal(scriptSrc(conHashes(html)), `script-src 'self' 'unsafe-hashes' ${hash("this.media='all'")}`);
});

test("rehacerlo despues de cambiar un script reemplaza los hashes viejos (idempotente)", () => {
  const una = conHashes(META("script-src 'self'") + "<script>a()</script>");
  assert.equal(conHashes(una), una);
  const otra = conHashes(una.replace("a()", "b()"));
  assert.equal(scriptSrc(otra), `script-src 'self' ${hash("b()")}`);
});

test("sin meta de CSP, la pagina queda igual", () => {
  assert.equal(conHashes("<script>a()</script>"), "<script>a()</script>");
});

test("index.html del repo ya lleva los hashes de sus scripts (si no: python actualizar.py --build)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  assert.equal(conHashes(html), html);
  assert.doesNotMatch(scriptSrc(html), /'unsafe-inline'/);
});
