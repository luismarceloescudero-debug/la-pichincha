# Spec 063: comparativa por características, Veredicto fiel y fotos

**Estado**: hecha el 08/11/2026 (fases A–E). **Origen**: revisión del dueño del 08/11 sobre «Celular Motorola Signature»,
Notebooks, Teclado Razer, «monitor qhd 240hz» y «Aero».

## Problemas

1. Las tarjetas de la Comparativa no mostraban las mismas características: un Ryzen 7 salía en una y en la vecina no.
   Causa: tarjetas y tabla usaban `Buscador.specsDe` (genérico, de memorias y monitores) y la comparación usaba
   `Especificaciones.clavesDe` (CPU, RAM, disco). Los periféricos no tenían esquema.
2. «Comparar» desde una tarjeta buscaba el texto del modelo: solo encontraba el mismo producto en otras tiendas, o ninguno.
3. El Veredicto no representaba la última búsqueda: si esa búsqueda no tenía resultados comparables, `pintarResultados` borraba
   la consulta y el Veredicto caía al historial, donde podía quedar un fragmento («Aero» guardado 1,2 s después de tipear).
   Una búsqueda ambigua mezclaba tipos de producto (notebooks Gigabyte Aero y auriculares Soundcore).
4. Las tarjetas no tenían foto: se sacaron del índice en la spec 057 y solo se conservaron las de Ofertas.

## Qué hace

- **A. Ficha única** (`js/especificaciones.js`, `fichaDe`): una lista de especificaciones por categoría, con etiqueta, igual en
  tarjetas y tabla. Lo que el título no dice sale «no informa»; lo que ninguna tarjeta dice no se muestra.
- **B. Periféricos**: auriculares, teclados, mouse, webcams y parlantes se distinguen por el título (aunque no empiece con la
  palabra) y tienen sus especificaciones. Una funda, un combo o un mousepad no cuentan. Con una sola especificación ya se puede comparar.
- **C. Comparar por características**: con una tarjeta de referencia se busca en todo el índice por categoría y especificaciones
  (`Especificaciones.igualesA`, `buscarPorEspecificaciones`). Con menos de 3 exactas se suman las cercanas (una cifra a la mitad o al
  doble) y se dice. La tarjeta elegida queda marcada («La que elegiste») o se agrega. El precio por tienda no se repite donde hay una
  sola tienda ni desde Ofertas. La referencia viaja en la URL (`?ref=`).
- **D. Veredicto**: `ULTIMA_ESCRITA` manda sobre el historial; sin resultados se dice y se ofrece la anterior. Los fragmentos tipeados
  no se acumulan. Una búsqueda que junta tipos de producto deja elegir uno (`soloCategoria`). Los textos de exclusión dependen del
  producto, y el Veredicto dice qué especificaciones tiene y cuáles no dice el aviso ganador.
- **E. Fotos**: `adelgazar_indice.js` parte todas las fotos en 64 rebanadas (`imagenes/N.json`, por `Pagina.rebanadaFoto`) y la página
  baja solo las de las tarjetas que muestra (`pintarFotos`). Sin foto, queda el icono.

## Lo que no hace

- «Buscalo afuera» y «Afuera, en vivo» siguen buscando el texto crudo (traducir a inglés y usar marca, modelo y especificaciones queda
  para otra spec).
- No cambia qué se considera «mejor compra».

## Pruebas

`tests/js/comparativa-fichas.test.js` (A, B y C), `tests/js/especificaciones.test.js` (B), `tests/js/veredicto-ultima.test.js` (D),
`tests/js/fotos-comparativa.test.js` (E). Verificado además en Chromium con el índice de pruebas (e2e): comparar desde una tarjeta,
URL con `?ref=`, tarjetas con foto y Veredicto sin errores de JS.
