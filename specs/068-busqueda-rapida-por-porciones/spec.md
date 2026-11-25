# Spec 068: la búsqueda abre rápido (porciones por búsqueda popular)

**Estado**: en curso (25/11/2026). **Origen**: criterio 3 de Google Play (`docs/plan-definitivo.md`, sección 8) y
`privado/pedido-velocidad-busqueda.md`. Complementa la spec 064 (buscar en el Worker con KV, que es decisión del dueño
porque toca la cuenta de Cloudflare): esta no cuesta plata ni cuentas.

## Problema medido (25/11)

Lighthouse móvil 12.8.2 sobre `/?q=ssd%201tb`: rendimiento **36-44** en producción y **43** en el sitio local armado
como la CI (LCP 11-33 s, TBT 1,1 s). La portada `/` da 97-99 en la CI. Lo que dice la traza:

| Qué | Evidencia | Peso |
|---|---|---|
| El índice entero (25.393 filas, 5,4 MB; 1,1 MB comprimido) se pide al empezar a leer la página, con prioridad alta | `index.html` (N-CAL1); Lighthouse lo pone en la cadena del LCP: `Render Delay` 10,5 s en producción, 32 s sin comprimir | el LCP entero |
| Al llegar, parseo + filtro de las 25.393 filas + análisis en el hilo principal | traza con CPU 4x: `RunMicrotasks` de 995 ms; Lighthouse: tarea larga de 921 ms en `arranque.js` | casi todo el TBT |
| La portada pre-renderizada se diseña y se pinta aunque con `?q=` se tira enseguida | traza: `Layout` de 1.368 ms + 427 + 313 ms (1.225 nodos, una vez por fuente que llega) | CPU antes del LCP |

`ssd 1tb` encuentra **361 filas**: 94 KB sin comprimir, **20 KB** comprimido. Hoy se bajan 1,1 MB para usar el 1,4 %.

## Objetivo medible

- Lighthouse móvil, mediana de 3 corridas en la CI: **rendimiento >= 95 y 100 en accesibilidad, buenas prácticas y SEO**
  en `/` y en `/?q=ssd%201tb`. Lo mide el job `lighthouse` (PR #339) y corta si no se cumple.
- Bytes de la primera visita a `/?q=ssd%201tb` antes del primer resultado: de ~1,1 MB a < 100 KB comprimidos de datos.

## Qué se hace

1. **Porciones**: el build (`generar_paginas.js`, el mismo que ya arma `/precios/<slug>/` para ~200 búsquedas populares)
   escribe `/precios/<slug>/filas.json` con las filas del índice que coinciden con esa búsqueda, más `tiendas`,
   `campos`, `generado` e `historial` del índice. Misma forma que `indice.json`.
2. Con `?q=` en la URL, `index.html` pide la porción de esa búsqueda (no el índice entero). Si existe y su `q` normaliza
   igual que la pedida (`Buscador.normalBusq`), la comparativa se arma con ella. Si no existe (404) o no coincide, se baja
   el índice entero como hoy.
3. El índice entero se baja recién cuando hace falta: abrir Buscar u Ofertas, cambiar de búsqueda, volver a la portada.
   Mientras tanto `IDX.parcial` es `true` y nada que necesite el catálogo entero lo usa (ofertas, número de la pestaña
   Buscar, la tira de tus búsquedas, «lo reciente», los resultados de Buscar).
4. Con `?q=`, la portada pre-renderizada no se diseña: se oculta desde el `<head>` (sin JS que esperar).

## Invariantes (tests)

- **La porción da exactamente el mismo análisis que el índice entero**, para cada búsqueda pre-armada (la huella de
  `generar_paginas.js` es igual por los dos caminos).
- `Pagina.slug` (JS) da lo mismo que `slug` de `generar_paginas.py` (mismos casos en los dos tests).
- Con porción: no se pide `indice.json` al abrir `/?q=`; la comparativa sale; abrir Buscar u Ofertas pide el índice
  entero y lo usa.
- Sin porción (404 o `q` distinta): se baja el índice entero y la página se ve como hoy.
- Con `IDX.parcial`: `ofertasListas()` no calcula, el número de Buscar no muestra el tamaño de la porción y la tira del
  historial no calcula precios de otras búsquedas con ella.

## Casos borde

- `?q=SSD 1TB` y `?q=ssd-1tb`: el slug coincide; se usa la porción solo si `normalBusq` da igual.
- Búsqueda no pre-armada: un 404 chico y el camino de siempre.
- Sin red al pedir la porción: el camino de siempre (que también fallará y lo dice).
- Índice entero que llega mientras se mira la comparativa armada con la porción: no se vuelve a pintar (el análisis es el
  mismo); se recalcula `ANALISIS` en silencio para que sus filas sean las del índice nuevo.

## Fuera de alcance

- Búsquedas no pre-armadas: siguen bajando el índice entero (spec 064 opción 1 lo resolvería).
- Achicar `indice.json` (la spec 064 midió que sacar campos baja menos del 10 %).
