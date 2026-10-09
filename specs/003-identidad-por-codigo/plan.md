# Implementation Plan: Identidad de producto por codigo de modelo

**Branch**: `003-identidad-por-codigo` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-identidad-por-codigo/spec.md`

## Summary

Un modulo nuevo en Python, `modelo.py`, saca el codigo de modelo del nombre de cada aviso con reglas por rubro
(RAM, SSD, placa de video) y `indexar.py` lo guarda en una columna nueva del indice (`modelo`). El
agrupado es solo igualdad exacta de ese texto: una funcion pura en `js/buscador.js`
(`agruparPorModelo`) la usan la busqueda interactiva y el generador de paginas por busqueda, asi los dos
muestran los mismos grupos y cuentan un producto una vez en la mediana. Un script, `cobertura.py`, calcula
por rubro cuantos avisos tienen codigo y cuantos quedaron agrupados, lo publica en `cobertura.json` y lo
vuelca en el resumen de la Action, avisando si cae mas de 10 puntos. Sin pantallas nuevas: el grupo se
dibuja dentro de la fila de resultado existente.

## Technical Context

**Language/Version**: Python 3.12 stdlib (extraccion, indice, cobertura); JS de navegador sin build (agrupado y vista), Node 22 para los tests y el generador.

**Primary Dependencies**: ninguna nueva.

**Storage**: columna `modelo` en `indice.json` (posicion 9, despues de `sellos`); `cobertura.json` publicado junto al sitio.

**Testing**: `unittest` (reglas de extraccion con nombres reales de cada tienda como fixtures, cobertura) y `node --test` (agrupado, mediana, conteo, vista).

**Target Platform**: sitio estatico en GitHub Pages; sin backend.

**Project Type**: sitio estatico generado por una Action diaria.

**Performance Goals**: SC-004 (nada mas lento) y SC-005 (indice no crece mas de 5%, unos 97 KB sobre 1,9 MB).

**Constraints**: principio II (un grupo mal armado es peor que ninguno: precision antes que cobertura), sin dependencias nuevas, sin vistas nuevas, el indice sigue siendo posicional y compatible hacia atras (`FILA_VACIA`).

**Scale/Scope**: ~8.500 avisos; RAM ~800, SSD ~850, placas de video ~840 (probados hoy sobre el indice real); 5 tiendas.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| I. Estatico primero | Si | Todo se calcula al construir el indice; el navegador solo compara textos. |
| II. Datos honestos | Si | Coincidencia exacta o nada; lo dudoso queda suelto; mediana y conteo cuentan un producto una vez. |
| III. Respeto a las fuentes | Si | No hay pedidos nuevos a las tiendas. |
| IV. Pruebas antes de publicar | Si | TDD con nombres reales; ademas un test de precision que falla si un grupo del indice real junta modelos distintos. |
| V. Medir antes de agregar UI | Si | Sin vistas nuevas: el grupo vive en la fila existente; se mide la cobertura. |

Sin violaciones. Re-evaluado tras el diseno: igual.

## Project Structure

### Documentation (this feature)

```text
specs/003-identidad-por-codigo/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── reglas-de-modelo.md
│   └── cobertura.md
└── tasks.md             # lo crea /speckit-tasks
```

### Source Code (repository root)

```text
modelo.py                # NUEVO: rubro_de(nombre), codigo_de_modelo(nombre, rubro)
cobertura.py             # NUEVO: informe por rubro, comparacion con el anterior, resumen de la Action
indexar.py               # escribe la columna `modelo`; FILA_VACIA gana un campo
js/buscador.js           # agruparPorModelo(filas), medianaDeGrupos, conteo productos/avisos
js/busqueda.js           # dibuja el grupo dentro de la fila existente
generar_paginas.js       # mismas filas agrupadas en la tabla del servidor y en el JSON-LD
.github/workflows/actualizar.yml   # corre cobertura.py y publica cobertura.json
tests/test_modelo.py, tests/test_cobertura.py, tests/js/agrupado.test.js
```

**Structure Decision**: la extraccion vive en Python porque es una regla de datos que se prueba con
fixtures y no debe pesar en el navegador; el agrupado es una funcion pura de JS porque lo necesitan el
navegador y el generador de paginas y ya comparten `js/buscador.js`.

## Complexity Tracking

Sin violaciones.
