# Proceso de trabajo de La Pichincha

Escrito el 2026-10-15. Es **la unica fuente** de como se trabaja en este repo con Claude Code: cada pedido arranca por aca. Se mantiene hasta que se demuestre una alternativa mejor (seccion 9)
y todo cambio del proceso se hace en este archivo, en un PR propio. Las reglas del producto siguen en `.specify/memory/constitution.md` y `CONSTRAINTS.md`; aca esta el **como**.

## 1. Arranque fijo: OmniRoute primero

Cada sesion o pedido nuevo empieza con OmniRoute, antes de leer o tocar el repo.

1. **Salud y cuota**: `omniroute_get_health` y `omniroute_check_quota` (herramientas MCP `omniroute`). Se anota que proveedores estan activos y cuanta cuota queda de Claude (sesion de 5 h y semanal).
2. **Si no responde** (`fetch failed`): el servidor esta apagado; se arranca con `C:\Users\Usuario\tools\OmniRoute\iniciar.cmd` y se deja esa ventana abierta.
3. **Si responde `403 AUTH_001`**: el MCP tiene un token que no es de gestion. El token vive en `OMNIROUTE_API_KEY` de la configuracion del servidor MCP `omniroute` (`~/.claude.json`) y se cambia con la app cerrada. **Ningun token se escribe en el repo, en un PR ni en la memoria.**
4. **Cuota de Claude baja** (menos del 20% en la sesion de 5 h): se pasan al resto de los modelos las tareas que lo permiten (seccion 2) y se avisa.
5. Se confirma que sigue la version vigente de OmniRoute: `gh api repos/diegosouzapw/OmniRoute/releases/latest`.

### 1.1 Mapa de modelos (medido el 15/10/2026 con un pedido minimo a cada uno)

| Modelo (por OmniRoute) | Estado | Latencia | Para que se usa |
| --- | --- | ---: | --- |
| `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5` | anda | 2 s (25 s si piensa mucho) | El trabajo principal es el de esta sesion de Claude Code. Por OmniRoute: **el revisor externo de eleccion**: en K1 encontro un bug real que los otros no vieron (el rango mezclaba un minimo sin percepcion con un maximo con percepcion) |
| Groq `openai/gpt-oss-120b` | anda, con reparos | 1 a 8 s | Triaje y segunda opinion **corta**. En K1 devolvio vacio con un archivo largo (gasto sus 3.072 tokens en razonar) y, con un fragmento resumido, inventó «variables sin declarar». No es fiable como revisor de codigo largo |
| Groq `qwen/qwen3.8-27b` | anda | 0,4 a 5 s | Triaje barato: clasificar titulares, ordenar listas, resumir salidas largas. **No para normativa ni revision**: en K1 cito resoluciones que no existen («Res. 3953-DGA») y se contradijo a si mismo |
| Gemini `gemini-2.5-flash` (y el alias `auto` de OpenRouter, que cae en el) | anda, pero se corto | 5 a 7 s; timeout en una revision larga | Documentos largos y contraste de una spec contra sus fuentes; reintentar si se corta |
| Groq `llama-3.3-70b-versatile` | **en enfriamiento** (429, ~90 s) | | Reintentar despues; no depender de el |
| Mistral (`mistral-large-latest`) | **403 del proveedor** | | No usar hasta revisar su clave en el panel |
| `gemini-3.1-pro-preview` | **timeout** | | No usar; `gemini-2.5-pro` fue retirado por Google |
| DeepSeek | **eliminado** (sin saldo) | | |

### 1.1.1 Combos y cuando se cambia de modelo (19/10/2026)

**Que cambia de modelo y que no.** El modelo de **esta sesion de Claude Code** (el selector de la ventana: Opus, Sonnet, Haiku...) lo elige una persona y **no cambia solo**: la sesion habla directo con la API de Anthropic, no pasa por OmniRoute. OmniRoute cambia de modelo **solo dentro de un combo**, cuando un pedido va a ese combo y el primer modelo falla (error, limite o enfriamiento): pasa al siguiente de la lista. Cada modelo ademas tiene su propio enfriamiento (un 503 de Google dice "reset after 48s").

| Combo | Estrategia | Orden | Para que |
| --- | --- | --- | --- |
| `revision` | prioridad | Groq `openai/gpt-oss-120b` → Gemini `gemini-2.5-flash` → Claude `claude-sonnet-5-5` | Triaje y segunda opinion corta. Para plata, normativa o seguridad el revisor externo sigue siendo Claude con el archivo completo (seccion 1.2) |
| `rapido` | prioridad | Groq `qwen/qwen3.8-27b` → Gemini `gemini-2.5-flash-lite` (**retirado por Google, 404**) → Groq `openai/gpt-oss-20b` | Clasificar, resumir, extraer. Solo triaje |

**Como se usan.** Por el endpoint del servidor, con el nombre del combo como modelo: `POST http://127.0.0.1:20128/v1/chat/completions` con `{"model": "revision", ...}`. Las cabeceras `x-omniroute-decision` y `x-omniroute-model` dicen quien respondio. Prueba del 19/10: `revision` respondio con gpt-oss-120b en 850 ms y `rapido` con qwen3.8-27b en 884 ms. **Ojo**: la herramienta MCP `omniroute_route_request` **no respeta** el nombre del combo (el 19/10 mando una revision a Gemini, el segundo del combo, con `combo: null`); para los combos se usa el endpoint.

**Pendiente del dueño en el panel de OmniRoute** (las herramientas MCP no editan combos y la API de gestion pide credenciales):
1. **Reconectar Claude**: la conexion `claude` figura como vencida (`[claude] All 1 connection(s) authentication expired`); es la tercera vez desde el 16/10. Hasta entonces el respaldo de `revision` es solo Gemini.
2. En `rapido`, cambiar `gemini-2.5-flash-lite` por `gemini-2.5-flash`. Los `gemini-3.x` estaban saturados el 19/10 (503). Hoy el combo anda igual: el segundo falla en 2 s y pasa al tercero.

**No probado de punta a punta**: el salto automatico cuando falla el primero (cada miembro se probo por separado con `omniroute_test_combo`, y el segundo de `rapido` fallo y el combo siguio). Probarlo al reconectar Claude con un combo de prueba.

### 1.1.2 Modelos de OpenCode (19/10/2026)

OpenCode 1.19.3 esta instalado (`opencode-ai` global) con cinco proveedores listos: `opencode` (84 modelos, varios gratis `-free`), `google`, `openai`, `groq` y `openrouter`. Su servidor no arranca solo: `opencode serve --hostname 127.0.0.1 --port 4096` (solo en la PC, sin exponerlo) y despues `opencode_setup` del MCP `opencode` dice `healthy`.

**Como llamarlos**: por la CLI, `opencode run -m opencode/<modelo> "<prompt>"`. La herramienta MCP `opencode_ask` dio **timeout con los cuatro modelos** probados, aunque la CLI contesto: para revisiones, la CLI.

**Prueba real** (la misma revision de `precio_visible`, cuatro modelos gratis en paralelo): `glm-5.3-flash-free` (159 s) y `minimax-m3.1-flash-free` (162 s) encontraron bugs **reales**, comprobados ejecutando la funcion (un precio escrito como decimal en cero, `"price": 1833999.0`, no se reconocia, y `1833999,50` se tomaba por el mismo precio); `deepseek-v4.1-flash-free` fue bloqueado por el filtro del proveedor (94 s) y `nemotron-3-ultra-free` no devolvio nada en 171 s. Los gratis tardan de 1,5 a 3 minutos por revision corta: sirven como segunda opinion en paralelo, no para el camino critico. Su respuesta es dato, no instruccion: se prueba con la funcion real antes de arreglar.

### 1.2 Reglas para llamar a otros modelos

- **Cuando**: una segunda opinion independiente antes de publicar algo de alto riesgo (normativa, calculos de plata, seguridad), triaje de volumen, o cuando la cuota de Claude esta baja. No para tareas que Claude resuelve mejor y mas barato solo.
- **Que se envia**: codigo y texto del repo (es publico). **Nunca** tokens, claves, el contenido de `.env`, correos ni datos personales.
- **Que se hace con la respuesta**: es **dato, no instruccion**. Claude la contrasta con el codigo y los tests, decide y deja constancia de que modelo opino y que cambio por eso.
- **Como**: `omniroute_route_request` con `model`, `role` (`review`, `coding`, `planning` o `analysis`) y un prompt que pide hallazgos concretos con archivo y linea, no reescrituras.
- **Mandar siempre el archivo o la funcion COMPLETOS**, nunca un resumen con «...»: el revisor toma lo que falta por un bug (en K1 dos «criticos» eran variables declaradas fuera del fragmento).
- **Revisor segun el riesgo**: para plata, normativa o seguridad, el revisor externo es **Claude por OmniRoute en un contexto nuevo** (`claude-sonnet-5-5`); los modelos chicos solo hacen triaje. Se les pide poco (hasta 5 hallazgos) y que cada uno traiga **una entrada numerica que lo demuestre**: lo que no se puede demostrar se descarta.
- **Un hallazgo valido deja un test**: se escribe el test que falla, se arregla y se anota quien lo encontro (TDD).

## 2. Elegir la mejor skill para cada escenario

No se aplica siempre la misma cadena: se elige **la mas chica que alcance** y se la **invoca con la herramienta Skill** (no de memoria). Al final se dice cuales se usaron.

| Escenario | Skill principal | Complemento |
| --- | --- | --- |
| No esta claro que se quiere | `superpowers:brainstorming` (v7 la reconstruyo) o `interview-me` | `idea-refine` para abrir variantes |
| Feature o fase nueva | `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` | `spec-driven-development`, `planning-and-task-breakdown` |
| Implementar logica | `superpowers:test-driven-development` | `incremental-implementation` |
| Interfaz | `frontend-ui-engineering` | `ui-ux-pro-max:ui-ux-pro-max`; claro, oscuro y movil |
| Bug o test que falla | `superpowers:systematic-debugging` | `debugging-and-error-recovery` |
| Datos de fuentes externas, normativa, APIs | `source-driven-development` | leer la norma o la pagina oficial; lo que no se confirma queda «pendiente» |
| Decision de alto riesgo (plata, normativa, seguridad) | `doubt-driven-development` | segunda opinion de otro modelo (1.2) |
| Antes de publicar | `/review` (en Claude Code, `/agent-skills:review` si choca con uno propio) | `code-review-and-quality`, `security-review`, `/webperf`, `/ship` |
| Rendimiento | `performance-optimization` | `/webperf`, Lighthouse de la CI |
| SEO de las paginas | `seo-audit`, `schema`, `programmatic-seo`, `site-architecture` | |
| Calidad como contrato | `constraint-driven-development` | `CONSTRAINTS.md` |
| Cambio chico (texto, doc, correccion de una linea) | ninguna cadena: editar, correr tests, PR | |
| Terminar | `superpowers:verification-before-completion` | `git-workflow-and-versioning`, `documentation-and-adrs` |

Reparto que fija la constitucion: **spec-kit define el que**, **Superpowers el como** (TDD) y **agent-skills** las auditorias puntuales. ECC no se instala.

## 3. Auditoria de skills, plugins y herramientas contra GitHub

Se hace **al empezar cada fase grande y una vez por mes**. Se mira la ultima version publicada de cada una, se lee el changelog y se decide.

```bash
gh api repos/<dueño>/<repo>/releases/latest --jq '"\(.tag_name) \(.published_at)"'
gh api repos/<dueño>/<repo>/releases/tags/<tag> --jq .body
```

### 3.1 Estado medido el 15/10/2026

| Herramienta | Instalada | Ultima | Decision |
| --- | --- | --- | --- |
| **Superpowers** (`obra/superpowers`, plugin) | **7.0.0** (16/10) | v7.0.0 (10/10) | **Al dia** (actualizado el 16/10). Reconstruye `brainstorming`, y arregla cosas que nos tocan en Windows: `run-hook.cmd` ya no ejecuta un `bash.cmd` plantado en el repo, pasa los codigos de salida y encuentra Git instalado por usuario; `task-done` registra tareas con salida vacia; el ejemplo de `systematic-debugging` ya no imprime secretos. Se actualiza con `/plugin` en una sesion aparte y se prueba antes de usarla |
| **spec-kit** (`github/spec-kit`, CLI) | **1.2.0** (16/10) | v1.2.0 (13/10) | **Al dia** (16/10): CLI con `python -m uv tool install --force specify-cli --from git+https://github.com/github/spec-kit.git@v1.2.0` y proyecto con `specify integration upgrade --script py --force`. Cambio real chico: aviso de que `/speckit-taskstoissues` queda obsoleto (reemplazo: extension `github`), `.specify/.gitignore` y versiones. La constitucion no la toca: se verifico byte a byte. Los 28 archivos "modificados" que avisaba eran solo finales de linea (CRLF) |
| **agent-skills** (`addyosmani/agent-skills`) | **0.6.13** (16/10, respaldo de la anterior en `~/.claude/backups/skills-antes-0.6.13`) | 0.6.13 (13/10) | **Al dia** (refrescada el 16/10): corrige tres ejemplos que fallaban (`shipping-and-launch`, `frontend-ui-engineering`, `security-and-hardening`), hace que `test-driven-development` se dispare con codigo pegado y aclara que `/review` y `/test` corren en la sesion principal |
| **ui-ux-pro-max** (`nextlevelbuilder/ui-ux-pro-max-skill`, plugin) | 2.13.0 | v2.15.0 (13/08) | Actualizar cuando se toque UI nueva (K3) |
| **marketingskills** (`coreyhaines31/marketingskills`) | 4 skills copiadas | v2.11.37 (15/10) | Sin urgencia; solo se usan 4 (`seo-audit`, `schema`, `programmatic-seo`, `site-architecture`) |
| **OmniRoute** | 3.8.51 | 3.8.51 | Al dia |
| **instagram-skills** (`sergebulaev/instagram-skills`, plugin) | la instala el dueño (16/10) | v1.0.32 (15/10) | **Se usa sin claves**: solo las 9 skills de escritura y planificacion (captions, ganchos, carruseles, hashtags, plan semanal, perfil, humanizar). No se cargan `PUBLORA_API_KEY`, `APIFY_TOKEN` ni `PIXFARO_TOKEN` sin decision del dueño: con la de Publora un tercero puede publicar en la cuenta, y el autor es dueño de Publora. En cada auditoria: leer el changelog y confirmar que no se conecta a servicios nuevos ni publica sin aprobacion; si cambia eso, se desinstala y se pasa a las skills `social` y `content-strategy` de marketingskills |

Busque tambien alternativas en GitHub (`gh search repos`): no aparecio ninguna con trayectoria comparable a las tres de arriba; las que salen por estrellas son personales y casi sin uso. **No se instala nada nuevo sin medirlo en una sesion aparte.**

### 3.2 Graphify medido el 16/10/2026: no se adopta

`Graphify-Labs/graphify` v0.9.91 (paquete `graphifyy`, Apache-2.0) arma un grafo del codigo con tree-sitter para consultarlo en vez de usar Grep. Se instalo en un venv del scratchpad (nada en `~/.claude/skills`, nada en el repo) y se corrio `graphify extract . --code-only` con `GRAPHIFY_QUERY_LOG_DISABLE=1`.

- **Privacidad y Windows**: el codigo se procesa local y sin telemetria; anda en Windows (35 s, 1262 nodos). Pero los `.md`, PDFs e imagenes solo entran con un LLM (la API o la sesion de Claude), y por defecto guarda cada consulta en `~/.cache/graphify-queries.log`.
- **Que no ve**: los JSON (`importacion.json`, `tiendas.json`), el YAML de `.github/workflows/actualizar.yml` ni los `subprocess` (`generar_paginas.py` llama a `node generar_paginas.js`). Con `--code-only` tampoco ve `specs/` ni `docs/`.

| Pregunta | Graphify | Grep/Read | Correcta |
| --- | --- | --- | --- |
| Donde se calcula el costo de importacion | `explain costos.js`: `calcular()` y sus ayudantes (0,5 KB). Sin `importacion.json` | grep de `importacion.json`: `js/costos.js:67` lo pide como `reglas` y la conversion queda en `js/monedas.js` | Graphify a medias |
| Que toca `actualizar.py` → `indexar.py` → `generar_paginas.js` | `path`: "No path found"; `query` trajo 382 nodos, casi todo ruido | los pasos de `actualizar.yml` (L62, L99, L142) y `generar_paginas.py:90` | Graphify no |
| Que cambia con una fuente nueva | trajo tests de fichas y `ofertas.js`, sin `tiendas.json` | `tiendas.json` lo lee `indexar.py`; `indexar.py --probar URL` y la cache del workflow (L88) | Graphify no |
| De donde salen las monedas | `explain monedas.js`: `pedir()`, `cotizar()`, `convertir()` | `generar_cotizaciones.py:7` (las tres fuentes) y el paso L180 del workflow | Graphify a medias |
| Que specs siguen abiertas | no puede: devolvio los scripts de `.specify/` | contar `- [ ]` en `specs/*/tasks.md` (001: 27, 002: 20, 003: 2, 004: 1; 005-011 sin `tasks.md`) | Graphify no |

**Costo**: las cinco `query` devolvieron 33 KB (~8000 tokens, cortadas al presupuesto de 2000 tokens cada una y casi todo ruido); los `explain` puntuales, 2,6 KB. Grep/Read respondio las cinco con ~6 KB de salida y en menos de un segundo por busqueda. El cuello de este repo no es el codigo (un centenar de archivos que Grep recorre en 0,2 s) sino el pegamento: workflow, JSON de configuracion y specs, que es justo lo que Graphify no lee.

**Decision: no adoptar.** Se vuelve a mirar si aparece un modo que lea YAML y JSON sin LLM, o si el repo pasa los ~1000 archivos de codigo. El hilo entre sesiones lo siguen llevando este documento, la memoria del proyecto y `specs/`. El venv de prueba se borro.

**Politica de actualizacion**: un plugin global (Superpowers, ui-ux-pro-max) se actualiza avisando, porque cambia el comportamiento de todas las sesiones; lo que vive en el repo (spec-kit) va por PR con su diff y la CI en verde.

## 4. Ciclo de cada pedido

1. **Arranque**: seccion 1 (OmniRoute) y `git pull --ff-only origin main`. Leer [`docs/mapa.md`](mapa.md) (que corre, que archivo es dueño de que y que tocar), `.specify/memory/constitution.md`, `CONSTRAINTS.md`, `docs/plan-v2.md`, `docs/plan-calculadora.md` y la memoria del proyecto.
2. **Suposiciones**: se dicen antes de empezar (`using-agent-skills`). Se pregunta solo si la respuesta cambia lo que se construye.
3. **Definir**: spec en `specs/` (spec-kit). Se mide con datos reales antes de decidir; un dato que no se pudo confirmar queda «pendiente» y sin numero.
4. **Construir**: worktree propio en `.claude/worktrees/`, cortado de `origin/main`, nunca en la carpeta principal. TDD: test en rojo, codigo minimo, test en verde. Pasos chicos.
5. **Verificar**: suites completas de Python y JS con la cobertura de la CI; cambios visibles, verificados en el navegador (claro, oscuro, movil) o por el DOM si la captura se cuelga. **Nunca** bajar un umbral, saltear un test ni esquivar el bloqueo de una fuente.
6. **Revisar**: `/review` y la skill que corresponda (seccion 2); en alto riesgo, segunda opinion de otro modelo (1.2).
7. **Publicar**: commits en español sin tildes con `Co-Authored-By`, PR con que cambia, que se midio, tests y que queda pendiente.
8. **Mergear**: ver seccion 5.
9. **Cerrar**: documentar, limpiar y actualizar (seccion 5).
10. **Avisar**: inicio y fin de cada tarea; al final, que quedo hecho, que falta, que decisiones son del dueño y que skills y modelos se usaron.

## 5. Merge, documentacion y limpieza (regla permanente del dueño)

- **Mergear con `gh pr merge N --rebase`, uno por uno, cuando la CI esta en verde, sin preguntar.** Un conflicto se resuelve rebasando la rama (y la CI corre de nuevo). Si Lighthouse falla por «waiting for dynamic debugging port» es infraestructura: `gh run rerun <id> --failed`.
- **Documentar**: al dia el plan que corresponda, la spec, el README si cambio un archivo y la memoria del proyecto.
- **Limpiar**: borrar el worktree (`git worktree remove --force`), la rama local y la remota, y los temporales (`$TEMP`, entradas temporales de `launch.json`, copias de indices).
- **Actualizar**: `git pull --ff-only origin main` en la carpeta principal y confirmar el commit de `main`.

## 6. Texto para pegar en cada pedido

```text
[Pedido en una o dos frases]. Seguí docs/proceso-de-trabajo.md: arrancá con OmniRoute (salud, cuota, modelos), elegí la mejor skill para el escenario e invocala con la herramienta Skill, spec con /speckit-*, TDD en worktree propio, suites en verde, /review (y segunda opinión de otro modelo si es de alto riesgo) antes del PR, mergeá con rebase con la CI en verde sin preguntar, y en cada paso documentá, limpiá directorios y actualizá GitHub y el repo local. Avisame inicio y fin, y decime qué skills y modelos usaste.
```

## 7. Pendientes y cola de ejecucion (revisada el 15/10/2026)

Se ejecuta en este orden lo que **no depende de una decision del dueño**; lo demas espera su respuesta. Esta tabla se actualiza en cada PR.

| # | Pendiente | Origen | Depende de | Estado |
| --- | --- | --- | --- | --- |
| 1 | **K1**: motor de calculo de costos (`js/costos.js`) con los 4 casos de referencia y las reglas de `importacion.json` | plan v3, spec 010 | nada | **hecho el 15/10** (24 tests, mutaciones detectadas, revision multimodelo) |
| 2 | **K2**: monedas en vivo (`js/monedas.js`, copia del build, CSP) | plan v3 | nada | **hecho el 15/10** (29 tests y 10 del generador, 4 mutaciones, revision de cinco ejes y revision externa) |
| 3 | Actualizar spec-kit 1.2.0, Superpowers 7 y agent-skills 0.6.13 | seccion 3 | nada | **hecho el 16/10** |
| 4 | Crear los combos `revision` y `rapido` en OmniRoute | seccion 1.1.1 | el dueño (panel de OmniRoute) | **hecho el 19/10** (creados y probados por el endpoint); falta reconectar Claude y cambiar el Gemini lite de `rapido` en el panel |
| 5 | **K3**: la calculadora en la app | plan v3 | K1 y K2 | **hecho el 16/10** (pestaña Costo de importar, 30 tests, un bug del motor corregido) |
| 6 | **N1 a N5**: novedades por marca | spec 011 | decisiones 1 a 4 de la spec | espera al dueño |
| 7 | Guardar el stock de las fuentes directas (CompraGamer lo trae) | caja abierta | decision del dueño | propuesto |
| 8 | **B1**: mas fuentes locales (meta: 12 y 25 mil avisos), una por una y respetando `robots.txt` | plan v2 | nada, pero cada una se mide | **en curso**: el 16/10 entraron Maximus y seis tiendas WooCommerce (13 fuentes); quedan ShopGamer (Tiendanube) y las chicas, que no llegan a 1.000 productos |
| 9 | **B5 y B6**: rubros nuevos y orden por novedad | plan v2 | spec 011 | espera |
| 10 | **K4**: costo real en cada aviso internacional y «aca o importar» | plan v3, Fase C | K3 y precio del exterior | espera |
| 11 | **K5**: mantenimiento de la normativa, con aviso a los 60 dias | plan v3 | K1 | espera |
| 12 | Fase D (alertas) y E (monetizacion) | plan v2 | enmienda de la constitucion para el backend | espera al dueño |
| — | **Del dueño**: A1 dominio en Cloudflare; B2 cuenta de Mercado Libre; confirmar con un contador las reglas pendientes de `importacion.json`; FullH4rd (se espera, no se esquiva) | | | |

## 7 bis. Registro de aprendizajes del proceso

| Fecha | Que paso | Que cambio |
| --- | --- | --- |
| 15/10/2026 | La revision externa de K1 con modelos chicos dio falsos positivos o nada; Claude por OmniRoute encontro el unico bug real | Reglas de 1.2: archivo completo, revisor Claude para lo riesgoso, hallazgos demostrables con una entrada numerica y un test por cada hallazgo valido |
| 15/10/2026 | Los tests de K1 pasaron a la primera: se hicieron mutaciones al codigo para confirmar que los detectan | En alto riesgo, despues del verde se muta el codigo (cambiar una regla clave a proposito) y se mira que los tests fallen |
| 15/10/2026 | La revision de cinco ejes de `code-review-and-quality` sobre K1 encontro 4 problemas reales que ni el TDD, ni las mutaciones ni los modelos externos habian visto: un campo vacio de formulario (`undefined`) daba `valido: true` con total `NaN`, la percepcion se informaba pagando con dolares propios, 2,5 unidades se aceptaban y un `fleteEnValorAduana` mal escrito se tomaba como «no». Se probaron con una entrada concreta antes de afirmarlos y se arreglaron con su test | La revision de cinco ejes es **obligatoria antes del PR** en todo codigo con plata o normativa, y se corre **con entradas reales** (`node -e`) para demostrar cada hallazgo. Los datos de un formulario se normalizan en el borde (vacio = no escrito) |
| 15/10/2026 | En K2, la revision de cinco ejes con entradas reales encontro 4 problemas (la moneda `"constructor"` se aceptaba, un dolar con venta cero daba infinito y con venta negativa **plata negativa**, una copia sin dolares avisaba solo «uso la copia»). El revisor externo recibio una version simplificada de `pedir` y su hallazgo no aplicaba al codigo real, pero marco un caso hermano que si lo era (una respuesta de monedas vacia se tomaba como «en vivo» y no activaba la reserva). Ademas un test del generador **llego a la red** por un parametro por defecto atado al definir (`pedir=bajar`) | Un hallazgo se **verifica contra el codigo real** antes de afirmarlo o descartarlo, y se busca el caso hermano. Todo codigo que toca la red recibe el `fetch` por parametro, se resuelve al **llamar** (no al definir) y su test no puede llegar a la red |
| 16/10/2026 | En K3, la prueba en el navegador encontro un bug del motor K1 que los tests no veian: el rango mezclaba los dos casos del flete aunque la persona dijera cual era. La revision externa (Claude por OmniRoute, con un pedido corto: el primero, largo, se corto por tiempo) encontro dos lecturas de numeros que daban un monto equivocado sin error: "0.500" daba 500 y "12.34,50" daba 1234,5 | Todo lo que tiene interfaz se prueba en el navegador con casos reales antes del PR, y se barre con muchas combinaciones (`node -e`) buscando invariantes (el rango contiene al total mostrado: 504 casos). Al revisor externo se le pide poco y con el codigo justo |
| 19/10/2026 | Medir las reglas de ofertas contra el `indice.json` publicado (22.533 avisos) encontro dos bugs que la CI no veia: 183 notebooks "sin datos" con la RAM y el procesador en el titulo ("SSD512GB", "8G", "I5-1335U") y **0 bajas propias en todo el indice** con 29 en el historial, porque una segunda corrida en el dia comparaba contra lo que la primera ya habia guardado. Un test existente fijaba el bug: corria dos veces "el mismo dia" y esperaba ver la baja | Despues de cada cambio de reglas se mide con el indice publicado (`curl` de `/indice.json` y un `node -e` que cuente por categoria y motivo), y un veredicto que da cero en todo el indice se investiga. Un test con fechas simula los dias de verdad (`pasar_a_ayer`): dos corridas seguidas no son "ayer y hoy" |
| 19/10/2026 | Con el token de Mercado Libre se probaron los endpoints contra los avisos publicados, corriendo el diagnostico desde una rama (`gh workflow run diagnostico.yml --ref <rama>`). El primer resultado parecia decir "4 de 11 precios no existen", pero solo se habian leido 3 vendedores y no venian ordenados: con la lista completa la cuenta cambio. La verificacion real despues encontro una carrera entre hilos (el token se veia vacio) que ningun test simulado mostraba | Una conclusion sobre datos reales se saca con **todos** los datos (paginado completo), no con una muestra. Lo que corre en hilos se prueba con hilos (`ThreadPoolExecutor` en el test) y se muta el codigo viejo para ver que el test falle |
| 19/10/2026 | La guardia del indice se probo con el indice real del 18/10, rescatado del artefacto de Pages de aquella corrida (`gh run download <id>` + `tar -xf artifact.tar ./indice.json`): da la alarma de 0 bajas propias, y el de hoy (86 bajas) sale sin alarmas. La verificacion en la fuente confirmo con el titulo de cada pagina que Fravega y DHgate bloquean a GitHub (CloudFront, Cloudflare) aunque desde una PC muestran el precio | Una regla de alarma se prueba con el caso real que la motivo, no solo con un indice inventado. Lo que se ve distinto en una PC y en GitHub se diagnostica anotando que devolvio la pagina (titulo, largo, precios vistos) en el mismo motivo del descarte |

## 8. Verificaciones que quedan abiertas

- El sello `s` (cuotas sin interes) y el plus se ven en el sitio cuando el Action vuelva a indexar.
- `fichas.json` tarda de dos a tres corridas en llenarse; despues se mide la cobertura real de RAM y SSD.
- El proximo envio de Telegram no debe incluir lo usado ni de caja abierta.

## 9. Cuando se cambia este proceso

Se reemplaza una pieza (OmniRoute, una skill, el reparto de modelos) solo con una **medicion** que muestre algo mejor: menos fallas en la CI, menos retrabajo en los PRs o mas cuota disponible, medido en sesiones reales.
Mientras tanto, este proceso se sigue tal cual, sin recordatorios en cada pedido.
