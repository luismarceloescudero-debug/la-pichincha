# Quickstart: validar la feature

1. `python -m unittest discover -s tests -t .` y `node --test "tests/js/*.test.js"`: todo verde.
2. Correr el indexado (`python indexar.py`): la columna `modelo` queda en la ultima posicion de cada fila;
   CompraGamer aporta su SKU (`codigo_principal`).
3. `python cobertura.py indice.json --salida cobertura.json`: avisos, con codigo y agrupados por rubro.
4. Servir el sitio y buscar un modelo vendido por dos tiendas con el mismo codigo (por ejemplo `sedc600m`):
   una fila con "mismo modelo en 2 tiendas" y debajo "Tambien en ..."; el conteo dice "N productos en M avisos".
5. Revisar a mano los grupos (el script de cobertura los cuenta; listar con `modelo.py` sobre el indice): 0 que
   junten modelos distintos (SC-001).
6. Comparar el peso de `indice.json` con el anterior: no mas de 5% (SC-005).

## Resultado medido (indice del 2026-10-09, con SKU de CompraGamer)

| Rubro | Avisos | Con codigo | Grupos |
|---|---:|---:|---:|
| ram | 278 | 74 (27%) | 0 |
| ssd | 173 | 40 (23%) | 2 |
| gpu | 515 | 67 (13%) | 2 |

Los 4 grupos revisados a mano son el mismo producto: Kingston DC600M 480G y 1920G (Gaming City y FullH4rd),
ASUS DUAL RTX 3060 O12G V2 y ASUS PRIME RTX 5080 O16G (CompraGamer y ComparaYa).
