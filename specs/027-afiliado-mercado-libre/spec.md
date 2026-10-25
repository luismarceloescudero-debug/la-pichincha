# Feature Specification: Enlaces de afiliado de Mercado Libre en las ofertas del dia

**Created**: 2026-10-23

**Status**: Implementada en `/hoy/`, el feed RSS y Telegram, y desde el 25/10 en la pestaña Ofertas, el buscador, la comparativa y las paginas de `/precios/`. Las demas tiendas, todavia no.

**Input**: El dueño pidio que las publicaciones salgan «con el enlace a la oferta, en el cual figura mi usuario; para que
de alguna manera sean mis referidos». Se sumo al Programa de Afiliados de Mercado Libre el 23/10.

## Lo medido

- El link que copia la app de Mercado Libre («Compartí y ganá» → «Copiar link»), `meli.la/1hunncE`, redirige (301) a
  `mercadolibre.com.ar/social/chococuyano?matt_word=chococuyano&matt_tool=31231658&forceInApp=true&ref=...`: el usuario
  va en `matt_word` y la herramienta en `matt_tool`. `meli.la` responde 403 a un pedido sin user-agent de navegador.
- Mercado Libre no publica una API para generar links de afiliado; las herramientas de terceros suman esos dos
  parametros al link de la ficha.
- Una ficha con `?matt_word=chococuyano&matt_tool=31231658` abre normal; a un pedido automatico Mercado Libre le muestra
  su verificacion de cuenta, que conserva los parametros en el destino.

## Decisiones

- `Pagina.enlaceTienda(url)` (`js/pagina.js`) suma `matt_word` y `matt_tool` (`MERCADO_LIBRE_AFILIADO`) solo a una
  pagina de `mercadolibre.com.ar` (o un subdominio) por https; cualquier otro enlace vuelve igual. No es secreto: va
  en cada link.
- **Donde**: las ofertas del dia, que es lo que se publica.
  - `/hoy/`: el enlace lleva `rel="sponsored noopener"` y el rotulo «enlace de afiliado».
  - Feed RSS: el `<link>` con el codigo y «Enlace de afiliado.» en la descripcion; el `guid` no cambia.
  - Telegram: el link con el codigo y «(enlace de afiliado)» despues del comercio.
- El orden no cambia (principio II de la constitucion).
- `ofertas.json` conserva `url` como esta en el indice, porque `verificar_ofertas.py` busca cada oferta por ese valor;
  el link con el codigo va aparte, en `enlace` (con `afiliado: true`).
- `/legal/#afiliados` dice que La Pichincha es parte del Programa de Afiliados de Mercado Libre.
- Con las ofertas del 23/10, 4 de las 10 del dia eran de Mercado Libre y las 4 salieron con el codigo.

## Pendiente

- Confirmar que Mercado Libre cuenta los clics: abrir un link de `/hoy/` o de Telegram y mirar «Clics» en la Central de
  afiliados y creadores.
- Programas de las demas tiendas.

## Ampliacion del 25/10: donde se hace el clic de verdad

Las ofertas del dia son diez links; la gente llega por la busqueda, la comparativa, la pestaña Ofertas y las paginas de
`/precios/`, y ahi los links a Mercado Libre salian sin el codigo. Con las ofertas del 24/10 ni un link de Mercado Libre
llegaba a `/hoy/` (las reglas de credibilidad de la spec 035 dejaron fuera sus tachados y una baja propia pide una
semana de seguimiento).

- `js/base.js`: `hrefTienda`, `relTienda` y `selloAfiliado` (sobre `Pagina.enlaceTienda`). Mercado Libre suma `matt_word` y
  `matt_tool`, con `rel="sponsored noopener"` y un rotulo visible «afiliado»; cualquier otra tienda queda igual.
- Se usan en la fila de la busqueda y su «tambien en», las tarjetas y el precio por tienda de la comparativa, los comercios
  y la pestaña Ofertas. `generar_paginas.js` hace lo mismo en `/precios/` con «(afiliado)».
- El orden y el precio no cambian (principio II).
- Probado en Chromium con el indice del 24/10: dos enlaces de Mercado Libre, los dos con el codigo, `sponsored` y rotulo;
  los demas sin codigo.
- Mercado Libre muestra su verificacion de cuenta a un navegador automatico: la atribucion de los clics no se puede
  probar desde aca.

## Tests

`tests/js/afiliado-ui.test.js` y `tests/js/generador.test.js` (los links de la app y de `/precios/`), `tests/js/pagina.test.js` (`enlaceTienda`: suma el codigo y conserva el resto; deja igual cualquier otro enlace, http,
dominios parecidos y basura), `tests/js/feed.test.js` (`ofertas.json` con `url` intacta y `enlace` aparte; `/hoy/` y el
feed con el codigo, `rel=sponsored` y el rotulo) y `tests/test_publicar_telegram.py` (el enlace de afiliado se abre y
se rotula una vez).
