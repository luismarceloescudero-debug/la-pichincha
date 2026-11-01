# Auditoria 1: Claude Code Setup (01/11/2026)

Skill: `claude-automation-recommender` (plugin `claude-code-setup` de Anthropic), copiada a
`.claude/skills/claude-automation-recommender/`. Es de solo lectura: este informe son recomendaciones, no cambios.

## Lo que el repo ya tiene (no se rehace)

- Hooks: `guardia.py` (PreToolUse, confirma publicar) y `test_del_archivo.py` (PostToolUse, test del `js/*.js` editado).
- Skills del proyecto: `medir-indice`, `cerrar-pr`, `web-quality-audit`, `code-review`, speckit-*.
- CI: `tests.yml`, `actualizar.yml`, `diagnostico.yml`, `worker.yml`.

## Recomendaciones (ordenadas por valor)

| # | Tipo | Propuesta | Por que |
|---|---|---|---|
| 1 | Hook PreToolUse (Edit/Write) | Bloquear edicion manual de `datos.json`, `consultas.json`, `package-lock.json` | Los generan scripts; una edicion a mano rompe el indice |
| 2 | Hook PostToolUse | Al editar un `.py` de la raiz, correr `tests/test_<nombre>.py` | Hoy solo se cubre `js/*.js`; hay 612 tests de Python |
| 3 | Subagente | `security-reviewer` para `worker/src` | Secretos de APIs, CORS, tope por IP, formulario `/contacto` |
| 4 | Skill | `/e2e-local`: `armar-sitio.sh` + Playwright `--workers=1` | La receta esta repetida a mano en los informes de prueba |
| 5 | MCP | Cloudflare (conectado el 01/11) | Revisar el Worker `pichincha-afuera` sin salir de la sesion |

Descartadas: Playwright MCP (ya se usa `@playwright/test`), context7 (el sitio usa solo la biblioteca estandar),
release-notes (sin releases).

## Hallazgo de entorno

El Playwright fijado en `package.json` (1.64.1) pide el Chromium build 1248; el entorno cloud trae el 1243. En la nube
hay que apuntar `executablePath` al Chromium instalado (config temporal fuera del repo). En la CI y en la PC del
dueño no pasa.
