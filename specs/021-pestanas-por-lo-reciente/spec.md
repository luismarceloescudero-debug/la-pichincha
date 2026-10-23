# Spec 021: las pestañas salen de lo reciente, no del primer relevamiento

**Created**: 2026-10-23

**Status**: Implementada

**Input**: Revisión del dueño del sitio publicado (23/10/2026): «en Comparativa, al final siguen saliendo las primeras
búsquedas, y no solo lo reciente; Tiendas, ¿no es redundante esa pestaña?; Veredicto sigue ligado a las primeras búsquedas»;
y «agregar borrar o limpiar búsquedas con la animación de un pacman, demonio de Tasmania, etc.».

## Qué pasaba

Sin una búsqueda activa, Comparativa, Tiendas y Veredicto volvían al **análisis curado del primer relevamiento**: memorias
DDR4 16 GB y webcams, con productos fijos en `datos.json` y textos escritos a mano en `js/vistas.js` (`vistaTiendas` con
«Las 3 webs que mejor pagan la calidad», `vistaVeredicto` con la ADATA XPG D35 y el combo RAM + webcam). La tira de la
Comparativa ofrecía esas dos categorías como «análisis a fondo» antes que las búsquedas de la persona. Tiendas, con una
búsqueda, repetía lo que la Comparativa ya mostraba en «Precio por tienda».

## Decisión

1. **Comparativa sin búsqueda**: lo más buscado, lo más vendido y las novedades (sin cambios), y al final **tus últimas
   búsquedas** (la tira, sin las curadas) y la comparativa corta de **la más reciente que todavía trae resultados**
   (`recienteHtml`: sus opciones y un botón a la completa). Se calcula aparte: mirar la portada no fija la consulta ni
   cambia la URL. Sin historial, la tira invita a buscar. El índice solo se baja si hay búsquedas guardadas (la portada
   no lo espera: CONSTRAINTS A3).
2. **Veredicto sin búsqueda**: espera el índice y se escribe con la búsqueda más reciente (`consultaReciente`); sin
   historial, con la primera de «Lo más buscado» que tenga resultados, y el cartel dice «Armado con lo más buscado». Sin
   nada, invita a buscar. Lleva un botón a «Dónde conviene comprar».
3. **Tiendas deja de ser una pestaña**: su ranking de comercios es la sección «Dónde conviene comprar» al final de la
   Comparativa (`seccionComercios`, `id="donde-comprar"`). El enlace viejo `#tiendas` abre la Comparativa y baja hasta
   esa sección (`ALIAS` y `ANCLAS` en `js/arranque.js`); el botón «Tiendas» del puente de Buscar sigue andando así.
4. **Borrar búsquedas**: un botón en la tira y otro en el historial de Buscar. Un bicho cruza la fila y se va comiendo
   cada búsqueda (`COMILONES`: Pac-Man, un torbellino —homenaje al demonio de Tasmania, sin el personaje— y una
   escoba; sale uno distinto cada vez); al terminar se vacía el historial y se suelta la consulta activa. Con «reducir
   movimiento» se borra sin animación.
5. Se sacan los restos del relevamiento viejo en la interfaz: el contador de la pestaña Comparativa, la nota del pie
   (ADATA, Corsair, Kingston) y el encabezado («Memorias, tiendas y webcams…»). Los datos curados (`datos.json`,
   `CATEGORIAS`, las vistas de detalle por producto) quedan en el repo: los enlaces viejos a un producto siguen abriendo.

## Delegación (pedido del dueño: «delegá a los modelos de OmniRoute»)

Ideas de mejora y revisión por el endpoint de OmniRoute (combo `revision`). Lo que devolvieron es dato y se contrastó con
el código y el sitio; el detalle está en `docs/delegacion-modelos.md`.

## Fuera de esta spec

- Buscar afuera (Amazon, Tiendamia, Loquieroaca, tienda oficial) cuando no hay resultados y pegar un link en Costo de
  importar: spec 020, en otra rama.
- Un veredicto que use el historial de precios («comprá ahora o esperá»): propuesto aparte.

## Tests

`tests/js/pestanas-recientes.test.js` (13 casos), `tests/js/portada.test.js` (5 pestañas, portada sin lo curado, alias
`#tiendas`) y `tests/test_integracion.py` (la portada armada).
