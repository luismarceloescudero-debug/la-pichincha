# Revision completa de la app con skills (24/10/2026)

**Status**: Arreglos implementados; decisiones pendientes del dueño al final.

**Input**: El dueño pidio una revision completa (mejoras y fallas) con las skills que se encontraran con find-skills, para
despues instalar la de mejor resultado y una de auditoria.

## Skills usadas (leidas antes de usarlas; ninguna instalada en el proyecto salvo find-skills)

| Skill | Origen | Como se corrio |
|---|---|---|
| web-quality-audit | addyosmani/web-quality-skills (32K instalaciones) | Lighthouse 12.8.2 movil sobre 5 paginas en vivo |
| web-perf | cloudflare/skills (108K) | Lighthouse (sin el MCP de DevTools) |
| web-design-guidelines | vercel-labs/agent-skills (778K) | las reglas de `web-interface-guidelines/command.md` contra `css/` y `js/` |
| seo-audit | coreyhaines31/marketingskills (236K) | titulos, descripciones, canonical, JSON-LD, robots.txt y sitemap en vivo |
| security-best-practices | openai/skills (11K) | `javascript-general-web-frontend-security.md` contra `js/` y el Worker |
| code-review | mattpocock/skills (790K) | dos sub-agentes (Estandares y Spec) sobre `60d0997...HEAD` |
| audit-website | squirrelscan/skills (74K) | **no se corrio**: necesita bajar y ejecutar su binario y el control de permisos de la sesion lo freno |

## Lo que salio bien

Portada, /hoy/ y /estado/: 100/100/100/100 en Lighthouse movil; /precios/: 99. Sin errores de consola ni respuestas
4xx/5xx en 12 paginas (movil y escritorio), sin desborde horizontal, los 211 links internos responden 200, el sitemap
(202 URLs, muestra de 25) responde 200. Sin `eval`, `document.write`, `postMessage` ni navegacion por `location`; los href
pasan por la lista blanca de `enlace()` y se escapan.

## Arreglado en esta tanda

- **Una familia ocupa un solo lugar en todas las categorias** (`js/ofertas.js`): `unico` era por categoria, y el relleno
  final no miraba lo ya elegido. Ahora es global.
- **El Worker no lee una pagina que redirige a otro host** (`worker/src/index.js`, `traer`): `paginaPermitida` se valida
  tambien con `r.url`.
- **Los errores del Worker no se guardan en cache** (`no-store` en 4xx y 5xx), y una busqueda con alguna fuente caida se
  guarda 15 minutos, no 8 horas.
- **`telegram.json` no se pierde** (`actualizar.yml`): se copia del sitio publicado antes de la guardia, asi un dia con
  alarma o un push sin nada que corregir no lo borra. **El respaldo de las 07:43** corre si falta el mensaje de hoy, no
  solo el indice (un push de madrugada que reindexa no dejaba el dia sin Telegram).
- **Accesibilidad** (Lighthouse): `.tenue` usaba `opacity` y el verde de «primera línea» quedaba en 2,5:1 → color
  `--ink-3`; «Ver aviso» con `aria-label` «Ver aviso de <tienda>» (WCAG 2.5.3); la tabla de compras internacionales de
  `/precios/` lleva encabezados.
- **Web Interface Guidelines**: `transition: all` en `.seg` lista sus propiedades; `touch-action: manipulation` en
  controles.
- **SEO**: la portada se titulaba solo «La Pichincha» → «La Pichincha · comparador de precios de hardware en Argentina»; la
  busqueda pone la consulta en el titulo; JSON-LD `WebSite` con `SearchAction`; la descripcion decia «13 fuentes» (hoy son
  mas de 20).

## Pendiente: decisiones del dueño

1. **El Worker «Afuera» es un backend** y la constitucion (principio I) dice «No hay backend mientras no se dispare un
   gatillo de la Fase 4»; la spec 022 no hizo el Constitution Check. Hay que enmendar la constitucion o justificarlo.
2. **Busqueda lenta en telefono**: Lighthouse movil da 71 de rendimiento en `/?q=…` con 2,3 s de bloqueo; `arranque.js`
   hace una tarea larga de 2 s (buscar y analizar 31 mil avisos). Propuesta: correr la busqueda en un Web Worker o por
   partes.
3. **Tachados de Mercado Libre**: el 24/10, 7 de las 10 ofertas del dia eran tachados de ML (ComparaYa) de 33% a 58% sin
   historia propia. Propuesta: exigir confirmacion contra el mismo modelo en otras tiendas o un tope menor para ML.
4. **Hecho (24/10)**: Costo de importar (`js/vista-costo.js`): al pegar un link, el precio leido pisaba lo que la persona ya
   habia escrito en la calculadora (spec 023: «no se pisa si la persona ya escribió»). El precio copiado de la calculadora
   cuenta como escrito salvo que lo haya puesto una lectura anterior (`dataset.leido`). Probado en Chromium con una respuesta
   del Worker simulada: con 150 escrito antes queda 150; sin nada, precarga 198,88; antes del arreglo el 150 pasaba a 198,88.
5. **No es falla**: el Veredicto sin busqueda fija la consulta mas reciente; la spec 021 lo pide asi (punto 2). Lo de «no fija
   la consulta ni cambia la URL» es de la Comparativa sin busqueda, y se cumple.
6. Menores: SRI para el script de GoatCounter; la cadena de `if` por tienda repetida en `js/importar.js` y el Worker; la
   lista `paths` de `worker.yml` copia los imports a mano; `fiabilidad.ANULADAS` tambien saca las revisiones buenas del
   24/10 (a proposito, conservador).
