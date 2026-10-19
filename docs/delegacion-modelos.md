# Delegacion de pendientes a modelos externos (19/10/2026)

Una tanda de cuatro tareas donde cada una tuvo un **modelo asignado**. Reglas: lo que devuelve un modelo es **dato**, se prueba con el codigo real antes de aceptarlo (ejecutando la funcion o corriendo el test), y los hallazgos reales se arreglan con el test primero. Quien implementa y decide es Claude; los modelos externos revisan, clasifican y redactan.

## Tabla

| Tarea | Modelo que la hizo | Tiempo | Resultado | Hallazgos reales / falsos |
| --- | --- | ---: | --- | --- |
| 1. Revision PR #65 (`revisar_woo`, `revisar_agregador`, `precio_visible`) | OpenCode `glm-5.3-flash-free` | 6,5 min | **Sin respuesta final** (116 mil caracteres de razonamiento, no cerro) | 0 / 0 |
| 1. Revision PR #65 (segundo modelo) | OmniRoute `revision` → contesto Gemini 2.5 Flash | 38 s | 4 hallazgos | 0 reales / **4 falsos** (`TOLERANCIA_PRECIO` «no definida»: esta definida en la linea 76; el diagnostico con `titulo()`; el slug `/producto/` es el de las tiendas Woo configuradas; una critica a `cpuDe`, fuera del PR) |
| 1. Revision PR #66 (`guardia.js`) | OmniRoute `revision` → Gemini 2.5 Flash | 33 s | 4 hallazgos | 0 / **4 falsos** (historial no-fecha: el indexador siempre escribe una cadena; «falsa alarma» por datos previos erroneos; umbral de 20 avisos: es una decision, no un bug; `calcularOfertas` y `bajasPropias`: especulacion) |
| 1. Revision PR #66 (segundo modelo) | OpenCode `glm-5.3-flash-free` | 6,3 min | **Sin respuesta final**, pero su razonamiento traia un candidato: el borde de punto flotante del salto de «sin datos» | **1 real** (PR #79: `8/20 - 6/20` da `0,10000000000000003`, asi que +10 puntos exactos disparaba la alarma) / 0 falsos |
| 1. Revision PR #67 (tachado fijo, `js/ofertas.js`) | OmniRoute `revision` → Gemini 2.5 Flash | 29 s | 3 hallazgos | 0 / **3 falsos** (un «off-by-one» que se contradice con el propio test; `generado` o `desde` invalidos desactivan la regla: es a proposito, falla hacia publicar) |
| 1. Revision PR #67 (segundo modelo) | OpenCode `minimax-m3.1-flash-free` (CLI) | ~5 min | 5 hallazgos | **1 real** (PR #80: `tachadoFijo` contaba filas con tachado de 2% o de 90% que nunca fueron oferta; `publicadas` no cambiaba) / **4 falsos** (`desde` sin parsear; mezcla UTC/hora: `desde` es solo fecha; falta el gemelo en Python: el Python lee `ofertas.json` del JS; la clave `lista` del helper: existe) |
| 1. Revision PR #68 (`modelo.py`) | OpenCode `minimax-m3.1-flash-free` | ~12 min | **Sin respuesta**: se trabo pidiendo permiso para leer `modelo.py` del repo (se cancelo) | 0 / 0 |
| 1. Revision PR #68 (segundo modelo) | OmniRoute `revision` → Gemini 2.5 Flash | 30 s | 5 hallazgos | 0 / **5 falsos** (`cpu_de` y `configuracion` «con excepcion»: se ejecutaron con esas entradas y devuelven `''` y `(0, 0, '')`; `CG1_...`: prefijo inventado; «pendrive 32 GB»: es decision de diseno; el ultimo se corto y se contradecia) |
| 2. Reintento del job `lighthouse` (PR #75) | **Claude** implemento; revisor OmniRoute `revision` → Gemini 2.5 Flash (39 s) | 39 s la revision | Mergeado; la CI real paso con el script puesto (3 min 38 s) | 0 / **1 falso** («reintentar tambien con codigo de salida 0»: contradice «falla») |
| 3. Analisis pasivo de ZAP y triaje | ZAP 2.17.0 (analisis); OmniRoute `rapido` → qwen3.8-27b y gpt-oss-20b (triaje); `revision` → Gemini 2.5 Flash (segunda opinion) | ZAP ~3 min; modelos 2-20 s | PR #78 (docs/seguridad-zap.md): 15 alertas, ninguna arreglable en el repo | Acertaron 6 de 13 (qwen), 7 de 13 (gpt-oss-20b) y 7 de 15 (Gemini); errores graves descartados: `frame-ancestors` en una meta (se ignora) y un XSS reflejado inexistente |
| 4. Seccion 1.1.2 de `proceso-de-trabajo.md` | OmniRoute `rapido` → qwen3.8-27b (borrador) | 2 s | PR #77: aplicado y ajustado a mano | 0 / 0 (el borrador era correcto, pero con tono acartonado) |

**Total de la revision cruzada (tarea 1 + CI)**: 2 hallazgos reales y 21 falsos. Los reales vinieron los dos de OpenCode (uno de la respuesta, otro del razonamiento sin respuesta final); Gemini via OmniRoute no acerto ninguno en 17 hallazgos, aunque contesto siempre y en menos de 40 s.

## Que se aprendio

- **`revision` no uso gpt-oss-120b en ninguna de las cinco llamadas**: la cabecera `x-omniroute-model` dijo siempre `gemini-2.5-flash` (el prompt era de 7 a 33 mil caracteres; Claude sigue vencido). Para revisiones con un diff largo, el combo hoy es Gemini.
- **Los modelos gratis de OpenCode tardan 5-6 minutos y pueden no cerrar**: 3 de 4 corridas no entregaron respuesta final; las dos que aportaron algo real lo hicieron a costa de mucho tiempo. Sirven en paralelo, no en el camino critico.
- **OpenCode pide permiso para leer fuera de su directorio**: con la CLI se rechaza solo (y el modelo vaga); con el MCP queda `input_required`. Dejar el diff como archivo dentro de `directory` evita el pedido; si igual lo pide, la respuesta es `once` (el auto-modo bloqueo `always`, y se respeto).
- **Un prompt grande por la CLI de Windows falla** con `Argument list too long` (30 mil caracteres): usar `-f` o el MCP con un archivo en `directory`.
- **`opencode_fire`/`opencode_wait` devuelven el razonamiento completo** (hasta 220 mil caracteres): se guarda en un archivo y se lee con `python` en vez de abrirlo en el contexto.
- **OmniRoute rechaza (403) las llamadas de `urllib` de Python** con el user-agent por defecto aunque `curl` pasa: mandar `User-Agent: curl/8`.
- **El triaje de seguridad con modelos chicos no es fiable**: se equivocaron en la mitad de las alertas, siempre del lado de «arreglable». Lo que decide es medir el sitio.
