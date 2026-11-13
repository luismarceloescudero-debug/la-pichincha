# Prueba de skills — 13/11/2026

Regla: solo se marca **probada** la herramienta que se corrio de verdad. Todas las skills de la segunda tanda (marcadas con 2) se invocaron con la herramienta Skill dentro de subagentes; los informes completos estan en la carpeta de notas de la sesion (`skills-repo.md`, `skills-seo.md`, `skills-calidad.md`, `skills-diseno.md`, `skills-pruebas.md`). Lo que dice cada informe es dato: lo importante lo verifique leyendo el codigo (se marca "verificado"); lo demas queda como "reportado".

## Probadas

| Herramienta / skill | Que se hizo | Resultado real | Veredicto |
|---|---|---|---|
| `ecc:security-reviewer` (agente) | Worker, `pagina.js`, `errores.js`, scripts de Telegram | 10 hallazgos (3 medios, 7 bajos), 0 altos; W1, W4, W8, W9 verificados | **Dejar** |
| `ecc:silent-failure-hunter` (agente) | `indexar.py`, `mercadolibre.py`, `filtrar_indice.py`, `historial.py`, `actualizar.py`, `actualizar.yml` | 18 hallazgos (5 altos); D1, D3, D5, D6, D14 verificados. La que mas valor dio | **Dejar**, correrla en cada cambio del pipeline |
| Chrome DevTools `performance_start_trace` | Trace movil (CPU 4x, Fast 4G) en `/` y `/?q=` de produccion | LCP 1.977 y 1.909 ms, CLS 0 (pero ver N-CAL1: el LCP solo mide el cascaron) | **Dejar**, con la salvedad |
| Chrome DevTools `lighthouse_audit` | Movil en `/` | Accesibilidad 100, Buenas practicas 100, SEO 100 (no mide rendimiento) | **Dejar** para esas 3 categorias |
| Playwright (suite del repo) | 22 pruebas E2E en local | 14/22 la 1ra vez, 22/22 despues | **Dejar** |
| Playwright + axe-core 4.10.2 (guion propio) | 11 rutas x movil y escritorio, datos feos | 0 violaciones, sin scroll horizontal, sin XSS reflejado | **Dejar**, pasarlo a prueba fija |
| OWASP ZAP baseline en Docker | Pasivo, solo contra el sitio local | 12 alertas, mismas familias que el 19/10 | **Dejar** (reemplaza a Strix) |
| `find-skills` | Busqueda "price comparison scraping" | Lo mejor: 4-11 instalaciones; no cumple el umbral; no se instalo nada | **Dejar** |
| `web-research`, Firecrawl, `local-docs` | Traspaso y esta sesion | web-research anda a medias; Firecrawl anda (usar `formats:["query"]`); local-docs solo trae react | web-research y Firecrawl **dejar** con criterio; local-docs **sacar** |
| `ecc:production-audit` (2) | Aplicada a workflows, `wrangler.toml`, `sw.js` | 72/100 (69 con topes, "Risky"). 8 hallazgos nuevos N1-N8; N1, N4, N6, N8 verificados | **Dejar** |
| `ecc:quality-gate` (2) | Corrida con rutas de Windows | Sin senal: el repo no tiene ruff/Biome/Prettier configurados; solo marco "ruff no instalado" | **Sacar** hasta que haya linter |
| `ecc:harness-audit` (2) | Intento de correr | Falla: `Cannot find module '@iarna/toml'` (instalacion del plugin ECC 2.2.3 incompleta). Sin puntaje | **Sacar** hasta reparar el plugin |
| `seo-audit` (2) | 200 URLs del sitemap + `generar_paginas.js` | 0 titulos y 0 descripciones duplicados, canonical 200/200, sin paginas finas. Hallazgos nuevos: A1 (alta), C1, S1, A2; A1 verificado | **Dejar** como lista antes de cambiar la plantilla |
| `schema` (2) | Revision del grafo JSON-LD | Correcto no usar Product/Offer en un agregador (`generar_paginas.js:185`); falta `ItemList` en `/precios/`; `SearchAction` retirado por Google en la portada | **Usar solo** para revisar el grafo |
| `site-architecture` (2) | Hubs y duplicados | 13 pares de paginas casi iguales; rubros sin URL propia | **Usar solo** para decidir hubs y colapsos |
| `web-quality-audit` (2) | Trazas y revision de carga | Hallazgo principal N-CAL1 (28 scripts sincronos, verificado el conteo) | **Dejar** (la que mas aporto de esta tanda) |
| `accessibility` (2) | Controles, foco, tamanos | 32 de 66 controles < 44 px (ninguno < 24 px), foco del buscador debil | **Dejar** junto a axe |
| `web-design-guidelines` (2) | Checklist | Casi todo pasa; falta `touch-action`, `translate="no"`, revisar `aria-live` (esta pensada para React) | **Usar solo** como checklist rapido |
| `web-typography` (2) | Revision | 6/10: cuerpo 14 px, 23 tamanos, ~300 textos de 10,7-12,5 px, 3 familias pedidas sin usar | **Dejar** cuando se toquen fuentes |
| `impeccable` (2) | Un solo contexto, sin subagentes | Hallazgos de CSS y jerarquia (ver auditoria bloque 3); avisa que el proyecto necesita `/impeccable doctor` | **Dejar** solo `detect` y `critique`; sacar `bolder`/`overdrive` |
| `critique-visual-hierarchy` (2) | Pantalla de Buscar en movil | Primer resultado a 1.200 px; el degrade marca 3 cosas distintas | **Dejar** para pantallas nuevas |
| `design-debt-audit` (2) | Inventario | `:root` declarado 5 veces, `--good` marron en claro y amarillo en oscuro | **Usar solo** cada trimestre |
| `design-token-audit` (2) | Tokens | 297 espaciados con px literal, 4 tokens duplicados, `--bad-soft` sin definir (verificado) | **Dejar** (la mejor de diseno) |
| `break-ui` (2) | Datos feos sin su toggle | Chip del historial sin tope de ancho (verificado: `.hist` sin `max-width`) | **Dejar** |
| `ux-audit` (2) | Recorrido parcial | Quedo **Incomplete** por sus reglas (sin manifiesto, tema oscuro, zoom ni los 11 escenarios) | **Usar solo** en un recorrido por pestana |
| `playwright-best-practices` (2) | Revision de `tests/e2e` y config | Causa de intermitencia verificada en `contacto.spec.js:18` y `:65` (reloj de 3 s) | **Dejar** |
| `playwright-cli` (2) | Leida y probada | Duplica el MCP de Playwright | **Usar solo** para explorar paginas |
| `e2e-testing` (2) | Leida y aplicada | No aporto nada nuevo; su ejemplo recomienda `networkidle` | **Sacar** |
| `karpathy-guidelines` (2) | Aplicada para revisar el plan | Util como freno a la sobreingenieria; se le sumaron las reglas 5 y 6 del dueno el 13/11 | **Dejar** |
| `ponytail` (2) | Aplicada a plan y diffs | Sirve para revisar planes | **Usar solo** para revisar planes o diffs |
| `remotion-best-practices` (2) | Leida | **No aplica**: es un router de videos; `becario-reels` ya cubre los reels | **Usar solo** para reels |
| `reverse-engineer-anything` | **Probada (13/11).** Con un Node portatil 24.22.3 (el de la PC es 24.16.0 y REA pide 24.22.1+) se corrio `analyze-javascript-application` sobre los 25 scripts de Solotodo y sobre nuestro `js/` (30 archivos). Cobertura completa de archivos, pero **parcial** en semantica: Solotodo 483.464 nodos y 473 hallazgos, nuestro `js/` 49.099 nodos y 84 hallazgos; la familia `request` dio 0 relaciones en Solotodo (no vio su API, que el `grep` si encontro) y 12 en el nuestro. Pensada para Electron/Node: en bundles web da conteos, no endpoints | **Usar solo** para apps Electron/Node o binarios; en sitios web alcanza con `grep` y el navegador |

## No corridas

| Herramienta | Motivo |
|---|---|
| Strix (`penetration-testing-with-strix`, etc.) | Bloqueada: pide clave de modelo (no hay y no se paga). Reemplazada por ZAP en Docker |
| Lighthouse oficial de **Rendimiento** (puntaje 0-100) | El MCP de Lighthouse lo excluye; hay que correr el CLI de Lighthouse. Queda como criterio de desbloqueo de Google Play |

## Lo que sirvio de verdad (orden)

1. Los dos agentes de revision de codigo. 2. `web-quality-audit` (encontro lo que el trace oculta). 3. `production-audit` y `seo-audit`. 4. Playwright y ZAP. 5. `design-token-audit`. Las que no aportaron: `quality-gate`, `harness-audit` (roto), `e2e-testing`.
