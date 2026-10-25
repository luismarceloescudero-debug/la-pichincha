# Spec 038: lo que se sigue hace menos de una semana entra «en seguimiento» (desde el primer registro anterior)

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

- `serie.piso_corto`: con entre **1 y 6 días** de seguimiento (cualquier registro anterior), el menor precio registrado (sin
  proyectar nada). Sin registro anterior (producto nuevo) o con una semana o más, no hay: con una semana manda `piso_previo` y
  la referencia pasa a ser la de los 30 días anteriores, sola, sin nada que descartar. (El 25/10 el dueño pidió bajar el mínimo
  de tres días a uno: «si hoy un precio de Mercado Libre está por debajo, es una oferta, con historial corto pero una oferta».)
- `indexar.py`: esa baja se guarda como baja propia (`antes`) con el sello **`k`** en la columna `sellos`. El tachado de las
  tiendas no cambia: solo cuenta con la semana (spec 035).
- `js/ofertas.js`: lo que lleva `k` no entra en `propias` sino en **`seguimiento`**, y **no pasa de 40 %** de baja
  (`DESCUENTO_SEGUIMIENTO_MAX`): con tan poca historia, una baja mayor casi siempre es el precio de otro vendedor.
- `destacadas` lo trata como una baja propia (`ORDEN_TIPO`: propia y seguimiento, modelo, publicada): compite por su descuento y
  su gama con las bajas verificadas. Lo que lo distingue es el rótulo, no el lugar. En la pestaña Ofertas también va junto a
  las bajas, con su propio segmento «En seguimiento».
- **Cómo se dice**: el canal de Telegram, el RSS y `/hoy/` lo rotulan «desde que lo seguimos, hace pocos días» y no lo tachan
  como «antes»; la pestaña Ofertas lo muestra en su propio segmento, «En seguimiento», con la cinta «bajó desde que lo
  seguimos» y la aclaración de que todavía no alcanza para decir que bajó contra sus 30 días. «Súper Oferta» no lo incluye.
- La guardia no lo cuenta como oferta verificada.

## Ensayo en seco

Simulando la corrida del 24/10 con el historial de ese día: **22 candidatas** (9 de Carrefour, 5 de Mercado Libre, 3 de
ComparaYa, 2 de Gaming City, 2 de Maxtecno y 1 de OnCity), todas con bajas de 8 % a 16 %, dentro del tope de 40 %. Mercado
Libre y Carrefour cumplen la semana entre el 29 y el 30/10; desde entonces es la rutina de siempre (`piso_previo`) y esto
queda para los productos nuevos de cada día.

## Tests

`tests/test_serie.py` (`PisoCorto`: de 1 a 6 días sí; 7 días, lo de hoy o nada no; el día 7 es de `piso_previo`),
`tests/test_indexar_corrida.py` (sello `k` con 1 y con 4 días, ninguno con 8 ni en un producto nuevo), `tests/js/ofertas.test.js` (aparte de las propias, tope
de 40 %, orden), `tests/js/ofertas-ui.test.js` (el segmento y la cinta), `tests/js/feed.test.js` (Telegram, RSS y `/hoy/`) y
`tests/js/buscador.test.js` (el sello `k`).
