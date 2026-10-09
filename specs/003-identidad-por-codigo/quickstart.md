# Quickstart: validar la feature

1. `python -m unittest discover -s tests -t .` y `node --test "tests/js/*.test.js"`: todo verde.
2. `python indexar.py --solo-modelos indice.json` (o la corrida normal): la columna `modelo` queda llena
   para RAM, SSD y placas de video.
3. `python cobertura.py indice.json --salida cobertura.json`: ver avisos, con codigo y agrupados por rubro.
4. Servir el sitio, buscar un modelo vendido por dos tiendas con el mismo codigo: una fila con dos precios,
   el mas barato marcado; la mediana y el conteo dicen "N productos en M avisos".
5. Revisar a mano la muestra de grupos de cada rubro (`python cobertura.py --muestra ram`): 0 grupos que
   junten modelos distintos (SC-001).
6. Comparar el peso de `indice.json` con el anterior: no mas de 5% (SC-005).
