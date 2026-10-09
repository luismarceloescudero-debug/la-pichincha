# Tasks: Identidad de producto por codigo de modelo

**Input**: `specs/003-identidad-por-codigo/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: INCLUIDOS. Principio IV (TDD, no negociable): cada tarea escribe primero el test, lo ve fallar y despues implementa. Los fixtures son nombres reales sacados del indice.

**Formato**: `- [ ] TID [P?] [US?] Descripcion con ruta`. `[P]` = en paralelo (otro archivo, sin depender de una tarea incompleta).

## Phase 1: Setup

- [ ] T001 [P] Sacar de `indice.json` un archivo de fixtures `tests/fixtures/nombres_modelo.json` con nombres reales por rubro (ram, ssd, gpu): para cada rubro, 30 con codigo valido de fabricante, 30 con "falso codigo" (velocidad, capacidad, formato, chipset, placa madre) y 10 ambiguos (dos codigos o kit distinto), cada uno con el resultado esperado escrito a mano

## Phase 2: Foundational (bloquea las historias)

- [ ] T002 Tests que fallan en `tests/test_modelo.py` para `rubro_de(nombre)` y `bloqueado_para_agrupar(nombre)` (ver `contracts/reglas-de-modelo.md`): rubros por palabras, nombre en dos rubros -> `None`, usado/reacondicionado/refurbished/open box/bulk/oem -> bloqueado; luego crear `modelo.py` y hacerlos pasar
- [ ] T003 Tests que fallan en `tests/test_modelo.py` para `codigo_de_modelo(nombre, rubro)` contra los fixtures de T001 (los validos devuelven el codigo normalizado, los falsos y ambiguos devuelven `None`; `KF432C16BB/16` y `KF432C16BB1/16` dan codigos distintos; el resultado no depende del orden)
- [ ] T004 Implementar las reglas por rubro en `modelo.py` (RAM, SSD y placas de video, lista blanca de formas de part number mas lista negra de especificaciones) y hacer pasar T003; cada falso positivo nuevo que aparezca entra primero como fixture
- [ ] T005 Test que falla y luego columna `modelo` en el indice: en `tests/test_indexar.py`, la fila indexada lleva `modelo` en la posicion 9 (vacio fuera de los tres rubros o sin codigo), `FILA_VACIA` y `campos` la incluyen, y un indice viejo sin la columna se lee igual; implementar en `indexar.py`

## Phase 3: User Story 3 - Nunca un grupo mal armado (P1) MVP

**Meta**: solo se agrupa con codigo exacto. **Prueba independiente**: la muestra revisada de grupos reales no junta modelos distintos.

- [ ] T006 [US3] Tests que fallan en `tests/js/agrupado.test.js` para `agruparPorModelo(filas)` en `js/buscador.js`: mismo codigo en tiendas distintas -> grupo; sin codigo, codigo unico o una sola tienda -> fila suelta; dos avisos de la misma tienda -> una sola vez con su precio mas bajo (FR-009); capacidades distintas en el nombre con el mismo codigo -> no se agrupa; bloqueados (usado, bulk) no se agrupan con nuevos; el resultado es igual con las filas en cualquier orden (FR-012)
- [ ] T007 [US3] Implementar `agruparPorModelo` en `js/buscador.js` (funcion pura, igualdad exacta) y hacer pasar T006
- [ ] T008 [US3] Test de precision `tests/test_precision_grupos.py`: sobre `indice.json` real, cada grupo (mismo `modelo`, tiendas distintas) tiene un solo codigo, ninguna capacidad ni cantidad distinta y nunca mezcla bloqueados con nuevos; imprime los grupos que falla; ajustar las reglas de `modelo.py` hasta que pase (SC-001)

## Phase 4: User Story 1 - Ver un producto con el precio de cada tienda (P1)

**Prueba independiente**: buscar un modelo con dos tiendas y ver una fila con los dos precios, y uno de una sola tienda sin cambios.

- [ ] T009 [P] [US1] Tests que fallan en `tests/js/generador.test.js`: la tabla de una pagina por busqueda muestra el grupo como una fila de producto con un precio por tienda, el mas barato marcado, enlaces a cada tienda y avisos de precio no verificado conservados; los avisos sueltos salen igual que hoy
- [ ] T010 [P] [US1] Tests que fallan en `tests/js/pagina.test.js` o `buscador.test.js` para el armado de la fila de grupo (texto, orden por precio, marca de la mas barata) como funcion pura de `js/pagina.js`
- [ ] T011 [US1] Implementar la fila de grupo en `js/pagina.js`, usarla en `js/busqueda.js` (resultados interactivos, dentro de la fila existente, estilo con variables del sitio, claro y oscuro) y en `generar_paginas.js` (tabla y JSON-LD: el grupo cuenta una vez); hacer pasar T009 y T010
- [ ] T012 [US1] Verificar en el navegador con `?q=` de un modelo agrupado y de uno suelto, en tema claro y oscuro, y tomar capturas antes y despues

## Phase 5: User Story 2 - Que el mejor precio sea comparable (P1)

- [ ] T013 [P] [US2] Tests que fallan en `tests/js/buscador.test.js`: la mediana y la mejor compra cuentan cada grupo una vez con su precio mas bajo (modelo repetido en 3 tiendas + uno unico = 2 productos); el conteo dice "N productos en M avisos" solo cuando hay grupos
- [ ] T014 [US2] Implementar en `js/buscador.js` y cablear en `js/busqueda.js` y `generar_paginas.js` (mediana, mejor compra, texto de conteo, meta description si lo cita); hacer pasar T013 y mantener verdes los tests existentes de analisis
- [ ] T015 [US2] Test y ajuste: la exportacion (CSV, Excel, texto) y los enlaces compartidos siguen trayendo cada aviso individual (FR-013)

## Phase 6: User Story 4 - Saber cuanto cubre (P2)

- [ ] T016 [P] [US4] Tests que fallan en `tests/test_cobertura.py` para `cobertura.py` (ver `contracts/cobertura.md`): informe por rubro con avisos, con_codigo, agrupados y grupos; la comparacion con el informe anterior marca una caida de mas de 10 puntos; sin anterior o con anterior ilegible sigue sin fallar
- [ ] T017 [US4] Implementar `cobertura.py` y hacer pasar T016
- [ ] T018 [US4] Agregar a `.github/workflows/actualizar.yml`, despues de indexar: bajar el `cobertura.json` publicado (tolerando falla), correr `python cobertura.py indice.json --salida _sitio/cobertura.json --previa ... --resumen "$GITHUB_STEP_SUMMARY"`; test en `tests/test_cobertura.py` de que el paso existe

## Phase 7: Cierre

- [ ] T019 Correr `cobertura.py` sobre el indice real y anotar en `quickstart.md` y en el PR la cobertura por rubro (SC-002) y el crecimiento del indice (SC-005)
- [ ] T020 [P] Actualizar `README.md` (seccion "Identidad por codigo de modelo": reglas por rubro, como agregar una, cobertura) y marcar F2.1 en `docs/plan-de-escalado.md`
- [ ] T021 Correr `/speckit-analyze`, ambas suites y una revision de seguridad; abrir el PR contra `main`; con CI en verde, mergear (rebase) y verificar el deploy: `cobertura.json` publicado, columna `modelo` en `indice.json`, un grupo en una pagina de `/precios/`

## Dependencias y orden

- Phase 1 -> Phase 2 (T002 -> T003 -> T004 -> T005).
- US3 (Phase 3) depende de Phase 2; US1 y US2 dependen de T007; US4 depende de T005 y T007.
- Phase 7 al final.

## Oportunidades de paralelo

- T009 con T010; T013 en paralelo con T009/T010 (mismos archivos de JS pero tests separados); T016 con T009.

## Estrategia

1. **MVP**: Phases 1, 2 y 3 (extraccion segura y agrupado exacto) mas US1: sin ver el grupo no hay valor, y sin la precision de US3 no se publica.
2. US2 corrige los numeros (mediana y conteo) en el mismo PR para que el sitio nunca muestre grupos con el conteo viejo.
3. US4 cierra con la medicion.
