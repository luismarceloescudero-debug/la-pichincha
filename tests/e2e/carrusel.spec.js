// Comparativa en el celular (14/11): una tarjeta grande por pantalla, con gestos y etiquetas flotantes (js/carrusel.js).
const { test, expect } = require("./base");

test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/?q=rtx%205060#comparativa");
  await expect(page.locator("[data-car-card]").first()).toBeVisible();
});

test("una tarjeta entera entra en la pantalla, con sus botones y la barra flotante a la vista", async ({ page }) => {
  const caja = await page.locator("[data-car-card]").first().boundingBox();
  const flota = await page.locator(".car-flota").boundingBox();
  expect(caja.y + caja.height).toBeLessThanOrEqual(flota.y);
  expect(flota.y + flota.height).toBeLessThanOrEqual(915);
  const recortada = await page.locator("[data-car-card]").first().evaluate(el => el.scrollHeight > el.clientHeight);
  expect(recortada).toBe(false);
  await expect(page.locator(".car-card .car-precio").first()).toBeVisible();
  await expect(page.locator("[data-car-card] [data-car-seguir]").first()).toBeVisible();
});

test("seguir con el boton se guarda en este celular y se ve en Seguidos", async ({ page }) => {
  await page.locator("[data-car-seguir]").first().click();
  await expect(page.locator("[data-car-seguidos]")).toContainText("1");
  await page.locator('[data-car-ir="seguidos"]').click();
  await expect(page.locator(".car-seg-item")).toHaveCount(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pichincha.seguidos")).length)).toBe(1);
});

test("las etiquetas flotantes cambian de seccion y la ficha se abre y se cierra con Escape", async ({ page }) => {
  await page.locator('[data-car-ir="diferencias"]').click();
  await expect(page.locator('[data-car-vista="diferencias"]')).toBeVisible();
  await expect(page.locator('[data-car-vista="tarjetas"]')).toBeHidden();
  await page.locator('[data-car-ir="tarjetas"]').click();
  await page.locator("[data-car-ficha]").first().click();
  await expect(page.locator("[data-car-hoja]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-car-hoja]")).toBeHidden();
});
