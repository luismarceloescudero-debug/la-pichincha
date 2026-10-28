# La Pichincha — comparador de precios (RAM COTIZACIONES)

Reglas propias del proyecto. Las globales (idioma, merge de PRs, FCC, limpieza) estan en
`~/.claude/CLAUDE.md`.

## Continuidad entre modelos (regla fija)

- Al EMPEZAR cualquier tarea en este repo, leé `privado/continuidad.md`: ahi esta que se viene
  haciendo, que falta y que no hay que rehacer. Si la tarea toca buscadores o tiendas, mirá
  tambien `privado/continuidad-buscadores.md` y `privado/hechos-buscadores.md`.
- Al TERMINAR (o antes de delegar a FCC, o antes de agotar el limite de uso), actualizá
  `privado/continuidad.md` con el estado nuevo: que se hizo, que falta, que comando sigue.
- `privado/` no se commitea y no lleva secretos ni datos reales.

## Tests

- Suite completa: `node --test "tests/js/*.test.js"`.
- `tests/js/generador.test.js` (skip-link) falla SOLO en Windows local por CRLF
  (`core.autocrlf=true` sin `.gitattributes`). En CI (Linux, LF) pasa; no es de la tarea.
