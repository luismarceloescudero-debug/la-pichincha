# Spec 054: pasada de pruebas del 31/10 y arreglos

Informe: `docs/pruebas-2026-10-31.md`. Cada arreglo sale en su PR chico.

## A. Pestaña Ofertas con precios que no cierran (PR 1)

- Una baja propia de mas de 60 % no es oferta (error de carga mas probable que baja real); de mas de 40 % si la trae un
  agregador (ComparaYa arrastra precios viejos). Se cuentan en `sospechosas`. 31/10: RTX 5080 «−70 %» y RTX 5070 Ti, las dos a
  $1.330.114 via ComparaYa.
- La pestaña usa el mismo `unico` que el resumen del dia: el mismo equipo en varias tiendas queda una vez, el mas barato
  (31/10: tres veces la Corsair SCUF, dos la HP 250 y dos la Galaxy A37).
- `guardia.js` pasa a `REGLAS = "054"`: la cantidad de ofertas por categoria no se compara con la corrida anterior.
