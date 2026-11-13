# Plan definitivo de escalado — La Pichincha

Fecha: 13/11/2026. **Version 3 (definitiva)**. Los IDs (S1, D1, W1, N-CAL1...) son de `docs/auditoria-2026-11-13.md`. Este plan manda en el **orden de ejecucion**; `docs/plan-v4-tiendas-de-apps.md` sigue vigente para el detalle de la app Android.

Objetivo en una frase: que el sitio **no pueda publicar datos malos sin que alguien se entere, no se caiga si se cae una pieza, y aguante 10 veces mas visitas**, sin gastar plata antes de tiempo.

Que cambio contra la v2: se verifico contra el codigo cada hallazgo que el plan usa para decidir (seccion 1), se reordenaron las fases por retorno y riesgo, cada fase tiene archivos, test, criterio medible y rollback, se corrigieron cuatro supuestos de costos y de Cloudflare, y se agrego como ejecutarlo sin que se corte (seccion 12).

## 0. Donde estamos (medido el 13/11)

- Sitio estatico en GitHub Pages (`pichinchadeldia.com.ar`), 200 URLs en el sitemap, todas 200. Tests: JS 818/818, Python 744 OK. Lighthouse movil en `/`: Accesibilidad, Buenas practicas y SEO 100. axe: 0 violaciones en 22 combinaciones.
- Los datos se arman en GitHub Actions (`actualizar.yml`) y viajan con el sitio. `indice.json` publicado: 1.346.850 bytes comprimido (6,7 MB crudo), `Cache-Control: max-age=600`.
- Un Worker de Cloudflare hace de "afuera": buscar en eBay/AliExpress/Amazon/Tiendamia, contacto por correo y el vigia (cron cada 5 min).
- `main` esta protegida desde el 13/11 (S1 cerrado): ruleset `proteger-main`, sin borrado ni force-push, check `tests` obligatorio.
- Lo grave que sigue abierto: **cinco formas de publicar datos malos en silencio** (D1-D5).

## 1. Lo que se verifico contra el codigo (13/11, tercera pasada)

Se leyo la linea citada de cada hallazgo. **V** = confirmado; **corregido** = el hallazgo era cierto a medias y el plan cambia.

| Hallazgo | Resultado | Que cambia en el plan |
|---|---|---|
| N-CAL1 (28 scripts sincronos) | V: 28 `<script src>` sin `defer` en `index.html` (9, 109-123, 874-885), mas 1 `async` (GoatCounter) | Sigue primero. Ver la salvedad de abajo |
| N-CAL1 ("preload del indice") | **Corregido**: `js/indice-ofertas.js:1-2` baja el indice **a proposito** recien al abrir Buscar u Ofertas. Un `preload` fijo se lo haria bajar a todos | Pedirlo temprano **solo** si la URL trae `?q=`, `#buscar` u `#ofertas` |
| N-CAL1 ("mayor impacto") | **Corregido**: el 31/10 ya se probo `defer` en 26 scripts: FCP 3,9 -> 3,0 s y el LCP **no** mejoro (el LCP era un `<th>` de la Comparativa) | El exito se mide en FCP y en "cuando se pide el indice", no en LCP |
| N-CAL2 (el service worker precachea el indice) | V (`sw.js:19`), pero es **a proposito**: es lo que deja buscar sin conexion | Se **saca** del plan. No se toca |
| D2 (umbral ciego sin historial) | V: `salud.py:35` usa `previo and ahora < umbral*previo`; con `previo = 0` nunca marca "baja" | F2 |
| D4 (se publica con indice viejo) | V: `actualizar.yml` paso `indexar` con `continue-on-error`, y "Preparar el sitio" solo deja un `::warning::` | F2 |
| D5 (Telegram con indice viejo) | V, y peor: `guardia.js` sale con 3 "para que la corrida no mande Telegram", pero el paso de Telegram **no mira** `steps.guardia.outputs.alarma`; el propio aviso dice "la alarma avisa, no frena" | F0: una linea |
| "Hace falta `verificar_indice.py`" | **Corregido**: ya existen `salud.py` (estado por tienda), `guardia.js` (alarma por categoria) y `filtrar_indice.py`. Falta que **frenen**, no otro script | F2 reusa los tres. Cero archivos nuevos |
| "Falta la alarma de frescura" | **Corregido**: el vigia ya la tiene (`worker/src/vigia.js:98-112`): desde las 03:00 de Argentina el indice tiene que ser de hoy | Lo que falta es otra cosa: ver C1 |
| C1 (cron atrasado) | V con 12 corridas: programadas a las 03:23 UTC, arrancaron entre las 10:29 y las 11:41 UTC del 08 al 13/11 (7 a 8 h tarde, todos los dias) | F3. Ademas, con `HORA_MINIMA = 3` el vigia deberia estar avisando "indice de ayer" cada mañana: **sin verificar**, lo confirma el dueño mirando su Telegram |
| "Falta medir Lighthouse de rendimiento" | **Corregido**: la CI ya lo mide (`tests.yml` job `lighthouse`, `.github/lighthouse.js:16`): las cuatro categorias cortan un PR por debajo de 90, con mediana | La meta de 95 es mas alta que la de la CI. La portada dio 87-89 en PRs del 11 y 12/11 (issue #6 del repo privado) |
| N-SEO2 (migas solo en JSON-LD) | V: `generar_paginas.js:204` las declara y `pie()` (`:274`) no las muestra ni enlaza a `/precios/` | Fase de SEO |
| N-UX2 (tabla de Comparativa) | V: `js/consulta.js:106`, `<div class="scroll">` sin `tabindex` y `<th>&nbsp;</th>` | Fase de diseño |
| N-UX3 (`--bad-soft`) | V: se usa en `css/sitio.css:455` y no esta definido | Fase de diseño |
| N-DS1 ("`:root` 5 veces") | **Corregido**: son 13 | Fase de diseño |
| N-CI4 (Worker sin humo ni rollback) | V: `worker.yml` hace `wrangler deploy` y nada despues | F5 |
| N-CI5 (acciones por etiqueta) | V: las 10 acciones van por etiqueta (`@v7`); no hay `.github/dependabot.yml` | F5 |
| N-T1 (`retries: 1` tapa la intermitencia) | V: `playwright.config.js:12` | F1 |
| S1 | V en vivo: `gh api .../rules/branches/main` devuelve `deletion`, `non_fast_forward` y `required_status_checks: tests` | Cerrado. Ver C3 |

Tres hallazgos **nuevos** de esta pasada:

- **C2 (Alta, arreglo en el PR 274)**: `actualizar.yml` quedo **invalido** el 13/11 a las 19:38 UTC: el paso "Guardar los cambios de precio" tenia dos `continue-on-error` (commit `5bb5d13`). GitHub rechaza el archivo entero: 4 publicaciones seguidas fallaron sin correr ni un job, y la corrida diaria tampoco iba a salir. `Tests` paso en verde porque no valida los workflows, y el aviso de "fallo la corrida" vive **dentro** del archivo roto, asi que nadie se entero.
- **C3 (Media)**: el ruleset exige solo `tests`. `e2e` y `lighthouse` no son obligatorios: GitHub deja mergear con esos dos en rojo. Hoy el freno es solo la costumbre.
- **C4 (Baja)**: con `main` protegida, el bot ya no puede commitear `datos.json` (el paso falla y sigue). El sitio sale bien igual, pero el `datos.json` del repo se va quedando viejo (ultimo commit del bot: 12/11). Hay que decidir si se guarda en la rama `historial` (que no esta protegida) o se deja asi. Recomendado: rama `historial`.

**Sin verificar** (reportado por una skill, nadie lo midio de nuevo): N-SEO3 (13 pares de paginas casi iguales), N-SEO4, N-SEO5, N-A11Y1 (32 de 66 controles bajo 44 px), N-TIPO1 salvo Oswald, N-UX4, N-UX5, N-H1, D7-D13 y D15-D18 (los verifico solo el agente de revision). Ninguno decide el orden de las fases: se verifican al empezar la fase que los toca.

## 2. Arquitectura

Hoy: `GitHub Actions (cron) -> indexar.py -> indice.json -> GitHub Pages`, y el `Worker` aparte.

Decision: **no migrar de plataforma**. Lo que falta no es otro servidor sino una red de seguridad entre "se armo el indice" y "se publico". No se recomienda base de datos, Next.js ni servidores propios: miles de productos y una corrida por dia no lo justifican.

El techo real de GitHub Pages es el **ancho de banda: 100 GB por mes** (limite blando). Cada visita nueva que busca baja ~1,35 MB de indice mas ~0,3 MB de cascaron. Son unas **60.000 visitas nuevas por mes** (~2.000 por dia). Mientras el sitio este lejos de eso, Cloudflare delante es una mejora de seguridad y no una urgencia; por eso va despues de los datos y del Worker (F7).

## 3. Fases, en orden de retorno y riesgo

Regla: una fase es **uno o varios PR chicos**; se cierra con sus tests, su fila en `docs/mapa.md` y su criterio medido y anotado. El rollback de todas es `git revert` del PR, salvo donde se aclara.

### F0. Destrabar la publicacion y el freno de Telegram (hoy, horas)

- **Que cambia**: (a) sacar el `continue-on-error` repetido (C2, PR 274). (b) Que un workflow invalido no pueda entrar: paso con `actionlint` en `tests.yml`. (c) D5: el paso "Publicar las pichinchas del dia en Telegram" suma `steps.indexar.outcome != 'failure' && steps.guardia.outputs.alarma != 'true'`. (d) W9: `avisar_dueno.py:125-126` imprime solo "aviso no enviado".
- **Archivos**: `.github/workflows/actualizar.yml`, `.github/workflows/tests.yml`, `avisar_dueno.py`.
- **Test**: `tests/test_canal.py` (ya lee el paso de Telegram) afirma la condicion nueva; un test que carga los 6 workflows y falla con una clave repetida; `tests/test_avisos_y_arreglos.py` para W9.
- **Terminado cuando**: la corrida por push posterior al merge muestra sus jobs y termina en verde; `actionlint` falla en una rama de prueba con la clave repetida.
- **Rollback**: revert. El punto (c) es el unico que cambia conducta: si frena de mas, se revierte solo esa linea.

### F1. Carga de la portada: N-CAL1 (1 dia)

- **Que cambia**: `defer` en los 28 scripts. El indice se pide apenas arranca la pagina **solo** si la URL trae `?q=`, `#buscar` u `#ofertas` (una linea inline que guarda la promesa del `fetch` y `asegurarIndice` la reusa). De paso N-T1: `page.clock` en el test de contacto y sacar `retries`.
- **Archivos**: `index.html`, `js/indice-ofertas.js`, `generar_portada.js` si reescribe las etiquetas, `tests/e2e/contacto.spec.js`, `playwright.config.js`.
- **Ojo**: el bloque inline `const DATOS = ...` (`index.html:124`) pasa a ejecutarse **antes** que los scripts. Hoy solo define datos; antes de mergear se confirma que no llama a ninguna funcion de `js/`.
- **Test**: suite e2e completa (22 pruebas) y `tests/js/generador.test.js`; una prueba e2e nueva: en `/?q=ssd` el pedido de `indice.json` sale antes de `DOMContentLoaded`.
- **Terminado cuando** (medido antes y despues con `.github/lighthouse-corrida.sh`, mediana de 3): FCP de la portada baja al menos 0,5 s; en `/?q=ssd%201tb` el indice se pide antes de los 2 s (hoy ~7,8 s); rendimiento de la portada >= 90 en 3 corridas seguidas de la CI; 0 errores de consola.
- **Rollback**: revert. Si el LCP no mejora, no es fracaso (ya paso el 31/10): se mide lo de arriba.

### F2. Compuerta de publicacion: D1 a D4 (2 a 3 dias, 4 PR)

Sin scripts nuevos. Cada punto es un PR con su test:

1. **D3** `filtrar_indice.py`: no borra si saca mas del 5 % del indice o mas del 30 % de una tienda; sale con codigo distinto de 0 y el paso avisa. Test en `tests/test_filtrar_indice.py`.
2. **D1** `indexar.py:1124-1127`: si una tienda trae menos que `umbral * previo`, se conservan sus productos de la corrida anterior (lo mismo que ya hace cuando trae 0) y queda "baja" en `notas`. Test en `tests/test_indexar_corrida.py`: tienda que cae 70 % -> el indice conserva los anteriores.
3. **D2** `indexar.py:1042`: si no hay historial, `vivos` se calcula del indice anterior. Test: sin carpeta de historial, una tienda con 10 productos contra 1.000 queda "baja".
4. **D4** `actualizar.yml`: en un push sin indice previo, `exit 1` en lugar de publicar el buscador vacio. Si `indexar` falla en la corrida diaria se publica el ultimo indice bueno (eso esta bien) y el vigia avisa que es de ayer.

- **Terminado cuando**: con un indice de prueba donde una tienda cae 70 %, la corrida **no publica esa caida** y el dueño recibe el aviso privado; los 4 tests nuevos en verde; `/medir-indice` sin cambios en ofertas contra `main`.
- **Rollback**: revert por PR. Riesgo real: que D1 conserve productos que la tienda dio de baja de verdad. Se acota: si la tienda sigue "baja" 3 corridas seguidas, se acepta el dato nuevo.

### F3. Frescura y vigia: C1 (1 dia + 2 acciones del dueño)

- **Que cambia**: (a) KV del vigia para que no repita avisos. (b) `[observability] enabled = true` en `worker/wrangler.toml`. (c) El Worker dispara la corrida diaria (`workflow_dispatch` por la API de GitHub) en el tick de las 00:25 de Argentina; los dos cron de GitHub quedan de respaldo y el job `decidir` ya los saltea si el indice de hoy esta publicado. (d) Mientras (c) no este, `HORA_MINIMA` del vigia pasa de 3 a 10 para no avisar en falso.
- **Archivos**: `worker/src/vigia.js`, `worker/src/index.js`, `worker/wrangler.toml`, `tests/js/vigia.test.js`.
- **Accion del dueño**: `npx wrangler kv namespace create VIGIA_KV` y pegar el id; y para (c) crear un token de GitHub de grano fino, solo este repo, solo permiso "Actions: escritura", con vencimiento, y cargarlo como secreto del Worker. Es una credencial nueva: decide el dueño. Sin el token, queda (d).
- **Test**: `vigia.test.js` con reloj falso: a las 00:25 dispara una vez y a las 00:30 no; sin token no dispara y no falla.
- **Terminado cuando**: 5 dias seguidos con el indice del dia publicado antes de las 02:00 de Argentina; una alarma de prueba llega **una** sola vez.
- **Rollback**: `VIGIA = "no"` apaga el vigia entero sin desplegar codigo; borrar el secreto apaga el disparo.

### F4. Errores tragados del pipeline: D6 a D14 (2 dias, 3 PR)

- **Que cambia**: los `except` que devuelven vacio pasan a contar el fallo y dejarlo en `notas` y `salud.json` (D6-D10); `historial.py` valida filas y escribe atomico (D11); `actualizar.py` sale con codigo distinto de 0 si no pudo construir (D13, D14).
- **Archivos**: `mercadolibre.py`, `indexar.py`, `historial.py`, `actualizar.py` y sus tests.
- **Terminado cuando**: cada hallazgo tiene un test que lo reproduce y pasa; un 401 simulado de Mercado Libre aparece en `salud.json` con su motivo.
- **Rollback**: revert por PR.

### F5. Worker y CI con cinturon: W1-W4, W8, N-CI1 a N-CI5 (2 dias)

- **Que cambia**: Turnstile en `/contacto/` (es el freno real de W1 y W2). Limite nativo por IP en `/buscar` (W3). `redirect: "manual"` (W4). `workers_dev = false` (W8). Prueba de humo despues de desplegar el Worker y despues de publicar el sitio; si falla, `wrangler rollback` (N-CI3, N-CI4). Permisos minimos por job (N-CI2). Dependabot para acciones y `package.json` (N-CI5). `e2e` como check obligatorio cuando F1 lo deje estable (C3). **N-CI1** (el titulo del issue va por variable de entorno, no interpolado en el prompt) es condicion previa para prender `ARREGLO_CLAUDE`: sin ese PR mergeado, el interruptor sigue apagado.
- **Correccion a la v2**: el limite nativo de Cloudflare solo admite ventanas de **10 o 60 segundos**, cuenta **por centro de datos** y es aproximado. No puede cumplir "5 mensajes cada 10 minutos". Por eso el contacto se frena con Turnstile y el limite nativo queda para `/buscar`.
- **Archivos**: `worker/src/index.js`, `worker/wrangler.toml`, `contacto/` (el widget), `.github/workflows/*.yml`, `.github/dependabot.yml`, `sitio.json` (CSP: sumar `challenges.cloudflare.com`).
- **Accion del dueño**: crear el widget de Turnstile (gratis) y cargar su clave secreta.
- **Test**: `tests/js/worker.test.js`: `/contacto` sin token valido -> 403; `/buscar` con el limite excedido -> 429; redirect a un host no permitido -> rechazado.
- **Terminado cuando**: esos tests en verde; `curl` a `*.workers.dev` ya no responde; el deploy del Worker muestra el paso de humo.
- **Rollback**: `wrangler rollback` vuelve a la version anterior en segundos; Turnstile se apaga con una variable.

### F6. Copias de seguridad (1 dia)

Todo lo que hay que cuidar ya esta en git: `main` y la rama `historial`. Entonces la copia es un espejo del repo, no un paquete armado a mano.

- **Paso 1 (gratis, sin cuentas)**: tarea programada semanal en la PC del dueño: `git clone --mirror` (o `git remote update`) a una carpeta fuera del repo. Guarda todas las ramas.
- **Paso 2 (opcional, decide el dueño)**: el mismo espejo empaquetado (`git bundle`) a **Cloudflare R2** desde un workflow semanal, 8 copias. R2 tiene 10 GB gratis y no cobra salida, **pero pide una tarjeta cargada** para activarlo. Es una cuenta con medio de pago: decide el dueño.
- **Lo que no esta en git**: los 16 secretos. No se copian; se lista **donde se regenera cada uno** en `docs/pendientes-del-dueno.md`.
- **Test / prueba de restauracion**: clonar desde el espejo a una carpeta limpia, correr las dos suites y comparar la cantidad de filas del ultimo CSV de `historial`.
- **Terminado cuando**: una restauracion hecha y anotada con fecha: suites en verde y diferencia de filas menor al 1 %.
- **Rollback**: no aplica (no toca el sitio).

### F7. Cloudflare delante del dominio (2 dias; el paso de mas riesgo)

- **Que cambia**: activar el proxy (nube naranja) en los registros del dominio. Cabeceras reales con una regla: HSTS, `X-Frame-Options`/`frame-ancestors`, `nosniff`. Una Cache Rule para `indice.json` (Cloudflare **no** cachea JSON ni HTML por defecto) con duracion de **1 hora** en el borde, y purga de esa URL al final de la publicacion. Si la purga falla, el dato viejo dura como mucho 1 hora: se arregla solo.
- **Riesgos**: (1) con el proxy activo, GitHub puede no renovar su certificado; se usa modo SSL "Full" y se mira el vencimiento en el vigia. (2) cachear de mas. Por eso primero se activa el proxy **sin** reglas de cache, se mira una semana, y recien despues la Cache Rule.
- **Accion del dueño**: el interruptor del proxy y un token de API solo con permiso de purga.
- **Test**: prueba de humo en `actualizar.yml`: tras publicar, `indice.json` servido trae el `generado` de esta corrida.
- **Terminado cuando**: `curl -I` muestra `strict-transport-security` y `cf-cache-status: HIT` en `indice.json`; ZAP en local ya no marca la falta de cabecera anti-clickjacking; 7 dias sin que el vigia avise frescura.
- **Rollback**: apagar el proxy (nube gris). Vuelve a GitHub directo en minutos, sin tocar codigo.
- La CSP sin `unsafe-inline` (S2) queda **despues** y aparte: exige sacar el bloque inline de `DATOS`, que es un cambio de la app.

### F8. SEO y diseño de bajo riesgo (2 a 3 dias, PR sueltos, se pueden intercalar)

1. N-SEO1 y N-SEO2: miga visible con enlace a `/precios/` en `pie()` (`generar_paginas.js`). Test en `tests/js/marcado.test.js`. 2. N-UX1 (tope de ancho del chip del historial), N-UX2 (tabla con foco) y N-UX3 (`--bad-soft`). 3. N-SEO3, **previa verificacion** de los 13 pares. 4. N-TIPO1, N-DS1, N-A11Y1: un PR de diseño aparte, con capturas antes y despues. 5. N-SEO4 (hubs por rubro): solo cuando haya trafico que lo pida.

- **Terminado cuando**: axe sigue en 0; e2e de diseño en verde; `/medir-indice` sin cambios en titulos ni categorias.

### F9. Indice partido por categoria (solo si hace falta)

No se hace por las dudas. Se hace **solo si**, despues de F1 y F7, el rendimiento movil de `/?q=` sigue bajo 90 o el indice comprimido pasa de 2 MB. Es el cambio mas grande de la app (buscador, service worker, ofertas) y necesita spec propia.

### F10. Semana de calma

Nada nuevo, solo corregir. **Terminado cuando**: CI verde 14 dias seguidos; 0 hallazgos altos abiertos; issues #1 a #9 del repo privado cerrados o explicados.

## 4. Observabilidad (lo que ya hay y lo que falta)

Ya hay: Sentry (errores del navegador), `salud.json`, `/estado/`, aviso privado por Telegram (spec 061), guardia del indice, y el vigia cada 5 minutos (portada, `/hoy/`, una ficha, frescura del indice).

Falta, y esta en las fases: KV del vigia y logs del Worker (F3), humo despues de publicar (F5), vencimiento del certificado (F7). S3 (el sourcemap de Sentry que choca con la CSP) va con cualquier PR que toque `sitio.json`.

Leccion de C2: una alarma que vive dentro de lo que se rompe no avisa. El unico vigilante **de afuera** es el vigia; por eso el KV y su frescura van antes que Cloudflare.

## 5. Costos mensuales (USD)

| Item | Hoy | Con el plan | Limite gratis que importa (fuente al pie) |
|---|---|---|---|
| GitHub Pages + Actions (repo publico) | 0 | 0 | sitio 1 GB; 100 GB de trafico por mes (blando) |
| Dominio `.com.ar` | cuota anual de NIC Argentina | igual | |
| Cloudflare Free (DNS, proxy, reglas, Turnstile) | 0 | 0 | |
| Workers Free | 0 | 0 | 100.000 pedidos/dia, 10 ms de CPU, 50 subpedidos por pedido, 5 cron. El vigia gasta 288 por dia |
| KV | 0 | 0 | 100.000 lecturas y **1.000 escrituras por dia**: el vigia escribe solo cuando algo cambia |
| R2 (copias) | no se usa | 0 | 10 GB; **pide tarjeta** |
| Resend | 0 | 0 | 3.000 por mes y 100 por dia |
| Sentry (plan gratis) | 0 | 0 | |
| DeepSeek (delegacion) | saldo chico cargado | igual | solo cuando el dueño lo pide |
| **Total fijo** | **0** | **0** | |

Lo unico que podria costar: Workers Paid (USD 5/mes) si el buscador de "afuera" pasa los 100.000 pedidos por dia. Hoy esta muy lejos. Gasto unico previsto: Google Play, USD 25 (bloqueado, seccion 8).

## 6. E2E con Playwright

Ya hay 22 pruebas. Se suman, cada una en la fase que la necesita: indice pedido temprano (F1), contrato del Worker (F5), "datos feos" como `tests/e2e/datos-feos.spec.js` y axe con `@axe-core/playwright` en las 11 rutas (F8). Criterio: suite completa en verde 3 corridas seguidas **sin** `retries`.

## 7. IA y modelos: LiteLLM contra las alternativas

El sitio **no llama a ningun modelo**. Esto es solo para delegar borradores y como colchon cuando se agota el limite. Lo gratis va por defecto; nada pago sin pedido del dueño.

| Opcion | Costo | Tope de gasto | Respaldo | Veredicto |
|---|---|---|---|---|
| **LiteLLM** (actual, `127.0.0.1:4000`) | Gratis, autoalojado | Presupuesto por clave en el YAML | Cadenas de respaldo (ya hay NVIDIA -> OpenRouter) | **Se queda.** Ya anda y los scripts lo usan |
| **OmniRoute** (MIT, ~87 mil estrellas, v3.8.53 del 06/11/2026; el repo ahora es `cheaper-inference/OmniRoute`) | Gratis, autoalojado (npm o Docker) | Tope en USD por clave | Respaldo automatico por cuota | **No ahora.** Hace lo mismo con mas funciones: otra pieza que mantener sin un problema que resolver. Reevaluar solo si LiteLLM falla |
| **OpenRouter directo** | Sin recargo por inferencia | Limite de credito de la cuenta | Propio del servicio | **Sigue como respaldo dentro de LiteLLM.** Gratis: 20 pedidos/min y 50/dia; 1.000/dia solo con USD 10 comprados. No comprar sin pedido |
| **Cloudflare AI Gateway** | Nucleo gratis (analitica, cache, limite de tasa); 5 % sobre creditos de facturacion unificada | Limites de tasa; 100.000 logs en plan Free | Reintentos y respaldo | **No aplica**: sirve para apps que llaman modelos en produccion |
| **Portkey** | Nube gratis: 10.000 registros/mes, 3 dias de logs; Production USD 49/mes | Presupuestos solo en Enterprise | Incluido | **Descartado**: duplica a LiteLLM |

Recomendacion: **quedarse con LiteLLM y no sumar nada**. Dos cuidados:

1. **Fijar la version instalada.** El 24/03/2026 las versiones 1.82.7 y 1.82.8 de `litellm` en PyPI salieron con codigo malicioso que robaba credenciales; estuvieron publicadas unas horas. El proxy tiene las claves de NVIDIA, OpenRouter y DeepSeek. Se actualiza a mano, a una version elegida, nunca con un `pip install -U` suelto.
2. `max_budget` en la clave de DeepSeek y mirar el saldo antes de una corrida larga.

Recordatorio medido (memoria del 12/11): delegar a modelos gratis fallo 3 de 4 veces. Sirven para borradores y cambios mecanicos de 1 o 2 archivos; nunca para datos, diseño ni codigo de produccion sin revision linea por linea.

## 8. PENDIENTES que cuestan plata: BLOQUEADOS hasta que la app este a prueba de balas

| Pendiente | Costo | Estado |
|---|---|---|
| Cuenta de desarrollador de **Google Play** | USD 25 (unico) | **Bloqueado.** No se paga hasta cumplir los 7 criterios |
| 12 probadores para la prueba cerrada (14 dias) | 0 (hay que conseguirlos) | Bloqueado por lo anterior |
| Workers Paid | USD 5/mes | Solo si el buscador pasa 100.000 pedidos/dia |
| Apple Developer (iOS) | USD 99/año | Solo con el gatillo del plan v4 (1.000 instalaciones o 300 alertas) |

**Los 7 criterios de desbloqueo de Google Play** (todos juntos, medidos y anotados en `docs/`):

1. CI en verde **14 dias seguidos** (`Tests` y `Actualizar precios y publicar`), sin rojas por causa propia. *Hoy: el contador arranca de cero el 13/11 por C2.*
2. **0 hallazgos de severidad alta abiertos** en la auditoria. *Hoy: S1 cerrado; quedan D1 a D5 y C2.*
3. Lighthouse movil **>= 95 en rendimiento** y 100 en las otras tres, en `/` y `/?q=ssd%201tb`, mediana de 3. *Hoy: la portada da 87-89 en la CI.*
4. Vigia con **KV activo** y una alarma de prueba recibida.
5. `main` **protegida**. *Cumplido el 13/11.*
6. **Copia restaurada** con exito al menos una vez (F6).
7. Issues #1 a #9 del repo privado cerrados o explicados con causa ajena.

Cuando se cumplan, Claude avisa "criterio de Play cumplido" con los 7 numeros. Antes, no se paga nada.

## 9. AliExpress (solicitud de desarrollador RECHAZADA el 13/11)

- Que paso: rechazada en el formulario de **cumplimiento de datos**. El rechazo no traia el motivo.
- La reenvia **el dueño a mano**: Claude no completa formularios de cuentas. Respuestas recomendadas:
  1. Datos tratados por terceros: **Yes** (Cloudflare; el Worker corre ahi).
  2. Transferencia de datos al exterior: **Yes**.
  3. Uso de los datos de AliExpress para fines propios, ademas de prestar el servicio: **No**.
  4. Conservar los datos despues de terminar el servicio: **No**.
  - "Location of data processing": **red global de Cloudflare (Workers), sin servidores propios**. El Worker no guarda datos de AliExpress: reenvia el resultado de la busqueda y lo tiene unos segundos en memoria.
- Antes de reenviar: releer `worker/src/fuentes/aliexpress.js` y confirmar que sigue sin guardar nada.
- Si la rechazan de nuevo: pedir el motivo exacto por el soporte de AliExpress Open Platform y anotarlo aca. No bloquea ninguna fase: es una fuente opcional.

## 10. Pendientes en vivo (13/11)

Issues del repo privado `la-pichincha-correo`: #9 permisos nuevos de la GitHub App «Claude» (decide el dueño); #8 Smartphones y PCs sin ofertas; #7, #6 y #5 CI de PRs del 11 y 12/11 (N-T1 y la portada en 87-89: los ataca F1); #4 404 de Search Console (el sitemap actual da 200 en las 200: probable dato viejo); #3 y #2 FullH4rd y Katech en 0; #1 traspaso.

Otros: Black Friday 20/11, reel (espera el OK), AAIP antes de juntar correos, `INSTAGRAM_TOKEN` vence ~22/12.

## 11. Decisiones que le tocan al dueño

1. **KV del vigia**: un comando (F3).
2. **Token de GitHub para que el Worker dispare la corrida** (F3): credencial nueva. Si no, los precios siguen saliendo a media mañana.
3. **Turnstile**: crear el widget (F5).
4. **Copias**: solo la PC, o tambien R2 con tarjeta cargada (F6).
5. **Proxy de Cloudflare**: prender el interruptor cuando llegue F7.
6. `CLAUDE_CODE_OAUTH_TOKEN`: si `ARREGLO_CLAUDE` no se va a prender, borrarlo.
7. Reenviar AliExpress.
8. Pagar Google Play **solo** cuando Claude avise que se cumplieron los 7 criterios.

## 12. Como ejecutar este plan sin cortarse

**Orden de PRs** (chicos, uno por tema; ninguno toca los mismos archivos que el anterior sin mergear):

| # | PR | Fase | Toca |
|---|---|---|---|
| 1 | Clave repetida del workflow | F0 | `actualizar.yml` |
| 2 | `actionlint` + test de claves repetidas | F0 | `tests.yml`, `tests/` |
| 3 | Telegram no sale con alarma ni con indexado fallido (D5) + W9 | F0 | `actualizar.yml`, `avisar_dueno.py` |
| 4 | `defer` + indice temprano con `?q=` | F1 | `index.html`, `js/indice-ofertas.js` |
| 5 | N-T1: `page.clock` y sin `retries` | F1 | `tests/e2e/`, `playwright.config.js` |
| 6 a 9 | D3, D1, D2, D4 (uno cada uno) | F2 | `filtrar_indice.py`, `indexar.py`, `actualizar.yml` |
| 10 | KV + observability + `HORA_MINIMA` | F3 | `worker/` |
| 11 | El Worker dispara la corrida (si hay token) | F3 | `worker/` |
| 12 a 14 | D6-D10, D11, D13-D14 | F4 | pipeline de Python |
| 15 a 18 | Turnstile, limite en `/buscar`, humo y rollback, Dependabot y permisos | F5 | `worker/`, workflows |
| 19 | N-CI1 (antes de `ARREGLO_CLAUDE`) | F5 | `arreglar-con-claude.yml` |
| 20+ | F6 a F8 | | |

**Reglas para que no se corte:**

1. **Al empezar**: leer `privado/continuidad.md` (carpeta principal `C:\Users\Usuario\Downloads\RAM COTIZACIONES`; no se commitea y no lleva secretos) y los issues abiertos del repo privado de correo.
2. **Un PR, un worktree.** Rama nueva desde `origin/main`. Primer commit: el test que falla. Despues, commits chicos por bloque. Mensajes sin tildes ni eñes.
3. **Despues de cada bloque**, tres lineas en `privado/continuidad.md`: que PR esta abierto, que falta, que comando sigue. Si la sesion se corta, la siguiente arranca de ahi sin rehacer nada.
4. **Lo mecanico va a subagentes en segundo plano** (correr las suites, medir Lighthouse 3 veces, capturas antes y despues, buscar todos los usos de una funcion). La sesion principal lee solo el resumen y verifica lo importante con el codigo real. Nunca dos escribiendo los mismos archivos.
5. **Lo que espera** (la CI, una corrida) se espera con `gh pr checks N --watch` sin tuberia, en segundo plano, y mientras tanto se avanza con el PR siguiente que no dependa de ese.
6. **Antes de mergear algo que publica**: leer los avisos de correo (regla fija del repo) y, si toca ofertas, categorias o titulos, correr `/medir-indice`.
7. **Cierre de cada PR**: CI en verde en los tres checks -> `gh pr merge N --rebase` -> borrar worktree y ramas -> `git pull --ff-only` -> corrida manual con `indexar=true` si el cambio toca datos -> verificar en el sitio.
8. **Una orden dada no se frena con una pregunta.** Si algo bloquea una parte, se hace lo seguro, se busca otro camino en el mismo turno y se anota que quedo. Solo se consulta plata, cuentas, normativa o lo irreversible: es la lista de la seccion 11.
9. **No se cierra a medias**: o esta hecho y medido, o queda escrito en `privado/continuidad.md` que falta y quien lo sigue.

## Fuentes (consultadas el 13/11/2026)

- GitHub Pages, limites: <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>
- Workers, limites: <https://developers.cloudflare.com/workers/platform/limits/>
- KV, limites: <https://developers.cloudflare.com/kv/platform/limits/>
- R2, precios: <https://developers.cloudflare.com/r2/pricing/>; que pide tarjeta: <https://community.cloudflare.com/t/why-using-r2-free-tier-involves-giving-card-info/945179> (foro, no documentacion oficial)
- Limite nativo de Workers (10 o 60 s, por ubicacion, aproximado): <https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>
- Que cachea Cloudflare por defecto: <https://developers.cloudflare.com/cache/concepts/default-cache-behavior/>
- Cloudflare AI Gateway, precios: <https://developers.cloudflare.com/ai-gateway/reference/pricing/>
- OpenRouter, limites: <https://openrouter.ai/docs/api-reference/limits>
- OmniRoute: <https://github.com/cheaper-inference/OmniRoute>
- Portkey, precios: <https://portkey.ai/pricing>
- LiteLLM, incidente de marzo de 2026: <https://docs.litellm.ai/blog/security-update-march-2026>

No se releyo hoy (dato de la memoria del proyecto): limites de Resend y de Sentry, y el comportamiento del certificado de GitHub Pages detras del proxy de Cloudflare (se prueba en F7 antes de dar nada por hecho).
