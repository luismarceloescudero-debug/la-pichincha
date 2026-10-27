# Plan — Spec 039: referencia del costo importado

Orden de implementación, con TDD (test que falla, código mínimo, test que pasa). Cada ítem termina con sus tests en verde
y un commit chico. El «qué» está en `spec.md`; acá el «cómo» y el orden.

## 1. El `aviso` del Worker lleva el precio base y el porcentaje

- `worker/src/fuentes/comun.js`: `aviso()` acepta `precioBase` (número, el `merchant_price` de Amazon) y `recargoPct`
  (número, el porcentaje ya calculado), ambos `null` por defecto, y los devuelve. Nada cambia para las demás fuentes.
- `worker/src/fuentes/tiendamia.js`: `parsearFichaTiendamia` extrae `merchant_price` y `markup_applied.amount` de la ficha
  y calcula `recargoPct = (final − merchant) / merchant * 100`, redondeado, solo si `merchant > 0`; si no, `precioBase` y
  `recargoPct` quedan `null`. La búsqueda (`parsearBusquedaTiendamia`) no trae `merchant_price`, así que no cambia.
- Tests: `tests/js/worker.test.js` — ficha con `merchant_price` y `markup_applied` → `precioBase` y `recargoPct`
  correctos; ficha sin `merchant_price` o con `merchant_price` 0 → ambos `null`; la búsqueda sigue sin traerlos.

## 2. Un link de Amazon cruza a la ficha de Tiendamia

- `worker/src/index.js`: en `leer()`, cuando `e.tienda === "amazon"` y hay ASIN (`e.id`) y Tiendamia está activa, se lee la
  ficha `https://tiendamia.com.ar/p/amz/<ASIN>/` (dentro de `paginaPermitida`) como **referencia**. La respuesta marca que
  el link original es Amazon pero el ítem viene de Tiendamia (la ficha ya trae `precioBase` y `recargoPct`). Si Tiendamia no
  lo tiene (ficha `null`), se mantiene el mensaje actual de «Amazon no se lee sin su API». La caché de `/enlace` se clavea
  por la URL que realmente se lee (la de Tiendamia), no por la de Amazon.
- Tests: `tests/js/worker.test.js` — link de Amazon con ASIN lee la ficha de Tiendamia (fetch mockeado) y devuelve la
  referencia; sin ASIN (`amzn.to`) o sin Tiendamia → el mensaje actual; nunca se pide la página de Amazon.

## 3. El texto en `leidoDeEnlace` (`js/importar.js`)

- Para un ítem de Tiendamia con `precioBase`/`recargoPct`: sumar a la línea leída «en Amazon sale US$ <base>; un <pct> %
  más con envío e impuestos incluidos», rotulado como aproximado.
- Para el link de Amazon que cruzó a Tiendamia: mostrar el precio final de Tiendamia y el porcentaje contra el precio base
  de Amazon, y aclarar que la referencia es Tiendamia (no una lectura de Amazon). El campo de precio a mano sigue libre.
- Tests: `tests/js/importar.test.js` — con y sin `precioBase`; el rotulado «aproximado»; el caso Amazon→Tiendamia.

## 4. La sección «Afuera, en vivo» (`js/afuera.js`)

- `itemHtml`: si un ítem de Tiendamia trae `recargoPct`, sumar una línea «un <pct> % más que en Amazon». La búsqueda no trae
  el desglose, así que en la práctica esto aparece solo cuando el ítem viene de una ficha; mientras tanto, la búsqueda sigue
  mostrando «con envío incluido», que ya es la referencia.
- Tests: `tests/js/afuera.test.js` — ítem con `recargoPct` muestra la línea; sin él, no.

## 5. Aerobox y couriers como links (`js/importar.js`)

- Sumar a la lista de referencias de «Buscalo afuera» (`buscarAfueraHtml`) Aerobox y couriers similares como enlaces
  informativos, con la aclaración de que ahí cada uno calcula su envío e impuestos. No se leen sus páginas ni se traen
  precios; no es calculadora. Sin comisión (sin `rel="sponsored"`).
- Tests: `tests/js/importar.test.js` — aparecen los links con su aclaración.

## 6. Documentación y cierre

- `docs/mapa.md` y `docs/pendientes-del-dueno.md` al día con el cambio.
- Tests de JS (`node --test "tests/js/*.test.js"`) y de Python en verde; corrida local completa antes del PR.
- PR con CI verde → merge `--rebase`; limpiar rama y actualizar `main`.

## Fuera de alcance (no se hace)

- Calculadora de Aerobox o de couriers; lectura de sus páginas.
- Leer Amazon sin la Creators API; búsquedas de Loquieroacá (cupo pago).
- Porcentaje contra Amazon para Loquieroacá (su precio ya es el total en pesos).
