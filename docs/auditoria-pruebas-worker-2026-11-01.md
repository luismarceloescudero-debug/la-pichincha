# Auditoría 2: calidad web, pruebas y Worker, devolución sobre la app (02/11/2026)

Método: skill `web-quality-audit`. Lighthouse 12.8.2, celular por defecto (4G lenta simulada y CPU x4) y escritorio. Dos mediciones:
**A.** el sitio **publicado** (antes de este PR) y **B.** el sitio armado con **las correcciones de este PR**, con el índice
real publicado (9,5 MB, 1,79 MB gzip) servido comprimido como GitHub Pages. Una corrida por página (puede variar unos puntos).
Los LCP del lab de B incluyen la descarga simulada de ese índice; la fuente de las letras nuevas no se pudo cargar (sin salida a Google).

## Evidencia

| Página | Medición | Rend. | Acc. | B. prác. | SEO | Agentic | LCP | TBT |
|---|---|---|---|---|---|---|---|---|
| `/` celular | A publicado | 100 | 100 | 100 | 100 | — | 1,5 s | 30 ms |
| `/` celular | B con el PR | 100 | 100 | 100 | 100 | 100 | 1,1 s | 20 ms |
| `/hoy/` celular | B | 100 | 100 | 100 | 100 | 100 | 0,9 s | 0 ms |
| `/contacto/` celular | B | 100 | 100 | 100 | 100 | 100 | 0,9 s | 0 ms |
| `/` escritorio | B | 100 | 100 | 100 | 100 | 100 | 0,3 s | 0 ms |
| **Buscar** celular | A publicado | 45 | 97 | 100 | 100 | — | 13,3 s | 2.760 ms |
| **Buscar** celular | B con el PR | 48 | **100** | 100 | 100 | 100 | 11,9 s | 1.730 ms |
| **Ofertas** celular | B con el PR | 47 | **100** | 100 | 100 | 100 | 12,9 s | 2.030 ms |
| **Ofertas** escritorio | B con el PR | 77 | **100** | 100 | 100 | 100 | 2,1 s | 310 ms |

Pruebas: JS 745/745, Python 617 OK, e2e 21/21 (con `--workers=1`). Buscar y Ofertas dieron 97 y 96 en accesibilidad antes de corregir:
áreas táctiles de 16-19 px en «mismo modelo» y contraste 4,35 / 3,59 en el precio tachado y los contadores de los chips; ya corregidos.

## Hallazgos

### Alto
- **Buscar y Ofertas en celular siguen lentas: rendimiento 47-48, LCP ~12 s, TBT ~1,7-2 s.** No se corrige con retoques; se midió:
  - El índice pesa **1,79 MB comprimidos** y se baja entero. A 4G lenta simulada, eso ya son ~9 s. Por campo: `imagen` 520 KB (29 %),
    `url` 528 KB, `nombre` 498 KB, `precio` 131 KB. La búsqueda **no muestra fotos**.
  - CPU: ~0,6 s de JS sin limitar, repartido en muchas funciones chicas (categorías, regex, normalizar 31.000 nombres); no hay un solo culpable.
  - Probado sin efecto: `content-visibility` en las filas y empezar a bajar el índice desde `index.html`. Se revirtieron.
  - Opciones reales: **(a)** sacar `imagen` de `indice.json` (≈ −29 %, ~2,5 s menos, no alcanza para 2,5 s); **(b)** partir el índice por rubro
    (primer paso de `docs/plan-v3.md`); **(c)** buscar del lado del servidor en el Worker (D1/FTS5, ya prevista). Decisión del dueño.

### Medio
- **Caché de GitHub Pages `max-age=600`**: no se cambia sin Cloudflare delante del sitio.
- **22 scripts bloquean el primer dibujo** (`render-blocking-insight`); la portada igual da 100. Margen de mejora, no falla.

### Bajo
- `unminified-javascript` (decisión de «sin build»); CSS sin usar.

## Corregido y verificado en este PR
- Ofertas con el diseño D + F3: sin desborde horizontal a 375 y 1100 px, claro y oscuro; sin errores de consola; 6 tarjetas de igual altura.
- Contraste y áreas táctiles (accesibilidad 100 en Buscar y Ofertas).
- Precio de relleno `$999.999.999` fuera del índice (test).
- Medición `/medir-indice` (índice 31/10): 43 ofertas, 0 repetidas; ya no aparece la RTX 5080 «−70 %» de la auditoría del 30/10 (spec 056).

## Sin hallazgos (verificado)
- Portada, `/hoy/`, `/precios/` y `/contacto/`: 100 en las cinco categorías; Core Web Vitals en verde; CLS 0.
- SEO: JSON-LD de `/precios/` solo `BreadcrumbList`, `CollectionPage`, `ItemList`; Search Console verificada y sitemap leído.
- Formulario de contacto de punta a punta; Email Routing (MX, DKIM, SPF) correcto.

## Worker `pichincha-afuera`
- Sin claves en el código; CORS solo para `https://pichinchadeldia.com.ar` y localhost; `/enlace` rechaza `169.254.169.254` y `localhost`.
- eBay responde en vivo; `afiliado: false` hasta desplegar con `EBAY_CAMPAIGN_ID` (secreto ya cargado). Tiendamia: `HTTP 403`, conocido.

## Prioridad recomendada
1. Decidir cómo adelgazar el índice (a, b o c): es lo único que impide verde en Buscar y Ofertas en celular.
2. Desplegar el Worker para que eBay lleve la campaña.
3. Caché y scripts bloqueantes, solo si se quiere más.

## Límites
- Medición B es local (el PR no está publicado) y de una corrida por página; en un celular real puede diferir.
- Fuentes F3 sin medir (Google Fonts bloqueado en el entorno); la CI de Lighthouse del PR sí las mide.
- Sin datos de usuarios reales (CrUX) ni prueba con lector de pantalla.
