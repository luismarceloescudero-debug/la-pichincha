# Spec 058: la publicación sale aunque no haya rebajas ni la guardia esté en verde

## Problema

El 03/11 la corrida manual rearmó el índice y **no publicó nada** en Telegram: la guardia del índice se despertó
(el checkout de la rama `historial` no vino, el índice salió con 0 bajas propias) y el paso «Publicar las pichinchas
del día» quedó `skipped`. Además, con un `ofertas.json` vacío el mensaje no salía: `mensaje()` devolvía `None`.

Decisión del dueño (04/11/2026): «que haya o no rebajas reales, nos muestren igual la publicación, y que esto no sea
una causa de bloqueo de las corridas». La calidad de una medición avisa; no frena la publicación.

## Qué se hace

1. **Workflow** (`actualizar.yml`): el paso de Telegram ya no depende de `steps.guardia.outputs.alarma`. Se sigue
   mandando por `schedule`, `workflow_dispatch` y `push` (un push solo corrige, spec 030) y sigue con
   `continue-on-error`. El issue de la guardia se abre igual, y su texto dice que el mensaje se mandó.
2. **`publicar_telegram.py`**: `mensaje()` devuelve un texto aunque `ofertas` esté vacío («Hoy no hay bajas para
   destacar» + enlace a La Pichincha). Una publicación con `sinRebaja` o sin `descuento` muestra el precio sin un
   «−0 %» inventado; la mejor del día se calcula con el descuento, así que una lista sin porcentajes no rompe.
3. **`generar_feed.js`**: las ofertas que salen por baja en seguimiento sin porcentaje (`sinRebaja: true`) viajan así
   en `ofertas.json`.

## Lo que NO incluye

La revisión por suba previa («subió antes de la oferta», sello `x` de `serie.py`) es la spec 060
(`privado/prompts/060-suba-antes-de-la-oferta.md`): marcarla en el sitio y en el canal, con fecha y porcentaje de la
suba, y la marca de «estable hace N días». Esta spec solo garantiza que nada frene el mensaje.

## Tests

- `tests/test_canal.py`: la acción de Telegram no mira la guardia.
- `tests/test_publicar_telegram.py`: mensaje con la lista vacía, mensaje de una publicación sin rebaja (sin %),
  publicación real con lista vacía.
- Suites completas: 627 Python y 750 JS en verde.
