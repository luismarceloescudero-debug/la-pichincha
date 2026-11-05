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

## Tercera vuelta (05/11, capturas del dueño desde el celular)

- **Link de Telegram que abria «sin conexion»**: `sw.js` esperaba la red 4 s y, sin copia guardada, mostraba `sin-red.html`
  aunque hubiera internet (4G lento, `/hoy/` abierto por primera vez). Ahora, sin copia, sigue esperando la red; la pagina de
  sin conexion queda para cuando la red falla de verdad. Test nuevo en `tests/js/sw.test.js`.
- **Sin blancos**: el titulo de «Lo mas vendido» (una regla vieja lo dejaba en `--ink`) va en lila; los nombres giran en
  lila, rosa claro y menta (`--n-menta`, nuevo: #8dffc4 oscuro / #0b6b3d claro, 6:1 o mas); «Comparar» va relleno segun la fila
  (lila, rosa, amarillo) con letra negra; `.acc` en general lleva texto lila e icono rosa.
- **Caracteristicas sin repetir el titulo**: la columna «Especificaciones» de Comparativa salia del mismo titulo («6 GB de
  RAM · 128 GB») y se quita. Bateria, NFC o procesador no estan en el indice (solo hay titulo): queda como trabajo aparte.
- **Caracteristicas resaltadas** (el dueño, despues: «estan en el titulo, no se diferencian»): Comparativa pinta el nombre
  con `Titulo.html`, como Ofertas: titulo limpio y cada caracteristica en su pastilla llena, letra negra en negrita,
  girando menta, lila y rosa (las premium con ✦ y degradado). «Abrir», «Comparar», «Historial» y «Ahorrás» de las tarjetas
  dejan el blanco: lila con icono rosa, y rosa claro.
- El «titulo blanco que despues cambia de color» era el CSS viejo que el service worker anterior servia mientras llegaba el
  nuevo: pasa una vez despues de cada publicacion.

## Animaciones al scrollear (05/11)

- `js/al-ver.js` (portada y `/hoy/`, en la cascara del service worker): pone `anima` en `<html>` y `en-vista` en cada tarjeta,
  fila de Comparativa o renglon de `/hoy/` la primera vez que entra en pantalla (IntersectionObserver; MutationObserver para
  lo que se pinta despues).
- `css/sitio.css` «Al ver»: el % cae y rebota (`av-cae`), la tienda entra de costado (`av-tienda`), el icono del producto gira y
  aparece (`av-ico`), la caracteristica premium salta (`av-salta`) y le pasa un destello (`av-brillo`). Hasta verse, la animacion
  espera en pausa; corre una sola vez.
- Sin JavaScript, sin IntersectionObserver o con «reducir movimiento» no hay `anima`: todo quieto y a la vista.
- Arreglo de paso: en `/hoy/` las pastillas llenas tenian la tinta clara del cartel (contraste 1,2:1); ahora letra negra.
