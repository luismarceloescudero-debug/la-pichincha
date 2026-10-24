# Feature Specification: La baja propia se mide contra el precio mas bajo de los 30 dias anteriores

**Created**: 2026-10-24

**Status**: Implementada. Sale en la proxima corrida.

**Input**: El resumen del 23/10 (22:06), ya con el arreglo de la spec 028, seguia publicando como pichincha la «Mother MSI
PRO Z790-P WIFI DDR5 – LGA 1700» de SCP Hardstore a $363.975 con «−41%». El historial dice otra cosa: $360.453 el 16/10,
$361.627 el 19/10, $362.801 el 21/10, $621.600 el 22/10 (un solo dia) y $363.975 el 23/10. No bajo: volvio a su precio,
$1.174 arriba del 21/10, y seis tiendas mas la venden entre $371.200 y $426.959. El dueño, con la spec 028: «esto no
puede pasar; pierde credibilidad la app, si hay errores tan groseros».

## Causa

`indexar.py` guardaba como «antes» (`f[6]`) el ultimo precio de antes de hoy. Una tienda que sube el precio un dia y lo
vuelve a bajar fabrica una baja propia del tamaño de la suba, y como la baja propia no tiene tope (el 60% es solo para
el tachado), la de 41% paso entera. Lo mismo, mas disimulado: la RTX 5060 Windforce Max de The Gamer Shop ($842.800 el
17/10, $1.000.900 el 22/10, $837.600 el 23/10) salia con «−16%» por 0,6% real.

## Decisiones

- **La referencia es el piso de 30 dias** (`serie.piso_previo`), como la directiva europea Omnibus para los anuncios de
  rebaja: el precio mas bajo que tuvo el aviso en los 30 dias anteriores a hoy. Cuenta cada precio registrado aunque haya
  durado una sola corrida, y el que estaba vigente al empezar la ventana. Lo de hoy no cuenta (una corrida anterior del
  mismo dia no es «antes», como en la spec del 18/10).
- **Baja propia solo si hoy esta por debajo de ese piso**, y el «antes» que se guarda y se muestra es el piso: el
  porcentaje es la baja contra el mejor precio reciente, no contra una suba.
- Un aviso que dejo de publicarse y volvio sigue contando como nuevo: la ventana arranca cuando volvio.
- Los minimos por categoria (`C.DESCUENTO[...].propia`) no cambian: se aplican sobre la baja medida asi.
- Los textos que decian «contra el relevamiento anterior» (Mayor baja, Ofertas, consulta y analisis) dicen ahora «contra
  su precio más bajo de los 30 días anteriores».

## Ensayo en seco (indice y historial publicados el 23/10 22:06)

- Bajas propias: 469 → 361. 108 eran volver al precio de antes de una suba; a 79 mas les cambia el porcentaje.
- Salen del resumen: la MSI Z790-P (−41%), la HP ProDesk 4 Ultra 5 de OnCity (−9% contra $2.370.652, pero el 22/10 habia
  estado a $2.010.581; ademas se veia casi igual a la Ultra 7 de al lado) y la RTX 5060 de The Gamer Shop.
- Entran la HP Pro Mini 260 G9 de The Gamer Shop (−6%) y un gabinete externo Cooler Master (−15%). El monitor ViewSonic
  queda con −7% contra $424.250 (antes −8% contra $428.396). Siguen saliendo 40 destacadas para verificar.

## Tests

`tests/test_serie.py` (`PisoPrevio`): la suba de un dia de la MSI no es la referencia, un precio de una sola corrida
cuenta, lo de hoy no, la ventana de 30 dias con el precio vigente, el aviso que volvio, sin historial no hay referencia.
`tests/test_indexar_corrida.py`: volver al precio de siempre despues de una suba no es baja, y la baja se mide contra el
piso.
