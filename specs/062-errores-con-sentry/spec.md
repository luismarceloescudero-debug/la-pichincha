# Spec 062: errores del navegador con Sentry

**Pedido del dueño (05/11):** enterarse en tiempo real cuando la página se rompe en el celular de alguien.

## Qué hace

- `js/errores.js` va primero en el `<head>` de la portada y de todas las páginas generadas (`cabeza` de
  `generar_paginas.js`: /precios/, /hoy/, /estado/, /legal/, /contacto/, /acerca/, 404).
- Se prende solo con DSN (`sentry_dsn` de `sitio.json`, repetido en `<meta name="sentry-dsn">`) y solo en
  `https://pichinchadeldia.com.ar`: en localhost, en los tests y en la app no manda nada.
- Anota los errores (`error` y `unhandledrejection`) y, recién con la página cargada, baja el SDK 11.8.0 de
  `browser.sentry-cdn.com` (bundle de solo errores, ~32 KB comprimido) con integridad sha384. Si no carga
  (bloqueador, sin red) la página sigue igual.
- Sin datos personales: `sendDefaultPii: false`, sin `user`, sin cookies, sin `Referer`, sin «?q=» en las
  direcciones ni en las migas, sin migas de consola; `allowUrls` = el propio sitio; extensiones afuera.
  En Sentry, «Prevent Storing of IP Addresses» y los data scrubbers del proyecto están prendidos.
  Sentry deduce la ciudad aproximada antes de descartar la IP: `/legal/#errores` lo dice.
- Sin Session Replay, sin tracing, sin logs.
- El service worker solo atiende el mismo origen: el SDK no se guarda; `js/errores.js` sí (en la cáscara).

## En Sentry

- Org `la-pichicha`, proyecto `la-pichincha` (Browser JavaScript), equipo `#la-pichicha`.
- Alerta «Send a notification for high priority issues»: un error nuevo (o que vuelve o crece) de prioridad
  alta manda un mail a los miembros (el dueño). Los errores de JS entran como `error` → prioridad alta.
- Prueba: abrir `https://pichinchadeldia.com.ar/#probar-errores` → en un minuto aparece
  «Prueba de errores de La Pichincha».

## Tests

`tests/js/errores.test.js` (dominio, sin DSN no hace nada, limpieza de datos, SDK fijo con integridad) y la
clase `Sentry` de `tests/test_sitio.py` (DSN válido, CSP con el CDN y el origen del DSN, meta y script en
`index.html` y en las páginas generadas).
