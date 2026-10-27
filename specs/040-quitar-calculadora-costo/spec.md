# Spec 040: quitar la calculadora de «Costo de importar»

## Problema

Hoy el sitio responde «cuánto sale traer algo de afuera» de dos maneras:

1. **La calculadora local** — la pestaña «Costo de importar» (`#costo`): estima el costo puesto en casa
   con las reglas de `importacion.json`, las cotizaciones y el motor de costos.
2. **La referencia** (spec 039) — pegar un link de Amazon/eBay/Tiendamia/Loquieroacá y leer el precio final
   de Tiendamia o Loquieroacá, y el porcentaje contra Amazon.

Los enlaces «Calcular puesto en casa» (Afuera, en vivo), «Calcular con este precio» (Ofertas) y «Pegá el link
y calculá cuánto te sale puesto en casa» saltan a la pestaña `#costo`, y al saltar se pierde la búsqueda. El
dueño decide quedarse **solo con la referencia**.

## Qué se decide

- **Quitar la calculadora local**: la pestaña `#costo`, el formulario, el motor de costos, las reglas de
  `importacion.json` y las cotizaciones. Ya no se estima el costo con reglas locales.
- **Quitar el courier Aerobox** de «Buscalo afuera» (spec 039 lo había citado; ahora se saca).
- **Dejar la referencia**, reubicada: pegar un link sigue mostrando el precio final de Tiendamia o Loquieroacá
  y el porcentaje contra Amazon, pero **ya no vive en una pestaña**: va inline en «Buscalo afuera».
- **Desaparecen los enlaces** «Calcular puesto en casa» y «Calcular con este precio»: no hay calculadora a la
  que saltar.

## Qué NO cambia

- La referencia del costo importado (Tiendamia/Loquieroacá) sigue funcionando al pegar un link.
- «Afuera, en vivo» y «Buscalo afuera» siguen mostrando los precios de afuera y sus enlaces.
- Loquieroacá sigue mostrando «$X puesto en casa»: ya trae el precio final en pesos, no depende de la calculadora.

## Requisitos funcionales

- **R1** No existe la pestaña «Costo de importar»: no aparece en la tira de pestañas ni responde a `#costo`.
- **R2** Ningún elemento de la página enlaza a `#costo` ni abre la calculadora.
- **R3** En «Buscalo afuera» hay un campo para pegar un link de Amazon, Tiendamia, Loquieroacá o eBay.
- **R4** Al pegar un link de Tiendamia, se muestra el precio final y el porcentaje contra Amazon (la referencia).
- **R5** Al pegar un link de Loquieroacá, se muestra el precio final en pesos, ya puesto en casa.
- **R6** Al pegar un link de Amazon/eBay, se muestra lo que la fuente permita (la API cuando esté activa) sin
  pedir un formulario de cálculo.
- **R7** Aerobox no aparece en «Buscalo afuera».
- **R8** En «Afuera, en vivo», los avisos de Tiendamia/Amazon/eBay ya no ofrecen «Calcular puesto en casa»; los
  de Loquieroacá siguen mostrando «$X puesto en casa».
- **R9** Las ofertas internacionales siguen apareciendo (rotuladas), pero sin el bloque «Puesto en casa:
  estimación» ni el enlace «Calcular con este precio».

## Criterios de éxito

- La tira de pestañas no tiene «Costo de importar»; pegar `#costo` en la URL cae en la vista por defecto.
- Pegar un link de Tiendamia muestra el porcentaje contra Amazon sin salir de la búsqueda.
- Ningún test ni página referencia a `#costo`, a la calculadora ni a `importacion.json` (fuera de los specs/docs).
- La suite `node --test "tests/js/*.test.js"` pasa en CI (Linux); el único fallo local permitido es el CRLF del
  test skip-link de `generador.test.js`.

## Supuestos

- «Quitar la calculadora» incluye también la estimación «puesto en casa» de las ofertas internacionales y del
  feed: usan el mismo motor (costos/puesto/importacion.json).
- La referencia (leer un link) es un bloque ligero: muestra tienda, enlace y la línea leída, **sin** formulario,
  sin desglose y sin «copiar enlace de esta cuenta».
