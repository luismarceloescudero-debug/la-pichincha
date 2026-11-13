# Prueba de skills — 13/11/2026

Regla: solo se marca **probada** la herramienta que se corrio de verdad en esta auditoria. Las demas dicen **no probada** con el motivo. Aclaracion honesta: varias "pruebas" se hicieron con la herramienta de fondo (Playwright, axe-core, DevTools, ZAP) y **no** invocando la skill del mismo nombre; la columna lo dice.

## Probadas

| Herramienta / skill | Que se hizo | Resultado real | Veredicto |
|---|---|---|---|
| `ecc:security-reviewer` (agente) | Reviso `worker/src/*.js`, `js/pagina.js`, `js/errores.js`, `publicar_telegram.py`, `avisar_dueno.py` | 10 hallazgos (3 medios, 7 bajos), 0 altos; yo verifique W1, W4, W8, W9 leyendo la linea. Sin falsos positivos en los verificados | **Dejar**: util para revision puntual de seguridad |
| `ecc:silent-failure-hunter` (agente) | Reviso `indexar.py`, `mercadolibre.py`, `filtrar_indice.py`, `historial.py`, `actualizar.py`, `actualizar.yml` | 18 hallazgos (5 altos); verifique D1, D3, D5, D6 y D14 en el codigo: correctos. Es la que mas valor dio | **Dejar** y correrla en cada cambio del pipeline |
| Chrome DevTools: `performance_start_trace` (equivale a `web-perf`, sin invocar la skill) | Trace movil emulado (CPU 4x, Fast 4G) en `/` y `/?q=ssd%201tb` de produccion | LCP 1.977 y 1.909 ms, 98 % render delay, CLS 0 | **Dejar**; falta el Lighthouse de rendimiento oficial |
| Chrome DevTools: `lighthouse_audit` (traspaso) | Movil en `/` | Accesibilidad 100, Buenas practicas 100, SEO 100 (no mide rendimiento) | **Dejar** para las otras 3 categorias |
| Playwright (suite del repo, `npx playwright test`) | 22 pruebas E2E sobre el sitio armado en local | 1ra vuelta 14/22, 2da 22/22: hay intermitencia (T1) | **Dejar**; arreglar la intermitencia |
| Playwright + axe-core 4.10.2 (guion propio; no la skill `accessibility`) | 11 rutas x movil y escritorio, con datos feos (largo, emojis, `<script>`, sin resultados) | 0 violaciones de axe, sin scroll horizontal, sin XSS reflejado | **Dejar**; pasarlo a prueba fija (plan, seccion 5) |
| OWASP ZAP baseline en Docker (`ghcr.io/zaproxy/zaproxy:stable`) | Pasivo, solo contra el sitio local armado | 12 alertas, mismas familias que el 19/10, ninguna nueva accionable | **Dejar** como reemplazo gratis de Strix |
| Docker Desktop | Se lanzo a mano; el motor quedo andando (v29.9.2) | Sirvio para ZAP | **Dejar** |
| `find-skills` (`npx skills find`) | Busque "price comparison scraping" | Lo mejor tiene 4-11 instalaciones, fuente desconocida: **no cumple** el umbral (oficial o 1K+). No se instalo nada | **Dejar**; no hay nada que sumar |
| `web-research` / ddgs (traspaso) | Busquedas | Anda a medias: un fallo de DNS; `ddgs extract` anduvo | **Usar solo** para datos sueltos |
| Firecrawl (esta sesion + traspaso) | `search` (x2) y `scrape` con `query` (x2), unos 24 creditos | Funciona; las paginas con mucho contenido devuelven textos enormes: usar `formats:["query"]` | **Dejar**, con criterio de gasto |
| `local-docs` (traspaso) | `context list` | Solo hay paquete de react; `context browse litellm` = sin paquete | **Sacar o ignorar** (no aporta a este repo) |
| Reconocimiento de competidores (Firecrawl) | `comparador-hardware.com.ar/acerca` y portada de Solotodo | Poca info publica (sin JSON-LD visible en Solotodo, se financia con afiliados y publicidad). No se encontro nada que cambie el plan | **Usar solo** si hace falta una comparacion concreta |

## No probadas (motivo)

| Skill | Motivo |
|---|---|
| `ecc:production-audit`, `ecc:quality-gate`, `ecc:harness-audit` | No se corrieron: el limite de esta sesion se uso en las revisiones de codigo y en las mediciones en vivo. El plan cubre lo mismo con criterios medibles. Pendiente para la siguiente pasada |
| `web-quality-audit`, `seo-audit`, `schema`, `site-architecture` | No se invocaron. Se midio lo mismo de otra forma: Lighthouse SEO 100, sitemap 200/200, JSON-LD presente, canonical correcto. Pendiente la skill completa |
| `accessibility`, `web-design-guidelines`, `web-typography` | No invocadas; axe dio 0 violaciones |
| `impeccable`, `ux-audit` completo, `design-debt-audit`, `critique-visual-hierarchy`, `design-token-audit`, `break-ui` | No corridas: el diseno ya tuvo auditoria el 13/11 (`docs/auditorias/2026-11-13-ux-ofertas.md`, A3/A10 mergeados). El guion de "datos feos" cubre una parte de `break-ui` sin ser la skill |
| `playwright-best-practices`, `playwright-cli`, `e2e-testing` | No invocadas; se uso Playwright directo |
| `karpathy-guidelines`, `ponytail` | No aplican a una auditoria de solo documentos (son guias para escribir codigo) |
| `reverse-engineer-anything` | No hizo falta: los comparadores publicos no entregan un artefacto que cambie el plan |
| Strix (`penetration-testing-with-strix`, etc.) | **Bloqueado**: Docker ya levanta, pero Strix pide una clave de modelo (no hay clave en el entorno y no se paga). Reemplazado por ZAP |
| Remotion / `becario-reels` | **No aplica** a esta tarea (son videos); sigue siendo util para los reels de Black Friday |

## Lo que sirvio de verdad (orden)

1. Los dos agentes de revision de codigo (casi todo el valor). 2. Playwright y el trace de rendimiento. 3. ZAP en Docker. 4. Lo demas aporto poco en esta pasada.
