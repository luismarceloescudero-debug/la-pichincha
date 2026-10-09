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
- Fila de una fuente sin relevar ese dia: "precio del D/M".
