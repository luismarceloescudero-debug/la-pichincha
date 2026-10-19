# Proyectos de referencia

Que hacen los proyectos de codigo abierto a la altura de La Pichincha, que adoptamos y que queda como idea. Relevado el 19/10/2026 con `gh search repos` y los README de cada proyecto; las estrellas y el ultimo commit son de ese dia. Regla que no cambia: nada que esquive controles antibots (Cloudflare, captchas, proxies rotativos, cambiar de IP o de identidad).

## Proyectos

| Proyecto | Estrellas | Licencia | Que resuelve | Como lo resuelve | Para nosotros |
|---|---:|---|---|---|---|
| [matiasbontempo/ratoneando-go](https://github.com/matiasbontempo/ratoneando-go) | 54 | - | Comparador de supermercados argentinos ([ratoneando.ar](https://ratoneando.ar)) | Las APIs publicas de las tiendas VTEX, con un comando para el hash de las consultas persistidas | **Adoptado**: verificacion e indexacion directa por la API de catalogo de VTEX (ver abajo) |
| [clucraft/PriceGhost](https://github.com/clucraft/PriceGhost) | 1.125 | - | Seguidor de precios de cualquier sitio | Cuatro extracciones en paralelo (JSON-LD, CSS generico, IA, reglas del sitio) que "votan" el precio; si no coinciden, decide la persona | Idea 1: votar el precio en la pagina (hoy alcanza con que aparezca) |
| [dgtlmoon/changedetection.io](https://github.com/dgtlmoon/changedetection.io) | 35.123 | Apache-2.0 | Cambios en paginas, precio y reposicion de stock | Chrome por Playwright, "browser steps" y reglas en lenguaje natural con un LLM | Idea 2: esperar a que la pagina termine de cargar en vez de un tiempo fijo |
| [Cybrarist/Discount-Bandit](https://github.com/Cybrarist/Discount-Bandit) | 753 | - | Seguidor multiusuario (Amazon, AliExpress, eBay) | Un extractor por tienda y alertas por umbral | Ya lo hacemos por configuracion (`tiendas.json`) |
| [dedupeio/dedupe](https://github.com/dedupeio/dedupe) | 4.518 | MIT | Encontrar el mismo registro escrito distinto | Aprendizaje activo: una persona marca pares dudosos y el modelo aprende | Idea 3: proponer pares del mismo producto para revisar, nunca agrupar solo |
| [zinggAI/zingg](https://github.com/zinggAI/zingg) | 1.256 | AGPL-3.0 | Resolucion de identidad a escala | ML sobre Spark | Demasiado pesado para un sitio estatico |
| [microsoft/playwright](https://github.com/microsoft/playwright) | 98.066 | Apache-2.0 | Motor de navegador para automatizar | Chromium, Firefox y WebKit con espera de red | Idea 2 |
| [mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy) | 45.739 | MIT | Ver el trafico de una app o una web | Proxy HTTPS que intercepta | **Instalado** el 19/10 (`pip install --user mitmproxy`, 12.2.3) para estudiar APIs publicas; para HTTPS hace falta instalar su certificado, que es decision del dueño |
| Herramientas de ingenieria inversa web (ZAP, webcrack, Wakaru, HTTP Toolkit, MCP de navegador) | | | Ver `docs/ingenieria-inversa.md` | | | Instaladas y medidas el 19/10 |
| [NationalSecurityAgency/ghidra](https://github.com/NationalSecurityAgency/ghidra) | 91.294 | Apache-2.0 | Ingenieria inversa de programas compilados | Desensamblador y decompilador | El mas valorado de ingenieria inversa, pero trabaja sobre binarios: no sirve para APIs web |
| [OpenDataCordoba/precios_claros](https://github.com/OpenDataCordoba/precios_claros) | 28 | - | Datos de Precios Claros (gobierno) | Descarga del portal oficial | Solo supermercados: no cubre tecnologia |
| Detectores de descuentos falsos (varios con 0 estrellas) | 0 | - | Descuentos inflados | Modelos de ML de juguete | Nuestras reglas con historial propio son mas solidas |

## Adoptado el 19/10

**API de catalogo de VTEX para lo que llega por ComparaYa.** Muchas tiendas argentinas usan VTEX y su API publica (`/api/catalog_system/pub/products/search/{slug}/p`) da el precio y el stock de cada producto, igual que en la pagina. Desde los servidores de GitHub respondio en unas 25 tiendas que llegan por ComparaYa: OnCity, Naldo, Dricco, Cetrogar, Coppel, Pardo, Authogar, BGH, Sony, Motorola, Bringeri, Compra Cierta, Easy y otras. En una PC, Carrefour respondio precio 0 y stock 0 para un celular que ComparaYa daba en stock a $692.999: una oferta caida que antes se escapaba. Carrefour, Samsung, Tidi y parte de LG no responden desde GitHub: quedan con la revision por la pagina. Esta en `verificar_ofertas.revisar_vtex`; `python diagnostico_enlaces.py --vtex indice.json` lo prueba sobre el indice publicado.

**Lo que se midio de ComparaYa** (para no volver a medirlo): no publica cuando leyo cada precio, ni en el listado ni en la ficha, y abrir la ficha no lo refresca. En una muestra de 12 avisos de Fravega abiertos en una PC, 9 tenian el precio exacto, 2 un precio mas bajo que el real (Acer Nitro VG240Y $299.999 contra $359.999; Odyssey OLED G8 27" $2.488.729 contra $2.729.241) y 1 uno mas alto. Sirve para el buscador; no alcanza para publicar una "pichincha" sin verificar.

**Tiendas VTEX como fuentes directas** (antes idea 1). La misma API lee su catalogo de tecnologia con precio y stock del dia (`indexar.indexar_vtex`, `"tipo": "vtex"` en `tiendas.json`). Medido desde GitHub el 19/10: 13 tiendas dan 3.331 avisos en stock, 3.144 que no llegaban por ComparaYa (OnCity 1.908, Carrefour 613, Naldo 161...); el indice pasa de 22.375 a 25.036 avisos y la guardia no encontro alarmas. Esta vez Carrefour si respondio desde GitHub. Afuera: Cetrogar (robots.txt prohibe `/api/`), Samsung (503), Tidi (no devuelve JSON), Sony y Easy (no aportan tecnologia) y las farmacias y perfumerias. El detalle por tienda esta en el README (Fuentes).

## Ideas, por prioridad

1. **Votar el precio en la pagina** (PriceGhost): hoy una oferta que llega por un agregador se confirma si el precio aparece en la pagina de la tienda. Leer ademas el JSON-LD (`offers.price`, `availability`) y exigir que coincidan daria un chequeo mas fino (un precio que aparece en "productos relacionados" no confirmaria).
2. **Esperar la carga de red, no un tiempo fijo** (changedetection.io, Playwright): `verificar_ofertas.renderizar` le da a Chrome un tiempo virtual de 9 segundos. Playwright espera a que la red quede quieta; con eso bajarian las paginas que se juzgan a medio cargar.
3. **Proponer pares del mismo producto** (dedupe): la identidad es estricta a proposito (codigo exacto, nunca por parecido). Un modelo que proponga pares dudosos para que una persona los confirme ampliaria la cobertura sin el riesgo de agrupar mal.
4. **Descuento contra el precio mas bajo de los ultimos 30 dias**: es la regla europea para anunciar una rebaja (Directiva Omnibus, 2019/2161). Con el historial propio (empezo el 7/10) se puede aplicar desde el 6/11 y reemplazaria al tachado de la tienda como referencia.

Fravega no entra por ninguna de estas vias: le devuelve a GitHub la pagina de bloqueo de CloudFront y su API tambien lo bloquea. La via es oficial: pedirle un feed o un programa de afiliados, como se hizo con Tiendamia y Loquieroaca.
