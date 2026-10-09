# Feature Specification: Mas fuentes de precios

**Feature Branch**: `005-mas-fuentes`

**Created**: 2026-10-09

**Status**: Implemented (primera fuente: Venex)

**Input**: Fase 2, F2.3 de docs/plan-de-escalado.md: "Mercado Libre directo (cobertura y afiliados) y tiendas de hardware a probar con `indexar.py --probar`. El orden lo da `busqueda_vacia`: primero lo que la gente busca y no encuentra."

## User Scenarios & Testing

### User Story 1 - Mas tiendas en cada comparacion (Priority: P1)

Una persona busca "ssd 1tb" y ve tambien los avisos de una tienda mas de hardware argentina, con su precio y su enlace,
mezclados con los de las otras y comparables con ellos.

**Independent Test**: indexar la tienda nueva y buscar un producto que vende: aparece con la tienda, el precio y el enlace
correctos, y suma a la mediana y al conteo.

**Acceptance Scenarios**:

1. **Given** la tienda nueva activa en `tiendas.json`, **When** corre el indexado, **Then** sus productos entran al indice con nombre,
   precio, enlace y foto, y entran al historial de precios.
2. **Given** una busqueda, **When** la tienda nueva vende lo buscado, **Then** el aviso sale con su nombre de comercio y su color.

## Requirements

- **FR-001**: Sumar una tienda DEBE ser configuracion (`tiendas.json`) mas, como mucho, un color; sin codigo propio por tienda.
- **FR-002**: Solo se suma una tienda cuyo `robots.txt` permite recorrer el catalogo, con el ritmo respetuoso de siempre (principio III).
- **FR-003**: La enumeracion de listados DEBE poder excluir URLs y quedarse solo con las categorias hoja de un sitemap, para no
  recorrer lo mismo varias veces.
- **FR-004**: Cada tienda nueva DEBE tener tests con HTML real guardado (tarjetas) y con HTML minimo escrito a mano.
- **FR-005**: La tienda nueva DEBE entrar a la salud de fuentes y al historial sin pasos manuales.
- **FR-006**: Los textos que cuentan las fuentes ("6 fuentes") DEBEN decir las que hay.

## Success Criteria

- **SC-001**: La tienda nueva aporta al menos 1.000 avisos en la primera corrida real.
- **SC-002**: Ninguna otra fuente cambia su cantidad de avisos por esta feature.

## Assumptions

- **Venex** (venex.com.ar) es la primera: `robots.txt` permite el catalogo, tiene sitemap, paginacion `?page=` y precio en el HTML
  (el precio es el de "contado efectivo"). Sin extractor de pagina de producto (no hay etiquetas genericas): no sirve para productos curados.
- Candidatas siguientes, con `robots.txt` que permite el recorrido: Maximus, ArmyTech (PrestaShop) y Compumarket (que no permite `?page=`,
  hay que ver otra forma de enumerar). Se suman de a una, midiendo.
- **Mercado Libre directo y afiliados** requiere una cuenta de desarrollador y de afiliado del dueño: queda anotado para el, no se hace sin su alta.
- El orden por `busqueda_vacia` necesita los eventos de GoatCounter (cuenta del dueño): hasta tenerlos, se elige por tamano del catalogo y facilidad de lectura.
