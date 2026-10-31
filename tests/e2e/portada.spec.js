const { test, expect, vigilar } = require("./base");

test("la portada abre sin errores de consola ni pedidos fallidos", async ({ page }) => {
  const problemas = vigilar(page);
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Comparativa" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#vista")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(problemas).toEqual([]);
});

test("las pestañas se recorren con el teclado (flechas, Inicio, Fin) y el foco se ve", async ({ page }) => {
  await page.goto("/");
  const pestanas = page.getByRole("tablist").getByRole("tab");
  await expect(pestanas).toHaveText([/Comparativa/, /Ofertas/, /Buscar/, /Veredicto/]);

  // Tabindex itinerante: solo la elegida entra con Tab.
  await expect(page.getByRole("tab", { name: "Comparativa" })).toHaveAttribute("tabindex", "0");
  await expect(page.getByRole("tab", { name: "Ofertas" })).toHaveAttribute("tabindex", "-1");

  await page.getByRole("tab", { name: "Comparativa" }).focus();
  await page.keyboard.press("ArrowRight");
  const ofertas = page.getByRole("tab", { name: "Ofertas" });
  await expect(ofertas).toBeFocused();
  // Activacion manual: mover el foco no cambia la vista hasta apretar Enter.
  await expect(page.getByRole("tab", { name: "Comparativa" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(ofertas).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#vista")).toHaveAttribute("aria-labelledby", "tab-ofertas");

  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Buscar" })).toBeFocused();
  await page.keyboard.press("End");
  const veredicto = page.getByRole("tab", { name: "Veredicto" });
  await expect(veredicto).toBeFocused();
  await page.keyboard.press("ArrowRight");        // da la vuelta
  await expect(page.getByRole("tab", { name: "Comparativa" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(veredicto).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "Comparativa" })).toBeFocused();

  // El foco se ve: contorno propio de al menos 2 px.
  const contorno = await page.getByRole("tab", { name: "Comparativa" }).evaluate(el => {
    const e = getComputedStyle(el);
    return { estilo: e.outlineStyle, ancho: parseFloat(e.outlineWidth) };
  });
  expect(contorno.estilo).not.toBe("none");
  expect(contorno.ancho).toBeGreaterThanOrEqual(2);
});

test("«Pegá el link» con un texto cualquiera dice que no reconoce el link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Buscar" }).click();
  await page.locator("#q").fill("rtx 5060");
  const link = page.locator("#pl-link");
  await expect(link).toBeVisible();
  await link.fill("hola, esto no es un link");
  await link.press("Enter");
  await expect(page.locator("#pl-res")).toContainText("No reconozco ese link");
});
