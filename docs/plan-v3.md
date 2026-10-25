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
- **hecho** Tachado con la regla Omnibus; el de Mercado Libre y ComparaYa no cuenta; entra el mismo modelo en otras
  tiendas (035, PR #133).
- **hecho** `/precios/rtx-4060/`: todo Mercado Libre de $689.532 a $7.197.998 y mezclado con la 4060 Ti. Otra version del
  chip es otra placa y una pagina con un solo comercio no se indexa (036).
- **hecho** El mismo producto con el titulo escrito distinto (Tronsmart «Ony»/«Onyx» Ace Pro, blanco y negro): a igual precio
  y referencia, los mismos numeros y casi todas las palabras en comun ocupan un solo lugar.

### 2. Velocidad y tamaño (gatillos de la Fase 4)

- **hecho** Las ofertas de todo el indice se calculan cuando el navegador queda libre, no al bajar el indice (037: TBT local
  de 3,3 s a 1,3-2,3 s).
- **siguiente** Ese calculo en un Web Worker (claves por posicion de la fila).
- **siguiente** Partir el indice por rubro y bajar solo el que se busca (1,71 MB gzip).
- **despues** Si no alcanza: busqueda en el Worker con D1 / SQLite FTS5.

### 3. Accesibilidad y SEO (squirrelscan, Lighthouse)

- **hecho** Contraste, nombre accesible de «Ver aviso», encabezados de tabla, titulo y JSON-LD de la portada (033).
- **hecho** Landmark `<main>` (PR #136).
- **hecho** Enlace «Saltar al contenido» en todas las paginas (squirrelscan: skip-link).
- **hecho** `/precios/`: «en 1 comercio» en singular (#136); «Búsquedas relacionadas» entre paginas (#138).
- **no es falla** El `AggregateOffer` del JSON-LD ya cumple lo que pide Google.
- **no vale el costo** `lastmod` por pagina: hoy es la fecha real de los precios (la del indice). Una fecha por pagina pide
  guardar un hash de cada una entre corridas, y Google ignora `lastmod` cuando no es exacto.
- **hecho** SRI del script de GoatCounter (`count.v4.js`, version fija, con `integrity`).
- **siguiente** `/.well-known/security.txt`.
- **pendiente** Pagina «Acerca de» y contacto (E-E-A-T), con lo que el dueño quiera contar.

### 4. Fallas chicas que encontro la revision (033)

- **hecho** Costo de importar: el precio leido de un link no pisa lo que la persona ya escribio (spec 023).
- **no es falla** Veredicto: la spec 021 pide armarlo con la busqueda mas reciente.
- **no por ahora** Cadena de `if` por tienda en `js/importar.js` y el Worker: funciona, tiene tests y tocarla arriesga el
  reconocimiento de links (Amazon, Tiendamia, Loquieroaca, eBay) sin ganancia para quien usa el sitio. Se reordena si se
  suma una tienda mas.
- **hecho** La lista `paths` de `worker.yml` ya incluye `js/importar.js` y `js/calculadora.js` (que el Worker empaqueta).

### 5. Fuentes

Todo lo que depende del dueño, con paso a paso, enlaces y mensajes armados: `docs/pendientes-del-dueno.md`.

- **pendiente del dueño** FullH4rd (bloquea desde el 8/10), Katech y Compra Cierta: darlas de baja o pedirles un feed.
  Katech responde bien fuera de GitHub (2.552 productos el 24/10) y da 0 desde los servidores de GitHub: bloquea esas IP.
- **hecho** eBay en «Afuera» (25/10): con la exencion de Marketplace Account Deletion concedida, `/buscar` trae resultados
  reales con envio a Argentina y solo articulos nuevos (#143, #145). Los links todavia no llevan comision: falta el numero de
  campaña de eBay Partner Network (`EBAY_CAMPAIGN_ID`), cuando aprueben la solicitud.
- **pendiente del dueño** AliExpress: registro en revision desde el 23/10 (de 1 hora a 2 dias habiles); despues, App Key,
  App Secret y Tracking ID como secretos. Amazon Creators API cuando haya 10 ventas.
- **sin salida de nuestro lado** Tiendamia da HTTP 403 desde el Worker (era 200 el 23/10): es un bloqueo, no se esquiva.
  Se pide un feed o se la da de baja de «Afuera».

### 6. Pendiente y separado

- Instagram (spec 025): PR #126 en borrador, fuera del proceso de las pichincha; si se retoma, workflow propio.

### 7. Monetizacion (Mercado Libre)

- **hecho** El codigo de afiliado sale tambien en la busqueda, la comparativa, la pestaña Ofertas y `/precios/`, con
  `rel="sponsored"` y el rotulo «afiliado» (#146, spec 027). Antes solo salia en `/hoy/`, el feed y Telegram, y con las
  ofertas del 24/10 ni un link de Mercado Libre llegaba a `/hoy/`.
- **medido** Comision de Mercado Libre en monitores: 7 % (la app lo muestra a quien esta conectado como afiliado). En otras
  categorias el porcentaje cambia.
- **medido** El link oficial (`meli.la/…`) redirige a `/social/chococuyano?matt_word&matt_tool&forceInApp&ref=…`: una vitrina
  con el perfil y el boton «Ir a producto». Los links del sitio llevan `matt_word` y `matt_tool` pero van directo al
  producto y sin `ref`.
- **sin confirmar** Que Mercado Libre acredite los clics de un link directo. El panel marca 1 clic y no sube ni con links
  oficiales abiertos desde el mismo telefono: no sirve para decidirlo. Prueba pendiente del dueño: que otra persona, con
  datos moviles, abra un link del sitio y mirar el panel al dia siguiente. Si no suma, se le pregunta al soporte del
  programa (mensaje armado en `docs/pendientes-del-dueno.md`).
- **siguiente** Medir del lado del sitio los clics salientes por tienda (ya salen a GoatCounter con el rubro) y armar un
  tablero chico en `/estado/` con eso: no depende del panel de Mercado Libre.

### 8. Lo que falta, en orden

| # | Que | Quien | Costo | Para que |
| --- | --- | --- | --- | --- |
| 1 | Revisar «Indexacion → Paginas» de Search Console (el mapa de 200 paginas ya figura «Correcto») | dueño | 5 min, hacia el 1/11 | saber cuantas paginas entran y por que no |
| 2 | Numero de campaña de eBay y claves de AliExpress, cuando aprueben | dueño | 10 min | comision en «Afuera» |
| 3 | Contacto publico: `security.txt` y pagina «Acerca de» | dueño decide, yo hago | 1 PR | confianza (E-E-A-T) y seguridad |
| 4 | Prueba de atribucion de clics de Mercado Libre con otra persona | dueño | 10 min + 1 dia | saber si el formato directo cuenta |
| 5 | Mensajes a Katech, FullH4rd, Compra Cierta y Loquieroaca (armados) | dueño | 15 min | cuatro tiendas mas |
| 6 | En «Afuera», separar la version del chip (una «4060 Ti» aparece en «rtx 4060») | yo | 1 PR chico | resultados limpios |
| 7 | Cerrar el issue #117 (alarma vieja de la guardia, hoy sin alarmas) | yo | 1 minuto | orden |
| 8 | Partir el indice por rubro (1,71 MB gzip) | yo | 1-2 PR | velocidad en telefonos de gama baja |
| 9 | Calculo de ofertas en un Web Worker | yo | 1-2 PR, mas riesgo | quitar el bloqueo que queda |
| 10 | ~~Volver a mirar las ofertas de Mercado Libre cuando el historial llegue a una semana~~ **hecho** (spec 038): entre 3 y 6 dias de seguimiento entran «en seguimiento», con su rotulo, hasta 40 % y detras de lo verificado | yo | — | que no quede nada afuera sin inventar historia |

### 9. Posibilidades de mejora (por orden de beneficio sobre costo)

| Idea | Que da | Costo | Dependencia |
| --- | --- | --- | --- |
| **Tablero de clics salientes por tienda** (con lo que ya mide GoatCounter) | saber que tiendas y rubros mueven trafico y decidir donde conseguir afiliados | bajo | ninguna |
| **Alertas de precio por Telegram**: «avisame si baja de $X», con un bot que lee un producto y un umbral | retencion, el pedido mas comun en estos sitios | medio; con Worker sin estado + KV o D1 gratis | gatillo de la Fase 4 (300 usuarios o pedidos de alertas) |
| **Resumen semanal** («lo que mas bajo esta semana») en `/hoy/`, RSS y Telegram | contenido fresco para Google y para el canal, sin trabajo manual | bajo | historial de 7+ dias |
| **Historial de precio en cada pagina de `/precios/`** (la serie ya existe) | un grafico propio da razon para volver y para enlazar | bajo-medio | ninguna |
| **Cuotas y medios de pago**: mostrar el precio en cuotas cuando la tienda lo publica | el precio real en Argentina | medio | datos de cada tienda |
| **Afiliados de otras tiendas** (programas propios de las tiendas locales, Amazon, AliExpress) | mas fuentes de ingreso | bajo por tienda | aprobacion de cada una |
| **Canal de WhatsApp** con el mismo resumen del dia | otro canal, sin servidor | bajo | cuenta del dueño |
| **Instagram** (spec 025, PR #126 en borrador) | alcance | medio; workflow propio | cuenta profesional y app de Meta; solo si GoatCounter muestra que trae clics |
| **Busqueda en el servidor** (Worker + D1 con FTS5) | si partir el indice no alcanza | medio | gatillo de velocidad |
| **Migrar a Astro** | ordenar las plantillas | alto | solo si el generador de paginas se vuelve inmanejable |

No se hace: migrar a Next.js, servidor propio con base de datos, ni cuentas de usuario hasta el gatillo de alertas. Las
reglas de credibilidad (baja propia contra el piso de 30 dias con una semana de seguimiento, tachado solo de tiendas directas,
una oferta por familia) no se aflojan para sumar ofertas de afiliado.
