# Plan v3 (desde el 24/10/2026)

Sale de la revision completa del 24/10 (spec 033: Lighthouse, Web Interface Guidelines, seo-audit, security-best-practices,
code-review y squirrelscan) y de los mensajes de Telegram del 23 y 24/10. Cada punto va por rama y PR; con los tests y la CI
en verde se mergea sin esperar (OK permanente del dueño, 24/10).

## Decision de arquitectura: estatico primero, funciones de borde sin estado, sin servidor propio

**Hoy**: un sitio estatico (GitHub Pages) que arma una GitHub Action con Python y Node (indice, `/precios/`, `/hoy/`, RSS,
Telegram), un front en JavaScript sin framework, y un Cloudflare Worker sin estado («Afuera», specs 022-023) que guarda los
secretos de las APIs de afuera. Es lo que hace Next.js con `output: "export"` (generacion estatica), sin el runtime de React.

**Gatillos de la Fase 4 (`docs/plan-de-escalado.md`) medidos el 24/10:**

| Gatillo | Medido | Disparado |
| --- | --- | --- |
| Indice mayor a 1,5 MB gzip o 40.000 productos | 1,71 MB gzip, 30.125 productos | **si** |
| 2 o mas tiendas bloquean | FullH4rd, Katech, Compra Cierta; Tiendamia y Loquieroaca al Worker | **si** |
| 300 usuarios por semana o pedidos de alertas | (GoatCounter) | no |
| Busquedas lentas en telefonos de gama baja | Lighthouse movil 71, 2,3 s de bloqueo en `/?q=` | **si** |

**Opciones evaluadas:**

| Opcion | Que resuelve | Costo | Veredicto |
| --- | --- | --- | --- |
| Migrar a Next.js (MIT) | nada que hoy falle: el sitio ya se genera estatico | reescribir ~17 mil lineas y sumar ~90 KB de React justo donde el telefono es lento | **no** (el plan de escalado ya lo descarta) |
| Astro (MIT), el mejor framework open source estatico-primero (cero JS por defecto, islas) | ordenaria las plantillas de `/precios/` | migracion grande sin falla que la pida | **no ahora**; es la opcion si algun dia hace falta un framework |
| Partir el indice por rubro y buscar en un Web Worker | indice grande y busqueda lenta | chico, sin servidor, sin costo | **si: primero** |
| Busqueda del lado del servidor: Worker + D1 (SQLite FTS5, open source) | busqueda lenta si lo anterior no alcanza | medio; gratis en el plan de Cloudflare | **despues, si hace falta** |
| Servidor con base de datos y cuentas: Cloudflare Workers + D1, o PocketBase (MIT, SQLite) / Supabase (Apache 2, Postgres) autoalojados | alertas por usuario | alto; operacion propia | **solo con el gatillo de 300 usuarios o pedidos de alertas** |

**Decision**: seguir estatico, con funciones de borde sin estado para lo que necesita secretos o leer afuera, y responder a
los gatillos en orden de menor costo. No hay servidor propio ni base de datos hasta el gatillo de alertas. La constitucion se
enmienda (1.1.0) para decirlo.

## Plan

Estado: hecho / en curso / siguiente / pendiente del dueño.

### 1. Credibilidad de las ofertas del dia (lo mas urgente)

- **hecho** Baja propia contra el piso de 30 dias (029), con una semana de seguimiento (034).
- **hecho** Una oferta por modelo o familia en todas las categorias (028, 033) y un producto de catalogo de Mercado Libre una
  sola vez (032).
- **hecho** Carrefour verificado de verdad (032).
- **en curso** Tachado con la regla Omnibus; el de Mercado Libre y ComparaYa no cuenta; entra el mismo modelo en otras
  tiendas (035, PR #133).
- **siguiente** Precios absurdos de Mercado Libre directo: `/precios/rtx-4060/` muestra 15 opciones, todas de Mercado Libre, de
  $750.000 a $3.687.000, y mezcla RTX 4060 con 4060 Ti. Descartar del indice el aviso de Mercado Libre muy por encima del
  mismo modelo en las tiendas locales, y no juntar «Ti» con la version comun.
- **siguiente** El mismo producto en dos colores con el titulo escrito distinto (Tronsmart Onyx Ace Pro blanco y negro).

### 2. Velocidad y tamaño (gatillos de la Fase 4)

- **siguiente** Buscar en un Web Worker: la busqueda y el analisis (2 s de tarea larga en `arranque.js`) no bloquean la pantalla.
- **siguiente** Partir el indice por rubro y bajar solo el que se busca (1,71 MB gzip).
- **despues** Si no alcanza: busqueda en el Worker con D1 / SQLite FTS5.

### 3. Accesibilidad y SEO (squirrelscan, Lighthouse)

- **hecho** Contraste, nombre accesible de «Ver aviso», encabezados de tabla, titulo y JSON-LD de la portada (033).
- **siguiente** Landmark `<main>` y enlace «Saltar al contenido» (squirrelscan: landmark-one-main, skip-link).
- **siguiente** `/precios/`: «en 1 comercios» → singular; `Offer` del JSON-LD con precio y disponibilidad (schema/product);
  `lastmod` del sitemap con la fecha real de cada pagina; enlaces entre paginas de `/precios/` (24 paginas huerfanas).
- **siguiente** `/.well-known/security.txt`; SRI del script de GoatCounter.
- **pendiente** Pagina «Acerca de» y contacto (E-E-A-T), con lo que el dueño quiera contar.

### 4. Fallas chicas que encontro la revision (033)

- **siguiente** Costo de importar: el precio leido de un link no pisa lo que la persona ya escribio (spec 023).
- **siguiente** Veredicto: mirar la portada no fija la consulta ni cambia la URL (spec 021).
- **siguiente** Cadena de `if` por tienda repetida en `js/importar.js` y el Worker; la lista `paths` de `worker.yml`.

### 5. Fuentes

- **pendiente del dueño** FullH4rd (bloquea desde el 8/10), Katech y Compra Cierta: darlas de baja o pedirles un feed.
- **pendiente del dueño** Credenciales de eBay y AliExpress para Afuera (las unicas fuentes que no se bloquean, y pagan
  comision). Amazon Creators API cuando haya ventas.

### 6. Pendiente y separado

- Instagram (spec 025): PR #126 en borrador, fuera del proceso de las pichincha; si se retoma, workflow propio.
