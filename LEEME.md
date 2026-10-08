# Historial de precios de La Pichincha

Lo escribe la Action de `main` despues de cada relevamiento. Un archivo por
mes, `AAAA-MM.csv`, con solo los cambios:

| Columna | Que es |
| --- | --- |
| `fecha` | Dia del relevamiento, en hora argentina |
| `tienda` | Clave de la fuente en `tiendas.json` |
| `id` | URL del producto |
| `precio` | Pesos, con IVA. Vacio: ese dia dejo de publicarse |

Para saber cuanto valia un producto un dia, se recorren los meses en orden y
gana la ultima fila de ese `(tienda, id)` hasta esa fecha. `historial.py` en
`main` hace exactamente eso.

El primer archivo arranca con la foto completa del indice del 2026-10-07.
