# Auditoria 2: calidad web del sitio publicado y Worker, devolucion sobre la app (01/11/2026)

Metodo: skill `web-quality-audit`. Lighthouse 12.8.2 contra **https://pichinchadeldia.com.ar** (sitio publicado), celular
por defecto (4G lenta simulada y CPU x4) y escritorio; mas tests, e2e y lectura del Worker. Una sola corrida por pagina:
la rendimiento puede variar unos puntos entre corridas.

## Evidencia

| Pagina | Rend. | Acc. | Buenas prac. | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` (celular) | 100 | 100 | 100 | 100 | 1,5 s | 30 ms | 0 |
| `/hoy/` (celular) | 100 | 100 | 100 | 100 | 1,3 s | 0 ms | 0 |
| `/precios/rtx-5060/` (celular) | 100 | 100 | 100 | 100 | 1,3 s | 0 ms | 0 |
| `/contacto/` (celular) | 100 | 100 | 100 | 100 | 1,2 s | 0 ms | 0 |
| `/` (escritorio) | 100 | 100 | 100 | 100 | 0,7 s | 0 ms | 0 |
| **`/?q=monitor 27 oled#buscar` (celular)** | **45** | **97** | 100 | 100 | **13,3 s** | **2.760 ms** | 0 |

Pruebas: JS 743/743, Python 616 OK, e2e 21/21 (con `--workers=1`). Comparacion con el 30/10: portada celular 83 → 100,
busqueda celular 34 → 45 (misma consulta; la diferencia chica puede ser ruido de la corrida).

## Hallazgos

### Alto
- **La busqueda en celular sigue lenta: rendimiento 45, LCP 13,3 s, TBT 2,76 s.** Es el unico caso fuera de verde.
  - Evidencia: `bootup-time` 2,6 s y `mainthread-work-breakdown` en rojo; 1.088 elementos en el DOM; el navegador baja y
    procesa el indice completo antes de mostrar resultados (ya figura en la auditoria del 30/10).
  - Fix recomendado: es el arreglo grande n.º 2 de la lista (indice por partes o busqueda del lado del servidor en el Worker).
    Tambien activa el gatillo «busquedas lentas en telefonos de gama baja» de la constitucion.

### Medio
- **Accesibilidad de la busqueda: 97, falla `target-size`** (areas tactiles chicas en la lista de resultados). Evidencia medida.
- **Cache de GitHub Pages: `max-age=600`** (`uses-long-cache-ttl`, `cache-insight`). Lo fija GitHub Pages; no se cambia sin
  poner Cloudflare delante del sitio. Efecto: en visitas repetidas se vuelve a pedir lo mismo cada 10 minutos.
- **Scripts que bloquean el primer dibujo** (`render-blocking-insight`) en la portada, y CSS sin usar (`unused-css-rules`).
  No bajan el puntaje de 100 de las paginas simples: es margen de mejora, no una falla.

### Bajo
- `unminified-javascript` en la portada: el sitio sirve los `js/` sin minificar (decision de «sin build»). Medido, sin efecto visible en el puntaje.

## Sin hallazgos (verificado)
- **Core Web Vitals en lab:** LCP < 2,5 s, TBT < 200 ms, CLS = 0 en todas las paginas salvo la busqueda con consulta.
- **SEO tecnico:** 100 en las cuatro paginas; el JSON-LD publicado de `/precios/rtx-5060/` solo trae `BreadcrumbList`,
  `CollectionPage` e `ItemList` (sin «Product» ni precios).
- **Search Console:** propiedad verificada por DNS y sitemap leido el 31/10 con estado «Correcto».
- **Formulario de contacto:** probado a mano de punta a punta (llega a Gmail y sale el acuse por Resend).

## Worker `pichincha-afuera` (lectura con el conector de Cloudflare)
- Codigo desplegado sin claves escritas (leen `env.*`); la lista de origenes permitidos es identica a la del repo.
- Origen ajeno: responde sin cabeceras CORS. `GET /enlace?url=` con `169.254.169.254` y `localhost`: 400 (sin SSRF).
- `GET /buscar` en vivo: eBay responde (Samsung 980 PRO, USD 209 + envio); Tiendamia da `HTTP 403`, conocido.
- eBay devuelve `afiliado: false` hasta cargar y desplegar `EBAY_CAMPAIGN_ID` (secreto cargado el 01/11; falta el despliegue).
- Email Routing: tres MX de Cloudflare, DKIM y SPF presentes, sin avisos (captura del dueño).

## Prioridad recomendada
1. Busqueda en celular (rendimiento y `target-size`): es la unica falla medida y la que ve cualquier visitante que busca.
2. Desplegar el Worker para que eBay lleve la campaña.
3. Cache (Cloudflare delante de GitHub Pages) y scripts bloqueantes: solo si la busqueda se resuelve y se quiere mas.

## Limites
- Una corrida por pagina, desde un entorno cloud: el rendimiento absoluto puede diferir en un celular real.
- Sin datos de usuarios reales (CrUX): el sitio todavia tiene poco trafico.
- No se midio la logica de ofertas ni el indice de 31.019 avisos (`/medir-indice` queda pendiente).
- No se probo un lector de pantalla con personas.
