# Feature Specification: Novedades por marca y "¿vale la pena el nuevo?"

**Feature Branch**: `011-novedades`

**Created**: 2026-10-15

**Status**: Draft (medicion hecha; falta decidir marcas, donde vive la seccion y el criterio de "mejor opcion")

**Input**: Pedido del dueño el 15/10/2026: "agregar una seccion donde se consulte periodicamente cada novedad de marca (intel, amd, motorola, iphone, macbook, asus rog, LG, Samsung, etc) y
agregando a la comparativa, si es la mejor opcion vs modelo anterior propio o de la competencia". Resuelve parte de B6 de `docs/plan-v2.md` (orden por novedad: hoy no hay fecha de lanzamiento en ningun dato).

## Supuestos (a corregir si alguno esta mal)

1. **"Novedad"** = un lanzamiento anunciado por la propia marca (producto nuevo), no cualquier noticia corporativa.
2. **"Consultar periodicamente"** = una corrida diaria automatica del Action, igual que el relevamiento de precios, con un pedido por fuente por dia (principio III).
3. **"Mejor opcion"** se juzga con lo que tenemos: el **precio de las tiendas que seguimos**, las **specs que dice el nombre** (capacidad, RAM, pantalla, generacion) y la regla de la casa
   (mejor precio por la mejor calidad). **No hay benchmarks**: los de terceros (Geekbench, PassMark, Notebookcheck) tienen condiciones de uso que no permiten copiarlos, asi que el veredicto dice en que se basa y no promete rendimiento.
4. Primero se **muestra** la novedad con su enlace oficial; recien despues se compara. Un lanzamiento que todavia no se vende aca no se compara contra precios que no existen.

## Medicion previa (15/10/2026)

### Fuentes oficiales de novedades

Se probo cada feed con un pedido, con `User-Agent` de navegador, y `robots.txt` de cada host.

| Marca | Fuente | Estado | Ultimo item | Observaciones |
|---|---|---|---|---|
| Apple | newsroom RSS | **anda** (20 items) | 15/10 | |
| NVIDIA | nvidianews RSS | **anda** (20) | 15/10 | |
| AMD | relaciones con inversores, comunicados RSS | **anda** (10) | 12/10 | Solo comunicados formales |
| Samsung | news.samsung.com global (50) y latin (10) | **anda** | 15/10 y 14/10 | El feed latam esta en español |
| Lenovo (y Motorola global) | news.lenovo.com RSS | **anda** (42) | 14/10 | Lenovo es dueña de Motorola, pero la nota de Motorola casi no aparece aca |
| Google Pixel | blog.google RSS | **anda** (20) | 15/10 | |
| Microsoft (Surface, Windows) | news.microsoft.com RSS | **anda** (10) | 15/10 | |
| Sony PlayStation | blog.playstation.com RSS | **anda** (10) | 15/10 | |
| Dell | blog de Dell RSS | **anda** (20) | 15/10 | Casi todo es contenido, no lanzamientos |
| **Intel** | newsroom.intel.com | **403 «Access Denied»** (WAF anti-bots) | | **No se esquiva** (principio III). Queda el canal de YouTube (feed Atom publico) como señal secundaria, o pedir un feed |
| **Motorola** | motorolanews.com | **500: «No feed available»** (WordPress sin feed) | | Alternativa propia: el **sitemap de motorola.com.ar** (361 productos, `robots.txt` lo declara): sirve para detectar **productos nuevos en su tienda argentina** comparando un dia con el siguiente; la fecha `lastmod` es siempre la de hoy y no sirve |
| **ASUS y ROG** | press.asus.com, rog.asus.com | **404**: no encontre un feed oficial | | Canal de YouTube de ROG: anda, trae mucho ruido (unboxings) |
| **LG** | lg.com/global/newsroom | **sin feed encontrado**; `lgnewsroom.com` es la edicion de Vietnam, sin items | | |
| Xiaomi, Qualcomm, HP | probadas las rutas habituales | **404 o HTML** | | Sin feed oficial encontrado |

**9 de las 16 marcas probadas tienen un feed oficial que anda**; 7 (Intel, Motorola, ASUS/ROG, LG, Xiaomi, Qualcomm y HP) no, y justo ahi estan tres de los ejemplos del pedido (Intel, Motorola y ASUS ROG).

### Cuanta de la noticia es un lanzamiento

Con un filtro simple (verbos de lanzamiento mas nombres de producto) pasan **23 de 212 titulares (11 %)** de los diez feeds que andan; leidos a mano, **alrededor de la mitad son lanzamientos
reales** (Apple TV 4K, Galaxy Tab S12, Yoga con nuevas PC de IA, accesorios del Pixel 11, Dell Pro Rugged) y la otra mitad son falsos positivos («Meet Lefa Makgato», «new collection»).
Son unos **10 lanzamientos por semana** entre todas las marcas: poco volumen, alto ruido. Un filtro automatico solo no alcanza; hace falta **una revision** antes de publicar.

### Modelo anterior (Wikidata)

Wikidata (CC0, con CORS) trae la relacion «sigue a» y «seguido por» entre modelos. Cobertura medida con 14 productos:

| Producto | ¿Existe? | Anterior / siguiente | Fecha de lanzamiento |
|---|---|---|---|
| iPhone 16 y 17, Galaxy S25 y S26, Pixel 10 | si | **si, ambos** | iPhone 17, Pixel 10 si; Galaxy no |
| GeForce RTX 5070 | si | anterior si (RTX 4070) | si |
| Ryzen 9 9950X, Core Ultra 9 285K, Radeon RX 9070 XT | si | **no** | si |
| MacBook Air M4 | si, casi vacio | no | no |
| Motorola Edge 50 Pro, Moto G85, ROG Strix G16, LG OLED C5 | **no existe** | | |

**Funciona para los telefonos y chips de gama alta de las marcas grandes; no para Motorola, ROG ni LG**, justo lo que mas se busca aca. Para esos hay que inferir el anterior **del nombre**
(la misma serie con el numero de generacion anterior: Edge 70 → Edge 60) y avisar que es una inferencia.

### Lo que ya tenemos en casa

Una pista gratis y sin terceros: el **historial** de precios guarda la fecha en que cada aviso aparecio por primera vez. «Aparecio hoy en las tiendas» (por ejemplo un `Moto G67` que ayer no estaba)
sirve para las marcas sin feed (Motorola, ASUS) y es un dato nuestro. Ojo: es «nuevo en tiendas», no «nuevo en el mundo» (una tienda puede sumar algo viejo). El historial arranco el 07/10:
hace falta una o dos semanas para que la señal valga.

## User Scenarios & Testing

### User Story 1 - Enterarme de un lanzamiento y ver si ya se consigue aca (Priority: P1)

Una persona abre «Novedades» y ve «Samsung presenta la Galaxy Tab S12» con el enlace a la nota oficial, la fecha y, si ya se vende en alguna tienda que seguimos, su precio.

**Independent Test**: con un feed guardado, el colector arma la lista de lanzamientos y la pagina los muestra con marca, fecha y enlace; uno que coincide con un aviso del indice muestra tambien el precio.

**Acceptance Scenarios**:

1. **Given** un feed oficial con un titular de lanzamiento, **When** corre el colector, **Then** entra a `novedades.json` con marca, titular, enlace oficial y fecha; las noticias que no son de producto no entran.
2. **Given** una marca sin feed (o bloqueada), **When** corre el colector, **Then** se omite sin error y la pagina dice «sin fuente oficial» para esa marca, en vez de mostrar un hueco.
3. **Given** un lanzamiento que coincide con avisos del indice, **When** se arma la pagina, **Then** muestra desde cuanto se consigue y en cuantas tiendas.

### User Story 2 - ¿Vale la pena el nuevo? (Priority: P2)

Una persona mira el nuevo `Edge 70` y quiere saber si conviene contra el `Edge 60` o contra un competidor de precio parecido.

**Independent Test**: con dos modelos del indice (nuevo y anterior), el panel muestra la diferencia de precio y de specs leidas del nombre, y un veredicto que explica en que se basa.

**Acceptance Scenarios**:

1. **Given** un modelo nuevo y su anterior (por Wikidata o inferido del nombre), **When** ambos estan en el indice, **Then** el panel muestra precio, capacidad, RAM y pantalla de cada uno y la diferencia.
2. **Given** que el anterior se inferio del nombre, **When** se muestra, **Then** lo dice («anterior inferido por el nombre»).
3. **Given** que no hay datos suficientes (sin anterior o sin specs), **When** se pide el veredicto, **Then** dice «no hay datos para comparar» y no inventa uno.

### User Story 3 - Que la comparativa muestre lo mas nuevo primero (Priority: P3)

Una busqueda de «motorola» ofrece, ademas de la mejor compra, la **opcion mas nueva** (la generacion mas reciente) y la de mayor capacidad, antes de la premisa de precio.

**Independent Test**: dado un indice con modelos de varias generaciones de una serie, la comparativa agrega un renglon «Mas nuevo» con la generacion mas alta y sin cambiar el orden de «Mejor compra».

## Requirements

- **FR-001**: Solo se consultan **fuentes oficiales y publicas** (feeds RSS o Atom, sitemaps declarados en `robots.txt`): un pedido por fuente por dia, `User-Agent` que identifica al sitio, respeto de `robots.txt`, `If-None-Match` y `If-Modified-Since` cuando existan.
- **FR-002**: Un bloqueo (403, 429, 503, WAF) o un `robots.txt` que excluye la ruta **nunca se esquiva**: la fuente se omite, se avisa (como `salud-fuente`) y se pide permiso o un feed.
- **FR-003**: Se guarda solo **titular, enlace, fecha y marca**; nunca el texto de la nota. Cada novedad enlaza a su fuente. Sin imagenes de terceros.
- **FR-004**: Un lanzamiento se publica **despues de una revision** (un PR con los candidatos de la semana que el dueño aprueba), no solo por un filtro automatico, porque el filtro acierta la mitad.
- **FR-005**: Toda comparacion dice en que se basa (precio de tiendas que seguimos y specs leidas del nombre) y no usa benchmarks de terceros. Si el modelo anterior se infirio del nombre, lo dice.
- **FR-006**: El orden de «Mejor compra» no cambia por esta seccion (principio II); «Mas nuevo» es un renglon aparte.
- **FR-007**: Las novedades se guardan 90 dias. Las que ya no estan en el feed no se borran antes.
- **FR-008**: Funciona sin red y sin JavaScript: la pagina es estatica, armada en el build.

## Diseño propuesto

- **`novedades.py`** (biblioteca estandar): baja cada feed, filtra candidatos, y escribe `novedades-candidatas.json`. Las fuentes viven en `novedades.json` (configuracion, no codigo): marca, URL, tipo (`rss`, `atom`, `sitemap`), idioma y palabras de lanzamiento.
- **Revision**: una rutina programada semanal (`schedule`) abre un PR «Novedades de la semana» con los candidatos para aprobar; sin aprobacion no se publica nada.
- **`generar_novedades.js`**: la pagina estatica `/novedades/` (y el bloque «Novedad» en la comparativa), con el mismo analisis que usa el resto del sitio.
- **Modelo anterior**: primero Wikidata (`sigue a`), despues inferencia por serie y generacion del nombre; ambos marcados.
- **Panel de comparacion**: precio, capacidad, RAM y pantalla (con `Buscador.specsDe`), diferencia, y un veredicto con regla escrita: «conviene el nuevo si cuesta menos de un 15% mas y mejora al menos una spec sin empeorar otra».

## Fases

| Fase | Que | Depende de |
|---|---|---|
| **N0** | Esta medicion y spec | hecho |
| **N1** | Colector de feeds oficiales (9 marcas) → `novedades-candidatas.json`; pagina `/novedades/` con titular, marca, fecha y enlace; rutina semanal que abre el PR de revision | decidir marcas y revision |
| **N2** | «Nuevo en tiendas» desde el historial (Motorola, ASUS y las que no tienen feed) y cruce de cada lanzamiento con el indice: «desde $X en N tiendas» | 1-2 semanas de historial |
| **N3** | Modelo anterior (Wikidata mas inferencia por nombre) y panel «¿vale la pena el nuevo?» | N1 y N2 |
| **N4** | Renglon «Mas nuevo» en la comparativa y orden por generacion en los rubros donde importa (cierra B6) | N3 |
| **N5** | Aviso en Telegram de los lanzamientos aprobados | N1 |

## Success Criteria

- **SC-001**: La pagina muestra al menos 5 lanzamientos reales por semana de las marcas con feed, y ninguna noticia corporativa publicada como lanzamiento (revision humana).
- **SC-002**: Para los telefonos de Samsung, Apple y Google, y las placas NVIDIA, el panel encuentra el modelo anterior en el 80% de los casos; para Motorola, ROG y LG lo declara como inferido.
- **SC-003**: Ninguna fuente bloqueada se pide mas de una vez por corrida.

## Decisiones que necesito del dueño

1. **Marcas de la primera version**: propongo Apple, Samsung, Google, NVIDIA, AMD, Lenovo, Microsoft, Sony y Dell por feed, **Motorola y ASUS ROG por «nuevo en tiendas»** (N2), e **Intel por YouTube** o pidiendoles un feed. ¿Agregamos otras?
2. **Revision**: ¿aprobas un PR semanal de candidatos, o preferis publicar automatico lo que pase un filtro mas estricto (mas rapido, pero la mitad seria ruido)?
3. **Donde vive**: ¿una pestaña nueva «Novedades» o un bloque dentro de la Comparativa? Propongo las dos: la pestaña lista todo y la Comparativa muestra «Mas nuevo» solo en las busquedas de esa marca.
4. **Criterio de «mejor opcion»**: ¿te sirve la regla «cuesta menos de un 15% mas y mejora al menos una spec sin empeorar otra», o preferis otra?

## Assumptions

- Los feeds oficiales pueden cambiar o desaparecer; la salud de fuentes avisa cuando uno baja.
- No se usa ninguna fuente que prohiba el acceso automatico, aunque tenga mejores datos.
- Wikidata se usa como referencia abierta (CC0) y se cachea en el build; si no responde, se usa solo la inferencia por nombre.
