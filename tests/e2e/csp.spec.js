// CSP sin 'unsafe-inline' en script-src (auditoria B1): cada script en linea corre por su hash (csp.js). Si un script, un
// manejador en linea o un origen queda afuera de la politica, el navegador lo bloquea y avisa con securitypolicyviolation:
// estas pruebas fallan ante el primero, en la portada, en una busqueda y en /hoy/.
const { test, expect } = require("./base");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__violaciones = [];
    document.addEventListener("securitypolicyviolation", e =>
      window.__violaciones.push(`${e.effectiveDirective} ${e.blockedURI || "inline"} ${e.sourceFile || ""}:${e.lineNumber || ""}`));
  });
});

async function sinViolaciones(page, consola) {
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => window.__violaciones)).toEqual([]);
  expect(consola).toEqual([]);
}

const avisosCsp = page => {
  const lista = [];
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) lista.push(m.text()); });
  return lista;
};

test("la portada corre sus scripts sin violar la CSP", async ({ page }) => {
  const consola = avisosCsp(page);
  await page.goto("/");
  // Los modulos que agrega el cargador ya corrieron: la pestaña Buscar responde.
  await page.getByRole("tab", { name: "Buscar" }).click();
  await expect(page.locator("#q")).toBeVisible();
  await sinViolaciones(page, consola);
});

test("/?q=ram busca (indice temprano y modulos) sin violar la CSP", async ({ page }) => {
  const consola = avisosCsp(page);
  await page.goto("/?q=ram");
  // La busqueda arma la Comparativa con los modulos ya cargados.
  await expect(page.getByRole("heading", { level: 2, name: "Comparativa: ram" })).toBeVisible();
  await sinViolaciones(page, consola);
});

test("/hoy/ carga sin violar la CSP", async ({ page }) => {
  const consola = avisosCsp(page);
  await page.goto("/hoy/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pichinchas");
  await sinViolaciones(page, consola);
});

test("la politica de la portada no deja correr un script en linea sin hash", async ({ page }) => {
  await page.goto("/");
  const corrio = await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__inyectado = true";
    document.body.appendChild(s);
    return window.__inyectado === true;
  });
  expect(corrio).toBe(false);
  expect(await page.evaluate(() => window.__violaciones.length)).toBeGreaterThan(0);
});

test("el cargador no se deja pisar por otro elemento con id «modulos» (DOM clobbering)", async ({ page }) => {
  const pedidos = [];
  page.on("request", r => pedidos.push(new URL(r.url()).pathname));
  // Un elemento anterior con el mismo id: getElementById("modulos") lo devolveria a el y cargaria su lista.
  await page.route(/localhost:\d+\/$/, async ruta => {
    const r = await ruta.fetch();
    const html = (await r.text()).replace("<main", '<div id="modulos" hidden>["js/ajeno.js"]</div><main');
    await ruta.fulfill({ response: r, body: html });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Buscar" }).click();
  await expect(page.locator("#q")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(pedidos).toContain("/js/arranque.js");
  expect(pedidos).not.toContain("/js/ajeno.js");
});
