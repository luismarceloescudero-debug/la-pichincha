# Spec 054: pasada de pruebas del 31/10 y arreglos

Informe: `docs/pruebas-2026-10-31.md`. Cada arreglo sale en su PR chico.

## A. Pestaña Ofertas con precios que no cierran (PR 1)

- Una baja propia de mas de 60 % no es oferta (error de carga mas probable que baja real); de mas de 40 % si la trae un
  agregador (ComparaYa arrastra precios viejos). Se cuentan en `sospechosas`. 31/10: RTX 5080 «−70 %» y RTX 5070 Ti, las dos a
  $1.330.114 via ComparaYa.
- La pestaña usa el mismo `unico` que el resumen del dia: el mismo equipo en varias tiendas queda una vez, el mas barato
  (31/10: tres veces la Corsair SCUF, dos la HP 250 y dos la Galaxy A37).
- `guardia.js` pasa a `REGLAS = "054"`: la cantidad de ofertas por categoria no se compara con la corrida anterior.

## C. Busqueda en celular (Lighthouse 34): ofertas en un Web Worker (PR 3)

Medido el 31/10 con el indice publicado (30.859 avisos, 9,4 MB) en una PC, sin limitar la CPU:

- Antes: `/?q=monitor 27 oled#buscar` tiene una tarea larga de **1.157 ms** (mas otras de 193, 219 y 323 ms), 1.892 ms de tareas largas en total.
  La de 1.157 ms es `calcularOfertas`, que la primera busqueda llamaba sin esperar porque el orden «Mejor oferta» usa la baja del
  aviso para desempatar (`bajaDe` en `js/modos.js`). Con la CPU ×4 de Lighthouse son ~4,6 s de un tiron.
- Ahora: `js/ofertas-worker.js` baja el mismo `indice.json` (esta en la cache), calcula `calcularOfertas` y devuelve el resultado por
  posicion (`Ofertas.codificar`/`decodificar`: una fila no sobrevive a `postMessage`). La primera busqueda ordena sin las ofertas
  (`ctx.ofertasYa`) y la pagina se repinta cuando llegan, como ya hacia con «otra tienda lo tiene mas barato». Si no hay Worker,
  falla o su indice no es el de la pagina, se calcula en el hilo principal como antes.
- Resultado: tarea mas larga **419 ms**, 1.205 ms en total (la suma sobre 50 ms baja ~40 %).

Lo que queda (otra spec): bajar el indice entero (1,8 MB comprimido) antes del primer pintado. Partirlo por categoria
(`indice-<categoria>.json`, la de la consulta primero) y parsearlo en un Worker (244 ms de `JSON.parse` en una PC) son los dos pasos
que siguen; el segundo toca `indexar.py`, el service worker y la busqueda sin conexion.
