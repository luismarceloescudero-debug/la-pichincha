# Feature Specification: Una baja propia necesita una semana de seguimiento

**Created**: 2026-10-24

**Status**: Implementada.

**Input**: El mensaje de Telegram del 24/10 15:36 publico «Webcam Microsoft Studio Color Plateado: $269.300 (−53%) en Mercado
Libre». Mercado Libre entro como fuente el 23/10 (spec 026): el producto tenia un solo dia de historia ($578.998), y en
Mercado Libre el precio de cada dia es el del vendedor mas barato, que cambia. Lo mismo, la RTX 5090 de Venex («−14%»), que
la spec 032 ya frena por el piso de toda la ventana.

## Decision

- `serie.piso_previo` devuelve `None` si el producto se sigue hace menos de `DIAS_SEGUIMIENTO_BAJA` (7) dias: sin una semana
  de historia no se afirma una baja (principio II, sin historia suficiente no se afirma nada). Cuenta desde el primer
  registro del producto en el historial, con o sin huecos: exigir 7 dias seguidos dejaba afuera a las tiendas cuyo catalogo
  entra y sale (Carrefour).

## Ensayo en seco (indice del 24/10 15:36)

Bajas propias con el piso de 30 dias: 49; con una semana de seguimiento: 23. Las 26 que salen son productos recien
incorporados (Carrefour amplio su catalogo esta semana, Mercado Libre directo desde el 23/10) o bajas de centavos. Salen del
resumen la webcam Microsoft Studio y la webcam Genius; la guardia no da alarma.

## Tests

`tests/test_serie.py`: con menos de una semana no hay referencia, a los 7 dias si. `tests/test_indexar_corrida.py`: un dia
de historia no da baja propia; los tests de bajas siguen al producto 8 dias.
