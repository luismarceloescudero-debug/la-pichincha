# Spec 051: pruebas de punta a punta con Playwright, solo en la CI

## Problema

La auditoria del 30/10/2026 (`docs/auditoria-2026-10-30.md`) probo a mano, con el navegador, lo que mas se rompe sin que
ningun test lo note: el teclado en las pestañas, abrir una tarjeta de oferta, la estrella, «Pegá el link», el formulario
de contacto, el modo sin conexion y el scroll horizontal. Los tests de `node --test` y `unittest` cubren la logica pura,
no el sitio andando en un navegador. Recomendo automatizarlo con Playwright; el dueño acepto el 31/10/2026 con una
condicion: **solo de la CI**.

## Decision y limites

- **Constitucion I enmendada (v1.2.0)**: se permiten herramientas de desarrollo y de CI que no se publican. El unico uso
  hoy es `@playwright/test` como `devDependency`. El sitio publicado, sus generadores y el Worker siguen usando solo la
  biblioteca estandar; ningun archivo publicado carga nada de `node_modules`.
- `package.json` solo tiene `devDependencies` (`@playwright/test` 1.64.1, del 14/10/2026, con mas de dos semanas) y
  `package-lock.json`; en la CI se instala con `npm ci`. `node_modules/`, `test-results/` y `playwright-report/` van en
  `.gitignore`. No hay otras dependencias.
- Solo Chromium. Las pruebas viven en `tests/e2e/*.spec.js`, afuera de `tests/js`, asi `node --test` y su cobertura no
  las ven.

## Como corre

- `tests/e2e/armar-sitio.sh` arma `_sitio` con los mismos generadores del job `lighthouse`, pero con un **indice de
  prueba chico** (`tests/fixtures/e2e/indice.json`, 160 filas): las de «rtx 5060» del indice del 30/10/2026, ocho bajas de
  precio inventadas para que haya tarjetas en Ofertas, y 60 filas al azar. No depende de la red ni del dia.
- `playwright.config.js` levanta `tests/e2e/servidor.js` (servidor estatico de Node, sin dependencias) sobre `_sitio`.
- **Sin terceros en vivo**: `tests/e2e/base.js` simula en cada prueba DolarApi, GoatCounter, las fuentes de Google, las fotos
  de las tiendas y el Worker (`page.route`). El envio del formulario de contacto tambien esta simulado: no sale nada.
- El service worker esta bloqueado salvo en la prueba de sin conexion.
- Sin esperas a ojo: solo las esperas con reintento de Playwright (`expect`, `expect.poll`).

## Pruebas

| Archivo | Que verifica |
| --- | --- |
| `portada.spec.js` | la portada abre sin errores de consola ni pedidos fallidos; pestañas con teclado (flechas, Inicio, Fin, Enter, activacion manual, tabindex itinerante) y foco visible; «Pegá el link» con un texto cualquiera dice «No reconozco ese link» |
| `buscar.spec.js` | buscar `rtx 5060` devuelve filas; ordenar por precio (las compras internacionales van al final); filtrar por tienda y quitar el filtro |
| `ofertas.spec.js` | abrir una tarjeta con Enter (`aria-expanded`), cerrarla con Espacio y marcar la estrella (`aria-pressed`, cuenta en «Marcadas») |
| `contacto.spec.js` | correo invalido, mensaje corto y envio demasiado rapido (lo rechaza el servidor simulado) |
| `paginas.spec.js` | `/hoy/` y `/acerca/` cargan sin errores; `/acerca/` sin «[COMPLETAR]» |
| `diseno.spec.js` | sin scroll horizontal a 375 y a 1440 px, en tema claro y oscuro, en cinco paginas y en la busqueda |
| `sin-conexion.spec.js` | despues de una visita, la portada abre sin conexion desde el service worker (`context.setOffline`) y una busqueda anda |

## CI

Job `e2e` de `.github/workflows/tests.yml` (`timeout-minutes: 15`): `npm ci`, cache de los navegadores de Playwright por
version, `npx playwright install --with-deps chromium`, armar el sitio, correr, y si falla subir como artefacto
`playwright-reporte` el reporte HTML y las capturas y trazas de las pruebas que fallaron. Como `tests.yml` tambien
corre antes de cada publicacion, una falla de e2e frena la publicacion igual que Lighthouse. Los umbrales de
`CONSTRAINTS.md` no cambian.

## En local

```bash
npm ci
npx playwright install chromium
bash tests/e2e/armar-sitio.sh
npx playwright test
```

## Bugs encontrados

Ninguno en `js/ofertas.js`, `js/titulo.js`, `guardia.js` ni los generadores. Una nota: el Chromium sin interfaz aborta el
pedido de `manifest.webmanifest` (no pasa en Chrome comun, como midio la auditoria); la prueba de consola lo ignora, igual
que el hash de integridad del script de GoatCounter, que no puede coincidir con el script simulado.
