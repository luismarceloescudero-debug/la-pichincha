# Auditoria 1: Claude Code Setup, devolucion sobre la app (01/11/2026)

Herramienta: skill `claude-automation-recommender` (plugin `claude-code-setup` de Anthropic), copiada a
`.claude/skills/claude-automation-recommender/`. Mira el codigo y la forma de trabajar, no el sitio publicado
(eso es la auditoria 2). Es de solo lectura: lo de abajo es lo que encontro, no cambios hechos.

## Que es la app, medido en el repo

| Parte | Tamano | Nota |
|---|---|---|
| Sitio (`js/`) | 99 archivos js en el repo, ~5.300 lineas en `js/` | Scripts comunes, sin build ni dependencias (constitucion I) |
| Python (raiz) | ~4.400 lineas, 56 archivos | Solo biblioteca estandar; arma indice, paginas y publicaciones |
| Worker «Afuera» | ~590 lineas | Unica pieza con secretos; desplegado en Cloudflare |
| Pruebas | 41 archivos JS (743 tests), 30 de Python (616 tests), 10 e2e (21 pruebas) | Todas pasan |
| CI | 4 workflows: `tests`, `actualizar`, `diagnostico`, `worker` | `tests` corre tests, e2e y Lighthouse |
| Especificaciones | 50 specs en `specs/`, 141 archivos `.md` | El proyecto se decide por escrito |

## Lo que esta bien

- Reglas fuertes y verificables: la constitucion (`.specify/memory/constitution.md`) fija estatico primero, datos honestos,
  respeto a las fuentes. Los tests protegen varias (por ejemplo, que el JSON-LD no declare precios ni «Product»).
- Automatizaciones propias ya puestas: `guardia.py` (frena publicar sin OK y commits con tildes), `test_del_archivo.py`,
  skills `medir-indice` y `cerrar-pr`.
- Pocas deudas visibles: 2 marcas TODO/FIXME/XXX en `js/`, `*.py` y `worker/src`.
- Un solo punto de secretos (Worker + GitHub Actions), sin claves escritas en el codigo desplegado.

## Riesgos y huecos encontrados

| # | Hallazgo | Severidad | Evidencia |
|---|---|---|---|
| 1 | **La continuidad vive fuera del repo.** `privado/continuidad.md` no se commitea; en una sesion nueva en la nube no existe (hubo que reconstruirla) | Media | `privado/` ausente en el clon; regla del `CLAUDE.md` depende de ese archivo |
| 2 | **Un solo desarrollador y mucha documentacion** (141 `.md`, 50 specs): el costo de mantener todo coherente cae en una persona | Media | Conteo de archivos |
| 3 | **El Playwright fijado (1.64.1) no coincide con el Chromium del entorno cloud** (pide build 1248, hay 1243): los e2e no corren sin un config temporal | Baja | Corrida del 01/11; en la CI y en la PC del dueño no pasa |
| 4 | **Los hooks cubrian solo `js/*.js`**; editar un `.py` no corria su test | Baja | Ya corregido en este PR |
| 5 | **Edicion a mano de archivos generados** (`package-lock.json`, `_sitio/`) sin freno | Baja | Ya corregido en este PR (pide confirmacion) |

Correccion a una recomendacion inicial: `datos.json` y `consultas.json` NO son generados puros, llevan datos curados a mano; no se frenan.

## Recomendaciones

1. **Ya hecho en este PR:** hook de confirmacion para archivos generados y hook de test para `.py` de la raiz.
2. **Subagente `security-reviewer` para `worker/src`:** es la unica pieza con secretos, CORS y el formulario. Prioridad media.
3. **Skill `/e2e-local`:** guarda la receta `armar-sitio.sh` + Playwright `--workers=1`. Prioridad baja.
4. **Copia de la continuidad en el repo:** un `docs/continuidad.md` sin datos sensibles (hoy `privado/` no sirve para sesiones en la nube). Decision del dueño.
5. **Conector Cloudflare con acceso a la zona** (solo lectura): hoy el conector ve cuenta y Workers, no DNS ni Email Routing.

No recomendado: Playwright MCP (ya se usa `@playwright/test`) ni context7 (el sitio no usa librerias externas).

## Limites

- Es una lectura del codigo y de la configuracion; no mide el sitio publicado ni la calidad de los datos de las tiendas.
- No se reviso logica de negocio (ofertas, categorias, titulos): eso lo mide `/medir-indice`, pendiente.
