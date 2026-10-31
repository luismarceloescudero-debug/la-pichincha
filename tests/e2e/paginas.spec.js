const { test, expect, vigilar } = require("./base");

test("/hoy/ carga con su título y sin errores", async ({ page }) => {
  const problemas = vigilar(page);
  await page.goto("/hoy/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pichinchas");
  await page.waitForLoadState("networkidle");
  expect(problemas).toEqual([]);
});

test("/acerca/ carga y no tiene textos pendientes", async ({ page }) => {
  const problemas = vigilar(page);
  await page.goto("/acerca/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Acerca de La Pichincha");
  await expect(page.locator("body")).not.toContainText("[COMPLETAR]");
  await page.waitForLoadState("networkidle");
  expect(problemas).toEqual([]);
});
