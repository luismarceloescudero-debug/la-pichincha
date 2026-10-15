# Feature Specification: Filtros de la busqueda

**Feature Branch**: `008-filtros`

**Created**: 2026-10-15

**Status**: Implemented en la busqueda (filtros con datos que el indice ya trae; cuotas y envio gratis, descartados)

**Input**: Fase B, B4 de docs/plan-v2.md: "Filtros como ComparaYa: tienda, rango de precio, cuotas sin interes, envio gratis, solo primera linea, excluir palabras. Requiere capturar cuotas y envio por aviso (campos nuevos al final del indice)."

## Medicion previa: ¿se pueden capturar cuotas y envio por aviso?

Fecha: 2026-10-15. Sobre los fixtures guardados de cada fuente, una ficha de Venex y una de Mexx, y una pagina (100 avisos) de la API de
ComparaYa por cada una de seis categorias (600 avisos).

| Fuente | Cuotas sin interes | Envio gratis | Donde esta |
|---|---|---|---|
| CompraGamer | no | no | El catalogo JSON no trae campos de cuotas ni de envio (`promocion` vacio en toda la muestra). `precioLista` es el precio de otro medio de pago, no una cuota |
| Gaming City | no | no | Solo en la ficha. Las cuotas fijas llevan recargo: 1 pago $249.000, 12 cuotas de $29.050 = $348.600 en total |
| Mexx | no | no | Solo en la ficha. Hay un "Precio 12 cuotas" aparte del precio de contado (con recargo). El texto "12 cuotas sin interes" es del `<meta description>` general del sitio, no del aviso |
| Venex | no | no | Solo en la ficha, con una tabla de cuotas por tarjeta. El icono de envio gratis esta oculto y lo decide JS |
| ComparaYa (y los comercios que agrega: Mercado Libre, Carrefour, Naldo, Megatone...) | **si, parcial**: 19% de los avisos dice "sin interes" y 49% informa alguna cuota | **si, parcial**: 42% | `specifications.Cuotas` ("12 cuotas sin interes", "6 cuotas"), `specifications["Sin interes"]` y `specifications["Envio gratis"]`. El envio gratis ya entra al indice como el sello `e` |

**Conclusion**: ninguna de las cinco fuentes directas publica "cuotas sin interes" ni "envio gratis" por aviso en lo que el indice ya releva (y leerlo
exigiria un pedido por ficha, miles de avisos, para un dato que en tres de ellas ni siquiera es sin interes). Solo ComparaYa lo informa, y en una parte de
sus avisos. Un filtro que oculte todo lo que no sea de ComparaYa no filtra: **deja afuera a las cinco tiendas directas por no informar**, y eso confundiria
"no lo dice" con "no lo tiene" (principio II). Por eso **en esta entrega no se suman esos dos filtros ni campos al indice**: el indice no crece.

**Opcion abierta**: ofrecerlos como "solo donde la fuente lo informa", sin sumar columnas: `e` (envio gratis) ya existe y alcanza con una letra nueva
`s` (cuotas sin interes) en la columna `sellos`, con un aviso al lado del filtro ("lo informan ComparaYa y sus comercios"). Es poco codigo, pero el filtro
quedaria vacio para las tiendas directas; se decide con el dueño. Cuando una fuente directa publique el dato en su listado o API, se suma ahi mismo.

## User Scenarios & Testing

### User Story 1 - Acotar una busqueda (Priority: P1)

Una persona busca "ssd 1tb" y quiere ver solo lo que vende una tienda, o solo lo que sale entre $60.000 y $120.000, o sin las
palabras "kit" y "usado".

**Independent Test**: buscar, elegir una tienda y un rango de precio: la lista y el conteo muestran solo lo que cumple, y
"Quitar filtros" vuelve a la lista completa.

**Acceptance Scenarios**:

1. **Given** una busqueda con resultados de varias tiendas, **When** se marca una tienda, **Then** quedan solo sus avisos.
2. **Given** un rango de precio, **When** se completa minimo, maximo o ambos, **Then** quedan los avisos dentro del rango (los limites incluyen).
3. **Given** "solo primera linea", **When** se activa, **Then** quedan solo las marcas de primera linea (la lista editorial de `datos.json`).
4. **Given** palabras a excluir ("kit, usado"), **When** se escriben, **Then** salen los avisos cuyo nombre trae alguna de ellas como palabra.
5. **Given** un producto que dos tiendas venden con el mismo codigo de modelo, **When** se filtra por una de esas tiendas, **Then**
   el producto sigue saliendo con el precio de esa tienda, no desaparece porque la otra era mas barata.
6. **Given** filtros que dejan cero resultados, **When** se pinta la lista, **Then** dice cuantos avisos habia y ofrece quitar los filtros.

## Requirements

- **FR-001**: La logica de filtrado DEBE ser una funcion pura en `js/buscador.js`, con tests, sin tocar el DOM.
- **FR-002**: Los filtros DEBEN actuar solo sobre la lista que se ve. La mediana, la Comparativa, las Tiendas y el Veredicto siguen
  calculandose con todos los avisos comparables: un filtro no debe cambiar lo que la app dice del mercado.
- **FR-003**: El orden NUNCA cambia por un filtro (principio II): se filtra y despues se ordena como siempre.
- **FR-004**: El estado DEBE decir cuantos avisos se ocultaron por los filtros ("12 de 40 ocultos por los filtros").
- **FR-005**: Los controles DEBEN poder usarse con teclado y con lector de pantalla (etiquetas reales, `aria-pressed` en las
  tiendas) y cumplir contraste AA en tema claro y oscuro.
- **FR-006**: No se agregan columnas al indice ni dependencias; el indice publicado no crece.
- **FR-007**: Las paginas estaticas `/precios/<busqueda>/` muestran las 20 mejores opciones, no el catalogo: filtrar 20 filas aportaria poco.
  Cada una DEBE enlazar a la busqueda de la misma consulta ("Buscar y filtrar por tienda y precio"), que es donde se filtra. Su HTML
  no suma controles ni JS nuevo.

## Success Criteria

- **SC-001**: Con los filtros vacios el resultado es identico al de hoy (mismo orden, mismo conteo).
- **SC-002**: Lighthouse movil sigue >= 90 en todas las paginas medidas y la cobertura no baja de sus umbrales.

## Assumptions

- Es un filtro de la lista, no una busqueda nueva: no se persiste en la URL ni en el navegador. Vive mientras la pagina esta abierta, tambien al cambiar
  de busqueda (se afina escribiendo: "ssd" y despues "ssd 1tb" no pierde los filtros); "Quitar filtros" los limpia.
- "Primera linea" usa `nivelMarca === 2`, la misma lista editorial que ya rotula los avisos.
- Un precio minimo mayor que el maximo no se corrige solo: da cero resultados y lo dice.
