# Feature Specification: Afuera en vivo

**Created**: 2026-10-23

**Status**: Implementada sin desplegar. El Worker (`worker/`) y la sección de la página están en `main`; se activan cuando el dueño cargue las cuentas (ver «Qué falta»). Hasta entonces la página queda como en la spec 020.

**Input**: Que la búsqueda afuera sea automática, en vivo, con la primera búsqueda, sin botones de «buscalo vos». Decisión del dueño (23/10/2026): «Servidor gratis + APIs».

## Decisiones

### 1. Un Worker gratis que consulta APIs oficiales

1. `worker/` es un Cloudflare Worker (plan gratis: 100 mil pedidos por día, 10 ms de CPU por pedido sin contar la espera de red, 50 subpedidos por pedido), en JavaScript sin dependencias. `GET /buscar?q=` consulta en paralelo las fuentes que tienen credenciales y devuelve `{ consulta, fecha, fuentes: [{ id, ok, n }], items }`. Cada aviso trae `fuente, nombre, precio, moneda, envio, precioArs, url, imagen, afiliado, fecha`, y la lista va **de menor a mayor precio, nunca por comisión**.
2. **Fuentes** (verificadas en la doc oficial de cada una el 23/10/2026):
   - **eBay Browse API** (`item_summary/search`): token de aplicación (client credentials, scope `https://api.ebay.com/oauth/api_scope`); `filter=deliveryCountry:AR` («Only items that can be shipped to the specified country are returned»); cabecera `X-EBAY-C-ENDUSERCTX` con `contextualLocation=country%3DAR` y, si hay campaña de eBay Partner Network, `affiliateCampaignId` (así la respuesta trae `itemAffiliateWebUrl`). Secretos: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` y, opcional, `EBAY_CAMPAIGN_ID`.
   - **AliExpress Portals** (`aliexpress.affiliate.product.query` por `https://api-sg.aliexpress.com/sync`): `ship_to_country=AR` («Filter products that can be sent to that country»), dólares y español. La firma es HMAC-SHA256 de los parámetros ordenados (clave+valor) en hexa mayúscula, según la página «Signature algorithm» del Open Platform. Secretos: `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` y `ALIEXPRESS_TRACKING_ID`.
   - **Amazon Creators API**: apagada hasta que existan `AMAZON_CREATORS_ID` y `AMAZON_CREATORS_SECRET`. La doc oficial pide 10 ventas calificadas en los últimos 30 días. Están verificados el token (`api.amazon.com/auth/o2/token`, `creatorsapi::default`), la cabecera `x-marketplace` y los campos de SearchItems. La ruta `catalog/v1/searchItems` sale **por analogía** con el único ejemplo documentado (`catalog/v1/getItems`): hay que confirmarla con la primera llamada real. Nada de scraping de Amazon.
3. **Protecciones**:
   - La consulta se valida con `Buscadas.terminoLimpio` (los mismos criterios que lo más buscado: largo, sin mails, links, teléfonos ni documentos).
   - CORS solo para `https://pichinchadeldia.com.ar` y localhost.
   - Caché de 8 horas por consulta normalizada (Cache API), solo si alguna fuente respondió.
   - Tope de 30 búsquedas por minuto por IP.
   - Tiempo máximo de 5 s por fuente: una caída no tumba a las demás.
   - User-agent `LaPichincha-verificador/1.0 (+https://pichinchadeldia.com.ar)`. Los tokens se reusan hasta un minuto antes de vencer.
4. **Despliegue**: `.github/workflows/worker.yml` corre con cambios en `worker/` y termina en verde sin hacer nada si faltan `CLOUDFLARE_API_TOKEN` o `CLOUDFLARE_ACCOUNT_ID`. Con ellos, corre los tests del Worker, despliega con `wrangler@4.146.0` y pasa con `wrangler secret put` solo los secretos de las APIs que existan.
5. **Dirección**: `sitio.json` tiene `afuera_url` (vacía hasta el primer despliegue). `index.html` la repite en `<meta name="afuera-url">` y, cuando se carga, va también en `connect-src` de la CSP; `tests/test_sitio.py` exige las tres cosas.

### 2. La sección «Afuera, en vivo» en la búsqueda

1. Con cada búsqueda, con resultados en Argentina o sin ellos, `js/busqueda.js` le pregunta al Worker (`pintarAfuera`). El pedido sale al dejar de escribir (900 ms), una sola vez por consulta y sesión; si falla, no se reintenta durante un minuto.
2. `js/afuera.js` (puro) pinta hasta 8 avisos por precio: precio en la moneda de la tienda, envío si la fuente lo da, la fuente, «enlace de afiliado» y `rel="sponsored"` cuando corresponde. Arriba va el **mejor precio de acá** (la mejor compra del análisis). Cada aviso sin precio puesto en pesos lleva «Calcular puesto en casa», que abre la calculadora con el precio, el envío y el cobro en el checkout.
3. **Sin Worker configurado, caído o lento** no se pinta nada: queda el bloque de enlaces de la spec 020.

## Qué no se hizo y por qué: Loquieroacá

El pedido traía un adaptador para Loquieroacá: repetir la llamada Livewire `loadProducts` de su página de búsqueda. **Queda afuera hasta que el dueño lo decida**, por tres razones:

- La llamada de prueba (una sola, con el user-agent identificado) **la bloqueó la clasificación de permisos de esta sesión** por tratarse de automatizar un sitio de terceros. No se buscó otra forma de hacerla.
- El componente de búsqueda de Loquieroacá tiene **un cupo de búsquedas** (`searchQuotaExceeded`, `searchLimitMessage`, `redirectToLoginOnQuota` en su estado) y cada búsqueda **les cuesta una llamada paga** (`asinFinderApi: "rainforest"`). Un Worker que abre una sesión nueva por consulta estaría esquivando ese cupo: va contra la regla del proyecto («se espera, no se esquiva»).
- `robots.txt` permite todo y la página `/info` no prohíbe el acceso automatizado, pero eso no cambia lo anterior.

El camino legítimo sigue siendo el que el dueño ya pidió por mail el 16/10: un feed, una API o un acuerdo con Loquieroacá. Con eso, el adaptador entra como una fuente más (`worker/src/fuentes/`) y su precio final en pesos va en `precioArs`, que la página ya muestra como «puesto en casa». Tiendamia sigue en 403 para servidores y queda el enlace de búsqueda de la spec 020.

## Qué falta (lo crea el dueño)

| Para | Secretos en GitHub (Settings → Secrets → Actions) |
| --- | --- |
| Desplegar el Worker | `CLOUDFLARE_API_TOKEN` (plantilla «Edit Cloudflare Workers») y `CLOUDFLARE_ACCOUNT_ID` |
| eBay | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` (keyset de Production); opcional `EBAY_CAMPAIGN_ID` (eBay Partner Network) |
| AliExpress | `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID` |
| Amazon | `AMAZON_CREATORS_ID`, `AMAZON_CREATORS_SECRET` (cuando la cuenta tenga 10 ventas en 30 días) |

Después del primer despliegue, la dirección `https://pichincha-afuera.<cuenta>.workers.dev` va en `sitio.json` (`afuera_url`), en el meta `afuera-url` de `index.html` y en `connect-src` de la CSP (en `sitio.json` y en `index.html`).

## Pruebas

- `tests/js/worker.test.js` (20): normalizar eBay, AliExpress y Amazon con fixtures armados con los campos de cada doc oficial (no son respuestas reales: no hay credenciales); los pedidos de cada API; la firma de AliExpress contra `node:crypto`; validación de la consulta, CORS, caché de 8 h, tope por IP, fuente lenta o caída, reuso del token y el `export default` del Worker.
- `tests/js/afuera.test.js` (11) y `tests/test_sitio.py` (dirección del Worker, meta y CSP).
- `wrangler deploy --dry-run` empaqueta el Worker (38 KB) y el paquete responde en Node.
- En el navegador, con la respuesta armada por el Worker real a partir de los fixtures y servida desde el mismo origen: oscuro, claro y móvil a 375 px sin scroll horizontal; con y sin resultados de acá; fuentes sin avisos y caídas; Worker caído (queda la spec 020); «Calcular puesto en casa» abre la calculadora con 89,99 + 24,50 de envío.
- Delegación en `docs/delegacion-modelos.md`.
