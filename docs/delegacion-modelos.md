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

---

# Relevamiento de buscadores (20/10/2026)

Una tanda para `docs/buscadores-referencia.md`. Los hechos sobre sitios ajenos los leyo y contrasto Claude contra la fuente (WebFetch y `robots.txt`) antes de pasarlos a los modelos en `privado/hechos.md`; los modelos redactaron y revisaron.

| Tarea | Modelo que la hizo | Tiempo | Resultado | Hallazgos reales / falsos |
| --- | --- | ---: | --- | --- |
| Borrador de tabla comparativa a partir de los hechos | OmniRoute `rapido` → qwen3.8-27b | segundos | **Descartado**: puso «sin confirmar» en celdas que los hechos si cubrian (PriceSpy filtros/ordenes, Geizhals orden), perdio la columna del nombre del sitio y desordeno las columnas | 0 reales / tabla rehecha a mano |
| Borrador de 10 ideas con datos propios | OpenCode `claude-sonnet-5-5` | — | **Fallo**: `402 Insufficient account funds` (el proveedor `opencode` sin credito) | — |
| Mismo borrador por OmniRoute `claude/claude-sonnet-5-5` | OmniRoute | — | **Fallo**: `429`, todas las cuentas de Claude sin cuota (reinicio en 5 min) | — |
| Borrador de 10 ideas (segundo intento) | OmniRoute `revision` → gpt-oss-120b | ~1 min | 10 ideas con formato correcto, pero **4 con datos falsos**: tomo `s` por «stock» (es cuotas sin interes), invento un envio `free/paid` en la columna `via` (es el agregador), propuso «Trending» por «menciones en el historial» (no existe esa señal) y un backend de mails para un sitio estatico; propuso usar los sellos `m/h/x` como novedad | 3 ideas aprovechables (mayor baja por ventana, alertas, grafico) / 4 con hechos falsos |
| 6 ideas sobre orden y filtros, leyendo `js/buscador.js`, `js/ofertas.js`, `serie.py` | OpenCode `glm-5.3-flash-free` | ~4,5 min (cerro) | **Util**: cito lineas del repo y marco «sin confirmar» lo que no estaba; escribio el archivo dos veces (33 KB) | **3 reales** que se sumaron (desempate por tiendas, «otra tienda lo tiene mas barato», filtro por sellos) y el dato de que el sello `x` sale desde el 21/10 (14 dias); 0 falsos verificados |
| Revision del documento final contra los hechos | OmniRoute `revision` → Gemini 2.5 Flash | ~30 s | 8 hallazgos | **1 real** (la agrupacion de Mercado Libre «publicaciones por vendedor» no estaba en los hechos: corregido a «sin confirmar») / **7 falsos** (listo como error celdas que decian «sin confirmar», que es lo correcto) |

**Lo que se aprendio**: con el credito de OpenCode y la cuota de Claude agotados, el unico camino que anduvo fue el modelo gratis de OpenCode (mas lento, pero mejor anclado al repo que el combo de OmniRoute) y los combos baratos de OmniRoute, que formatean bien y se equivocan en los datos propios del repo. Un modelo que no lee el repo inventa el significado de las columnas del indice; el que lo lee, no.

# Revision de los modos de busqueda (PR #84, spec 013, 20/10/2026)

Mismas reglas: lo que devuelve un modelo es dato y se prueba con el codigo real antes de aceptarlo.

| Tarea | Modelo que la hizo | Tiempo | Resultado | Hallazgos reales / falsos |
| --- | --- | ---: | --- | --- |
| Revision de spec 013 y del diff de `js/` (20 mil caracteres; con el diff completo, 54 mil, OmniRoute contesto 413) | OmniRoute `revision` → Gemini 2.5 Flash | ~40 s | 3 hallazgos | 0 / **3 falsos** (`g.paso` igual a 0: en `GENERACIONES` es 1 o 2; el sello «mas barato» sin `ORDEN === "precio"`: es lo que pide la spec; ofertas recalculadas por cada pagina estatica: esas paginas solo usan Recomendacion, que no pide ofertas) |
| Revision del mismo cambio | OpenCode (el MCP ignoro `glm-5.3-flash-free` y uso `big-pickle`) | ~6,5 min | 6 hallazgos, de los cuales el propio modelo descarto 3 | 0 / **6 falsos** (un «modo con 1 a 59 filas no muestra el aviso»: `pintarResultados` entra por `!r.length && F.filas.length` y el test lo cubre con 3 filas; «ofertas calculadas dos veces»: `deOfertas` las guarda en el cierre; `anio = 0`: contradice a la spec solo en la forma; sello «mas barato» del modo: ambiguo y informativo) |

**Total**: 0 reales y 9 falsos. Se aprendio que, para un diff de mas de ~30 mil caracteres, OmniRoute rechaza el pedido (413): hay que mandar solo los archivos de `js/` y la spec sin la medicion.

# Dataset de ganadores con pruebas reales (20/10/2026)

| Tarea | Modelo que la hizo | Tiempo | Resultado | Hallazgos reales / falsos |
| --- | --- | ---: | --- | --- |
| Leer rankings de PassMark (CPU, GPU, SSD) | **Claude** con WebFetch (los modelos externos no navegan) | — | 13 filas confirmadas, cada valor leido en la pagina | Un id de CPU adivinado devolvio otro procesador (KaiXian KX-7000): no se uso |
| Notebookcheck, RTINGS, TechPowerUp, GSMArena | Claude | — | Sin datos: 403, mediciones con JavaScript, `robots.txt` que prohibe | — |
| Revision de `generar_ganadores.py` | OmniRoute `revision` → gpt-oss-120b (la cabecera lo dijo) | ~20 s | 5 hallazgos | 0 reales / **5 falsos** (el indice usa listas y los campos existen; `valor` puede ser texto a proposito; la escala ya exige texto; el calce exacto del modelo es la decision de diseño) |

Las tareas de extraer tablas y de revisar con otra familia quedan para la proxima tanda: sin una pagina legible no hay nada que extraer.

## Segunda tanda de ganadores (20/10/2026)

| Tarea | Modelo que la hizo | Resultado | Hallazgos reales / falsos |
| --- | --- | --- | --- |
| Leer RTINGS (monitores, auriculares, notebooks), DXOMARK (pantalla y bateria) y probar Notebookcheck | **Claude** con el navegador de la app (los modelos externos no navegan) | 22 filas confirmadas; las notas de RTINGS estan bloqueadas sin membresia; una regex mia se colgo 45 s | — |
| Contrastar las 22 filas con los hechos leidos | OmniRoute `revision` → gpt-oss-120b (cabecera) | 1 discrepancia | 0 reales / **1 falsa** («WOLED» contra «WOLED (Tandem)»: la pagina dice «Tandem WOLED») |

---

# Spec 014: Primera Linea premium, Super Oferta real y orden «mejor oferta» (20/10/2026)

Revision cruzada de cada PR con dos modelos distintos (uno de OmniRoute y otro de OpenCode). Hoy Gemini 2.5 Flash daba 503 («high demand») y la conexion de Claude de OmniRoute estaba sin cuota; `privado/revisar.sh` reintenta.

| Tarea | Modelo que la hizo | Tiempo | Resultado | Hallazgos reales / falsos |
| --- | --- | ---: | --- | --- |
| PR #86 (`js/premium.js`, modos): revision | OmniRoute `revision` → Gemini 2.5 Flash (tras 3 reintentos) | ~2 min | 4 hallazgos | 0 reales / **4 falsos** (el chip A16 no es «de punta» por decision; `ref.gen[fam] \|\| gen` es la convencion de `categorias.js` y la referencia sale del mismo indice; `gama` nula solo pasa en tests; `PS5` no coincide por el minimo de 4 caracteres, a proposito) |
| PR #86: segundo modelo | OpenCode `glm-5.3-flash-free` | ~12 min | **Sin respuesta final**: salio del diff y empezo a correr comandos en el worktree (hubo que matar el proceso: 186 MB con la maquina sin memoria) | 0 / 0 |
| PR #87 (`contraModelo`, `cruceGen`): revision | OmniRoute `revision` → gpt-oss-120b | 40 s | **Respuesta truncada** («reasoning truncated at token limit», 370 caracteres sin contenido) | 0 / 0 |
| PR #87: segundo modelo | OpenCode `minimax-m3.1-flash-free` | ~8 min | **Vacio**: termino sin texto | 0 / 0 |
| Mediciones, tablas y revision a mano de 14 «contra el mismo modelo» | **Claude** (scripts `specs/014-ofertas-y-premium/medir.js`) | — | En la spec | — |

**Lo aprendido**: en una tanda con la CI en verde y 440 tests, la revision cruzada con modelos gratis no aporto ningun hallazgo real (0 de 4 con respuesta, 3 corridas sin contenido); lo que si encontro bugs fue medir contra el indice publicado (falsos premium por la memoria, coolers a 59% bajo el resto). Con `opencode run` hay que pasar el mensaje ANTES de `-f` (si no, trata el mensaje como un archivo) y pedirle que no ejecute comandos.

# Revisión de pestañas por lo reciente (spec 021, 23/10/2026)

Pedido del dueño: «delegá a los modelos de OmniRoute». Por el endpoint (`revision`), desde localhost y sin clave. Lo devuelto se contrastó con el código y con el sitio publicado.

| Tarea | Modelo que la hizo (cabecera) | Tiempo | Resultado | Hallazgos reales / falsos |
| --- | --- | ---: | --- | --- |
| 6 mejoras para la pestaña Ofertas (texto en vivo + `js/ofertas.js`) | Gemini 2.5 Flash | 63 s | Ninguna aplicada | 0 / **6 falsos o ya hechos**: las bajas propias ya van primero; cada tarjeta ya dice el motivo («bajó de precio», «rebaja publicada», «gama alta al precio de media»); «Marcadas» son las estrellas de la persona; «vía ComparaYa» ya se ve; esconder los 6122 descartados va contra la transparencia |
| 5 mejoras para el Veredicto (`vistaVeredictoDin`) | gpt-oss-120b | 5 s | 1 aplicada | **1 real** (un botón a «Dónde conviene comprar», útil ahora que Tiendas está dentro de la Comparativa) / 4 de poco valor (repetir en baldosas lo que el texto ya dice; mostrar el tachado del comercio como dato, que es referencia y no verdad) |
| Revisión del diff de `js/` (26 mil caracteres) | Gemini 2.5 Flash | 65 s | «Sin hallazgos» | 0 / 0. Un borde lo encontró Claude al probar: borrar el historial desde Buscar rearmaba la vista y perdía los resultados |

---

# Spec 020: buscar afuera y pegar un link (23/10/2026)

Funciones puras pedidas primero a OmniRoute por el endpoint (`"model": "revision"`, `User-Agent: curl/8`); lo devuelto se corrio contra los tests antes de usarlo. El primer pedido fallo: gpt-oss-120b se corto por el limite de tokens («reasoning truncated», 502), la conexion de Claude esta vencida y Gemini figuraba agotado; con `max_tokens: 16000` contesto.

| Tarea | Modelo (cabecera `x-omniroute-model`) | Tiempo | Tests que paso | Que se cambio a mano |
| --- | --- | ---: | --- | --- |
| `parsearEnlace(url)` y `urlBusqueda(fuente, termino)` (`js/importar.js`) | `openai/gpt-oss-120b` | 8,8 s | **11 de 11** (los 10 de la spec 020 sobre esas dos funciones y el de `enlaceFuente`) | Estilo del archivo (compacto, comentarios en español); la busqueda pasa a ser un dato de cada fuente (`busqueda`) en lugar de un `switch`; el slug de Amazon en un solo segmento (`[^/]+`); Loquieroaca acepta la barra final; despues se sumo `a.co` |
| Revision del diff final (`js/importar.js` completo y el diff de `js/vista-costo.js` y `js/busqueda.js`) | `openai/gpt-oss-120b` | 23,9 s | 3 hallazgos | **0 reales / 3 falsos**, ejecutados: `www.amzn.to` no es una forma real de link; `estadoImportar("12,34")` no pasa (el precio llega siempre como numero de `js/puesto.js` y la funcion no esta en el diff); el «`&&`» en la busqueda de una tienda oficial no aparece (`&term=audio%20headphones`). Pero el primero hizo ver un hueco real: los links `a.co/d/...` del «Compartir» de la app de Amazon; se agrego con su test |

Lo que verifico Claude en la fuente (los modelos externos no navegan): las URLs de busqueda de Tiendamia y Loquieroaca (las dos devolvieron el AeroClip 2), la forma de sus links de producto, que Loquieroaca publica el precio final en pesos y que Soundcore/Anker y Keychron no dicen que envien a Argentina.

---

# Spec 022: Afuera en vivo (23/10/2026)

Mismo metodo que la spec 020: funciones puras pedidas primero a OmniRoute (`revision`, por el endpoint, `max_tokens: 16000`), corridas contra los tests antes de usarlas.

| Tarea | Modelo (cabecera `x-omniroute-model`) | Tiempo | Tests que paso | Que se cambio a mano |
| --- | --- | ---: | --- | --- |
| `aviso`, `parsearEbay`, `parsearAliexpress`, `parsearAmazon` y `firmar` (HMAC-SHA256 de AliExpress) del Worker | `openai/gpt-oss-120b` | 7,8 s | **5 de 5** (despues de sacar del arnes los `import` repetidos que traia el archivo unico) | Partido en un modulo por fuente, estilo compacto y comentarios con la fuente de cada dato |
| `js/afuera.js` (lo que pinta la seccion) | `openai/gpt-oss-120b` | 8,9 s | **10 de 10** | Al leerlo: el mensaje sin avisos nombraba tambien las fuentes caidas y un precio no numerico rompia el formato; los dos con su test |
| Revision del diff (Worker completo, `js/afuera.js`, workflow y diff de `js/busqueda.js`) | `openai/gpt-oss-120b` | 15 s | 5 hallazgos | **2 reales / 3 falsos**. Reales: una consulta que fallo no se reintentaba en la sesion (ahora espera un minuto) y Amazon se rotulaba afiliado aunque el link no tuviera `tag=` (test nuevo). Falsos: la cache del navegador de 1 h contra 8 h en el Worker es a proposito; el tope «global» sin `CF-Connecting-IP` no pasa en Cloudflare; `precioArs` vacio es esperado hasta que una fuente lo de |

Lo que verifico Claude en la fuente (los modelos externos no navegan): la doc de eBay (filtro `deliveryCountry`, `X-EBAY-C-ENDUSERCTX`, scope), la de AliExpress (`ship_to_country`, endpoint `/sync`, firma) y la de la Creators API (requisito de ventas, token, cabeceras). Loquieroaca: `robots.txt` y `/info`; la llamada de prueba a su Livewire la bloqueo la clasificacion de permisos y no se hizo (ver la spec 022).

---

# Spec 023: leer el link pegado y Tiendamia en vivo (23/10/2026)

| Tarea | Modelo (cabecera `x-omniroute-model`) | Tiempo | Tests que paso | Que se cambio a mano |
| --- | --- | ---: | --- | --- |
| `amazonDeRuta` (ASIN con idioma, `/gp/`, patrocinados) | `openai/gpt-oss-120b` | 6,0 s | **16 de 16** casos | Estilo compacto; integrada en `parsearEnlace` con los dominios de otros paises |
| Parsers de la ficha y la busqueda de Tiendamia y de la ficha de Loquieroaca (con fragmentos reales del HTML en el pedido) | `openai/gpt-oss-120b` | 7,2 s | **24 de 24** contra los fixtures reales completos | Al leerlos: «en un pago» se tomaba de cualquier «o $» de la pagina (ahora tiene que decir «en un pago»), `fromCharCode` no servia fuera del plano basico y `pesosDe` se rompia sin texto; los tres con su test |
| `urlLeerEnlace`, `leidoDeEnlace`, `relevantes` y el ruteo de `/enlace` | **Claude** | — | — | Chicas y atadas al resto; `relevantes` salio de probar en el navegador con el Worker local (fundas arriba por precio) |
| Revision del diff, en dos mitades (Groq corta a 8.000 tokens por minuto: el pedido entero dio 413) | `gemini-2.5-flash` y `openai/gpt-oss-120b` | 19 s y 8 s | 4 + 2 hallazgos | **0 reales / 6 falsos**, ejecutados: `expires_in` negativo (ninguna API lo da); `precioArs` 0 es nulo a proposito; «funda iphone» si pasa (`relevantes` devuelve 1); `sspa/click` con un ASIN valido si se reconoce (`URLSearchParams` saca el «?») y su ejemplo no era un ASIN; el precio de la busqueda es numero. Del SSRF hipotetico quedo una defensa propia: `paginaPermitida` |

Lo que verifico Claude en la fuente: `robots.txt` y terminos de Tiendamia, los precios de su ficha y su busqueda (en el navegador, con la moneda en U$S) y los cuatro precios de la ficha de Loquieroaca (cual es tachado, cuotas y un pago).
