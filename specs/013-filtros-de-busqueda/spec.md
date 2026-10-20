# Feature Specification: Tres modos de busqueda (Recomendacion, Super Oferta, Primera Linea)

**Created**: 2026-10-20

**Status**: Implementada (js/modos.js)

**Input**: Pedido del dueño el 19/10/2026, tras recibir las Pichincha del dia en Telegram: «los 3 filtros deberian ser: Recomendacion, que sea precio-calidad pero ordenado de mayor a menor precio, luego mas barato no; Super Oferta, pero de la gama media (actual vs año anterior si correspondiese), ordenado de la misma manera de mayor a menor precio; y en vez de marca, solo Primera Linea, como figura mas abajo, tambien ordenado de mayor a menor, teniendo en cuenta que tambien se ordenaran desde ultimas novedades y caracteristicas premium».

Hasta hoy el buscador tenia tres ordenes: Recomendado (marca confiable al menor precio), Mas barato (precio ascendente) y Mejor marca (nivel de marca, despues precio). No respondian a lo que el dueño quiere ver: lo mejor primero, no lo mas barato.

## Decisiones

1. **Quedan tres modos**: Recomendacion, Super Oferta y Primera Linea. Se eliminan «Mas barato» y «Mejor marca» como ordenes. El sello «mas barato» de la tarjeta sigue como dato informativo (marca el aviso de menor precio de la lista).
2. **Recomendacion** (precio-calidad): avisos que pasan el piso de gama de su categoria (`Categorias.evaluar(...).pasa`), con marca reconocida (`nivelMarca >= 1`) y que no estan muy por debajo del resto (`pisoDeGama`). Lo internacional va al final. En perifericos y «otro», donde no aplica gama, solo cuentan la marca y el piso.
3. **Super Oferta**: las ofertas reales de `js/ofertas.js` (`calcularOfertas`: bajas propias y rebajas publicadas, ya con piso de gama, segundo chequeo contra otras tiendas y tachado fijo) cuyo nivel de gama es **media** (`evaluar(...).nivel === "media"`). En equipos con generacion comparable, la generacion anterior sigue contando como actual cuando la mejora fue chica: ya lo resuelve `vigenciaDe` (la anterior recibe el punto de novedad y no se descalifica), asi que no hay una segunda regla. Lo que no tiene gama (perifericos, «otro») no entra.
4. **Primera Linea**: las marcas de `datos.json` → `marcas.primera` (`nivelMarca === 2`). Reemplaza a «Mejor marca».
5. **Orden de adentro**, elegible en cada modo: **Precio ↓** (de mayor a menor, por defecto), **Novedades** (generacion o año mas nuevo primero) y **Premium** (mas señales de gama alta primero). A igual clave, de mayor a menor precio. Lo internacional siempre al final.
   - Novedades: para cada familia con generacion (`Categorias.generacionesDe`) se mide la distancia a la ultima generacion del indice (`Categorias.referencia`), en pasos de la familia (Ryzen salta de a dos): 0 es lo ultimo, −1 la anterior. Sin generacion se usa el año del titulo contra el año mas nuevo del indice. Sin ninguno de los dos no se sabe y queda al final del modo.
   - Premium: las señales que cuenta `evaluar` en celulares, notebooks y PCs (`puntos`, 3 o mas es gama alta); en monitores y componentes, 3 si es gama alta, 1 si es media y 0 si no.
6. **Un modo vacio no deja la pantalla vacia**: dice por que (no hay ofertas reales de gama media, ninguna marca de primera linea, nada pasa el piso) y ofrece, con el conteo, los modos que si tienen resultados.
7. **Migracion**: `localStorage.orden` valia «recomendado», «precio» o «marca» en navegadores que ya la usaron: cualquier valor que no sea un modo nuevo se trata como Recomendacion. El orden de adentro se guarda aparte (`orden2`).
8. **Paginas estaticas por busqueda** (`generar_paginas.js`): muestran primero lo que daria Recomendacion y despues el resto, cada grupo de mayor a menor precio. No esconden ningun comparable; el «desde $» y el rango siguen siendo los de todo lo comparable.
9. **Rendimiento**: el calculo de ofertas sobre el indice completo (~1,4 s en Node con 25 mil avisos) es perezoso: solo corre cuando un modo lo pide (Super Oferta, o el conteo de un modo vacio), y la pagina reutiliza `OFERTAS`, que ya calcula al cargar el indice.
10. Ningun modo mira comisiones (Constitucion II).
11. **Eventos de GoatCounter**: hoy no hay ningun evento del orden elegido, y no se agrega uno (no se mide nada nuevo de la persona).

## Medicion (indice publicado el 20/10/2026, 25.094 avisos)

Resultados por modo y consulta. «Conjunto» son los avisos comparables que la busqueda ordena (sin equipos completos ni lo no comparable).

| Consulta | Conjunto | Recomendacion | Super Oferta | Primera Linea |
| --- | ---: | ---: | ---: | ---: |
| notebook | 1.608 | 833 | 61 | 1.549 |
| celular samsung | 199 | 95 | 11 | 199 |
| ssd 1tb | 106 | 84 | 1 | 70 |
| monitor 27 | 398 | 166 | 15 | 295 |
| auriculares | 357 | 185 | **0** | 185 |
| rtx 5060 | 123 | 117 | 2 | 118 |
| ryzen 5 | 281 | 260 | **0** | 279 |

Hallazgos:

- **Super Oferta queda vacia** en «auriculares» y «ryzen 5» (perifericos y procesadores sin ofertas reales hoy) y casi vacia en «ssd 1tb» y «rtx 5060». Por eso el aviso con la salida a otro modo es parte de la funcion, no un detalle.
- **Primera Linea casi no filtra** hoy: `marcas.primera` abarca 1.549 de 1.608 notebooks y todos los celulares Samsung. Es un juicio editorial de `datos.json`, no del codigo; si el dueño quiere que sea mas selectiva, la lista es lo que se cambia. Se deja asi (la decision 4 pide esa lista).
- **De mayor a menor, lo primero es lo mas caro**: en «notebook» el primero de Recomendacion es una notebook de $5.937.446. Es lo que se pidio; Novedades y Premium existen para acotar eso sin volver a «mas barato».
- Lo internacional queda al final de cualquier modo (en «notebook» son 29 compras).
- Costo: `preparar` sin ofertas es instantaneo; el calculo de ofertas son 1,4 s en Node y se hace una sola vez por indice cargado (la pagina ya lo tenia).

## Criterios de aceptacion

- **FR-001**: Exactamente tres modos y tres ordenes en la pagina; ningun resto de «Mas barato» ni «Mejor marca».
- **FR-002**: Cada modo ordena de mayor a menor precio por defecto; lo internacional queda ultimo en todos.
- **FR-003**: Super Oferta nunca incluye una oferta de gama alta ni un periferico.
- **FR-004**: Un modo sin resultados muestra un texto y botones a los modos con resultados, y el conteo de «hay N en esta busqueda».
- **FR-005**: «precio» y «marca» guardados en localStorage arrancan en Recomendacion.
- **FR-006**: Los controles se ven y se pueden tocar a 375 px, sin desborde horizontal, con `role="group"` y `aria-selected`.
- **FR-007**: Los filtros del panel (tienda, precio, primera linea, excluir) se aplican antes del modo; la mediana y la Comparativa no cambian.

Tests: `tests/js/buscador.test.js` (logica con titulos reales), `tests/js/filtros-ui.test.js` (pagina).
