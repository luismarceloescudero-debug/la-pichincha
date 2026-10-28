# Spec 042: pegar el detalle de la compra en los cuatro proveedores

## Problema

El dueño (28/10/2026): la sección «¿Ya lo encontraste? Pegá el link» de «Buscalo afuera» «debería ser igual para los 3 o
4 proveedores que salgan, como en Tiendamia.com.ar, que te permite pegar el detalle, como en los artefactos de los
carritos. Unificar criterios en general».

Hoy (spec 041) solo la ficha de un link de Tiendamia trae el campo «Pegá el detalle de la compra de Tiendamia», y lo que
muestra es una línea de texto. Amazon, eBay y Loquieroacá no tienen campo.

## Qué se decide

- **El mismo bloque para los cuatro**: link, lectura del Worker cuando se pueda (como hasta ahora), botones («Abrir en …»,
  y en Tiendamia «El mismo en Amazon») y un campo **«Pegá el detalle de la compra»**. Cambia solo la ayuda: dónde se copia
  el detalle en cada tienda.
- **El mismo desglose para los cuatro**, en una tabla con siempre las mismas filas: **Producto, Envío, Importación o
  servicios, Impuestos, Envío local, Total y Total en pesos**. Lo que no aparece en lo pegado vale 0.
- **Total en pesos**: si lo pegado está en pesos (Tiendamia, Loquieroacá) es el total. Si está en dólares o euros (Amazon,
  eBay) dice **«sin cotización»** hasta que haya una cotización del día (spec 043): no se convierte con un valor viejo sin
  decirlo.
- En Tiendamia sigue, debajo de la tabla, la cuenta de Amazon al dólar de Tiendamia (spec 041, `referenciaCarrito`).
- Todo se lee en el navegador: lo pegado no se envía a ningún lado.

## Un parser por proveedor

Todos devuelven la misma forma: `{ tienda, moneda, cantidad, producto, envio, importacion, impuestos, envioLocal, total,
totalLeido, otros, notas }`.

| Proveedor | Parser | Fixture real | De dónde |
|---|---|---|---|
| Amazon.com | `parsearDetalleAmazon` | **sí** (`tests/fixtures/detalle/amazon-2026-10-28.txt`) | checkout con AmazonGlobal que pegó el dueño el 28/10/2026 |
| Tiendamia | `parsearDetalleTiendamia` (spec 041) | **sí** (los 23 carritos de `datos/tiendamia-cargos.json`) | «Detalle de la compra» del carrito |
| eBay | `parsearDetalleEbay` | **no: sin fixture real** | — |
| Loquieroacá | `parsearDetalleLoquieroaca` | **no: sin fixture real** | — |

El texto real de Amazon (una línea por concepto):

```
Productos: US$168.99
Envío y manejo: US$27.10
Promoción de envío GRATIS: -US$27.10
Cálculo estimado de impuestos por cobrar: US$0.00
Cargos de importación: US$41.46
Total del pedido: US$210.45
```

Amazon, eBay y Loquieroacá usan la misma lectura tolerante (`detallePorRotulos`): cada monto con su moneda (US$, US $,
U$S, USD, AR$, ARS, EUR, € antes o después; un `$` solo es dólar en Amazon y eBay y peso en Loquieroacá) y el rótulo que
lo precede en su renglón (o después de la última barra). El rótulo va a una fila por **palabras clave**, no por rótulos
inventados: total (no «subtotal» ni «total parcial»), importación/aduana/aranceles/servicios, impuestos/IVA/tax, envío a tu
dirección/local, envío/shipping/manejo, producto/artículo/item. Para eBay y Loquieroacá no se vio un pegado real: se pide
uno en `docs/pendientes-del-dueno.md` (pendiente 12) y, cuando llegue, se suma como fixture.

## Requisitos funcionales

- **R1** `fichaEnlaceHtml` de un link de Amazon (EE.UU., otro país o link corto), eBay, Tiendamia o Loquieroacá trae
  `<label for="pl-carrito">Pegá el detalle de la compra</label>`, el `<textarea id="pl-carrito">`, una ayuda propia de la
  tienda que termina en «Se lee acá, en tu navegador: no se envía a ningún lado.» y el lugar del desglose.
- **R2** `parsearDetalleAmazon(textoReal)` da producto 168,99, envío 0 (27,10 − 27,10 de la promoción), impuestos 0,
  importación 41,46, total 210,45 leído, y una nota con la promoción ya descontada. En un renglón con « / » da lo mismo.
- **R3** Si falta el total, es la suma; si el total leído no da con la suma (más del 1 % o de 1 unidad), una nota lo dice.
  Un rótulo que no va a ninguna fila queda en `otros`, dentro del total, y una nota lo nombra. Sin producto, `null`.
- **R4** `numeroFlexible` lee «1.234,56», «1,234.56», «168.99» y «371.667» (el último separador con 3 cifras es de miles).
- **R5** `filasDetalle(d, cotizacion)` devuelve siempre las 7 filas en el mismo orden; «Total en pesos» es el total en
  pesos, o el total por `cotizacion.valor` con la cotización citada (nombre, hora y fuente), o «sin cotización».
- **R6** `detalleHtml` escapa todo lo pegado (los rótulos se muestran tal cual se pegaron).

## Criterios de éxito

- Pegar el texto real de Amazon debajo de un link de Amazon muestra la tabla con US$ 210,45 de total.
- Pegar el carrito del AeroClip 2 debajo del link de Tiendamia muestra la tabla con AR$ 397.451 y la línea de Amazon aprox.
  AR$ 343.443.
- `node --test "tests/js/*.test.js"` en verde (salvo el skip-link por CRLF en Windows local).

## Fuera de alcance

- La conversión a pesos de lo que está en dólares o euros (spec 043).
- Leer el checkout de cualquier tienda desde el Worker.
- Rótulos en inglés de Amazon: no se vio un checkout en inglés; la lectura por palabras clave los cubre en parte.
