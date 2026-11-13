# Plan definitivo de escalado — La Pichincha

Fecha: 13/11/2026. Version 2 (integra la segunda tanda de skills). Se apoya en `docs/auditoria-2026-11-13.md` (los IDs S1, D1, W1... son de ahi) y reemplaza como "orden de ejecucion" al plan v4 (`docs/plan-v4-tiendas-de-apps.md`), que sigue vigente para el detalle de la app Android.

Objetivo en una frase: que el sitio **no pueda publicar datos malos sin que alguien se entere, no se caiga si se cae una pieza, y aguante 10 veces mas visitas** sin gastar plata antes de tiempo.

## 0. Donde estamos (medido)

- Sitio estatico en GitHub Pages (`pichinchadeldia.com.ar`), 200 URLs en el sitemap, todas 200. Tests: JS 818/818, Python 744 OK. Lighthouse movil en `/`: Accesibilidad 100, Buenas practicas 100, SEO 100. axe: 0 violaciones en 22 combinaciones.
- Los datos se arman en GitHub Actions (`actualizar.yml`, cron), el indice (`indice.json`, 6,7 MB / 1,35 MB comprimido) se publica con el sitio. Un Worker de Cloudflare hace de "afuera" (buscar en eBay/AliExpress/Amazon/Tiendamia, contacto por correo, vigia).
- LCP movil lento-emulado: 1,98 s en `/` y 1,91 s en `/?q=` (98 % render delay, CLS 0), **pero mide solo el cascaron**: hay 28 scripts sincronos y el indice se pide a ~7,8 s (N-CAL1); la espera real es de ~10 s en un celular lento.
- Lo grave: `main` sin proteccion (S1) y **cinco formas de publicar datos malos en silencio** (D1-D5).

## 1. Arquitectura

Hoy: `GitHub Actions (cron) -> indexar.py -> indice.json -> GitHub Pages` + `Worker (Cloudflare)` aparte.

Decision: **no migrar de plataforma**. GitHub Pages anda y es gratis; el problema no es donde vive el sitio sino que no hay red de seguridad entre "se armo el indice" y "se publico". Lo que se agrega:

1. **Cloudflare delante del dominio** (plan Free, DNS proxied). Da: cabeceras reales (HSTS, `frame-ancestors`, CSP sin `unsafe-inline` con hashes), cache largo para `indice.json` (hoy `max-age=600` fijo de GitHub), compresion Brotli, WAF basico, y rate limiting por ruta. Es el cambio de mayor retorno. Riesgo: mal configurado puede cachear una version vieja; se mitiga con purga en el ultimo paso del workflow.
2. **Compuerta de publicacion** (`verificar_indice.py`, nuevo): antes de "Preparar el sitio" compara el indice nuevo contra el anterior y **corta** si una tienda cae mas de X %, si el total baja mas de Y %, si faltan campos o si pesa fuera de rango. Corta = el sitio queda con el ultimo indice bueno y se avisa por Telegram privado. Cubre D1-D5.
3. **Worker con limites nativos y Turnstile** (cubre W1-W3) y `workers_dev = false` (W8).
4. **Indice partido por categoria** (P1): la portada deja de esperar 1,35 MB para pintar. `indice.json` completo queda para el buscador, cargado despues.

No se recomienda ahora: base de datos relacional, Next.js, servidores propios. El volumen (miles de productos, una corrida cada pocas horas) no lo justifica.

## 2. Base de datos y backups

Hoy la "base" son archivos en el repo y en la rama `historial` (CSV de precios, `salud.json`, fichas). No hay copia fuera de GitHub.

- **Backup**: un job semanal (`backup.yml`) que empaqueta rama `historial` + `datos/` + `tiendas.json` + `sitio.json` y lo sube a **Cloudflare R2** (10 GB gratis, sin cobro de salida). Se conservan 8 copias. Sin secretos en el archivo.
- **Prueba de restauracion**: un script `restaurar_prueba.py` baja la ultima copia a una carpeta temporal, corre `indexar.py --solo-lectura` y compara conteos. Se corre a mano la primera vez y despues una vez al mes en el workflow.
- **Historial robusto** (D11, D12, D17): escritura atomica, validar filas al leer, reintento y aviso si falla el push.
- Cuando el historial pase de ~50 MB o haga falta consultarlo desde el Worker: **Cloudflare D1** (SQLite, plan Free con 5 GB). Hasta entonces, CSV.

## 3. Observabilidad

Ya hay: Sentry (errores del navegador, proyecto `la-pichincha`), `salud.json`, `/estado/`, aviso privado por Telegram (spec 061), vigia (spec 064, Cron del Worker cada 5 min).

Falta y se hace:
- **KV del vigia** (`npx wrangler kv namespace create VIGIA_KV`, pegar el id, descomentar el binding): sin KV, el vigia repite avisos y pierde memoria entre isolates. Es una accion del dueño (1 comando).
- `[observability] enabled = true` en `wrangler.toml` del Worker (logs de Workers, plan Free alcanza).
- Alarma de **frescura**: si `indice.json` publicado tiene mas de 30 h, el vigia avisa. Hoy el cron de `actualizar.yml` corre **una vez por dia** (03:23 UTC, respaldo 05:47) y GitHub lo atrasa hasta ~8 h (el 13/11 las corridas programadas arrancaron 11:07 y 13:27 UTC), asi que 8 h daria falsas alarmas. Mejor: disparar la corrida desde el Cron del Worker (`workflow_dispatch` por API, que no se atrasa) y dejar el cron de GitHub de respaldo.
- Arreglar el error de CSP del sourcemap de Sentry (S3) para que la consola de produccion quede limpia.
- Panel unico: `/estado/` ya existe; sumarle "ultima corrida OK", "tiendas en baja" y "backup mas reciente".

## 4. CI/CD

- **Proteger `main`** (S1): ruleset que exija PR y el check `Tests`; sin force-push; el workflow de publicacion hace su commit con una excepcion explicita (bot). Sin esto, todo lo demas es decorativo.
- **Compuerta de publicacion** (arriba) como paso obligatorio de `actualizar.yml`; `continue-on-error` solo en lo que de verdad es opcional (D4, D18).
- Telegram solo si `steps.indexar.outcome == 'success'` y la compuerta paso (D5).
- Arreglar la intermitencia de pruebas (T1): E2E con espera a que responda el servidor, subir traces como artefacto y que `Tests` exija verde **dos veces seguidas** antes de mergear a main durante la semana de estabilizacion.
- Dependabot o Renovate para `package.json` y acciones de GitHub (gratis).
- Despliegue del Worker (`worker.yml`) con prueba de humo posterior (`curl /health`) y rollback con `wrangler rollback`.

## 5. E2E con Playwright

Ya existen 22 pruebas (portada, buscador, ofertas, paginas, contacto, sin conexion, diseno). Se suma:
- Recorrido "datos feos" (busquedas largas, emojis, `<script>`, sin resultados): hoy es un script suelto; pasa a `tests/e2e/datos-feos.spec.js`, en movil y escritorio.
- axe como prueba (`@axe-core/playwright`) en las 11 rutas: falla con cualquier violacion seria.
- Prueba de **frescura**: la portada muestra la hora del ultimo precio y no pasa de 30 h.
- Prueba del **cartel de datos viejos** (D4) con un indice fixture viejo.
- Contrato del Worker: `/buscar` con `q` vacio, largo, con emojis; `/contacto` sin `espera`; origen no permitido.

Criterio: 3 corridas consecutivas de la suite completa en verde en CI y 0 pruebas con `retry`.

## 6. Seguridad

Orden por riesgo (IDs de la auditoria):
1. S1 proteger `main`. 2. D1-D5 compuerta de publicacion. 3. W1-W3 rate limit nativo + Turnstile + tope diario global de subpedidos por fuente. 4. W4 `redirect: "manual"`; W5/W6/W9/W10. 5. S2 CSP con hashes (cuando Cloudflare este delante). 6. S4 borrar `CLAUDE_CODE_OAUTH_TOKEN` si `ARREGLO_CLAUDE` no se va a usar. 7. Rotar tokens con vencimiento (INSTAGRAM_TOKEN vence ~22/12).
- **Escaneo dinamico propio sin pagar**: OWASP ZAP baseline en Docker contra el sitio armado en local (ver auditoria, bloque ZAP) y, mas adelante, contra un entorno de staging. **Nunca contra produccion ni terceros.** Strix necesita una clave de modelo (de pago o LiteLLM) y no se corrio; ZAP cubre lo esencial.
- Dependabot alerts y `npm audit` en CI.

## 7. Rendimiento

Meta: Lighthouse movil >= 95 en `/` y `/?q=`; LCP <= 2,0 s con CPU 4x y Fast 4G (hoy 1,98 / 1,91 s).
0. **N-CAL1 primero**: `defer` en los 28 scripts de `index.html` y `preload` del indice; es el cambio de mayor retorno y el mas barato. Medir antes y despues con el CLI de Lighthouse (rendimiento).
1. Portada con HTML ya armado (generar_portada.js ya pre-renderiza; confirmar que el LCP sea ese bloque y no el que espera el indice).
2. Indice partido (portada + por categoria) y carga diferida del completo.
3. Cache largo en Cloudflare con purga al publicar.
4. Medir con CrUX cuando haya trafico suficiente (hoy "sin datos").
Criterio: 3 corridas de Lighthouse de rendimiento (no solo las otras tres categorias) con mediana >= 95.

## 8. Costos mensuales estimados (USD)

| Item | Hoy | Plan | Nota |
|---|---|---|---|
| GitHub Pages + Actions (repo publico) | 0 | 0 | minutos gratis en repos publicos |
| Dominio `pichinchadeldia.com.ar` | ~0 (anual local) | igual | NIC Argentina |
| Cloudflare Free (DNS, CDN, WAF basico, Turnstile) | 0 | 0 | |
| Workers (Free: 100.000 pedidos/dia) | 0 | 0, o 5 si se pasa | si el buscador supera el tope, Workers Paid cuesta USD 5/mes |
| KV / R2 backups | 0 | 0 | dentro del plan gratis |
| Resend (correo de contacto) | 0 | 0 | 3.000/mes y 100/dia |
| Sentry (plan Developer) | 0 | 0 | |
| Firecrawl | creditos | solo uso puntual | no es costo fijo |
| DeepSeek (delegacion, saldo cargado) | ~2 USD de saldo | tope por clave | solo cuando se pide |
| **Total fijo** | **~0** | **0-5** | |

Unico gasto unico previsto: **Google Play USD 25** (bloqueado, ver seccion 11).

## 9. Orden de ejecucion y criterios de terminado

| Fase | Que | Terminado cuando | Quien |
|---|---|---|---|
| F0 (1 dia) | **S1 HECHO el 13/11** (ruleset `proteger-main`, check `tests` obligatorio). Falta: Telegram solo si indexar OK (D5); borrar log de aviso (W9) | `gh api repos/.../rules/branches/main` lista `required_status_checks`; un push directo a main es rechazado | Claude |
| F1 (2-3 dias) | Compuerta de publicacion (D1-D4) + tope de borrado (D3) + tests | Con un indice fixture donde una tienda cae 70 %, el workflow **no publica** y avisa; test automatico que lo prueba | Claude |
| F2 (2 dias) | Pipeline: errores tragados D6-D14, escrituras atomicas D11/D16 | 0 `except` que devuelvan vacio sin contar; tests de cada uno | Claude |
| F3 (1 dia) | KV del vigia + observability + alarma de frescura | El vigia avisa una vez (no repite) y detecta un indice de >30 h simulado | Dueño (1 comando KV) + Claude |
| F4 (3 dias) | Cloudflare delante + cache + purga + CSP con hashes | `curl -I` muestra HSTS y cache largo de `indice.json`; Lighthouse sin errores de CSP | Dueño (DNS) + Claude |
| F5 (2 dias) | Worker: rate limit nativo, Turnstile, `workers_dev=false` | Prueba de contrato: 6to mensaje en 10 min rechazado aunque cambie de isolate | Claude |
| F6 (2 dias) | Backups a R2 + prueba de restauracion | Restauracion a carpeta limpia da los mismos conteos (diferencia < 1 %) | Claude + dueño (crear bucket) |
| F7 (3 dias) | Rendimiento: N-CAL1 (`defer` + preload), indice partido, portada | Lighthouse movil rendimiento mediana >= 95 en `/` y `/?q=` | Claude |
| F8 (semana de calma) | Estabilizacion: nada nuevo, solo corregir | CI verde 14 dias seguidos; 0 hallazgos altos; issues del repo privado #1-#9 cerrados o explicados | Todos |

Regla: una fase se cierra con su PR mergeado, sus tests y su fila en `docs/mapa.md`.

## 10. IA y modelos: LiteLLM vs alternativas

Contexto: se usan modelos para delegar borradores y como colchon cuando se agota el limite (CLAUDE.md global). Lo gratis va por defecto; nada de pago sin pedido.

| Opcion | Costo | Topes de gasto | Respaldo (fallback) | Veredicto |
|---|---|---|---|---|
| **LiteLLM** (actual, local `127.0.0.1:4000`) | Gratis (open source, autoalojado); pagas solo los modelos que uses | Claves virtuales y presupuestos por clave en YAML | Cadenas de respaldo (ya hay NVIDIA -> OpenRouter) | **Dejar como base.** Ya anda y esta integrado en los scripts |
| **OmniRoute** (MIT, ~87 mil estrellas, v3.8.53 del 06/11/2026) | Gratis | Tope USD por clave | 21 estrategias de ruteo, circuit breaker; endpoint tipo Anthropic y OpenAI | **Solo probar en paralelo.** Mas funciones, pero otra pieza mas que mantener; el registro de `docs/delegacion-modelos.md` (Gemini via OmniRoute: 0 de 17 aciertos) habla de la calidad del modelo, no del gateway |
| **OpenRouter directo** | Sin recargo de inferencia; comision sobre la compra de creditos. Modelos gratis: 20 pedidos/min y 50/dia sin creditos, 1.000/dia con >= 10 USD comprados | Limite de credito de la cuenta | Ruteo y respaldo entre proveedores propios del servicio | **Seguir como respaldo dentro de LiteLLM.** No comprar creditos sin pedido del dueño |
| **Cloudflare AI Gateway** | Nucleo gratis (analitica, cache, limite de tasa); 5 % solo sobre creditos de facturacion unificada | Limites de tasa; logs con tope (100.000 en cuentas con Legacy Logs, plan Free) | Reintentos y respaldo entre modelos | **No aplica hoy**: el sitio no llama a ningun modelo. Reevaluar si se suma un asistente al buscador |
| **Portkey** (open source MIT; nube Free 10.000 pedidos/mes con logs 3 dias; Pro USD 49/mes) | Gratis autoalojado; Pro USD 49/mes | Presupuestos y limites finos solo en Enterprise (nube) | Fallbacks, balanceo, reintentos, timeouts incluidos | **Descartar por ahora**: duplica a LiteLLM; la nube Free se queda corta |

Recomendacion: **quedarse con LiteLLM**, ponerle `max_budget` a la clave de DeepSeek (saldo chico) y una alerta cuando quede poco, y probar OmniRoute en una maquina/puerto aparte durante una semana antes de decidir. Lo gratis sigue siendo NVIDIA Build primero y OpenRouter despues; GLM 5.3 Flash no contesta y Kimi K2.6 da 404 en esta cuenta (13/11).

Fuentes: OpenRouter limites <https://openrouter.ai/docs/api-reference/limits>; Cloudflare AI Gateway precios <https://developers.cloudflare.com/ai-gateway/reference/pricing/>; OmniRoute <https://github.com/diegosouzapw/OmniRoute>; comparativa <https://fp8.co/articles/LLM-Gateway-Comparison-LiteLLM-vs-Portkey-vs-OpenRouter>; Portkey precios <https://portkey.ai/pricing> y <https://docs.portkey.ai/docs/product/product-feature-comparison>.

## 11. PENDIENTES que cuestan plata (BLOQUEADOS hasta que la app este a prueba de balas)

| Pendiente | Costo | Estado |
|---|---|---|
| Cuenta de desarrollador de **Google Play** | USD 25 (unico) | **Bloqueado**. El dueño no paga hasta cumplir el criterio de abajo |
| 12 probadores para la prueba cerrada de Play (14 dias) | 0 (hay que conseguirlos) | Bloqueado por lo anterior |
| Workers Paid (si el buscador pasa 100.000 pedidos/dia) | USD 5/mes | Solo si hace falta |
| Cuenta Apple Developer (iOS) | USD 99/año | Solo con el gatillo de F6 del plan v4 (1.000 instalaciones o 300 alertas) |

**Criterio exacto de desbloqueo de Google Play** (todo junto, medido y anotado en `docs/`):
1. CI en verde **14 dias seguidos** (`Tests` y `Actualizar precios y publicar`, sin corridas rojas por causa propia).
2. **0 hallazgos de severidad alta abiertos** en `docs/auditoria-2026-11-13.md` (S1, D1-D5 cerrados).
3. Lighthouse movil **>= 95 en rendimiento** (y 100 en las otras tres) en `/` y `/?q=ssd%201tb`, mediana de 3 corridas.
4. Vigia con **KV activo** y una alarma de prueba recibida.
5. Rama `main` **protegida** (ruleset exigiendo `Tests`).
6. **Backup restaurado** con exito al menos una vez (prueba de F6).
7. Issues del repo privado #1-#9 cerrados o explicados con causa ajena.

Cuando se cumpla, Claude avisa: "criterio de Play cumplido" con los 7 numeros.

## 12. AliExpress (solicitud de desarrollador RECHAZADA el 13/11)

- Que paso: la solicitud fue rechazada en el formulario de **cumplimiento de datos**. No se conoce el motivo exacto (el rechazo pegado no lo traia).
- Respuestas recomendadas al reenviar (las manda **el dueño a mano**, Claude no completa formularios de cuentas):
  1. Datos tratados por terceros: **Yes** (Cloudflare, red global; el Worker corre ahi).
  2. Transferencia de datos al exterior: **Yes**.
  3. Uso de datos de AliExpress para fines propios, ademas de prestar el servicio: **No**.
  4. Conservar los datos despues de terminar el servicio: **No**.
  - "Location of data processing": **Red global de Cloudflare (Workers); sin servidores propios**. Ademas, el Worker no guarda datos de AliExpress: solo reenvia el resultado de la busqueda y lo cachea unos segundos en memoria.
- Antes de reenviar: confirmar que lo que dice el formulario coincide con el codigo (`worker/src/fuentes/aliexpress.js` no persiste nada; el cache es en memoria del isolate).
- Si vuelve a rechazarse: pedir el motivo exacto por el canal de soporte de AliExpress Open Platform y anotarlo aca. No bloquea ninguna fase del plan: AliExpress es una fuente opcional.

## 12b. SEO y diseno (de las skills, orden sugerido)

1. N-SEO1 y N-SEO2: miga visible con enlace al hub (un cambio en `pie()` resuelve ambos). 2. N-SEO3: colapsar los 13 pares casi iguales. 3. N-UX1, N-UX2 y N-UX3: tres arreglos de CSS/JS de bajo riesgo. 4. N-TIPO1, N-DS1 y N-A11Y1: escala tipografica, tokens y toques de 44 px (un PR de diseno aparte). 5. N-SEO4: hubs por rubro, cuando haya trafico.

## 13. Pendientes en vivo (13/11)

Issues del repo privado `la-pichincha-correo`: #9 permisos nuevos de la GitHub App «Claude» (decision del dueño); #8 Smartphones y PCs sin ofertas (#217 de la-pichincha); #7/#6/#5 CI de PRs del 11-12/11 (relacionado con T1, intermitencia); #4 404 de Search Console (el sitemap actual da 200 a las 200 URLs: probablemente dato viejo, revisar en Search Console el detalle de las URLs); #3 y #2 FullH4rd y Katech con 0; #1 traspaso.
Otros: Black Friday 20/11, reel (espera OK), AAIP antes de juntar correos, `ARREGLO_CLAUDE`.

## 14. Decisiones que le tocan al dueño

1. OK para el ruleset de `main` (F0). 2. Crear KV del vigia (1 comando) y, para F4, tocar DNS de Cloudflare. 3. Reenviar AliExpress. 4. Decidir si se mantiene el token `CLAUDE_CODE_OAUTH_TOKEN`. 5. Pagar Google Play **solo** cuando Claude avise que se cumplio el criterio.
