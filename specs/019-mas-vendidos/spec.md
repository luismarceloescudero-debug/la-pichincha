# Spec 019: «Lo más vendido en las tiendas» en la portada

**Created**: 2026-10-22

**Status**: Implementada; se mide con la primera corrida de la CI que la incluya

**Input**: Pregunta abierta 2 de la spec 017 («¿de dónde sale el dato de ventas?»). Decisión del dueño (22/10/2026): usar el
orden de «más vendidos» que publica cada tienda, sin inventar cantidades, con el título «Lo más vendido en las tiendas».

## Qué se midió antes de decidir (22/10)

- **WooCommerce**: la misma Store API que ya se lee acepta `orderby=popularity` (ventas totales de la tienda). Max Tecno
  devuelve otro orden que el normal (monitor E-View 20", fuente E-View 650 W, gabinete Raptor...): es un orden real.
- **VTEX**: la búsqueda acepta `O=OrderByTopSaleDESC`, por categoría. En Naldo, «notebook» da Acer AL15 i3, HP 15 i3 y HP 15
  R5 contra Exo, Lenovo y Samsung en el orden normal.
- Ninguna de las dos publica **cuánto** se vendió: solo el orden. Las fuentes de listados, JSON y el agregador no publican
  ese orden.
- **Mercado Libre** tiene ranking de más vendidos por categoría, pero no es una fuente del índice: queda afuera de esta spec.

## Decisión

1. El indexador guarda en cada fila (columna 13, `vendido`, al final) el **puesto** del aviso en el orden «más vendidos» de su
   tienda: los primeros 100 (`TOPE_VENDIDOS`); 0 es sin puesto. `indexar.vendidos(tienda)`:
   - WooCommerce: `?orderby=popularity` de toda la tienda (una o pocas páginas).
   - VTEX: por cada categoría que ya se lee, un pedido con `O=OrderByTopSaleDESC` (los primeros 50); un aviso en dos
     categorías se queda con su mejor puesto. Cuenta aunque el aviso no tenga stock: es el orden de la tienda.
   - Si el orden no se puede leer, la tienda entra igual, sin puestos. No cambia cómo se recorre el catálogo.
2. La portada (`Novedades.masVendidosPorCategoria`, que corre el build) arma, por categoría (celulares, notebooks, monitores
   y PCs armadas), hasta 3 equipos:
   - Los puestos de dos tiendas **no se comparan entre sí** (Max Tecno cuenta toda la tienda; Naldo, una categoría): se usa
     el orden **dentro** de cada tienda y categoría nuestra. Primero lo que encabeza su tienda; a igual orden, el modelo que
     está entre los 5 primeros de más tiendas; después, el más barato.
   - Solo lo que pasa el mínimo de su gama (criterio de la spec 017), sin usados ni compras internacionales, un modelo una
     sola vez y con especificaciones legibles (para el «Comparar»).
3. El panel va después de «Lo más buscado» y antes de «Lo último en tecnología». Cada fila dice «n.º 1 en Mexx» y, si
   corresponde, «entre las más vendidas de 2 tiendas». El texto aclara que las tiendas no publican cuántas unidades venden.

## Qué no entra

- Cantidades de ventas, estimadas o inventadas.
- Mercado Libre (no es fuente del índice).
- Usar el puesto en el buscador o en los modos de búsqueda.

## Tests

- `tests/test_indexar.py`: `test_lo_mas_vendido_sale_del_orden_por_popularidad_de_la_tienda`,
  `test_sin_orden_de_mas_vendidos_no_hay_puestos`, `test_lo_mas_vendido_de_cada_categoria_vtex`.
- `tests/test_indexar_corrida.py`: `test_el_puesto_en_lo_mas_vendido_va_en_la_ultima_columna` y las filas viejas completas.
- `tests/js/novedades.test.js` (cuatro de lo más vendido) y `tests/js/portada.test.js` (orden de los paneles, `VENDIDOS`,
  `vendidosDe`).
