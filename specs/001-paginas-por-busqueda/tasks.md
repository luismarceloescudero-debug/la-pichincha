# Tasks: Paginas por busqueda popular

**Input**: `specs/001-paginas-por-busqueda/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: INCLUIDOS. El principio IV de la constitucion (TDD, no negociable) los exige: cada tarea de codigo escribe primero el test, lo ve fallar y despues implementa.

**Formato**: `- [ ] TID [P?] [US?] Descripcion con ruta`. `[P]` = se puede hacer en paralelo (otro archivo, sin depender de una tarea incompleta).

## Phase 1: Setup

- [ ] T001 Medir la linea de base de la Comparativa: con el preview local, guardar en `specs/001-paginas-por-busqueda/base-analisis.json` mejor compra, mediana, total, comparables y exclusiones de 10 consultas (ssd 1tb, rtx 4060, ryzen 5, monitor 27, ddr4 16gb, fuente 650w, ipad, mouse inalambrico, webcam, silla gamer)
- [ ] T002 [P] Crear `css/sitio.css` con el contenido del `<style>` de `index.html` (sin cambiar una regla) y cargarlo con `<link rel="stylesheet" href="css/sitio.css">` dentro del bloque `solo-web`; ajustar `armar_artifact` en `actualizar.py` para inlinear los `<link>` de `css/` en la copia del artifact, con su test en `tests/test_build.py`; copiar `css` en el paso "Preparar el sitio" de `.github/workflows/actualizar.yml`

## Phase 2: Foundational (bloquea todas las historias)

- [ ] T003 Test que falla en `tests/js/analisis.test.js`: `analizarConsulta(q, ctx)` devuelve para una mini-indice de prueba `total`, `base`, `med`, `picks`, `comercios`, `excl` e `internacionales` iguales a los valores esperados (usar casos de `tests/js/buscador.test.js`)
- [ ] T004 Crear `js/analisis.js` (script clasico con `module.exports`, como `js/buscador.js`): mover `analizarConsulta` y sus ayudantes puros (`comercioDe`, `colorDe`, `nivelMarca` por parametro) desde `index.html`; `ctx` = `{ idx, marcas }`. Hacer pasar T003
- [ ] T005 Cablear `index.html`: cargar `js/analisis.js` y reemplazar la funcion movida por un envoltorio con el mismo nombre; correr `python actualizar.py --build`, ambas suites y comparar contra `base-analisis.json` (T001): tiene que ser identico
- [ ] T006 [P] Test que falla en `tests/test_generar_paginas.py`: `slug("Monitor 27\" 144hz")` -> `monitor-27-144hz`, minusculas, sin acentos, solo letras, numeros y guiones; dos consultas con el mismo slug -> error que nombra ambas; consulta de menos de 2 o mas de 60 caracteres -> error
- [ ] T007 Crear `generar_paginas.py` con `slug()` y `cargar_consultas(ruta)` (valida segun `contracts/consultas.schema.md`); hacer pasar T006

**Checkpoint**: la logica de analisis es una sola y esta probada; la base para las paginas existe.

## Phase 3: User Story 1 - Llegar desde Google a una comparacion ya armada (P1) MVP

**Meta**: una pagina completa por consulta, legible sin scripts.
**Prueba independiente**: leer `_sitio/precios/ssd-1tb/index.html` sin ejecutar scripts y ver todo el contenido (SC-002, SC-004).

- [ ] T008 [P] [US1] Test que falla en `tests/js/generador.test.js`: `renderPagina(analisis, consulta, ctx)` contiene `<h1>` con la consulta, la hora de los precios (`Pagina.cuando`), mejor compra con su razon, mediana, y una tabla de a lo sumo 20 filas con nombre, comercio, precio, sellos y enlace con `rel="noopener"`
- [ ] T009 [P] [US1] Test que falla en `tests/js/generador.test.js`: una fila de una fuente con `relevado` de otro dia muestra "precio del D/M" (`Pagina.precioDel`) (FR-017); las internacionales aparecen marcadas y nunca como mejor compra
- [ ] T010 [P] [US1] Test que falla en `tests/js/generador.test.js`: con menos de 5 comparables la pagina dice "hoy no hay opciones suficientes", ofrece el buscador y lleva `<meta name="robots" content="noindex,follow">`; con 5 o mas no lleva esa etiqueta
- [ ] T011 [US1] Crear `generar_paginas.js`: lee `indice.json`, `datos.json` (marcas) y `consultas.json`, y escribe `precios/<slug>/index.html` con `renderPagina`; todo texto escapado; sin indice no genera nada y avisa (FR-016). Hacer pasar T008 a T010
- [ ] T012 [US1] Completar `generar_paginas.py`: orquesta `node generar_paginas.js`, valida que existan todas las paginas y copia a la carpeta de salida (`--indice`, `--salida`); test en `tests/test_generar_paginas.py` con un indice mini y Node real
- [ ] T013 [US1] Crear `consultas.json` con ~50 consultas elegidas del indice (rubros con muchos avisos y 3 o mas comercios, con `nota`), y **mostrarsela al dueño para que la revise antes de seguir**
- [ ] T014 [US1] Comparar la mejor compra y la mediana de 10 paginas generadas contra `base-analisis.json` y contra la Comparativa en el navegador (SC-004); guardar las capturas en tema claro y oscuro

## Phase 4: User Story 2 - Seguir al analisis interactivo (P2)

**Prueba independiente**: tocar el boton de una pagina abre la Comparativa de esa consulta.

- [ ] T015 [P] [US2] Test que falla en `tests/js/generador.test.js`: la pagina trae un enlace "Ver la comparativa completa" a `<BASE>/?q=<consulta codificada>#comparativa` (usar `Pagina.armarUrl`) y los enlaces a tiendas son los de cada aviso
- [ ] T016 [US2] Implementar el enlace y cargar el script de GoatCounter y `js/pagina.js` en las paginas para medir `clic_saliente`, igual que el sitio (FR-013); verificar en el navegador con un `goatcounter` de mentira

## Phase 5: User Story 3 - Que los buscadores descubran y entiendan las paginas (P2)

**Prueba independiente**: el sitemap lista las paginas indexables y el JSON-LD pasa el validador.

- [ ] T017 [P] [US3] Test que falla en `tests/js/generador.test.js`: el JSON-LD es JSON valido con `ItemList` (hasta 20 `Product` con `Offer` en ARS), `AggregateOffer` (`lowPrice`, `highPrice`, `offerCount`, `priceCurrency: "ARS"`) y `BreadcrumbList`; titulo y descripcion propios con "desde $X" y la mediana; canonical absoluto y `og:*` con `img/og.png`
- [ ] T018 [P] [US3] Test que falla en `tests/test_generar_paginas.py`: `sitemap.xml` lista `/`, `/precios/` y solo las paginas indexables con `lastmod` = fecha de los precios; `robots.txt` trae `Allow: /` y `Sitemap:`; las no indexables no figuran
- [ ] T019 [US3] Implementar metadatos, JSON-LD, `BASE_URL` en una sola constante (FR-015), `sitemap.xml` y `robots.txt`; hacer pasar T017 y T018
- [ ] T020 [US3] Validar 5 paginas con el validador de datos estructurados de Google y revisar con la skill `seo-audit` (titulos, descripciones, canonicals); corregir lo que marque

## Phase 6: User Story 4 - La lista crece con lo que busca la gente (P3)

**Prueba independiente**: agregar una consulta a `consultas.json` y publicar crea su pagina y su entrada en el sitemap.

- [ ] T021 [P] [US4] Test que falla en `tests/test_generar_paginas.py`: agregar una consulta crea su pagina y su entrada; una consulta con pocos comparables genera la pagina `noindex` y no entra al sitemap
- [ ] T022 [US4] Crear el indice `precios/index.html` (hub) que enlaza todas las paginas indexables, con su titulo y descripcion, y agregar el enlace desde `index.html` (FR-011); test en `tests/js/generador.test.js`
- [ ] T023 [US4] Documentar en el README como agregar consultas y como mirar `busqueda` y `busqueda_vacia` en GoatCounter para elegirlas

## Phase 7: Publicacion y cierre

- [ ] T024 Agregar a `.github/workflows/actualizar.yml`, despues de armar el indice, el paso `python generar_paginas.py --indice indice.json --salida _sitio` y copiar `sitemap.xml` y `robots.txt`; medir que el paso tarde menos de 2 minutos (SC-007)
- [ ] T025 [P] Capturas de 3 paginas en tema claro, oscuro y telefono (SC-006)
- [ ] T026 [P] Actualizar `README.md`: seccion "Paginas por busqueda" (estructura, lista, sitemap, como dar de alta en Search Console y Bing)
- [ ] T027 Correr `/speckit-analyze`, ambas suites y `/review`; abrir el PR contra `main` con CI en verde. **El merge necesita el OK del dueño** (despliega el sitio)

## Dependencias y orden

- Phase 1 -> Phase 2 (T003-T005 bloquean todo; T006-T007 son independientes y van en paralelo)
- US1 (T008-T014) es el MVP y depende de la Phase 2.
- US2 y US3 dependen de US1 (`renderPagina`); entre si son independientes.
- US4 depende de US1 y US3 (sitemap). Phase 7 va al final.

## Oportunidades de paralelo

- T002 con T001; T006-T007 con T003-T005.
- Los tests T008, T009 y T010 se escriben juntos; T017 y T018 tambien.

## Estrategia

1. **MVP**: Phases 1, 2 y 3. Con eso ya hay paginas generadas y verificadas; se puede publicar solo eso.
2. Sumar US2 y US3 (enlace, medicion, datos estructurados, sitemap): sin ellas Google no las encuentra bien.
3. US4 y cierre.
