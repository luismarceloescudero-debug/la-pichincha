const { test, expect, pesos } = require("./base");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Buscar" }).click();
  await page.locator("#q").fill("rtx 5060");
  await expect(page.locator("#estado")).toContainText("avisos");
});

test("buscar «rtx 5060» devuelve filas", async ({ page }) => {
  const filas = page.locator("#res a.fila");
  await expect(filas.first()).toBeVisible();
  expect(await filas.count()).toBeGreaterThan(3);
  await expect(page.locator("#res .tit-nom").first()).toContainText(/RTX 5060/i);
});

test("se puede ordenar por precio", async ({ page }) => {
  const boton = page.locator('[data-orden2="precio"]');
  await boton.click();
  await expect(boton).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-orden2="mejor"]')).toHaveAttribute("aria-pressed", "false");
  // Las compras internacionales van siempre al final, marcadas: el orden por precio vale para el resto.
  const nacionales = page.locator("#res a.fila:not(:has(.sello.ojo)) .pre");
  const precios = (await nacionales.allTextContents()).map(pesos);
  expect(precios.length).toBeGreaterThan(3);
  expect(precios).toEqual([...precios].sort((a, b) => b - a));
});

test("se puede filtrar por tienda y volver a quitar el filtro", async ({ page }) => {
  const antes = await page.locator("#res a.fila").count();
  await page.locator("#filtros summary").click();
  const tienda = page.locator('[data-filtro="tienda"][data-valor="venex"]');
  await tienda.click();
  await expect(tienda).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#estado")).toContainText("ocultos por los filtros");
  expect(await page.locator("#res a.fila").count()).toBeLessThan(antes);
  await expect(page.locator("#res a.fila .tie").first()).toHaveText("Venex");
  await page.locator('[data-filtro="quitar"]').click();
  await expect(page.locator("#res a.fila")).toHaveCount(antes);
});
