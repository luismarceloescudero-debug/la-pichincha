const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { reintentos } = require("../e2e/reintentos.js");

// Auditoria 17/11, punto 2: tests.yml lo llama la publicacion diaria (actualizar.yml, construir needs tests) y sin reintentos
// una prueba intermitente dejaba el dia sin publicar. En un PR sigue sin reintentos (N-T1: no tapar la intermitencia).
// Dentro de un workflow_call, GITHUB_EVENT_NAME es el evento del llamador (schedule, workflow_dispatch o push).
test("en un PR o en la PC no hay reintentos; en la publicacion, uno", () => {
  assert.equal(reintentos("pull_request"), 0);
  assert.equal(reintentos(undefined), 0);
  assert.equal(reintentos(""), 0);
  for (const evento of ["schedule", "workflow_dispatch", "push"]) assert.equal(reintentos(evento), 1, evento);
});

test("playwright.config.js toma los reintentos del evento de GitHub", () => {
  const config = fs.readFileSync(path.join(__dirname, "..", "..", "playwright.config.js"), "utf8");
  assert.match(config, /retries:\s*reintentos\(process\.env\.GITHUB_EVENT_NAME\)/);
  assert.doesNotMatch(config, /retries:\s*0\b/);
});
