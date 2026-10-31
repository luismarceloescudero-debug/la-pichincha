// Pruebas de punta a punta (spec 051): solo en la CI y en la maquina de quien desarrolla; nada llega al sitio.
// Corren contra el sitio ya armado en _sitio, servido por un servidor estatico propio (sin dependencias).
const { defineConfig, devices } = require("@playwright/test");

const PUERTO = 8091;

module.exports = defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.js",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node tests/e2e/servidor.js ${PUERTO}`,
    url: `http://localhost:${PUERTO}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
