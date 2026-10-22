# Spec 018: paginacion por categorias en tiendas WooCommerce

## Problema

Desde el 20/10/2026, The Gamer Shop corta la paginacion plana de su Store API
(`/wp-json/wc/store/v1/products`) con un **400 propio** desde la pagina 11:

```json
{"code":"tgs_paginacion","message":"Usá la búsqueda o las categorías de la tienda.","data":{"status":400}}
```

El indexador trataba ese error como una caida (`except ... break`, `indexar.py`) y cortaba
en silencio: **200 productos de 3.532** (issue #59). No es un bloqueo antibot ni una caida:
es una restriccion de la tienda, que explicita la via que si permite (categorias).

## Que se midio antes de decidir (22/10)

- La Store API ignora `per_page=100` y devuelve 20 items por pagina: el tope de la tienda.
- `X-WP-Total: 3532` con paginacion plana; a partir de `page=11` hay 400 (tgs_paginacion),
  con cualquier filtro (busqueda, orderby, on_sale): **toda consulta topa en 200 items**.
- Las **categorias** (`/products/categories`) se pagan libremente (94 categorias, 2 paginas).
- Dentro de una categoria tambien hay tope de 10 paginas (200 items); las hojas mas grandes
  (Mouse 292, Teclados 266, Auriculares 237, Tintas 225, Accesorios 321) no entran en 10 paginas
  de una sola pasada.
- **Sonda de barrido** (1.100 pedidos): con una pasada por categoria + una segunda en orden
  contrario (`orderby=price&order=asc` y `desc`) para las categorias con mas de 200 productos,
  se recupero el **98,4%** del catalogo (3.476 de 3.532 URLs unicas). Lo que falta son
  productos agotados (la API no lista sin stock).

## Decision

- `tiendas.json` gana `"catalogo": {"paginacion": "categorias"}` (opcional, solo The Gamer Shop).
- `indexar_woocommerce` despacha: paginacion plana (como siempre) o por categorias.
- La version por categorias (`indexar_woocommerce_categorias`) recorre
  `/products/categories` paginada, y por cada categoria con `count > 0` pagina
  `?category=<id>` hasta que vuelve vacia.
- Una categoria cuya primera pasada queda **cortada** (el 400 de la tienda o el tope de paginas,
  no una pagina vacia) se recorre otra vez ordenada por precio desde cada punta
  (`orderby=price&order=asc` y `desc`): asi se cubren las hojas de hasta 400 productos, que es
  como se midio el 98,4% de la sonda. Las que terminan en una pagina vacia no piden mas.
- El 400 de la tienda (y cualquier otro error) corta esa categoria, no la corrida, y
  lo ya leido no se descarta (igual que la version plana).

## Alternativas descartadas

- **orderby asc + desc en paginacion plana**: la consulta plana con cualquier orden tambien
  topa en la pagina 10 (probado: `orderby=price&order=asc&per_page=20&page=11` -> 400).
- **min_price/max_price para particionar**: la API los ignora (devuelve todo).
- **Respetar el tope de 200**: dejaria la fuente en 6% y el historial no registraria sus bajas.
- **Otra via (HTML, sitemap)**: la tienda señala categorias; es su propia API del carrito,
  permitida por robots.txt.

## Test

- `test_paginacion_por_categorias_cuando_la_tienda_la_pide`: con `"paginacion": "categorias"`,
  baja `/products/categories` y pagina `?category=<id>`; sin la clave, sigue igual que antes.
- `test_una_hoja_mas_grande_que_el_tope_se_completa_por_precio_desde_cada_punta`: con el 400 desde
  la pagina 3, la segunda y la tercera pasada (precio asc y desc) traen lo que faltaba, sin repetir.
- `test_el_json_real_guardado_de_cada_tienda_woocommerce` ahora entrega tambien
  `categorias.json` para las tiendas con esa paginacion (fixture capturada real).

## Medido en la CI

- 22/10, corrida 133 (solo la primera pasada, PR #112): **3.309 productos** (antes del corte eran
  3.343). Las categorias padre repiten productos de sus hojas, por eso la sola pasada ya cubria
  mas del 93%.
- La segunda pasada por precio (este cambio) se mide en la proxima corrida: sale el conteo en el
  log del paso «Armar el indice de busqueda» (`The Gamer Shop  N productos`).
