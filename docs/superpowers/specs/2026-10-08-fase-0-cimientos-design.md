# Fase 0: cimientos. Diseño

Escrito el 2026-10-08 sobre `b1560da`. Ejecuta la Fase 0 de
`docs/plan-de-escalado.md` (tareas F0.1 a F0.8). Las decisiones se cerraron en
brainstorming con el dueño del proyecto.

## Objetivo

Dejar La Pichincha lista para medir y para crecer sin romper nada. No se suma UI
nueva fuera de lo que piden estas tareas.

**Criterio de salida** (del plan):

1. La analitica registra eventos.
2. Un link con `?q=` abre la busqueda.
3. El historial de precios sobrevive a que se borre la cache de Actions.
4. CI corre los tests en verde.

**Restricciones:**

- Ninguna dependencia nueva en Python: solo stdlib.
- Commits en español sin tildes, como el resto del historial.
- No se pushea a `main` sin el OK del dueño, porque cada push despliega.

## Decisiones tomadas

| Tema | Decision | Por que |
| --- | --- | --- |
| Analitica | GoatCounter, cuenta `mescudero` (`https://mescudero.goatcounter.com/count`) | Cloudflare Web Analytics no tiene eventos personalizados. Para eso hace falta Zaraz, que exige que el dominio pase por Cloudflare. GoatCounter no usa cookies y es gratis para uso publico razonable |
| Historial | Rama huerfana `historial` con un CSV por mes `AAAA-MM.csv` y columnas `fecha,tienda,id,precio`. `id` es la URL completa y un precio vacio significa "dejo de publicarse" | El commit diario toca solo el mes en curso. Con las bajas registradas, un producto que vuelve no se compara contra un precio de hace meses |
| Copia del artifact | `comparativa-ram-ddr4-16gb.html` la genera el build y sale del repo (`.gitignore`) | `index.html` pasa a ser el unico archivo que se edita, y los diffs dejan de venir duplicados |
| Hora real | Se muestra en Buscar, en Ofertas y en el sello de arriba, sin commits diarios extra en `main` | El sello hoy muestra la fecha del ultimo cambio de precio aunque los precios se hayan chequeado hoy |
| Modulos JS | Scripts clasicos en `js/`, como IIFE que exponen `Buscador` y `Pagina`, y se exportan para Node con `module.exports` | Andan en Pages, con `file://` y en `node --test`. Es un primer paso hacia F1.1 |

## Hallazgos del repo que condicionan el diseño

- **La fuente hoy es la copia.** `actualizar.py --build` inyecta `datos.json` en
  `comparativa-ram-ddr4-16gb.html` y de ahi deriva `index.html`. F0.7 lo invierte.
- **Choque de claves en `precios.json`.** La clave es solo la URL. Hay 114 URLs
  de CompraGamer que tambien publica ComparaYa, en general con el mismo precio
  pero no siempre, y una pisa a la otra. Eso puede inventar una baja que no
  existio. El historial nuevo usa `(tienda, id)` como clave.
- **Las fuentes caidas no se notan en el indice.** Cuando una fuente falla,
  `indexar.py` publica sus filas del indice anterior. El chequeo de salud tiene
  que contar lo que trajo la corrida, no lo que se publica.
- **Los fixtures cuidan nuestro codigo, no a las tiendas.** Los tests con HTML
  guardado detectan que nosotros rompimos un extractor. Que una tienda cambie su
  plantilla lo detecta F0.6.
- **GoatCounter respeta el canonical.** Toma el path de la pagina de
  `<link rel="canonical">`, y no cuenta visitas desde `localhost` ni dentro de
  un iframe.
- **`zoneinfo` en Windows necesita el paquete `tzdata`.** Argentina usa UTC-3
  fijo sin horario de verano, asi que alcanza con
  `timezone(timedelta(hours=-3))`.

## Diseño por tarea

### F0.1 Analitica sin cookies

El tag va en el `<head>` de `index.html`, adentro de un bloque
`<!-- solo-web -->` para que el build lo saque de la copia del artifact:

```html
<script id="gc" data-goatcounter="https://mescudero.goatcounter.com/count"
        async src="https://gc.zgo.at/count.js"></script>
```

Hay un `<link rel="canonical" href="https://luismarceloescudero-debug.github.io/la-pichincha/">`.
Por eso la pagina vista se cuenta como `/la-pichincha/` aunque la URL traiga `?q=`.

**Envio.** `medir(evento)` llama a
`goatcounter.count({ path, title, event: true })`. Si el script todavia no cargo
(es `async`), el evento queda en una cola que se vacia en el `load` del script.
Si el script esta bloqueado, por ejemplo por un adblock, los eventos se pierden
sin error.

**Eventos.** El nombre va en `path` y el detalle en `title`:

| Evento | `path` | `title` | Cuando |
| --- | --- | --- | --- |
| `busqueda` | `busqueda/<termino>` | `<n> resultados` | Cuando la busqueda se asienta: en el mismo temporizador de 1,2 s de `consultar()` que guarda el historial, en `compararConsulta()` y al abrir un link con `?q=`. No se repite si el termino es igual al anterior |
| `busqueda_vacia` | `busqueda_vacia/<termino>` | | En los mismos momentos, en lugar de `busqueda`, cuando no hay resultados |
| `clic_saliente` | `clic_saliente/<comercio>/<rubro>` | | Un solo listener de `click` y `auxclick` en `document`, para cualquier `a[href]` de otro host |
| `compartir` | `compartir/<modo>/<vista>` | | `modo` es `nativo` o `copiar`. Sale del handler de `data-acc` que ya existe |
| `exportar` | `exportar/<modo>/<vista>` | | `modo` es `excel`, `csv` (cuando falla el CDN) o `imprimir` |

**Detalles de cada campo:**

- `<termino>` es `normalBusq(q)`: minusculas, sin acentos y con las unidades
  pegadas ("1 TB" -> "1tb"), recortado a 60 caracteres.
- `<n>` es la cantidad de avisos que coinciden, el largo de `buscarTodo(q)`.
- `<comercio>` sale de `comercioDeUrl(href)`: el host sin `www.`, con tres
  etiquetas si termina en `.com.ar` y dos en el resto. Por ejemplo,
  `articulo.mercadolibre.com.ar` queda `mercadolibre.com.ar`.
- `<rubro>` se busca por URL en un mapa armado una sola vez. Para las filas
  del indice es `categoriaDe(nombre)`. Para los productos curados sale del
  `tipo`: `ram` y `ram-ref` dan `memoria`, `webcam` y `webcam-ref` dan
  `webcam`. Si no aparece, es `otro`.
- `<vista>` es el `data-de` del boton.

No se toca ninguno de los lugares donde se arman links.

### F0.2 La busqueda va a la URL

Formato: `?q=ssd+1tb#comparativa`. `q` guarda la consulta activa (`CONSULTA`) y
el hash sigue guardando la pestaña.

**Funciones puras en `js/pagina.js`:**

- `leerUrl(search, hash)` devuelve `{ q, vista }`. `q` va recortado y con un
  maximo de 100 caracteres, o `""` si tiene menos de 2.
- `armarUrl(pathname, q, vista)` usa `URLSearchParams`, que escribe los
  espacios como `+`. Sin `q` no pone `?`, y sin vista no pone `#`.

**Escritura.** Cada vez que cambia la consulta (`marcarConsulta()`, que llaman
`fijarConsulta` y `limpiarConsulta`), la URL se reescribe con
`history.replaceState`, solo si cambio y dentro de un `try` porque Safari limita
la cantidad de llamadas. Las pestañas siguen usando `location.hash`, asi que
Atras recorre pestañas como hoy.

**Atras y Adelante.** `popstate` y `hashchange` llaman a un solo `alNavegar()`,
agrupado para que se ejecute una vez por navegacion.

- Si el `q` de la URL es distinto de `CONSULTA`, vuelve a fijar la consulta (o
  la limpia) antes de `aplicar(vista)`.
- Si es igual, solo aplica la vista, como hoy.

**Apertura con `?q=`.**

1. `#vista` muestra "Armando la comparación de «q»…" con el estilo `.sub` que
   ya existe.
2. Se baja el indice con `asegurarIndice()`.
3. Se llama a `fijarConsulta(q)`.
4. Con analisis: `guardarHist(q)`, evento `busqueda` y
   `aplicar(vista || "comparativa")`.
5. Sin resultados: evento `busqueda_vacia`, `aplicar("buscar")` con el termino
   en el campo, y la vista muestra "sin resultados" como hoy.
6. Si no carga el indice: `aplicar(vista || "comparativa")` con el contenido
   curado, y la URL queda como estaba.

**Links compartidos.** Todo lo que viene de `aTexto()` (Compartir y Copiar)
termina con `enlaceActual()`, que es `location.origin` +
`armarUrl(pathname, CONSULTA, vista)`. En la vista Buscar, `q` sale del campo.

"Ver el análisis curado" saca el `q` de la URL. Los alias viejos de hash
(`#memorias`, `#webcams`) siguen andando.

### F0.3 Open Graph y Twitter Card

**Tags.** En el `<head>`, adentro del bloque `solo-web`, todos con URLs
absolutas:

- `og:type`, `og:site_name`, `og:locale` (`es_AR`), `og:title`, `og:description`
  y `og:url`;
- `og:image` (`https://luismarceloescudero-debug.github.io/la-pichincha/img/og.png`),
  con `og:image:width` 1200, `og:image:height` 630 y `og:image:alt`;
- `twitter:card` (`summary_large_image`), `twitter:title`,
  `twitter:description` y `twitter:image`.

La `meta description` pasa a ser fija: ya no lleva la fecha, asi no cambia todos
los dias.

**Imagen.**

- **Formato:** `img/og.png` de 1200x630 y menos de 300 KB, con la estetica del
  sitio (IBM Plex y la paleta de `:root`).
- **Texto:** nombre, lema y "precios de 5 fuentes de Argentina". Sin cantidades
  que se vuelvan viejas.
- **Fuente:** se edita en `docs/og-imagen.html` y se renderiza con Edge headless:

  ```
  msedge --headless=new --hide-scrollbars --window-size=1200,630 --virtual-time-budget=4000 --screenshot=img/og.png docs/og-imagen.html
  ```

- **Versionado:** el PNG se commitea. No se regenera en CI.

### F0.4 Historial de precios en la rama `historial`

**Rama y formato:**

- **Rama:** huerfana, `historial`. En la raiz tiene los `AAAA-MM.csv` y un
  `LEEME.md` corto que explica el formato.
- **CSV:** columnas `fecha,tienda,id,precio`, UTF-8 sin BOM, fin de linea `\n`,
  escrito con el modulo `csv`.
- **Valores:** `fecha` es la fecha argentina de la corrida (`AAAA-MM-DD`).
  `precio` va en pesos enteros, o vacio cuando el producto deja de publicarse.

**Modulo `historial.py`** (stdlib):

- `leer(carpeta)` recorre los `AAAA-MM.csv` ordenados por nombre y devuelve
  `{(tienda, id): precio}`. La ultima fila gana, y una fila con el precio vacio
  borra la clave. Si la carpeta no existe, devuelve `{}`.
- `vivos_por_tienda(estado)` devuelve un `Counter` con la cantidad de productos
  vivos por tienda.
- `cambios(estado, actuales, relevadas, sanas, fecha)` devuelve las filas
  nuevas:
  - un precio por cada producto nuevo o con otro precio, en las fuentes
    `relevadas`;
  - una fila de baja (precio vacio) por cada producto vivo que no aparecio,
    solo en las fuentes `sanas`.
- `escribir(carpeta, fecha, filas)` agrega las filas al CSV del mes de `fecha`
  y escribe el encabezado si el archivo es nuevo.

**Cambios en `indexar.py`:**

- Nuevo argumento `--historial DIR`, por defecto `historial/`. Se van
  `PRECIOS` y `precios.json`.
- El valor `antes` de cada producto sale de `estado[(clave, url)]`. Ese mismo
  cambio arregla el choque entre CompraGamer y ComparaYa.
- **Fuentes relevadas.** Por cada fuente procesada en esta corrida se guarda
  `relevados[clave] = len(items)`; si fallo, es 0. Las fuentes que no se tocan
  (`--solo`, `activa: false`) no participan ni escriben filas.
- **Fuentes sanas.** Una fuente relevada es sana si su estado de salud es
  `ok`: no fallo, trajo al menos un producto y
  `previo == 0 or relevados >= 0.7 * previo`, donde `previo` es
  `vivos_por_tienda(estado)[clave]`. Es la misma regla que usa `salud.json`
  (F0.6). Si un producto aparece dos veces en una misma fuente, la ultima fila
  gana.
- Escribe las filas con `historial.escribir()` y deja `salud.json` (ver F0.6).
- `generado` pasa a ser fecha y hora (ver F0.8). La `fecha` del CSV son sus
  primeros 10 caracteres.

**Arranque.** Se crea la rama con un unico commit que trae `2026-10.csv`, armado
una sola vez desde el `indice.json` local del 2026-10-07 (8.506 filas con su
tienda, deduplicadas por `(tienda, url)`), y el `LEEME.md`. El script que lo arma
es descartable y queda fuera del repo. Pushear la rama nueva necesita el OK del
dueño.

**Localmente.** Si no existe `historial/`, la corrida se comporta como la
primera. Con la historia real: `git worktree add historial historial`.
`historial/` va al `.gitignore` de `main`.

### F0.5 Tests

**Python** (`python -m unittest discover -s tests -t .`). Los tests nunca salen
a la red, porque `bajar()` se reemplaza con `unittest.mock.patch`.

- **Fixtures.** Van en `tests/fixtures/<tienda>/`.
  - **Gaming City, Mexx y FullH4rd:** `listado.html` con las primeras 4
    tarjetas tal como las ve `tarjetas()` (los trozos entre separadores,
    completos), y `producto.html` con la pagina de un producto curado de
    `datos.json`, sin `<script>` ni `<style>`.
  - **CompraGamer:** `catalogo.json` con 5 filas.
  - **ComparaYa:** `api.json` con 5 filas.
- **Captura.** `tests/capturar.py` los baja con el `bajar()` del proyecto y los
  recorta. Si al sacar los scripts el extractor ya no da el mismo resultado que
  con la pagina completa, guarda la pagina completa. Se vuelve a correr cuando
  F0.6 avisa que una tienda cambio: el test falla y se corrige la regex en
  `tiendas.json`.
- **`test_indexar.py`.** Prueba `tarjetas()` con la configuracion real de
  `tiendas.json` contra cada listado, `indexar_json` e `indexar_api` con
  `bajar` reemplazado, y ademas `numero`, `limpio`, `absoluta` e `imagen`.
  Tambien prueba que `main()` arma `antes` por `(tienda, url)` y escribe el
  historial y `salud.json`, todo en una carpeta temporal.
- **`test_actualizar.py`.** Prueba `precio_meta`, `precio_itemprop`, `precio_og`
  y `precio_compragamer` contra los fixtures.
- **`test_historial.py`.** Prueba el plegado, las bajas, la reaparicion, los
  archivos mensuales, el encabezado y las fuentes sanas contra las que no.
- **`test_salud.py`.** Prueba el umbral, una fuente que fallo, una fuente sin
  previo, el indexado caido, y el titulo y el cuerpo del issue.
- **`test_build.py`.** Prueba `armar_artifact()` y `construir()` contra copias
  temporales del `index.html` real.

**JS** (`node --test "tests/js/*.test.js"`):

- **`js/buscador.js` expone:**
  - `normal`, `normalBusq` y `esMedida`;
  - `mediana`, `pisoDeGama` y `ordenar(filas, med, orden, nivelMarca)`;
  - `armarMarcasRe(marcas)` y `marcaDe(nombre, marcasRe, alias)`;
  - `specsDe`, `motivoExclusion` y `categoriaDe`.

  Lleva tambien las constantes que usan: `REGLAS_EXCLUSION`,
  `ACCESORIOS_INICIO`, `ES_HDD`, `ES_SSD` y `ALIAS_MARCA`.
- **`js/pagina.js` expone:** `leerUrl`, `armarUrl`, `cuando`, `comercioDeUrl`,
  `eventoBusqueda`, `eventoClic` y `eventoAccion`.
- **Integracion con la pagina.** El script principal desestructura lo que usa y
  conserva envoltorios con el mismo nombre que hoy, por ejemplo
  `function ordenar(filas, med) { return Buscador.ordenar(filas, med, ORDEN, nivelMarca); }`.
  Asi el resto del codigo no cambia.
- **Casos.** Salen de las reglas del README:
  - "SSD para notebook" no se excluye;
  - "HD SSD 960GB SIMIL 1TB" queda afuera buscando "1tb";
  - "silla simil cuero" sigue entrando;
  - "2tb" no encuentra "12tb";
  - Recomendado manda al fondo el piso de gama;
  - la marca es la primera que aparece ("Notebook HP Intel" da HP);
  - `cuando()` con fechas fijas y con un `generado` sin hora.

### F0.6 Salud de fuentes

**`salud.json`**, que escribe `indexar.py`:

```json
{"fecha": "2026-10-08T15:25-03:00", "umbral": 0.7,
 "fuentes": {"mexx": {"nombre": "Mexx", "previo": 909, "ahora": 210, "estado": "baja"}}}
```

`estado` puede ser `ok`, `baja` (menos del 70%) o `fallo` (excepcion o 0
productos).

**Modulo `salud.py`:**

- `alertas(salud)` es una funcion pura que devuelve las fuentes en `baja` o
  `fallo`. Si `salud.json` no existe (el indexado entero se cayo), devuelve una
  alerta "indexado".
- `titulo(alerta)` devuelve por ejemplo `Fuente con pocos productos: Mexx`.
- `cuerpo(alerta, url_corrida)` arma el texto del issue: los numeros, el link a
  la corrida y que revisar (`indexar.py --probar`, recapturar los fixtures).
- `main(ruta, seco)`:
  - corre `gh label create salud-fuente --force`;
  - por cada alerta, busca un issue abierto con la etiqueta y el mismo titulo
    exacto (`gh issue list --label salud-fuente --state open --json number,title`);
  - si existe, le agrega un comentario con los numeros del dia; si no, abre uno
    nuevo;
  - con `--seco` solo imprime lo que haria.

En la Action corre solo en la ejecucion programada, con
`GH_TOKEN: ${{ github.token }}` y el permiso `issues: write`.

### F0.7 Una sola fuente del HTML

`index.html` es el unico archivo que se edita a mano. Lleva marcadores
`<!-- solo-web -->` y `<!-- /solo-web -->` alrededor de lo que solo va en la
web: `doctype`, `html`, `head` con meta, Open Graph, canonical, GoatCounter y el
estilo base del esqueleto.

**`actualizar.py`:**

- `construir(datos, pagina=INDICE, copia=COPIA, verificado=None)` reemplaza el
  bloque `DATOS` en `index.html` en el mismo archivo, con la misma regex que hoy.
  Despues escribe la copia con `armar_artifact(html, leer)`, que:
  - saca los bloques `solo-web`;
  - saca `<body>`, `</body>` y `</html>`;
  - cambia cada `<script src="js/x.js"></script>` por `<script>` con el
    contenido del archivo.

  El resultado tiene la forma de la copia actual: arranca en `<title>`, sin
  esqueleto, y es un solo archivo.
- `comparativa-ram-ddr4-16gb.html` va al `.gitignore` y se saca del indice de
  git con `git rm --cached`. Se arma con `python actualizar.py --build`.

### F0.8 Hora real de la ultima actualizacion

**Lo que se graba:**

- `indexar.py`: `generado = datetime.now(AR).isoformat(timespec="minutes")`, por
  ejemplo `2026-10-08T15:25-03:00`.
- `actualizar.py`: cuando releva de verdad (sin `--build` ni `--dry-run`), pasa
  `verificado` con la misma forma a `construir()`. `verificado` va en el `DATOS`
  inyectado, pero **no** se guarda en `datos.json`.
- La Action commitea a `main` solo si cambio `datos.json`
  (`git diff --quiet datos.json || ...`), y en ese caso agrega `datos.json` e
  `index.html`. El sitio publicado siempre lleva la hora real. El `index.html`
  commiteado lleva la del ultimo cambio de precio.

**`Pagina.cuando(iso, ahora)`** devuelve "hoy 15:25", "ayer 15:25" o
"7/10 15:25", en hora argentina con `Intl.DateTimeFormat` y
`timeZone: "America/Argentina/Buenos_Aires"`. Si recibe una fecha sin hora (un
indice viejo), devuelve "el 7/10".

**Textos:**

- **Buscar sin consulta:** `8.506 productos indexados en 5 fuentes · actualizado hoy 15:25`.
- **Ofertas vacias:** `Volvé mañana: el índice se rearma una vez por día. El último relevamiento fue hoy 15:25.`
- **Sello:** `Precios verificados en cada sitio hoy 15:25 · 8 productos seguidos`.
  Sin `verificado` (por ejemplo en un build local) queda el texto de hoy con
  `DATOS.actualizado`.

## CI

**Nuevo `.github/workflows/tests.yml`.** Se dispara con `pull_request` y con
`workflow_call`. Tiene un job `tests` en `ubuntu-latest`:

1. checkout;
2. Python 3.12 y Node 22 (`actions/setup-node@v4`);
3. los tests de Python;
4. los tests de JS.

**Cambios en `actualizar.yml`:**

- **Permisos y jobs:** se suma `issues: write`. Los jobs quedan `tests`
  (`uses: ./.github/workflows/tests.yml`) -> `construir` (`needs: tests`) ->
  `publicar`. Si un test falla, no se commitea ni se publica nada.
- **`construir`, en orden:**
  1. checkout de `main`;
  2. checkout de `historial` en `historial/`;
  3. `actualizar.py`;
  4. commit a `main` solo si cambio `datos.json`;
  5. recuperar la cache del indice;
  6. `indexar.py --historial historial` (`id: indexar`);
  7. commit y push de `historial/` con el mensaje "Precios del AAAA-MM-DD";
  8. `salud.py`;
  9. preparar el sitio, que ahora copia tambien `js/`;
  10. subir el artefacto de Pages.
- **Condiciones:**
  - el paso 7 corre solo si `steps.indexar.outcome == 'success'` y
    `(inputs.paginas || '12') == '12'`: una corrida manual con menos paginas no
    escribe historia;
  - el paso 8 corre solo si `github.event_name == 'schedule'` y el indexado no
    se salteo.
- Se elimina la cache `precios-*`. La del indice queda, porque sigue siendo el
  respaldo cuando una tienda se cae.

**Archivos que van al `.gitignore`:** `historial/`, `salud.json` y
`comparativa-ram-ddr4-16gb.html`.

**Efecto esperado del primer push a `main`:** como cambia `indexar.py`, cambia la
clave de la cache del indice. La primera publicacion arma el indice de cero
(~17 minutos) y escribe el primer commit de historia.

## Documentacion

En el README se actualizan estas secciones:

- **"Archivos":** la copia es generada.
- **"Como se publica":** tests antes, la rama `historial` y los issues de salud.
- **"Ofertas":** el historial ya no esta en la cache.
- **"Exportar y compartir":** el link con `?q=`.
- **Seccion nueva "Tests":** como se corren y como se recapturan los fixtures.
- **Seccion nueva "Analitica":** que se mide y donde se ve.

## Verificacion del criterio de salida

1. **Analitica.** Despues del merge, una busqueda, un clic saliente, un
   compartir y un exportar en el sitio publicado. El dueño lo ve en el tablero
   de GoatCounter, o se consulta la API con un token que el cree. Antes del
   merge, el preview local con un `goatcounter` de mentira comprueba que cada
   accion genera el `path` esperado.
2. **`?q=`.** Capturas de antes y despues en el preview local, y despues en el
   sitio publicado: abrir `?q=ssd+1tb#comparativa` muestra la comparativa
   armada, y Atras y Adelante respetan la consulta.
3. **Historial.**
   1. Con OK, se borran las caches `precios-*`.
   2. Se dispara la Action a mano con las paginas por defecto.
   3. El log de `indexar.py` tiene que mostrar las bajas calculadas desde el
      historial, y la rama `historial` tiene que recibir su commit.
4. **CI.** Los tests pasan en el PR de `f0-cimientos` y en la corrida de `main`.

Las tareas que cambian la pantalla (F0.2, F0.3, F0.8) se muestran con capturas
de antes y despues.

## Pasos que necesitan el OK del dueño

- Pushear la rama nueva `historial`.
- Borrar las caches `precios-*`.
- Mergear o pushear a `main`, que despliega.
- Opcional: abrir un issue de prueba de F0.6 y cerrarlo.

El push de `f0-cimientos` y el PR no despliegan nada.

## Fuera de alcance

- Una tarjeta de Open Graph por busqueda: los crawlers no ejecutan JS, asi que
  necesita las paginas estaticas de F1.2.
- El link con `?q=` en el pie de impresion.
- Partir el resto de `index.html` en modulos (F1.1).
- Notificaciones de salud por otra via que no sean los issues.

## Riesgos

- **Adblock.** Bloquea GoatCounter y los numeros quedan por debajo de lo real.
  Se acepta, porque sirven igual para comparar semanas.
- **Safari y `replaceState`.** Limita las llamadas. Por eso va dentro de un
  `try`.
- **Una tienda que bloquea durante dias.** Mientras este bajo el 70%, no escribe
  bajas ni ensucia el historial, y el issue la sigue con un comentario por dia.
- **Crecimiento del historial.** Son ~50 a 100 KB por dia de cambios en texto
  comprimible. Si la rama pesa demasiado, se compactan los meses viejos, que es
  un problema de F2.
