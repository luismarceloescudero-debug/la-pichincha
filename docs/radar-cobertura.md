# Radar de cobertura (Tavily + Firecrawl)

Un informe semanal para saber **que nos falta**, no para publicar precios. Script `radar.py`, workflow
`.github/workflows/radar.yml` (lunes 11:00 UTC y a mano), tests `tests/test_radar.py` con fixtures en
`tests/fixtures/radar/` (sin red).

## Que hace

1. Toma hasta 40 terminos de `consultas.json` (mas unos pocos de celulares y PC armadas que el indice vende),
   rotando por semana del año, y los busca en **Tavily** (busqueda basica, Argentina, 10 resultados).
2. Clasifica cada resultado en `ficha`, `listado` (categoria, marca, etiqueta, buscador interno, guia) o `no-tienda`
   (redes, video, medios, foros, comparadores).
3. Lo compara con el `indice.json` publicado:
   - **huecos**: fichas de dominios que ya relevamos (por el indice o por `tiendas.json`) que no estan en el indice,
     agrupadas por dominio con su fuente (`comparaya` si hoy llega por el agregador);
   - **candidatas**: dominios que no relevamos y que aparecen con al menos una ficha. Un dominio que solo trae
     listados no cuenta.
4. Con `FIRECRAWL_API_KEY`, abre la primera ficha de cada candidata con **Firecrawl** (`/v2/scrape`, `proxy: "basic"`,
   `rawHtml`) para confirmar que trae JSON-LD `Product` (señal de que se puede relevar). Antes lee el `robots.txt`
   (`indexar.robots_permite`): si prohibe la ruta, no se pide. Un 403, 429 o un desafio anti robots queda como
   `bloqueada` y no se insiste. Nunca se usa `stealth` ni `enhanced`, ni sobre una tienda que ya relevamos.
5. Deja `radar/radar.json` y `radar/radar.md` como artefacto `radar-cobertura` (30 dias) y el informe en el resumen
   de la corrida. No commitea, no toca el indice y no publica nada.

## Creditos por corrida

| Servicio | Plan gratis (verificado el 17/11/2026) | Costo | Tope por corrida |
| --- | --- | --- | --- |
| Tavily | 1.000 creditos por mes | 1 credito por busqueda basica (se suma `usage.credits` de cada respuesta) | 60 (`--tope-creditos`); con 40 terminos gasta ~40 |
| Firecrawl | 1.000 creditos por mes ([firecrawl.dev/pricing](https://www.firecrawl.dev/pricing)), 10 scrapes por minuto | 1 credito por pagina (se suma `metadata.creditsUsed`) | 10 (`--tope-firecrawl`), uno cada 7 s |

Medido: la prueba del 17/11 gasto 14 creditos de Tavily con 15 busquedas (una sin resultados). Cuatro o cinco corridas
por mes dejan ~200 creditos de Tavily y ~50 de Firecrawl: holgado contra los dos topes. El informe dice cuantos
creditos uso cada corrida.

## Por que radar y no fuente de precios

- **El precio del texto no es confiable**: el texto de un resultado puede ser de un listado viejo (la prueba trajo uno
  de Cybermonday 2025) o de una cuota. El precio publicado sale solo de la tienda.
- **Los creditos son limitados**: 1.000 por mes en cada plan gratis no alcanzan para relevar 31.000 avisos por dia; un
  relevador directo (API, feed o catalogo de la tienda, ver `tiendas.json`) es gratis, exacto y sin tope.
- **Lo que vale es la señal**: en la prueba, de 147 resultados solo 8 estaban en el indice; la mayoria eran categorias
  o no tiendas, y entre lo util aparecieron FullH4rd con fichas que faltan y tiendas como logg, 710tech o
  sagitariodigital. Eso es lo que el radar resume.

Con un hueco o una candidata, el paso siguiente es el de siempre: `python indexar.py --probar <url de la ficha>` y, si
sirve, un bloque en `tiendas.json`.

## Claves

`TAVILY_API_KEY` y `FIRECRAWL_API_KEY` estan cargadas como secrets del repo (17/11/2026). Sin `TAVILY_API_KEY` el
radar falla a la vista; sin `FIRECRAWL_API_KEY` solo se saltea la confirmacion. Para cambiarlas:
`gh secret set TAVILY_API_KEY` o `gh secret set FIRECRAWL_API_KEY` (decision del dueño).

En local: `TAVILY_API_KEY=... python radar.py --indice indice.json --salida radar`.
