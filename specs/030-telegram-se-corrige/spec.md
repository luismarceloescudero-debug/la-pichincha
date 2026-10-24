# Feature Specification: El mensaje de Telegram se corrige cuando se corrige el sitio

**Created**: 2026-10-24

**Status**: Implementada. Corre desde el primer mensaje que salga con este cambio: el del 23/10 22:06 no tiene su
numero guardado y hay que corregirlo o borrarlo a mano.

**Input**: El dueño, el 24/10, con el mensaje de las 22:06 del 23/10 (la Lenovo V15 de Mexx dos veces): «parece que al
acceder al link se corrige». El arreglo de la spec 028 se publico con un push a las 22:43; esa corrida republico `/hoy/`,
`ofertas.json` y el RSS sin la Lenovo repetida, pero el mensaje de Telegram quedo como salio: un push nunca toca Telegram
para no repetir mensajes en cada merge.

## Decisiones

- **Un mensaje por indice.** `publicar_telegram.py --estado _sitio/telegram.json` anota que mensaje salio para que
  indice: `{generado, message_id, texto}` (sin token ni canal). Viaja con el sitio, como `guardia.json`, y la corrida
  siguiente lo baja con `--previo`.
- **Mismo indice, otra lista**: se corrige el mensaje que ya salio (`editMessageText` con su `message_id`), con el mismo
  texto que hoy mandaria `sendMessage` y la misma vista previa de `/hoy/`.
- **Mismo indice, misma lista**: no se toca, y el estado se vuelve a publicar para que no se pierda.
- **Otro indice**: la corrida programada y la manual mandan un mensaje nuevo, como siempre.
- **Un push** (`--solo-corregir`) nunca manda un mensaje nuevo: solo corrige el del mismo indice.
- Con alarma de la guardia no se manda ni se corrige.
- Si Telegram rechaza la correccion (por ejemplo, el mensaje se borro a mano) es una advertencia y queda el estado de
  antes; el sitio sale igual.

## Tests

`tests/test_publicar_telegram.py` (`UnMensajePorIndice`): el mensaje nuevo deja anotado cual es; el mismo indice con otra
lista corrige el que salio (en un push tambien); con la misma lista no se toca y el estado sigue; otro indice manda uno
nuevo; un push nunca manda uno nuevo; si la correccion falla queda el estado anterior; un previo roto es como no tenerlo.
`tests/test_canal.py`: el paso del workflow baja el previo, publica el estado con el sitio y en un push solo corrige.
