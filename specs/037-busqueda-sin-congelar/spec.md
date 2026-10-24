# Feature Specification: La busqueda no congela el telefono calculando las ofertas

**Created**: 2026-10-24

**Status**: Implementada (primer paso del punto 2 de `docs/plan-v3.md`).

**Input**: Lighthouse movil del 24/10 sobre `/?q=notebook lenovo`: rendimiento 71, 2,3 s de bloqueo; `arranque.js` con una tarea
larga de 2 s. Perfil de CPU con el procesador frenado 4 veces: buscar y analizar una consulta tarda 100-150 ms; lo que pesa es
`calcularOfertas` sobre los 30 mil avisos (cerca de 1 s entre `memoriaDe`, `hzDe`, `aniosDe`, `aspectosDe`...), que
`asegurarIndice` corria apenas bajaba el indice solo para mostrar el numero de la pestaña Ofertas.

## Decision

- `asegurarIndice` ya no calcula las ofertas. `programarOfertas` las calcula cuando el navegador queda libre
  (`requestIdleCallback`, con 4 s de tope; si no existe, `setTimeout`), muestra el numero de la pestaña y vuelve a pintar la
  busqueda abierta para sumar «otra tienda lo tiene más barato».
- `ofertasListas()` las calcula enseguida si las pide la pestaña Ofertas o el modo Súper Oferta.

## Medido (Lighthouse 12.8.2 movil, sitio local con el indice del 24/10, dos corridas)

Bloqueo total (TBT) en `/?q=notebook lenovo`: 3,30 s y 3,23 s antes; 2,28 s y 1,34 s despues. (El LCP local no vale: el
servidor de prueba no comprime y el indice viaja en 9 MB.)

## Lo que sigue

El calculo sigue en el hilo principal, solo que despues. Para sacarlo del todo: calcular las ofertas en un Web Worker (las
claves tienen que pasar de la fila a su posicion, porque el mensaje copia los objetos) y partir el indice por rubro.

## Pruebas

`node --test`: 695 OK. Chromium: la pestaña Ofertas muestra 29 ofertas y 24 tarjetas; la busqueda suma «más barato» al
terminar el calculo; sin errores de consola.
