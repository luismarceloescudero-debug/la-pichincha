# Feature Specification: Reglas de ofertas (piso de gama)

**Feature Branch**: `ccr-60ac7c95-dwd1vg`

**Created**: 2026-10-16

**Status**: Fase 1 implementada (piso de RAM y almacenamiento); la Fase 2 espera datos que el indice no tiene

**Input**: Pedido del dueño el 16/10/2026, ante un celular de AliExpress con 4 GB de RAM y 128 GB de ROM listado como oferta: "no me parece una oferta; la RAM es poca para el 2026. Habria que definir reglas para la busqueda de ofertas". Piso pedido: 6 y 8 GB de RAM en smartphones, 16 y 32 GB en notebooks. Como regla general: procesador de este año o del anterior, mejor pantalla, proteccion, audio y multimedia con las ultimas tecnologias, y mayor capacidad y prestaciones.

## Regla

Un descuento no alcanza: antes de mirar el precio, el producto tiene que llegar al piso de gama de su rubro. Lo que no llega no es oferta, y la pestaña dice cuantos avisos con descuento quedaron afuera (Constitucion II: lo que no es comparable se separa y se cuenta).

## Categorias y criterios (hechos: `js/categorias.js`)

Pedido del 17/10/2026: con el piso solo para celulares y notebooks, el resumen de Telegram llegaba lleno de componentes y perifericos (se ordenaba por porcentaje de descuento sobre un catalogo que es casi todo componentes) y no traia monitores, PCs, notebooks ni smartphones. Ahora cada aviso se evalua en **su** categoria, con numeros concretos, y lo que se exige a una no se exige a las otras.

La categoria sale del titulo: primero lo que se vende *para* un equipo (funda, cargador, soporte: perifericos), despues monitor, PC completa, periferico, componente por el principio del titulo ("Memoria RAM Notebook" es una memoria), notebook, smartphone, componente por palabras clave y, si nada coincide, "otro".

| Categoria | Minimos (si el titulo trae el dato y esta por debajo, no es oferta) | Gama media | Gama alta |
| --- | --- | --- | --- |
| **Monitor** | 144 Hz o mas (sin dato de Hz: no se destaca), panel que no sea TN, 24" o mas | 144 a 239 Hz con IPS, VA, OLED o Mini-LED | **240 Hz o mas con OLED, QD-OLED o Mini-LED** (240 Hz con IPS es media, y dice por que) |
| **Smartphone** | 6 GB de RAM, 128 GB, bateria 4.500 mAh, 90 Hz, chip que no sea de entrada (Unisoc, Helio, Snapdragon 2/4/6, Dimensity 6xxx, Exynos 8xx), 4 años de actualizaciones, generacion reciente | lo que pasa y no es alta | 3 señales o mas de: 8 GB de RAM, 256 GB, chip tope (Snapdragon 8, Dimensity 9xxx, Tensor G3+, Exynos 24xx+, Apple A17+), camara de 108 MP o mas, 7 años de actualizaciones, OLED con 120 Hz, linea Pro/Ultra/Max/Fold/Flip, ultima generacion |
| **Notebook** | 16 GB de RAM, 512 GB, generacion reciente del procesador, pantalla que no sea HD | lo que pasa y no es alta | 3 señales o mas de: 32 GB, 1 TB, CPU i7/i9, Ultra 7/9, Ryzen 7/9 o M Pro/Max, GPU RTX serie 40/50 de xx60 o mas, pantalla OLED, 2.5K o mas o 120 Hz, ultima generacion, DDR5 |
| **PC completa** | 16 GB de RAM, 512 GB, generacion reciente del procesador | igual | igual que notebook |
| **Componente** | segun el tipo, solo con dato: placa de video 8 GB de VRAM; memoria 16 GB y no DDR3; SSD 480 GB; fuente 550 W | placa 8 a 12 GB; memoria o SSD que pasa; fuente 550 W o mas | placa 16 GB de VRAM o mas; DDR5 de 32 GB a 6000 MHz o mas; NVMe PCIe Gen4/5 de 1 TB o mas; fuente 750 W o mas 80 Plus Gold o mejor |
| **Periferico** | ninguno | - | - |

- **Generacion reciente** = la mas nueva de su familia que hay en el indice, o la anterior. Ryzen avanza de a dos (5000, 7000, 9000): la anterior es la de dos numeros atras. Los componentes no tienen piso de generacion (un Ryzen 5 5600 suelto sigue siendo una oferta posible).
- **Sin RAM en el titulo** (iPhone, MacBook): alcanza con un procesador o año reciente; sin ninguna señal, "sin datos" y no se destaca.
- Limitacion conocida: la generacion se lee del numero del modelo, asi que un refresco como el Ryzen 5 5600GT (2024) cuenta como un 5000 y no pasa.
- **Descuento minimo por categoria** (el tachado puede estar inflado, la baja propia no): smartphone, notebook y PC 10% y 5% propia; monitor 12% y 5%; componente y periferico 20% y 8%; sin categoria 15% y 3% (como antes). Tope de 60% para todas.
- **Cupo en el resumen** (Telegram, RSS y /hoy/): 2 lugares reservados por categoria, hasta 3 antes de repartir lo que sobra, para que los componentes no acaparen. Dentro de la categoria: bajas propias primero, a igual señal la gama alta antes que la media, despues por descuento. Sale agrupado por categoria y cada linea de Telegram y del RSS dice la suya.
- **El mismo producto en varias tiendas ocupa un solo lugar** del resumen cuando comparte el codigo de modelo exacto (gana el de mayor descuento). Nunca por parecido: el resumen del 16/10 repetia la misma Gigabyte B840M tres veces, y esas no comparten codigo porque `modelo.py` hoy solo lee RAM, SSD y placas de video. Pendiente: leer el codigo de las placas madre para que tambien se junten.
- Los numeros viven en `MIN`, `DESCUENTO` y `CUPO` de `js/categorias.js`.

## Cruce de gamas

La idea de fondo: ver cuando la gama alta baja hasta el precio de la media. Una oferta **cruza** cuando es una oferta real (baja propia o rebaja publicada, ya con el piso aplicado), es de **gama alta** y cuesta **lo mismo o menos que la mediana de la gama media** de su rubro.

- **Gama alta** = tres señales o mas entre: RAM ideal (8 GB celular, 32 GB notebook), almacenamiento grande (256 GB / 1 TB), vigencia de la generacion (ver abajo), linea Pro/Ultra/Max/Fold/Flip, pantalla OLED/AMOLED y 120 Hz o mas. **Gama media** = pasa el piso y no es alta.
- **Mediana por capacidad**: la gama media se mide por rubro y almacenamiento (128 y 256 GB por separado, `celular:256`). Con menos de 8 avisos de media en esa capacidad, o si el aviso no dice su capacidad, no se afirma nada.
- **Salto entre generaciones** (medido con los titulos del propio indice, por familia: iPhone, Galaxy S, Pixel, chip M, Snapdragon, Core, Ryzen). Se comparan RAM, almacenamiento, Hz, bateria, camara (MP) y OLED de la ultima generacion contra la anterior; solo cuentan los apartados que los titulos de las dos traen (minimo 2). Si la ultima **mejora 2 o mas** apartados, es novedad real: solo ella recibe el punto de vigencia y la anterior queda atras. Si **mejora menos de 2**, la diferencia es minima: la ultima no suma por ser nueva y la **anterior sigue vigente**, asi que las dos reciben el punto (la anterior queda marcada "del año anterior, vigente"). Sin datos suficientes para comparar, solo la ultima.
- Se ve en la pestaña Ofertas (filtro "Gama alta al precio de media" y sello en la tarjeta) y en la descripcion del feed.
- **La regla de vigencia no penaliza al modelo nuevo**: con salto chico los dos, nuevo y anterior, quedan en la misma gama. Lo que se agrega es la aclaracion del porque: cada oferta de una familia con generacion comparable dice, en la tarjeta y en el feed, por que cuenta o no como gama alta este año ("el Pixel 10 mejoró solo 1 de 5 apartados contra el 9: queda en la misma gama que el año anterior", "el Galaxy S 26 mejoró 4 de 5 apartados contra este modelo: ya no cuenta como gama alta").
- Cada oferta que cruza dice **contra que cruza**: "mediana de los celulares de gama media de 256 GB: $X (N avisos)", en la tarjeta y en el feed.
- Pendiente: comparar el salto con mas apartados (procesador por rendimiento real, carga rapida, proteccion IP, audio) cuando los titulos o las fichas los traigan.

## Busqueda con marca y submarca

«Comparar» desde una oferta armaba la consulta con las primeras palabras sin cifras: «Soundcore AeroFit 2 by Anker» buscaba «Soundcore AeroFit by». Ahora, cuando el titulo tiene una submarca conocida (`SUBMARCAS` en `js/buscador.js`: Soundcore, Eufy y Nebula de Anker; Redmi y Poco de Xiaomi; ROG y TUF de Asus; etc.) o un «by Marca»:

1. Se limpia el titulo: sin «by Anker», sin palabras repetidas ni genericas (auriculares, bluetooth, colores...).
2. Se prueba en orden: **submarca + modelo** («Soundcore AeroFit 2»), **solo el modelo** («AeroFit 2») y **marca madre + modelo** («Anker AeroFit 2»); la primera que da resultados.
3. El modelo conserva su numero y se corta en la primera palabra generica o especificacion, asi AeroFit 2 no se confunde con AeroFit Pro ni con AeroClip (el buscador pide todas las palabras).
4. Al filtrar por marca se usa la submarca (`marcaDe` devuelve «soundcore», no «anker»), que es como figura en los filtros.

Sin submarca ni «by», «Comparar» busca como antes.

## Compras internacionales

No quedan afuera: a igual precio dan mas opciones. Pasan por las mismas reglas de gama, se muestran en la pestaña con su sello, y en el RSS, /hoy/ y Telegram van **despues de las locales y rotuladas** ("compra internacional"; pueden pagar impuestos al llegar).

## Pendiente

- **Alternativas y combos**: mostrar junto a una oferta local las opciones internacionales al mismo precio, y combos o accesorios del mismo producto (hoy el buscador separa accesorios y combos). Es una vista nueva: se mide antes de armarla (Constitucion V).
- **Costo puesto en casa** de lo internacional con la calculadora de importacion, para comparar contra el equivalente local.
- **Pantalla, proteccion, audio y multimedia**: los titulos casi no los traen; se necesita la ficha de la tienda. Medir antes.
- **Medido contra el indice real el 19/10** (ver abajo). Lo que sigue afuera por falta de dato: ~100 notebooks y ~95 "celulares" sin RAM ni procesador en el titulo (parte son tablets, cosmeticos con "regeneracion celular" y accesorios que la categoria confunde) y 417 monitores sin Hz (casi todos de oficina, 60/75 Hz: bien afuera).

## Medicion contra el indice publicado (19/10/2026)

Indice del 18/10, 22.533 avisos. Antes y despues de arreglar la lectura de titulos:

| Categoria  | Avisos | Pasan antes | Pasan despues | "Sin datos" antes | despues |
|------------|-------:|------------:|--------------:|------------------:|--------:|
| notebook   | 1.286  | 448         | 486           | 183               | ~100    |
| smartphone | 445    | 196         | 211           | 113               | 95      |
| pc         | 588    | 149         | 154           | 66                | 23      |

Bugs que dejaban afuera equipos que si decian el dato, todos con el titulo real en `tests/js/categorias.test.js`:

1. **Capacidades como las escribe cada tienda**: "SSD512GB" (pegada a letras), "8G 512G" (G sola), "16GB/512", "128/4gb" y "512/8+" (barra o + sin unidad, en cualquier orden). La G sola vale solo para capacidades reales: "8600G" y "3000G" son procesadores. "4G" y "5G" son la red. Una sola capacidad chica ("8G SSD512") es la RAM.
2. **Procesador abreviado**: "I5-1335U", "INTEL I5 1235U", "R5-7535HS". El modelo de cuatro cifras que empieza con 1 es de 10a a 13a generacion (1335U es 13a, no 1a).
3. **El motivo de Ryzen** decia "Ryzen 5: la generacion vigente es la 9"; ahora "Ryzen serie 5000: la generacion vigente es la 9000".

Efecto a tener en cuenta: al reconocer "I5-12400F" sin la palabra "Core", esas PCs ahora caen por la regla de generacion (12a contra 14a vigente), igual que ya caian las que decian "Core i5-12400F". Las PCs armadas con Ryzen 5000 (179) caen por la misma regla: es la regla, no un error de lectura.

**Las bajas propias daban 0 en todo el indice** aunque el historial del 18/10 tenia 29: la corrida manual de la tarde comparaba cada precio contra el que la de la mañana ya habia guardado ese dia, y cualquier relanzamiento en el mismo dia borraba las bajas del indice, de Telegram y del RSS. Ahora la baja se mide contra el precio de antes de hoy (`historial.leer(carpeta, antes_de=hoy)`), con su test en `tests/test_indexar_corrida.py`.

## Identidad del mismo producto entre tiendas (18/10/2026)

Pedido: que un modelo no quede afuera solo porque una tienda lo publica distinto o porque no comparte las mismas caracteristicas en el titulo. Antes, por part number, la cobertura medida el 14/10 era RAM 38%, SSD 31% y placas de video 14%, con 0 a 4 avisos agrupados (`specs/007-identidad-por-gtin/viabilidad.md`), y las placas madre ni tenian codigo (`modelo.py` las excluia).

Bugs encontrados al mirar como publica cada tienda, todos con un titulo real en los tests:

1. **Placas madre sin identidad**: "Motherboard GIGABYTE B840M H AM5 DDR5", "Mother GIGABYTE B840M H DDR5 – AM5" y "Motherboard Gigabyte B840M H AM5 DDR5 mATX" ocupaban 3 lugares del resumen. Ahora tienen firma.
2. **El rubro dependia de la primera palabra**: "SODIMM DDR5 8GB HIKSEMI", "Hiksemi Hiker Ddr4 32Gb 3200Mhz U-Dimm" y "Kingston Fury Beast DDR5 16GB" no eran memoria; y "Memoria RAM Notebook SODIMM" se descartaba por decir "notebook".
3. **Tipografia**: guion largo (–), espacio duro, comillas de pulgadas distintas (27″), "16G" contra "16GB", "2Tb" contra "2000GB", "Negro" contra "Black", "U-Dimm" contra "UDIMM", el codigo interno "(3242)" de Max Tecno al final del nombre.
4. **La misma placa con dos nombres**: "Placa De Video Msi Geforce Rtx 5070 TI 16G Ventus 3X Oc" y "VGA MSI GeForce RTX 5070 Ti 16GB GDDR7 VENTUS 3X OC".
5. **ComparaYa ignorado**: su API trae `specifications.Modelo`, `brand` y `extracted_specs` (Hz, pulgadas) y el indexador solo leia el titulo; un monitor "Gaming 25\" FHD 240Hz con panel IPS" (marca Samsung) no se encontraba al buscar Samsung ni se reconocia la marca.
6. **Dos comercios por ComparaYa eran uno**: `agruparPorModelo` agrupaba por la clave de tienda (`comparaya`) y no por comercio (Frávega, Musimundo...), asi que descartaba el segundo.
7. **El mismo aviso contado dos veces** cuando llegaba directo y por ComparaYa con la URL escrita distinto (www, barra final, utm_*): la busqueda mostraba las dos filas.
8. **Unidades pegadas**: "165Hz1ms" y "5000mAh120Hz" no se leian.
9. **Equipos con otro nombre**: Honor, Oppo, Vivo, Nothing, Galaxy Z Flip, Victus, Inspiron, Aspire... no eran celular ni notebook; un monitor con la marca primero ("LG UltraGear 27GP850 Monitor Gaming") tampoco.

Lo que NO se hizo, a proposito: agrupar notebooks, celulares y monitores por un token con forma de codigo que aparezca en dos tiendas. Los titulos traen el procesador ("i5-13420H") y la placa ("RTX 4050") con forma de codigo y se mezclarian modelos distintos; antes de hacerlo hay que medirlo con el indice real (como en `specs/007`). Hoy esos rubros se agrupan por el part number de un catalogo o de ComparaYa.

10. **Un modelo quedaba afuera porque una tienda no escribe el dato**: si el titulo de una tienda no dice la RAM o los Hz pero otra tienda publica el mismo producto (mismo codigo de modelo) con el dato, la oferta hereda la evaluacion de la que si lo trae. Solo se mira a la otra cuando a esta le *falta* el dato; si la otra dice que no llega al minimo, tampoco llega.

Comprobado de punta a punta con el resumen del 16/10: las tres placas madre B840M, las dos RTX 3060 y los dos SSD SanDisk 2TB reciben cada grupo un identificador comun y ocupan un solo lugar; los dos SSD y la RTX 5070 Ti salen por no llegar al 8% de baja que se exige a un componente.

### Historial en el buscador

Cada resultado dice "precio sin cambios desde el 12/10" (sin baja ni rebaja a la vista). La columna 11 del indice (`desde`) guarda la fecha del ultimo cambio, de `serie.desde_cuando`; el indice trae `historial.inicio`, el primer dia que se sigue el precio. **Antes de esa fecha no sabemos nada**: el seguimiento empezo el 7/10/2026, asi que "sin cambios desde marzo" solo se podra decir cuando haya historial de marzo; hasta entonces el texto aclara "cuando empezamos a seguirlo; puede ser mas antiguo". Una categoria sin ofertas en el dia (por ejemplo notebooks) se dice en la pestaña Ofertas y se manda al buscador.
