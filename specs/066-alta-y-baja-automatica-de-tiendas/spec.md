# Spec 066: alta, pausa y baja automáticas de una tienda

## Problema

Orden del dueño (17/11): dar de baja una tienda que no existe o no tiene actividad tiene que ser **automático**, pura
lógica, como reparar algo roto; y volver a darla de alta sola si revive. No es una decisión humana.

Hasta hoy `salud.py` abría un issue «Fuente con pocos productos: X» y lo **comentaba todos los días** mientras la tienda
siguiera mal (#96 Compra Cierta: 12 comentarios iguales; #55 Katech: 24; #6 FullH4rd: 34), y nunca lo cerraba cuando la
tienda volvía. Una tienda caída seguía publicando sus precios viejos para siempre (E1 de la spec 061 los reusa con su
fecha, pensado para un día, no para semanas).

## Estado por tienda, persistido entre corridas

`estado_tiendas.py` guarda un registro por tienda en **`historial/tiendas-salud.json`**, en la rama `historial`, junto a
`fichas.json`. Es donde el indexador ya persiste lo que tiene que sobrevivir entre corridas (la caché de Actions se puede
desalojar y `datos.json` ya no lo commitea el bot a `main`, C4); el paso «Guardar el historial de precios» lo commitea con
el resto, sin tocar `actualizar.yml`. Una corrida con menos páginas no guarda el historial, así que tampoco este estado.

Cada corrida clasifica lo que trajo cada tienda relevada:

| Clase | Cuándo |
| --- | --- |
| `ok` | trajo productos |
| `vacia` | 0 productos sin bloqueo; también un error de lectura o un error de red que no se recuperó en el reintento (E1): tiempo agotado, DNS temporal (`EAI_AGAIN`), conexión rechazada, certificado inválido |
| `bloqueo` | 403/429/503 o el desafío de Cloudflare (E3/E4): la tienda dijo que no |
| `muerta` | **solo** el dominio no existe (NXDOMAIN: un `gaierror` que no es `EAI_AGAIN`) o Cloudflare dice que el origen está caído (521/522/523/530), **confirmado por el ping** |

Si una tienda trae 0 y no fue un bloqueo, se pide **siempre una vez la portada** (`base` de `tiendas.json`), en todas las
fuentes (listados, json, api, woocommerce, vtex, feed): es `muerta` solo si el ping da NXDOMAIN o 52x. Aunque el
catálogo haya dado NXDOMAIN, si la portada contesta es `vacia` (el DNS del runner se pudo caer un momento). Cualquier
respuesta HTTP (un 403 también) es una tienda viva. Un tiempo agotado, un DNS temporal, una conexión rechazada o un
certificado malo pueden ser el runner y no la tienda: cuentan como `vacia`, que lleva a pausa a los 14 días (sigue
listada con sus precios de la corrida anterior hasta entonces y se reintenta a diario), nunca a baja. Antes del 17/11
(auditoría) todo eso contaba como `muerta` y las fuentes que no eran de listados no confirmaban con el ping: una caída
del runner de 3 días daba de baja a todas, y volvían recién con el ping semanal.

## Reglas fijas (constantes en `estado_tiendas.py`)

| Constante | Valor | Regla |
| --- | --- | --- |
| `CORRIDAS_BAJA` | 3 | `muerta` 3 corridas seguidas, en días distintos (dos corridas el mismo día cuentan una) → **baja** |
| `DIAS_PAUSA` | 14 | sin productos (`vacia`, `bloqueo` o `muerta`) 14 días seguidos desde el primer día sin productos → **pausa** |
| `DIAS_PING_BAJA` | 7 | una tienda en baja solo se sondea (la portada) una vez por semana |

- **baja**: sale del índice publicado (ni productos ni la tienda en `indice.json.tiendas`, así no aparece en el filtro
  de tiendas ni en `/estado/`) y del relevamiento diario. Si el ping semanal responde, se releva entera **esa misma
  corrida**: con productos vuelve a `activa`; sin productos pasa a `pausa` (vuelve el relevamiento diario).
- **pausa**: se sigue relevando a diario, pero sus precios viejos **no se publican** (no se reusan los de la corrida
  anterior). En el índice queda la tienda con `"estado": "pausa"`; `/estado/` la muestra «En pausa» y la búsqueda no la
  ofrece como filtro ni la nombra en «sin relevar hoy».
- **alta**: en cuanto una tienda en pausa o baja trae productos, vuelve a `activa` en la misma corrida y sus precios
  entran como de hoy.
- Nadie arranca en baja: la muerte se mide corrida a corrida.
- Una tienda en baja cuyo ping semanal no llega por la red (ni NXDOMAIN ni respuesta) sigue en baja sin anotar el ping:
  se reintenta al día siguiente.

## Freno global

Si en una corrida **30 % o más de las tiendas medidas** (`FRENO_PROPORCION`) cae por la red o muerta, el problema es el
runner o un bug, no las tiendas: **esa corrida no suma contadores**. Cada tienda que falló vuelve a su registro de antes
(ni días sin productos, ni corridas muertas, ni cambios de estado), y si en la corrida se la había sacado del índice por
un pase a pausa que no cuenta, entra con lo de la corrida anterior. Lo que anduvo se anota igual. Con menos de
`FRENO_MINIMO` (5) tiendas medidas (una corrida `--solo`) no hay freno. Queda en el log, en `salud.json` (`freno`:
`activo`, `relevadas`, `caidas`, `proporcion`) y en el aviso privado al dueño («Freno global: N de M tiendas…»).

## Registros rotos

`leer()` normaliza cada registro: completa los campos que le falten a uno viejo y descarta el que no es un dict, no tiene
un estado conocido, tiene una fecha que no pasa `fromisoformat` o un contador que no es entero. El indexador vuelve a
sembrar los descartados (como la primera vez). `observar()` arranca de cero ante un registro roto y `toca_ping()` sondea
hoy ante una fecha mala: un registro malo no puede hacer caer `indexar.py` cada día (y, como fallaba, no guardar nunca el
arreglo).

## Un solo registro por cambio, nada de spam diario

`indexar.py` deja en `salud.json` dos claves nuevas: `tiendas` (estado de cada una) y `cambios` (los pasajes de esta
corrida). Con eso `salud.py` (corrida programada) hace, por tienda, sobre su issue «Fuente con pocos productos: X»:

| Situación | Qué hace |
| --- | --- |
| Falla por primera vez (activa) | abre el issue; si ya está abierto, **no comenta** |
| Pasa a pausa | un comentario (o abre el issue si no había) |
| Pasa a baja | un comentario y **cierra** (si no había issue, abre uno y lo cierra) |
| Vuelve (alta) o vuelve sobre el 70 % | un comentario y **cierra** |
| En pausa o baja, sin cambios | nada |

Como las decisiones salen del estado y no solo del cambio del día, una corrida manual (que no llama a `salud.py`) no deja
pendiente un registro: la próxima programada cierra el issue de una tienda que ya volvió o ya está de baja, o abre el de
una que quedó en pausa. El aviso privado al dueño (`avisar_dueno.py`) dice cada cambio una vez y calla las tiendas que ya
están en pausa o de baja.

## Semilla (la primera corrida con esta spec)

No había historia de clases. La primera vez se siembra con lo que ya se sabe, sin dar de baja a nadie: el último día con
productos de cada tienda es el `relevado` del índice anterior o, si es más nuevo, su último precio en el historial (que
solo anota cambios). Una tienda que no aparece en ninguno de los dos no trajo nada desde que empezó el historial y cuenta
sin productos desde ese día.

**La corrida que siembra no pasa a nadie a pausa** (`observar(..., puede_pausar=False)`): si falta el índice anterior, la
semilla puede fechar de más los días sin productos. La semilla y los días quedan; el pase a pausa espera a una falla
observada después de sembrar (la corrida siguiente).

Efecto esperado en la primera corrida programada (medido el 17/11 contra la corrida 44080367008 y el historial):

- **Compra Cierta (#96)**: el pedido decía que no existe, pero **trae productos**: desde el 05/11 es un WordPress propio
  (nota en `tiendas.json`), el runner leyó 737 productos el 17/11, el dominio resuelve (38.242.222.157) y la portada da
  200. El correo que rebotó es del dominio de correo, no del sitio. La lógica no la da de baja (no hay de qué): queda
  `activa` y la primera corrida programada **cierra #96** por haber vuelto. Si algún día deja de resolver, la baja sale
  sola a las 3 corridas.
- **Katech (#55)**: 0 productos en todo el historial (bloqueo 403 del runner) → **pausa** en la primera corrida, un
  comentario en #55 y silencio después.
- **FullH4rd (#6)**: último precio el 14/11 → pausa el 29/11 si sigue bloqueada.
- **Mexx (#241) y Venex (#243)**: hoy traen 795 y 1.648 → sus issues se cierran solos.

## Tests

- `tests/test_estado_tiendas.py`: clasificación, `es_muerta` (NXDOMAIN y 52x/530; no `EAI_AGAIN`, certificado,
  conexión, tiempo, 403, 404), `es_red`, `sondeo`, `frenar`, reglas de baja/pausa/alta, ping semanal (también con
  fecha rota), semilla (sin pausa en la corrida de siembra), registros rotos y disco.
- `tests/test_estado_tiendas_corrida.py`: `indexar.main()` de punta a punta (baja a las 3 corridas, fuera del índice,
  ping semanal, alta en la misma corrida, pausa a los 14 días sin precios viejos, un solo cambio, semilla, `--solo`,
  muerte confirmada siempre por el ping, DNS temporal sin baja, registro roto re-sembrado, freno global).
- `tests/test_salud.py` (`Acciones`, cierre de #96, baja sin issue) y `tests/test_avisos_y_arreglos.py` (aviso al dueño).
- `tests/js/info.test.js`: `/estado/` muestra la pausa.
