# Feature Specification: La verificacion de Carrefour daba todo por caido

**Created**: 2026-10-24

**Status**: Implementada.

**Input**: En la corrida del 23/10 22:06 las cuatro candidatas de Carrefour se descartaron «(renderizada)», y la fiabilidad
del mes decia «carrefour.com.ar: 35 de 35 caidas o con otro precio». `/estado/` publicaba 39 de 39 (100%) el 24/10.

## Causa

Dos errores del verificador, uno detras del otro:

1. `verificar_ofertas.pedir_api` no mandaba user-agent. La API de catalogo de Carrefour (VTEX) responde **403** al de Python
   por defecto (`Python-urllib/3.x`) y 200 al del sitio; OnCity, Naldo y las demas VTEX aceptan los dos. `revisar_vtex`
   devolvia `None` y la verificacion seguia con la pagina.
2. Cada pagina de una tienda VTEX trae los textos de su interfaz, entre ellos
   `"store/availability-subscriber.title":"Este producto no está disponible en este momento"` (la plantilla del aviso
   de reposicion). `CAIDA` lo encontraba y `veredicto` daba la oferta por caida aunque se pudiera comprar.

## Decisiones

- `pedir_api` va con el user-agent del sitio (`UA`), como `bajar` y el navegador. Las cabeceras de cada llamada se suman.
- `veredicto` saca los textos de interfaz de VTEX (`"store/...":"..."`) antes de buscar el cartel; el cartel visible en la
  pagina sigue contando.
- **Fiabilidad**: las revisiones de Carrefour hasta el 24/10 inclusive no entran al resumen (`fiabilidad.ANULADAS`). Quedan en
  `historial/verificacion/` porque es lo que paso, pero no se publica en `/estado/` una tasa que era del verificador.

## Ensayo

Con la tienda real (24/10): la API de un celular de Carrefour da 200 y «viva»; la pagina completa (1,9 MB) da «viva» con
`veredicto`; las cuatro candidatas descartadas el 23/10 (dos HP ProDesk, una tablet TCL y una estacion de carga) dan «viva»
por la API.

## Tests

`tests/test_verificar_ofertas.py`: `pedir_api` va con el user-agent; los textos de interfaz de VTEX no son el estado del
producto y el cartel visible si. `tests/test_fiabilidad.py`: las revisiones anuladas no entran al resumen.

## Tambien en esta tanda (revision del 24/10)

- **El mismo producto de Mercado Libre dos veces** (`js/buscador.js`, `urlClave`): el 24/10 13:12 salio dos veces el monitor
  ASRock Phantom Gaming 31.5" ($729.999): ComparaYa lo trajo con dos textos de direccion para el mismo catalogo
  `/p/MLA79317178`. `urlClave` identifica un producto de catalogo por su numero, como `indexar.clave_aviso`. En el indice
  de ese dia habia 22 avisos asi.
- **El piso de 30 dias cuenta aunque el producto haya dejado de publicarse en el medio** (`serie.piso_previo`, spec 029):
  la RTX 5090 de Venex valia $8.099.999 el 13/10, volvio el 22/10 a $13.999.999 y a $11.999.999 salio «−14%». Sigue sin
  haber baja si el producto volvio hoy. Con el indice del 24/10: 66 bajas propias pasan a 39; salen la RTX 5090 y la
  impresora Brother ($419.189, un dia a $487.599, de vuelta a $419.189).
