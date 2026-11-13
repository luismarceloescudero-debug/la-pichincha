/* El boton de copiado (herramientas/copiar-detalle.js) elige el bloque del detalle de la compra entre los de la pagina. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { elegir } = require("../../herramientas/copiar-detalle.js");

const DETALLE = "Detalle de la compra\nProductos (1) AR$ 371.667\nEnvío internacional AR$ 9.278\nServicios de importación AR$ 16.506\nTotal AR$ 397.451";
const PAGINA = "Mi carrito\nSoundcore AeroClip 2\nCantidad 1\nTotal AR$ 397.451\nIr a pagar\nSeguir comprando\nAyuda\nMi cuenta\nMis compras";

test("elige el bloque que dice «detalle de la compra», aunque otro bloque tambien tenga total", () => {
  assert.equal(elegir([PAGINA, DETALLE, "Menu\nInicio"]), DETALLE);
});

test("a igual puntaje gana el bloque mas corto (el mas cercano al detalle)", () => {
  const envoltorio = DETALLE + "\nRecomendados para vos\n" + "x".repeat(300);
  assert.equal(elegir([envoltorio, DETALLE]), DETALLE);
});

test("sin total o sin monto no hay detalle", () => {
  assert.equal(elegir(["Inicio\nOfertas\nCategorias de la tienda para comprar hoy mismo", "Total de productos en stock 12 unidades disponibles hoy"]), "");
});

test("descarta bloques enormes y vacios", () => {
  assert.equal(elegir([null, "", "Total AR$ 5", DETALLE + "y".repeat(5000)]), "");
});
