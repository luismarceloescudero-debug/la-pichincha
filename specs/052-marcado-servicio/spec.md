# Spec 052: marcado de servicio y de lista (JSON-LD)

## Problema

La auditoria del 30/10 (`docs/auditoria-2026-10-30.md`, punto 4) senalo que las paginas `/precios/<slug>/` llevaban
`Product` con `AggregateOffer`. Google pide `Product` para la ficha de un producto concreto, no para una lista de
resultados: puede ignorarlo o dar avisos en Search Console. Decision del dueno (31/10): sacarlo y registrar a
La Pichincha como servicio.

## Que se hizo

- `/precios/<slug>/` (`grafoDe` en `generar_paginas.js`): sin `Product` ni `AggregateOffer`. Queda `CollectionPage`
  (`isPartOf` el sitio, `about` el servicio, `mainEntity` la lista, `breadcrumb` las migas) + `ItemList` (cada
  elemento con nombre, URL y posicion) + `BreadcrumbList`. No hay precios, calificaciones, resenas ni disponibilidad
  (principio II: lo que no se midio no se afirma).
- La identidad se describe una sola vez, en la portada (`index.html`) y en `/acerca/` (`renderAcerca`), con
  `nodosDelSitio(base)`: `Organization` (`#organizacion`) y `Service` (`#servicio`, `serviceType` «Comparador de
  precios de hardware», `areaServed` Argentina/`AR`, `provider` -> la organizacion). La portada mantiene el `WebSite`
  (`#sitio`) con `SearchAction`, ahora con `publisher` -> la organizacion. Las demas paginas los nombran por `@id`.
- Sin nombre de persona ni correo: el contacto es el formulario `/contacto/`.

## Verificado

`tests/js/marcado.test.js`: por cada pagina tipo (portada, `/acerca/`, una `/precios/...`) el JSON-LD parsea, usa solo
tipos y propiedades previstos de schema.org, los `@id` se resuelven y no aparece `Product`, `Offer`, rating, review,
availability ni correo. La portada y `nodosDelSitio` no pueden divergir. Se actualizaron dos pruebas de
`generador.test.js` que pedian el `Product`. Pendiente fuera del repo: revisar Search Console tras la publicacion.
