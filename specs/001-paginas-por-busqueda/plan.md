# Implementation Plan: Paginas por busqueda popular

**Branch**: `001-paginas-por-busqueda` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-paginas-por-busqueda/spec.md`

## Summary

Cada publicacion genera una pagina estatica `/precios/<slug>/` por consulta de una lista editable
(`consultas.json`), un indice `/precios/`, `sitemap.xml` y `robots.txt`. Para que la pagina y la
Comparativa interactiva den siempre lo mismo (FR-004), la logica de analisis de una consulta se
saca de `index.html` a un modulo puro, `js/analisis.js`, que usan **los dos**: el navegador y un
generador de Node (`generar_paginas.js`) que corre en la Action. Python solo orquesta (carga el
indice, llama a Node, valida la salida).

## Technical Context

**Language/Version**: JS de navegador sin build (scripts clasicos, como `js/buscador.js`), Node 22 solo para el generador; Python 3.12 stdlib para orquestar.

**Primary Dependencies**: ninguna nueva. Node ya esta en el job de tests y en `ubuntu-latest`.

**Storage**: archivos. Entrada: `indice.json`, `datos.json` (marcas), `consultas.json`. Salida: `_sitio/precios/**`, `sitemap.xml`, `robots.txt`.

**Testing**: `node --test` para `analisis.js` y el generador; `unittest` para el orquestador, el slug unico y el sitemap.

**Target Platform**: GitHub Pages (estatico).

**Project Type**: sitio estatico generado por una Action.

**Performance Goals**: SC-007, menos de 2 minutos extra por publicacion; con ~50 paginas el costo esperado es de segundos.

**Constraints**: contenido completo sin scripts del navegador; tema claro y oscuro; precios sin verificar con su fecha; sin cookies.

**Scale/Scope**: 50 paginas iniciales, crecer a 300; indice de ~7.800 productos.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| I. Estatico primero | Si | Todo se genera en la Action. Python stdlib; el generador Node no suma dependencias. |
| II. Datos honestos | Si | Hora de los precios, "precio del 7/10" para fuentes sin relevar (FR-017), internacionales fuera de la mejor compra, aviso de lo que queda afuera. Nada depende de comisiones. |
| III. Respeto a las fuentes | Si | No hay pedidos nuevos a las tiendas: se usa el indice del dia. |
| IV. Pruebas antes de publicar | Si | TDD; los tests corren en el job `tests` antes de generar. |
| V. Medir antes de agregar UI | Si | UI nueva minima (paginas de contenido); mismos eventos de GoatCounter; los datos de `busqueda_vacia` alimentan la lista. |

Sin violaciones; sin tabla de complejidad. Re-evaluado tras el diseno: igual.

## Project Structure

### Documentation (this feature)

```text
specs/001-paginas-por-busqueda/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── pagina-consulta.md
│   └── consultas.schema.md
└── tasks.md             # lo crea /speckit-tasks
```

### Source Code (repository root)

```text
js/
├── buscador.js          # existente
├── pagina.js            # existente
└── analisis.js          # NUEVO: analizarConsulta y ayudantes puros (sale de index.html)
generar_paginas.js       # NUEVO: lee indice y consultas, escribe paginas, indice y sitemap
generar_paginas.py       # NUEVO: orquesta, valida y copia a _sitio
consultas.json           # NUEVO: lista editable de consultas
css/sitio.css            # NUEVO: estilos compartidos (salen del <style> de index.html)
tests/
├── js/analisis.test.js, generador.test.js
└── test_generar_paginas.py
```

**Structure Decision**: un modulo puro compartido (`analisis.js`) garantiza FR-004 por construccion; el CSS pasa a un archivo compartido para que paginas y sitio se vean igual (FR-012), primera pieza de F1.1.

## Complexity Tracking

Sin violaciones.
