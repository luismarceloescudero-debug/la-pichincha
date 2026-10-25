# Spec 038: lo que se sigue hace menos de una semana entra «en seguimiento»

**Created**: 2026-10-25

**Status**: Implementada.

**Input**: El dueño quiere que no quede nada afuera mientras un producto reúne su semana de historial (spec 034): propuso
proyectar el mismo valor de referencia una semana hacia atrás para cumplir el mínimo, y recalcular sobre la primera pichincha
cuando pase la semana real.

## Qué no se hizo y por qué

Proyectar el primer precio hacia atrás es afirmar que el producto costó lo mismo toda la semana, y no se midió. Es lo que hacía
el sistema antes de la spec 034 y de ahí salieron la webcam Microsoft Studio «−53%» (un día de historia en Mercado Libre, donde
el precio es el del vendedor más barato y cambia) y la RTX 5090 «−14%». Rompe el principio II (sin historia suficiente no se
afirma nada) y la base de Omnibus (el precio más bajo de los 30 días anteriores, de verdad).

## Decisión

Se cuenta lo que se midió y se dice que es poco:

- `serie.piso_corto`: con entre **3 y 6 días** de seguimiento, el menor precio registrado (sin proyectar nada). Con menos de
  tres días, o con una semana o más, no hay: con una semana manda `piso_previo` y la referencia pasa a ser la de los 30 días
  anteriores, sola, sin nada que descartar.
- `indexar.py`: esa baja se guarda como baja propia (`antes`) con el sello **`k`** en la columna `sellos`. El tachado de las
  tiendas no cambia: solo cuenta con la semana (spec 035).
- `js/ofertas.js`: lo que lleva `k` no entra en `propias` sino en **`seguimiento`**, y **no pasa de 40 %** de baja
  (`DESCUENTO_SEGUIMIENTO_MAX`): con tan poca historia, una baja mayor casi siempre es el precio de otro vendedor.
- `destacadas` lo ordena **al final** (`ORDEN_TIPO`: propia, modelo, publicada, seguimiento): solo ocupa un lugar cuando su
  rubro no tiene algo verificado, y nunca pasa adelante de una oferta verificada aunque su descuento sea mayor.
- **Cómo se dice**: el canal de Telegram, el RSS y `/hoy/` lo rotulan «desde que lo seguimos, hace pocos días» y no lo tachan
  como «antes»; la pestaña Ofertas lo muestra en su propio segmento, «En seguimiento», con la cinta «bajó desde que lo
  seguimos» y la aclaración de que todavía no alcanza para decir que bajó contra sus 30 días. «Súper Oferta» no lo incluye.
- La guardia no lo cuenta como oferta verificada.

## Ensayo en seco

Con el índice y el historial del 24/10 no hay candidatas: Mercado Libre y Carrefour llevan 2 días y esta regla pide 3. Empieza
a dar resultados desde el 26/10 y los productos de Mercado Libre cumplen la semana el 30/10, así que cubre la ventana del 26 al
30/10 y después es la rutina de siempre (`piso_previo`).

## Tests

`tests/test_serie.py` (`PisoCorto`: de 3 a 6 días sí; 2 días, 7 días o lo de hoy no; el día 7 es de `piso_previo`),
`tests/test_indexar_corrida.py` (sello `k` con 4 días, ninguno con 8), `tests/js/ofertas.test.js` (aparte de las propias, tope
de 40 %, orden), `tests/js/ofertas-ui.test.js` (el segmento y la cinta), `tests/js/feed.test.js` (Telegram, RSS y `/hoy/`) y
`tests/js/buscador.test.js` (el sello `k`).
