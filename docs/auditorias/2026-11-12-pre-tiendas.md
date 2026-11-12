# Auditoría previa a las tiendas — 12/11/2026

Puerta de entrada de la Fase 1 de `docs/plan-v4-tiendas-de-apps.md` (sección 1). Mira el sitio con los ojos de
Google Play: qué falta para que la app envuelva la PWA sin que la rechacen y para que un error de noche se
detecte y se arregle.

**No se arregló nada en esta pasada.** Es el diagnóstico con el que se decide qué se toca primero. Los arreglos
van por PR chico, con test que primero falla.

## Cómo se hizo y qué no se pudo medir

| Se midió | Cómo |
| --- | --- |
| Suites completas | `node --test "tests/js/*.test.js"` → **784/784 en verde** (7,1 s). `python -m unittest discover -s tests -t .` → **697 tests, OK, 3 salteados** (20 s) |
| Manifiesto, PWA y `publicar_app.py` | lectura del código y de `tests/test_publicar_app.py` |
| CSP, Worker, escritura del índice, privacidad del buscador | lectura del código, con la línea exacta |
| Áreas táctiles | medidas por CSS (no hay navegador instrumentado en esta sesión) |

**No se pudo medir** (la sesión no tiene red ni `gh`, y las reglas del encargo prohíben publicar):

- Lighthouse y axe en vivo, y el estado de la CI. Los últimos números del repo son del 01/11 (CI 98-100) y del
  11/11 (la portada del runner oscila 83-96: P6 de `docs/auditorias/2026-11-11.md`).
- `/medir-indice` contra el índice publicado (necesita bajar el índice publicado: 6,7 MB, 1,4 MB comprimido, medido el 12/11). Último número anotado: 04/11, pestaña
  Ofertas 116 y 0 repetidas.
- Las pruebas de punta a punta: no hay `node_modules` en esta copia y no se instaló nada. Corren en cada PR.

## Resumen por eje

| Eje | Criterio de salida del plan | Estado | Lo que lo frena |
| --- | --- | --- | --- |
| Calidad web y Lighthouse | rendimiento 90+ en portada y `/?q=`; accesibilidad, buenas prácticas y SEO 95+ | **A medias** | la CI mide 90 en las cuatro y no mide `/?q=` (A5) |
| Uso real con datos feos | nada se rompe con títulos largos, 0 resultados, sin red | **Verde en código** | sin prueba automática de los casos feos (A4) |
| Accesibilidad | 0 fallas de axe; objetivos táctiles de 48 px | **Rojo** | objetivos de 24-38 px; axe no corre en la CI (A3, A4) |
| Seguridad | 0 altas ni medias; CSP sin `unsafe-inline` nuevo | **Amarillo** | `workers_dev` abierto y tope en memoria (A9); el resto es lo aceptado en `CONSTRAINTS.md` |
| Producción | qué pasa si cae Pages, el Worker o una tienda: todo tiene respuesta | **Rojo** | el índice se sigue escribiendo sin `os.replace` y una fuente caída borra un rubro (A7) |
| Reglas del índice | ofertas, repetidas y premium dentro de lo medido en `main` | **No medida** | hay que correr `/medir-indice` en una sesión con red |
| PWA instalable | manifiesto completo (`id`, `screenshots`, `shortcuts`), funciona sin red | **Amarillo** | `id`, `shortcuts` y `assetlinks.json` resueltos en la fase 3 (rama v4-f3-twa); faltan las capturas (A2) |
| Legal y datos | privacidad con URL fija, contacto real, Ley 25.326 | **Rojo** | no hay correo público ni derechos del titular (A6); el buscador manda el término sin filtrar (A8) |
| Diseño | la pantalla de inicio se entiende en 5 segundos | **Rojo** | el porcentaje sigue más grande que el precio (A10, D4 del 11/11) |

## Hallazgos

### P0 — frena el lanzamiento

- **A1. [Resuelto en la fase 3, rama v4-f3-twa: `publicar_app.py` escribe `assetlinks.json` desde `sitio.json`; falta
  cargar la huella cuando exista la app en Play.] No existe `/.well-known/assetlinks.json` ni nada que lo genere.** `publicar_app.py` copia el manifiesto,
  `sw.js`, los iconos y `datos/ganadores.json` (`publicar_app.py:23-28`) y no escribe la prueba de dominio. Sin
  ese archivo la TWA abre con barra de direcciones y Play no valida el sitio. Tampoco hay `.nojekyll`. Dato a
  favor: `/.well-known/security.txt` se publica desde el 31/10 y responde 200 (según la continuidad), así que el
  despliegue por Actions sí sirve carpetas con punto; el `.nojekyll` habría que confirmarlo, no darlo por hecho.

### P1 — antes de producción

- **A2. Manifiesto incompleto.** [`id` y `shortcuts` resueltos en la fase 3; quedan las `screenshots`.]
  `manifest.webmanifest` no tiene `id`, `screenshots` ni `shortcuts`. Lo demás está
  bien y probado: `name`, `lang`, `display: standalone`, rutas relativas, iconos 192/512/maskable que existen y
  miden lo que declaran (`tests/test_publicar_app.py:18-46`). Las capturas piden fotos reales del teléfono
  (plan, sección 8) y todavía no hay ninguna en `img/`.
- **A3. Objetivos táctiles por debajo de 48 px.** Medidos por CSS: pestañas `.tab` con `padding:9px 16px` y
  `.85rem` en el celular (`css/sitio.css:117-119`, `614`) → ~34-38 px; segmentos `.seg` `9px 16px` y `.88rem`
  (`css/sitio.css:328-330`) → ~32-36 px; `.mismo a` y `.nota a` en 24 px (`css/sitio.css:897`, `251`). Los botones
  de acción sí están en 44 px (`.acc`, `.of-chip`, `.afiliado > a`). Play mide 48. La e2e solo exige 24 px en los
  enlaces del pie (`tests/e2e/diseno.spec.js`).
- **A4. La accesibilidad no tiene puerta automática.** No hay `axe` en `tests/` ni en la e2e; la última medición
  manual (10/11) dio 0 violaciones en 6 vistas, y en la del 058 con letra al 200 % se cortaban título, chips y
  precio (WCAG 1.4.4 es AA). Tampoco hay prueba de 0 resultados ni de títulos de 190 caracteres fuera de la del
  10/11, que fue a mano.
- **A5. Lighthouse: el umbral de la CI no es el del plan y falta `/?q=`.** `BLOQUEANTES` exige 90 en las cuatro
  categorías (`.github/lighthouse.js:16`); el plan pide 95 en accesibilidad, buenas prácticas y SEO. El job mide
  `/`, `/precios/`, `/hoy/`, `/estado/`, `/legal/` y `/contacto/` (`.github/workflows/tests.yml:143`): la búsqueda
  con `?q=` no se mide. Y el rendimiento de la portada en el runner sigue entrando justo: 83-96 sin cambios de
  código (P6 del 11/11).
- **A6. `/legal/` no tiene contacto real ni derechos del titular.** La política existe con URL fija
  (`/legal/`, canónica estable) y cuenta bien GoatCounter, Sentry, el formulario y Resend
  (`generar_info.js:137-174`). Pero no publica ninguna dirección de correo —solo el formulario
  (`generar_info.js:277`)— y no dice cómo ejercer acceso, rectificación o supresión (Ley 25.326, arts. 14-16).
  Play pide un correo de contacto en la ficha y una política con lo que se junta y cómo se borra. La dirección
  `hola@pichinchadeldia.com.ar` ya existe y funciona como remitente (`CONTACTO_REMITENTE`); el plan propone
  `contacto@`.
- **A7. Producción: los dos agujeros del 11/11 siguen abiertos.** `indice.json` se escribe directo
  (`indexar.py:1215`; `filtrar_indice.py:41`): un corte a la mitad publica un índice roto y la corrida siguiente
  muere al leerlo. No hay un solo `os.replace` en el código de producción. Y `mercadolibre.vendedores()` devuelve
  `[]` ante un error de red (`mercadolibre.py:132-137`): un corte de 30 s vacía el rubro sin aviso (E1/E2 del
  11/11).
- **A8. Privacidad: el término buscado sale sin filtrar a GoatCounter.** `js/pagina.js:107-113` manda
  `busqueda/<término>` tal cual; el filtro de datos personales (`terminoLimpio`,
  `js/buscadas.js:41`) solo se aplica a la lista publicada. Un mail o un DNI pegado en el buscador sale del
  navegador, contra el principio V de la constitución (S9 del 11/11).
- **A9. Worker expuesto y sin observabilidad.** `workers_dev = true` mantiene `pichincha-afuera.*.workers.dev`
  abierto sin control de origen (`worker/wrangler.toml:8`); el tope de 30 pedidos por minuto vive en memoria y se
  vacía entero al pasar las 5.000 entradas; `wrangler.toml` no tiene `[observability]` y `CACHE_VERSION` se sube a
  mano (S3, P9, P10, P11 del 11/11).
- **A10. Diseño: la pantalla de inicio no se entiende en 5 segundos.** El porcentaje de descuento mide 67 px contra
  25 px del precio en el celular (D4 del 11/11), la tarjeta reserva 212 px de foto que no existe (V2), la pastilla
  de tienda pesa más que «Abrir» (V3) y la primera oferta empieza a ~600 px (V4). Sigue todo abierto.

### P2 — después

- **A11. CSP con `unsafe-inline` en scripts y estilos** (`index.html:11`, `sitio.json`): criterio cumplido (no hay
  `unsafe-inline` nuevo, no hay `unsafe-eval`, `object-src 'none'`), pero mientras siga, la CSP no frena un XSS.
  Aceptado en `CONSTRAINTS.md`.
- **A12. Deuda de CSS** (T2-T9 del 11/11): 69 colores a mano, 47 tamaños de letra, `.ocard` definida 3 veces,
  tokens sin usar. Un test que falle si un `var(--x)` no existe habría atajado T1 y D3.
- **A13. `uses:` de los workflows con tag móvil** y no con SHA (S5), y `npx --yes wrangler` sin lockfile en
  `worker.yml` (S4).
- **A14. E2E sin los casos del plan**: títulos largos, 0 resultados, letra al 200 %. Son los tres que ya
  encontraron algo (058 y 10/11) y hoy no vuelven a correr.

## Lo que el plan da por falta y ya está hecho

El plan (sección 1, «Lo que ya sabemos que falta») dice que el cálculo de ofertas en un Web Worker está
pendiente. **Ya está**: `js/indice-ofertas.js:71` crea `js/ofertas-worker.js` (spec 037, PR #187; la tarea larga
bajó de 1.157 a 419 ms). Falta el índice partido por rubro, que es la spec 064 y espera la decisión del dueño
sobre Cloudflare KV.

## Puerta de la Fase 1: **no está en verde**

Para abrirla faltan, en este orden:

1. `id`, `shortcuts` y las capturas del manifiesto (A2) y `assetlinks.json` en `publicar_app.py` (A1).
2. Áreas táctiles de 48 px en pestañas y segmentos, con la e2e que las mida (A3).
3. `axe` en la e2e y los tres casos feos del plan (A4, A14).
4. `/?q=` en el job de Lighthouse y decidir si el umbral sube a 95 (A5).
5. Texto de `/legal/` con correo y derechos, y el correo de contacto en la ficha (A6) — decisión del dueño.
6. `os.replace` para `indice.json` y que un error de red no borre un rubro (A7).
7. `terminoLimpio` antes del evento de búsqueda (A8).
8. La jerarquía de la tarjeta de ofertas: precio igual o más grande que el porcentaje (A10).

Para repetir las mediciones que faltan: `/medir-indice` (con red), `npx playwright test --workers=1` sobre
`_sitio` armado, y el job `lighthouse` de `tests.yml` sobre un PR de prueba.
