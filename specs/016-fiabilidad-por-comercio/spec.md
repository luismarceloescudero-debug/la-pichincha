# Feature Specification: Fiabilidad del dato por comercio, con telemetria propia

**Created**: 2026-10-21

**Status**: Implementada (mejora 4 del informe de referentes; la parte de D4 del plan v2 que no depende de una fuente externa)

**Input**: «Fiabilidad del dato por comercio, con telemetria propia. `verificar_ofertas.py` ya cuenta por comercio
cuantas ofertas estaban en pie, cuantas se descartaron y cuantas quedaron "sin confirmar" (README, "Canal de
ofertas: RSS y Telegram"), pero parece vivir solo en el log. Guardar ese conteo corrida a corrida; mostrar en
/estado/ una tabla por tienda; con ventana dicha en voz alta y sin rotular a una tienda con muestras chicas
(minimo de muestras, decirlo); redaccion neutral y explicada (es dato propio, no opinion).»

## Decisiones

### 1. El conteo vive en el log y se pierde (verificado)

`verificar_ofertas.resumen` arma una linea por comercio («N en pie, M caida(s), K sin confirmar») y `main` la
imprime; nada se guarda. El workflow corre la verificacion hasta tres veces en cada uno de sus dos pasos y cada
ronda pisa `descartadas.json`, asi que ni el log de la corrida alcanza para reconstruir la serie.

### 2. Telemetria por enlace, no un resumen

`verificar_ofertas.py --telemetria RUTA` escribe `{url: {comercio, juicio, motivo}}`. Se eligio por enlace y no un
conteo ya sumado porque: (a) las rondas y los dos pasos comparten el archivo y gana la ultima revision de cada
enlace, sin doble conteo; (b) el motivo distingue lo que se probo de lo que no, y eso no se puede reconstruir
despues de sumar; (c) `diagnostico_enlaces.py` puede usar el mismo formato. Un archivo previo roto se reemplaza y
un fallo de escritura avisa con `::warning::` sin cortar la corrida.

### 3. Caida probada contra «sin comprobar»

Cuenta como **caida o con otro precio** solo lo que se probo: 404/410, el cartel de la tienda, `OutOfStock`, «la
API ya no lo encuentra», «sin stock» de la API de la tienda, «el precio publicado ya no existe» y «el precio no
aparece en la tienda» del agregador. Queda en **sin comprobar** («no se puede verificar», «no se pudo verificar»,
«no se pudo abrir la tienda»): se descarta igual, porque no se publica lo que no se pudo comprobar, pero un bloqueo
o una API caida no prueban nada contra la tienda. Sumarlo al numerador castigaria a la tienda por nuestro problema
de red.

### 4. La serie va a la rama `historial`, no a main ni al artefacto

`historial/verificacion/AAAA-MM.csv` (columnas `fecha,comercio,en_pie,caidas,sin_comprobar`), escrita desde la
Action en el checkout de la rama `historial` y commiteada ahi, igual que los CSV de precios y `fichas.json`. Por
que: main queda limpio (es un dato que crece todos los dias); la cache de Actions se puede desalojar (fue el motivo
del historial desde el principio, `docs/mapa.md`); el artefacto del sitio solo guarda la ultima publicacion y no
tiene serie. La subcarpeta evita que `historial.py` (que lee los CSV de la raiz, `historial.archivos`) los confunda
con precios; un test lo fija. Un push a main **no** suma filas (reusa el indice de la cache: no es una revision del
dia) pero si resume la historia.

### 5. Lo que muestra /estado/

`fiabilidad.py` resume los ultimos **30 dias** hasta hoy (UTC-3 fijo, el mismo criterio de hora argentina del sitio)
y escribe `_sitio/fiabilidad.json` (`{hasta, dias, minimo, comercios: {host: {verificadas, caidas, sin_comprobar,
ultima, suficiente}}}`). `generar_info.js --fiabilidad` agrega a `/estado/` la seccion «Ofertas que ya no estaban en
pie», una fila por comercio:

- **Verificadas**: en pie + caidas de la ventana.
- **Caidas o con otro precio**: `K (P%)`, con `P = redondeo(100·K/N)`, y aparte «sin comprobar: X».
- **Ultima revision**: dia y mes (`dd/mm`) de la ultima fila con cualquier revision.
- Con **menos de 30 verificadas** (`minimo`): «Pocas revisiones: N de 30 (sin porcentaje)». No hay color, insignia
  ni adjetivo; el porcentaje no se calcula, asi que no puede leerse como un veredicto.
- Sin verificadas pero con sin comprobar: «Ninguno se pudo comprobar todavía (sin comprobar: X)». Sin filas en la
  ventana: «Sin revisiones en los últimos 30 días».

La ventana, el corte («hasta el dd/mm») y el minimo se dicen en el texto de la seccion, y se explica que es «un
conteo propio de lo que revisó este sitio, no es una opinión sobre la tienda», que se revisan las mejores ofertas
del dia (las mas propensas a haberse agotado) y que lo que llega por un comparador puede traer un precio viejo.
Ordenado por verificadas: la tabla no es un ranking de peores tiendas.

### 6. Degradacion

Sin `fiabilidad.json` (primera corrida, o el paso fallo) o con el archivo roto, `/estado/` sale como antes, sin la
seccion: no se promete un dato que no hay. Las tiendas del indice y las de la telemetria son listas distintas (una
tienda puede no haber entrado en ninguna oferta del dia), asi que la seccion es una tabla aparte y no una columna
de la tabla de fuentes.

## Alcance

- Adentro: telemetria en `verificar_ofertas.py`, `fiabilidad.py`, la seccion de `/estado/`, los dos pasos del
  workflow y la documentacion (README, `docs/mapa.md`, plan v2, esta spec).
- Afuera: entrega, garantia y reclamos publicos (piden fuente externa; siguen abiertos en D4); rotular tiendas en
  la busqueda o en las ofertas; bajar el minimo de 30.

## Verificacion

- `tests/test_fiabilidad.py` (clasificacion, conteo, CSV, ventana, minimo, degradacion) y los cinco tests nuevos de
  `tests/test_verificar_ofertas.py` (telemetria entre rondas, sin caidas, previa rota, sin la opcion).
- `tests/js/fiabilidad-estado.test.js` (orden, porcentaje solo con muestra suficiente, escapado, sin seccion sin
  datos, `main` con y sin archivo).
- Corrida real del 21/10/2026 sobre las 40 candidatas del indice publicado: 40 revisadas, 28 en pie, 1 caida
  (maxtecno.com.ar) y 4 sin confirmar (mercadolibre.com.ar, sin token en la maquina local); `fiabilidad.py` sumo 12
  comercios a la serie y `/estado/` los mostro.
