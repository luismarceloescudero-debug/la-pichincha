# Spec 063: comparar por características, no por texto ni por tienda

**Creada**: 09/11/2026

**Estado**: PLANIFICACIÓN. Nada de esto está implementado. El dueño respondió las tres preguntas el 09/11 (sección «Decisiones del dueño»); queda un dato por traer: un ejemplo de carrito por tienda para la fase 6b.

**Pedido del dueño (09/11/2026)**: la Comparativa, el Veredicto, Ofertas y Buscar/Afuera comparan por texto y por tienda. Tienen que comparar **por características del tipo de producto**. Casos que trajo: «Celular Motorola Signature», tres tarjetas por categoría en la portada, el botón «Comparar» que abre «contra ninguno» o contra el mismo producto en otras tiendas, «monitor qhd 240hz», «Aero» / «aeroclip 2» y «notebook i5 16gb 512gb» (A y B son la misma notebook).

## Qué se midió (índice publicado del 09/11, `pichinchadeldia.com.ar/indice.json`, 6,4 MB)

Reproducido con los módulos reales de `js/` en Node (guion en el scratchpad de la sesión, no se commitea). No son opiniones: son los números de hoy.

### 1. Las características se leen con tres lectores que no coinciden

| Lector | Dónde se usa | Qué lee |
| --- | --- | --- |
| `Buscador.specsDe` | pastillas de las tarjetas y tabla «En qué se diferencian» de la Comparativa | DDR, capacidades en orden del título, MHz, pulgadas, Hz, resolución, núcleos. **No lee procesador, placa de video ni chip de celular** |
| `Especificaciones.clavesDe` | decide qué es «comparable» (`mismas`) | CPU, RAM, ROM, GPU, panel, Hz… pero **solo si el título dice «celular»/«notebook»/«monitor»** para saber la categoría |
| `Titulo.de` | pastillas de Ofertas y de «Lo último en tecnología» | su propio conjunto |

Consecuencias medidas:
- «Motorola **Signature** 5g Dual Sim 1tb Negro 16gb Ram…» (sin la palabra «celular»): `clavesDe` devuelve `{}`. Ese aviso no tiene categoría ni especificaciones para comparar, aunque es un celular de 1 TB y 16 GB.
- `specsDe` muestra «1TB + 16GB» en un aviso y «16GB + 1TB» en otro: son capacidades en el orden del título, no «RAM» y «almacenamiento». Y «16 Gb 1000 Gb» (OnCity) sale como «16GB + 1000GB», no «1 TB».
- En una notebook, la tarjeta no muestra procesador ni placa de video aunque estén en el título: por eso una tarjeta dice «Ryzen 7» (la leyó otro lector) y la de al lado no.

### 2. El botón «Comparar» de la portada falla en 8 de 12 filas

Las 12 filas de «Lo último en tecnología» (4 categorías × 3), pasadas por `consultaDeOferta` + `analizarConsulta` con la fila como referencia:

| Resultado | Filas | Ejemplos |
| --- | --- | --- |
| **Ninguna comparativa** (la consulta no encuentra nada) | 4 | Honor 600 Pro → consulta «memoria 512gb»; Razr 60 Ultra → «memoria 1tb»; dos PC gamer → «memoria 32gb» / «memoria ddr5 16gb». `consultaDeOferta` no conoce celulares ni PCs y cae en la regla de «memoria» porque el título dice «RAM» |
| **Contra sí misma (1 comparable)** | 4 | Notebook HP OMEN i9/32/1TB/RTX 4080; MSI Crosshair; ASUS ROG Strix; PC Ecovision. La exigencia «mismo CPU + RAM + disco + GPU» deja un solo aviso |
| Funciona | 4 | Galaxy S26 Ultra (12 avisos) y los 3 monitores (2 a 5 avisos) |

Y cuando funciona, compara **el mismo producto en distintas tiendas**: «Precio por tienda» tiene una tabla por tarjeta (`porTienda`), pero casi todas las tarjetas son 1 tienda. El dueño lo ve como «comparado contra el mismo producto pero en otra tienda».

### 3. «Celular Motorola Signature» (el caso del dueño, reproducido igual: mejor compra $2.399.999 OnCity)

- La Comparativa muestra **una sola tarjeta** (Mejor compra y más barata), con 8 avisos que mezclan 16 GB/1 TB con 12 GB/512 GB.
- La palabra «celular» obliga a que el título la tenga: **deja afuera el aviso más barato** (Compra Cierta, 1 TB, 16 GB, $1.972.585) porque su título empieza con «Motorola Signature». La mejor compra real no es la que sale.
- Sin esa palabra («motorola signature»), el aviso más barato sale pero queda como «Mejor compra» sin ninguna especificación comparable (`clavesDe` vacío).

### 4. «notebook i5 16gb 512gb» (A y B son «la misma notebook»)

- Las picks son ASUS Vivobook F1404ZA (Venex, $1.199.990) y «Notebook CX 15.6″» (SCP, $1.236.943): **mismo CPU (i5-1235U), misma RAM, mismo disco, 3% de diferencia**. Para quien compara son la misma máquina; la tarjeta no muestra nada que las distinga (ni procesador, ni pantalla, ni sistema operativo).
- Hay duplicados del mismo modelo que la regla de «un solo modelo» no junta: Victus 15 con RTX 4050 aparece **5 veces solo en CompraGamer** (códigos BA1U4LA, sin código, con y sin «Gamer»); Lenovo IdeaPad Slim 3 15IRH10, 4 veces en 4 tiendas con 4 títulos; HP 250R G10 DB9V5AT, 3 tiendas.
- `cpuDe` no lee «Core i5 120U», «Core i5 210H» ni «Intel Core i5» sin modelo: **22 de los 54 avisos comparables** de esta búsqueda quedan sin procesador y, en todo el índice, **1.141 de 1.868 notebooks (61 %)** no tienen CPU leída. Sin CPU no hay comparación justa (`MIN_CLAVES`).

### 5. «Armado para tu búsqueda» (Ofertas, «monitor qhd 240hz» y Veredicto, «Aero»)

- **Ofertas**: la búsqueda dice «qhd 240hz», la tarjeta de referencia era OLED. El cartel termina comparando solo «OLED · 240 Hz · 2K (QHD)» (19 avisos) y deja afuera 30 por «otras especificaciones», incluidos monitores QHD 240 Hz IPS que sí coinciden con lo que el dueño pidió. Una especificación de la tarjeta (panel) se vuelve tan obligatoria como las que escribió la persona.
- Además el cartel de lo que se dejó afuera es una línea de 5 a 10 motivos, ilegible. Y es redundante con la mejor oferta: ya se muestra la tienda más barata de cada modelo.
- **Veredicto «Aero»**: con 73 avisos, las tarjetas son un auricular JBL «Reflect Aero», un ventilador **Aerocool** y dos placas madre **Gigabyte «Aero»**. Los motivos de exclusión (18 «muy por debajo… sin marca», 6 equipos, 4 accesorios, 3 «más del triple») son de precio y de palabras, ninguno dice «esto es otra categoría». Nada identifica de qué producto se trata.
- **«aeroclip 2»**: el índice local tiene **0 avisos** (hay 1 solo Soundcore: un P25i). Quien lo "entiende" es el Worker «Afuera» (en vivo). Como la búsqueda sin resultados locales hace `limpiarConsulta()` y `consultaReciente()` salta los textos sin resultados, el Veredicto cae en la última búsqueda con resultados guardada en el historial: **«Aero»** (el texto parcial que se guardó 1,2 s después de escribir las primeras cuatro letras, `js/busqueda.js:314`). Por eso el Veredicto «no representa la última búsqueda».

### 6. «Buscalo afuera»

El bloque arma enlaces con el texto tal cual lo escribió la persona (`Importar.buscarAfueraHtml`, `normalTermino`): sin traducir al inglés, sin sacar relleno («auriculares inalámbricos»), sin marca ni modelo separados, sin saber de qué categoría es. El Worker `/buscar?q=` recibe el mismo texto. Lo que hace bien una búsqueda local con «aeroclip 2» (entenderla) no pasa afuera.

## Decisiones

### D1. Un solo lector de características (la fuente de verdad)

1. `js/especificaciones.js` pasa a ser **el** lector. `Buscador.specsDe` y las pastillas de `Titulo` salen de él (o quedan como adaptadores finos). Una característica leída una vez se muestra y se compara igual en todos lados.
2. La categoría **se deduce por atributos, no por una palabra**: RAM + almacenamiento + 5G/Dual SIM ⇒ celular; procesador + RAM + disco + pantalla ⇒ notebook; etc. «Motorola Signature 5g Dual Sim 1tb…» es un celular.
3. Más categorías con características propias: auriculares (tipo: TWS/diadema/intra; cancelación de ruido; Bluetooth; autonomía), teclados (formato, tipo de switch, conexión), mouse (sensor/DPI, conexión), placas de video, fuentes, etc. Cada categoría declara su lista de características **ordenada y fija**: tarjeta y tabla muestran siempre las mismas filas; lo que el título no dice se muestra «—» (principio II: no se afirma lo que el título no dice).
4. Unidades normalizadas: «1000 Gb» = «1 TB», «16 Gb» pasa a «16 GB de RAM» si la categoría lo permite; RAM y almacenamiento se rotulan, no se ordenan por aparición.
5. CPU: familia y generación incluyen «i5 120U», «Core 5 120U», «Ryzen AI», «Snapdragon»/«Apple M»… medido contra el 100 % de las notebooks del índice, con meta: bajar del 61 % actual a ≤ 10 % de notebooks sin procesador (el resto sin dato en el título).

### D2. Primero se identifica el producto; después se compara (Veredicto, Comparativa, Ofertas, Buscar)

1. Toda búsqueda produce un **perfil**: categoría dominante (por votación de los mejores resultados, ponderada por cuántos avisos la tienen), marca/línea (si la hay) y las características que la persona pidió. Se muestra al principio: «Interpretamos *Soundcore AeroClip 2* (auriculares inalámbricos abiertos)».
2. Los avisos de **otra categoría** (la placa madre «Aero», el ventilador Aerocool) salen del cálculo y se cuentan con un motivo claro: «12 de otro tipo de producto». Hoy `tipo` existe pero solo se activa con palabras fijas.
3. El Veredicto se escribe **con las características de esa categoría**: qué trae la mejor compra frente a las demás en las filas que importan (no solo precio y marca), y qué pierde la más barata.
4. **El Veredicto representa la última búsqueda**: se guarda la última búsqueda ejecutada por separado del historial, con su resultado (con o sin avisos locales). Sin avisos locales se dice «no hay en las tiendas del índice» y se ofrece Afuera; no se muestra una búsqueda anterior. El historial deja de guardar texto parcial (solo al apretar Enter, tocar un resultado o pasar 3 s sin tipear con ≥ 3 caracteres y resultados).

### D3. Comparar = productos equivalentes de distintas marcas, no el mismo producto en distintas tiendas

1. Se junta primero **por modelo** (una fila por modelo, la tienda más barata = «mejor oferta», lo que ya hace Ofertas con spec 028). El «mismo modelo» se reconoce por código de fabricante en el título (DB9V5AT, BA1U4LA, NL16-71G…), por familia + configuración y, si falta, por título limpio con la misma configuración. Los 5 Victus de CompraGamer pasan a 2 (RTX 3050 / RTX 4050).
2. Las tarjetas de la Comparativa son **modelos distintos**. Regla del dueño (09/11): **distinta marca + al menos 2 características clave en común** (de las que el título dice) alcanza para compararlos; cuantas más comparten, más arriba salen. La misma marca con las mismas especificaciones es el mismo producto (punto 3). Cada categoría declara sus características clave y cuáles pesan más en un solo lugar.
3. Selección de las 3 tarjetas: (a) la mejor oferta del modelo de referencia; (b) el equivalente más barato **de otra marca**; (c) un escalón arriba (más RAM/disco/GPU) y/o uno abajo, rotulados con la diferencia exacta. Dos avisos de la **misma marca con las mismas especificaciones** (aunque el título sea otro) **son un solo producto**: queda la tarjeta del mejor precio y una línea «y N avisos iguales» con sus tiendas. Distinta marca con las mismas especificaciones no se junta: son dos opciones, y la tarjeta muestra en qué se diferencian (pantalla, sistema operativo, peso). Eso resuelve el caso de las tarjetas A y B del 09/11 solo si las dos son de la misma marca; si son de marcas distintas (ASUS y «CX») se muestran como dos opciones y se aclara lo que las distingue.
4. «Precio por tienda» queda como detalle del modelo elegido (una tabla o un plegable), no como una tarjeta ni como el modo principal de comparar.
5. Cuando hay menos de 3 equivalentes se **relaja una característica por vez, y se dice cuál** («no hay otra notebook con i9 y RTX 4080 menores a $X; mostramos las más cercanas: i9 con RTX 4070»). Nunca queda «contra ninguno».

### D4. «Comparar» siempre lleva a una comparación útil

1. El botón arma la comparación desde **la fila de referencia y su perfil**, no desde un texto reconstruido (`consultaDeOferta`). El texto de búsqueda que se muestra se arma del perfil («Celulares 16 GB · 1 TB · 5G»).
2. Si aun relajando no hay al menos 2 modelos distintos, el botón no se ofrece (o se reemplaza por «Ver precio en otras tiendas» que es lo que realmente hay).
3. La referencia viaja en la URL (hoy se pierde al recargar, spec 017 fase 1) para que el enlace compartido reproduzca la comparación.

### D5. Ofertas: lo que la persona pidió manda, lo de la tarjeta orienta

1. Las características **escritas en la búsqueda** son obligatorias; las que solo tiene la tarjeta (el panel OLED) son una **preferencia** con un interruptor visible: «Solo OLED (19) / Incluir IPS y VA (49)».
2. El cartel de «Dejamos afuera…» se muestra en dos líneas: lo comparado y «ver qué dejamos afuera (n)» plegable con los motivos en lenguaje llano y ejemplos.
3. La comparación se hace **entre modelos** (D3), no entre tiendas; la redundancia con «mejor oferta» desaparece.

### D6. Afuera: buscar mejor, no más

1. Con el perfil (D2) se arma una consulta de afuera **limpia y en el idioma de cada tienda**: marca + modelo + producto (ej. «Soundcore AeroClip 2 earbuds»), sin relleno en español. Diccionario chico y fijo por categoría (auriculares inalámbricos → «wireless earbuds»).
2. Cuando el índice local no tiene nada («aeroclip 2»), el **Worker** devuelve los títulos de afuera y, con ellos, el perfil (marca, línea, categoría) para completar el Veredicto y buscar equivalentes locales (por marca y tipo).
3. Se eligen las fuentes según la categoría (no se manda un auricular a la tienda de repuestos), y se muestra la comparación **puesta en casa vs. la mejor oferta local** con el costo estimado importado que ya cubre la spec 039 (referencia de costo, sin calculadora, spec 040).
4. El Worker no pierde la consulta cruda: sigue recibiendo el texto original para registro, y suma `?perfil=` solo para las fuentes que lo aprovechan. El orden sigue siendo por precio, nunca por comisión (principio II).

## Más recomendaciones (lo que apareció al medir)

1. **Mejor oferta real**: una palabra de la búsqueda que no está en el título del aviso más barato lo oculta («celular»). Las palabras de categoría se tratan como **sinónimos de la categoría** (parte del perfil), no como texto exigido.
2. **Precio por característica** ($ por GB de almacenamiento, por Hz, por pulgada) en la fila «Plus» de la tabla, como dato, no como veredicto.
3. **Por qué esta y no otra**: en cada tarjeta, la diferencia contra la mejor compra en las filas de características («+4 GB de RAM, −$120.000»).
4. **Calidad de datos medida**: el script de la skill `/medir-indice` suma tres números: avisos de la categoría con ≥ 3 características leídas, porcentaje de modelos duplicados y porcentaje de consultas de «Comparar» (las 12 de la portada y las N de Ofertas) que dan ≥ 3 modelos distintos. Se corre antes del PR (CLAUDE.md).
5. **E2E**: casos de oro con el índice de prueba: «celular motorola signature», «notebook i5 16gb 512gb», «aero», «aeroclip 2» (con Worker simulado), «monitor qhd 240hz». Sirven también como regresión.
6. **Rendimiento**: las características se calculan en el navegador y se memorizan por aviso (como `IDX._n`) o en el worker de Ofertas (`js/ofertas-worker.js`); no se suma una columna al índice (6,4 MB ya pasa el gatillo de la Fase 4 de `docs/plan-de-escalado.md`). Si hiciera falta precalcular, se agregan pocos bytes por aviso en `adelgazar_indice.js`, medidos antes.
7. **Accesibilidad y celular**: las filas de características son una lista con rótulos, no solo pastillas de color; en pantalla angosta cada tarjeta es una ficha apilada, sin scroll horizontal.

## Plan por fases (cada una se mergea sola y deja los tests en verde)

| Fase | Qué entrega | Se nota en | Riesgo |
| --- | --- | --- | --- |
| **0 · Línea de base** | Medir los 5 casos y las 12 filas con `/medir-indice`; fijar los casos de oro como tests rojos (TDD, principio IV) | nada visible | bajo |
| **1 · Lector único (D1)** | `Especificaciones` con categoría por atributos, características por categoría, CPU mejorada; `specsDe` y `Titulo` leen de ahí | tarjetas y tabla con siempre las mismas filas; Motorola Signature clasificado | medio: cambia pastillas en todo el sitio, medir con `/medir-indice` cuántos títulos cambian |
| **2 · Modelo único (D3.1)** | Dedupe por código/familia+configuración; «y N más iguales» | notebooks, celulares, monitores | medio: no fusionar variantes distintas (RTX 3050 vs 4050) |
| **3 · Equivalentes (D3.2-3.5 y D4)** | Clases de equivalencia, selección de 3 modelos distintos, relajación rotulada, «Comparar» desde el perfil | portada (12 filas), Ofertas, botón por fila | alto: es el cambio de fondo; flag de corte para volver a lo anterior |
| **4 · Perfil y Veredicto (D2)** | Perfil de la búsqueda, categorías ajenas fuera, última búsqueda separada del historial, Veredicto por características | Veredicto, Buscar | medio |
| **5 · Ofertas (D5)** | Interruptor obligatorio/preferencia, cartel plegable | Ofertas | bajo |
| **6a · Afuera (D6.1-D6.4)** | Consulta limpia por idioma/categoría, perfil desde el Worker | Buscar | medio: toca el Worker (`worker/`) y su CSP |
| **6b · Veredicto sin avisos locales (D6.5-D6.8)** | Opciones de afuera, pegado del carrito por tienda, total puesto en casa, veredicto | Veredicto, Buscar | medio: necesita un ejemplo real de carrito por tienda (lo trae el dueño) |
| **7 · Cierre** | E2E de los casos de oro, informe de `/medir-indice`, docs (`mapa.md`, README), continuidad | — | bajo |

Orden y dependencias: 0 → 1 → 2 → 3; 4 puede ir en paralelo con 2 desde que 1 está; 5 necesita 3; 6 necesita 4. Si hay que recortar, el mínimo que arregla lo pedido es **1 + 2 + 3 + 4** (Fase 3 es la que elimina el «contra ninguno»).

## Criterios de aceptación (medibles)

1. De las 12 filas de «Lo último en tecnología», **12** abren una comparativa con **≥ 3 modelos distintos** (hoy 4 de 12 sirven, 4 abren «nada» y 4 abren «contra sí misma»), o el botón no se muestra y se dice por qué.
2. «Celular Motorola Signature» muestra **≥ 3 tarjetas**, ninguna con el mismo modelo en otra tienda, y el aviso de $1.972.585 es la mejor compra o se explica por qué no (hoy sale 1 tarjeta y se oculta el más barato).
3. Dos tarjetas de la misma categoría muestran **las mismas filas de características** (valor o «—»). En notebook: procesador, RAM, disco, placa, pantalla siempre presentes.
4. En «notebook i5 16gb 512gb» no hay dos tarjetas de la misma marca con las mismas especificaciones (queda la de menor precio); ASUS y «CX» (marcas distintas, mismo i5-1235U/16/512) se muestran como dos opciones con lo que las distingue a la vista.
5. «Aero» no mezcla placas madre, ventiladores y auriculares: la categoría dominante se declara y el resto aparece como «otro tipo de producto».
6. Después de buscar «aeroclip 2» (con o sin avisos locales), el Veredicto dice «aeroclip 2» o «no está en las tiendas del índice»; **nunca** una búsqueda anterior ni un texto parcial.
7. «monitor qhd 240hz» desde una tarjeta OLED: comparables **≥ al total de monitores QHD 240 Hz** con el interruptor en «incluir otros paneles» (hoy 19 de 49).
8. «Buscalo afuera» para «aeroclip 2» arma consultas con marca+modelo+producto en inglés para las fuentes que corresponden; probado con el Worker simulado.
9. La suite entera (`node --test "tests/js/*.test.js"`, `python -m unittest discover -s tests -t .`, e2e) pasa y los umbrales de `CONSTRAINTS.md` no se bajan (Lighthouse de la portada).

## Qué no entra

- Ninguna comisión ni afiliado cambia el orden (principio II).
- No se inventan especificaciones que el título no dice ni se rellenan con datos de afuera sin marcarlo.
- No se agrega una dependencia ni un build (principio I).
- No se toca el relevamiento de tiendas (`indexar.py`) salvo que la Fase 6 pida un campo, y solo con la medición previa.

## Decisiones del dueño (09/11/2026) — cierran las tres preguntas

1. **Qué es «equivalente»**: dos modelos de **distinta marca** que comparten **2 o 3 características clave** de su categoría ya son comparables y se muestran. No hace falta igualdad exacta ni misma clase en todas. Si tienen **la misma marca y las mismas especificaciones** (aunque el título sea otro), son **el mismo producto**: queda **una sola tarjeta, la del mejor precio**. Efecto en el diseño: `Especificaciones.mismas` pasa de «todas las claves de la referencia» a un puntaje de coincidencias (mínimo 2 de las claves que el título dice) con la marca como desempate (D3.2-D3.3).
2. **Mismo modelo en otras tiendas**: lo mismo que el punto 1. No se muestra una tarjeta por tienda; queda la del mejor precio y las demás tiendas van en «Precio por tienda» (D3.4). No hay tarjeta aparte de «mejor oferta del modelo».
3. **Búsquedas sin avisos locales** («aeroclip 2»): **igual se calcula la mejor opción**, aunque sea de tiendas del extranjero. Para eso el sitio **pide la información de cada búsqueda y la persona copia y pega lo que muestra el carrito de cada tienda**; con eso se arma el veredicto (D6.5-D6.7). Esto no es una calculadora local (spec 040): el sitio no estima impuestos ni envío, usa lo que la tienda mostró.

## Cómo queda el punto 3 (detalle de D6)

5. **Veredicto sin avisos locales**: el Veredicto no dice «no está» y se corta. Arma el perfil del producto con lo que devuelve «Afuera, en vivo» (marca, línea, categoría) y arma una lista de **opciones de afuera** ordenadas por precio puesto en casa (nunca por comisión).
6. **Pegar lo del carrito**: cada opción de afuera tiene un campo «Pegá lo que te muestra el carrito de {tienda}». El sitio lee del texto pegado precio del producto, envío, impuestos o servicios de importación y total, con su moneda (la misma idea que `Importar.referenciaCarrito` para Tiendamia, spec 039/041, ampliada a más tiendas y formatos). Lo que no se puede leer se dice («no encontramos el total: pegá el bloque completo») y no se inventa (principio II).
7. **Veredicto**: con al menos una opción con total pegado, se escribe «la mejor opción es X: total puesto en casa $Y» contra las demás opciones de afuera y, si las hay, contra las locales equivalentes (D3). Con ninguna opción pegada, el Veredicto lista qué falta para cerrarlo (qué tienda y qué pegar), no un precio sin carrito. Se avisa que los datos son los que la persona pegó, con la fecha.
8. **Privacidad**: el texto pegado se procesa en el navegador. No se guarda, no se envía al Worker ni a GoatCounter, y el historial no lo recuerda. Se descartan nombre, dirección y teléfono si aparecen en lo pegado (se muestran solo los importes).

## Más criterios por estas respuestas

10. Dos avisos de la misma marca y mismas especificaciones, con títulos distintos, dan **una sola tarjeta** (la de menor precio); con distinta marca y ≥ 2 características en común, dan **dos**.
11. Para «aeroclip 2» (0 avisos locales) el Veredicto muestra opciones de afuera y, tras pegar el carrito de al menos una, dice cuál conviene y cuánto sale puesto en casa; probado con texto de carrito de ejemplo guardado en `tests/fixtures/`.
12. Pegar un texto sin importes no rompe nada y no muestra un total inventado.

## Preguntas que quedan (menores, con valor por defecto)

- Qué tiendas de afuera entran en la primera versión del pegado de carrito: por defecto **Tiendamia, Amazon, eBay y AliExpress** (las que ya figuran en «Buscalo afuera»). Cada una necesita un ejemplo real de lo que muestra su carrito: **lo tiene que traer el dueño** (sin datos personales) para escribir el lector y sus tests.
