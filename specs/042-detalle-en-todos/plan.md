# Plan — Spec 042: pegar el detalle de la compra en los cuatro proveedores

El «qué» está en `spec.md`.

## 1. La lectura común (R2–R4)

- `js/importar.js`: `numeroFlexible`, `parejas` (rótulo + monto, con la moneda antes o después y el signo de la promoción),
  `CLASES` (palabras clave por fila, en orden) y `detallePorRotulos(tienda, texto, monedaDelPesoSolo)`.
- `parsearDetalleAmazon`, `parsearDetalleEbay`, `parsearDetalleLoquieroaca` sobre esa lectura; `detalleTiendamia` pasa
  `parsearDetalleTiendamia` (spec 041) a la forma común; `parsearDetalle(tienda, texto)` elige.
- Tests en `tests/js/detalle.test.js` con los fixtures reales de Amazon (28/10), eBay y Loquieroacá (29/10, que sumaron
  leer desde «Resumen del pedido» y el renglón «xN») y casos tolerantes.

## 2. Las filas y la tabla (R5, R6)

- `filasDetalle(d, cotizacion)` y `detalleHtml(d, { esc, cotizacion, item })`; en Tiendamia, `referenciaCarrito` debajo.
- CSS `.pl-detalle` en `css/sitio.css` (total y total en pesos en negrita; «sin cotización» apagado).

## 3. El campo en las cuatro fichas (R1)

- `fichaEnlaceHtml`: `carritoHtml(tienda)` con la ayuda de `AYUDA_DETALLE`.
- `js/vista-afuera.js`: guarda el link en pantalla (`ENLACE_ACTUAL`) y pinta `detalleHtml` con el parser de su tienda.
  `cotizacionPara` queda en `null` hasta la spec 043.

## 4. Verificación

- Navegador local (`python -m http.server`): bloque pintado con `Importar.buscarAfueraHtml`, link de Amazon con el texto
  real y link de Tiendamia con el carrito del AeroClip 2 (el Worker leyó la ficha en vivo).
