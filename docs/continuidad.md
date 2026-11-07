# Continuidad de La Pichincha

Última actualización: 04/11/2026 (corrida sin historial; el mensaje de Telegram sale siempre).

---

## Estado del branch

- `main` en `185204b`: **#215 mergeado** (auditorías 02/11, diseño, índice sin fotos, eBay, hooks y skills). El branch
  `ccr-eaf2827b-dmk4yf` ya está mergeado y se puede borrar.
- Cron diario RESTAURADO el 07/11 (estuvo apagado del 02 al 07/11, #212): 00:23 y 02:47 hora argentina (el segundo es respaldo y no repite el indice del dia),
  mas una corrida por cada push a main (solo corrige el mensaje de Telegram si el índice es del mismo día) y las manuales con `workflow_dispatch`.
  Instagram queda FUERA del camino: PRs 126 y 169 en borrador, sin pasos en el workflow, hasta que el dueño decida.
- 03/11 19:59 UTC: corrida manual con `indexar=true` (run 41708364309). Rearmó el índice del 03/11, pero **no mandó Telegram**:
  la guardia se despertó con «PCs completas: sin ofertas». Causa: en esa corrida falló el checkout de la rama `historial`
  (`historial.inicio` vacío) y sin historia el índice sale con 0 bajas propias en todos los rubros (issue #217, comentado).
- 04/11: **arreglo (PR de esta rama)**. `indexar.py` saca una foto del índice anterior (junto al historial, `historial/foto.json`)
  cuando no hay series y mide las bajas contra ella (sello k, «ayer $X»); la foto de hoy no se usa, así dos corridas el
  mismo día no inventan bajas (18/10). `guardia.js --reusado` deja anotado cuando midió un índice reusado de la cache.
  Tests: `tests/test_indexar_corrida.py` (5 nuevos), suite completa 625 + 750 en verde.
- 04/11 (spec 058): **el mensaje de Telegram sale siempre**: la guardia ya no lo frena (avisa en el issue) y con
  `ofertas.json` vacío se manda «Hoy no hay bajas para destacar» con el enlace al sitio. Una publicación sin descuento
  muestra el precio sin «−0 %». Siguiente: spec 060 (revisión por suba previa, sello `x`, «estable hace N días»).
- PRs abiertos: solo #169 (Reel, frenado) y #126 (Instagram, frenado hasta la versión final).

## Qué se hizo en las últimas sesiones (01–02/11)

### Sesión 02/11 — auditorías + setup (esta sesión)
- Auditoría de calidad web (`docs/auditoria-calidad-2026-11-02.html`): 12 hallazgos
- Auditoría de setup de Claude Code (`docs/auditoria-setup-2026-11-02.html`): 9 hallazgos
- Correcciones aplicadas del audit de calidad:
  - Dark mode sin destello (index.html: inline style con color-scheme + background oscuro)
  - `aria-label="Buscar productos"` en el input de búsqueda (js/busqueda.js)
  - Links que abren pestaña nueva: `aria-label` con aviso "(nueva pestaña)" (js/busqueda.js)
  - Focus visible en el buscador: box-shadow de 4px (css/sitio.css:247)
  - h1 con texto accesible "Comparador de precios de hardware en Argentina" (index.html:88)
  - Fuentes `.meta`, `.tab .n`, `.tile .k`: de .68–.72rem → .8rem (css/sitio.css)
  - Placeholders de filtros sin `…` → corregidos (js/busqueda.js)
- Correcciones aplicadas del audit de setup:
  - `settings.json`: deny para Edit/Write de `.env*` y `.dev.vars` (sumado a los Read ya existentes)
  - Skills instaladas: `vercel-labs/agent-skills@web-design-guidelines` (816K installs) y `addyosmani/web-quality-skills@web-quality-audit` (34.5K installs)
- Revertido: `sw.js` sin índice en la precarga → diferido a **sesión VELOCIDAD**
- Hooks mejorados (f97d288): freno a `git push --force`, `reset --hard`, secretos en commits, aviso al cerrar

### Sesión 02/11 — índice sin fotos (spec 057)
- `adelgazar_indice.js`: extrae los campos mínimos y descarta fotos del índice
- Resultado: -29% de descarga en Buscar y Ofertas
- Tests: `tests/js/adelgazar.test.js` (nuevo)

### Sesión 01/11 — diseño final + eBay + hooks
- Diseño D + F3 en tarjetas de Ofertas (`b7d66f1`)
- eBay activado: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_CAMPAIGN_ID` cargados; Worker devuelve `afiliado: true`
- Áreas táctiles de 24px en links "mismo modelo" de Búsqueda
- Contraste del precio tachado y contadores de chips corregido
- Indexador: descarta avisos con precio >= $100.000.000 (relleno)

---

## Qué falta (pendiente técnico)

### Diferido a sesión VELOCIDAD (no tocar antes)
- [ ] Juntar y minificar los 25 archivos JS (index.html:107-121 y 810-820)
- [ ] `sw.js`: sacar `indice.json` de la precarga (solo se guarda al buscar por primera vez)
- [ ] Alojar fuentes localmente (woff2 con preload) para eliminar Google Fonts externo
- [ ] Generar noscript de fuentes desde plantilla (hoy duplicado manual en index.html:46)

### Hallazgos de calidad pendientes (diferidos)
- [ ] CSP: eliminar `unsafe-inline` en scripts (requiere mover DATOS a archivo externo)
- [ ] Portada con contenido estático para SEO (links fijos a precios/ dentro de #vista)

### Setup pendientes
- [x] **guardia.py**: frena `git push --force`, push a main, `git reset --hard` y secretos en commits (#214, `cae682f`).
- [x] **test_del_archivo.py**: valida el JSON al editar `*.json` de la raíz (#214).
- [x] **`.mcp.json`**: Playwright con `node` a su CLI global; Stitch queda deshabilitado (#215, `c87604f`).
- [ ] Skills de terceros pesadas (`speckit-*` x10, `reverse-engineer-anything`, etc.): moverlas a nivel usuario (`npx skills add ... -g`) para liberar contexto
- [ ] Crear `.claude/agents/security-reviewer.md` limitado a `worker/src`

### Pendientes del dueño (ver `docs/pendientes-del-dueno.md`)
- [ ] Formulario de contacto: probar de punta a punta (secretos ya cargados)
- [ ] AliExpress (afiliado aprobado el 06/11): copiar el Tracking ID del portal, crear la app en `openservice.aliexpress.com` y cargar `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`, `ALIEXPRESS_TRACKING_ID`
- [ ] Google Search Console: agregar registro TXT en Cloudflare
- [ ] Seguimiento tiendas (16/11): FullH4rd, Compra Cierta, Loquieroacá (Katech respondio el 04/11 con su feed: integrado)

---

## Comandos útiles para empezar

```bash
# Tests completos
node --test "tests/js/*.test.js"
python -m unittest

# Test de un archivo específico
node --test tests/js/busqueda.test.js

# E2E (con poca memoria, un worker)
npx playwright test --workers=1

# Auditorías de diseño (skills ya instaladas)
# /web-design-guidelines css/sitio.css index.html js/busqueda.js
# /web-quality-audit

# Medir índice antes de un PR de ofertas/categorías
# /medir-indice
```

## Próxima sesión sugerida

1. Mirar el resultado de la corrida manual 41708364309 (indexado + Telegram del 03/11) y que no haya salido alarma de la guardia.
2. Borrar la rama `ccr-eaf2827b-dmk4yf` (ya mergeada en #215).
3. Sesión VELOCIDAD: bundle JS + sw.js sin índice + fuentes locales (ver "Diferido a sesión VELOCIDAD").
