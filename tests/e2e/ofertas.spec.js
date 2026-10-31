const { test, expect } = require("./base");

test("una tarjeta de oferta se abre con el teclado y la estrella se marca", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Ofertas" }).click();
  const tarjeta = page.locator("article.ocard").first();
  await expect(tarjeta).toBeVisible();

  // El nombre es un boton con aria-expanded que controla el detalle.
  const abrir = tarjeta.locator("button.o-abrir");
  await expect(abrir).toHaveAttribute("aria-expanded", "false");
  await abrir.focus();
  await page.keyboard.press("Enter");
  await expect(abrir).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#" + (await abrir.getAttribute("aria-controls")))).toBeVisible();
  await page.keyboard.press("Space");
  await expect(abrir).toHaveAttribute("aria-expanded", "false");

  // La estrella se marca con el teclado, anuncia su estado y deja una oferta en «Marcadas».
  const estrella = tarjeta.locator("button.o-star");
  await expect(estrella).toHaveAttribute("aria-pressed", "false");
  await estrella.focus();
  await page.keyboard.press("Enter");
  await expect(estrella).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-of="marcadas:1"] .n')).toHaveText("1");
});
