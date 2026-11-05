# Spec 061: avisos y arreglos automáticos (etapa 1, y la etapa 2 documentada y apagada)

## Problema

El 04/11 una corrida trajo **0 productos de Katech** («Katech 0 productos fallo») y nadie se enteró al momento: los
avisos que había eran issues de GitHub, y el de las fuentes caídas (`salud.py`) solo corre en las corridas programadas,
que no existen desde el 02/11. Pedido del dueño (05/11): aviso en tiempo real de los errores nuevos, arreglo automático
de los que ya se conocen, todo gratis y explicado simple.

## Etapa 1 (esta spec, prendida)

### 1. Aviso privado al dueño por Telegram, al instante

`avisar_dueno.py` manda un mensaje al **chat privado del dueño** con el mismo bot del canal. Nunca al canal: si el chat
del dueño es igual a `TELEGRAM_CHAT_ID`, no se manda.

| Cuándo | Dónde se dispara (`.github/workflows/actualizar.yml`) |
| --- | --- |
| Una tienda trae 0 productos o menos del 70 % (con el motivo y el arreglo que se aplicó solo) | paso «Avisar al dueno por Telegram (privado)», job `construir`, con `salud.json` |
| El indexado no terminó (no hay `salud.json`) | el mismo paso |
| Salta una alarma de la guardia (`alarma.md` de `guardia.js`) | el mismo paso (no en un push: corre sobre la foto del sitio) |
| Falla la corrida (algún job en `failure`) | job `avisar-falla` (`if: failure()`) |

Secretos: `TELEGRAM_BOT_TOKEN` (ya estaba) y **`TELEGRAM_CHAT_DUENO`** (nuevo, lo carga el dueño). Sin el secreto el paso
no falla: deja un `::warning::` con el texto del aviso en el log. El token nunca se imprime.

Ejemplo de aviso:

> ⚠️ **La Pichincha: aviso de la corrida**
>
> 🔴 **Katech: 0 productos**. Motivo: trajo 0 productos, también en el reintento (E1). Arreglo: se muestran los precios
> de la corrida anterior, marcados con su fecha vieja.
>
> Ver la corrida

### 2. Catálogo de errores conocidos y su arreglo automático (reglas fijas, con tests)

| Código | Error | Regla fija | Dónde | Tests |
| --- | --- | --- | --- | --- |
| **E1** | Una tienda trae **0 productos** (Katech 04/11) o se **corta la red** | Se espera `ESPERA_REINTENTO` (60 s) y se reintenta **una vez**. Si vuelve, entra como de hoy (`motivo: recuperada`). Si sigue en 0, se usan los precios de la corrida anterior con su fecha de relevado vieja (**principio II**: el sitio dice «sin relevar hoy: Katech (04/11)» y `/estado/` la marca atrasada) y se avisa. | `indexar.relevar`, `indexar.main` | `test_avisos_y_arreglos.Reintento`, `test_indexar_corrida` (`test_e1_*`) |
| **E2** | **429 de Mercado Libre** (demasiados pedidos) | Se espera y se reintenta: lo que diga `Retry-After` (hasta 120 s) o, si no dice, 30 s y después 90 s (el castigo dura más de 30 s, medido el 23/10). Un tercer 429 corta la fuente (E1 no la reintenta: es un bloqueo). | `mercadolibre.pedidor`, `espera_429` | `test_avisos_y_arreglos.MercadoLibre429`, `test_mercadolibre` |
| **E3** | **Bloqueo de Cloudflare** (desafío «Just a moment», FullH4rd desde el 08/10) | **No se esquiva** (ni navegador automatizado ni proxies). `bajar()` lo reconoce (cabecera `Cf-Mitigated: challenge`, o servidor cloudflare con la página del desafío) y lo convierte en `BloqueoCloudflare`: la tienda se saltea entera, sin reintento, y se avisa con el motivo. | `indexar.bajar`, `_desafio_cloudflare`, `motivo_de` | `test_avisos_y_arreglos.Cloudflare`, `Motivo` |
| **E4** | Otro **bloqueo** (403, 429, 503 de una tienda) | No se reintenta (principio III: se corta y se retoma otro día); se usa lo anterior con su fecha y se avisa. | `motivo_de` | `test_avisos_y_arreglos.Reintento.test_un_bloqueo_no_se_reintenta` |

Lo que ya existía y se mantiene: el corte a mitad de respuesta (`IncompleteRead`) se reintenta una vez en `bajar()`;
`publicar_telegram.pedir` reintenta 3 veces una falla de red al conectar; la guardia del índice abre su issue.

`salud.json` suma, por fuente con problemas, `motivo` (`cloudflare`, `bloqueo`, `red`, `sin productos`, `error`,
`recuperada`), `detalle` y `reintentada`.

### 3. Errores del navegador de la gente (Sentry plan gratis, APAGADO)

`js/errores.js` (el primer script de `index.html`) escucha `window.onerror` y `unhandledrejection` y manda el error a
Sentry armando a mano el «sobre» (envelope), sin bajar el SDK. Está **apagado** mientras el meta `errores-dsn` esté vacío.

- Muestreo bajo: 1 de cada 10 errores (`MUESTREO`), como mucho 3 por visita y sin repetir el mismo.
- Sin datos personales: sin cookies, sin usuario, `user.ip_address: null`, la dirección sin `?consulta` ni `#ancla`, y
  el texto limpio de mails y números de 7 o más dígitos.
- `/legal/#errores` explica todo esto, y solo aparece cuando la captura está prendida (`generar_info.js`).

### Lo que tiene que hacer el dueño (etapa 1)

1. **Sacar su chat id**: abrir el bot del canal en Telegram y mandarle cualquier mensaje («hola»). Después abrir en el
   navegador `https://api.telegram.org/bot<TOKEN>/getUpdates` (el token del bot, el mismo de `TELEGRAM_BOT_TOKEN`) y
   copiar el número que aparece en `"chat":{"id":...}`. Otra forma: escribirle a `@userinfobot`, que contesta con tu id.
2. **Cargarlo**: `gh secret set TELEGRAM_CHAT_DUENO` y pegar el número.
3. **(Opcional) Sentry**: crear una cuenta gratis en sentry.io, un proyecto «Browser JavaScript», y en *Settings →
   Security & Privacy* prender **Prevent Storing of IP Addresses**. Pasar el DSN (`https://<clave>@oNNN.ingest...sentry.io/<n>`).
   Con el DSN, el cambio es: `errores_dsn` en `sitio.json`, el meta `errores-dsn` de `index.html` y el host del DSN en
   `connect-src` de la CSP (`sitio.json` e `index.html`). `tests/test_sitio.py` exige que los tres coincidan.

## Etapa 2 (documentada, APAGADA): Claude arregla los errores nuevos

Un error **nuevo** (que no está en el catálogo de arriba) se le pasa a Claude Code con `anthropics/claude-code-action`,
que lo investiga y propone el arreglo en un PR. **Nunca mergea solo**: el PR pasa por la CI y lo revisa el dueño.

- Workflow: `.github/workflows/arreglar-con-claude.yml`. Se dispara al poner la etiqueta `arreglar-con-claude` a un
  issue (por ejemplo, uno de `salud-fuente` o `guardia`), solo si la pone el dueño.
- Corre con la **suscripción** del dueño (Claude Pro/Max), no con la API paga: usa `CLAUDE_CODE_OAUTH_TOKEN`.
- Reglas del prompt: leer esta spec, no tocar lo que ya está en el catálogo, no esquivar bloqueos, nada de Instagram ni
  de publicar en Telegram, tests en verde y commits sin tildes.

Para prenderla (decisión del dueño):

1. En su compu: `claude setup-token` (abre el navegador, se entra con la cuenta de Claude, devuelve un token).
2. `gh secret set CLAUDE_CODE_OAUTH_TOKEN` y pegar el token.
3. `gh variable set ARREGLO_CLAUDE --body si` (el interruptor). Para apagarla: `--body no`.

Lo que falta para que sea del todo automática (más adelante): que `avisar_dueno.py` o `salud.py` pongan la etiqueta
solos cuando el error no está en el catálogo. Hoy la pone el dueño a mano, para no gastar su límite de uso sin mirarlo.

## Tests

- `tests/test_avisos_y_arreglos.py`: reintento (E1), motivos, Cloudflare (E3), 429 de Mercado Libre (E2), salud con
  motivo y el aviso al dueño (sin secreto, nunca al canal, corrida fallida, cortes de largo).
- `tests/test_indexar_corrida.py`: E1 de punta a punta (recupera en el reintento; dos veces en 0 usa lo anterior con su fecha).
- `tests/js/errores.test.js`: DSN, limpieza de datos personales, pila de Chrome y Firefox, muestreo y tope, apagado sin DSN.
- `tests/test_sitio.py` (`Errores`) y `tests/js/info.test.js`: el DSN coincide en `sitio.json`, `index.html` y la CSP;
  `/legal/` nombra a Sentry solo con la captura prendida.
