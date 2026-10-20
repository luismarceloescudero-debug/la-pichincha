# Ganadores por categoria y umbrales premium (20/10/2026)

El dueño pidio (20/10) que «premium» no dependa de la marca sino de especificaciones, tecnologia, materiales, duracion y pruebas reales. Este documento explica el dataset [`datos/ganadores.json`](../datos/ganadores.json), que valida [`generar_ganadores.py`](../generar_ganadores.py) (`python generar_ganadores.py --cobertura indice.json`) y que consume la sesion del motor de ofertas. **Primera tanda: solo entra lo que se leyo en la fuente ese dia.** Hoy son 13 ganadores en 3 categorias; el resto esta sin datos y asi se dice.

## Metodo

- Se leen solo paginas publicas, de a una, respetando `robots.txt` y sin cambiar de identidad ni de IP. Si un sitio bloquea, queda como «sin acceso».
- Se guardan hechos (puntaje, medicion, posicion) con el enlace a la pagina; no se copia texto ni capturas.
- Un puntaje de laboratorio **no se mezcla** con el de otro. El campo `puntaje` (0-100) es propio: `100 x valor / referencia de la categoria`, con la referencia escrita en `escala` de cada fila. Dentro de una categoria y de un mismo laboratorio se puede comparar; entre categorias, no.
- Ningun modelo hereda el puntaje de otro de la misma marca: cada fila es un producto medido.
- Los modelos externos no leen sitios; el valor lo leyo Claude en la pagina antes de entrar al JSON (ver `docs/delegacion-modelos.md`).

## Evidencia por categoria

| Categoria | Fuente leida | Que mide | Estado |
| --- | --- | --- | --- |
| Procesador | [PassMark CPU Mark](https://www.cpubenchmark.net/desktop.html) (actualizada el 20/10/2026) | Rendimiento multinucleo, muestras de usuarios | 3 modelos, **confirmado**. Sin consumo, temperatura ni rendimiento por nucleo |
| Placa de video | [PassMark G3D Mark](https://www.videocardbenchmark.net/high_end_gpus.html) | Rendimiento 3D | 6 modelos, **confirmado**. Sin consumo ni pruebas de juegos (TechPowerUp prohibe la lectura automatica) |
| SSD | [PassMark Disk Rating](https://www.harddrivebenchmark.net/high_end_drives.html) | Lectura/escritura sintetica | 4 modelos, **confirmado**. Sin durabilidad (TBW) ni temperatura |
| Celulares | — | — | **Sin datos**. GSMArena prohibe en `robots.txt` sus paginas de pruebas de bateria; DXOMARK y las pruebas de resistencia no se leyeron todavia |
| Notebooks | Notebookcheck | — | **Sin acceso**: HTTP 403 el 20/10 (no se esquiva) |
| Monitores y auriculares | RTINGS | — | **Sin datos**: las mediciones cargan con JavaScript y la lectura devolvio solo la lista de modelos y «416 monitores probados» |

Limites a tener presentes: PassMark son muestras de usuarios, no una prueba controlada; sus listas incluyen servidores y chips que no se venden en Argentina (por eso la referencia excluye Threadripper, EPYC, Apple y la RTX 5090 D); el SSD de la lista puede ser una variante OEM con otro nombre comercial.

## Cobertura en el indice (19/10/2026, ~25 mil avisos)

9 de los 13 ganadores aparecen en el indice y suman 174 avisos (se cuenta por nombre o alias en el titulo, asi que una variante «SUPER» o «X3D2» puede sumar tambien al modelo base: es una cota, no un conteo exacto). Placas RTX 5080 (60) y 5070 Ti (58) son lo que mas se vende; RTX 4090, PNY CS3250, Corsair MP700 PRO XT y Kioxia Exceria Pro G2 no estan hoy. El `modelo` de las placas del indice es el codigo de la placa del ensamblador, no del chip, por eso los ganadores de GPU se buscan por nombre del chip.

## Umbrales «premium» propuestos

Estado: **criterio propio, sin fuente de laboratorio leida todavia** salvo donde se indica. Sirven de punto de partida para la sesion del motor; hay que contrastarlos antes de usarlos como verdad.

| Categoria | Senal | Umbral propuesto | Fuente |
| --- | --- | --- | --- |
| Procesador | Rendimiento relativo | >= 75% del lider de escritorio en CPU Mark (hoy 54.000+) | PassMark (confirmado, la escala) / el 75% es propio |
| Placa de video | Rendimiento relativo | >= 75% de la RTX 5090 en G3D Mark (hoy 29.000+) | PassMark (confirmado) / el 75% es propio |
| SSD | Rendimiento relativo | >= 85% del primero en Disk Rating | PassMark (confirmado) / el 85% es propio |
| Monitor | Panel OLED / Mini-LED, >= 144 Hz, cobertura DCI-P3 alta | sin confirmar | RTINGS: no se pudo leer |
| Celular | Bateria medida en horas, pantalla LTPO/OLED con brillo pico alto, IP68, marco de aluminio/titanio | sin confirmar | DXOMARK, GSMArena: sin leer |
| Notebook | Bateria medida, cobertura de color del panel, chasis de aluminio/magnesio | sin confirmar | Notebookcheck: sin acceso |
| Materiales y durabilidad | Pruebas de resistencia (rayado, flexion, fuego) | existen en canales de video como JerryRigEverything, solo en unos pocos modelos | sin leer |

## Pendiente

Leer, cuando haya acceso: RTINGS por la pagina de cada modelo (monitores, auriculares), reseñas de DXOMARK y GSMArena (celulares), Tom's Hardware (CPU/GPU con consumo) y alguna fuente de notebooks que no bloquee. Cada tanda nueva suma filas al JSON y pasa el validador en la CI.
