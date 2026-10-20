# Feature Specification: Primera Linea premium, Super Oferta real y orden «mejor oferta entre lo mejor»

**Created**: 2026-10-20

**Status**: En curso (PR 1 de 4 mergeado: Primera Linea por especificaciones; PR 2: Super Oferta real; el resto se agrega en los PRs siguientes y esta spec se actualiza en cada uno)

**Input**: Aclaracion del dueño el 20/10/2026, despues de ver los tres modos de la spec 013: «Primera Linea no se centre en marcas, sino en calidad premium, specs premium, ultimas tecnologias; las marcas confunden y no son sinonimo de calidad de construccion, materiales o ultimas tecnologias; investigar ganadores absolutos con pruebas reales de rendimiento, duracion y calidad de materiales. Super Oferta: si no hay ofertas no se inventan; la idea es ver si hay gama media del año anterior con la gama alta actual, que es donde se podria considerar ofertas. La idea es encontrar las mejores ofertas dentro de lo mejor: las ultimas novedades, los articulos con mejor pantalla, lo ultimo en procesadores, en tecnologia, en baterias. La idea principal es la oferta contra el mismo modelo en otras tiendas, pero con filtros y orden diferencial, con requisitos minimos para la gama media (6-8 GB de RAM y 128-256 GB de almacenamiento en smartphones, por ejemplo), seguidos por lo ultimo, por materiales de construccion, por prestaciones. Solo establece parametros minimos para las verdaderas ofertas y el orden de filtrado, que no deberian restar en ningun aspecto de la app. Avisame si algo choca con lo que hacen las mejores apps.»

Plan de trabajo y estado de cada funcion: [docs/plan-buscador.md](../../docs/plan-buscador.md).

## Decisiones

### 1. Primera Linea ya no usa marcas (PR 1)

1. `marcas.primera` de `datos.json` (55 marcas) deja de decidir el modo y el filtro «Solo premium». Cubria 1.549 de 1.608 notebooks: no filtraba nada. La marca queda como sello informativo («marca reconocida»).
2. **Primera Linea = el segmento premium por ESPECIFICACIONES Y TECNOLOGIA**: un puntaje por categoria que sale solo del titulo (`js/premium.js`, `Premium.puntaje`). Cada señal suma puntos y se guarda su texto, para poder decir por que un producto es premium (el sello «premium» lo muestra al pasar el cursor).
3. Señales (lo que dicen los titulos; lo que el titulo no dice no se inventa):
   - **Smartphone**: RAM 8 (1) / 12+ (2); almacenamiento 256 (1) / 512+ (2); procesador de punta (Snapdragon 8 Gen/Elite, Dimensity 9000, Tensor G3+, Exynos 24xx+, A17+ en iPhone) (2); ultima generacion de su familia (2); pantalla OLED (1), de 120 Hz (1), las dos (2); bateria ≥5.500 mAh (1); carga ≥65 W (1); camara ≥108 MP (1); linea Pro/Ultra/Max/Fold/Flip (1); materiales (titanio, aluminio, vidrio, ceramica) (1); ≥7 años de actualizaciones (1).
   - **Notebook y PC**: RAM 16 (1) / 32+ (2); almacenamiento 1 TB (1) / 2 TB (2); procesador i9/Ultra 9/Ryzen 9/M Pro-Max (3), i7/Ultra 7/Ryzen 7 (1); NPU (1); RTX xx60 (2) / xx70+ (3) desde la serie 40; pantalla OLED (2) o resolucion 2.5K+ (1); 120 Hz+ (1); ultima generacion (2); DDR5 (1); materiales (1); Wi-Fi 7 o Thunderbolt (1).
   - **Monitor**: QD-OLED (4), OLED o Mini-LED (3); 4K (2) o 2.5K (1); 240 Hz+ (2) o 165 Hz+ (1); HDR 600+ (1); Thunderbolt (1).
   - **Componente**: gama alta de su tipo segun `Categorias.evaluar` (3); placa de la serie 50 (2) y xx70+ (2); procesador Ryzen 7/9 9000, Core Ultra 7/9 o Core i7/i9 de la 14ª+ (3); PCIe 5.0 (2); DDR5 de 6.000 MHz+ (1).
   - **Periferico y «otro»**: sin puntaje. Primera Linea no los incluye y el modo vacio lo dice.
4. **La memoria sola no alcanza**: RAM, almacenamiento y DDR5 suman hasta `TOPE_MEMORIA` = 2 puntos y hace falta ademas `MIN_TECNOLOGIA` = 2 puntos de tecnologia o construccion (procesador, pantalla, generacion, bateria, materiales) en celulares, notebooks y PCs. Un POCO X7 de 12 GB y 512 GB no es premium (medido: era premium con 4 puntos antes del tope).
5. **Umbral (`Premium.UMBRAL`)** fijado midiendo el indice publicado del 20/10/2026 (24.954 avisos): smartphone 3, notebook 4, PC 4, monitor 3, componente 3. Criterio: Primera Linea tiene que ser selectiva (≤25% de cada categoria).
6. **Un producto que no llega al minimo de su gama** (`evaluar(...).pasa === false`: un celular de 4 GB, una notebook de 8 GB) **no es premium** por mas señales que sume.
7. **Ganadores en pruebas reales**: si existe `datos/ganadores.json` (lo arma otra sesion: modelo ganador por categoria con fuente y puntaje), un modelo que figure ahi suma `PUNTOS_GANADOR` = 3 y muestra «ganador en pruebas: <fuente>». El enlace esta listo (`Premium.ganadorDe`, `Modos.preparar(..., ganadores)`, `DATOS.ganadores` en la pagina) y **no se espera al archivo**: sin el, no cambia nada. Formato asumido: `{ "ganadores": [{ "modelo": "Galaxy S25 Ultra", "fuente": "DXOMARK", "categoria": "smartphone", "puntaje": 0 }] }` o la lista sola; el modelo tiene que estar entero en el titulo (≥4 caracteres). Si la otra sesion publica otro formato, se ajusta `ganadorDe` (una funcion).
8. El filtro del panel «Solo primera linea» pasa a **«Solo premium»** y usa el mismo puntaje.
9. **Orden «Premium»**: ordena por el puntaje (antes: las señales de `evaluar`). Lo internacional va ultimo, a igual puntaje de mayor a menor precio.
10. Ningun puntaje mira comisiones (Constitucion II).

### 2. Super Oferta real (PR 2)

1. **Super Oferta = una oferta REAL que pasa el minimo de su gama.** Si no hay ofertas no se inventan: el modo queda vacio, lo dice y ofrece otro. Las señales (cada fila muestra SUS razones, `ctx.ofertas().get(url).razones`):
   - **Contra el mismo modelo en otras tiendas** (la señal principal; idea #1 del relevamiento, PriceSpy): `Ofertas.calcularOfertas(...).contraModelo`. El modelo (`modelo` del indice, codigo exacto, nunca por parecido) tiene que estar en **≥3 tiendas** que se leen directo (sin ComparaYa, sin internacionales, sin usados; en equipos, la misma configuracion: RAM, almacenamiento y procesador; capacidades compatibles). El aviso tiene que ser el mas barato del modelo (o estar a menos del 2%) y estar **al menos el minimo de su categoria bajo la mediana de las otras** (`Categorias.DESCUENTO[cat].propia`: 5% equipos y monitores, 8% componentes y perifericos, 3% otros). Texto: «22% bajo la mediana de las otras 2 tiendas ($102.000)».
   - **Cotas contra los datos dudosos**: mas del 40% bajo el resto (`DESCUENTO_MODELO_MAX`) es mas facil un error de carga o un precio viejo que una oferta (el mismo criterio que el tope de 60% del tachado), y si las otras tiendas no coinciden entre si (precio mas alto / mas bajo > 1,35, `DISPERSION_MODELO`) la referencia no es confiable. Medido: sin esas cotas aparecian coolers a 59% bajo el resto.
   - **Baja propia** y **rebaja publicada** (ya existentes, con segundo chequeo y tachado fijo).
   - **Cruce por generacion**: una **gama alta del año pasado** (`Categorias.evaluar(...).anterior`: algun apartado del titulo es de la generacion anterior y ninguno de la ultima; ≥3 señales sin el punto de novedad; y la ultima generacion mejoro varios apartados, o sea `!vigente`) que hoy cuesta **≤ la mediana de la gama media de HOY** de su categoria y capacidad (≥8 avisos; la gama media del año pasado no cuenta para la mediana). No necesita baja ni tachado. Texto: «gama alta del año pasado al precio de una media de hoy — mediana de las notebooks de gama media de 1 TB: $2.785.277 (67 avisos)». Si otra tienda lo vende mas barato, esa es la oferta y este no entra.
2. **Pasa el minimo de su gama** (`evaluar(...).pasa`) siempre. Ya no se exige que sea de gama **media**: la gama alta tambien entra si su oferta es real (cambia el FR-003 de la spec 013: «nunca incluye gama alta» era de cuando Super Oferta era solo gama media; el dueño pide «las mejores ofertas dentro de lo mejor»).
3. **Perifericos y «otro» entran** si su oferta es real (rebaja publicada y baja propia verificadas; contra el mismo modelo): son las mismas ofertas de la pestaña Ofertas. Antes quedaban afuera por no tener gama. Si el dueño prefiere dejarlos fuera de Super Oferta es una linea en `Modos.filtrar`; se avisa en el PR.
4. **Minimos de gama media en un solo lugar**: `Categorias.MIN`. Smartphone: RAM ≥6 GB (ideal 8), almacenamiento ≥128 GB (ideal 256), bateria ≥4.500 mAh, ≥90 Hz, ≥4 años de actualizaciones; notebook y PC: 16 GB y 512 GB; monitor: 144 Hz y ≥24". Coinciden con lo dicho por el dueño (6-8 GB y 128-256 GB en smartphones; el resto es de la spec 012); `tests/js/categorias.test.js` los fija. Solo definen que es una oferta o gama media: no sacan nada de la app (decision 4 del PR 3).
5. La pestaña Ofertas, el feed RSS, el canal de Telegram y `/hoy/` **no cambian** en este PR (siguen con baja propia y rebaja publicada): sumar las nuevas señales ahi cambia lo que se publica en Telegram y se decide aparte.

### Medicion de Super Oferta (indice publicado el 20/10/2026)

Avisos que da cada señal, por categoria (`node specs/014-ofertas-y-premium/medir.js indice.json ofertas`):

| señal | avisos | smartphone | notebook | monitor | pc | componente | periferico | otro |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baja propia | 39 | 0 | 3 | 2 | 1 | 11 | 8 | 14 |
| rebaja publicada | 724 | 80 | 73 | 49 | 0 | 44 | 212 | 266 |
| contra el mismo modelo | 233 | 0 | 2 | 5 | 0 | 192 | 11 | 23 |
| gama alta del año pasado | 6 | 0 | 3 | 0 | 3 | 0 | 0 | 0 |
| **union (Super Oferta)** | **996** | 80 | 78 | 56 | 4 | 244 | 231 | 303 |

Modelos en ≥3 tiendas: 424 (componente 327, otro 39, monitor 35, periferico 19, **notebook 4, smartphone 0**). **Lo que choca con la idea del dueño**: «la idea principal es la oferta contra el mismo modelo en otras tiendas» funciona en componentes y monitores, pero **en celulares y notebooks casi no hay modelos en 3 tiendas** (el `modelo` cubre 16% de los avisos y las tiendas titulan distinto). Para ellos la oferta sale de la rebaja publicada y del cruce por generacion (6 hoy). Lo que lo arreglaria es capturar GTIN/MPN de las fuentes (idea #8, fuera de alcance aca, `docs/plan-buscador.md`).

Resultados por busqueda con la nueva Super Oferta (antes, spec 013, entre parentesis):

| consulta | conjunto | Recomendacion | Super Oferta | Primera Linea |
| --- | ---: | ---: | ---: | ---: |
| notebook | 1.673 | 861 | 71 (59) | 230 |
| celular samsung | 213 | 108 | 10 (8) | 29 |
| ssd 1tb | 119 | 97 | 3 (1) | 47 |
| monitor 27 | 413 | 191 | 29 (13) | 71 |
| auriculares | 500 | 213 | 96 (0) | 0 |
| rtx 5060 | 115 | 111 | 17 (2) | 24 |
| ryzen 5 | 295 | 273 | 8 (0) | 67 |

Los 96 de «auriculares» son rebajas publicadas verificadas de perifericos (ahora entran, decision 3); no hay ninguna oferta de otro tipo.

Los 6 cruces por generacion de hoy son notebooks y PCs con Ryzen de la serie 8000 contra la gama media de hoy, por ejemplo «Notebook Asus Zenbook 14 OLED Ryzen 7 8840HS 16GB 1TB» a $2.383.703 contra una mediana de $2.785.277 de las notebooks de 1 TB (67 avisos); por construccion ninguno tiene el mismo modelo mas barato en otra tienda (`masBarato`). Se miraron a mano 14 de los 233 «contra el mismo modelo», elegidos al azar: todos con 3 a 10 tiendas y diferencias de 9% a 20% bajo la mediana (placas madre, memorias, un SSD, una silla, una RTX 5050); en tres el aviso de otra tienda esta a menos del 2% (el «casi igual» de `masBarato`). Cuidado: parte de los `modelo` del indice son identificadores derivados del titulo (`~A1F83B3A187A`, `modelo.py`), no codigos del fabricante; la señal depende de esa identidad.
### 3. Orden por defecto y «nada resta» (PR 3)

1. **Orden por defecto = «Mejor oferta»** (`Modos.SECUNDARIO_BASE = "mejor"`): primero el **nivel** (premium, despues lo que pasa el minimo de su gama con nivel, despues el resto), dentro del nivel **lo mas nuevo** (`novedadDe`: generacion o año mas reciente), despues **la mayor baja** (la mejor de las razones de oferta: contra el mismo modelo, baja propia, rebaja publicada o cruce) y, a igual baja, el puntaje premium. «Precio ↓», «Novedades» y «Premium» siguen elegibles. Lo internacional va ultimo en todos.
2. **Dato del relevamiento** (`docs/buscadores-referencia.md`): ninguna de las mejores apps (PriceSpy Best Match, Amazon Featured, Mercado Libre relevancia, Geizhals) usa «precio de mayor a menor» como orden por defecto; todas ofrecen precio en ambos sentidos y ordenan sus ofertas por % de baja (Keepa) o por diferencia de tendencia (PriceSpy). El orden «Precio ↓» de la spec 013 no se borra: queda elegible. Lo guardado en el navegador («precio») se respeta; quien nunca eligio arranca en «Mejor oferta».
3. **Nada resta**: Recomendacion ya no esconde lo que no llega al minimo. El control visible **«Incluir lo que no llega al mínimo»** (se recuerda en el navegador) trae TODO lo comparable de la busqueda, con lo recomendado primero y el resto despues (cada grupo con el orden elegido). Una nota bajo los modos dice siempre que deja afuera cada uno y cuanto («Recomendación deja afuera 104 avisos más…», «Súper Oferta muestra solo ofertas reales: 7 de 100…»; `Modos.notaDe`). Super Oferta y Primera Linea son **subconjuntos explicitos** y lo dicen; los minimos solo definen que se llama oferta o gama media.
4. Un modo vacio explica por que y ofrece otros modos (spec 013, decision 6).

Medido en el navegador con el indice del 20/10: «celular samsung» da 95 en Recomendacion y 199 con todo incluido (104 que no llegaban al minimo o no tenian marca reconocida); el primer resultado en «Mejor oferta» es un Galaxy S26 FE (premium y de la ultima generacion).
### 4. Funciones tomadas de las mejores apps (PR 4) — pendiente

## Medicion (indice publicado el 20/10/2026, 24.954 avisos; `node specs/014-ofertas-y-premium/medir.js indice.json`)

### Puntaje premium por categoria

| categoria | avisos | pasan el minimo | premium | % premium | umbral |
| --- | ---: | ---: | ---: | ---: | ---: |
| smartphone | 1206 | 601 | 54 | 4.5% | 3 |
| notebook | 1787 | 909 | 251 | 14.0% | 4 |
| monitor | 1414 | 580 | 110 | 7.8% | 3 |
| pc | 759 | 181 | 70 | 9.2% | 4 |
| componente | 7281 | 6664 | 1111 | 15.3% | 3 |
| periferico | 6372 | 6372 | 0 | 0.0% | - |
| otro | 5562 | 5562 | 0 | 0.0% | - |

Antes de los topes (primer prototipo, solo suma de señales): notebook 19,8% con umbral 4 y smartphone 16% con umbral 4, pero con falsos premium (POCO X7 12/512, Ideapad Slim 3 con i7 de la 13ª). Con el tope de memoria y los pesos actuales los celulares quedan en 4,5%: los titulos de celulares dicen poco (casi nunca la bateria ni los Hz), asi que Primera Linea es conservadora ahi. Se prefiere pocos y bien elegidos a muchos dudosos; si el dueño quiere mas, baja el umbral de celular a 2 (medirlo antes).

### Resultados por busqueda (Recomendacion y Primera Linea con la nueva definicion; Super Oferta todavia es la de la spec 013)

| consulta | conjunto | Recomendacion | Super Oferta | Primera Linea (antes: por marca) |
| --- | ---: | ---: | ---: | ---: |
| notebook | 1.673 | 861 | 59 | 230 (1.549) |
| celular samsung | 213 | 108 | 8 | 29 (199) |
| ssd 1tb | 119 | 97 | 1 | 47 (70) |
| monitor 27 | 413 | 191 | 13 | 71 (295) |
| auriculares | 500 | 213 | 0 | 0 (185) |
| rtx 5060 | 115 | 111 | 2 | 24 (118) |
| ryzen 5 | 295 | 273 | 0 | 67 (279) |

«Conjunto» son los avisos comparables que la busqueda ordena (sin usados ni internacionales ni lo que no es comparable). En «ssd 1tb» y «ryzen 5» Primera Linea es una parte alta del conjunto porque la busqueda ya acota a una gama (SSD NVMe Gen4 de 1 TB, CPU de la serie 9000); en la categoria entera es el 15%.

## Criterios de aceptacion (PR 1)

- **FR-101**: Primera Linea no consulta `marcas.primera` ni `nivelMarca`; un producto de marca sin reconocer con tecnologia de punta entra y uno de marca «de primera» sin ella, no.
- **FR-102**: Ninguna categoria con puntaje supera el 25% de premium en la muestra de `tests/fixtures/indice-muestra.json` (300 titulos por categoria) ni en el indice completo (tabla de arriba).
- **FR-103**: La memoria sola no hace premium; un producto bajo el minimo de su gama tampoco.
- **FR-104**: Perifericos y «otro» no tienen puntaje y Primera Linea explica por que esta vacia y ofrece otros modos.
- **FR-105**: El sello «premium» de cada fila lista las señales que sumaron; la marca queda como sello informativo.
- **FR-106**: Un modelo en `datos/ganadores.json` suma puntos y muestra la fuente; sin el archivo nada cambia.
- **FR-107**: El filtro «Solo premium» usa el mismo puntaje (`filtrarGrupos` recibe `esPremium`).

## Criterios de aceptacion (PR 3)

- **FR-301**: el orden por defecto es «Mejor oferta» y los otros tres siguen elegibles; «Precio ↓» guardado se respeta.
- **FR-302**: «Mejor oferta» ordena por nivel, novedad, baja y puntaje; lo internacional al final.
- **FR-303**: con «Incluir lo que no llega al mínimo» no se pierde ningun aviso comparable; lo recomendado va primero.
- **FR-304**: cada modo dice en una nota que deja afuera y cuanto; Super Oferta y Primera Linea no cambian con el control.

## Criterios de aceptacion (PR 2)

- **FR-201**: Super Oferta nunca incluye un aviso que no pase el minimo de su gama ni uno sin una razon de oferta; cada fila dice sus razones.
- **FR-202**: «contra el mismo modelo» exige ≥3 tiendas directas, misma configuracion en equipos, ser el mas barato (o estar a menos del 2%), el minimo de baja de la categoria, tope de 40% y coincidencia entre las otras tiendas.
- **FR-203**: el cruce por generacion exige ≥8 avisos de gama media de hoy de su categoria y capacidad; con menos no se afirma nada.
- **FR-204**: un modo vacio dice «No se inventan ofertas» y ofrece los modos con resultados.
- **FR-205**: los minimos de `Categorias.MIN` son los del dueño y estan fijados por test.

Tests: `tests/js/ofertas.test.js` (contra el mismo modelo, cruce por generacion, `anterior`), `tests/js/buscador.test.js` (modo Super Oferta y sus razones), `tests/js/categorias.test.js` (MIN). Antes: `tests/js/premium.test.js` (puntaje con titulos reales), `tests/js/buscador.test.js` (modos), `tests/js/filtros-ui.test.js` (pagina).
