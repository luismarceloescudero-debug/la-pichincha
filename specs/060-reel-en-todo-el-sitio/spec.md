# Spec 060: el lenguaje del Reel v4 en todo el sitio

## Problema

El 04/11 el dueño aprobó el Reel v4 y su diseño se aplicó al cartel de `/hoy/` (spec 059). El resto seguía igual:
«cuando muestra el listado completo de nuevo todas las letras son BLANCAS […] en Comparativa sigue igual; en Ofertas
mejora levemente con las tarjetas pero sigue el blanco en todas las fuentes; Buscar lo mismo. Adoptar nuevo diseño del
reel». Después, mirando el avance: «también abusan del celeste […] combinar, alternar, que la vista de la página no sea
una mancha de colores agrupados» y, sobre Comparativa, «dos grupos mismos colores».

## Qué se hace

1. **Paleta por rol** (`css/sitio.css`, tokens de `:root` y del tema oscuro, más la capa «Lenguaje del Reel v4» al final):
   - precio y descuento: amarillo `#ffd23f` (ámbar `#8a5300` en claro), condensado; el «$» y el «−» rosa;
   - tachado: rosa;
   - **celeste solo para la marca y la tienda** (y el «%»);
   - rosa para el tipo de producto, los iconos y los títulos de categoría;
   - chips, botones y bordes en lila neutro; las chips premium con ✦ y degradado rosa→celeste;
   - tarjetas de dos tonos (`#26063b → #0c1446`), fondo violeta `#120018`, títulos en mayúsculas condensadas
     (Oswald / Barlow Condensed);
   - la pestaña o el botón elegido lleva la cinta rosa→celeste del cartel.
2. **Alternar, no amontonar**: en Comparativa (lo más vendido, lo último) un grupo va con título y borde rosa y el
   siguiente celeste, y las filas de cada grupo intercalan un tono.
3. **/hoy/**: la lista «Todas las ofertas de hoy» usa la misma tarjeta que el cartel (`renderHoy`), con el enlace a la
   tienda en el nombre; el precio de antes se tacha solo cuando es un precio de antes de verdad (specs 035 y 038).
4. **Nombre legible** (`js/titulo.js`, `html`): la marca va en `.tit-marca` y las chips premium llevan `.pr` y ✦.
5. **Ofertas** (`js/indice-ofertas.js`): el porcentaje es `− 52 %` con cada parte en su color; la animación cuenta solo
   el número. Se sacan las paletas por tienda de las tarjetas (cada tienda tenía su color: rompía la lectura por rol).
6. `theme-color`, `manifest.webmanifest` y `sin-red.html` con la paleta nueva; `/precios/` pide Barlow Condensed.

## Segunda vuelta (04/11, capturas marcadas por el dueño)

- «Todo en blanco; negro en negrita, otros tamaños, otros colores; cada tarjeta o grupo con su color; me gusta el lila;
  destacar la tienda». Queda: lila protagonista (marca, titulos de panel, franja del lema), rellenos fijos lila,
  celeste, amarillo y rosa con letra negra en negrita (lema, botones de exportar, «Filtrar y ordenar», la tienda).
- La tienda va en pastilla llena. Tarjetas de Ofertas, filas de Buscar y la lista de /hoy/ en ciclo de tres colores
  (borde, nombre y tienda cambian juntos); en Comparativa los nombres alternan fila por medio.
- Se saca un anillo viejo del porcentaje que se colaba en las bajas propias.

## Tema claro (decisión, sin consultar al dueño)

Mismo lenguaje y mismos roles en tonos oscuros sobre lavanda (`#faf5fe`): el amarillo y el celeste neón no llegan a
4,5:1 sobre blanco. Precio ámbar, rosa `#b8125f`, celeste petróleo `#00708c`. `tests/test_contraste.py` lo controla.

## Verificación

- `node --test "tests/js/*.test.js"` (763), `python -m unittest discover -s tests -p "test_*.py"` (637),
  `npx playwright test --workers=1` (21): en verde.
- Lighthouse móvil sobre el índice publicado: accesibilidad 100 en la portada (claro), Ofertas y `/hoy/` (oscuro).
- Capturas antes/después a 390 px en `privado/capturas/060/`.
