# Spec 046: formulario de contacto

## Problema

El sitio no tenia un contacto publico: faltaban `/.well-known/security.txt` y la pagina «Acerca de» (confianza para
Google y para quien compra, E-E-A-T). El dueño, 30/10/2026: en lugar de publicar su correo, un formulario de contacto, y
la guia para configurar el correo en Cloudflare.

## Que se hizo

### Worker: `POST /contacto` (`worker/src/index.js`)

- Recibe JSON: `nombre` (opcional, hasta 80), `correo` (obligatorio, formato y hasta 254), `motivo` (`consulta`, `error`,
  `tienda`, `prensa`, `otro`), `mensaje` (10 a 4000), el campo trampa `sitio` y `espera`.
- **Campo trampa**: `sitio` esta oculto para una persona; si llega lleno se responde `{ ok: true }` y no se manda nada.
- **Tiempo minimo**: `espera` son los milisegundos que midio el navegador desde que cargo el formulario. Con menos de
  3 s se rechaza. Lo mide el navegador (no se compara su reloj con el del Worker), asi un reloj adelantado no deja
  afuera a nadie.
- **Topes por IP**: el general del Worker (30 pedidos por minuto) y uno propio de 5 mensajes cada 10 minutos.
- **Cabeceras seguras**: nombre y correo no pueden traer saltos de linea (no se inyecta otra cabecera).
- **Envio**: binding `send_email` de Cloudflare llamado `CORREO`, con `EmailMessage` de `cloudflare:email` (se importa
  recien al mandar, para que los tests corran en Node). El mail va en texto plano UTF-8 (base64), con `Reply-To` igual
  al correo de quien escribe, `Message-ID` del dominio del remitente y el asunto en RFC 2047 si tiene tildes.
- **Destino y remitente** salen de `CONTACTO_DESTINO` y `CONTACTO_REMITENTE` (secretos o variables del Worker), nunca
  del codigo. Sin el binding o sin alguna de las dos: **503** «El formulario de contacto todavía no está activo».
  Si `send` falla: **502**, sin detalles del error.
- CORS solo para el sitio y localhost, como las otras rutas; el preflight de `/contacto` permite `POST` y
  `Content-Type`. Las respuestas no se guardan (`Cache-Control: no-store`).

### Sitio (`generar_info.js`)

- **`/contacto/`** con el estilo de `/legal/` y `/estado/`: labels, ayuda y error por campo (`aria-describedby`,
  `aria-invalid`), el estado (enviando, enviado, error) en una region `role="status"` con `aria-live="polite"`, y el foco
  al campo con error. Sin librerias.
- **Sin JavaScript** el formulario queda deshabilitado (`<fieldset disabled>`) y un `<noscript>` lo dice: asi un envio sin
  JS nunca pone el correo y el mensaje en la URL. Sin direccion del Worker, dice que no esta disponible.
- El endpoint es `afuera_url` de `sitio.json` + `/contacto`; ese host ya estaba en `connect-src` de la CSP.
- Los limites y motivos de la pagina (`CONTACTO`, `MOTIVOS`) son los del Worker (`LARGOS`, `MOTIVOS`): un test lo exige.
- **`/acerca/`**: texto neutro (proyecto independiente, como funciona, como escribir). Lo personal lo escribe el dueño:
  queda marcado `[COMPLETAR]` y no se inventa ningun dato.
- **`/.well-known/security.txt`** (RFC 9116): `Contact: https://pichinchadeldia.com.ar/contacto/`, `Expires` a un año de
  cada corrida (se renueva solo al publicar), `Preferred-Languages` y `Canonical`. `actualizar.yml` sube el sitio con
  `include-hidden-files: true` (si no, `upload-pages-artifact` deja afuera las carpetas que empiezan con punto).
- **Pie**: «Contacto» al lado de «Términos y privacidad» en la portada, `/estado/`, `/legal/`, las paginas por busqueda y
  `/hoy/`; en las paginas de informacion tambien «Acerca de».
- **Privacidad** (`/legal/#contacto`): lo que se escribe en el formulario va por correo a quien hace el sitio, solo para
  responder; no se guarda ni pasa por GoatCounter.
- Lighthouse de la CI mide tambien `/contacto/`.

## Lo que hace el dueño

Activar Email Routing en Cloudflare, verificar su correo como destino y cargar el binding y las dos variables: paso a
paso en `docs/pendientes-del-dueno.md`, item 1. Hasta entonces el formulario responde 503 y lo dice.

## Tests

`tests/js/worker.test.js` (binding simulado: envio, cabeceras, RFC 2047, inyeccion, validaciones, trampa, espera, metodos,
503, 502, CORS y tope) y `tests/js/info.test.js` (pagina accesible, sin endpoint, CSP, Acerca de sin datos inventados,
security.txt, pie y privacidad). Probado en el navegador con el Worker real y `send_email` simulado: error de campo, envio
muy rapido, 503 sin binding y el envio con el mail armado.
