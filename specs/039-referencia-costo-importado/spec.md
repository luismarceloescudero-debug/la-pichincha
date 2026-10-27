# Spec 039: Tiendamia y Loquieroacá como referencia del costo importado

**Created**: 2026-10-27

**Status**: Draft

**Input**: El dueño decidió el 27/10 cómo mostrar el «importado» (Amazon.com, eBay, etc.) en el sitio: descartar la
calculadora de Aerobox como parte del sitio; citar Aerobox y couriers similares como links para que cada uno investigue
por su cuenta; y usar Tiendamia y Loquieroacá como la referencia del costo importado para Amazon/eBay — si el mismo
producto está en Amazon y en Tiendamia, el precio final de Tiendamia aproxima el costo extra (envío + impuestos) y se
muestra un valor o porcentaje aproximado contra el precio de Amazon.

## Lo que se decidió

1. **Sin calculadora de Aerobox.** No se construye ninguna calculadora de Aerobox ni de couriers. La calculadora de
   costos que ya existe (`js/calculadora.js`, con las reglas de `importacion.json`) queda como está: estima por las
   reglas locales, no es la referencia del importado.
2. **Aerobox y couriers citados como links.** En el bloque «Buscalo afuera» (spec 020) se suman Aerobox y couriers
   similares como enlaces de referencia, con una línea que aclara que ahí cada uno calcula su envío e impuestos. Son
   enlaces informativos: no se leen sus páginas ni se traen sus precios.
3. **Tiendamia y Loquieroacá como referencia.** Para un producto de Amazon (o eBay), el precio final de Tiendamia —que
   ya incluye envío e impuestos— es la aproximación de cuánto cuesta traerlo. Se muestra contra el precio de Amazon
   como un valor o porcentaje aproximado.

## Por qué Tiendamia sirve de referencia

La ficha de Tiendamia (`/p/amz/<ASIN>/<slug>`) publica las dos mitades de la cuenta, medido en el fixture real del
23/10/2026 (`tests/fixtures/worker/tiendamia-ficha.html`):

- `merchant_price`: el precio base de Amazon (p. ej. **169,98**).
- `markup_applied.amount`: el recargo que suma Tiendamia por traerlo (**28,90**).
- `final_price`: el total con envío incluido (**198,88**).

Con eso, «traerlo» sale un **17 %** más que el precio de Amazon, y el número sale de una sola fuente honesta: sin leer
Amazon (que no se lee sin su API, spec 023) y sin inventar impuestos. La búsqueda de Tiendamia (`/search/amazon/…`)
solo trae el precio final (`data-price`), no el desglose: la referencia con porcentaje sale de la ficha.

## Qué ve la persona

- **Con un link de Tiendamia pegado** (spec 023): además del precio final que ya se muestra («con el envío incluido»),
  se muestra cuánto es eso respecto del precio de Amazon que publica la misma ficha —p. ej. «en Amazon sale US$ 169,98;
  Tiendamia lo deja a US$ 198,88, un 17 % más con envío e impuestos incluidos». El porcentaje es aproximado y se dice.
- **Con un link de Amazon pegado**: hoy Amazon no se lee sin su API. La referencia pasa a ser la ficha de Tiendamia de
  ese mismo producto (`/p/amz/<ASIN>/`, si Tiendamia lo tiene): se muestra el precio final de Tiendamia y el porcentaje
  contra el `merchant_price` que publica esa ficha. La persona sigue pudiendo escribir el precio de Amazon a mano para
  usar la calculadora local.
- **Con un link de Loquieroacá**: no cambia. Loquieroacá ya da el precio final en pesos, con impuestos y envío
  incluidos, «puesto en casa» (spec 023); eso es, por sí solo, la referencia del importado en pesos, comparable directo
  con las tiendas de acá.
- **En «Afuera, en vivo»** (spec 022): los productos de Tiendamia ya se muestran «con envío incluido»; esa cifra es la
  referencia del importado. Se suma el porcentaje contra el precio de Amazon cuando esté disponible.

## Decisiones

- **El porcentaje es aproximado y se rotula como tal**: se calcula `(final − base) / base` sobre los dos números que
  publica la misma ficha de Tiendamia. No es una promesa de precio final de compra: Tiendamia puede cambiar el recargo y
  el resumen de pago es el que manda.
- **No se lee Amazon.** El precio «de Amazon» que se usa para el porcentaje es el `merchant_price` que Tiendamia publica
  en su ficha, no una lectura nuestra de Amazon. Mientras la Creators API siga sin credenciales (pendiente del dueño #9),
  no hay precio de Amazon en vivo.
- **Loquieroacá no suma porcentaje contra Amazon**: su precio ya es el total en pesos; compararlo con Amazon requeriría
  cruzar un producto de Amazon con la ficha de Loquieroacá, y su buscador está fuera de cupo (spec 022). Se mantiene como
  referencia en pesos.
- **eBay**: no hay una Tiendamia «de eBay» que cruzar por ASIN (Tiendamia publica `origen: amz`). Para eBay la referencia
  del importado queda en la calculadora local y en Loquieroacá, como hasta ahora.

## Qué no se hace

- Construir una calculadora de Aerobox ni de ningún courier.
- Leer páginas de Aerobox o de los couriers citados.
- Leer Amazon sin su API, ni búsquedas de Loquieroacá (cupo pago).
- Inventar un precio de Amazon cuando Tiendamia no publica el `merchant_price`: en ese caso no se muestra porcentaje, se
  muestra solo el precio final de Tiendamia como referencia.

## Casos límite

- **Tiendamia no tiene el producto** (un link de Amazon cuyo ASIN no está en Tiendamia): no hay referencia; se mantiene
  el flujo actual (precio a mano + calculadora local), sin mensaje de error extra.
- **Tiendamia no responde o no publica `merchant_price`**: se muestra el precio final si está, sin porcentaje. Nunca se
  muestra un porcentaje con un solo número.
- **El recargo es 0 o el `merchant_price` es 0**: no hay porcentaje (división por cero). Se muestra el precio final solo.
- **Tiendamia cambia el precio entre la ficha y la búsqueda** (ya pasó el 23/10, spec 023): cada vista usa el número de
  su propia lectura; el porcentaje sale siempre de la ficha, que es la que publica las dos mitades.
- **Moneda**: Tiendamia publica en dólares; el porcentaje no depende de la moneda. Loquieroacá, en pesos.

## Pruebas

- Fixtures reales del 23/10/2026 ya guardados (`tests/fixtures/worker/tiendamia-ficha.html` con `merchant_price`,
  `markup_applied` y `final_price`).
- `tests/js/worker.test.js`: el parser de la ficha extrae el precio base y calcula el porcentaje; sin `merchant_price`,
  sin porcentaje y sin error.
- `tests/js/importar.test.js` y `tests/js/afuera.test.js`: el texto que muestra el porcentaje, el rotulado «aproximado»
  y el caso de Amazon sin API que pasa a mostrar la referencia de Tiendamia.
- `tests/js/afuera.test.js`: Aerobox y couriers aparecen como links de referencia, con su aclaración, sin leerse.
- Navegador, con el Worker local: pegar un link de Tiendamia muestra el porcentaje contra el precio de Amazon; pegar un
  link de Amazon del que Tiendamia tiene ficha muestra la referencia; en claro, oscuro y móvil.

## Qué es «terminado»

- La ficha de Tiendamia (y el link de Amazon que cruza a su ficha) muestra el porcentaje aproximado del costo extra
  contra el precio de Amazon, rotulado como aproximado.
- «Buscalo afuera» cita Aerobox y couriers como links de referencia, sin calculadora propia.
- Loquieroacá sigue como referencia en pesos, sin cambios.
- Tests verdes (`tests.yml`), `docs/mapa.md` y `docs/pendientes-del-dueno.md` al día.
