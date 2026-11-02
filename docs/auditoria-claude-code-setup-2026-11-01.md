# Auditoría 1: Claude Code Setup, devolución sobre la app (02/11/2026)

Herramienta: skill `claude-automation-recommender` (plugin `claude-code-setup` de Anthropic), en
`.claude/skills/claude-automation-recommender/`. Mira el código y la forma de trabajar, no el sitio publicado (eso es la
auditoría 2). Corrida **después** de las correcciones de este PR (diseño D + F3, precios de relleno, hooks, áreas táctiles).

## La app, medida en el repo

| Parte | Tamaño | Pruebas |
|---|---|---|
| Sitio (`js/`, `css/`, `index.html`) | ~5.300 líneas de JS en `js/`, sin build ni dependencias | 745 tests JS, 21 e2e (Playwright) |
| Python (raíz) | ~4.400 líneas, 56 archivos, solo biblioteca estándar | 617 tests |
| Worker «Afuera» (Cloudflare) | ~590 líneas, única pieza con secretos | tests del Worker + lectura en vivo |
| CI | 4 workflows: `tests` (tests, e2e, Lighthouse), `actualizar`, `diagnostico`, `worker` | todo en verde en el PR |
| Especificaciones | 50 specs, 141 `.md`, constitución en `.specify/memory/` | — |

## Lo que está bien

- Reglas escritas y verificables (estático primero, datos honestos, respeto a las fuentes); varias las protegen tests
  (JSON-LD sin precios ni «Product», orden sin comisiones).
- Automatizaciones propias que funcionan: `guardia.py` (publicar sin OK, commits con tildes, **y ahora archivos generados**),
  `test_del_archivo.py` (**ahora también `.py`**), skills `medir-indice` y `cerrar-pr`.
- Casi sin deuda marcada: 2 TODO/FIXME en todo el código.
- Secretos solo en GitHub Actions y en el Worker; nada escrito en el código.
- `/medir-indice` confirmó hoy sobre el índice publicado (31/10, 31.019 avisos): 43 ofertas, 0 repetidas, premium <= 12,7 % por categoría.

## Riesgos y huecos

| # | Hallazgo | Severidad |
|---|---|---|
| 1 | **La continuidad vive fuera del repo** (`privado/continuidad.md` no se commitea): en una sesión nueva en la nube no existe | Media |
| 2 | **Un solo desarrollador y mucha documentación** (141 `.md`, 50 specs): el costo de mantener todo coherente cae en una persona | Media |
| 3 | **Playwright 1.64.1 pide un Chromium (build 1248) que el entorno cloud no trae (1243)**: los e2e necesitan un config temporal | Baja |
| 4 | **El índice del sitio pesa 1,79 MB gzip y se baja entero en cada búsqueda** (ver auditoría 2). El 29 % es el campo `imagen`, que la búsqueda no muestra | **Alta para la velocidad** |

## Corregido en este PR (verificado)

- Diseño final D + F3 en las tarjetas de Ofertas (`css/sitio.css`, `js/indice-ofertas.js`): franjas, letras, título en 2 renglones,
  precio que no se corta, tarjetas de igual altura, botones de 44 px, filtros plegados en el celular.
- Aviso de relleno `$999.999.999` (OnCity): el indexador descarta precios desde $100.000.000 (`indexar.py`, con test).
- Hooks: confirmación al editar `package-lock.json` o `_sitio/`; test del `.py` editado. `datos.json` y `consultas.json` NO se frenan (datos curados a mano).
- Áreas táctiles de 24 px en «mismo modelo» y contraste de la franja de precio y los contadores (accesibilidad 100 en Buscar y Ofertas).

## Recomendaciones que quedan

1. **Adelgazar el índice** (decisión del dueño, ver auditoría 2): sacar `imagen` de `indice.json` o partirlo por rubro; la constitución y
   `docs/plan-v3.md` ya prevén «partir el índice por rubro» como primer paso.
2. **Copia de la continuidad dentro del repo** (`docs/continuidad.md`, sin datos sensibles).
3. **Subagente `security-reviewer` para `worker/src`** y skill `/e2e-local`: prioridad baja.
4. **Conector Cloudflare con acceso a la zona** (solo lectura): hoy ve cuenta y Workers, no DNS ni Email Routing.

No recomendado: Playwright MCP (ya se usa `@playwright/test`) ni context7 (el sitio no usa librerías externas).

## Límites

- Es una lectura del código y la configuración; no mide la calidad de los datos de cada tienda.
- Las fuentes F3 se cargan de Google Fonts: en el entorno de pruebas no hay salida a Google, así que su costo real de carga no se midió.
