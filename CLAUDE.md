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

## Automatizaciones de Claude Code (01/11, 059)

- `.claude/settings.json` (se commitea) suma dos hooks a los de progreso de `settings.local.json`:
  - `guardia.py` antes de cada comando: `gh workflow run`, `publicar_telegram.py` o las APIs de Telegram/Instagram
    piden confirmacion (es decision del dueño); un `git commit` con tildes o eñes se frena.
  - `test_del_archivo.py` despues de editar `js/<nombre>.js`: corre solo `tests/js/<nombre>.test.js` y avisa si falla.
- Skills del proyecto: `/medir-indice` (reglas contra el indice publicado y contra `main`; usarla antes de un PR de
  ofertas, categorias, titulos o premium) y `/cerrar-pr N` (solo la llama el dueño o se pide: CI, rebase, limpieza).

## Tests

- Suite completa: `node --test "tests/js/*.test.js"`.
- `tests/js/generador.test.js` (skip-link) acepta CRLF desde el 01/11 (058): la suite pasa entera tambien en Windows.
- e2e en local: `npx playwright test --workers=1` si la PC tiene poca memoria (con los workers por defecto Chromium se cae).
