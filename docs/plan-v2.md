# Plan v2: escalado maximo de La Pichincha

Escrito el 2026-10-14, despues de cerrar el plan de escalado original (F0 a F3.1). Este plan lo
continua: usa como referencia a ComparaYa (comparador local), Tiendamia y Loquieroaca (compra
internacional con precio puesto) y cubre cada aspecto de la app. Las reglas de la constitucion
(`.specify/memory/constitution.md`) siguen valiendo; donde este plan pide cambiarlas, lo dice.

## 1. Donde estamos (medido el 13 y 14/10)

| Aspecto | Hoy |
| --- | --- |
| Fuentes | 6 (CompraGamer, Gaming City, Mexx, FullH4rd, Venex, ComparaYa); Mexx en mantenimiento y FullH4rd bloqueada |
| Indice | ~9.500 avisos, 2,9 MB crudo; se baja entero al navegador |
| Identidad de producto | por codigo de modelo: 13-39% con codigo, casi sin grupos en RAM y SSD |
| Historial | 6 dias; los sellos de 30 y 90 dias aparecen desde el 6/11 y el 5/1 |
| SEO | 50 paginas por busqueda + /precios/ + /hoy/, sitemap enviado, Search Console verificado |
| Canales | Telegram automatico, RSS, /hoy/ para Instagram, WhatsApp con vista previa |
| Dominio | github.io; lapichincha.com sin registrar; pichinchadeldia.com.ar delegado a Cloudflare |
| Usuarios y monetizacion | casi cero trafico; sin ingresos |

## 2. Que hacen bien los referentes y que nos falta

| Que | ComparaYa | Tiendamia / Loquieroaca | La Pichincha hoy |
| --- | --- | --- | --- |
| Cobertura | 64-73 tiendas, mas de 180 mil productos | Amazon, eBay, Walmart y tiendas de EE.UU. y China | 6 fuentes, ~9.500 avisos |
| Filtros | tienda, precio, descuento, cuotas sin interes, envio gratis, excluir palabras | por tienda de origen | sellos y orden, pocos filtros |
| Alertas de precio | email y notificaciones por precio objetivo o baja | no | no |
| Historial | grafico de meses | no | sellos 30/90 dias (sin grafico) |
| Precio puesto | carrito con envio por tienda | **precio final en pesos con impuestos y envio** | envio a Mendoza solo en la curada |
| Reputacion de tiendas | resenas por tienda | garantia propia | no |
| Contenido | guias de compra | no | veredicto y comparativa curada |
| Lo que nadie tiene | | | **que conviene y por que**, ofertas verificadas contra historial propio, fecha real de cada precio |

**Diferencial a construir:** el unico comparador que responde, con el precio puesto en tu casa,
*que conviene comprar, si conviene esperar y si conviene importar*.

## 3. Metricas norte y objetivos

| Metrica | 30 dias | 90 dias | 180 dias |
| --- | --- | --- | --- |
| Clics salientes a tiendas por semana (norte) | 100 | 1.000 | 5.000 |
| Visitas organicas por mes | 500 | 5.000 | 30.000 |
| Suscriptores (Telegram + alertas) | 100 | 1.000 | 5.000 |
| Paginas indexadas | 60 | 300 | 1.000 |
| Ingresos | 0 | primer cobro de afiliados | cubre dominio y servicios |

Se miden en GoatCounter, Search Console y el canal. Si a los 90 dias el norte no pasa de 300, se
para todo lo nuevo y se trabaja solo distribucion.

## 4. Fases

Cada fase va en su propia sesion de Claude Code (asi ninguna agota el contexto), con spec-kit para
el que, Superpowers y TDD para el como, y merge con la CI en verde. Entre parentesis, la skill que
la guia.

### Fase A. Base para crecer (semanas 1-2)

- A1 **Dominio propio** lapichincha.com: registrar (dueño), DNS, `sitio.json`, Search Console de
  dominio y Bing. pichinchadeldia.com.ar redirige a /hoy/ (ya armado en Cloudflare).
- A2 **Auditoria de calidad** con umbrales escritos en `CONSTRAINTS.md` (`constraint-driven-development`):
  Lighthouse movil >= 90 en rendimiento, accesibilidad, buenas practicas y SEO; WCAG AA;
  cobertura de tests de la logica pura >= 80%.
- A3 **Rendimiento** (`webperf`, `performance-optimization`): partir `indice.json` por rubro y bajar
  solo el que se busca (gatillo de la F4 ya cerca: 2,9 MB crudo); imagenes en WebP con tamaño fijo.
- A4 **Seguridad y legal** (`security-and-hardening`, `security-review`): CSP estricta, revisar
  enlaces externos, pagina de terminos, privacidad (GoatCounter sin cookies) y aviso de afiliados.
- A5 **Salud de fuentes visible**: pagina /estado/ con la hora del ultimo relevamiento de cada
  tienda (sale de `salud.json`), para que el usuario sepa que esta al dia.

Sale cuando: dominio andando, Lighthouse >= 90, indice partido, CONSTRAINTS.md en CI.

### Fase B. Cobertura y busqueda al nivel de ComparaYa (semanas 2-6)

- B1 **Mas fuentes locales** (`source-driven-development` para cada sitio): Maximus, ArmyTech,
  Compumarket, Logg, Integrados Argentinos; respetando robots.txt y la constitucion (nunca esquivar
  bloqueos). Meta: 12 fuentes, 25 mil avisos.
- B2 **Mercado Libre** como fuente directa con su API oficial y links de afiliado (dueño: cuenta de
  desarrollador y de afiliado).
- B3 **Identidad por GTIN/EAN**: Venex publica `og:gtin`; sumarlo a `modelo.py` para agrupar el mismo
  producto entre tiendas con dato duro. Meta: 40% agrupado en RAM, SSD y placas.
- B4 **Filtros** como ComparaYa: tienda, rango de precio, cuotas sin interes, envio gratis, solo
  primera linea, excluir palabras. Requiere capturar cuotas y envio por aviso (campos nuevos al
  final del indice, con su valor por defecto en `FILA_VACIA`).
- B5 **Rubros**: de hardware a tecnologia completa (notebooks, celulares, monitores, audio, gaming)
  sin perder el foco: cada rubro nuevo entra con sus reglas de "comparable".

Sale cuando: 12 fuentes, 25 mil avisos, filtros en la busqueda y en /precios/.

### Fase C. "¿Comprar aca o importar?" (semanas 6-10, el diferencial)

- C1 **Reglas de importacion versionadas** en `importacion.json`: franquicia y alicuotas del regimen
  courier y del postal, tasa estadistica, IVA, con fuente oficial (ARCA/Aduana) y fecha de
  verificacion. Las reglas cambian seguido: si una tiene mas de 60 dias sin verificar, la pagina lo
  avisa (principio II).
- C2 **Precio de referencia en EE.UU.** por codigo de modelo/GTIN, de una fuente con acceso permitido
  (API oficial o programa de afiliados de Amazon, Newegg o Best Buy; nada de scraping bloqueado).
- C3 **Calculadora "puesto en tu casa"**: precio local mas barato verificado contra importar por
  courier (estimado con C1), y contra Tiendamia o similares cuando publiquen precio final.
  Veredicto: "conviene aca", "conviene importar (ahorras X, tarda N dias)" o "da lo mismo".
- C4 **Pagina por producto** con ese veredicto, historial y donde comprarlo (programmatic-seo):
  es la pagina que nadie en Argentina tiene.

Sale cuando: 200 productos con veredicto local contra importado, reglas con fecha y fuente.

### Fase D. Retencion (semanas 8-14)

- D1 **Alertas de precio** por email y Telegram: precio objetivo, baja porcentual o "minimo historico".
  Primer backend: Cloudflare Workers + D1 (plan gratis; la cuenta ya existe). **Requiere enmendar la
  constitucion** (principio I, gatillo de la F4), decision del dueño.
- D2 **Grafico de historial** por producto cuando haya 30 dias (6/11).
- D3 **Carrito comparador** de ComparaYa: armar una PC o una compra de varios productos y que proponga
  "todo en una tienda", "hasta dos tiendas" o "maximo ahorro", con envio al codigo postal.
- D4 **Reputacion de tiendas**: tiempo real de entrega, garantia y reclamos publicos, con fuente.
- D5 **Guias de compra** (`programmatic-seo`, `seo-audit`): "que SSD comprar en 2026", "DDR4 o DDR5",
  armadas con los datos del dia, no texto generico.

Sale cuando: 1.000 alertas activas, grafico en vivo, carrito usado 100 veces por semana.

### Fase E. Monetizacion y escala (mes 3 en adelante)

- E1 **Afiliados**: Mercado Libre (hasta 15% segun rubro), tiendas locales con programa propio,
  couriers. Siempre rotulado y sin tocar el orden (principio II).
- E2 **CPC o acuerdos con tiendas** mostrando los clics salientes medidos; a cambio, feeds oficiales
  (resuelve bloqueos como el de FullH4rd).
- E3 **Instagram automatico**: tarjeta /hoy/ generada como imagen y publicada por la API de Meta
  (dueño: cuenta profesional y app de Meta). Solo si GoatCounter muestra que Instagram trae clics.
- E4 **Busqueda del lado del servidor** (Worker + SQLite FTS) cuando el indice pase 40 mil avisos.
- E5 **Notificaciones push** de la app instalable para las alertas.

## 5. Transversal, en cada fase

- **Calidad**: `CONSTRAINTS.md` en CI; nunca bajar un umbral para pasar (doubt-driven-development
  en decisiones de alto impacto).
- **Revision**: `code-review` o `review` antes de cada merge grande; `ship` antes de cada fase.
- **Observabilidad**: salud de fuentes, cobertura y tiempos de la Action en el resumen de cada corrida.
- **UX**: `frontend-ui-engineering` y `ui-ux-pro-max` para filtros, carrito y graficos; capturas
  claro/oscuro y movil en cada PR.
- **Datos honestos**: cada precio con fuente y fecha; reglas de importacion con fecha de verificacion.

## 6. Que hace cada uno

| Dueño (necesita tus cuentas o tu decision) | Claude Code |
| --- | --- |
| Registrar lapichincha.com | DNS, GitHub Pages, cambio de direccion, verificacion |
| Cuenta de desarrollador y afiliado de Mercado Libre | Fuente ML, links de afiliado rotulados |
| Decidir la enmienda de la constitucion para el backend (D1) | Workers + D1 + alertas, con tests |
| Programas de afiliados de EE.UU. o tiendas locales | Integracion y medicion |
| Difusion semanal (comunidades, historias con /hoy/) | Textos, tarjetas y medicion de que trae clics |
| Escribirle a FullH4rd por permiso o feed | Reactivar la fuente cuando haya acceso |

## 7. Orden de ejecucion

1. Fase A completa (base; la mayoria sin depender del dueño salvo el dominio).
2. Fase B1, B3 y B4 en paralelo por sesiones separadas (archivos distintos).
3. Fase C (el diferencial) apenas haya identidad por GTIN suficiente.
4. Fase D cuando el dueño apruebe el backend y haya 30 dias de historial.
5. Fase E segun las metricas.

Gatillos para frenar y replantear: el norte estancado 30 dias, una fuente principal bloqueada sin
acuerdo, o el costo de servicios por encima de lo que entra.
