# Feature Specification: Reglas de ofertas (piso de gama)

**Feature Branch**: `ccr-60ac7c95-dwd1vg`

**Created**: 2026-10-16

**Status**: Fase 1 implementada (piso de RAM y almacenamiento); la Fase 2 espera datos que el indice no tiene

**Input**: Pedido del dueño el 16/10/2026, ante un celular de AliExpress con 4 GB de RAM y 128 GB de ROM listado como oferta: "no me parece una oferta; la RAM es poca para el 2026. Habria que definir reglas para la busqueda de ofertas". Piso pedido: 6 y 8 GB de RAM en smartphones, 16 y 32 GB en notebooks. Como regla general: procesador de este año o del anterior, mejor pantalla, proteccion, audio y multimedia con las ultimas tecnologias, y mayor capacidad y prestaciones.

## Regla

Un descuento no alcanza: antes de mirar el precio, el producto tiene que llegar al piso de gama de su rubro. Lo que no llega no es oferta, y la pestaña dice cuantos avisos con descuento quedaron afuera (Constitucion II: lo que no es comparable se separa y se cuenta).

## Fase 1 (hecha, `js/ofertas.js`, `pisoDeGama`)

| Rubro | RAM minima | RAM ideal | Almacenamiento minimo |
| --- | --- | --- | --- |
| Celular | 6 GB | 8 GB | 128 GB |
| Notebook | 16 GB | 32 GB | 512 GB |

- La RAM se lee del titulo ("8GB RAM", "6GB/128GB", "8+256GB", o los dos numeros mas chicos y mas grandes en GB/TB).
- **Sin RAM legible en el titulo no se destaca.** Mismo criterio que el resto del proyecto: sin datos no se afirma nada. Costo conocido: avisos de iPhone y MacBook, que no suelen nombrar la RAM, quedan afuera hasta resolver la Fase 2.
- Una memoria interna que no se lee no descalifica; una que se lee y no llega, si.
- Solo celulares y notebooks tienen piso; el resto de los rubros sigue como antes.
- Vale para la pestaña Ofertas, el feed RSS y Telegram (los tres usan `calcularOfertas`).

## Fase 2 (pendiente: necesita datos que el indice no tiene)

Procesador de este año o del anterior, pantalla (OLED/AMOLED, tasa de refresco), proteccion (IP, vidrio), audio y multimedia (camara, codecs), y "los mas grandes en capacidad y prestaciones". Hoy el indice solo guarda nombre, precio y tienda, y los titulos no traen esos datos de forma confiable. Camino: leer el procesador y la pantalla del titulo cuando estan, o leer la ficha de las tiendas que la publican (como ya se hace con el part number); medirlo antes de armar la regla, como en `011-novedades`.

## Compras internacionales (pendiente de decidir)

Idea: que entren a Ofertas solo si el costo puesto en casa (calculadora de importacion) es menor que el del mejor equivalente local con un margen. Hoy siguen sin entrar al feed ni a Telegram.
