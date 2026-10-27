# Plan — Spec 041: Amazon que envía a Argentina y los cargos reales de Tiendamia

TDD: test que falla, código mínimo, test en verde y commit chico. El «qué» está en `spec.md`.

## 1. Amazon: el aviso en vez de un filtro (R1)

- `js/importar.js` `FUENTES[amazon].texto`: «Muchos productos no se envían a Argentina: elegí «Enviar a: Argentina» arriba
  y Amazon muestra solo los que sí. El envío y los impuestos los pagás vos: revisá el total antes de pagar.»
- Test: la URL de búsqueda sigue igual (sin `rh=`) y el texto nombra «no se envían a Argentina».

## 2. La línea leída sin el «17 % más» (R5)

- `leidoDeEnlace`: la línea de Tiendamia dice el precio y, si hay `precioBase`, «En Amazon figura a US$ M»; y que el envío
  internacional y los servicios de importación se ven en el carrito.
- `js/afuera.js`: el aviso de Tiendamia ya no dice «con envío incluido».
- Tests de `importar.test.js` y `afuera.test.js` ajustados.

## 3. El parser y la línea del carrito (R2, R3)

- `js/importar.js`: `parsearDetalleTiendamia(texto)` y `referenciaCarrito(detalle, item)`, puras. El texto se normaliza
  (sin tildes, minúsculas); cada rótulo toma el primer `AR$` que le sigue.
- Tests con el texto real del dueño y variantes (sin tildes, todo en una línea, decimales, cantidad 2, basura).

## 4. El campo debajo de la ficha (R4)

- `fichaEnlaceHtml`: si la tienda es Tiendamia, suma un `<textarea id="pl-carrito">` con su rótulo y un
  `<p class="pl-carrito-res">`.
- `js/vista-afuera.js`: guarda el último `item` leído de Tiendamia; al escribir en `#pl-carrito`, pinta
  `referenciaCarrito`.
- Prueba en el navegador con una copia del sitio en el scratchpad.

## 5. La base de cargos (R6)

- `datos/tiendamia-cargos.json` con el ejemplo del AeroClip 2 (ficha leída: price, merchant_price, markup, weight).
- `tests/js/tiendamia-cargos.test.js`: forma y cuentas.
- `specs/041-cargos-tiendamia/datos.md`: tabla y lo que se ve (con una sola entrada, nada todavía).

## 6. Mail y links por categoría

- `docs/pendientes-del-dueno.md`: pendiente 10, el mail para Tiendamia (lo manda el dueño).
- Un link de `tiendamia.com.ar/search/amazon/...` por categoría con un producto real (ficha leída).

## 7. Docs y cierre

- README, `docs/mapa.md`, memoria `importado-referencia-tiendamia`. PR, CI, merge con rebase, limpieza.
