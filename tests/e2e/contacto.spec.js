const { test, expect } = require("./base");

async function llenar(page, campos) {
  if (campos.correo !== undefined) await page.getByLabel("Tu correo").fill(campos.correo);
  if (campos.motivo) await page.getByLabel("Motivo").selectOption(campos.motivo);
  if (campos.mensaje !== undefined) await page.getByLabel("Mensaje", { exact: true }).fill(campos.mensaje);
}

test.describe("formulario de contacto (el envío está simulado, no sale nada)", () => {
  let enviados;
  test.beforeEach(async ({ page }) => {
    enviados = [];
    await page.route("**/contacto", async ruta => {
      if (ruta.request().method() !== "POST") return ruta.fallback();
      const d = ruta.request().postDataJSON();
      enviados.push(d);
      // Como el Worker: un envio demasiado rapido lo rechaza el servidor.
      if (d.espera < 3000) {
        await ruta.fulfill({ status: 429, contentType: "application/json",
          body: JSON.stringify({ ok: false, error: "Enviaste el mensaje demasiado rápido. Esperá unos segundos y probá de nuevo." }) });
        return;
      }
      await ruta.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/contacto/");
    await expect(page.locator("#campos")).toBeEnabled();
  });

  test("un correo inválido no se envía", async ({ page }) => {
    await llenar(page, { correo: "esto-no-es-un-correo", motivo: "consulta", mensaje: "Un mensaje de prueba largo" });
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.locator("#error-correo")).toContainText("no parece una dirección válida");
    await expect(page.getByLabel("Tu correo")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Tu correo")).toBeFocused();
    expect(enviados).toHaveLength(0);
  });

  test("un mensaje corto no se envía", async ({ page }) => {
    await llenar(page, { correo: "persona@ejemplo.com", motivo: "consulta", mensaje: "hola" });
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.locator("#error-mensaje")).toContainText("muy corto");
    await expect(page.locator("#estado")).toContainText("muy corto");
    expect(enviados).toHaveLength(0);
  });

  test("un envío demasiado rápido lo rechaza el servidor y el formulario lo dice", async ({ page }) => {
    await llenar(page, { correo: "persona@ejemplo.com", motivo: "consulta", mensaje: "Un mensaje de prueba largo" });
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.locator("#estado")).toContainText("demasiado rápido");
    await expect(page.locator("#estado")).toHaveClass(/mal/);
    await expect(page.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
    expect(enviados).toHaveLength(1);
  });
});
