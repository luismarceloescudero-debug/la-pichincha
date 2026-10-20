# Ganadores por categoria y umbrales premium (20/10/2026)

El dueño pidio (20/10) que «premium» no dependa de la marca sino de especificaciones, tecnologia, materiales, duracion y pruebas reales. Este documento explica el dataset [`datos/ganadores.json`](../datos/ganadores.json), que valida [`generar_ganadores.py`](../generar_ganadores.py) (`python generar_ganadores.py --cobertura indice.json`) y que consume la sesion del motor de ofertas. **Solo entra lo que se leyo en la fuente ese dia.** Hoy son 35 ganadores en 7 categorias; lo que falta (durabilidad, materiales, brillo, bateria de notebooks) se dice en cada fila de la tabla.

## Metodo

- Se leen solo paginas publicas, de a una, respetando `robots.txt` y sin cambiar de identidad ni de IP. Si un sitio bloquea, queda como «sin acceso».
- Se guardan hechos (puntaje, medicion, posicion) con el enlace a la pagina; no se copia texto ni capturas.
- Un puntaje de laboratorio **no se mezcla** con el de otro. El campo `puntaje` (0-100) es propio: `100 x valor / referencia de la categoria`, con la referencia escrita en `escala` de cada fila. Dentro de una categoria y de un mismo laboratorio se puede comparar; entre categorias, no.
- Ningun modelo hereda el puntaje de otro de la misma marca: cada fila es un producto medido.
- Los modelos externos no leen sitios; el valor lo leyo Claude en la pagina (con la herramienta de lectura o el navegador de la app, sin cuenta) antes de entrar al JSON (ver `docs/delegacion-modelos.md`). Cuando el laboratorio no publica un puntaje, `puntaje` es un orden propio y la `escala` lo dice.

## Evidencia por categoria

Hoy son **35 ganadores en 7 categorias** (13 de la primera tanda, 22 de la segunda del 20/10/2026). Todos «confirmado»: cada valor se leyo en la pagina citada.

| Categoria | Fuente leida | Que mide | Estado |
| --- | --- | --- | --- |
| Procesador | [PassMark CPU Mark](https://www.cpubenchmark.net/desktop.html) | Rendimiento multinucleo, muestras de usuarios | 3 modelos. Sin consumo, temperatura ni rendimiento por nucleo |
| Placa de video | [PassMark G3D Mark](https://www.videocardbenchmark.net/high_end_gpus.html) | Rendimiento 3D | 6 modelos. Sin consumo ni juegos (TechPowerUp prohibe la lectura automatica) |
| SSD | [PassMark Disk Rating](https://www.harddrivebenchmark.net/high_end_drives.html) | Lectura/escritura sintetica | 4 modelos. Sin durabilidad (TBW) ni temperatura |
| Monitores | [RTINGS, mejores OLED](https://www.rtings.com/monitor/reviews/best/oled) (19/10) | Eleccion del laboratorio: panel, refresco y resolucion | 6 modelos. **Las notas y mediciones (brillo, cobertura, respuesta) estan bloqueadas sin membresia**: no entran. El puntaje es ordinal propio |
| Auriculares | [RTINGS, mejores headphones](https://www.rtings.com/headphones/reviews/best/headphones) (19/10) | Autonomia con ANC segun el texto | 4 modelos. Horas aproximadas («casi 32 h»); sin ruido ni sonido |
| Celulares | [DXOMARK, ranking](https://www.dxomark.com/smartphones/) leido el 20/10 | Subpuntaje de pantalla (4 modelos) o de bateria (4 modelos) | 8 modelos. **Sin durabilidad fisica ni materiales** (no se leyo ninguna prueba) y sin camara. La pagina no muestra la fecha de cada medicion |
| Notebooks | [RTINGS, mejores laptops](https://www.rtings.com/laptop/reviews/best/laptop) (16/09) | Eleccion del laboratorio: panel y refresco, chasis | 4 modelos. **Bateria en horas y materiales medidos: sin datos** (el texto dice «larga» o «aluminio» sin cifra) |

Accesos: Notebookcheck da 403 a la lectura por red; en el navegador de la app cargo, pero las paginas probadas no existian (404), asi que no se leyo nada de ahi. GSMArena y TechPowerUp prohiben en su `robots.txt` lo que se necesitaba. Un puntaje de laboratorio no se mezcla con otro: cada fila trae su `escala`, y los subpuntajes de pantalla y de bateria de DXOMARK tampoco se comparan entre si.

Limites a tener presentes: PassMark son muestras de usuarios, no una prueba controlada; sus listas incluyen servidores y chips que no se venden en Argentina (por eso la referencia excluye Threadripper, EPYC, Apple y la RTX 5090 D); las elecciones de RTINGS consideran precio y disponibilidad en Estados Unidos, no solo desempeño; un modelo de la lista no hereda nada a otro de la misma marca.

## Cobertura en el indice (19/10/2026, ~25 mil avisos)

20 de los 35 ganadores aparecen en el indice y suman 238 avisos (se cuenta por nombre o alias en el titulo, asi que una variante «SUPER» o «X3D2» puede sumar tambien al modelo base: es una cota). De la segunda tanda, 11 de 22 estan y suman 64 avisos: Galaxy S25 Ultra (14), MacBook Neo (17), Z Fold7 (6), MacBook Pro 14 y Air 13 (6 cada uno), S25 FE y Motorola Edge 60 Pro (5), XPS 13 (2), WH-1000XM6, Live 780NC y Honor X9c (1). **Ningun monitor de la lista de RTINGS esta hoy en el indice**: el puntaje de monitores todavia no sirve para ordenar avisos del buscador. El `modelo` de las placas es el codigo del ensamblador, no del chip, por eso los ganadores de GPU se buscan por nombre del chip. `python generar_ganadores.py --cobertura indice.json` repite la medicion.

## Umbrales «premium» que se pueden sostener con fuente

Salen de lo leido, no de una marca. Donde no hay fuente de laboratorio se dice y no se inventa un numero.

| Categoria | Senal | Umbral | Fuente / estado |
| --- | --- | --- | --- |
| Procesador | Rendimiento relativo | >= 75% del lider de escritorio en CPU Mark (hoy ~54.000) | PassMark (la escala, confirmada); el 75% es propio |
| Placa de video | Rendimiento relativo | >= 75% de la RTX 5090 en G3D Mark (hoy ~29.000) | PassMark (confirmada); el 75% es propio |
| SSD | Rendimiento relativo | >= 85% del primero en Disk Rating | PassMark (confirmada); el 85% es propio |
| Monitor | Panel OLED (QD-OLED o WOLED Tandem), refresco nativo >= 240 Hz, resolucion >= 1440p | Los 6 elegidos de RTINGS cumplen las tres (240 a 480 Hz) | RTINGS, mejores OLED (19/10). Brillo pico y cobertura de color: **bloqueados, sin dato**. RTINGS advierte de parpadeo con VRR y riesgo de quemado en uso de oficina |
| Auriculares | Autonomia con ANC >= 27 h | Elegidos: 27 h a 60 h | RTINGS (19/10), texto aproximado |
| Celular, pantalla | Subpuntaje DXOMARK Display >= 155 | Los 8 mejores del ranking van de 161 a 155 | DXOMARK (20/10) |
| Celular, bateria | Subpuntaje DXOMARK Battery >= 150 | El top 16 va de 168 a 151 | DXOMARK (20/10); no es una medicion en horas |
| Notebook | Panel de 120 Hz (Mini LED/OLED) y chasis de aluminio | MacBook Pro 14 (Mini LED 120 Hz) y XPS 13 (120 Hz, aluminio) | RTINGS (16/09). Bateria en horas: **sin dato** |
| Materiales, IP y durabilidad | Certificacion IP, vidrio/aluminio/titanio, pruebas de resistencia | **Sin fuente leida** | No se uso ningun dato de especificaciones de tienda; las pruebas de resistencia en video (por ejemplo JerryRigEverything) no se leyeron |

## Pendiente

Notebookcheck (bateria en horas y materiales, cuando se encuentre la URL real y cargue), GSMArena por reseña individual, Tom's Hardware (consumo), RTINGS por pagina de modelo si algun dia dejan ver las mediciones, y alguna prueba publica de durabilidad de celulares. Cada tanda nueva suma filas al JSON y pasa el validador en la CI.
