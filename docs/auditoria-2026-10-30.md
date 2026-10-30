# Auditoría exigente del 30/10/2026

Revisión de https://pichinchadeldia.com.ar/ después de los nombres legibles (spec 044), con el PR #170 (repetidas)
y el #169 (Reel) abiertos. Todo lo de abajo está medido o probado, no mirado a ojo. Herramientas: Lighthouse 12.8.2
(la misma versión que la CI), el navegador del panel y Chrome DevTools (red, consola, sin conexión, 375 y 1440 px,
tema claro y oscuro), y un banco de pruebas en Node con el índice publicado (9,4 MB, 30/10 12:58).

## Puntajes

### Antes (sitio publicado, 30/10 ~14:30)

Celular (Lighthouse por defecto: 4G lenta simulada y CPU ×4). Rendimiento: mediana de tres corridas en las páginas que
dieron distinto entre corridas; el resto, una corrida.

| Página | Rend. | Acc. | Buenas prácticas | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | **83** (81, 83, 87) | 100 | 100 | 100 | 3,5 s | 0 ms | 0 |
| `/hoy/` | 100 (84, 100, 100) | 100 | 100 | 100 | 1,6 s | 0 ms | 0 |
| `/estado/` | 100 (87, 100, 100) | 100 | 100 | 100 | 1,1 s | 0 ms | 0 |
| `/legal/` | 100 | 100 | 100 | 100 | 1,6 s | 0 ms | 0 |
| `/precios/rtx-5060/` | 94 | 100 | 100 | 100 | 2,5 s | 0 ms | 0 |
| `/?q=monitor 27 oled#buscar` | **34** (34, 46, 34) | **95** | 100 | 100 | 12,9 s | 2.660 ms | 0,001 |

Escritorio:

| Página | Rend. | Acc. | Buenas prácticas | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 98 | 100 | 100 | 100 | 0,9 s | 0 ms | 0 |
| `/hoy/` | 100 | 100 | 100 | 100 | 0,6 s | 0 ms | 0 |
| `/estado/` | 100 | 100 | 100 | 100 | 0,3 s | 0 ms | 0 |
| `/legal/` | 100 | 100 | 100 | 100 | 0,6 s | 0 ms | 0 |
| `/precios/rtx-5060/` | 98 | 100 | 100 | 100 | 0,9 s | 0 ms | 0 |
| `/?q=monitor 27 oled#buscar` | **68** | **95** | 100 | 100 | 2,8 s | 380 ms | 0 |

Auditorías que fallan con peso en el puntaje:

- Búsqueda: `aria-allowed-attr` (accesibilidad 95), LCP, TBT, `bootup-time` (`js/arranque.js` 2,9 s de script con CPU ×4),
  `mainthread-work-breakdown`, `dom-size` (1.156 elementos).
- Portada en celular: FCP y LCP de 3,2-3,5 s en las tres corridas; `render-blocking-insight` lista los scripts de `js/`.
- Todas: `uses-long-cache-ttl` (GitHub Pages fija `max-age=600`, no se puede cambiar) y `network-dependency-tree-insight`
  (informativa).

### Después (medido en local con las ramas de los arreglos y el índice publicado)

| Página | Acc. celular | Acc. escritorio | Buenas prácticas | SEO |
| --- | --- | --- | --- | --- |
| `/?q=monitor 27 oled#buscar` | **100** (antes 95) | **100** (antes 95) | 100 | 100 |
| `/#ofertas` | 100 | 100 | 100 | 100 |
| `/` | 100 | 100 | 100 | 100 |

El rendimiento no se re-midió en local: GitHub Pages sirve por HTTP/2 con compresión y el servidor local no, así que los
números no serían comparables. Ningún arreglo de esta tanda toca la carga (salvo un `id` y dos atributos en la portada).

## Lo que se arregló

| PR | Tema | Qué |
| --- | --- | --- |
| [#172](https://github.com/luismarceloescudero-debug/la-pichincha/pull/172) | Accesibilidad | Segmentos de orden y de Ofertas con `aria-pressed` (era `aria-selected` sin rol: Lighthouse 95 → 100). Pestañas con el patrón completo de ARIA: `tabpanel`, `aria-controls`, tabindex itinerante, flechas/Inicio/Fin con activación manual (pasar por Ofertas no baja el índice) y vuelta por la elegida. Tarjetas de oferta: el nombre es un botón con `aria-expanded` (antes un `<article tabindex=0>` sin rol, y el detalle cerrado se leía igual); la estrella lleva `aria-pressed`. El vendedor dentro del chip de la tienda («Samsung Shop» en Mercado Libre) daba 4,31-4,49:1 en seis chips por tema: pasa a `--ink-2` y `test_contraste.py` lo cubre. Plural «1 avisos quedaron afuera». |
| [#173](https://github.com/luismarceloescudero-debug/la-pichincha/pull/173) | Seguridad | ExcelJS se bajaba de cdnjs sin `integrity`: ahora con SRI sha512 (verificado contra el archivo) y `crossorigin`; si no coincide, cae en el CSV. Test: todo script de CDN en `js/` lleva hash. |
| [#174](https://github.com/luismarceloescudero-debug/la-pichincha/pull/174) | SEO | Las 50 páginas `/precios/` decían «rtx 5060: precios desde…», «teclado mecanico», «ipad» en título, descripción, h1, RSS y JSON-LD. `rotulo()` las escribe como se leen: «RTX 5060», «Teclado mecánico», «SSD NVMe 1TB», «iPad». La URL no cambia. |
| [#175](https://github.com/luismarceloescudero-debug/la-pichincha/pull/175) | Comparar | «Comparar» sobre una placa de video decía «el título no dice las especificaciones» (una RTX 5080 16gb): se mide ahora por GPU y VRAM (23 avisos con «RTX 5080 · 16 GB»). Un kit DDR5 de 32 GB quedaba sin capacidad por un hueco de `memoriaDe` (32 y 48 GB no eran RAM ni almacenamiento): la capacidad de un componente sale de su propio lector. |

## Lo que se probó y anda

- **Teclado**: todo el recorrido con Tab tiene foco visible (contorno de 2 px, también la estrella con `all:unset`);
  «Saltar al contenido» primero.
- **Contraste**: barrido de cada texto visible a 375 px en oscuro y en claro; la única falla real era `.via` (arreglada).
  Los valores raros que aparecieron (1,08 en el título) eran una transición de color congelada por el panel en segundo
  plano, no un defecto.
- **Nombre legible** (`js/titulo.js`): el SVG lleva `role="img"` y `aria-label` con el tipo, el `title` trae el nombre
  completo y el texto visible es marca y modelo; dentro de un enlace, el nombre accesible es «Tipo MARCA MODELO chips».
- **Buscar, filtrar y ordenar**: `?q=rtx 5060` da 60 de 73 en 11 fuentes; el título de la pestaña pasa a
  «rtx 5060: precios en Argentina | La Pichincha».
- **Historial de precio**: se abre y, sin dos días de datos, lo dice en lugar de dibujar.
- **Monitor de monedas**: DolarApi en vivo (tarjeta, MEP, oficial, euro), radios en un `fieldset` con leyenda.
- **Pegá el link**: un texto cualquiera da «No reconozco ese link»; un link de Amazon arma el enlace con `tag` de
  afiliado y `rel="sponsored noopener"` y cruza con Tiendamia por el Worker.
- **Pegá el detalle**: un detalle con `<img onerror>` y `<b>` se muestra como texto; no entra HTML al DOM.
- **Exportar**: el Excel genera un `.xlsx` de 17 KB; ExcelJS carga con el hash nuevo.
- **Sin conexión** (DevTools offline, después de una visita): la portada abre desde el service worker con «Sin conexión:
  estás viendo los últimos precios que bajaste (hoy 13:48)», y una búsqueda con el índice guardado anda.
- **375 y 1440 px**: sin scroll horizontal (las tiras de pestañas y segmentos se desplazan dentro de su caja).
- **Consola y red**: sin errores ni avisos; los 42 pedidos de una búsqueda con Excel responden 200.
- **Seguridad**: CSP en todas las páginas (sin `unsafe-eval`, `object-src 'none'`, `base-uri` y `form-action` propios);
  todo `target="_blank"` con `noopener`; afiliados con `sponsored`; el Worker solo da CORS a `pichinchadeldia.com.ar` y a
  localhost, lee solo dos hosts por https y responde JSON con `Cache-Control`. Sin dependencias de npm ni de pip en el
  sitio (biblioteca estándar); las acciones de GitHub van por versión mayor.
- **SEO**: `robots.txt` y `sitemap.xml` correctos, canonical en cada página (la búsqueda `?q=` apunta a la portada,
  bien), JSON-LD `WebSite` con `SearchAction` en la portada e `ItemList` + migas en `/precios/`.
- **Datos publicados** (`ofertas.json` del 30/10 12:58): precios y descuentos coherentes (el % coincide con
  precio/antes en las 10). Hay dos repetidas (Corsair Vengeance 64GB Black y Grey; HP 250 C5-120U en dos tiendas) y un
  «HUAWEI MATE 80 PRO SMARTPHONE»: los tres los resuelve el PR #170, abierto.

## Lo que queda, por prioridad

**Alta**

1. **Rendimiento de la búsqueda en celular (34).** El LCP espera a bajar `indice.json` (1,8 MB comprimido, 9,4 MB sin
   comprimir): con la 4G lenta que simula Lighthouse son ~9 s antes de poder pintar. Además `calcularOfertas` tarda
   ~480 ms en una PC (≈2 s con CPU ×4) y, al terminar, `programarOfertas` vuelve a pintar la búsqueda. Opciones, en
   orden de impacto: partir el índice por categoría y bajar solo la de la consulta; calcular las ofertas en un Web Worker
   (`worker-src 'self'` ya lo permite); repintar solo las filas con «otra tienda lo tiene más barato». Va como spec
   propia; `calcularOfertas` vive en `js/ofertas.js`, que no se tocó por el #170. La CI no lo ve porque no mide `?q=`.
2. **Ofertas con precios que no cierran en la pestaña Ofertas.** La primera tarjeta era una «RTX 5080 Windforce 16GB» a
   $1.330.114 «antes $4.462.250» (−70 %) en Mercado Libre vía ComparaYa, y en Buscar aparecen avisos de DHgate como
   una «RTX 5060 Ti 16GB» a $373.058. La pestaña calcula en el navegador y no pasa por la guardia de Telegram. Sumar a
   la pestaña el mismo piso de gama y la verificación que usa `guardia.js` (cuando se mergee el #170).

**Media**

3. **Portada en celular: 81-87 contra producción** (FCP 3,2 s en las tres corridas; `/hoy/` y `/estado/` dan 100). Los
   28 scripts de `js/` son síncronos y entre ellos va el bloque en línea de los datos (~680 líneas), así que no pueden
   ir con `defer` sin pasar los datos a `<script type="application/json">` y leerlos desde un script diferido; eso toca
   `actualizar.py`, `generar_portada.js` y sus tests. La CI mide 99 en local (sin la latencia de la red real), por eso
   no lo ve. Unir los scripts en uno minificado en el build ayudaría también (`unminified-javascript`).
4. **JSON-LD `Product` en las páginas `/precios/`.** Google pide `Product` para un producto, no para una página de
   categoría («Placa de video») ni de búsqueda. El `ItemList` y las migas alcanzan; el `Product` con `AggregateOffer`
   puede dar un aviso en Search Console. Decisión del dueño (hoy es a propósito, ver el comentario de `grafoDe`).
5. **El nombre legible en Ofertas**: «Tarjeta De Video … Gddr7 .» trae el punto final de la tienda en `aria-label` y
   `title`, y el ícono de una placa de video en Buscar dice «Componente». Es de `js/titulo.js` (cerrado por el #170).

**Baja**

6. El bloque de monedas entero está dentro de un `aria-live`: cada actualización se lee completa. Alcanza con anunciar
   el resultado de «Pegá el link».
7. El Worker no manda `X-Content-Type-Options: nosniff` en sus JSON (no se tocó `worker/` por la spec 046).
8. No hay `<meta name="referrer">`: el navegador ya usa `strict-origin-when-cross-origin`, así que no se filtra la
   búsqueda a las tiendas; agregarlo lo deja escrito.
9. `cache-insight`/`uses-long-cache-ttl`: GitHub Pages fija 600 s y no deja cambiarlo.

## Recomendación sin aplicar

**Playwright en la CI.** Las pruebas de punta a punta de esta auditoría (teclado en las pestañas, abrir una tarjeta,
estrella, Pegá el link, sin conexión) se hicieron a mano con el navegador. Con Playwright quedarían como pruebas que
corren en cada PR. Es una dependencia de npm, y el sitio usa solo la biblioteca estándar (constitución I): la decisión es
del dueño. También convendría que el job `lighthouse` mida una búsqueda (`/?q=…#buscar`), que hoy queda afuera.
