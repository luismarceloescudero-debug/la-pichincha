# Seguridad del sitio propio: analisis pasivo con OWASP ZAP (19/10/2026)

**Alcance**: solo `https://pichinchadeldia.com.ar`, solo analisis **pasivo** (spider + reglas pasivas, **sin** escaneo activo), con ZAP 2.17.0 y un plan de automatizacion cuyo contexto incluye unicamente ese dominio. El spider alcanzo 5 paginas HTML (portada, `/precios/` y sus fichas, `/estado/`, `/legal/`) mas sus scripts, `robots.txt` y `ofertas.xml`; no ejecuta JavaScript, asi que las vistas armadas por el cliente no se recorrieron. Nunca se corrio contra otro sitio.

**Resultado**: 15 alertas (6 medias, 4 bajas, 5 informativas), **ninguna arreglable en el repo**: 8 son cabeceras o politicas que GitHub Pages no deja configurar o que son una decision ya documentada, y 7 son falsos positivos o informativas. No hay login, cookies, formularios ni backend: la superficie de ataque es la de un sitio estatico.

| Alerta de ZAP | Veredicto (verificado) | Por que |
| --- | --- | --- |
| CSP: wildcard directive (`img-src ... https:`) | Real, aceptada | Las fotos vienen de decenas de dominios de tiendas (y cambian con cada tienda nueva); no hay lista cerrada que sostener. Es solo imagenes, no scripts |
| CSP: `script-src 'unsafe-inline'` | Real, aceptada (CONSTRAINTS.md) | `index.html` lleva los datos del dia en un script en linea. Sacarlo pide un hash por build en la meta de todas las paginas y mover los `style=""`; el riesgo que cubre (XSS) no tiene vector hoy: no se refleja ninguna entrada |
| CSP: `style-src 'unsafe-inline'` | Real, aceptada | Hay un `<style>` en linea y atributos `style=""`; mismo costo que el anterior |
| `Access-Control-Allow-Origin: *` | Real, no arreglable | Lo pone GitHub Pages en todo. Todo lo publicado es publico (indice, feed, sitemap) |
| Falta cabecera anti-clickjacking | Real, no arreglable | `frame-ancestors` **se ignora en una meta CSP** y no hay `X-Frame-Options` sin cabeceras. Sin sesion ni acciones, un iframe no puede hacer nada util |
| Falta SRI (hoja de Google Fonts) | Real, no arreglable | Google sirve un CSS distinto segun el navegador: un hash fijo la rompe |
| Script de otro dominio (contador GoatCounter) | Por diseno | `gc.zgo.at/count.js` lo actualiza el proveedor (SRI imposible); esta autorizado en la CSP |
| HSTS no enviada | Real, no arreglable | GitHub Pages no la manda para dominios propios; el dominio ya fuerza HTTPS |
| `X-Content-Type-Options` ausente | Real, no arreglable | Cabecera de servidor |
| Timestamp Unix | **Falso positivo** | `1994500640` es el id `MLA-1994500640` de un enlace de MercadoLibre |
| Comentarios sospechosos | **Falso positivo** | Detecta la palabra «todo» (en espanol: «todo el catalogo») en 11 archivos JS |
| Atributo controlable por el usuario (`?q=webcam`) | **Falso positivo** | Medido: `/?q=ZZQ123xx` no devuelve el texto en ninguna parte; `data-cat="webcam"` es una categoria fija de la pagina estatica |
| Cache-control `max-age=600`, «retrieved from cache», «modern web application» | Informativas | Comportamiento normal de GitHub Pages (CDN) |

## Triaje con modelos (los modelos se equivocan)

Se le pidio la misma clasificacion a OmniRoute `rapido` (qwen3.8-27b y, en otra corrida, gpt-oss-20b) y a `revision` (cayo en Gemini 2.5 Flash). Contra el veredicto verificado de arriba acertaron 6 de 13 (qwen), 7 de 13 (gpt-oss-20b) y 7 de 15 (Gemini). Los errores mas graves, todos descartados:

- **«frame-ancestors en la meta tag corrige el clickjacking»** (Gemini): falso, el navegador ignora esa directiva en una meta.
- **«XSS reflejado en `?q=`»** (Gemini y qwen): falso, se midio que no se refleja.
- **«SRI para Google Fonts y GoatCounter»** (los tres): rompe el sitio o se desactualiza.
- **«Borrar los TODO»** (Gemini): eran la palabra «todo» en castellano.

Conclusion: el triaje con modelos chicos sirvio para ordenar, no para decidir; cada alerta se resolvio midiendola contra el sitio.

## Que haria falta para cerrar lo pendiente

- Sacar `unsafe-inline` de scripts y estilos: generar el hash SHA-256 del script de datos en `publicar_app.py` y escribirlo en la meta CSP de cada pagina (con `sitio.json` como fuente y el test de que coinciden), y pasar los `style=""` a clases. Es un cambio de varios archivos y de la portada pre-renderizada: PR propio.
- Cabeceras reales (HSTS, nosniff, frame-ancestors): solo con un CDN delante (p. ej. Cloudflare) o cambiando de hosting; decision del dueno.

Repetir el analisis: `zap.bat -cmd -autorun plan.yaml` con un plan de `spider` + `passiveScan-wait` + `report` sobre un contexto que incluya solo `https://pichinchadeldia.com.ar/.*`.
