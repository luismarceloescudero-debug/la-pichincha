# La Pichincha

> Hardware en Argentina. No lo más barato: lo que más rinde.

Comparador de hardware en Argentina. No compara solo precios: cruza latencia,
garantia real, stock y el costo puesto en tu casa con el envio adentro.

**Sitio:** https://luismarceloescudero-debug.github.io/la-pichincha/

## Que contiene

- **Comparativa**: lo mas buscado, lo mas vendido y lo ultimo en tecnologia, y al
  final tus ultimas busquedas con la comparativa de la mas reciente. Con una
  busqueda activa, la comparativa de esa busqueda, el precio por tienda y
  «Donde conviene comprar» (lo que antes era la pestaña Tiendas). Desde la
  spec 021 ya no vuelve al analisis curado del primer relevamiento.
- **Ofertas**: rebajas reales detectadas en el indice.
- **Veredicto**: se escribe solo con la busqueda activa o, si no hay, con la mas
  reciente (o la primera de lo mas buscado).
- **Borrar busquedas**: un Pac-Man, un torbellino o una escoba se las come.

Cada foto, nombre y precio enlaza al producto en la web de la tienda.

## Fuentes

Precios: las tiendas de `tiendas.json` (ver la tabla de fuentes mas abajo). Los
productos curados del primer relevamiento (CompraGamer, Gaming City, Mexx,
FullH4rd y Venex, con specs de las webs de ADATA, Corsair y Kingston) siguen en
`datos.json`, pero la portada ya no los muestra (spec 021).

## Archivos

| Archivo | Que es |
| --- | --- |
| `index.html` | La pagina que sirve GitHub Pages, y el unico HTML que se edita a mano |
| `js/` | El sitio partido en modulos (F1.1): funciones puras del buscador (`buscador.js`), de la pagina (`pagina.js`) y del analisis (`analisis.js`, compartido con las paginas por busqueda), los modos de la busqueda (`modos.js`, spec 013: Recomendacion, Super Oferta, Primera Linea y su orden; sin DOM), comprar afuera (`importar.js`, con `monedas.js` para el monitor de monedas de la spec 043; specs 015 y 020: la busqueda armada en Amazon, Tiendamia y Loquieroaca cuando nada del indice coincide, y el bloque para pegar un link, con la referencia que lee el Worker; spec 040: sin calculadora local), mas los modulos de la pagina (`base`, `vistas`, `indice-ofertas`, `historial`, `busqueda`, `exportar`, `consulta`, `medicion`, `vista-afuera` (pegar un link en «Buscalo afuera», spec 040), `serie-precios` (el grafico del historial, puro), `vista-historial` (el boton y la descarga del fragmento), `arranque`). `index.html` solo trae la estructura y los datos |
| `js/ofertas.js`, `generar_feed.js`, `publicar_telegram.py` | Que es una oferta (compartido), el feed `ofertas.xml` y el canal de Telegram |
| `modelo.py`, `cobertura.py` | Codigo de modelo de cada aviso (identidad entre tiendas) y cuanto del indice se pudo agrupar, por rubro |
| `css/sitio.css` | Los estilos del sitio, compartidos con las paginas por busqueda |
| `consultas.json`, `generar_paginas.js`, `generar_paginas.py` | Las paginas estaticas por busqueda popular (con su `feed.xml`), el indice `/precios/`, `sitemap.xml` y `robots.txt` |
| `manifest.webmanifest`, `sw.js`, `sin-red.html`, `js/app.js`, `publicar_app.py` | La app instalable: manifiesto, service worker (red primero), pagina de sin conexion, aviso y medicion, y el script que estampa la version al publicar |
| `comparativa-ram-ddr4-16gb.html` | Copia para el artifact, sin `<head>` y en un solo archivo. La arma `python actualizar.py --build` y no se versiona |
| `historial.py` | Historial de precios del indice, en la rama `historial` |
| `historial.py`, `serie.py`, `generar_series.py` | El historial (rama `historial`), los sellos de minimo y el grafico del detalle: `generar_series.py` deja `_sitio/series/NN.json`, la serie de cada aviso en 64 fragmentos que la pagina baja solo al abrir su historial |
| `salud.py` | Abre un issue cuando una fuente trae menos del 70% de lo que traia |
| `generar_portada.js` | Pre-renderiza la portada publicada (`_sitio/index.html`): pestañas, sello y Comparativa, con las mismas funciones de `js/`; el JS no los vuelve a armar |
| `guardia.js` | Guardia del indice: mide bajas propias y, por categoria, avisos, "sin datos" y ofertas sobre el indice real, lo compara con la `guardia.json` publicada de la corrida anterior y con una alarma (0 bajas propias con historial, una categoria que se queda sin ofertas, un salto de mas de 10 puntos en "sin datos", menos de 10 ofertas para el resumen) la corrida no manda Telegram y abre un issue `guardia` |
| `generar_info.js` | `/estado/` (cuando se relevo cada tienda y cuantos avisos trajo, de `indice.json` y `salud.json`) y `/legal/` (terminos, privacidad y afiliados) |
| `sitio.json` | La direccion publica y la politica de contenido (CSP) de todas las paginas; tambien `afuera_url`, la direccion del Worker de la spec 022 (vacia hasta el primer despliegue) |
| `worker/` | Worker de Cloudflare «Afuera» (spec 022): `GET /buscar?q=` consulta eBay, AliExpress y Amazon por sus APIs oficiales (cada una apagada hasta que el dueño cargue sus secretos) y Tiendamia sin credenciales (spec 023); `GET /enlace?url=` lee el precio del link pegado en «Buscalo afuera» (Tiendamia y Loquieroaca por su pagina, Amazon y eBay solo por API), con cache de 8 h, CORS solo para el sitio y tope por IP. Lo despliega `.github/workflows/worker.yml` si existen `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; la pagina lo muestra en la seccion «Afuera, en vivo» (`js/afuera.js`) |
| `CONSTRAINTS.md` | Los umbrales de calidad que hace cumplir la CI: cobertura, contraste, enlaces, CSP y Lighthouse |
| `tests/` | Tests de Python (`unittest`) y de JS (`node --test`) |
| `img/` | Fotos oficiales de producto, optimizadas, y `og.png` para compartir |
| `docs/mapa.md` | El mapa del repo para arrancar una sesion: el flujo de cada publicacion (pasos del workflow, scripts, `subprocess` y JSON) como diagrama, que archivo es dueño de que, y que tocar para sumar una fuente, una regla de importacion, un rubro o una moneda |
| `docs/proceso-de-trabajo.md` | Como se trabaja con Claude Code en este repo: arranque, delegacion con modelos gratis (FCC, sin modelos pagos), que skill usar en cada escenario, auditoria de skills y plugins contra GitHub, ciclo de cada pedido, merge y limpieza, y la cola de pendientes |
| `docs/delegacion-modelos.md` | La tanda del 19/10/2026 con un modelo asignado por tarea: quien hizo cada una, cuanto tardo, y cuantos hallazgos reales y falsos dio cada modelo |
| `docs/seguridad-zap.md` | Analisis pasivo del sitio publicado con OWASP ZAP (19/10/2026): cada alerta con su veredicto verificado, lo que no se puede arreglar en GitHub Pages y cuanto acertaron los modelos al clasificarlas |
| `docs/og-imagen.html` | Fuente de `img/og.png` |

Las imagenes son material de los fabricantes y las tiendas, usadas como
referencia de producto en una comparativa de precios.

## Actualizar los precios

```
python actualizar.py              # releva las 4 tiendas, recalcula y reconstruye el sitio
python actualizar.py --dry-run    # solo muestra el informe, no escribe
python actualizar.py --solo mexx  # una sola tienda
python actualizar.py --build      # reinyecta datos.json en index.html y arma la copia del artifact
```

El script lee los precios de un metadato estable en cada tienda, asi que no
necesita navegador: CompraGamer publica su catalogo como JSON, y Gaming City,
Mexx y FullH4rd lo dejan en una etiqueta `meta` o en microdatos schema.org.
Avisa cuando un producto cambia de precio, cuando se queda sin stock y cuando
el cambio da vuelta el podio, que es el unico caso en el que hay que reescribir
el veredicto a mano.

Si un producto no se puede verificar (la tienda bloquea, cambia la ficha o no
publica precio) conserva el ultimo precio y queda marcado con `falla_desde`, y la
pagina lo muestra como "sin verificar desde el 8/10". La marca se borra sola
cuando vuelve a andar. Se guarda desde cuando falla y no cuando se verifico, asi
`datos.json` cambia solo cuando algo cambia y el bot no commitea todos los dias.

`datos.json` es la unica fuente de verdad: el script actualiza precios, stock e
historial, reinyecta todo en `index.html` y arma la copia del artifact. El contenido editorial (specs,
pros, contras, veredicto) se edita ahi y no lo toca el script.

## El buscador

`indice.json` es un indice prearmado de los catalogos, porque GitHub Pages no
corre backend: la pagina lo baja recien cuando abris la pestana Buscar y filtra
del lado del cliente.

```
python indexar.py                  # releva las 6 fuentes y arma indice.json
python indexar.py --solo mexx      # una sola
python indexar.py --tipo vtex      # solo las fuentes de un tipo de catalogo; las demas quedan como estaban
python indexar.py --probar URL     # diagnostica una fuente nueva
```

`indice.json` **no esta en el repo**: pesa casi 2 MB y versionarlo haria crecer
el historial de git en 2 MB por relevamiento. Lo arma GitHub Actions en cada
publicacion y viaja directo al sitio, sin pasar por un commit. Lo que si se
versiona es `datos.json`, que es chico y cuyo historial de precios vale la pena.

Si lo generas a mano, queda en tu carpeta y el sitio local lo usa igual.

### Sumar o sacar una tienda

Las fuentes viven en `tiendas.json`, no en el codigo. Para sumar una, corre
`--probar` con la URL de cualquiera de sus productos: te dice cual de los cinco
extractores genericos le funciona (Open Graph, schema.org, JSON-LD, meta
product:price o catalogo JSON) y que poner en la configuracion. Para jubilar
una, `"activa": false`, y el indice conserva lo que ya tenia de ella.

Si una fuente se cae o cambia su plantilla, el indexador la marca en el resumen
y mantiene los datos anteriores en lugar de vaciar el indice. Esos datos no
salen como de hoy: cada fuente guarda en `indice.json` la hora de su ultimo
relevamiento bueno (`tiendas.<clave>.relevado`) y la pagina pone "precio del 7/10"
en cada producto, en el texto compartido y en los exportes. Pasa lo mismo con
una fuente dada de baja con `"activa": false`.

### Fuentes

| Fuente | Como se enumera | Como se lee el precio |
| --- | --- | --- |
| CompraGamer | catalogo JSON completo | el mismo JSON |
| Gaming City | 122 categorias del sitemap | `meta product:price` |
| Mexx | rubros paginados | microdatos schema.org |
| FullH4rd | busquedas por termino | Open Graph |
| Venex | categorias hoja del sitemap, paginadas con `?page=` | el precio de la tarjeta (contado efectivo) |
| Maximus | cada pagina de cada categoria, listada en `sitemap-paginas.xml` (131) | el bloque de tarjetas que la pagina escribe en el servidor (`mxSeoSSR`): precio por transferencia o efectivo, 10% menos que el de lista |
| The Gamer Shop, Max Tecno, Katech, SCP Hardstore, Click Gaming, GoldenTech | la Store API publica de WooCommerce (`/wp-json/wc/store/v1/products`), de a 100 y solo lo que esta en stock | la misma API: el precio especial por efectivo o transferencia (verificado en la pagina de un producto de cada una) |
| OnCity, Carrefour, Naldo, Authogar, Pardo, Bringeri, Motorola, D'Ricco, Nuevas Hogar, Coppel, Compra Cierta, LG Shop, BGH | la API publica de catalogo de VTEX (`/api/catalog_system/pub/`): el arbol de categorias y la busqueda por cada categoria de tecnologia, de a 50, solo si su `robots.txt` no prohibe `/api/` | la misma API: el precio del vendedor por defecto, solo lo que tiene stock (`AvailableQuantity > 0`) |
| ComparaYa | API publica por categoria | la misma API |
| Mercado Libre ([spec 026](specs/026-mercado-libre-api/spec.md)) | su API oficial con el token de aplicacion (`ML_CLIENT_ID`, `ML_CLIENT_SECRET`): la busqueda del catalogo (`/products/search`) por 14 rubros de hardware, cada uno con su dominio, hasta 200 productos por rubro | `/products/{id}/items`: el vendedor mas barato que lo vende nuevo, en pesos y desde Argentina, y su `original_price` |

ComparaYa no es una tienda sino un comparador que agrega otros 50 comercios
(Mercado Libre, Fravega, OnCity, Carrefour). Entra como segunda opinion y cada
resultado aclara de que comercio sale. Un aviso que llega directo de la tienda y
tambien por ComparaYa (la misma URL) va una sola vez al indice, con el precio de
la tienda (`indexar.sin_repetir_agregador`; en la pagina, `unaPorUrl`). Un producto de catalogo de Mercado
Libre se reconoce por su numero (`/p/MLA...`, `indexar.clave_aviso`), aunque ComparaYa escriba otra direccion.

**Tiendas VTEX** (desde el 19/10/2026). Antes llegaban solo por ComparaYa, con
precios que a veces eran viejos. Medido desde GitHub Actions
(`python diagnostico_enlaces.py --vtex-catalogo indice.json`) y probado indexandolas
sobre el indice publicado (paso manual del workflow de diagnostico):

| Tienda | Avisos de tecnologia en stock | Nuevos contra ComparaYa | Tachado en los avisos |
| --- | ---: | ---: | ---: |
| OnCity | 1.970 | 1.908 | 70% |
| Carrefour | 675 | 613 | 72% |
| Naldo | 188 | 161 | 59% |
| Authogar | 132 | 124 | 21% |
| Pardo | 77 | 71 | 12% |
| Bringeri | 72 | 62 | 27% |
| Motorola | 50 | 50 | 34% |
| D'Ricco | 47 | 42 | 100% |
| Nuevas Hogar | 45 | 44 | 11% |
| Coppel | 31 | 27 | 19% |
| Compra Cierta | 28 | 26 | 78% |
| LG Shop | 8 | 8 | 0% |
| BGH | 8 | 8 | 100% |
| **Total** | **3.331** | **3.144** | |

El indice paso de 22.375 a 25.036 avisos (entran 3.354 y salen 693 de ComparaYa
que repetian una tienda directa) y de 6,5 a 7,2 MB; la guardia del indice no
encontro alarmas. Los celulares pasaron de 414 a 1.172 avisos. El tachado cuenta
como rebaja (`lista_es_oferta`) solo donde aparece en menos de un tercio de los
avisos: en OnCity, Carrefour o D'Ricco esta en casi todo el catalogo y no dice
nada. El RefId de VTEX vale como part number solo si otra tienda nombra el mismo
codigo (Pardo y LG publican el del fabricante; OnCity y Naldo, numeros internos);
el EAN no se usa porque ninguna otra fuente lo publica. La verificacion antes de
publicar mira el mismo vendedor y la misma variante que el indice
(`indexar.oferta_vtex`), y un bloqueo a mitad de una tienda la hace fallar entera
(se reusa lo anterior) en vez de entrar como un catalogo a medias.

Quedaron afuera: **Cetrogar** (su `robots.txt` prohibe `/api/`), **Samsung**
(responde 503 a GitHub), **Tidi** (no devuelve JSON), **Sony** (2 avisos, de
audio), **Easy** (sin categorias de tecnologia: su "almacenamiento" son frascos)
y las farmacias y perfumerias que llegan por ComparaYa (Farmacity, FarmaOnline,
FarmaPlus, Pigmento, Get The Look, Simplicity).

## Como se publica

`.github/workflows/actualizar.yml` corre todos los dias a las 09:00 de Argentina
y en cada push a main:

1. Corren los tests. Si alguno falla, no se commitea ni se publica nada.
2. `actualizar.py` releva los precios de los productos seguidos y, si cambio
   alguno, commitea `datos.json` e `index.html`. La hora del relevamiento va
   estampada en el sitio publicado.
3. `indexar.py` arma el indice de busqueda, compara contra el historial y
   commitea los cambios de precio en la rama `historial`.
4. En la corrida programada, `salud.py` abre un issue (etiqueta `salud-fuente`)
   por cada fuente que trajo menos del 70% de lo que tenia, o comenta el que ya
   estaba abierto.
5. El sitio se sube como artefacto de Pages, sin tocar el repo.

Si una tienda se cae o bloquea la IP del runner, el paso de indexado no voltea
la publicacion: se recupera el indice de la corrida anterior desde la cache.

Tambien se puede disparar a mano desde la pestana Actions, eligiendo cuantas
paginas por categoria relevar o salteando el indexado.

No hace falta backend. El relevamiento es trabajo de **construccion**, no de
**consulta**: corre una vez por dia en el runner y el navegador despues filtra
un archivo estatico. Un backend recien haria falta para precios en vivo por
consulta, alertas por usuario o historiales largos.

## Exportar y compartir

Cada vista trae una barra de acciones que exporta lo que estas mirando: los
resultados de una busqueda, las tres memorias, las tres webcams o una oferta
suelta desde su analisis.

| Accion | Que hace |
| --- | --- |
| Compartir | Usa el menu nativo del sistema si existe; si no, copia el texto |
| Copiar | Deja la lista en el portapapeles, lista para pegar en WhatsApp |
| Excel | Baja un .xlsx nativo con dos hojas, precios como numero, anchos de columna, filtro y enlaces clicables. Si el CDN no responde, cae en CSV |
| Imprimir o PDF | Abre el dialogo de impresion con una hoja de estilos propia |

La hoja de impresion saca pestañas, buscador y botones, pasa todo a blanco y
negro con bordes, evita cortar tarjetas al medio y agrega un pie con la URL y
la fecha de los precios.

Dentro de un visor embebido el navegador bloquea la impresion y las descargas,
asi que ahi la barra muestra solo Compartir y Copiar, que si funcionan.

La busqueda va en la URL: `?q=ssd+1tb#comparativa` abre directo la comparativa
de esa busqueda, y Compartir y Copiar mandan ese link. Al pegarlo en WhatsApp
sale la tarjeta con titulo, descripcion e imagen (`img/og.png`).

### Sobre el .xlsx

Lo arma ExcelJS, que se baja recien cuando pedis el archivo: son 257 KB
comprimidos que no tiene sentido cargar en cada visita. El libro trae:

**Hoja Ofertas** — cabecera en negrita sobre fondo oscuro y fijada al scrollear,
precio como numero con formato de pesos y alineado a la derecha, fila del mas
barato resaltada en verde, cebra en las filas pares, enlaces clicables en azul,
autofiltro y anchos de columna calibrados. Sale en horizontal y ajustada al
ancho de la hoja si la imprimis.

**Hoja Info** — fecha de los precios, que seleccion se exporto, cuantos
productos y las aclaraciones de IVA y envio.

Se eligio ExcelJS sobre SheetJS porque la edicion comunitaria de SheetJS no
escribe estilos de celda. ExcelJS pesa mas (257 KB contra 79 KB) pero como se
carga bajo demanda lo paga solo quien exporta, y el archivo que genera termina
siendo mas chico: 14 KB contra 55 KB para la misma tabla.

## Ofertas

La pestana Ofertas trabaja con dos señales distintas.

**Bajaron de precio** es la señal propia y la mas confiable: el indexador
compara cada producto contra el ultimo precio que tiene en el historial. No
depende de lo que publique la tienda, no se puede inflar, y sirve para las
seis fuentes por igual. Se cuentan las bajas de al menos 3% y mil pesos, para
no mostrar ruido de redondeo.

El historial vive en la rama huerfana `historial`: un CSV por mes
(`2026-10.csv`) con columnas `fecha,tienda,id,precio`, donde `id` es la URL del
producto. Solo se escriben los cambios: cuando un producto aparece, cuando
cambia de precio y, con el precio vacio, cuando deja de publicarse. No depende
de la cache de Actions, asi que no se pierde si GitHub la borra, y no ensucia
`main`. Para tenerlo en tu maquina: `git worktree add historial historial`.

Una fuente que trae menos del 70% de lo que tenia no registra bajas ese dia:
asi una tienda que bloquea a medias no borra su catalogo del historial.

**Rebajas publicadas** es el precio tachado del comercio. No todas las fuentes sirven para esto: en CompraGamer,
Mexx y FullH4rd el "precio de lista" es apenas el precio sin transferencia, y
da exactamente el mismo porcentaje en todo el catalogo. Por eso `tiendas.json`
marca con `lista_es_oferta` las fuentes donde el tachado es una rebaja de
verdad (Gaming City, ComparaYa y las tiendas VTEX con tachado en menos de un
tercio de los avisos), y el indexador guarda un cero en las demas.

Se muestran las rebajas entre 15% y 60%. El techo esta puesto porque arriba de
ahi el precio anterior casi siempre esta inflado: un 90% OFF no es una oferta,
es marketing.

**Categorias y minimos.** Cada aviso se evalua en su categoria (`js/categorias.js`): monitores, PCs
completas, notebooks, smartphones, componentes y perifericos. Cada una tiene sus minimos, su gama media y
su gama alta con numeros, y lo que se exige a una no se le exige a otra (la VRAM es solo de las placas de
video). Un monitor entra desde 144 Hz sin panel TN; la gama alta es 240 Hz o mas con OLED, QD-OLED o
Mini-LED. Un smartphone, desde 6 GB de RAM y 128 GB; una notebook o PC, desde 16 GB y 512 GB, con el
procesador de la generacion mas nueva del indice o la anterior. Los numeros estan en la spec
`specs/012-reglas-de-ofertas/spec.md`.

**Descuento por categoria.** Un 10% ya es buena oferta en notebooks, PCs y smartphones (12% en
monitores); en componentes y perifericos se exige 20%. Las bajas propias piden 5% en equipos y 8% en
componentes.

**Cupo en el resumen.** El resumen del dia (Telegram, RSS y /hoy/) reserva 2 lugares por categoria y no
deja pasar de 3 hasta repartir lo que sobra, para que los componentes, que son casi todo el catalogo, no
lo acaparen. Sale agrupado por categoria.

La pestaña dice cuantos avisos con descuento quedaron afuera por no llegar a los minimos de su categoria.
Las compras internacionales no se esconden: pasan por las mismas reglas y en el RSS y Telegram van al
final de su categoria, rotuladas.

Desde la spec 040 no se estima su costo puesto en casa (ya no hay calculadora local): la referencia del costo importado
es el precio final de Tiendamia o Loquieroaca, al pegar un link en «Buscalo afuera». Desde la spec 041, debajo de la ficha de
un link de Tiendamia se puede pegar el «Detalle de la compra» del carrito (el envio internacional y los servicios de
importacion no estan en la ficha y el robots.txt de Tiendamia prohibe leer el carrito): se lee en el navegador y muestra
el total y cuanto saldria en Amazon al dolar de Tiendamia. Desde la spec 042 el campo «Pegá el detalle de la compra» esta en
los cuatro proveedores (Amazon, eBay, Tiendamia y Loquieroaca) y muestra el mismo desglose: producto, envio, importacion o
servicios, impuestos, envio local, total y total en pesos (un parser por proveedor en `js/importar.js`, probado con un pegado
real de cada uno). Desde la spec 043, arriba de «Pegá el link» hay un monitor de monedas en vivo
(dolar tarjeta, MEP y oficial y el euro contra el peso, de DolarApi, cada uno con su hora; `js/monedas.js`) y lo que esta
en dolares o euros pasa a pesos al dolar elegido (tarjeta por defecto). Si DolarApi no responde, dice «sin cotización» y no
convierte. Los carritos reales que pega el dueño se juntan en
`datos/tiendamia-cargos.json` para buscar la regla del envio y de los servicios (`specs/041-cargos-tiendamia/datos.md`).
Amazon sigue en «Buscalo afuera» con el aviso «Muchos productos no se envían a Argentina»: no hay un filtro de envio
internacional en la URL (verificado el 27/10/2026), lo decide la direccion «Enviar a».

Cada oferta tiene una lupa que salta al buscador con la categoria y la marca
del producto, sin el codigo de modelo, para que traiga competencia en vez de
ese producto solo.

## Historial de busquedas

Las ultimas ocho busquedas quedan guardadas en el navegador de cada visitante,
con un boton para repetirlas y otro para actualizar precios, que vuelve a bajar
el indice ignorando la cache. No viaja a ningun lado ni se comparte entre
dispositivos.

## Como ordena el buscador

El indice no tiene specs, garantias ni reviews: solo nombre, precio, tienda y
los precios anterior y tachado. Con eso no se puede calcular "calidad/precio"
de 8500 productos. Lo que si se puede, y es lo que hace:

Tres modos (specs 013 y 014, `js/modos.js`):

- **Recomendacion** (por defecto): precio-calidad. Pasa el piso de gama de su
  categoria, tiene marca reconocida y no esta por debajo del 35% de la mediana
  (45% si la marca no es reconocida).
- **Super Oferta**: ofertas **reales** que pasan el minimo de su gama (spec 014,
  `js/ofertas.js`). La señal principal es el precio contra el mismo modelo en
  otras tiendas («22% bajo la mediana de las otras 2 tiendas», con el modelo en
  ≥3 tiendas directas); ademas, la baja propia, la rebaja publicada verificada y
  el cruce por generacion («gama alta del año pasado al precio de una media de
  hoy»). Cada fila dice por que es una oferta. Si no hay ninguna no se inventa:
  lo dice y ofrece otro modo.
- **Primera Linea**: lo **premium por especificaciones y tecnologia**, sin mirar
  la marca (spec 014, `js/premium.js`): pantalla, procesador, generacion,
  bateria, materiales; la memoria sola no alcanza y lo que no llega al minimo de
  su gama no entra. Selectiva (≤25% de cada categoria). Perifericos y «otro» no
  tienen puntaje. Un modelo de `datos/ganadores.json` (pruebas reales de PassMark, RTINGS y
  DXOMARK) suma y muestra «ganador en pruebas: fuente».

Dentro de cada modo se elige el orden: **Mejor oferta** (por defecto: primero lo
mas premium y nuevo, y dentro de eso la mayor baja contra el mismo modelo),
**Mayor baja** (contra el precio mas bajo de los 30 dias anteriores), **Precio ↓**, **Novedades** (generacion o año mas nuevo primero) o **Premium**
(mayor puntaje primero). El piso de gama se mantiene (4 GB de RAM o 64 GB no alcanzan hoy) y una nota dice
siempre cuanto deja afuera cada modo. Lo internacional va siempre al final. Lo guardado por la version
anterior («precio», «marca») arranca en Recomendacion.

El nivel de marca (ya solo informativo: el sello «marca reconocida» y el desempate de
Recomendacion) sale de la lista curada en `datos.json`, no de las tiendas:
`primera` son fabricantes con red de garantia y trayectoria, `conocida` son
marcas reales de segunda linea. Lo que no esta en ninguna lista no se castiga,
solo no se destaca. Cubre el 67% del indice.

Cada resultado puede traer sellos: premium (con las señales que sumo), marca reconocida, bajo
N%, N% OFF, y "muy por debajo del resto" cuando el precio no cierra. Arriba va
la mediana del resultado, para que se vea contra que se compara.

Los avisos de ComparaYa suman tres sellos mas, que salen de su API (`sellos` en
`tiendas.json`): **compra internacional** (se envia desde el exterior), **tienda
oficial** y **envio gratis**. En el indice viajan como letras (`i`, `o`, `e`) en
el campo `sellos`. Las compras internacionales siguen en la lista, marcadas, pero
en cualquier modo van despues de las comparables.

Cuando la consulta cae en una categoria analizada a fondo, aparece un acceso
directo a la Comparativa, que es donde estan las specs de fabrica y la garantia
real.

### Lo que se probo y no funciono

Agrupar el mismo producto entre tiendas por el nombre. Con solo el nombre no
alcanza: la prueba junto 145 pendrives distintos bajo la clave "128gb" y metio
una notebook entre los SSD de 480GB. Lo que si funciona es el codigo de modelo
exacto (ver abajo).

## Canal de ofertas: RSS y Telegram

Las ofertas del dia salen por dos canales, sin backend:

- **`ofertas.xml`** (RSS 2.0, archivo estatico): hasta 20 entradas, primero las bajas
  propias (del historial) y despues las rebajas publicadas, cada grupo por descuento. Cada
  entrada dice el precio, cuanto bajo, el comercio, el enlace a la tienda y la hora de los
  precios. Las compras internacionales van al final y rotuladas; los enlaces que no son `http(s)` no entran. El
  sitio lo anuncia en el `<head>` con `rel="alternate"`. Lo arma `generar_feed.js`, que
  tambien escribe `ofertas.json` (las 10 mejores) para Telegram. Las publicaciones se pueden
  caer entre que se leyo el catalogo y ahora (las de un agregador como ComparaYa no traen el stock),
  asi que se verifican dos veces con `verificar_ofertas.py`: **antes de armar el sitio** (las 40 mejores
  candidatas; las caidas se sacan de `indice.json`, asi tampoco aparecen en la pestaña Ofertas ni en el
  buscador) y **justo antes de publicar** (las elegidas, para el feed, `/hoy/` y Telegram). Cada enlace
  pasa por una revision estatica (404/410, carteles de la tienda, `OutOfStock` de schema.org) y otra
  **renderizada** en Chrome sin interfaz, que ejecuta el JavaScript: el cartel "Este producto no esta
  disponible" de Mercado Libre lo arma el navegador y no esta en el HTML. Si cae alguna, entra la siguiente
  candidata (hasta 3 rondas). **Mercado Libre se decide por su API oficial** (token de aplicacion con los
  secretos `ML_CLIENT_ID` y `ML_CLIENT_SECRET`): a los servidores de GitHub su pagina les muestra un captcha y
  ComparaYa trae precios viejos. Un producto de catalogo (`/p/MLA...`) sale solo si `/products/{id}/items` dice
  que alguien lo vende al precio publicado (2% de tolerancia); sin vendedores, con todos mas caros o sin poder
  verificarlo (`/up/MLAU...` da 403 en toda la API, o la API falla) no se publica. En la prueba real del 19/10
  descarto 11 de 19 avisos de Mercado Libre entre las 40 candidatas: 5 con un precio que ya nadie tenia (la
  Zenbook 14 a $2.383.703 con el vendedor mas barato a $2.999.999), 5 `/up/` y uno que la API ya no encuentra.
  Las tiendas **WooCommerce** se verifican por su Store API publica (precio y existencias), y las **VTEX** (las 13
  que se leen directo y las que llegan por ComparaYa: OnCity, Naldo, Coppel...) por su API publica de catalogo (`docs/referencias.md`). El resto de lo que llega
  **por ComparaYa desde otra tienda** tiene que mostrar el precio publicado en la pagina de esa tienda (en el
  HTML o ya armada en Chrome); si no aparece o la tienda no se pudo abrir, no se publica. Prueba real del 19/10
  sobre las 40 candidatas: Frávega le devuelve a GitHub la pagina de bloqueo de CloudFront (en una PC si
  muestra el precio, que coincidia con ComparaYa) y DHgate el desafio de Cloudflare, asi que no salen hasta
  tener una via oficial (feed o afiliados); Megatone y Maxtecno quedaron confirmados.
  En las tiendas que se leen directo, ante la duda (bloqueo, captcha, error del servidor, sin red) se publica. El log de
  cada paso dice, por comercio, cuantas estaban en pie, cuantas se descartaron y cuantas quedaron sin
  confirmar, y ademas cada enlace deja su veredicto en `telemetria.json` (`--telemetria`): con eso
  `fiabilidad.py` arma la serie por comercio que se ve en [/estado/](https://pichinchadeldia.com.ar/estado/)
  (seccion «Ofertas que ya no estaban en pie», ver [Fiabilidad por comercio](#fiabilidad-por-comercio)).
  `diagnostico_enlaces.py` (workflow *Verificacion de enlaces (caso real)*) corre la misma
  verificacion sobre las candidatas publicadas y anota que responde cada endpoint de la API.
- **Telegram**: `publicar_telegram.py` manda UN mensaje "Pichinchas del dia" a un canal con
  las 10 mejores y el enlace al sitio (los titulos de mas de 100 caracteres se cortan en una palabra entera con "…"; el enlace sigue entero). **Esta apagado hasta que se configure**: hay que
  crear el bot con @BotFather, sumarlo como administrador del canal y cargar los secretos
  `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en el repo (Settings > Secrets and variables >
  Actions). Sin ellos el paso no hace nada ni falla. Solo publica en la corrida programada
  (no en cada push), y si Telegram falla el sitio sale igual. El token nunca se imprime.
- **Afiliado de Mercado Libre** ([spec 027](specs/027-afiliado-mercado-libre/spec.md)): en `/hoy/`, el RSS y
  Telegram, los links a mercadolibre.com.ar llevan el codigo de afiliado (`matt_word`, `matt_tool`;
  `Pagina.enlaceTienda`) y el rotulo «enlace de afiliado». El orden no cambia.

Que es una oferta vive en `js/ofertas.js` y lo comparten la pestaña Ofertas, el feed y el
canal. El orden nunca depende de comisiones; cuando haya enlaces de afiliado (F3.2) se
rotulan.

## Fiabilidad por comercio

Es dato propio, y por eso ComparaYa no lo puede mostrar: de las ofertas que este sitio
verifico en los ultimos dias, cuantas ya no estaban en pie o estaban a otro precio. Se ve en
`/estado/`, en la seccion «Ofertas que ya no estaban en pie» (spec
[016](specs/016-fiabilidad-por-comercio/spec.md), D4 del plan v2).

- **De donde sale.** `verificar_ofertas.py --telemetria telemetria.json` anota, por enlace, el
  comercio, el veredicto (`viva`, `caida`, `dudosa`) y el motivo. Entre las hasta 3 rondas de
  cada paso y entre los dos pasos del workflow gana la ultima revision de cada enlace, asi que
  no se cuenta dos veces.
- **Que cuenta como caida.** Solo lo que se probo: un 404/410, el cartel de la tienda, sin
  stock en su API o el precio publicado que ya no existe. Lo que se descarta porque la tienda
  bloqueo la revision o no respondio (`sin comprobar`) se informa aparte y **no** entra en el
  porcentaje: un bloqueo no prueba nada contra la tienda.
- **Donde se guarda.** Una fila por comercio y dia en
  `historial/verificacion/AAAA-MM.csv` de la rama `historial`, como los precios: main queda
  limpio, la cache de Actions no se puede desalojar y el artefacto del sitio solo tendria la
  ultima publicacion. Un push a main no suma filas (no es una revision del dia); si resume la
  serie. La subcarpeta es a proposito: `historial.py` lee los CSV de la raiz y ahi estan los
  precios.
- **Que se muestra.** `fiabilidad.py` resume los ultimos 30 dias y escribe
  `_sitio/fiabilidad.json`; ventana, fecha de corte y minimo de muestras van escritos en la
  pagina. Con menos de 30 ofertas verificadas no se muestra porcentaje («Pocas revisiones»),
  para no rotular a una tienda por dos casos. La tabla se ordena por cantidad de verificadas,
  no por peor porcentaje: no es un ranking.
- **Como se lee.** Se revisan las mejores ofertas del dia, que son las mas propensas a haberse
  agotado, y lo que llega por ComparaYa puede traer un precio viejo: un porcentaje alto no es
  una opinion sobre la atencion de la tienda y la pagina lo dice. Sin `fiabilidad.json` la
  seccion no aparece.

## Serie de precios

Con el historial (rama `historial`) cada aviso puede llevar tres sellos, que
`serie.py` calcula al indexar y viajan como letras en la columna `sellos`:

| Letra | Sello | Cuando |
| --- | --- | --- |
| `m` | minimo de 30 dias | hoy es el precio mas bajo de los ultimos 30 dias, con al menos 30 dias de historia |
| `h` | minimo de 90 dias | lo mismo con 90 (reemplaza a `m`) |
| `x` | subio antes de la oferta | la ultima baja es de los ultimos 30 dias y el producto habia estado 10% o mas por debajo de su precio previo, sin que la baja pase 3% por debajo de ese piso; pide 14 dias de historia |

Sin historia suficiente no se afirma nada. El historial empezo el 2026-10-07,
asi que el sello de 30 dias recien aparece desde el 2026-11-06 y el de 90 desde
el 2027-01-05; hasta entonces la funcion esta lista y no muestra nada, a
proposito. `cobertura.json` dice cuantos avisos llevan cada sello y cuantos dias
de historia hay.

### Grafico del historial de un aviso (D2 de `docs/plan-v2.md`)

Cada fila de la busqueda y cada tarjeta de ofertas tiene un boton **Historial de precio** que abre,
en el lugar, un SVG inline sin dependencias con la serie del aviso y cuatro cifras: **hoy**, **minimo**
y **maximo** (con la fecha en que rigieron) y la **variacion** contra el primer dia. Arriba dice en
letras **"N dias de datos"** y desde que dia seguimos ese aviso; nunca afirma mas que eso, asi que
con los 14 dias de historia de hoy solo ofrece los rangos de 7 dias y todo (30 y 90 aparecen solos
cuando los datos los cubran). Con menos de dos puntos, el panel dice "Todavia no hay historia
suficiente" y no dibuja nada.

La serie no viaja en el indice. `generar_series.py` deja `_sitio/series/NN.json` (64 fragmentos):
cada aviso cae en uno por `clave(tienda, url)` y la pagina baja solo `series/NN.json` cuando se
abre su detalle. Medido con el historial del 21/10 y el indice publicado: 23.484 avisos con serie en
64 fragmentos, **931 KB sin comprimir y 444 KB gzip** en total; el fragmento mas grande, 17 KB
crudos / 7,6 KB gzip. El CSV del historial entero son 14,2 MB (2,7 MB gzip) y el `indice.json`, 1,5 MB
gzip: el detalle baja un fragmento, no la historia.

Cada fragmento es `{"v":1,"base":"2026-10-07","hasta":"2026-10-21","s":{"<clave>":[dia,precio,...]}}`:
dias desde `base` y un par por cambio de precio, como el CSV. La clave (`cyrb53` sobre
`tienda+"\n"+url`) y el fragmento estan en `generar_series.py` y en `js/serie-precios.js`, con los
mismos vectores en los tests de los dos lados. Un aviso cuyo precio de hoy no coincide con el ultimo
del historial, o que ya no se publica, no lleva serie: no se afirma nada. El grafico es
`role="img"` con el resumen en el `aria-label`, lleva una tabla alternativa con los precios de cada
fecha y no depende del color (la linea y las guias alcanzan).

## Identidad por codigo de modelo

El mismo producto en varias tiendas se agrupa **solo** cuando comparte el
codigo de modelo (part number) EXACTO, o la **firma** completa de sus atributos
(abajo). Nunca por parecido. Sin codigo ni firma, o con duda, el aviso queda
suelto como siempre.

- **Firma (cuando el titulo no trae part number).** Cada tienda publica el mismo producto
  distinto: otro orden, mayusculas, guiones, "Mother" o "Motherboard" o "MB", "16Gb" o
  "16G", "2Tb", "U-Dimm" o "UDIMM", "Negro" o "Black", un guion largo, el codigo interno
  entre parentesis al final. `modelo.firma_de` lleva el aviso a sus atributos
  normalizados (marca, chipset o chip, capacidad, linea y variantes como OC, WiFi, RGB,
  color o SODIMM) y dos avisos son el mismo producto solo si la firma COMPLETA coincide.
  Si falta un atributo clave o difiere uno solo (X870E-E contra X870E-A, con y sin OC, 8 GB
  contra 12 GB, SATA contra NVMe) son productos distintos. Rige para memoria, SSD, placas de
  video y placas madre; si alguno de los avisos de la firma trae part number, los demas lo
  heredan, y si ninguno lo trae comparten un identificador derivado (empieza con `~`).
- ComparaYa publica el part number (`specifications.Modelo`), la marca y las especificaciones
  (Hz, pulgadas) en campos aparte; el indexador los usa: el `Modelo` es el codigo del aviso,
  y la marca y los datos que el titulo no dice se agregan al nombre (un monitor que decia solo
  "Gaming 25\" 240Hz" ahora dice Samsung). El part number de un catalogo vale en cualquier
  rubro (monitores, notebooks, celulares) y solo se hereda dentro de la misma clase.
- `modelo.py` saca el codigo en tres rubros (RAM, SSD y placas de video): en
  CompraGamer viene del campo `codigo_principal` de su catalogo (dato del
  fabricante); en las demas tiendas, solo si el nombre nombra EXACTO un codigo
  ya conocido o trae uno con la forma de un part number de ese rubro
  (`KF432C16BB1/16`, `SEDC600M/480G`, `GV-N506TEAGLE`). Una velocidad, una
  capacidad o un chipset nunca cuenta. Usado, reacondicionado, bulk y OEM no
  se agrupan con lo nuevo.
- Venex y Mexx no publican el part number en el listado, pero si en la ficha de
  cada producto. Para RAM y SSD, `indexar.py` pide esa ficha una sola vez por aviso
  (`ficha` en `tiendas.json`, `modelo.mpn_de_ficha`), con pausa, tope de 40 por
  corrida y sin insistir si la tienda bloquea. Lo leido queda en `fichas.json`, en
  la rama `historial`. Medido en 138 fichas: +5,9 puntos de cobertura en RAM y
  +10,7 en SSD (`specs/009-mpn-de-fichas/spec.md`).
- El codigo va en la ultima columna del indice (`modelo`). `js/buscador.js`
  (`agruparPorModelo`) junta lo que tiene el mismo codigo y capacidades
  compatibles; el resultado muestra la fila mas barata y debajo "Tambien en"
  las otras tiendas. La mediana y el conteo cuentan cada producto una vez
  ("41 productos en 58 avisos").
- La busqueda tolera la tipografia: "b840m-h" encuentra "B840M H", "udimm" encuentra "U-Dimm",
  "ssd 1tb" encuentra "SSD 1000GB" y "16g" encuentra "16GB". El mismo aviso con la URL escrita
  distinto (www, barra final, utm_*) cuenta una vez, y un comercio que llega directo y por
  ComparaYa es un solo comercio. Cada resultado dice desde cuando tiene su precio
  ("precio sin cambios desde el 12/10"); el seguimiento empezo el 7/10, y antes de esa fecha
  no sabemos (la columna `desde` del indice y `historial.inicio`).
- Para sumar una regla: un nombre real a `tests/test_modelo.py`, la forma a
  `_FORMAS` en `modelo.py`. Precision antes que cobertura.
- `cobertura.py` publica `cobertura.json` en cada corrida y avisa en el resumen
  de la Action si la cobertura de un rubro cae mas de 10 puntos. Con los nombres
  de hoy los codigos son escasos: el numero real queda a la vista, y crece si
  otras tiendas publican su part number.

## La busqueda gobierna las pestanas

Antes la busqueda era una lista y las otras pestañas mostraban siempre el mismo
contenido curado. Ahora lo que buscas arma tres vistas propias, marcadas con un
punto azul en la barra:

- **Comparativa**: de todos los avisos que coinciden se sacan los que no son
  comparables y quedan las opciones que valen la pena: la mejor compra, la mas
  barata, una de otra marca, la que mas bajo, o un escalon mas arriba y la gama
  alta cuando no hay otra marca para contrastar. Trae una tabla con las
  especificaciones y una franja que muestra donde cae cada una en el rango de
  precios.
- **Tiendas**: ranking de comercios con lo que vende cada uno de esa busqueda.
  Cada comercio de ComparaYa cuenta por separado.
- **Veredicto**: escrito a partir de los resultados, con los precios de hoy.

Sin una busqueda activa, o al tocar "Ver el analisis curado", vuelve el
contenido de siempre.

### Que se deja afuera

El indice mezcla cosas que mencionan el componente sin serlo. Se excluyen, y el
cartel de arriba dice cuantos y por que:

- Compras internacionales: tardan semanas y pueden pagar impuestos al llegar,
  asi que no compiten por la mejor compra, salvo que la busqueda diga
  "importado", "internacional" o "exterior". Siguen visibles en Buscar.
- Formato de notebook (SODIMM), salvo que la busqueda lo pida.
- Usados, outlet y reacondicionados, salvo que la busqueda los pida.
- Equipos completos: avisos que EMPIEZAN con Notebook, PC, Combo o Kit. Esta
  anclado al inicio a proposito, porque "SSD para notebook" si es un SSD.
- "Similares": si lo que buscaste aparece justo despues de "simil" o "similar",
  el aviso dice que NO es eso. "HD SSD 960GB ... SIMIL 1TB" no es un 1TB. Solo
  se aplica a lo que buscaste: "silla simil cuero" sigue siendo una silla.
- Accesorios: avisos que empiezan con Cable, Adaptador, Soporte, Funda, etc.,
  salvo que la busqueda los nombre.
- Otro tipo: si buscas SSD no entra un disco rigido, y al reves.
- Sin marca reconocida y por debajo del 45% de la mediana.
- Mas de tres veces la mediana, que suele ser un equipo completo.

La mejor compra no es el minimo de la marca buena: por debajo del 35% de la
mediana se considera piso de gama, normalmente un modelo viejo o de entrada, y
se ofrece como "mas barata" con la advertencia en vez de recomendarse.

### Lo que no sabe

Todo sale del nombre y el precio de cada aviso. Las especificaciones se leen del
texto con expresiones regulares, asi que pueden faltar o ser incompletas. No hay
garantia, reseñas ni fichas tecnicas, que solo existen en la Comparativa curada.
Sirve para decidir a quien mirar primero, no para cerrar la compra.

### Medidas como palabra entera

Un numero, o un numero con su unidad (27, 1tb, 3200mhz), tiene que ser palabra
entera: "2tb" ya no encuentra "12tb" ni "27" encuentra "Vp227hf". Ademas "1 TB"
y "1TB" se tratan igual, porque varias tiendas escriben la unidad con espacio.

## Tus ultimas comparaciones

La pestana Comparativa tiene arriba una tira con las comparaciones curadas y
tus ultimas busquedas. Cada busqueda guarda su mejor compra del momento, asi
que al volver se ve el precio de hoy y cuanto se movio ("5% desde que lo
viste"). Un clic reabre esa comparativa sin pasar por el buscador. Vive en el
navegador de cada visitante: no se comparte entre dispositivos.

## Ofertas en tarjetas

Cada oferta es una tarjeta con anillo de descuento, comercio, precio, tachado y
ahorro en pesos. Se filtran por tipo (bajaron de precio o rebaja publicada),
comercio, rubro, solo primera linea y marcadas; se ordenan por descuento,
ahorro o precio; y se paginan de a 24. Tocar una tarjeta la abre con el detalle
y de donde sale el precio anterior. La estrella marca ofertas para seguirlas, y
"Comparar" abre la comparativa con productos de la misma categoria y especificaciones
que definen la compra: en monitores conserva pulgadas, resolucion y refresco; en
memorias, DDR, capacidad y velocidad; en SSD, capacidad y formato; en placas de
video, chip y memoria; en procesadores, familia y modelo; y en notebooks, gama del
procesador, RAM y almacenamiento. Reconoce
FHD/Full HD/1080p, 4K/UHD/2160p y QHD/2K/1440p como equivalentes. Si no encuentra
la configuracion exacta, relaja la ultima especificacion, nunca el tipo de producto.

### Nombre legible (spec 044)

En Buscar, Ofertas, `/hoy/`, el RSS y Telegram cada producto se muestra con un icono de su tipo,
la MARCA Y MODELO en grande y, abajo, solo los datos que definen la compra («27″ · 4K · QD-OLED · 240 Hz»).
Se sacan la palabra del tipo, los codigos internos de la tienda, el color repetido y el relleno; las
pulgadas pasan a ″. Lo usado o reacondicionado va como primera chip. El nombre completo de la tienda
queda en el `title` y en la ficha. Todo sale de `js/titulo.js` (`specs/044-nombres-legibles/spec.md`).

## Paginas por busqueda

Para que Google encuentre el sitio, cada publicacion genera una pagina estatica por busqueda
popular: `/precios/ssd-1tb/`, `/precios/rtx-5060/`, etc., mas un indice en `/precios/`, un
`sitemap.xml` y un `robots.txt`. Cada pagina trae, sin necesitar JavaScript: la mejor compra
con su razon, la mediana, una tabla de hasta 20 opciones, lo que quedo afuera y por que, y
datos estructurados (`ItemList`, `AggregateOffer` en pesos y migas). El boton "Ver la
comparativa completa" abre la Comparativa con esa busqueda ya armada.

**Un feed RSS por pagina.** Cada pagina indexable publica `feed.xml` en su carpeta
(`/precios/rtx-5060-ti-16gb/feed.xml`) y lo anuncia en el `<head>` con `rel="alternate"`, ademas del
`ofertas.xml` global: sirve para suscribirse a una busqueda y enterarse cuando cambian los precios.
Son hasta 10 entradas, la mejor compra primero y despues el mismo orden de la tabla, cada una con su
precio, comercio y enlace al aviso real (`renderFeedPagina` en `generar_paginas.js`, sobre el mismo
analisis; no hay una segunda logica). El `guid` lleva el precio: el lector solo marca una entrada como
nueva si el precio se movio. Las paginas finas (`noindex`) no tienen feed. Medido el 21/10 con el indice
publicado: 200 feeds, 1,3 MB (290 KB comprimidos) y la generacion de las 200 paginas sigue igual o mas
rapida (14 s contra 75 s antes, porque ahora se prepara una sola vez el modelo de modos del indice y no por pagina).

**Una sola logica.** Las paginas y la Comparativa usan el mismo modulo, `js/analisis.js`, asi que
dan siempre la misma mejor compra y la misma mediana. `generar_paginas.js` (Node, sin
dependencias) las escribe y `generar_paginas.py` orquesta, valida la lista y arma el mapa del
sitio. Una fuente que no se relevo ese dia muestra "precio del D/M", igual que el sitio.

**Precio por tienda.** Debajo de la mejor compra y de cada opcion (en la Comparativa y en las paginas por
busqueda) hay una tabla con el mismo modelo en cada comercio, de menor a mayor precio, con el porcentaje contra la
tienda mas barata ("+8%", "+22%"), cuanto se ahorra contra la mas cara, la fecha real del precio de cada aviso
("precio del 20/10") y el enlace al aviso. A diferencia de un comparador de promedios, solo entran avisos
comparables del mismo modelo: mismo codigo, misma capacidad, OC contra OC, misma configuracion en un equipo, y nada
de internacionales, usados ni accesorios. Varios avisos de un comercio cuentan como uno (queda el mas barato). Con un
solo comercio no se inventa nada: "un solo comercio: no hay con que comparar". Las comisiones nunca cambian el orden.
Vive en `precioPorTienda` y `tablaTiendasHtml` de `js/analisis.js`. Medido el 21/10 con el indice publicado: 121 de
667 opciones tienen tabla (el resto esta en un solo comercio o sin codigo de modelo), el maximo de diferencia es
+112% y las 200 paginas se generan en 14 s, igual que antes.

**Consultas automaticas.** Ademas de `consultas.json` (curado a mano, siempre primero), cada
publicacion suma las que descubre `generar_consultas.js` en el indice: las mismas que arma
"Comparar" con cada oferta (`Buscador.consultaDeOferta`), de mas a menos comparables, con al
menos 8 opciones en 2 comercios, de 2 palabras o mas (nunca "monitor" a secas), sin repetir la
URL de una manual ni los mismos avisos de otra pagina, hasta 150. Asi la lista sigue al indice
(nuevas placas, memorias o notebooks) sin tocar nada. `python generar_paginas.py --sin-auto`
las apaga; si Node falla, salen solo las manuales.

**Agregar una busqueda:** sumar una entrada a `consultas.json` y publicar:

    { "q": "rtx 4070", "nota": "Placas de video: 19 avisos, 9 comparables en 3 comercios" }

`q` mide entre 2 y 60 caracteres; lo que va antes de los dos puntos en `nota` es el grupo en
el que sale en `/precios/`. Si dos busquedas dan la misma URL, la publicacion se corta y dice
cuales. Con menos de 5 opciones comparables la pagina dice "hoy no hay opciones suficientes",
lleva `noindex` y no entra al mapa del sitio.

**Elegir cuales agregar:** en https://mescudero.goatcounter.com, los eventos `busqueda/...` son
lo que la gente busca y `busqueda_vacia/...` lo que busca y no encuentra (eso, ademas, dice que
fuente o rubro falta). Las mas buscadas con 8 o mas opciones comparables y 2 o mas comercios
son las candidatas.

**Dominio:** la base de las URL esta en un solo lugar, `BASE_URL` en `generar_paginas.py`. Con el
dominio propio se cambia ahi.

**Alta en buscadores** (la hace el dueño con su cuenta): en Google Search Console y en Bing
Webmaster Tools, agregar el sitio y enviar `<BASE_URL>/sitemap.xml`.

## App instalable

La Pichincha se puede instalar en el telefono y en la computadora (la opcion que ofrece el
navegador: "Instalar app" o "Agregar a la pantalla de inicio"; el sitio no muestra ningun cartel
propio) y, despues de la primera visita, abre sin conexion.

- **Red primero.** `sw.js` es un service worker con una sola regla: con conexion manda siempre el
  dato nuevo, y lo guardado solo responde si la red falla o tarda mas de 4 segundos. Nunca se usa
  un precio guardado cuando la red funciona.
- **El aviso.** Sin conexion, `js/app.js` muestra arriba "Sin conexion: estas viendo los ultimos
  precios que bajaste (hoy 08:12)"; pasados 7 dias agrega que pueden estar viejos. La sonda es un
  `HEAD` al manifiesto sin cache (el service worker solo atiende `GET`, asi que llega a la red de
  verdad) y corre al leer la pagina, sin esperar a las fuentes ni a la analitica. Cuenta como "hay
  conexion" cualquier respuesta de la red, incluido un `404` (por ejemplo sirviendo la app desde
  una carpeta sin el manifiesto); solo una falla de red, un 5xx o 5 segundos sin respuesta muestran
  el aviso.
- **Que se guarda:** la cascara (principal, estilos, scripts, iconos, manifiesto), la pagina de
  "no disponible sin conexion" y el ultimo indice: unos 250 KB mas el indice. Tambien las paginas
  de `/precios/` que se visitan, y una navegacion se guarda sin su `?q=`, asi un link compartido
  abre sin red y las busquedas distintas no llenan la cache. Las fotos, las fuentes, la analitica
  y las tiendas no se guardan nunca.
- **Versiones.** `publicar_app.py` estampa `<fecha del indice>-<commit>` en `sw.js`: cada
  publicacion tiene su propia cache y al activarse se borran las anteriores. La app instalada toma la
  version nueva en la apertura siguiente, sin que la persona haga nada.
- **Medicion.** El evento `app/instalada` (una vez por instalacion) y `app/abierta` (una vez por
  sesion, solo cuando corre como app) van al mismo GoatCounter, sin cookies.
- **Iconos.** Se dibujan en `docs/iconos.html` (instrucciones para regenerarlos en el propio archivo).
- **Probar a mano:** `python publicar_app.py --salida _sitio --indice _sitio/indice.json`, servir
  `_sitio/`, abrir, apagar el servidor y recargar.

## Tests

    python -m unittest discover -s tests -t . -v
    node --test "tests/js/*.test.js"

Corren en cada PR y antes de cada publicacion, con los umbrales de cobertura de
`CONSTRAINTS.md`; en el mismo workflow, el job `lighthouse` arma el sitio con el
indice publicado (portada pre-renderizada con `node generar_portada.js --salida _sitio`) y lo mide en
movil, tres corridas por pagina: las cuatro categorias cortan si la mediana baja de 90 en cualquier
pagina (los informes quedan como artifact `lighthouse`; si Chrome no arranca en el runner la corrida se reintenta
con `.github/lighthouse-corrida.sh`, solo por ese error). `tests/test_integracion.py` arma el sitio
entero y revisa que ningun enlace interno este roto. Los de los extractores usan HTML
guardado de cada tienda en `tests/fixtures/` y no salen a la red. Cuando una
tienda cambia su plantilla (llega el issue de `salud-fuente`):

    python tests/capturar.py mexx      # baja el HTML nuevo
    python -m unittest tests.test_indexar tests.test_actualizar

El test que falla dice que regex de `tiendas.json` hay que corregir. FullH4rd
todavia no tiene HTML guardado: el 2026-10-08 respondia con un desafio de
Cloudflare y se cubre con HTML escrito a mano.

## Analitica

GoatCounter, sin cookies ni banner: https://mescudero.goatcounter.com. Ademas de
las visitas mide estos eventos:

| Evento | Ejemplo | Cuando |
| --- | --- | --- |
| `busqueda` | `busqueda/ssd 1tb` | una busqueda con resultados, cuando dejas de tipear |
| `busqueda_vacia` | `busqueda_vacia/xyz` | una busqueda sin resultados: lo que falta en el indice |
| `clic_saliente` | `clic_saliente/mexx.com.ar/memoria` | un clic hacia una tienda: la metrica norte |
| `compartir` | `compartir/copiar/comparativa` | Compartir o Copiar |
| `exportar` | `exportar/excel/buscar` | Excel, CSV o Imprimir |

Desde `localhost` no cuenta nada.

## Cambiar de dominio

La dirección pública del sitio vive en un solo lugar, `sitio.json` (`base_url`). Para pasar a un dominio
propio (por ejemplo `https://lapichincha.com`):

1. Cargar en el DNS del dominio los registros de GitHub Pages (A y AAAA del apex, CNAME de `www`) y
   esperar a que resuelva.
2. En el repo, Settings → Pages → Custom domain, poner el dominio y activar "Enforce HTTPS".
3. Cambiar `base_url` en `sitio.json` y las cuatro direcciones del `<head>` de `index.html`
   (`tests/test_sitio.py` falla si no coinciden).
4. Agregar el dominio en Google Search Console y enviar `sitemap.xml`.

Las direcciones viejas de `github.io` redirigen solas al dominio nuevo.
