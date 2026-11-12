# Spec 065: el vigía del sitio (plan v4, Fase 0)

## Problema

Hasta hoy nadie se entera si el sitio se rompe de noche. Los avisos de la spec 061 salen al final de una corrida de GitHub
Actions, y esa corrida puede atrasarse hasta una hora; si GitHub Pages sirve una pantalla de error, si el índice quedó
viejo o si falta la prueba de la app, no hay nada que lo mire. El plan v4 (`docs/plan-v4-tiendas-de-apps.md`, secciones 7.1
y 7.6) pone las correcciones 24/7 como **Fase 0**, antes de la app: no se lanza algo que, cuando se rompa de noche, nadie
se entera hasta la mañana.

## Qué hace

Un **Cron Trigger de Cloudflare** (cada 5 minutos, en el Worker «Afuera») corre el vigía: mira el sitio publicado y, si
algo falla, manda un mensaje al **chat privado del dueño** por Telegram en el momento. Cuando vuelve a andar, manda uno
solo avisando eso.

| Chequeo (`id`) | Qué mira | Cuándo es una falla |
| --- | --- | --- |
| `portada` | `https://pichinchadeldia.com.ar/` | no responde, no es 200 o no es la página del sitio |
| `hoy` | `/hoy/` | ídem |
| `precios` | `/precios/placa-de-video/` | ídem (una pantalla de mantenimiento con 200 tampoco cuenta) |
| `indice` | `/indice.json` | no responde, no se lee la fecha, o es de un día anterior |
| `assetlinks` | `/.well-known/assetlinks.json` | **solo con `APP_PUBLICADA = "si"`** (Fase 3): falta o no trae el paquete `ar.com.pichinchadeldia.app` con su huella |

La «marca» de cada página es un texto que solo está en la página buena (`La Pichincha`, `Pichinchas del`): un 200 con otra
cosa no se toma como sitio andando.

## Reglas propias de esta pieza

- **El índice no se baja entero.** Pesa más de 6 MB; el Worker gratis tiene 10 ms de CPU por pedido. Se pide con
  `Range: bytes=0-511` y se corta la descarga: `generado` es la primera clave del archivo (`indexar.py`, `datos = {"generado": ...}`).
- **La hora es la argentina** (UTC-3 fijo), no la del Worker ni la del que mira.
- **Gracia de la madrugada.** La corrida diaria sale a las 00:23 y a las 02:47; antes de las 03:00 un índice de ayer
  todavía puede ser normal y no se avisa. Con dos días de atraso se avisa a cualquier hora.
- **Un aviso por problema.** Se guarda una huella (qué chequeos fallaron) y no se repite hasta que cambie o pasen 6 horas
  (recordatorio). Así una caída de una hora no manda doce mensajes.
- **Aviso verde al volver.** Un solo «volvió a andar», con lo que fallaba.
- **Nunca al canal público.** Si `TELEGRAM_CHAT_DUENO` es igual a `TELEGRAM_CHAT_ID`, no se manda. Son los mismos
  secretos de la spec 061 (el bot del canal, el chat privado del dueño).
- **Sin secretos no falla.** Deja el aviso en el log (`console.warn`) y **no** se anota como avisado, así la próxima
  corrida lo reintenta en cuanto se carguen.
- **Interruptor general.** `VIGIA = "no"` en `worker/wrangler.toml` apaga todo (por defecto está prendido).
- **No manda nada desde HTTP.** `GET /vigia` corre los mismos chequeos y devuelve `{ cuando, ok, fallas }` sin tocar
  Telegram: nadie puede hacer sonar el teléfono del dueño pidiendo una ruta. `?fresco=1` saltea el medio minuto de
  recordado que tiene la ruta para no repetir los pedidos.

## Dónde vive el estado (y por qué no hay base todavía)

La Cache API del Worker (`https://vigia.cache/estado`) guarda la última huella y cuándo se avisó. No es una base: se puede
vaciar, y lo peor que pasa es un aviso de más. Alcanza para no repetir; una base (KV o D1) entra recién con las alertas de
precio del plan v4 (sección 3.4), que sí necesitan estado de verdad.

## Archivos

| Archivo | Qué |
| --- | --- |
| `worker/src/vigia.js` | los chequeos, el texto del aviso, el envío y la corrida entera (funciones puras, probadas) |
| `worker/src/index.js` | `scheduled()` para el Cron Trigger y `GET /vigia` |
| `worker/wrangler.toml` | `[triggers] crons = ["*/5 * * * *"]`, las variables `VIGIA`, `VIGIA_BASE` y `APP_PUBLICADA` |
| `.github/workflows/worker.yml` | pasa al Worker los secretos `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_DUENO` y `TELEGRAM_CHAT_ID`, y corre estos tests antes de desplegar |

## Qué tiene que hacer el dueño

1. Nada nuevo: los secretos de Telegram son los de la spec 061. El despliegue del Worker los copia solo.
2. Cuando la Fase 3 publique la app: `APP_PUBLICADA = "si"` en `worker/wrangler.toml`, para que también se revise
   `assetlinks.json`.
3. Para apagarlo un tiempo: `VIGIA = "no"` en el mismo archivo.

## Cómo se prueba a mano

```
curl -s https://pichincha-afuera.mescudero-remitos-internos.workers.dev/vigia
{"cuando":"2026-11-12T12:00:00.000Z","ok":true,"fallas":[]}
```

Para probar el aviso sin romper nada: apuntar `VIGIA_BASE` a un sitio que falle (o pedir `?fresco=1` justo cuando algo
está mal) y mirar el log del Worker (`wrangler tail`). El mensaje dice qué chequeo falló y con qué detalle.

## Lo que sigue (del plan v4, sección 7.6; no entra acá)

- Huella de issues para no duplicar y etiquetado automático de los nuevos.
- Lista permitida y merge automático de nivel 2.
- Revert automático: después de cada merge, el vigía corre al minuto durante 30 minutos y, si aparece un error nuevo,
  `git revert`.
- `/estado/` con el historial de caídas del vigía.

## Tests

`tests/js/vigia.test.js` (21 casos): fecha y hora argentinas, lectura de la fecha del índice sin bajar el archivo, los
cinco chequeos (caído, 404, 200 que no es el sitio, sin respuesta, índice de ayer / de anteayer / con gracia de
madrugada), `assetlinks` apagado y prendido, el texto del aviso (primero, repetido, recordatorio, vuelta a andar), el envío
al chat privado y nunca al canal, la corrida completa con estado, la cache rota, el interruptor `VIGIA`, y la ruta `/vigia`
(sin Telegram, con `?fresco=1` y con el medio minuto de recordado).
