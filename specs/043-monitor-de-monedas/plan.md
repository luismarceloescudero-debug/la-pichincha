# Plan — Spec 043: monitor de monedas y conversión a pesos

El «qué» está en `spec.md`.

## 1. `js/monedas.js` (R1–R3)

- `FUENTE`, `URLS`, `TIPOS` (tarjeta, MEP, oficial), `POR_DEFECTO`, `normalizar`, `horaAr`, `cotizacion`, `monitorHtml`.
- Tests en `tests/js/monedas.test.js` con las respuestas de DolarApi del 28/10/2026 (sin red).

## 2. El pegamento (R4–R6)

- `js/importar.js`: `pegarLinkHtml` trae `<div class="pl-monedas">`; la nota del total en pesos cita la cotización con
  sus decimales.
- `js/vista-afuera.js`: `pedirMonedas` (DolarApi con corte a 8 s, vigencia 10 min), `pintarMonedas`, `cotizacionPara`,
  el dólar elegido en `localStorage` (`pichincha-dolar`, con try/catch) y un `MutationObserver` que llena el monitor
  cuando aparece el bloque.
- `index.html` carga `js/monedas.js`; `sw.js` lo suma a la cáscara; CSP con `https://dolarapi.com` en `sitio.json` e
  `index.html`. CSS `.monedas` / `.mn-*` en `css/sitio.css`.

## 3. Verificación

- Navegador local: monitor con DolarApi en vivo, checkout real de Amazon pasado a pesos con tarjeta y con MEP, y ancho de
  celular sin scroll horizontal.
