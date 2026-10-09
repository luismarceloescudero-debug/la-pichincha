# Data Model

## Fila del indice (posicional)
`[nombre, precio, url, tienda, via, lista, antes, imagen, sellos, modelo]`
- `modelo` (texto): codigo de modelo normalizado (mayusculas, sin espacios) o `""` si no hay. Solo se llena
  para RAM, SSD y placas de video. Un indice viejo sin la columna se lee como `""` (sin agrupar).

## Grupo de producto (calculado, no se guarda)
- `modelo`, `filas[]` (una por tienda, la de menor precio de esa tienda), `minimo` (menor precio), `nombre`
  (nombre de la fila mas barata para mostrar), `avisos` (cuantos avisos incluia antes de colapsar tiendas).
- Un grupo existe solo con 2 o mas tiendas distintas con el mismo `modelo`. El resto son filas sueltas.

## Cobertura (cobertura.json)
```json
{ "generado": "2026-10-09T08:12:00-03:00",
  "rubros": { "ram": {"avisos": 800, "con_codigo": 300, "agrupados": 120, "grupos": 45}, "ssd": {}, "gpu": {} } }
```
- `con_codigo / avisos` = cobertura de extraccion. `agrupados / con_codigo` = cuanto del que tiene codigo
  entra en un grupo.
