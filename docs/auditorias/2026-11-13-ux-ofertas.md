# Auditoria UX de la pestana Ofertas (y portada) · 13/11/2026

Skill usada: `ux-audit`. Recorrido real en el navegador, con el sitio armado en local (`tests/e2e/armar-sitio.sh`, indice de prueba de `tests/fixtures/e2e`) en celular de 375 px, y medidas del sitio publicado donde hizo falta.

## Veredicto: Fail

Hay un hallazgo Critical (error de consola) y varios High (zonas de toque chicas). Lo que no se pudo medir queda dicho abajo: no alcanza para un Pass.

## Persona (fijada para toda la auditoria)

**Una persona que busca un precio en el celular.** Usa el telefono con datos moviles, con poco tiempo, sin ganas de leer ayuda. Quiere saber cuanto sale un producto y donde conviene comprarlo. Tiene tecnologia media: entiende "precio" y "descuento", pero no "rebaja publicada" ni "contra el modelo". Si no encuentra el precio en unos segundos, se va.

Lente de primera vez (obligatoria): alguien que nunca vio la app, sin documentacion.

## Recorrido (interacciones hechas)

| # | Accion | Resultado observado |
|---|---|---|
| 1 | Abrir `#ofertas` a 375 px | 7 tarjetas, sin scroll horizontal (`scrollWidth` = 375) |
| 2 | Leer consola | 404 de `imagenes.json` (local), error de CSP por Google Fonts, errores de carga de scripts externos |
| 3 | Tocar «Filtrar y ordenar» | Abre el panel. Cerrado por defecto: la persona no sabe que hay filtros |
| 4 | Tocar «Menor precio» | El orden cambia: precios de menor a mayor (`$3.823.085`, `$4.565.111`...) |
| 5 | Tocar «Bajaron de precio» | Queda pulsado (`aria-pressed=true`). El conteo no cambia porque las 7 del fixture ya son bajas propias |
| 6 | Tocar la estrella de la primera oferta | Cambia a ★ y se guarda en `localStorage` (`estrellas`) |
| 7 | Tocar «Historial de precio» | Abre el historial de esa tarjeta |
| 8 | axe-core (wcag2a, wcag2aa, best-practice) en la pestana | 0 violaciones, 40 reglas pasan |

Nota de metodo: en el primer intento toque chips que estaban dentro de un panel cerrado. Lo corregi abriendo el panel primero. No es un bug de la app.

## Compuertas duras

| Compuerta | Resultado | Estado |
|---|---|---|
| Errores de consola | >0 (CSP de Google Fonts; 404 de `imagenes.json` solo en local) | **Critical** |
| Advertencias de consola | goatcounter «not counting because of: localhost» (solo en local) | High si cuenta; es ruido de localhost |
| 5xx de red | 0 | OK |
| 403/404 en paginas con sesion | No aplica (sitio publico) | OK |
| Colapso de layout | 0 (sin desborde horizontal a 375 px) | OK |
| axe Critical / Serious | 0 / 0 | OK |
| LCP / CLS / INP | LCP no medido (el navegador no lo reporto); CLS 0; INP no medido | **Incompleto** |

## Medidas (font-size calculado, precio contra porcentaje)

Despues de los commits de esta rama (`3da2e89`):

| Variante | 320 px (precio / %) | 375 px (precio / %) | 428 px (precio / %) |
|---|---|---|---|
| normal | 22,4 / 20,8 | 24 / 20,8 | 27,4 / 20,8 |
| fuerte | 32 / 27,2 | 32 / 27,2 | 36,4 / 27,2 |
| heroe | 36,8 / 32 | 39,4 / 32 | 44,8 / 32 |

Antes, a 375 px: fuerte 22,5 contra 27,2 y heroe 24,75 contra 32 (fallaban).

Tamanos de toque (medidos en 375 px):

| Elemento | Cantidad | Minimo medido | Objetivo del proyecto (A3) |
|---|---|---|---|
| Estrella `.o-star` | 7 | 33 × 33 px | 48 px |
| Chips `.of-chip` | 6 | 78 px ancho, 44 px alto | 48 px |
| Segmentos `.seg` | 6 | 88 px ancho, 44 px alto | 48 px |
| Boton «Abrir» / «Comparar» | 14 | 129 px ancho, 61 px alto | OK |
| Pestanas | 4 | 88 × 48 px | OK |

Textos menores a 12 px dentro de las tarjetas: 66 nodos.

## Lo que se arreglo en esta rama (puntos 1 y 2)

- **Precio contra porcentaje (A10)**: fuerte y heroe suben el precio. El porcentaje no cambia. Commit `3da2e89`.
- **Tarjetas sin foto**: la causa es que la Store API de maxtecno devuelve `images: []` (`tests/fixtures/maxtecno/store-api.json`). Las 11 tarjetas sin foto son todas de maxtecno. No se inventan fotos. El render reservaba un bloque de 219 px con un icono; ahora la foto es un `<img>` con `src` y, sin foto, no hay bloque. Commit `f9efc63`.

## Hallazgos y plan (orden de prioridad)

Cada item tiene archivo, criterio medible y prueba. Solo los puntos 1 y 2 se corrigieron hoy; el resto queda aca.

### Critical

**C1 · Error de consola por CSP de Google Fonts.** Superficie: `#ofertas` y portada, 375 px.
- Observado: `Connecting to 'https://fonts.googleapis.com/css2?...' violates ... connect-src`.
- Esperado: 0 errores de consola al cargar.
- Archivo: `index.html:45-48`. Origen exacto **no confirmado**: quitar la linea 45 (`preconnect`) no hizo desaparecer el mensaje, pero el buffer de consola podria conservar errores viejos. Hay que verificarlo con DevTools (Network, Initiator) en una carga limpia.
- Criterio: `read_console_messages` con `onlyErrors` vacio tras recarga limpia.
- Prueba: captura de consola antes y despues.

### High

**A1 · Estrella de marcar con 33 px.** Superficie: cada tarjeta de Ofertas.
- Archivo: `css/sitio.css`, regla `.ocard .o-star` (width/height 34 px).
- Criterio: `min(width, height) >= 48` en las 7 tarjetas a 375 px.
- Prueba: `getBoundingClientRect()` de `.o-star` en la pestana.

**A2 · Chips y segmentos de 44 px de alto.** Superficie: panel «Filtrar y ordenar».
- Archivo: `css/sitio.css`, `.seg` y `.of-chip`.
- Criterio: alto >= 48 px a 375 px, sin romper el ancho de la fila.
- Prueba: mismo script de medicion, mas captura del panel.

### Medium

**M1 · Panel de filtros cerrado por defecto (lente de primera vez).** La persona no sabe que existen los filtros.
- Archivo: `js/ofertas.js`, `<details class="of-plegable">` (sin `open`).
- Criterio: al abrir Ofertas, los filtros se ven o hay un texto que dice «Filtrá y ordená».
- Prueba: recorrido nuevo sin tocar nada; el primer toque tiene que llegar a un control.

**M2 · Textos menores a 12 px en las tarjetas.** 66 nodos, por ejemplo `.tit-chip` (.74rem, unos 11,8 px).
- Archivo: `css/sitio.css`, reglas de `.tit-chip` y de `.o-ahorro`.
- Criterio: ningun texto de tarjeta menor a 12 px.
- Prueba: script que recorre los nodos con texto dentro de `.ocard`.

**M3 · El armado local no genera `imagenes.json`.** La pestana local muestra 0 fotos y da 404. En produccion no pasa (el archivo existe, con 343 entradas).
- Archivo: `tests/e2e/armar-sitio.sh` (falta el paso `node adelgazar_indice.js`).
- Criterio: `_sitio/imagenes.json` existe y la carga no tiene 404.
- Prueba: `armar-sitio.sh` y recorrido de consola.

### Pendientes de medir

- **LCP, INP**: no se pudieron medir en el navegador de la herramienta (LCP vino en 0). Hay que medirlos con Lighthouse en la CI o con DevTools en el sitio publicado.
- **Advertencias de goatcounter**: son del entorno local (`localhost`). Candidatas a la lista de excepciones de la auditoria si aparecen en produccion.

## Top 5 (impacto x facilidad)

1. **C1**: el error de CSP rompe la regla de consola limpia y hay que mirarlo primero (es Critical por la compuerta).
2. **A1**: la estrella de 33 px es la accion que mas usa la persona para guardar y es la mas dificil de tocar.
3. **A2**: los filtros son chicos y estan escondidos (ver M1): juntos, la persona no los encuentra ni los toca.
4. **M1**: panel de filtros cerrado; la persona no sabe que existe el filtro de «Bajaron de precio».
5. **M2**: textos de 11 px en las tarjetas: dificiles de leer en la calle.

## Plan de correccion

- **Rapido (24-48 h)**: A1, A2, M2 (son cambios de CSS, con criterio medible).
- **Estructural (1-2 semanas)**: C1 (depende de confirmar el origen), M1 (decidir si el panel empieza abierto o con un texto guia), M3 (armado local).
- **Pulido (despues)**: revisar el orden de las tarjetas con el lente de primera vez y medir LCP/INP en la CI.

## Lo que se siente al tenerlo en la mano

Es una pestana que responde bien: el precio se lee de un vistazo, el orden y la estrella funcionan y no hay desborde. Lo que la frena es lo chico: los botones que no se tocan bien con el pulgar y los filtros que hay que descubrir. Con eso resuelto, se sentiria como una herramienta hecha para el celular y no como una pantalla de escritorio achicada.
