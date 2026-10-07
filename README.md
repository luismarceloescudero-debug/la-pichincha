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
| `index.html` | La pagina que sirve GitHub Pages |
| `comparativa-ram-ddr4-16gb.html` | Mismo contenido sin el `<head>`, fuente del artifact |
| `img/` | Fotos oficiales de producto, optimizadas |

Las imagenes son material de los fabricantes y las tiendas, usadas como
referencia de producto en una comparativa de precios.

## Actualizar los precios

```
python actualizar.py              # releva las 4 tiendas, recalcula y reconstruye el sitio
python actualizar.py --dry-run    # solo muestra el informe, no escribe
python actualizar.py --solo mexx  # una sola tienda
python actualizar.py --build      # reconstruye el HTML sin salir a la web
```

El script lee los precios de un metadato estable en cada tienda, asi que no
necesita navegador: CompraGamer publica su catalogo como JSON, y Gaming City,
Mexx y FullH4rd lo dejan en una etiqueta `meta` o en microdatos schema.org.
Avisa cuando un producto cambia de precio, cuando se queda sin stock y cuando
el cambio da vuelta el podio, que es el unico caso en el que hay que reescribir
el veredicto a mano.

`datos.json` es la unica fuente de verdad: el script actualiza precios, stock e
historial, y reinyecta todo en los dos HTML. El contenido editorial (specs,
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

1. `actualizar.py` releva los precios de los productos seguidos y, si cambio
   alguno, commitea `datos.json` con el historial.
2. `indexar.py` arma el indice de busqueda.
3. El sitio se sube como artefacto de Pages, sin tocar el repo.

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

La pestana Ofertas muestra productos cuyo precio bajo respecto del que la
tienda misma publicaba. No todas las fuentes sirven para esto: en CompraGamer,
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
