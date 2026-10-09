# Tasks: App instalable que abre sin red

**Input**: `specs/002-app-instalable/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: INCLUIDOS. El principio IV de la constitucion (TDD, no negociable) los exige: cada tarea de codigo escribe primero el test, lo ve fallar y despues implementa.

**Formato**: `- [ ] TID [P?] [US?] Descripcion con ruta`. `[P]` = se puede hacer en paralelo (otro archivo, sin depender de una tarea incompleta).

## Phase 1: Setup

- [ ] T001 [P] Crear `docs/iconos.html` (misma paleta y tipografia que `docs/og-imagen.html`) y renderizar con Edge sin interfaz `img/icono-192.png` (192x192), `img/icono-512.png` (512x512), `img/icono-maskable-512.png` (512x512 con zona segura) e `img/apple-touch-icon.png` (180x180); comprobar medidas y que cada uno pese menos de 60 KB
- [ ] T002 [P] Test que falla en `tests/test_publicar_app.py`: `manifest.webmanifest` es JSON valido, con `name` "La Pichincha", `lang` "es-AR", `display` "standalone", `start_url` y `scope` relativos, y sus 3 iconos existen con la medida declarada (leida del PNG); luego crear `manifest.webmanifest` segun `contracts/manifiesto.md` con los colores de `css/sitio.css`

## Phase 2: Foundational (bloquea las historias)

- [ ] T003 Tests que fallan en `tests/js/sw.test.js` (entorno simulado: `caches`, `fetch` y reloj falsos) para `responder(pedido, entorno)` de `sw.js`: red buena -> devuelve la red y guarda copia; red que falla -> devuelve lo guardado; red que tarda mas de 4 s -> devuelve lo guardado; red con error 500 -> no pisa lo guardado y devuelve lo guardado si hay; sin red y sin copia en una navegacion -> `sin-red.html`; otro origen y metodos que no son GET -> no se tocan; red buena nunca devuelve lo guardado
- [ ] T004 Crear `sw.js` (plantilla con `__VERSION__`): `responder`, `install` (guarda cascara, `sin-red.html` e `indice.json`; `skipWaiting`), `activate` (borra toda cache `pichincha-*` distinta de la actual; `clients.claim`) y `fetch`; exportar para Node como `js/buscador.js`. Hacer pasar T003; test extra de `activate` y de la lista de la cascara
- [ ] T005 Test que falla y luego crear `publicar_app.py` en `tests/test_publicar_app.py`: `python publicar_app.py --salida DIR --indice indice.json` estampa `<fecha del indice>-<commit corto>` en `DIR/sw.js` (ningun `__VERSION__` queda), copia `manifest.webmanifest`, `sin-red.html` e iconos, y sin indice usa solo el commit; dos corridas con indices distintos dan versiones distintas (FR-009)

## Phase 3: User Story 1 - Instalar La Pichincha como una app (P1) MVP

**Meta**: el navegador ofrece instalar con nombre, icono y color. **Prueba independiente**: instalar y abrir desde el icono.

- [ ] T006 [P] [US1] Tests que fallan en `tests/test_publicar_app.py` y `tests/js/generador.test.js`: `index.html` y las paginas por busqueda enlazan `manifest.webmanifest` (con ruta relativa a su carpeta), definen `theme-color` para claro y oscuro y el `apple-touch-icon`; ninguno contiene `beforeinstallprompt` ni un boton o cartel de instalar (FR-002)
- [ ] T007 [US1] Agregar esas etiquetas al bloque `solo-web` del `<head>` de `index.html` y a `cabeza()` de `generar_paginas.js`; hacer pasar T006
- [ ] T008 [US1] Crear `sin-red.html` ("no esta disponible sin conexion", con enlace a la principal, mismo estilo) y verificar en el navegador la pagina `/_sitio/` con el manifiesto leido por DevTools (nombre, iconos, colores)

## Phase 4: User Story 2 - Abrir sin conexion con datos que dicen de cuando son (P1)

**Prueba independiente**: visitar, cortar la conexion, reabrir y ver el aviso con la fecha; con conexion, ver el dato nuevo y ningun aviso.

- [ ] T009 [P] [US2] Tests que fallan en `tests/js/app.test.js` para `avisoSinRed(generado, ahora)`: "Sin conexion: estas viendo los precios de hoy 08:12", con la fecha en hora argentina; mas de 7 dias -> `viejo: true` y "pueden estar viejos"; sin fecha o fecha invalida -> "Sin conexion" sin fecha y `viejo: false`
- [ ] T010 [P] [US2] Tests que fallan en `tests/js/app.test.js` para `iniciar(ventana, documento)` con ventana y documento simulados: registra el service worker solo si existe `serviceWorker` y despues de `load`; un HEAD sin cache al manifiesto que falla (o pasa de 5 s) muestra el aviso; que anda lo oculta; los eventos `offline` y `online` lo muestran y lo ocultan; sin `serviceWorker` no hay errores
- [ ] T011 [US2] Crear `js/app.js` (script clasico, `module.exports` para Node): `avisoSinRed` e `iniciar`; hacer pasar T009 y T010
- [ ] T012 [US2] Cablear: `index.html` carga `js/app.js`, tiene el contenedor del aviso (estilo con variables del sitio, claro y oscuro) y le pasa la fecha de `IDX.generado`; `generar_paginas.js` carga `js/app.js` y le pasa el `generado` de la pagina; el aviso no tapa el contenido
- [ ] T013 [US2] Verificar de punta a punta en el navegador: servir `_sitio/`, abrir, detener el servidor, recargar y ver la pagina servida desde lo guardado con el aviso y la fecha; levantar el servidor y ver que desaparece (SC-002, SC-003)

## Phase 5: User Story 3 - Las paginas por busqueda tambien abren sin red (P2)

- [ ] T014 [US3] Test y ajuste: en `tests/js/sw.test.js`, una pagina de `/precios/` visitada se guarda al pasar y se sirve sin red; una no visitada devuelve `sin-red.html` (FR-007); verificarlo en el navegador con una pagina visitada y otra no

## Phase 6: User Story 4 - La app se mantiene al dia sola (P2)

- [ ] T015 [US4] Verificar la actualizacion en el navegador: estampar la version A, abrir, estampar la version B, recargar dos veces y comprobar que queda una sola cache `pichincha-*` con la version B y que se ve el cambio (SC-004); registrar el resultado en `quickstart.md`

## Phase 7: User Story 5 - Saber cuantas personas la instalan (P3)

- [ ] T016 [P] [US5] Tests que fallan en `tests/js/app.test.js`: `appinstalled` registra `app/instalada` una vez; en modo app (`display-mode: standalone`) se registra `app/abierta` una vez por sesion; en el navegador comun no se registra ninguna; si GoatCounter no esta, no hay errores
- [ ] T017 [US5] Implementar los eventos en `iniciar` (usa `window.goatcounter`, mismo patron que el resto del sitio) y hacer pasar T016

## Phase 8: Publicacion y cierre

- [ ] T018 Agregar a `.github/workflows/actualizar.yml`, despues de generar las paginas por busqueda, el paso `python publicar_app.py --salida _sitio --indice indice.json`; medir el peso de lo que guarda (SC-005, menos de 10 MB sin el indice)
- [ ] T019 [P] Actualizar `README.md` (seccion "App instalable": que guarda, red primero, aviso, medicion, como cambiar los iconos) y la tabla de archivos
- [ ] T020 Correr `/speckit-analyze`, ambas suites y una revision de seguridad; abrir el PR contra `main`; con CI en verde, mergear (rebase) y verificar el deploy en el sitio publicado (manifiesto, `sw.js` con version, iconos y registro)

## Dependencias y orden

- Phase 1 y Phase 2 antes de todo; T004 depende de T003, T005 de T004 y T002.
- US1 depende de Phase 1; US2 de Phase 2 y US1 (T012 usa el head); US3 y US4 de Phase 2; US5 de US2 (`iniciar`).
- Phase 8 al final.

## Oportunidades de paralelo

- T001 con T002; T006 con T003; T009, T010 y T016 se escriben juntos (mismo archivo, hacerlo de corrido).

## Estrategia

1. **MVP**: Phases 1, 2 y 3 (instalable), mas US2 para el aviso: sin el aviso, abrir sin red viola el principio II, asi que US2 no se publica a medias.
2. US3 y US4 son verificaciones sobre lo ya construido; US5 cierra con la medicion.
