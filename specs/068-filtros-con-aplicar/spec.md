# Spec 068: Filtros con boton «Aplicar» y cartel de resultados

**Fecha**: 2026-11-27. **Pedido del dueno**: despues de buscar, los filtros se aplicaban solos y no se entendia si hacian algo; la
pagina no decia si habia o no resultados. Ademas, con filtros puestos, «Mejor precio aca» mostraba un precio de una tienda que la
lista ya no mostraba (parecia que no habia tarjetas locales, solo las de afuera).

## Comportamiento

- **FR-1**: tildar tiendas, sellos o «Solo premium» y escribir precios o palabras arma un BORRADOR. La lista no cambia hasta
  apretar «Aplicar filtros» o Enter en un campo del panel.
- **FR-2**: un cartel (`#filtros-estado`, `role="status"`) dice siempre el estado: `Filtros aplicados (Tienda: Mexx · hasta $90.000):
  12 de 40 resultados.`, `ningun resultado (hay N sin filtrar)` y, si el borrador difiere de lo aplicado, `Tenes cambios sin
  aplicar`. Sin filtros ni cambios pendientes, esta oculto.
- **FR-3**: «Quitar filtros» limpia borrador y aplicados y vuelve a pintar.
- **FR-4**: sin resultados por los filtros, la lista dice cuales son y cuantos avisos habia sin filtrar.
- **FR-5**: «Mejor precio aca» (en Afuera) nunca muestra un precio que la lista no tiene sin decirlo: con filtros es el mas barato de lo
  que dejan (`con tus filtros`); si no dejan nada, dice `Con tus filtros no hay nada aca. Sin filtros, el mejor precio es ...`.

## Pruebas

`tests/js/filtros.test.js` (copiarFiltros, mismosFiltros, describirFiltros, estadoDeFiltros), `tests/js/filtros-ui.test.js`,
`tests/js/afuera.test.js` y `tests/e2e/buscar.spec.js`.
