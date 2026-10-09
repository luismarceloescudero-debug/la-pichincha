# Contrato: service worker (`sw.js`)

- **Alcance**: la raiz del sitio. Solo atiende GET del mismo origen; todo lo demas pasa directo.
- **install**: abre `pichincha-<version>` y guarda la cascara, `sin-red.html` e `indice.json`. `skipWaiting()`.
- **activate**: borra toda cache `pichincha-*` distinta de la actual. `clients.claim()`.
- **fetch (GET, mismo origen)**:
  1. Pide a la red con limite de 4 s.
  2. Si responde bien (200 a 299): guarda una copia y la devuelve.
  3. Si falla o se pasa del limite: devuelve lo guardado; si no hay, y es una navegacion, devuelve `sin-red.html`; si no, deja el error de red.
  4. Una respuesta de error del servidor (4xx o 5xx) no pisa lo guardado.
- **No guarda**: otros origenes, pedidos que no son GET, ni respuestas de error.
- Nunca usa lo guardado si la red respondio bien.
