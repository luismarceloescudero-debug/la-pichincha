# Feature Specification: Buscar afuera y pegar un link

**Created**: 2026-10-23

**Status**: Implementada en un PR (`js/importar.js`, bloque sin resultados de `js/busqueda.js`, cuadro del link en `js/vista-costo.js`)

**Input**: El dueño buscó «soundcore aeroclip 2 by anker»: ninguna tienda argentina lo tiene y solo aparecía un botón «Buscar en Amazon (EE.UU.)». Pidió que en ese caso se busque solo, no únicamente en Amazon: también en Tiendamia, Loquieroaca y en la tienda oficial del producto si envía a Argentina. Y en «Costo de importar», un cuadro donde pegar un link de amazon.com, Tiendamia, etc., del que salgan solos el precio y los demás datos; «es más, debería poder cargar la página desde la interfaz y simular agregar al carrito».

## Decisiones

### 1. Sin resultados, la búsqueda afuera ya está armada

1. Cuando ninguna tienda del índice tiene el término, se muestra de una vez el bloque **«Buscalo afuera: la búsqueda ya está armada»** (`Importar.buscarAfueraHtml`) con un enlace por fuente de `Importar.FUENTES`, cada uno a la búsqueda real de esa tienda con el término (`Importar.urlBusqueda`):
   - **Amazon (EE.UU.)**: `https://www.amazon.com/s?k=<término>&tag=lapichincha-20`, rotulado «enlace de afiliado» y con `rel="sponsored noopener"`.
   - **Tiendamia**: `https://tiendamia.com.ar/search/amazon/<palabras+unidas+con+más>`.
   - **Loquieroaca**: `https://www.loquieroaca.com/products?search=<palabras+unidas+con+más>`.
2. Las dos URLs de búsqueda se **verificaron en la fuente el 23/10/2026**: con el término del dueño, las dos devolvieron el Soundcore AeroClip 2 (Tiendamia en el HTML; Loquieroaca en el navegador, carga los resultados con JavaScript). `www.tiendamia.com` responde 403 y `tiendamia.com.ar` responde, así que la portada de Tiendamia pasa a `https://tiendamia.com.ar/`.
3. **Tienda oficial de la marca**: solo si su propia página de envíos dice que manda a Argentina. Vive en `Importar.OFICIALES` (marca, palabras clave, URL, búsqueda opcional, página de envíos y fecha de verificación) y se muestra con esa fecha y el enlace a la página de envíos. Lo no confirmado no se muestra (`oficialesPara` exige `https`, página de envíos y fecha). **La lista arranca vacía**: el 23/10/2026 ni Soundcore/Anker (`soundcore.com/policies/shipping-policy`) ni Keychron (`keychron.com/pages/where-to-buy`) nombran a Argentina.
4. Debajo sigue el botón a la calculadora, ahora «Pegá el link y calculá cuánto te sale puesto en casa».

### 2. Pegar un link en «Costo de importar»

1. Arriba del formulario hay un cuadro **«¿Ya lo encontraste afuera? Pegá el link»**. `Importar.parsearEnlace` reconoce, solo con la dirección:
   - **Amazon (EE.UU.)**: `/dp/ASIN`, `/<slug>/dp/ASIN`, `/gp/product/ASIN`, `/gp/aw/d/ASIN`; los links cortos `amzn.to` y `a.co` (del «Compartir» de la app) se reconocen sin ASIN.
   - **Tiendamia**: `/p/<origen>/<id>/<slug>`; si el origen es `amz`, el id es el ASIN y se ofrece «El mismo en Amazon» (afiliado).
   - **Loquieroaca**: `/products/<id>` y `/products/<slug>-<id>`.
   - **eBay**: `/itm/<id>` y `/itm/<slug>/<id>`.
   El host tiene que ser exacto (`amazon.com.otro.com` no es Amazon). Del slug sale un nombre legible.
2. Con el link reconocido se muestra la tienda, el código y el nombre, el enlace «Abrir en <tienda>» (otra pestaña; Amazon con el tag) y **un campo para el precio en US$**, con una línea de qué precio escribir. Se precargan en la calculadora la moneda (`USD`) y dónde se cobran los impuestos (`checkout`: Amazon, eBay y Tiendamia los cobran ahí); en Tiendamia el envío queda vacío porque su precio ya lo incluye. El precio escrito pasa al «Precio del producto» y la cuenta se rehace.
3. **Loquieroaca no se calcula**: publica el precio final en pesos con impuestos y envío incluidos («El precio que ves incluye TODO», leído en una ficha el 23/10/2026). El cuadro lo dice y propone compararlo directo con las tiendas de acá.
4. El cuadro dice en una línea por qué el precio lo escribe la persona: «Del link sacamos la tienda y el producto; la página no la leemos (las tiendas no lo permiten), así que el precio lo escribís vos».

## Qué no se puede y por qué

- **Leer el precio de la página o «cargar la página y simular el carrito»**: el sitio es estático (GitHub Pages, sin backend). El navegador no puede leer esas tiendas desde otra página (CORS) y Amazon no se deja embeber en un iframe (`X-Frame-Options`). Hacerlo con un servidor intermedio sería scraping: Amazon lo prohíbe (la PA-API se retiró y la Creators API pide ventas; ver la memoria `amazon-afiliados`) y la regla del proyecto es no esquivar bloqueos de Tiendamia y Loquieroaca.
- **Traer los resultados de las búsquedas de afuera a la página**: por lo mismo, solo se arma el enlace.
- **Guardar el link en la URL para compartir**: la URL de la calculadora corta cada parámetro a 20 caracteres; se comparte la cuenta, no el link.

## Pruebas

- `tests/js/importar.test.js`: la búsqueda de cada fuente con el término (y su portada sin término), el término limpio de espacios y signos; `parsearEnlace` con cada forma de link de las cuatro tiendas, los cortos y 14 entradas que tienen que dar `null` (dominios parecidos, otros protocolos, rutas que no son de producto); el nombre del slug decodificado y cortado; el estado que precarga cada tienda; las tiendas oficiales solo verificadas; el bloque HTML con el término escapado, Amazon rotulado y `rel` correctos.
- Suite JS completa: 603 tests, cobertura de `js/importar.js` 99% de líneas.
- En el navegador (servidor local con el índice publicado), oscuro, claro y móvil a 375 px sin scroll horizontal: «soundcore aeroclip 2 by anker» muestra el bloque con las tres búsquedas; en «Costo de importar», un link de amazon.com con 79,99 da el total; Tiendamia vacía el envío y ofrece el mismo ASIN en Amazon; Loquieroaca muestra que no hace falta calcular; un link de otra tienda pide escribir el precio a mano. Sin errores en la consola.
- Delegación: la primera versión de `parsearEnlace` y `urlBusqueda` la escribió OmniRoute `revision` (gpt-oss-120b) y pasó 11 de 11 tests; la revisión del diff (mismo combo) dio 3 hallazgos falsos. Detalle en `docs/delegacion-modelos.md`.
