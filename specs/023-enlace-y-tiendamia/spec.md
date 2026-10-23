# Feature Specification: Leer el link pegado y Tiendamia en vivo

**Created**: 2026-10-23

**Status**: Implementada (Worker y página). Se activa con el despliegue del Worker (`worker.yml`).

**Input**: El dueño dijo que el cuadro de links «no reconoce ni carga datos» y preguntó si el buscador ya busca solo en Amazon y Loquieroacá. Medido en el sitio publicado (main `cc2a9df`, con el Worker desplegado): dos formas comunes de link de Amazon daban `null`, ninguna tienda completaba el precio y `/buscar` no tenía ninguna fuente activa sin credenciales.

## Decisiones

### 1. Reconocer los links de Amazon que se pegan de verdad

`parsearEnlace` (`js/importar.js`) busca el ASIN con `amazonDeRuta`. Reconoce:

- **Amazon en español**, que es lo que abre Amazon desde Argentina: `/-/es/<slug>/dp/<ASIN>/...`. El idioma no cuenta como nombre.
- Varios segmentos antes de `/dp/`, y `/gp/product/` y `/gp/aw/d/` con o sin idioma.
- **Patrocinados**: `/sspa/click?...&url=/<slug>/dp/<ASIN>`. El parámetro `url` vale solo como ruta interna de Amazon; un `https://otro` o un `//otro` da `null`.
- **Amazon de otros países** (`amazon.es`, `.de`, `.fr`, `.it`, `.co.uk`, `.com.mx`, `.com.br`, `.co.jp`): se reconocen con su moneda y sin el tag de afiliado, que es solo de amazon.com. La calculadora suma MXN.
- Una imagen (`m.media-amazon.com`) no es un producto.

### 2. Leer el precio del link pegado: `GET /enlace?url=`

El Worker lee **una** página por pegada, con caché de 8 horas por link.

- **Tiendamia**:
  - Lee la ficha canónica en `tiendamia.com.ar`. Su `robots.txt`, leído el 23/10, permite `/p/` y `/search/` y prohíbe `/producto`, `/api/`, `/ajax/`, carrito y cuenta. Sus términos no prohíben el acceso automatizado.
  - El precio sale de los datos de la página (`final_price`). Es el precio **en dólares con el envío incluido**: con la moneda en U$S la ficha muestra «U$S 198,88 … con envío».
  - El ARS que muestra la página (AR$367.455) usa otra cotización y no se usa.
  - `pricing_rules` muestra que es el precio de Amazon (169,98) más el recargo de Tiendamia (28,90).
- **Loquieroacá**:
  - Lee la ficha `/products/<id>`. Es una ficha que pegó una persona, no una búsqueda, así que no toca su cupo de búsquedas (spec 022).
  - El nombre sale del `<h1>`.
  - El precio **en un pago** ($538.616,10) va como «puesto en casa», como el precio de transferencia del índice. El precio en cuotas ($598.462,33) va aparte.
  - El **tachado** ($946.999,00, `line-through`) no es un precio real y nunca se usa.
- **Amazon**: nunca se lee la página. Con la Creators API (cuando haya acceso) se usa GetItems, la única ruta documentada; la forma de la respuesta se confirma con la primera llamada real. Sin la API, el precio se escribe a mano.
- **eBay**: `get_item_by_legacy_id` de la Browse API, cuando haya credenciales.
- **Seguridad**: solo se pide la URL canónica que arma `parsearEnlace` y, además, el Worker comprueba por su cuenta que el host sea `tiendamia.com.ar` o `www.loquieroaca.com` por https (`paginaPermitida`). Un link de otro lado da 400 y no se pide nada.
- **En la página** (`js/vista-costo.js`): al pegar, se pide `/enlace`.
  - Con Tiendamia, Amazon o eBay, el precio leído precarga el campo (en dólares) y la calculadora.
  - Con Loquieroacá se muestra el precio en pesos ya puesto en casa, en un pago y en cuotas, sin pasar por la calculadora.
  - Lo leído se puede cambiar y no se pisa si la persona ya escribió.
  - Si el link no trae nombre, se muestra el leído.
  - Si falla, queda escribirlo a mano.
  - El campo dice la moneda de la tienda (EUR en amazon.es).

### 3. Tiendamia en vivo en `/buscar`

- Tiendamia entra como fuente sin credenciales: `tiendamia.com.ar/search/amazon/<palabras>`, con el user-agent identificado, caché de 8 horas y 5 segundos máximo. Se apaga con `TIENDAMIA = "apagada"` en el entorno del Worker.
- **Relevancia** (`relevantes`): sin esto, ordenar por precio ponía arriba fundas y otros modelos (medido con el Worker local).
  - Entra el aviso cuyo nombre tiene todas las palabras de la consulta, sin contar conectores («by», «de», «con»).
  - Se descartan los accesorios «para» el producto: se corta el nombre en la primera palabra de accesorio («funda», «estuche»…) y, si lo de antes no nombra todo lo buscado, es un accesorio. No se aplica si se busca justamente esa palabra.
  - Las variantes de color iguales se muestran una sola vez.
- La sección «Afuera» dice «con envío incluido» para Tiendamia.
- **El precio de la búsqueda de Tiendamia puede ser distinto del de la ficha.** El 23/10 el HTML de la búsqueda decía 216,24 y la ficha 198,88; un rato después la búsqueda también decía 198,88. La sección lo presenta como precio de esa tienda, y el link pegado lee el de la ficha.
- **Caché versionada**: la clave lleva `CACHE_VERSION`, así que un cambio de reglas no sirve lo guardado con las anteriores. El navegador guarda 15 minutos.

## Qué no se hace

- Leer páginas de Amazon (sin la API) o búsquedas de Loquieroacá (cupo pago, spec 022).
- Usar el ARS de Tiendamia o el tachado de Loquieroacá.

## Pruebas

- **Fixtures reales del 23/10/2026**, leídos con el user-agent del sitio: ficha y búsqueda de Tiendamia y ficha de Loquieroacá (`tests/fixtures/worker/`).
- `tests/js/worker.test.js` (35):
  - parsers de las tres páginas;
  - Tiendamia en `/buscar`;
  - `/enlace` para las cuatro tiendas, con y sin credenciales;
  - 400 sin pedir nada afuera;
  - ficha caída, relevancia y accesorios con los nombres reales;
  - `paginaPermitida`.
- `tests/js/importar.test.js`: las formas de link de Amazon que daban `null`, otros países y monedas, `leidoDeEnlace` y `urlLeerEnlace`. `tests/js/afuera.test.js`: el envío incluido.
- **Navegador**, con el Worker local (`wrangler dev`) haciendo lecturas reales:
  - «soundcore aeroclip 2 by anker» trae solo el AeroClip 2 y sus paquetes de Tiendamia, sin fundas.
  - El link de Tiendamia precarga U$S 198,88 y la calculadora da US$ 240,64.
  - El de Loquieroacá muestra $538.616 en un pago o $598.462 en cuotas.
  - Amazon en español, el patrocinado, amazon.es (en EUR) y eBay se reconocen y piden el precio a mano.
  - Probado en oscuro, claro y móvil a 375 px.
- Delegación en `docs/delegacion-modelos.md`.
