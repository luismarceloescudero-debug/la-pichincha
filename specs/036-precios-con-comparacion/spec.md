# Feature Specification: Una pagina de precios compara de verdad

**Created**: 2026-10-24

**Status**: Implementada.

**Input**: squirrelscan (spec 033) marco la descripcion de `/precios/rtx-4060/`: «15 opciones de rtx 4060 en 1 comercios: desde
$750.000, mediana $2.337.789». Las 33 opciones eran de Mercado Libre por ComparaYa (las tiendas locales ya no venden la
RTX 4060), de $689.532 a $7.197.998, y mezclaba la RTX 4060 con la 4060 Ti y con notebooks («Portátil Gamer Acer Nitro V…
Rtx 4060»).

## Decisiones

- **Otra version del chip es otra placa** (`Buscador.motivoExclusion`, motivo `variante`): buscando «rtx 4060» no entra la
  «rtx 4060 ti»; «rx 9070» no trae la «rx 9070 xt». Buscando la version («rtx 4060 ti») si entra. Usa `gpuDe`, el mismo chip
  que ya leian las especificaciones. La comparativa lo cuenta: «N de otra versión del chip (Ti, Super, XT)».
- **«Portátil» es un equipo completo**, como «Notebook» o «Laptop» (`REGLAS_EXCLUSION`, `equipos`).
- **Una pagina de `/precios/` con un solo comercio no se indexa** (`generar_paginas.js`, `MIN_COMERCIOS = 2`, el mismo minimo
  que ya pedia `generar_consultas.js` a las automaticas): sale del sitemap y del indice `/precios/`, lleva `noindex` y dice
  «Hoy las opciones comparables de «…» están en un solo comercio (…), así que no hay con qué comparar».

## Ensayo en seco (indice del 24/10 15:36)

200 paginas generadas: 198 indexables. Salen `rtx-4060` y `rtx-4070` (todo Mercado Libre via ComparaYa).

## Tests

`tests/js/generador.test.js`: con un solo comercio no es indexable y lo dice. Los datos de prueba de `generador`,
`feed-pagina` y `test_generar_paginas.py` pasan a dos comercios.
