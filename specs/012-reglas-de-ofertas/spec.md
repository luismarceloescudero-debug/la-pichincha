# Feature Specification: Reglas de ofertas (piso de gama)

**Feature Branch**: `ccr-60ac7c95-dwd1vg`

**Created**: 2026-10-16

**Status**: Fase 1 implementada (piso de RAM y almacenamiento); la Fase 2 espera datos que el indice no tiene

**Input**: Pedido del dueño el 16/10/2026, ante un celular de AliExpress con 4 GB de RAM y 128 GB de ROM listado como oferta: "no me parece una oferta; la RAM es poca para el 2026. Habria que definir reglas para la busqueda de ofertas". Piso pedido: 6 y 8 GB de RAM en smartphones, 16 y 32 GB en notebooks. Como regla general: procesador de este año o del anterior, mejor pantalla, proteccion, audio y multimedia con las ultimas tecnologias, y mayor capacidad y prestaciones.

## Regla

Un descuento no alcanza: antes de mirar el precio, el producto tiene que llegar al piso de gama de su rubro. Lo que no llega no es oferta, y la pestaña dice cuantos avisos con descuento quedaron afuera (Constitucion II: lo que no es comparable se separa y se cuenta).

## Reglas (hechas, `js/ofertas.js`, `pisoDeGama`)

Solo celulares y notebooks tienen piso; el resto de los rubros sigue como antes. Vale para la pestaña Ofertas, el feed RSS, /hoy/ y Telegram.

1. **RAM y almacenamiento, si el titulo los dice.** Celular: 6 GB de RAM (ideal 8) y 128 GB. Notebook: 16 GB (ideal 32) y 512 GB. Se leen de "8GB RAM", "6GB/128GB", "8+256GB" o los dos numeros en GB/TB del titulo.
2. **Generacion del procesador, relativa al indice.** "Reciente" es la generacion mas nueva que hay a la venta en el propio indice o la anterior (iPhone, chip M, Galaxy S, Pixel, Snapdragon 8, Core i, Core Ultra, Ryzen). No hay una tabla de años que envejezca: cuando sale un iPhone nuevo, el de dos generaciones atras deja de ser oferta solo. Tambien vale con RAM suficiente: 16 GB con un Core de 8va generacion no pasa.
3. **Año del modelo**, si el titulo lo trae: el mas nuevo del indice o el anterior.
4. **Bateria** (celular, minimo 4.500 mAh), **refresco** (celular, minimo 90 Hz) y **pantalla HD** de notebook, si el titulo los trae.
5. **Sin RAM en el titulo** (iPhone, MacBook) no se descarta: alcanza con una señal reciente (procesador o año). Sin ninguna de las dos, "sin datos" y no se destaca.

La pestaña dice cuantos avisos con descuento quedaron afuera. Los umbrales estan en `PISOS` de `js/ofertas.js`.

## Cruce de gamas

La idea de fondo: ver cuando la gama alta baja hasta el precio de la media. Una oferta **cruza** cuando es una oferta real (baja propia o rebaja publicada, ya con el piso aplicado), es de **gama alta** y cuesta **lo mismo o menos que la mediana de la gama media** de su rubro.

- **Gama alta** = tres señales o mas entre: RAM ideal (8 GB celular, 32 GB notebook), almacenamiento grande (256 GB / 1 TB), vigencia de la generacion (ver abajo), linea Pro/Ultra/Max/Fold/Flip, pantalla OLED/AMOLED y 120 Hz o mas. **Gama media** = pasa el piso y no es alta.
- **Mediana por capacidad**: la gama media se mide por rubro y almacenamiento (128 y 256 GB por separado, `celular:256`). Con menos de 8 avisos de media en esa capacidad, o si el aviso no dice su capacidad, no se afirma nada.
- **Salto entre generaciones** (medido con los titulos del propio indice, por familia: iPhone, Galaxy S, Pixel, chip M, Snapdragon, Core, Ryzen). Se comparan RAM, almacenamiento, Hz, bateria, camara (MP) y OLED de la ultima generacion contra la anterior; solo cuentan los apartados que los titulos de las dos traen (minimo 2). Si la ultima **mejora 2 o mas** apartados, es novedad real: solo ella recibe el punto de vigencia y la anterior queda atras. Si **mejora menos de 2**, la diferencia es minima: la ultima no suma por ser nueva y la **anterior sigue vigente**, asi que las dos reciben el punto (la anterior queda marcada "del año anterior, vigente"). Sin datos suficientes para comparar, solo la ultima.
- Se ve en la pestaña Ofertas (filtro "Gama alta al precio de media" y sello en la tarjeta) y en la descripcion del feed.
- Cada oferta que cruza dice **contra que cruza**: "mediana de los celulares de gama media de 256 GB: $X (N avisos)", en la tarjeta y en el feed.
- Pendiente: comparar el salto con mas apartados (procesador por rendimiento real, carga rapida, proteccion IP, audio) cuando los titulos o las fichas los traigan.

## Compras internacionales

No quedan afuera: a igual precio dan mas opciones. Pasan por las mismas reglas de gama, se muestran en la pestaña con su sello, y en el RSS, /hoy/ y Telegram van **despues de las locales y rotuladas** ("compra internacional"; pueden pagar impuestos al llegar).

## Pendiente

- **Alternativas y combos**: mostrar junto a una oferta local las opciones internacionales al mismo precio, y combos o accesorios del mismo producto (hoy el buscador separa accesorios y combos). Es una vista nueva: se mide antes de armarla (Constitucion V).
- **Costo puesto en casa** de lo internacional con la calculadora de importacion, para comparar contra el equivalente local.
- **Pantalla, proteccion, audio y multimedia**: los titulos casi no los traen; se necesita la ficha de la tienda. Medir antes.
- **No medido contra el indice real**: no hay `indice.json` local. Antes de dar por buena la lectura de titulos, mirar en la corrida diaria cuantos avisos de celulares y notebooks quedan afuera y por que.
