# Implementation Plan: App instalable que abre sin red

**Branch**: `002-app-instalable` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-app-instalable/spec.md`

## Summary

El sitio gana un manifiesto de app (nombre, iconos, colores, apertura en ventana propia) y un
service worker con una sola regla: **red primero**. Con conexion siempre manda el dato nuevo; lo
guardado solo responde si la red falla o tarda mas de 4 segundos. Un modulo nuevo, `js/app.js`,
compartido por `index.html` y las paginas por busqueda, registra el service worker, detecta la falta
de conexion y muestra el aviso con la fecha de los precios, y mide la instalacion con GoatCounter.
La version del service worker se estampa en cada publicacion: cada deploy descarta lo guardado de la
version anterior.

## Technical Context

**Language/Version**: JS de navegador sin build (scripts clasicos, `module.exports` para Node); Python 3.12 stdlib para estampar la version y copiar los archivos.

**Primary Dependencies**: ninguna nueva.

**Storage**: Cache Storage del navegador (una cache por version). Sin cookies, sin IndexedDB, sin localStorage nuevo.

**Testing**: `node --test` (service worker y `app.js` con un entorno simulado, sin navegador) y `unittest` para el paso de publicacion.

**Target Platform**: navegadores modernos; donde no hay service worker el sitio sigue como hoy.

**Project Type**: sitio estatico generado por una Action.

**Performance Goals**: SC-002 (abrir sin red en menos de 2 s) y SC-007 (cero costo para quien no instala: el registro va despues del evento `load`).

**Constraints**: principio II (nunca precios viejos sin aviso), sin cartel propio de instalar, sin permisos ni cookies, menos de 10 MB guardados sin contar el indice.

**Scale/Scope**: ~12 archivos de la cascara, el indice (~2 MB) y las paginas `/precios/` que se vayan visitando.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| I. Estatico primero | Si | Todo es archivo estatico; el service worker corre en el dispositivo. Sin dependencias. |
| II. Datos honestos | Si | Red primero; sin conexion el aviso dice de cuando son los precios y, pasados 7 dias, que pueden estar viejos. |
| III. Respeto a las fuentes | Si | No toca a las tiendas: las fotos y los enlaces de terceros nunca se guardan. |
| IV. Pruebas antes de publicar | Si | TDD; el service worker se prueba con un entorno simulado y corre en el job `tests`. |
| V. Medir antes de agregar UI | Si | La unica UI nueva es el aviso de sin conexion; la instalacion se mide con GoatCounter. Sin cartel propio de instalar. |

Sin violaciones. Re-evaluado tras el diseno: igual.

## Project Structure

### Documentation (this feature)

```text
specs/002-app-instalable/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── manifiesto.md
│   └── service-worker.md
└── tasks.md             # lo crea /speckit-tasks
```

### Source Code (repository root)

```text
manifest.webmanifest     # NUEVO: nombre, iconos, colores, modo de apertura
sw.js                    # NUEVO: service worker (plantilla con __VERSION__)
sin-red.html             # NUEVO: pagina de "no disponible sin conexion"
js/app.js                # NUEVO: registro del SW, aviso de sin conexion, medicion
img/icono-192.png, icono-512.png, icono-maskable-512.png, apple-touch-icon.png   # NUEVOS
docs/iconos.html         # NUEVO: fuente de los iconos (como docs/og-imagen.html)
publicar_app.py          # NUEVO: estampa la version en sw.js y copia los archivos a _sitio
index.html               # head: manifiesto, theme-color, iconos; carga js/app.js
generar_paginas.js       # las paginas por busqueda cargan js/app.js
tests/js/app.test.js, tests/js/sw.test.js, tests/test_publicar_app.py
```

**Structure Decision**: un solo modulo de navegador (`js/app.js`) compartido por el sitio y las paginas por
busqueda, y un service worker plano con la logica de decision aislada en funciones probables. El
paso de publicacion es un script chico de Python, igual que `generar_paginas.py`.

## Complexity Tracking

Sin violaciones.
