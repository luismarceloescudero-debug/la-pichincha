# Spec 053: acuse de recibo del formulario de contacto (Resend)

## Problema

El formulario de `/contacto/` (spec 046) manda el mensaje al Gmail del dueño con el binding `send_email` de Cloudflare
Email Routing, que solo puede mandar a direcciones **verificadas**: no sirve para avisarle a cualquier persona que su
mensaje llegó. El dueño (31/10/2026) eligió **Resend** (plan gratis: 3.000 correos por mes y 100 por día) para un acuse
automático «Recibimos tu consulta».

## Que se hizo

### Worker (`worker/src/index.js`, ruta `POST /contacto`)

- Despues de mandar bien el mensaje al dueño, `acusar()` hace `fetch` a `https://api.resend.com/emails` (POST, JSON,
  `Authorization: Bearer ${RESEND_API_KEY}`, `Idempotency-Key: acuse-contacto/<id del envio>`; el `id` es el mismo UUID
  del `Message-ID` del mail al dueño).
- Cuerpo fijo (`armarAcuse`): `from` = `La Pichincha <direccion de CONTACTO_REMITENTE>`, `reply_to` = esa direccion,
  `to` = quien escribio, asunto «Recibimos tu consulta» y un texto plano en español rioplatense (`ACUSE_CUERPO`).
  **No lleva nada de lo que escribio la persona** (ni nombre, ni mensaje, ni motivo): nadie puede usar el formulario para
  mandarle texto propio a un tercero.
- **Sin `RESEND_API_KEY`** no se manda acuse y el formulario responde como antes. Si Resend falla (error, 429 o corte a
  los 4 s con `AbortSignal.timeout`), el formulario **no** falla: el mensaje al dueño ya salio. Al log va solo el codigo de
  estado, nunca la clave ni la direccion.
- La respuesta JSON suma `acuse: true | false` segun si Resend acepto el envio.
- Frenos nuevos, ademas de los de la spec 046: un acuse por direccion por hora (mapa en memoria, sin distinguir
  mayusculas) y ninguno si la direccion es la de `CONTACTO_DESTINO` o la de `CONTACTO_REMITENTE`.

### Sitio (`generar_info.js`)

- `/contacto/`: si la respuesta trae `acuse: true`, dice «Te mandamos un correo de confirmación»; si no, el texto de siempre.
- `/legal/#contacto` y la nota del formulario: si se manda el acuse, la direccion de correo pasa por Resend solo para enviar
  ese aviso, y no se guarda.

### Despliegue (`.github/workflows/worker.yml`)

`RESEND_API_KEY` se suma a la lista de secretos que carga `wrangler secret put`: si el secreto no existe en GitHub se
omite («falta: RESEND_API_KEY»), no se carga vacio.

## Lo que hace el dueño

Crear la cuenta de Resend, verificar `pichinchadeldia.com.ar`, crear la clave de solo envio y cargarla como secreto:
`docs/pendientes-del-dueno.md`, item 1 (paso «Acuse de recibo»). Hasta entonces todo anda como antes (`acuse: false`).

## Tests

`tests/js/worker.test.js` (fetch simulado, nunca contra Resend real): acuse con el cuerpo exacto y sin datos de la persona,
sin clave no se manda, Resend falla (500, 429, corte) y el formulario responde bien sin clave ni direccion en el log,
limite de una hora, no se manda a las direcciones del dueño; `tests/js/info.test.js` (textos de `/contacto/` y `/legal/`);
`tests/e2e/contacto.spec.js` (endpoint simulado con y sin `acuse`).
