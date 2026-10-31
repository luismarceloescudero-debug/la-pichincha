const { test, expect } = require("./base");

// Esta es la unica prueba que deja registrar el service worker: las demas lo bloquean para no cachear nada.
test.use({ serviceWorkers: "allow" });

test("después de una visita, la portada abre sin conexión desde el service worker", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // La cascara se guarda al instalar: se espera a que la portada y el indice esten en la cache.
  await expect.poll(() => page.evaluate(async () => {
    for (const k of await caches.keys()) {
      const c = await caches.open(k);
      if ((await c.match("index.html")) && (await c.match("indice.json"))) return true;
    }
    return false;
  })).toBe(true);
  // Recarga para que la pagina quede controlada por el service worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("tab", { name: "Comparativa" })).toBeVisible();
  await expect(page.locator("#vista")).toBeVisible();
  await expect(page.getByText(/Sin conexión/)).toBeVisible();

  // Y una búsqueda con el índice guardado anda.
  await page.getByRole("tab", { name: "Buscar" }).click();
  await page.locator("#q").fill("rtx 5060");
  await expect(page.locator("#res a.fila").first()).toBeVisible();
});
