# Plan de escalado de La Pichincha

Escrito el 2026-10-08, con el repo en el commit `6ebee30`.

## Diagnostico: lo que se midio hoy

| Que | Dato |
| --- | --- |
| Edad del proyecto | 2 dias, 22 commits |
| Trafico (GitHub, ultimos 14 dias) | 2 visitas, 1 visitante unico: el dueño |
| Analitica en el sitio | ninguna |
| Indice | 8.506 productos de 5 fuentes, 1,9 MB crudo, 404 KB gzip, se baja entero al navegador |
| Codigo del sitio | un `index.html` de 2.508 lineas con ~65 funciones inline, duplicado en `comparativa-ram-ddr4-16gb.html` |
| Tests | ninguno, ni en Python ni en JS |
| URLs compartibles | no: el hash solo guarda la pestaña. Un link a una busqueda abre la pagina generica |
| Vista previa en WhatsApp | sin Open Graph: el link sale pelado |
| Paginas indexables por Google | una sola |
| Historial de precios | `precios.json` vive en la cache de Actions, que GitHub puede desalojar |
| Horario de actualizacion | el cron de las 09:00 corrio ayer a las 15:25: GitHub atrasa los programados |
| Monetizacion | ninguna |

## La tesis

La Pichincha no tiene un problema de tecnologia: tiene cero usuarios y nada que
se los traiga. Ya tiene mas funciones que muchos comparadores con trafico
(Excel con formato, impresion, veredicto, ranking de tiendas) y ninguna forma de
que alguien la encuentre o la comparta.

Escalar, en este orden, es:

1. **Medir**: sin numeros cada decision es una opinion.
2. **Ser encontrable y compartible**: Google y WhatsApp son los dos canales gratis.
3. **Tener datos que nadie mas tiene**: el historial de precios entre tiendas.
4. **Cobrar por el clic**, sin que la plata toque el ranking.

La arquitectura estatica (Pages + Actions, sin backend) esta bien elegida y se
queda. Se cambia solo cuando un numero lo pida, y los gatillos estan escritos
en la Fase 4.

## Metrica norte

**Clics salientes a tiendas por semana.** Es lo que prueba que la pagina sirvio
para decidir una compra, y es exactamente lo que se cobra en afiliados o CPC.
Las visitas solas no alcanzan.

## Fase 0: cimientos (semana 1)

Nada de UI nueva en esta fase.

- **F0.1 Analitica sin cookies** (GoatCounter o Cloudflare Web Analytics, sin
  banner de consentimiento). Eventos: `busqueda` (termino y cantidad de
  resultados), `clic_saliente` (tienda y rubro), `compartir`, `exportar`,
  `busqueda_vacia`.
- **F0.2 La busqueda va a la URL**: `?q=ssd+1tb#comparativa`. Abrir ese link
  reproduce la vista. Es el arreglo mas barato con mas efecto en la difusion.
- **F0.3 Open Graph y Twitter Card** con imagen propia, para que el link en
  WhatsApp muestre titulo, descripcion y foto.
- **F0.4 El historial sale de la cache de Actions**: una rama huerfana
  `historial` con un CSV de solo cambios (`fecha,tienda,id,precio`) que la
  Action commitea cada dia. Crece poco, no ensucia `main` y no se pierde.
- **F0.5 Tests**. Python: `unittest` (sin dependencias nuevas) con HTML
  guardado de cada tienda en `tests/fixtures/`, para que un cambio de plantilla
  se detecte en el test y no en produccion. JS: sacar las funciones puras
  (`specsDe`, `motivoExclusion`, `marcaDe`, `ordenar`, `mediana`) a modulos y
  probarlas con `node --test`. El job de tests corre antes del despliegue.
- **F0.6 Salud de fuentes**: si una tienda devuelve menos del 70% de los
  productos de la corrida anterior, la Action abre un issue solo.
- **F0.7 Una sola fuente del HTML**: la copia para el artifact se genera en el
  build en vez de mantenerse a mano.
- **F0.8 Mostrar la hora real** de la ultima actualizacion, no "09:00".

**Sale de la fase cuando:** la analitica registra eventos, un link con `?q=`
abre la busqueda, el historial sobrevive a borrar la cache, y CI corre tests.

## Fase 1: encontrable y compartible (semanas 2 a 4)

- **F1.1 Partir el monolito**: `index.html` pasa a `src/` (CSS y modulos JS) y
  un paso de build en Python los arma. Sin framework: no hace falta.
- **F1.2 Paginas estaticas por consulta popular**: Python genera
  `/precios/<slug>/` desde el indice. Cada una con H1, tabla renderizada en el
  servidor, mediana, mejor compra, fecha de los precios, JSON-LD (`ItemList` y
  `AggregateOffer`), canonical y Open Graph. Arrancar con 50 consultas
  ("ssd 1tb", "rtx 4060", "monitor 27 144hz") y crecer a 300 segun lo que
  muestre la analitica. Despues, el JS levanta la vista interactiva encima.
  Es contenido util de verdad, con precios del dia en 5 fuentes, no relleno.
- **F1.3 `sitemap.xml`, `robots.txt`**, alta en Google Search Console y Bing.
- **F1.4 Dominio propio `.com.ar`**: Pages lo sirve con HTTPS gratis.
- **F1.5 PWA**: manifest, icono y service worker que cachea la cascara y el
  indice. Queda instalable en Android y abre sin red.
- **F1.6 Difusion a mano**: tres pichinchas por semana en comunidades de armado
  de PC (Reddit, Discord, grupos), siempre con link a una busqueda con `?q=`.

**Sale de la fase cuando:** hay 100 paginas indexadas en Search Console y
llegan las primeras 500 visitas organicas por mes.

## Fase 2: datos que nadie mas tiene (mes 2)

- **F2.1 Identidad de producto por codigo de modelo** (hecho, spec 003): extraer el part number
  del nombre con expresiones por rubro (`KF432C16BB/16`, `CT1000P3SSD8`) y
  agrupar el mismo producto entre tiendas **solo** cuando el codigo coincide
  exacto. Agrupar por nombre ya se probo y fallo (README). Medir la cobertura
  por rubro y arrancar por RAM, SSD y placas de video.
- **F2.2 Serie de precios por producto**: "minimo de 30 y 90 dias", un
  grafiquito, y el sello "subio antes de la oferta" para las rebajas infladas.
  Esto es el foso: nadie en Argentina lo muestra para hardware en 5 tiendas.
- **F2.3 Mas fuentes**: Mercado Libre directo (cobertura y afiliados) y tiendas
  de hardware a probar con `indexar.py --probar`. El orden lo da
  `busqueda_vacia`: primero lo que la gente busca y no encuentra.
- **F2.4 Curadas de 2 a 8 rubros**, elegidos por volumen de busqueda real.
  Agregar una curada tiene que ser completar `datos.json`, no tocar codigo.

**Sale de la fase cuando:** el 40% de los productos de los rubros prioritarios
esta agrupado por codigo y hay 30 dias de serie.

## Fase 3: volver y cobrar (mes 3)

- **F3.1 Canal de Telegram automatico** "Pichinchas del dia", publicado por la
  misma Action con la API de bots, y un RSS de ofertas como archivo estatico.
  Ninguno de los dos necesita backend.
- **F3.2 Monetizacion**: links de afiliado de Mercado Libre (programa lanzado
  en Argentina en noviembre de 2025, hasta 15% segun rubro; confirmar las tasas
  vigentes en mercadolibre.com.ar/l/afiliados). Con el numero de clics
  salientes en la mano, ofrecer CPC o acuerdo a las tiendas. **Regla fija:** el
  orden nunca depende de la comision, y el link afiliado se rotula.
- **F3.3 Alertas por usuario**, solo si se dispara su gatillo (Fase 4).

**Sale de la fase cuando:** hay 1.000 clics salientes por mes y el primer
ingreso cobrado.

## Fase 4: escala tecnica, solo con gatillo

| Gatillo | Respuesta |
| --- | --- |
| Indice mayor a 1,5 MB gzip o 40.000 productos | Partir el indice por rubro y bajar solo el que se busca |
| 2 o mas tiendas bloquean el runner | Relevar desde otra IP, bajar el ritmo y pedir feeds a las tiendas |
| 300 usuarios por semana o pedidos repetidos de alertas | Cloudflare Workers + D1 + email para alertas por usuario |
| Busquedas lentas en telefonos de gama baja | Busqueda del lado del servidor (Worker con SQLite FTS) |

## Lo que no hay que hacer

- Migrar a React, Next o un backend "para escalar". Hoy no escala nada porque
  no hay nadie: el cuello no es la tecnologia.
- Sumar funciones de UI antes de que la analitica diga que se usa.
- Hacer app nativa. La PWA alcanza.
- Agrupar productos por nombre parecido. Ya se probo.

## Riesgos

- **Bloqueo o reclamo de una tienda**: ritmo respetuoso, respetar `robots.txt`,
  un User-Agent con contacto, y pasar a feeds acordados cuando haya trafico
  para ofrecerles a cambio.
- **Fotos de terceros**: al monetizar, revisar el uso de imagenes de tiendas y
  fabricantes, o cambiarlas por las del enlace de afiliado.
- **Un solo desarrollador**: por eso las fases tienen criterio de salida y la
  UI queda congelada hasta tener numeros.

## Como ejecutarlo con Claude Code

Quedo instalado Superpowers (`superpowers@claude-plugins-official`). Se activa
al abrir una sesion nueva. El ciclo por fase:

1. Pedir "arranquemos la Fase 0 de `docs/plan-de-escalado.md`".
2. `brainstorming` hace las preguntas y guarda el diseño.
3. `writing-plans` lo parte en tareas de 2 a 5 minutos.
4. `subagent-driven-development` las ejecuta con TDD y revision entre tareas.
5. `finishing-a-development-branch` ofrece merge, PR o descartar.

Tambien estan las agent-skills de Addy Osmani. Se pisan con Superpowers en la
planificacion: usar Superpowers para el ciclo de desarrollo, y de las otras
solo las auditorias puntuales (`/webperf`, `/review`, `security-and-hardening`,
`/ship`) antes de publicar.
