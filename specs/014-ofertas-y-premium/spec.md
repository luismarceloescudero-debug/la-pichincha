# Feature Specification: Primera Linea premium, Super Oferta real y orden «mejor oferta entre lo mejor»

**Created**: 2026-10-20

**Status**: En curso (PR 1 de 4: Primera Linea por especificaciones; el resto se agrega en los PRs siguientes y esta spec se actualiza en cada uno)

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

### 2. Super Oferta real (PR 2) — pendiente
### 3. Orden por defecto y «nada resta» (PR 3) — pendiente
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

Tests: `tests/js/premium.test.js` (puntaje con titulos reales), `tests/js/buscador.test.js` (modos), `tests/js/filtros-ui.test.js` (pagina).
