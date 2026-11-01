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
- `tests/js/generador.test.js` (skip-link) acepta CRLF desde el 01/11 (058): la suite pasa entera tambien en Windows.
- e2e en local: `npx playwright test --workers=1` si la PC tiene poca memoria (con los workers por defecto Chromium se cae).
