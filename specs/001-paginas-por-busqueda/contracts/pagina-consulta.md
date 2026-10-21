# Contrato: pagina `/precios/<slug>/`

- `<title>` y `meta description` propios, con "desde $X" y la mediana.
- `<link rel="canonical">` absoluto; `og:*` y `twitter:*` con `img/og.png`.
- `meta robots: noindex,follow` solo si la pagina no es indexable.
- Un `<h1>` con la consulta; `<main>` con: fecha y hora de los precios, mejor compra y razon,
  mediana, tabla (maximo 20 filas: nombre, comercio, precio, sellos, enlace), lo que quedo afuera,
  enlace "Ver la comparativa completa" a `/?q=<consulta>#comparativa`.
- JSON-LD: `ItemList`, `AggregateOffer` (ARS) y `BreadcrumbList`.
- Sin dependencia de scripts para el contenido; estilos de `css/sitio.css`, tema claro y oscuro.
- Enlaces salientes con `rel="noopener"`, medidos como `clic_saliente` por el mismo script.
- Feed propio: `<link rel="alternate" type="application/rss+xml">` hacia `/precios/<slug>/feed.xml`, solo si la
  pagina es indexable (ademas del `ofertas.xml` global).
- Fila de una fuente sin relevar ese dia: "precio del D/M".
- Seccion `<h2>Precio por tienda</h2>` antes de las opciones: un `<h3>` por opcion (A, B, C) con una tabla
  (`th scope="col"` Tienda, Precio, Contra la mas barata, Fecha del precio, Aviso; `th scope="row"` por tienda;
  `aria-label` con el titulo) y debajo "<$X> menos que en la mas cara (N%)". Solo entran avisos comparables del
  mismo modelo (mismo codigo, misma capacidad, OC contra OC, misma configuracion, sin internacionales, usados ni
  accesorios); varios avisos de un comercio cuentan como uno (el mas barato). El porcentaje es contra la tienda
  mas barata ("la mas barata", "+N%", "+<1%"); el texto nunca depende solo del color. Con un solo comercio no hay
  tabla: "un solo comercio: no hay con que comparar"; si ninguna opcion tiene comparacion, una sola frase para
  todas. El orden es solo por precio. Fecha: "precio de hoy", "precio del D/M" o "sin fecha".

# Contrato: `/precios/<slug>/feed.xml`

- RSS 2.0 con `atom:link rel="self"`, `<language>es-AR</language>` y `lastBuildDate` = hora de los precios.
  `<title>` "La Pichincha: <consulta>"; `<link>` = la pagina canonica.
- Solo en paginas indexables (5 o mas comparables); en las finas no existe el archivo ni el `<link>`.
- Hasta 10 `<item>`: la mejor compra primero y despues el orden de la tabla de la pagina (modo
  Recomendacion y luego precio). Sin internacionales, usados ni excluidos: son los comparables.
- Cada item: titulo "<nombre>: $precio[ (-N%)] en <comercio>", `<link>` = el aviso real (solo `http(s)`),
  `<guid isPermaLink="false">` = `<enlace>#<precio>` (cambia solo si el precio se movio), `<pubDate>` = hora de
  los precios y descripcion con "Antes $X" si bajo, "Ojo: precio del D/M" si la fuente no se releva hoy y
  "Verifica en la tienda antes de comprar".
- Todo texto de terceros va escapado para XML. Misma funcion de analisis y de orden que la pagina
  (`filasOrdenadas` en `generar_paginas.js`).
