# Feature Specification: Afuera nunca desaparece sin explicacion, y la corrida diaria sale temprano

**Created**: 2026-10-24

**Status**: Implementada. El Worker se redespliega con el merge (`worker.yml`); la pagina y el horario salen con el sitio.

**Input**: El dueño, el 24/10: «lo de buscar y copiar y pegar links de Amazon, Tiendamia, etcétera ¿está corregido? ¿Qué
falta?», y que la corrida programada no habia salido cuando reclamo, despues de las 09:00.

## Lo medido (24/10, Worker publicado)

- `/buscar`: la unica fuente activa es Tiendamia (eBay, AliExpress y Amazon no tienen credenciales). Desde la terminal,
  mas de 20 consultas dieron `ok: false`; desde un navegador, 3 de 4 trajeron avisos. Tiendamia y Loquieroaca pasaron a
  responder 403 con el desafio anti-bots de Cloudflare («Just a moment… Enable JavaScript and cookies») a una parte de los
  pedidos automaticos. No se saltea: es su decision.
- Con todas las fuentes caidas la seccion «Afuera» **desaparecia sin decir nada**, y con resultados en el indice no quedaba
  ninguna busqueda armada.
- `/enlace`: Amazon (en español, patrocinado, otros paises, a.co) se reconoce y pide el precio a mano (sin Creators API,
  como estaba previsto). Tiendamia y Loquieroaca se reconocen, pero la lectura daba «La tienda no respondió».
- Relevancia: buscando «logitech g502», el primero por precio era «AKNK Compatible con estación de carga GPW para Logitech G502»;
  buscando «rtx 4070» o «odyssey g5», el primero era reacondicionado («(renovada)», «(Renewed)»).
- Horario: con `cron: "0 12 * * *"` (09:00) las corridas del 15 al 24/10 arrancaron entre las 11:56 y las 15:19; GitHub
  atrasa mas los cron de hora en punto.

## Decisiones

- **Afuera con respaldo** (`js/afuera.js`, `js/busqueda.js`): si el Worker no responde, no esta configurado, ninguna fuente
  se pudo leer o no hay avisos, va el bloque de busquedas armadas de la spec 020 (Tiendamia, Loquieroaca, Amazon con el tag
  de afiliado rotulado, tiendas oficiales). Si ninguna fuente se pudo leer se dice: «Ahora no pudimos leer precios de afuera:
  Tiendamia no respondió.». Con avisos en vivo no hace falta el respaldo. En la busqueda sin resultados el bloque ya esta en
  la pagina y no se repite.
- **El link pegado dice por que no se lee**: con el 403 de Tiendamia o Loquieroaca, «Tiendamia no deja leer su página
  automáticamente: escribí el precio a mano.». El nombre del link sigue llegando.
- **Relevancia**: «para», «for» y «compatible» cortan el nombre como una palabra de accesorio, y se suman «estacion»,
  «dock» y «reemplazo». Si la consulta dice «para» («mouse para notebook») no corta; si busca un accesorio («funda
  aeroclip 2»), no se filtra por accesorio.
- **Lo reacondicionado no compite con lo nuevo**, como en el indice: buscando «rtx 4070» la primera de Tiendamia era una
  «(renovada)», contra el precio nuevo de aca. `Buscador.RE_USADO` (el mismo del indice) suma «renovad», «renewed» y
  «reconditioned», y `relevantes` los saca salvo que la consulta los pida. En el indice del 23/10 eso deja afuera dos iPad
  «Renovado» de ComparaYa, que tampoco eran nuevos.
- `CACHE_VERSION` pasa a `031`: lo guardado con las reglas anteriores no se usa.
- **Horario** (`actualizar.yml`): dos cron en minutos sueltos, `17 8` (05:17) y `43 10` (07:43) de respaldo. El trabajo
  `decidir` lee el `guardia.json` publicado: si ya hay indice de hoy (hora argentina), la corrida programada no rearma nada.

## Lo que falta y no es codigo (dueño)

- **Credenciales de las APIs oficiales**, las unicas fuentes que no se bloquean: eBay Browse (gratis, cuenta de
  desarrollador), AliExpress Portals (programa de afiliados) y Amazon Creators API (pide ventas calificadas antes). Se cargan
  con `wrangler secret put`. Ademas pagan comision: es el camino de monetizacion de Afuera.

## Tests

`tests/js/afuera.test.js`: el respaldo cuando no hay respuesta, cuando ninguna fuente se pudo leer y cuando no hay avisos;
con avisos no va. `tests/js/worker.test.js`: el 403 de Tiendamia y de Loquieroaca da su motivo; «compatible... para» es
accesorio con los nombres reales del 24/10, y «mouse para notebook» no corta; lo «(renovada)» y «(Renewed)» queda afuera salvo
que se pida. `tests/test_canal.py`: dos cron en minutos
sueltos antes de las 08:00 y `construir` depende de `decidir`.
