# Plan — Spec 040: quitar la calculadora de «Costo de importar»

Orden de implementación con TDD (test que falla, código mínimo, test que pasa). Cada ítem termina con sus tests
en verde y un commit chico. El «qué» está en `spec.md`; acá el «cómo» y el orden.

## 1. La referencia (pegar un link) sale de la pestaña y se vuelve un bloque propio

La referencia vive hoy adentro de `js/vista-costo.js` (`leerEnlace`, `pedirPrecioEnlace`, `fichaEnlace`,
`aplicarEnlace`), enredada con el formulario de la calculadora. Acá se la separa para que no dependa de la
calculadora.

- `js/importar.js`: borrar `PESO_TIPICO`, `estadoImportar`, `hrefCalculadora`, `estadoDeEnlace` y `COURIERS`.
  En `datosDeEnlace`, dejar solo lo que usa la referencia: `tiendaNombre`, `abrir`, `afiliado`, `mismoEnAmazon`
  (sacan `ayuda`, `pisar`, `moneda`, `calcula`). Quedan intactos `parsearEnlace`, `urlLeerEnlace`,
  `leidoDeEnlace`, `FUENTES`, `urlBusqueda`, `enlaceFuente`, `buscarAfueraHtml`, `oficialesPara`.
- Nuevo pegamento ligero (donde mejor encaje: un `js/vista-afuera.js` o extender `js/afuera.js`): un input que,
  al pegar un link, llama `parsearEnlace` + `urlLeerEnlace` (Worker `/enlace`) + `leidoDeEnlace`, y pinta la línea
  de la referencia y los enlaces «Abrir en …» / «El mismo en Amazon». **Sin** formulario, sin desglose, sin
  «copiar enlace de esta cuenta». Si el link no se reconoce, el mensaje de hoy sin mencionar la calculadora.
- Tests: `tests/js/importar.test.js` — quitar los de `hrefCalculadora` → `#costo`; sumar que
  `datosDeEnlace` ya no trae campos de cálculo y que el bloque renderiza la línea de `leidoDeEnlace`.

## 2. «Buscalo afuera» integra el bloque de pegar link y saca a Aerobox

- `js/importar.js` `buscarAfueraHtml`: sacar la lista de `COURIERS`; sumar el bloque de pegar link del paso 1
  (el input + la zona de resultado), con su título «¿Ya lo encontraste? Pegá el link».
- `js/busqueda.js` (~línea 203): quitar el `<button data-ir-vista="costo">Pegá el link…`; ya lo cubre el bloque
  nuevo de `buscarAfueraHtml`.
- Tests: `tests/js/importar.test.js` / `tests/js/busqueda.test.js` — el HTML de «Buscalo afuera» no nombra a
  Aerobox y trae el campo de link; la vista sin resultados no lleva `data-ir-vista="costo"`.

## 3. Se apaga la pestaña «Costo de importar»

- `js/base.js`: sacar `{ id: "costo", eti: "Costo de importar", ... }` de `VISTAS`.
- `js/arranque.js`: sacar `else if (id === "costo") { ... }`.
- `index.html`: sacar los `<script>` de `js/costos.js`, `js/puesto.js`, `js/monedas.js`, `js/calculadora.js` y
  `js/vista-costo.js` (el pegamento nuevo del paso 1 va en su lugar). **Verificar antes de borrar** si
  `js/monedas.js` se usa fuera de la calculadora (afuera.js/importar.js usan helpers locales, no Monedas).
- Borrar archivos: `js/vista-costo.js`, `js/calculadora.js`, `js/costos.js`, `js/puesto.js` y, si nada los usa,
  `js/monedas.js` e `importacion.json`.
- Tests: el que revise las pestañas no espera «Costo de importar»; `#costo` cae a la vista por defecto.

## 4. «Afuera, en vivo» deja de ofrecer «Calcular puesto en casa»

- `js/afuera.js` `itemHtml`: sacar el enlace «Calcular puesto en casa» (`hrefCalcular`) para Tiendamia/Amazon/eBay;
  dejar «$X puesto en casa» para Loquieroacá (que viene de `precioArs`). Sacar `hrefCalcular` si ya no se usa.
- Tests: `tests/js/afuera.test.js` — quitar los tests que esperan `href="…#costo"`; sumar que un aviso de
  Tiendamia no trae «Calcular puesto en casa» y uno de Loquieroacá sí muestra «puesto en casa».

## 5. Ofertas y feed sin la estimación local

- `js/indice-ofertas.js`: sacar `bloquePuesto` y la dependencia de `COSTO`/`cargarCosto`; las tarjetas
  internacionales siguen, sin el bloque «Puesto en casa: estimación» ni «Calcular con este precio».
- `js/ofertas.js`: sacar `puestoDe` y la llamada en `destacadas`/`calcularOfertas` (queda `esInternacional` para
  rotular); `puesto` (el `require("./puesto.js")` perezoso) desaparece.
- `generar_feed.js`: sacar `cargarCosto(importacion.json, cotizaciones.json)` y el texto de «puesto en casa» del
  feed; el feed sigue listando la oferta internacional con su precio de tienda.
- Tests: `tests/js/ofertas.test.js` y `tests/js/feed.test.js` — quitar/adaptar los que esperan la estimación.

## 6. Service worker, cache y build

- `sw.js`: sacar `"importacion.json"` de la lista de precache.
- Revisar `actualizar.py` / build por si escriben `cotizaciones.json` solo para la calculadora (dejar de
  generarla si quedó huérfana; no romper lo que la siga usando).
- Borrar `cotizaciones.json` del build si nadie lo lee.

## 7. Tests muertos y documentación

- Borrar `tests/js/costos.test.js`, `tests/js/calculadora.test.js`, `tests/js/puesto.test.js`.
- Pasar la suite completa: `node --test "tests/js/*.test.js"`.
- `docs/mapa.md` y `docs/pendientes-del-dueno.md`: al día (la calculadora ya no existe; queda la referencia).

## Qué es «terminado»

- La tira de pestañas no tiene «Costo de importar» y `#costo` cae a la vista por defecto.
- Pegar un link de Tiendamia muestra el porcentaje contra Amazon inline, sin salir de la búsqueda.
- Aerobox no aparece; «Afuera, en vivo» no ofrece «Calcular puesto en casa» para Tiendamia/Amazon/eBay.
- No queda `#costo`, ni la calculadora, ni `importacion.json` referenciados desde el código o los tests.
- Suite en verde en CI (el único fallo local permitido es el CRLF del skip-link).

## Merge y limpieza (regla permanente)

- PR contra `main`; `gh pr checks N --watch` (sin tubería); merge `gh pr merge N --rebase` con la CI en verde.
- Borrar worktree, rama local y remota, y `git pull --ff-only`.
