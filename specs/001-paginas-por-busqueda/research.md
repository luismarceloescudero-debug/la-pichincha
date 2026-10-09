# Research: Paginas por busqueda popular

Skills de SEO consultadas: programmatic-seo, schema, site-architecture, seo-audit.

## D1. Una sola logica de analisis para pagina y comparativa
- **Decision**: extraer `analizarConsulta` a `js/analisis.js` (parametrizado con el indice, marcas y alias) y usarlo en `index.html` y en un generador Node.
- **Rationale**: FR-004 exige el mismo resultado; duplicar la logica en Python se desfasaria. Node ya esta en CI.
- **Alternativas**: portar a Python (riesgo de divergencia, doble mantenimiento); renderizar con navegador sin cabeza (pesado, fragil).

## D2. Estructura de URL
- **Decision**: subcarpeta `/precios/<slug>/` con indice hub `/precios/`; slug = consulta sin acentos, minusculas, guiones; unico (error si colisiona).
- **Rationale**: programmatic-seo y site-architecture: subcarpetas consolidan autoridad; hub y spokes dan enlazado interno; URL con barra final para Pages.
- **Alternativas**: subdominio (parte la autoridad); `?q=` (no indexable bien).

## D3. Paginas finas
- **Decision**: minimo de 5 opciones comparables; debajo, pagina "sin opciones suficientes" con `noindex` y fuera del sitemap; la URL se conserva.
- **Rationale**: programmatic-seo: mejor 100 buenas que miles finas; no romper enlaces ya indexados.
- **Alternativas**: no generar (404 en URL indexadas); indexar todo (riesgo de contenido fino).

## D4. Datos estructurados
- **Decision**: JSON-LD con `ItemList` (hasta 20 productos con `Product` + `Offer` en ARS), un `AggregateOffer` (lowPrice, highPrice, offerCount, priceCurrency) y `BreadcrumbList`.
- **Rationale**: skill schema; precios reales del dia. Se evita `AggregateRating` (no hay resenas).
- **Alternativas**: solo `ItemList` (sin rango de precios).

## D5. Contenido unico por pagina
- **Decision**: cada pagina lleva mediana, rango, mejor compra con razon, reparto por comercio, que quedo afuera y por que; el parrafo introductorio se arma con esos datos, no es una plantilla con variables.
- **Rationale**: programmatic-seo: valor unico por pagina.

## D6. Precios sin verificar
- **Decision**: usar `Pagina.precioDel(relevado, generado)` por fuente; el generador marca "precio del 7/10" en la fila.
- **Rationale**: FR-017 y principio II.

## D7. Lista de consultas
- **Decision**: `consultas.json`; la lista inicial sale del indice (rubros con muchos avisos y 3 o mas comercios) y la revisa el dueño.
- **Rationale**: FR-014; la analitica aun tiene pocos datos.

## D8. Dominio
- **Decision**: base de URL en una constante (`BASE_URL`) con el dominio de GitHub Pages; cambia en un solo lugar con el `.com.ar`.
- **Rationale**: FR-015.

## D9. Sitemap y robots
- **Decision**: `sitemap.xml` con `lastmod` = fecha de los precios, solo paginas indexables; `robots.txt` con `Allow: /` y `Sitemap:`. El script de GoatCounter se mantiene en las paginas.
