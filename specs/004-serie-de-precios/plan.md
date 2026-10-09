# Implementation Plan: Serie de precios por producto

**Branch**: `004-serie-de-precios` | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)

## Summary

Un modulo nuevo, `serie.py` (stdlib), lee todos los CSV del historial (rama `historial`), reconstruye la serie de cada
producto llevando el precio hacia adelante y calcula tres letras de sello: `m` (minimo de 30 dias), `h` (minimo de 90
dias) y `x` (subio antes de la oferta). `indexar.py` las suma a la columna `sellos` de cada fila. En JS, la tabla
`SELLOS` de `js/buscador.js` gana tres entradas y todo lo que hoy muestra sellos (busqueda, ofertas, paginas por
busqueda) los muestra sin tocar nada mas. `cobertura.py` cuenta cuantos avisos tienen cada sello y de cuantos dias es
el historial.

## Technical Context

**Language/Version**: Python 3.12 stdlib; JS de navegador sin build; Node 22 para tests.

**Primary Dependencies**: ninguna nueva.

**Storage**: el historial existente (CSV mensual `fecha,tienda,id,precio`); sellos en la columna `sellos` del indice.

**Testing**: `unittest` con historiales sinteticos que cubren cada caso; `node --test` para la tabla de sellos.

**Constraints**: principio II (solo se afirma lo que el historial prueba), principio V (sin vistas nuevas), indice +1% como maximo.

**Scale/Scope**: ~8.500 productos, un CSV por mes; leer toda la historia en cada corrida (miles de filas por dia) es barato.

## Constitution Check

| Principio | Cumple | Nota |
|---|---|---|
| I. Estatico primero | Si | Todo se calcula en la Action; el navegador solo muestra letras. |
| II. Datos honestos | Si | Sin historia suficiente no hay sello; la rebaja inflada se afirma con reglas fijas y probadas. |
| III. Respeto a las fuentes | Si | Sin pedidos nuevos. |
| IV. Pruebas antes de publicar | Si | TDD con historiales sinteticos por caso. |
| V. Medir antes de agregar UI | Si | Solo sellos en componentes existentes; sin grafico. Se mide cuantos avisos los llevan. |

## Project Structure

```text
serie.py                  # NUEVO: cargar(carpeta), sellos_de(serie, hoy, precio, ...)
indexar.py                # suma las letras de serie a `sellos`
js/buscador.js            # SELLOS: m, h, x
cobertura.py              # cuenta de sellos de serie y dias de historia
tests/test_serie.py, tests/js/buscador.test.js (sellos), tests/test_cobertura.py
```

**Structure Decision**: modulo aparte y puro (recibe la serie y la fecha, devuelve letras) para probar cada caso sin
tocar archivos ni red.
