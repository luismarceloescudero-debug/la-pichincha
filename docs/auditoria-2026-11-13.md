# Auditoria completa de La Pichincha — 13/11/2026

Estado: EN CURSO. Bloque 1 cargado (codigo: seguridad y fallas silenciosas, CI y repo, rendimiento). Faltan E2E, accesibilidad, diseno y mercado.

Base ya medida (traspaso de la sesion anterior): tests JS 818/818 y Python 744 OK (3 salteados); sitemap 200 URLs todas 200;
indice.json 6,69 MB crudo / 1,35 MB gzip; Lighthouse movil en `/`: Accesibilidad 100, Buenas practicas 100, SEO 100.
Auditorias previas (no se repiten): `docs/auditorias/2026-11-10.md`, `2026-11-11.md`, `2026-11-12-pre-tiendas.md`, `2026-11-13-ux-ofertas.md`.

## Como leer esto

Cada hallazgo tiene: **ID**, severidad, **donde** (archivo:linea, leido en el codigo real), **evidencia** y **arreglo**.
Los de codigo los encontraron dos agentes de revision (`ecc:security-reviewer` y `ecc:silent-failure-hunter`) y
**yo verifique los mas graves leyendo la linea citada** (D1, D3, D5, D6, D14, W1, W4, W9 y W8 confirmados tal cual).
Los de CI y repo salen de `gh` en vivo el 13/11.

## Resumen por severidad

| Sev. | Cant. | Los mas importantes |
|---|---|---|
| Alta | 6 | S1 `main` sin proteccion; D1 tienda con caida parcial se publica recortada; D2 umbral ciego sin historial; D3 sin tope de borrado en `filtrar_indice`; D4 se publica con indice viejo si `indexar` falla; D5 Telegram postea con indice viejo |
| Media | 13 | W1-W3 limites del Worker por isolate y acuse de correo reutilizable; D6-D14 errores tragados en ML, vendidos, fichas, historial, `actualizar.py` |
| Baja | 14 | redirects del Worker, `/vigia` publico, log de avisos, CSP, `workers_dev`, escrituras no atomicas |

El agente de seguridad **no encontro nada alto** en el Worker, `pagina.js`, `errores.js` ni los scripts de Telegram. Los altos son de **datos** (el pipeline puede publicar mal sin avisar) y de **repo** (rama sin proteger).

## Seguridad

| ID | Sev. | Donde | Evidencia | Arreglo |
|---|---|---|---|---|
| S1 | Alta (CERRADO 13/11) | Repo GitHub, rama `main` | Estaba sin proteccion (`.../protection` = 404). Ruleset `proteger-main` creado el 13/11: sin borrado ni force-push, check `tests` obligatorio, bypass solo admin. El push del bot a `main` (`actualizar.yml:115`) paso a `continue-on-error` porque GitHub no deja a Actions como excepcion | Hecho; verificar con `gh api repos/.../rules/branches/main` |
| W1 | Media | `worker/src/index.js:238-240`, `:243` | `espera` la manda el cliente; el tope de 5 mensajes/10 min vive en memoria del isolate | Rate Limiting nativo de Cloudflare + Turnstile en `/contacto/`; firmar la hora de carga |
| W2 | Media | `index.js:259-267`, `:101-102` | El acuse sale al correo que escribe el usuario; tope 1/hora por direccion y por isolate, se evade con `victima+a@` | Acuse detras de Turnstile, normalizar `+tag`, tope global diario (Resend 100/dia) |
| W3 | Media | `index.js:117-122`, `:168-176` | `if (mapa.size > 5000) mapa.clear()` vacia el limite de todos; cada `q` nuevo dispara hasta 4 pedidos a eBay/AliExpress/Amazon/Tiendamia | Rate limiting nativo, agrupar IPv6 por /64, tope diario por fuente, coalescer consultas iguales |
| W4 | Baja | `index.js:129-134` | `fetch` sigue redirects y `paginaPermitida(r.url)` se mira despues de que el pedido salio | `redirect: "manual"` y validar `Location` |
| W5 | Baja | `index.js:178-179` | `/buscar` devuelve `motivo` por fuente (ej. "HTTP 401"): revela que APIs tienen credenciales y si estan rotas | Devolver solo `ok` y loguear el motivo |
| W6 | Baja | `index.js:276-295` | `/vigia` sin autenticacion; cache de 30 s por isolate | Header secreto o `caches.default` |
| W7 | Baja | `index.js:34` | `ORIGEN_OK` acepta cualquier puerto de `localhost`; no incluye `www.` | Sacar `localhost` en produccion |
| W8 | Baja | `worker/wrangler.toml:8` | `workers_dev = true`; el subdominio `...mescudero-remitos-internos.workers.dev` esta en la CSP publica y delata otro proyecto | `workers_dev = false` y ruta con dominio propio |
| W9 | Baja | `avisar_dueno.py:125-126` | Sin `TELEGRAM_CHAT_DUENO` imprime el texto del aviso en el log de Actions (repo publico) | Imprimir solo "aviso no enviado" |
| W10 | Baja | `avisar_dueno.py:112-113` | Recorta el HTML en un salto de linea; puede dejar una etiqueta sin cerrar y Telegram rechaza el aviso en silencio | Cortar por bloques completos |
| S2 | Baja | `sitio.json:15` (CSP por `<meta>`) | `script-src 'unsafe-inline'`; `frame-ancestors` no aplica en meta. Aceptado en `docs/seguridad-zap.md` | Hashes por build, o Cloudflare delante para cabeceras reales |
| S3 | Baja | CSP vs `browser.sentry-cdn.com` | (traspaso) `connect-src` bloquea `.../11.8.0/bundle.min.js.map`: error de consola en produccion | Sumar el origen a `connect-src` o no pedir el map |
| S4 | Info | Actions | 16 secretos cargados; `CLAUDE_CODE_OAUTH_TOKEN` cargado con `ARREGLO_CLAUDE` apagado. Ningun secreto en archivos rastreados | Si no se usa el arreglo automatico, borrar el token |

Sin hallazgo (verificado por el agente): inyeccion de cabeceras de correo, construccion de URLs salientes, escape HTML en Telegram, token del vigia, cabeceras de las respuestas JSON, `errores.js` (SRI, borra `?q=`).

## Datos (fallas silenciosas del pipeline)

| ID | Sev. | Donde | Evidencia | Que pasa en produccion | Arreglo |
|---|---|---|---|---|---|
| D1 | Alta | `indexar.py:1124-1127`, `salud.py:35` | Si la fuente trae >0 items, `relevados[clave] = len(items)` y se descartan los del `previo`; `salud` solo marca "baja", no frena | Una tienda que trae 10 % del catalogo publica ese 10 %; el aviso sale pero el sitio ya se publico | Si `ahora < umbral*previo`, mezclar con `previo` o cortar con `exit != 0` antes de escribir |
| D2 | Alta | `indexar.py:1018-1019`, `:1042`; `salud.py:35` | Sin historial `vivos` queda vacio, `previo = 0`, la rama "baja" no se activa | Si falla el checkout de la rama `historial`, una tienda con 10 productos figura "ok" | Calcular `vivos` tambien desde el indice anterior |
| D3 | Alta | `filtrar_indice.py:38-42`; usado en `actualizar.yml:200` y `:252` | `filtrar(datos, caidas)` borra todo lo listado, sin tope | Una tienda en mantenimiento que da 404 en masa se borra entera, sin aviso | Abortar si se saca >5 % del indice o >30 % de una tienda |
| D4 | Alta | `actualizar.yml:149` (`continue-on-error`), `:128-129`, `:209-214` | Entre `indexar` y "Preparar el sitio" no hay `if`; solo `::warning::` si falta `indice.json` | Se republica el indice viejo sin decirlo; si cambio la clave de cache y es un push, el buscador queda vacio | En push sin indice previo, `exit 1`; cartel "precios de hace X h" en el sitio |
| D5 | Alta | `actualizar.yml:410-419` | El `if` solo mira `github.event_name`, no `steps.indexar.outcome` | Con `indexar` en failure se postean al canal publico ofertas del indice viejo (irreversible) | Sumar `&& steps.indexar.outcome != 'failure'` |
| D6 | Media | `mercadolibre.py:136-137` | `except (URLError, OSError, ValueError): return []`; `HTTPError` hereda de `URLError` | Un 401 (token vencido) o 5xx hace desaparecer productos sin rastro | Contar fallos, levantar si pasan 20 %, loguear `e.code` |
| D7 | Media | `mercadolibre.py:148-151` | `if e.code != 400: raise; break` | Un 400 por cambio de la API recorta el rubro en silencio | Avisar y sumar a `notas` |
| D8 | Media | `indexar.py:1116-1118` | `except Exception` + `print`, `puestos = {}` | El orden "mas vendido" se degrada sin senal | Registrar `vendido_falla` en `notas` y `salud.json` |
| D9 | Media | `indexar.py:889-891` | 404/OSError hacen `continue` sin contar | Si la tienda cae a mitad, los SKU no se completan y no hay senal | `resumen["errores"]` |
| D10 | Media | `indexar.py:953-955`, `:839`, `:853` | `unlink(missing_ok=True)` y devolver vacio sin log | Se pierde la foto de comparacion; las bajas en seguimiento no se calculan | Loguear |
| D11 | Media | `historial.py:74-78`, `:33-41` | Append directo al CSV, sin atomicidad ni validar filas | Una fila truncada se lee como "dejo de publicarse" o da `KeyError` y rompe corridas siguientes | `archivos.escribir_atomico` y validar filas |
| D12 | Media | `actualizar.yml:154-168`, `:323-336` | Push del historial con `continue-on-error`; el de fiabilidad sin `pull --rebase` | Se pierde el dia de historial y se calculan mal las bajas | Reintentar y avisar |
| D13 | Media | `actualizar.py:362-365`, `:389` | `return 0` incondicional con productos en error | Precios del podio viejos por semanas sin alarma | Salir con codigo != 0 o abrir issue con N errores |
| D14 | Media | `actualizar.py:384` | Se descarta el resultado de `construir()` | `datos.json` nuevo y HTML viejo, sale con 0 | `return 0 if construir(...) else 1` |
| D15 | Baja | `actualizar.py:166`, `:70-71` | No atrapa `socket.timeout` / `IncompleteRead` | Un timeout tumba toda la corrida | Capturar `OSError` y `HTTPException` |
| D16 | Baja | `actualizar.py:382`, `:326-328` | Escrituras no atomicas de `datos.json` e `index.html` | Un corte deja el archivo truncado y se commitea | `archivos.escribir_atomico` (ya existe) |
| D17 | Baja | `indexar.py:1202-1216` | Historial se escribe antes de publicar el indice | Si algo falla despues, el historial tiene precios no publicados | Escribir al final |
| D18 | Baja | `actualizar.yml:184-201`, `:281-296` | Verificacion de ofertas con `continue-on-error` | Si Chrome cae, ofertas sin chequeo de enlace | Marcar "sin verificar" y avisar |

Lo bien hecho: los fallbacks a `previo` ante 0 productos (`indexar.py:1082-1106`) y `archivos.escribir_atomico` (fsync + `os.replace`).

## CI y repo (en vivo, 13/11)

- Ultimas corridas de `actualizar.yml` (schedule y push): en verde; una `cancelled` el 12/11 19:57 (pushes solapados, esperable). `Tests` de PR del 13/11: verde.
- Issues abiertos en `la-pichincha-correo` (#1-#9). Accionables: #5/#6/#7 (Lighthouse, e2e y enlaces en PRs del 11-12/11), #3 y #2 (FullH4rd y Katech en 0), #8 (Smartphones y PCs sin ofertas), #4 (404 de Search Console vs sitemap actual 200/200: probable dato viejo), #9 (permisos de la GitHub App).
- S1: `main` sin proteccion.
- C1 (Media): `actualizar.yml:14-15` programa una corrida **diaria** (03:23 y 05:47 UTC) y GitHub la atrasa: el 13/11 las corridas `schedule` arrancaron 11:07 y 13:27 UTC (7-8 h tarde). Los precios del dia pueden publicarse a media manana. Arreglo: disparar `workflow_dispatch` desde el Cron del Worker (cada 5 min, no se atrasa) y dejar el cron de GitHub de respaldo; el vigia mide frescura contra 30 h.
- Docker Desktop: no levanta el motor (`npipe dockerDesktopLinuxEngine` inexistente); se intento abrirlo el 13/11, ver resultado en `docs/prueba-de-skills.md` (Strix).

## Rendimiento (medido con Chrome DevTools, movil emulado, CPU 4x + Fast 4G, cache ignorada)

| Pagina | LCP | TTFB | Render delay | CLS |
|---|---|---|---|---|
| `/` | 1.977 ms | 39 ms | 1.938 ms | 0,00 |
| `/?q=ssd%201tb` | 1.909 ms | 45 ms | 1.864 ms | 0,00 |

Lectura simple: el servidor contesta al toque (39-45 ms) pero el elemento mas grande se pinta casi 2 s despues. **El 98 % del LCP es "render delay"**: el navegador espera scripts y datos antes de pintar. Con un celular barato, el indice de 6,7 MB (1,35 MB comprimido) se baja y procesa antes de mostrar. Esta por debajo del umbral "bueno" (2,5 s) pero con poco margen; si el indice sigue creciendo, se pasa.
- P1 (Media): LCP casi todo render delay. Arreglo: pintar la portada con HTML ya armado en el build (sin esperar el indice) y cargar el indice despues; partir `indice.json` por categoria.
- P2 (Baja): CLS 0 en las dos. Bien.
- Pendiente de medir: Lighthouse de rendimiento "oficial" (el de DevTools MCP excluye performance) y escritorio.

## UX y diseno
Recorrido real con Playwright en el sitio armado en local (indice de prueba), movil 375x812 y escritorio 1366x768, 11 rutas cada uno,
con "datos feos" en la busqueda: 60 repeticiones de una palabra con enie y tilde, 30 emojis, `<script>alert(1)</script>` y una busqueda sin resultados.
- Sin scroll horizontal en ninguna de las 22 combinaciones. El `<script>` de la busqueda no se refleja en la pagina (sin XSS).
- U1 (Baja): con busquedas muy largas o de emojis el navegador registra un `400` en un pedido (esperable: validacion de largo). Conviene verificar que el usuario vea un mensaje y no una lista vacia muda. Arreglo: texto "Esa busqueda es demasiado larga" si el pedido da 400.
- Las auditorias de diseno ya hechas (`docs/auditorias/2026-11-13-ux-ofertas.md`, A3/A10 mergeados) no se repiten. Las skills de diseno (impeccable, design-debt-audit, critique-visual-hierarchy, design-token-audit, ux-audit completo) **no se corrieron** en esta pasada: ver `docs/prueba-de-skills.md`.

## Accesibilidad
- axe-core 4.10.2 sobre las mismas 22 combinaciones: **0 violaciones** en todas. Lighthouse movil en `/` (produccion): 100 (traspaso).
- No hay hallazgos de accesibilidad abiertos. Falta una prueba con lector de pantalla real (manual).

## SEO
- Produccion: la portada trae 1 bloque JSON-LD, `canonical` a la raiz y `title` propio; sitemap 200 URLs todas 200; robots, security.txt, assetlinks, manifest y sw en 200; Lighthouse SEO 100.
- E1 (Info): `/?q=...` cambia el titulo solo en el navegador (el HTML estatico trae el titulo generico y canonical a `/`): las busquedas no compiten como paginas propias, lo cual es correcto. El SEO de cola larga vive en las paginas generadas (`/precios/...`).
- E2 (Baja): `Cache-Control: max-age=600` en todo (lo fija GitHub Pages); `indice.json` baja 1,35 MB comprimido en cada visita nueva. Arreglo estructural en el plan (Cloudflare delante con cache largo y purga al publicar).
- No se corrieron seo-audit, schema ni site-architecture completos (ver `docs/prueba-de-skills.md`).

## Pruebas
- JS 818/818 verde (4,4 s); Python 744 OK, 3 salteados (22 s) (traspaso).
- E2E Playwright local (`bash tests/e2e/armar-sitio.sh` + `npx playwright test --workers=1`, 13/11): **primera vuelta 14 de 22, segunda 22 de 22**; los 8 que fallaron la primera vez pasan sueltos y en la repeticion. T1 (Media): **hay pruebas intermitentes** (arranque en frio del servidor o del navegador); coincide con los issues #5/#6 del repo privado. Arreglo: `retries: 1` ya esta en CI; sumar espera explicita a que el servidor responda antes de abrir el navegador y guardar el trace de los fallos como artefacto.
- T2 (Baja): en local, cada pagina registra un error de consola `Connecting to 'https://fonts.googleapis.com/...'` (CSP `connect-src`); en produccion la portada con `?q=` salio sin errores de consola el 13/11. Revisar si el CSS de la fuente se pide por `fetch` en alguna ruta.

## ZAP en local (13/11, Docker, solo contra el sitio armado en `localhost`)

`zap-baseline.py` (pasivo) de `ghcr.io/zaproxy/zaproxy:stable` contra `tests/e2e/armar-sitio.sh` servido en local. Nunca contra produccion ni terceros.
12 alertas: 7 medias (CSP sin fallback, comodin, `unsafe-inline` en script y estilo, sin cabecera anti-clickjacking, SRI faltante, sin token anti-CSRF), 2 bajas, 3 informativas.
**Son las mismas familias del analisis del 19/10** (`docs/seguridad-zap.md`): CSP por `<meta>` y cabeceras que GitHub Pages no deja poner (S2, y se resuelven con Cloudflare delante, fase F4). Unica diferencia: "sin token anti-CSRF" en el formulario de contacto: no aplica, porque el formulario no usa cookies ni sesion; el freno real es W1/W2 (limites y Turnstile). Ninguna alerta nueva exige arreglo propio.

## Costos
Se completa en `docs/plan-definitivo.md`, seccion 8.
