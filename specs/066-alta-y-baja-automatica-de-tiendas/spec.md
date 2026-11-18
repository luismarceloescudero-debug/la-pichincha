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
| `vacia` | 0 productos sin bloqueo; también un error de lectura o un corte de red que no se recuperó en el reintento (E1) |
| `bloqueo` | 403/429/503 o el desafío de Cloudflare (E3/E4): la tienda dijo que no |
| `muerta` | el dominio no resuelve (DNS), no contesta al conectar, rechaza la conexión, tiene el certificado inválido, o Cloudflare dice que el origen está caído (521/522/523/530) |

Si una tienda trae 0 y no fue un bloqueo, se pide **una vez la portada** (`base` de `tiendas.json`) para saber si está
muerta o solo vino vacía. Cualquier respuesta HTTP (un 403 también) es una tienda viva.

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

- `tests/test_estado_tiendas.py`: clasificación, `es_muerta` (DNS, certificado, conexión, 52x/530; no un 403, un 404 ni
  una lectura lenta), reglas de baja/pausa/alta, ping semanal, semilla y disco.
- `tests/test_estado_tiendas_corrida.py`: `indexar.main()` de punta a punta (baja a las 3 corridas, fuera del índice,
  ping semanal, alta en la misma corrida, pausa a los 14 días sin precios viejos, un solo cambio, semilla, `--solo`).
- `tests/test_salud.py` (`Acciones`, cierre de #96, baja sin issue) y `tests/test_avisos_y_arreglos.py` (aviso al dueño).
- `tests/js/info.test.js`: `/estado/` muestra la pausa.
