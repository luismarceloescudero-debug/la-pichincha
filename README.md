# La Pichincha

> Hardware en Argentina. No lo más barato: lo que más rinde.

Comparador de hardware en Argentina. No compara solo precios: cruza latencia,
garantia real, stock y el costo puesto en tu casa con el envio adentro.

**Sitio:** https://luismarceloescudero-debug.github.io/la-pichincha/

## Que contiene

- Los 3 mejores modulos de 16GB DDR4 3200 por relacion marca/precio, con specs
  de fabrica (timings, voltaje, rangos, altura, garantia) y precio puesto en
  Mendoza con el envio incluido.
- Las 3 tiendas que mejor pagan la calidad, cruzando el mismo producto entre
  CompraGamer, Gaming City, Mexx y FullH4rd.
- Comparativa de webcams en esas mismas tiendas.

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
