# La Pichincha

> Hardware en Argentina. No lo más barato: lo que más rinde.

Comparador de hardware en Argentina. No compara solo precios: cruza latencia,
garantia real, stock y el costo puesto en tu casa con el envio adentro.

**Sitio:** https://luismarceloescudero-debug.github.io/la-pichincha/

## Que contiene

- **Comparativa**: las categorias analizadas a fondo, con un selector arriba.
  Hoy son memorias DDR4 16GB y webcams, con specs de fabrica y precio puesto en
  Mendoza con el envio incluido. Sumar una categoria es agregar una entrada en
  la lista CATEGORIAS del HTML y sus productos en datos.json.
- **Ofertas**: rebajas reales detectadas en el indice.
- Las 3 tiendas que mejor pagan la calidad, cruzando el mismo producto entre
  CompraGamer, Gaming City, Mexx y FullH4rd.

Cada foto, nombre y precio enlaza al producto en la web de la tienda.

## Fuentes

Precios: CompraGamer, Gaming City, Mexx y FullH4rd. Specs tecnicas: webs
oficiales de ADATA, Corsair y Kingston, no las fichas de las tiendas (varias
publican el voltaje SPD en lugar del XMP y marcan mal el tipo de disipador).

## Archivos

| Archivo | Que es |
| --- | --- |
| `index.html` | La pagina que sirve GitHub Pages, y el unico HTML que se edita a mano |
| `js/` | Funciones puras del buscador (`buscador.js`) y de la pagina (`pagina.js`), con tests |
| `comparativa-ram-ddr4-16gb.html` | Copia para el artifact, sin `<head>` y en un solo archivo. La arma `python actualizar.py --build` y no se versiona |
| `historial.py` | Historial de precios del indice, en la rama `historial` |
| `salud.py` | Abre un issue cuando una fuente trae menos del 70% de lo que traia |
| `tests/` | Tests de Python (`unittest`) y de JS (`node --test`) |
| `img/` | Fotos oficiales de producto, optimizadas, y `og.png` para compartir |
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

`datos.json` es la unica fuente de verdad: el script actualiza precios, stock e
historial, reinyecta todo en `index.html` y arma la copia del artifact. El contenido editorial (specs,
pros, contras, veredicto) se edita ahi y no lo toca el script.

## El buscador

`indice.json` es un indice prearmado de los catalogos, porque GitHub Pages no
corre backend: la pagina lo baja recien cuando abris la pestana Buscar y filtra
del lado del cliente.

```
python indexar.py                  # releva las 5 fuentes y arma indice.json
python indexar.py --solo mexx      # una sola
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
y mantiene los datos anteriores en lugar de vaciar el indice.

### Fuentes

| Fuente | Como se enumera | Como se lee el precio |
| --- | --- | --- |
| CompraGamer | catalogo JSON completo | el mismo JSON |
| Gaming City | 122 categorias del sitemap | `meta product:price` |
| Mexx | rubros paginados | microdatos schema.org |
| FullH4rd | busquedas por termino | Open Graph |
| ComparaYa | API publica por categoria | la misma API |

ComparaYa no es una tienda sino un comparador que agrega otros 50 comercios
(Mercado Libre, Fravega, OnCity, Carrefour). Entra como segunda opinion y cada
resultado aclara de que comercio sale.

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
cinco fuentes por igual. Se cuentan las bajas de al menos 3% y mil pesos, para
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
marca con `lista_es_oferta` las dos fuentes donde el tachado es una rebaja de
verdad, Gaming City y ComparaYa, y el indexador guarda un cero en las demas.

Se muestran las rebajas entre 15% y 60%. El techo esta puesto porque arriba de
ahi el precio anterior casi siempre esta inflado: un 90% OFF no es una oferta,
es marketing.

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

- **Recomendado** (por defecto): primero la marca mas confiable al menor precio.
  Manda al fondo lo que esta por debajo del 45% de la mediana sin marca
  reconocida, porque casi nunca es comparable con el resto.
- **Mas barato**: el orden clasico, por si lo unico que importa es el numero.
- **Mejor marca**: por nivel de marca, y dentro de cada nivel por precio.

El nivel de marca sale de la lista curada en `datos.json`, no de las tiendas:
`primera` son fabricantes con red de garantia y trayectoria, `conocida` son
marcas reales de segunda linea. Lo que no esta en ninguna lista no se castiga,
solo no se destaca. Cubre el 67% del indice.

Cada resultado puede traer sellos: marca de primera linea, marca conocida, bajo
N%, N% OFF, y "muy por debajo del resto" cuando el precio no cierra. Arriba va
la mediana del resultado, para que se vea contra que se compara.

Los avisos de ComparaYa suman tres sellos mas, que salen de su API (`sellos` en
`tiendas.json`): **compra internacional** (se envia desde el exterior), **tienda
oficial** y **envio gratis**. En el indice viajan como letras (`i`, `o`, `e`) en
el campo `sellos`. Las compras internacionales siguen en la lista, marcadas, pero
en el orden Recomendado van despues de las comparables.

Cuando la consulta cae en una categoria analizada a fondo, aparece un acceso
directo a la Comparativa, que es donde estan las specs de fabrica y la garantia
real.

### Lo que se probo y no funciono

Agrupar el mismo producto entre tiendas, para mostrar un solo renglon con el
rango de precios. Con solo el nombre no alcanza: la prueba junto 145 pendrives
distintos bajo la clave "128gb" y metio una notebook entre los SSD de 480GB.
Haria falta un identificador comun (EAN, part number) que ninguna de las cinco
fuentes publica.

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
"Comparar" abre la comparativa de ese producto con sus competidores.

## Tests

    python -m unittest discover -s tests -t . -v
    node --test "tests/js/*.test.js"

Corren en cada PR y antes de cada publicacion. Los de los extractores usan HTML
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
