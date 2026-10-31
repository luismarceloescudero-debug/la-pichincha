const { test, expect } = require("./base");

const RUTAS = ["/", "/hoy/", "/acerca/", "/contacto/", "/legal/"];
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
