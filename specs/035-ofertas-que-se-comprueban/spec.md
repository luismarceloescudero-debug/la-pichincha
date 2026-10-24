# Feature Specification: Las ofertas del dia son las que se pueden comprobar

**Created**: 2026-10-24

**Status**: Implementada.

**Input**: Con las specs 032 y 034 aplicadas, 8 de las 10 ofertas del dia del 24/10 eran precios tachados de Mercado Libre
(directos o por ComparaYa) de 33% a 58%: Poco M8 Pro «−56%», teclado Gadnic «−58%», auriculares Havit «−57%»... de productos
que seguiamos hacia 2 o 3 dias. El dueño, con la spec 028: «pierde credibilidad la app, si hay errores tan groseros».

## Causa

- El «precio anterior» de Mercado Libre lo pone cada vendedor; la verificacion del 19/10 ya lo habia visto poco confiable.
- ComparaYa trae el tachado de cada tienda sin la regla de esa tienda: el de Carrefour u OnCity leidas directo no cuenta
  (`lista_es_oferta: false`) y el mismo tachado via ComparaYa si contaba.
- La señal que se puede comprobar, **el mismo modelo mas barato que en otras tiendas** (`contraModelo`: codigo exacto, 3
  tiendas o mas, el minimo de su categoria bajo la mediana de las otras, sin dispersion rara), estaba en la pestaña Ofertas
  pero el resumen del dia (`destacadas`: /hoy/, RSS, Telegram) no la usaba.

## Decisiones

- **Tachado con la regla Omnibus** (`indexar.py`): un tachado se guarda solo si seguimos el producto hace una semana
  (`DIAS_SEGUIMIENTO_BAJA`) y hoy esta en su precio mas bajo de los 30 dias anteriores (`serie.piso_previo`).
- **El tachado de ComparaYa o de Mercado Libre no es una oferta** (`O.calcularOfertas`). Sus bajas propias y la comparacion
  contra otras tiendas siguen valiendo.
- **`destacadas` suma el tipo `modelo`**, con la mediana de las otras tiendas como referencia (`o.antes`, `o.modelo`). Orden:
  baja propia, el mismo modelo, tachado. El feed, `/hoy/` y Telegram lo dicen: «$66.700 (−24% bajo la mediana de otras 3
  tiendas) en The Gamer Shop».
- **Guardia**: cuenta las tres señales por categoria y lleva la version de las reglas (`reglas: "035"`); con otra version, la
  cantidad por categoria no se compara con la corrida anterior (los smartphones pasan de 41 a 0 a proposito: eran todos
  tachados de Mercado Libre o ComparaYa).

## Ensayo en seco (indice del 24/10 15:36, con la spec 034)

Tachados que se guardan: 2.348 → 1.025. El resumen del dia queda con 8 ofertas contra el mismo modelo en otras tiendas (Lenovo
Legion 5, HP ProBook, Samsung Odyssey G8 y G5, ViewSonic VX2718, RTX 5070 Ti, router ASUS, mouse pad Corsair) y 2 bajas
propias (Core i5 14400F e i7 14700F de Venex). Guardia sin alarmas, 40 destacadas.

## Tests

`tests/js/ofertas.test.js`: el tachado del agregador y de Mercado Libre no es oferta y el de una tienda directa si; `destacadas`
suma el mismo modelo con la mediana como referencia. `tests/test_indexar_corrida.py`: el tachado cuenta con una semana de
seguimiento y en el precio mas bajo. `tests/js/guardia.test.js`: con otras reglas no se compara por categoria.
`tests/test_publicar_telegram.py`: la oferta contra el mismo modelo dice contra que se compara.
