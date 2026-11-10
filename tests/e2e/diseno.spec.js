const { test, expect } = require("./base");

const RUTAS = ["/", "/hoy/", "/acerca/", "/contacto/", "/legal/", "/nada-xyz/", "/precios/no-existe/"];   // las dos ultimas: la 404
const ANCHOS = [375, 1440];
const TEMAS = { light: "claro", dark: "oscuro" };

const medidas = page => page.evaluate(() => ({
  ancho: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth }));

for (const ancho of ANCHOS) {
  for (const [esquema, nombre] of Object.entries(TEMAS)) {
    test(`sin scroll horizontal a ${ancho} px en tema ${nombre}`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.emulateMedia({ colorScheme: esquema });
      for (const ruta of RUTAS) {
        await page.goto(ruta);
        await expect(page.locator("main, #vista").first()).toBeVisible();
        const m = await medidas(page);
        expect(m.ancho, `${ruta} desborda a la derecha`).toBeLessThanOrEqual(m.visible);
      }
    });
  }
}

test("la búsqueda tampoco desborda a 375 px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Buscar" }).click();
  await page.locator("#q").fill("rtx 5060");
  await expect(page.locator("#res a.fila").first()).toBeVisible();
  const m = await medidas(page);
  expect(m.ancho).toBeLessThanOrEqual(m.visible);
});

test("los enlaces del pie miden 24 px de alto: se tocan con el dedo", async ({ page }) => {
  // Auditoria del 10/11 (A1): median 17 px. WCAG 2.5.8 exime a los enlaces que van dentro de una frase, pero en un
  // celular los legales (estado, terminos, contacto, acerca) se buscan con el dedo y se tocaban mal.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const enlaces = page.locator(".nota a");
  const cuantos = await enlaces.count();
  expect(cuantos).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < cuantos; i++) {
    const caja = await enlaces.nth(i).boundingBox();
    expect(Math.round(caja.height), `el enlace ${i} mide ${Math.round(caja.height)} px`).toBeGreaterThanOrEqual(24);
  }
});

test("una direccion que no existe muestra la 404 del sitio, con la marca y el camino a la portada", async ({ page }) => {
  const r = await page.goto("/precios/no-existe/");
  expect(r.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  await page.getByRole("link", { name: "Ir a la portada" }).click();
  await expect(page).toHaveURL(/\/$/);
});
