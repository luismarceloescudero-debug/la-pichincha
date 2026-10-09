# Feature Specification: Paginas por busqueda popular

**Feature Branch**: `001-paginas-por-busqueda`

**Created**: 2026-10-08

**Status**: Draft

**Input**: User description: "Paginas estaticas por busqueda popular para que Google encuentre La Pichincha (Fase 1, F1.2 + F1.3 de docs/plan-de-escalado.md). La Action diaria genera, a partir del indice de precios, una pagina HTML estatica por cada consulta popular (por ejemplo /precios/ssd-1tb/, /precios/rtx-4060/, /precios/monitor-27-144hz/), empezando con unas 50 consultas y creciendo segun lo que muestre la analitica (busqueda y busqueda_vacia en GoatCounter). Cada pagina tiene un H1 con la consulta, la tabla de opciones renderizada en el HTML (sin depender de JavaScript), la mediana, la mejor compra con su razon, la fecha y hora de los precios, datos estructurados JSON-LD (ItemList y AggregateOffer), canonical y Open Graph propios, y un boton para abrir la comparativa interactiva (?q=). Ademas se publican sitemap.xml y robots.txt para darlas de alta en Google Search Console y Bing. Las paginas usan los mismos estilos que el sitio, en tema claro y oscuro, y la misma logica de comparables, exclusiones y mejor compra que el buscador. El contenido tiene que ser util de verdad (precios del dia en 5 fuentes), no relleno."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Llegar desde Google a una comparacion ya armada (Priority: P1)

Una persona busca en Google "precio ssd 1tb argentina" y entra a la pagina de La Pichincha para
"SSD 1TB". Sin esperar a que cargue nada, ve las opciones con el precio del dia en varias tiendas,
cual conviene comprar y por que, la mediana del mercado y cuando se tomaron los precios. Cada
opcion la lleva al aviso de la tienda.

**Why this priority**: Google es uno de los dos canales gratis del plan, y hoy el sitio tiene una
sola pagina indexable. Es lo que mueve el criterio de salida de la Fase 1: 100 paginas indexadas
y 500 visitas organicas por mes.

**Independent Test**: Abrir la pagina de una consulta con los scripts del navegador desactivados (o
leerla tal como la recibe un buscador) y comprobar que el contenido completo esta ahi.

**Acceptance Scenarios**:

1. **Given** el indice de precios del dia y la lista de consultas, **When** se publica el sitio,
   **Then** existe una pagina por cada consulta de la lista en `/precios/<slug>/`.
2. **Given** una pagina de consulta, **When** se lee sin ejecutar scripts, **Then** muestra la consulta
   como titulo principal, la fecha y hora de los precios, cuantos avisos y comercios se
   compararon, la mejor compra con su razon, la mediana y una tabla con nombre, comercio, precio
   y sellos de cada opcion, con enlace al aviso.
3. **Given** una consulta y el mismo indice, **When** comparo su pagina con la Comparativa
   interactiva, **Then** coinciden la mejor compra, la mediana y lo que quedo afuera.

---

### User Story 2 - Seguir al analisis interactivo (Priority: P2)

Desde la pagina, la persona toca "Ver la comparativa completa" y llega a la vista interactiva con
esa busqueda ya cargada, donde puede cambiar el orden, ver el ranking de tiendas, el veredicto,
exportar y compartir.

**Why this priority**: La pagina estatica atrae; la vista interactiva es donde se decide la
compra y donde estan los clics salientes, la metrica norte.

**Independent Test**: Tocar el boton en cualquier pagina y verificar que abre la comparativa de
esa misma consulta.

**Acceptance Scenarios**:

1. **Given** la pagina de "rtx 4060", **When** toco "Ver la comparativa completa", **Then** se abre
   el sitio con la comparativa de "rtx 4060" armada.
2. **Given** cualquier pagina, **When** hago clic en una opcion, **Then** se abre el aviso de la
   tienda y el clic queda medido igual que en el resto del sitio.

---

### User Story 3 - Que los buscadores descubran y entiendan las paginas (Priority: P2)

Google y Bing encuentran todas las paginas publicadas, entienden que son listas de productos con
un rango de precios en pesos, y al compartir una pagina en WhatsApp sale con su titulo,
descripcion e imagen.

**Why this priority**: Sin descubrimiento las paginas no se indexan; sin datos estructurados no
compiten con los resultados enriquecidos de otros comparadores.

**Independent Test**: Revisar el mapa del sitio, el archivo de reglas para buscadores y pasar una
muestra de paginas por el validador de datos estructurados.

**Acceptance Scenarios**:

1. **Given** una publicacion, **When** leo el mapa del sitio, **Then** lista la pagina principal,
   el indice de consultas y cada pagina indexable, con la fecha de los precios.
2. **Given** una pagina, **When** la paso por el validador de datos estructurados, **Then** no hay
   errores y se reconocen la lista de productos y el rango de precios (minimo, maximo, cantidad,
   moneda ARS).
3. **Given** una pagina, **When** la pego en WhatsApp, **Then** se ve su titulo, una descripcion
   con el precio "desde" y la imagen del sitio.

---

### User Story 4 - La lista de consultas crece con lo que busca la gente (Priority: P3)

El dueño revisa en la analitica que se busca y que no se encuentra, agrega consultas a la lista
sin tocar codigo, y en la proxima publicacion aparecen sus paginas y entran al mapa del sitio.

**Why this priority**: Las primeras 50 son una apuesta; el crecimiento hasta 300 tiene que salir de
datos reales.

**Independent Test**: Agregar una consulta a la lista, publicar y verificar que existe su pagina y
figura en el mapa del sitio.

**Acceptance Scenarios**:

1. **Given** una consulta nueva en la lista, **When** se publica, **Then** existe su pagina y
   figura en el mapa del sitio y en el indice de consultas.
2. **Given** una consulta que hoy no alcanza el minimo de opciones comparables, **When** se
   publica, **Then** su pagina dice que hoy no hay opciones suficientes, ofrece el buscador, no se
   indexa y no figura en el mapa del sitio.

### Edge Cases

- Una consulta con menos de 5 opciones comparables: pagina de "hoy no hay opciones suficientes",
  marcada para no indexar y fuera del mapa del sitio. La URL sigue existiendo, para no romper
  enlaces ya indexados.
- Una tienda caida o bloqueada (como FullH4rd hoy): la pagina usa lo publicado en el indice, marca
  esos productos con la fecha de su ultimo precio verificado y dice cuantas fuentes aportaron.
- Compras internacionales: se listan marcadas pero no compiten por la mejor compra, igual que en
  el buscador.
- Consultas con acentos, comillas o simbolos ("monitor 27\"", "placa de video"): el slug es
  estable, en minusculas, sin acentos y con guiones. Dos consultas que dan el mismo slug detienen
  la publicacion con un error que dice cuales son.
- Una consulta con cientos de avisos: la tabla muestra las 20 primeras opciones comparables y
  dice cuantas mas hay en la comparativa interactiva.
- Si la publicacion no tiene indice de precios: no se publican paginas vacias; queda un aviso en
  la corrida y el mapa del sitio lista solo la pagina principal.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Cada publicacion MUST generar una pagina en `/precios/<slug>/` por cada consulta de
  la lista.
- **FR-002**: El slug MUST ser la consulta en minusculas, sin acentos, con palabras separadas por
  guiones y solo letras, numeros y guiones; MUST ser unico en la lista.
- **FR-003**: El contenido principal de cada pagina MUST venir en la pagina tal como se entrega, sin
  depender de scripts del navegador: titulo con la consulta, fecha y hora de los precios, cantidad de avisos y de
  comercios, mejor compra con su razon, mediana, y una tabla de hasta 20 opciones comparables con
  nombre, comercio, precio, sellos (compra internacional, tienda oficial, envio gratis, bajo N%) y
  enlace al aviso.
- **FR-004**: La seleccion de opciones, las exclusiones, la mediana y la mejor compra MUST dar el
  mismo resultado que la Comparativa interactiva para la misma consulta y el mismo indice.
- **FR-005**: Cada pagina MUST ofrecer un enlace a la comparativa interactiva de esa consulta.
- **FR-006**: Cada pagina MUST tener titulo y descripcion propios (con el precio "desde" y la
  mediana), URL canonica absoluta y metadatos para compartir con la imagen del sitio.
- **FR-007**: Cada pagina indexable MUST declarar datos estructurados con la lista de productos
  mostrados (nombre, URL, precio en ARS) y el rango de precios (minimo, maximo, cantidad de
  ofertas, moneda ARS).
- **FR-008**: Una consulta con menos de 5 opciones comparables MUST publicarse como pagina de
  "hoy no hay opciones suficientes", marcada para no indexar y fuera del mapa del sitio.
- **FR-009**: Cada publicacion MUST generar un mapa del sitio con la pagina principal, el indice de
  consultas y las paginas indexables, con la fecha de los precios como ultima modificacion.
- **FR-010**: Cada publicacion MUST generar reglas para buscadores que permitan rastrear todo el
  sitio e indiquen el mapa del sitio.
- **FR-011**: MUST existir un indice de consultas en `/precios/` que enlace todas las paginas
  indexables, y la pagina principal MUST enlazar a ese indice.
- **FR-012**: Las paginas MUST usar los estilos del sitio, verse bien en tema claro y oscuro y en
  un telefono.
- **FR-013**: Las visitas a estas paginas y los clics hacia tiendas MUST medirse con la misma
  analitica sin cookies del sitio.
- **FR-014**: La lista de consultas MUST poder editarse sin tocar codigo. La lista inicial (~50
  consultas) la arma el equipo desde el indice, eligiendo rubros con muchos avisos y varias
  tiendas, y el dueño la revisa (saca o agrega) antes de publicarla.
- **FR-015**: Las URL absolutas (canonica, mapa del sitio, datos para compartir) MUST usar el
  dominio actual de GitHub Pages y salir ya; al llegar el dominio propio (F1.4) la base de las URL
  se cambia en un solo lugar y se reenvia el mapa del sitio.
- **FR-017**: Un producto cuya fuente no se pudo relevar el dia de los precios MUST mostrar la fecha
  de su ultimo precio verificado (por ejemplo "precio del 7/10") con el mismo criterio que el sitio
  principal, y esa fecha MUST figurar tambien en los datos estructurados cuando corresponda.
- **FR-016**: Si la publicacion no tiene indice de precios, MUST omitir las paginas de consulta,
  dejar un aviso en la corrida y publicar el mapa del sitio solo con la pagina principal.

### Key Entities

- **Consulta popular**: el texto que busca la gente ("ssd 1tb"), su slug y, opcionalmente, por que
  esta en la lista (curada, sugerida por la analitica).
- **Pagina de consulta**: la consulta, la fecha y hora de los precios, las opciones comparables,
  lo que quedo afuera y por que, la mejor compra, la mediana y si es indexable.
- **Mapa del sitio**: las URL publicadas que se pueden indexar, con su fecha de ultima
  modificacion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cada publicacion genera paginas para el 100% de las consultas de la lista, y al menos
  el 90% de ellas son indexables (5 o mas opciones comparables).
- **SC-002**: Una pagina muestra su contenido completo sin ejecutar scripts del navegador.
- **SC-003**: Una muestra de 5 paginas pasa el validador de datos estructurados sin errores.
- **SC-004**: Para la misma consulta e indice, la mejor compra y la mediana de la pagina coinciden
  con la Comparativa interactiva en el 100% de una muestra de 10 consultas.
- **SC-005**: A 4 semanas del alta en Search Console hay al menos 40 paginas indexadas, en camino
  al criterio de salida de la Fase 1 (100 paginas indexadas y 500 visitas organicas por mes).
- **SC-006**: Las paginas se leen bien en un telefono y en tema oscuro, comprobado con capturas.
- **SC-007**: La publicacion diaria no tarda mas de 2 minutos extra por generar las paginas.

## Assumptions

- La analitica tiene pocas horas de datos: la lista inicial no puede salir solo de ella.
- Las paginas se regeneran en cada publicacion, con el indice del dia; no hay paginas por producto
  (eso es F2).
- La imagen para compartir es la del sitio (`img/og.png`); no hay imagen por consulta.
- Los precios son con IVA y sin envio, como en el resto del sitio; el texto va en español
  rioplatense.
- El unico cambio en la pagina principal es el enlace al indice de consultas.
- El alta en Google Search Console y Bing la hace el dueño con su cuenta; la feature deja listo
  todo lo que esas herramientas piden.
