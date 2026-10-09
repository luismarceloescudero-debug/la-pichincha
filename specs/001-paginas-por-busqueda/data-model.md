# Data Model

## Consulta (entrada, `consultas.json`)
- `q` (texto): lo que se busca, ej. "ssd 1tb".
- `nota` (opcional): por que esta en la lista.
- Derivado: `slug` (unico), `url` = `BASE_URL/precios/<slug>/`.

## Analisis (salida de `analizarConsulta`)
- `total`, `base[]` (comparables), `med`, `picks[]` (mejor compra y alternativas), `comercios[]`,
  `excl` (motivos y cantidades), `internacionales[]`.
- Cada fila del indice: nombre, precio, url, tienda, via, lista, antes, imagen, sellos.

## Pagina de consulta
- `indexable` = `base.length >= 5`.
- Campos: consulta, `generado`, fuentes que aportaron y las sin relevar (con fecha), mejor compra y
  razon, mediana, rango (min, max), hasta 20 opciones, que quedo afuera, enlace `?q=`.

## Sitemap
- `loc` y `lastmod` por pagina indexable, mas `/` y `/precios/`.

## Validaciones
- Slug unico y no vacio; consulta de al menos 2 caracteres; sin indice no se generan paginas (FR-016).
