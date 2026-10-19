# Mapa del repo

Para que una sesion nueva entienda La Pichincha sin perder el hilo: **que corre, en que orden, que archivo
es dueño de que y que tocar para cada cambio comun**. Verificado contra el codigo el 16/10/2026; las
referencias `archivo:linea` son de esa fecha. El **por que** de cada pieza esta en el [README](../README.md)
y el **como se trabaja** en [proceso-de-trabajo.md](proceso-de-trabajo.md): aca solo se enlazan.

Este mapa existe porque el grafo de codigo no ve el pegamento de este repo (workflow YAML, JSON de
configuracion, llamadas por `subprocess`): ver [proceso-de-trabajo.md, seccion 3.2](proceso-de-trabajo.md#32-graphify-medido-el-16102026-no-se-adopta).

## 1. El flujo de una publicacion

`.github/workflows/actualizar.yml` corre todos los dias a las 12:00 UTC (L9), a mano (`workflow_dispatch`,
L10) y en cada push a `main` que no sea solo `.md` (L19). Los pasos van en este orden; los que terminan
en `|| echo "::warning::..."` no voltean la publicacion si fallan.

```mermaid
flowchart TD
    subgraph WF["actualizar.yml"]
        T["tests (tests.yml, L37)"] --> H["checkout rama historial (L47)"]
        H --> A["python actualizar.py (L62)"]
        A --> AC["commit datos.json + index.html si cambio un precio (L66, no en push)"]
        AC --> CA["cache de indice.json, clave hash de indexar.py + tiendas.json (L84)"]
        CA --> IX["python indexar.py --historial historial (L99, continue-on-error)"]
        IX --> HC["commit en la rama historial (L104, solo con 12 paginas)"]
        HC --> SA["python salud.py salud.json (L122, solo schedule)"]
        SA --> PS["armar _sitio: index.html, img, js, css, indice.json (L124)"]
        PS --> PO["node generar_portada.js (L139)"]
        PO --> GP["python generar_paginas.py (L142)"]
        GP --> PA["python publicar_app.py (L153)"]
        PA --> FE["node generar_feed.js (L156)"]
        FE --> VO["python verificar_ofertas.py (ML por su API, WooCommerce por su API, agregador por la tienda)"]
        VO --> IN["node generar_info.js (L164)"]
        IN --> GU["node guardia.js (alarma: issue 'guardia' y sin Telegram)"]
        GU --> TG["python publicar_telegram.py (schedule o manual, sin alarma de la guardia)"]
        TG --> CO["python generar_cotizaciones.py (L180)"]
        CO --> CB["python cobertura.py (L183)"]
        CB --> UP["upload-pages-artifact _sitio"]
        UP --> DP["job publicar: deploy-pages"]
    end

    DJ[("datos.json")] --> A
    A -- "reinyecta entre los marcadores DATOS" --> IH["index.html"]
    TJ[("tiendas.json")] --> IX
    IX -- "import" --> MOD["historial.py, serie.py, modelo.py, salud.py"]
    IX --> IJ[("indice.json")]
    IX --> SJ[("salud.json")]
    IX --> FJ[("fichas.json y CSV por mes, en la rama historial")]
    SJ --> SA
    SA -- "subprocess gh (salud.py:86)" --> IS["issue salud-fuente"]
    CJ[("consultas.json")] --> GP
    GP -- "subprocess node generar_paginas.js (generar_paginas.py:89)" --> GPJ["generar_paginas.js"]
    IJ --> GPJ
    DJ --> GPJ
    GPJ --> PR["_sitio/precios/, sitemap.xml, robots.txt"]
    PA -- "subprocess git rev-parse (publicar_app.py:34)" --> SW["_sitio/sw.js con __VERSION__ estampada"]
    IJ --> FE
    FE --> OF["_sitio/ofertas.xml, ofertas.json, hoy/"]
    OF --> TG
    TG --> TEL["canal de Telegram"]
    IJ --> IN
    SJ --> IN
    IN --> EL["_sitio/estado/, legal/"]
    CO --> CT["_sitio/cotizaciones.json"]
    IJ --> CB
    CB --> CJS["_sitio/cobertura.json"]
    ST[("sitio.json")] --> GPJ
    ST --> FE
    ST --> CB
```

Puntos que no se ven en el codigo Python ni JS:

- **`indice.json` no esta en git.** Lo arma `indexar.py` (escribe en `indexar.py:520`) y viaja directo a
  `_sitio/`. Si la fuente falla, se publica el de la cache (L84-91). En un push a `main` solo se rearma
  si no hay cache (L95-98).
- **El historial vive en la rama huerfana `historial`**: un CSV por mes y `fichas.json` (`indexar.py:50`).
  Se trae con un segundo checkout (L47) y se commitea desde ese directorio (L104).
- **Tres llamadas por `subprocess`**: `generar_paginas.py:89` corre `node generar_paginas.js`,
  `publicar_app.py:34` pide el commit con `git rev-parse` y `salud.py:86` abre issues con `gh`.
- **Los generadores de Node reusan los modulos del navegador** con `require`: `generar_paginas.js:14-16`
  carga `js/buscador.js`, `js/analisis.js` y `js/pagina.js`; `generar_feed.js:12` carga `js/ofertas.js`;
  `generar_portada.js` corre los scripts de la pagina en `vm`. Cambiar uno de esos modulos cambia el sitio
  **y** las paginas generadas.
- **`importacion.json` viaja con la app**: no lo copia el paso L124 sino `publicar_app.py`
  (`ARCHIVOS_DE_LA_CASCARA`), igual que el manifiesto, y el service worker lo guarda para usarlo sin red.
  La pestaña **Costo de importar** (`js/vista-costo.js`) lo pide al abrirse, junto con `cotizaciones.json`.
- **`tests.yml` corre dos veces**: en cada PR y como primer job de cada publicacion (L37). Su job
  `lighthouse` arma un `_sitio` propio con el indice publicado y los mismos generadores.

## 2. Que archivo es dueño de que

| Tema | Dueño | Lo usan | Tests |
| --- | --- | --- | --- |
| **Fuentes** (tiendas) | `tiendas.json` (una clave por fuente; `catalogo.tipo` elige el indexador: `listados`, `json`, `api` o `woocommerce`, este ultimo con `indexar_woocommerce` para cualquier tienda WooCommerce cuyo `robots.txt` no prohiba `/wp-json/wc/`) | `indexar.py`, `tests/capturar.py`, la clave de la cache del workflow (L88) | `tests/test_indexar.py`, `tests/test_indexar_corrida.py`, fixtures en `tests/fixtures/<tienda>/` |
| **Precios seguidos** (Comparativa curada) | `datos.json` (productos, veredicto, marcas) | `actualizar.py` (extractores en `actualizar.py:140`), que lo reinyecta en `index.html` (`actualizar.py:285`) | `tests/test_actualizar.py`, `tests/test_build.py` |
| **Indice del buscador** | `indexar.py` | `js/buscador.js`, `js/indice-ofertas.js`, los generadores de Node | `tests/test_indexar*.py`, `tests/js/buscador.test.js` |
| **Historial y sellos de serie** | `historial.py`, `serie.py` (rama `historial`) | `indexar.py:424-425`, `cobertura.py` | `tests/test_historial.py`, `tests/test_serie.py` |
| **Identidad por codigo** | `modelo.py` (`RUBROS` L14, `_FORMAS` L32, `mpn_de_ficha` L116) | `indexar.py`, `cobertura.py`, `js/buscador.js` (`agruparPorModelo`) | `tests/test_modelo.py`, `tests/test_cobertura.py`, `tests/js/agrupado.test.js` |
| **Fichas** (part number de Venex y Mexx) | `ficha` en `tiendas.json` + `modelo.mpn_de_ficha`; cache en `fichas.json` de la rama `historial` | `indexar.py:276-340` | `tests/test_fichas.py`, fixtures `venex/ficha.html`, `mexx/ficha-pn.html` |
| **Salud de las fuentes** | `salud.py` | `indexar.py:505` escribe `salud.json`; el workflow abre el issue (L122); `generar_info.js` lo muestra en `/estado/` | `tests/test_salud.py`, `tests/js/info.test.js` |
| **Guardia del indice** | `guardia.js` (`medir`, `alarmas`) | el workflow la corre antes de Telegram, publica `_sitio/guardia.json` y con alarma abre el issue `guardia` y no manda Telegram | `tests/js/guardia.test.js` |
| **Verificacion en la fuente** | `verificar_ofertas.py` (`revisar_ml`, `revisar_woo`, `revisar_vtex`, `revisar_agregador`) | los dos pasos de verificacion del workflow; `diagnostico_enlaces.py` la corre sobre las candidatas publicadas | `tests/test_verificar_ofertas.py`, `tests/test_diagnostico_enlaces.py` |
| **Ofertas** (que es una) | `js/ofertas.js` | la pestaña Ofertas, `generar_feed.js`, `publicar_telegram.py` | `tests/js/ofertas.test.js`, `tests/js/feed.test.js` |
| **Calculadora de costos** | `js/costos.js` (el motor, sin cifras) + `importacion.json` (las reglas, con norma, fuente y fecha) + `js/calculadora.js` (formulario, desglose y URL, puro) + `js/vista-costo.js` (pegamento con la pagina) | la pestaña Costo de importar (`#costo`, `js/arranque.js` la pinta); `publicar_app.py` publica las reglas | `tests/js/costos.test.js`, `tests/js/calculadora.test.js`, `tests/test_importacion.py` |
| **Monedas** | `js/monedas.js` (en vivo, `URLS` L10, `TIPOS_DOLAR` L16) + `generar_cotizaciones.py` (copia del build, `URLS` L21) | el workflow (L180) escribe `_sitio/cotizaciones.json`; `sitio.json` habilita las tres APIs en `connect-src` | `tests/js/monedas.test.js`, `tests/test_cotizaciones.py`, fixtures en `tests/fixtures/monedas/` |
| **Portada** | `index.html` (estructura) + `js/` (modulos) + `css/sitio.css`; categorias curadas en `js/base.js:17` | `generar_portada.js` la pre-renderiza en `_sitio/` | `tests/js/portada.test.js`, `tests/js/app.test.js`, `tests/test_sitio.py`, `tests/test_contraste.py` |
| **Paginas por busqueda** | `consultas.json` + `generar_paginas.py` (valida y orquesta) + `generar_paginas.js` (escribe) | `js/analisis.js`, compartido con la Comparativa | `tests/test_generar_paginas.py`, `tests/js/generador.test.js`, `tests/js/pagina.test.js` |
| **PWA** | `sw.js` (marcador `__VERSION__`), `manifest.webmanifest`, `sin-red.html`, `js/app.js`, `publicar_app.py` | el workflow (L153) | `tests/js/sw.test.js`, `tests/test_publicar_app.py` |
| **Telegram y RSS** | `publicar_telegram.py` (lee `_sitio/ofertas.json`), `generar_feed.js` | secretos `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (L169-175) | `tests/test_publicar_telegram.py`, `tests/test_canal.py`, `tests/js/feed.test.js` |
| **Afiliados** (Amazon, E1) | `Pagina.enlaceAmazon` y `AMAZON_TAG` (`js/pagina.js`), `amazonHtml` (`js/vistas.js`) con el rotulo «enlace de afiliado» y `rel="sponsored"`; aviso en `/legal/#afiliados` (`generar_info.js`) | la busqueda sin resultados y el analisis de cada producto curado; el clic se mide como `clic_saliente/amazon.com` | `tests/js/pagina.test.js`, `tests/js/plus-ui.test.js` |
| **Direccion publica y CSP** | `sitio.json` | todos los generadores y `index.html` | `tests/test_sitio.py` |
| **Umbrales de calidad** | `CONSTRAINTS.md` | `tests.yml` (cobertura 85% Python; 90/85/85 JS; Lighthouse 90) | `.github/lighthouse.js`, `tests/js/lighthouse.test.js`, `tests/test_rendimiento.py` |
| **Tests** | `tests/` (Python, `unittest`) y `tests/js/` (`node --test`) | `tests.yml` | `tests/test_integracion.py` arma el sitio entero y revisa los enlaces |
| **Specs** | `specs/NNN-nombre/` (spec-kit: `spec.md`, `plan.md`, `tasks.md`) y la constitucion en `.specify/memory/constitution.md` | cada fase nueva arranca ahi | se cuentan las `- [ ]` de cada `tasks.md` |

## 3. Recetas

Cada receta termina corriendo las dos suites como la CI (con cobertura, ver `tests.yml`):

```bash
python -m unittest discover -s tests -t . -v
```

```bash
node --test "tests/js/*.test.js"
```

### Agregar una fuente

1. `python indexar.py --probar URL` con un producto de la tienda: dice que extractor generico sirve
   (`indexar.py:346`, `SONDAS`) y que poner en la configuracion. Antes, mirar su `robots.txt`.
2. Una clave nueva en `tiendas.json`, copiando la forma de una fuente del mismo `catalogo.tipo`
   (`json`, `api`, `woocommerce` o listados). Si la tienda es WooCommerce y su `robots.txt` no prohibe
   `/wp-json/wc/`, alcanza con `"tipo": "woocommerce"` y su `base`: no hace falta ninguna regex. Si publica el part number en la ficha, `ficha` con `rubros` y `tope`.
3. `python tests/capturar.py <clave>` guarda su HTML en `tests/fixtures/<clave>/`; sumar el caso a
   `tests/test_indexar.py` (y a `tests/test_fichas.py` si tiene `ficha`).
4. Si tambien va a seguir productos curados de `datos.json`, su extractor de precio vive en
   `actualizar.py:140` y su test en `tests/test_actualizar.py`.
5. Nada del workflow: la cache del indice se invalida sola porque su clave incluye el hash de
   `tiendas.json` (L88). Actualizar la tabla de fuentes del README.

### Agregar o cambiar una regla de importacion

1. La regla va en `importacion.json` con `valor`, `unidad`, `nivel`, `norma`, `fuentes`, `rige_desde` y
   `verificado`. Lo que no se confirma en la norma oficial va como pendiente y sin numero
   (`specs/010-costos/spec.md`).
2. Si la regla es nueva para el calculo, se usa en `js/costos.js` por su clave: **ninguna cifra en el
   codigo** (lo controla `tests/js/costos.test.js:264`).
3. Tests: `tests/test_importacion.py` (forma de cada regla) y `tests/js/costos.test.js` (los casos de
   referencia). Es plata y normativa: revision de cinco ejes con entradas reales y segunda opinion
   ([proceso-de-trabajo.md, 1.2](proceso-de-trabajo.md#12-reglas-para-llamar-a-otros-modelos)).

### Agregar un rubro

"Rubro" quiere decir tres cosas distintas en este repo; elegir cual:

- **Una categoria curada en la Comparativa**: una entrada en `CATEGORIAS` (`js/base.js:17`) y sus
  productos en `datos.json` con su `tipo`; despues `python actualizar.py --build`. Tests:
  `tests/test_build.py`, `tests/js/app.test.js`, `tests/js/portada.test.js`.
- **Un rubro con identidad por codigo de modelo**: sumarlo a `RUBROS` (`modelo.py:14`), a
  `_RUBRO_POR_INICIO` (L21) y su forma de part number a `_FORMAS` (L32), con nombres reales en
  `tests/test_modelo.py`. `cobertura.py` lo empieza a medir solo. Precision antes que cobertura.
- **Una pagina por busqueda** (`/precios/<slug>/`): una entrada en `consultas.json`; ver
  "Agregar una busqueda" en el README. Tests: `tests/test_generar_paginas.py`.

Rubros nuevos del catalogo (B5, spec 011) todavia esperan decisiones del dueño.

### Cambiar la calculadora (pestaña Costo de importar)

- **Un campo nuevo del formulario**: su parametro corto en `PARAMETROS` y su valor por defecto en
  `POR_DEFECTO` (`js/calculadora.js`), el campo en `formularioHtml` y, si va al motor, en `entradaDe`.
  La URL para compartir lo toma sola. `"q"` no se usa: es del buscador.
- **Un renglon nuevo del desglose** sale del motor (`js/costos.js`); en `js/calculadora.js` solo se le
  pone el nombre con tildes en `CONCEPTOS`.
- Tests: `tests/js/calculadora.test.js` (incluye los casos de referencia de la spec de punta a punta) y,
  si cambia la cuenta, `tests/js/costos.test.js`. Probarla en el navegador con `?v=800&d=20#costo`.

### Agregar una moneda o un tipo de dolar

- **Una moneda**: `js/monedas.js` toma todo codigo de tres letras que traigan open.er-api.com y
  frankfurter.dev; para que aparezca en el formulario, sumarla a `MONEDAS` en `js/calculadora.js`.
  Si la moneda no esta en ninguna fuente, hace falta una fuente nueva.
- **Una fuente de cotizaciones**: en **los dos** `URLS` (`js/monedas.js:10` y
  `generar_cotizaciones.py:21`) con su validacion (`_valida`, `generar_cotizaciones.py:45`), su dominio
  en `connect-src` de `sitio.json`, y su respuesta guardada en `tests/fixtures/monedas/`. Los tests nunca
  van a la red: el `fetch` se pasa por parametro.
- **Un tipo de dolar**: una entrada en `TIPOS_DOLAR` (`js/monedas.js:16`) con el `id` que usa dolarapi.com.
- Tests: `tests/js/monedas.test.js` y `tests/test_cotizaciones.py`.

## 4. Regla de mantenimiento

**Este mapa se actualiza en el mismo PR que cambie el flujo**: un paso nuevo o movido en
`actualizar.yml` o `tests.yml`, un script o JSON nuevo, una llamada por `subprocess`, un archivo que cambia
de dueño o una receta que deja de ser cierta. Los numeros de linea se corrigen cuando se toca ese archivo;
un PR que cambia el flujo sin tocar este mapa no se mergea.
