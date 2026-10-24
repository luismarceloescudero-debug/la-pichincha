# Feature Specification: Publicacion diaria en Instagram

**Created**: 2026-10-23

**Status**: Implementada. La primera publicacion real espera el OK del dueño con la imagen y el texto.

**Input**: El dueño creo la cuenta profesional @lapichinchadeldia, la app de Meta con inicio de sesion de Instagram
(permisos `instagram_business_basic` e `instagram_business_content_publish`), cargo el secreto `INSTAGRAM_TOKEN` y la
variable `INSTAGRAM_USER_ID` (17841430284814997) y pidio: «Armá la publicación diaria en Instagram con las ofertas
reales del día, con la renovación automática del token».

## Verificacion del token (23/10, sin publicar)

Corrida de Actions en la rama de esta spec, con un workflow temporal que solo leyo:

- `GET /me`: `username` lapichinchadeldia, `account_type` BUSINESS, `media_count` 0.
- `GET /{usuario}/content_publishing_limit`: cupo de 100 publicaciones por 24 horas, 0 usadas.

## Decisiones

### 1. Que se publica

- **Las mismas ofertas que Telegram**: `_sitio/ofertas.json`, que ya paso por las dos verificaciones de enlaces y la
  guardia. Nada nuevo que decidir sobre que es una oferta (`js/ofertas.js`).
- **La imagen**: 1080x1350 (4:5, lo mas alto que el feed acepta sin recortar), con los colores del sitio y las 5
  primeras: descuento, nombre (hasta dos lineas), precio, tachado del precio anterior, comercio y categoria. Abajo,
  «Todas con su link en pichinchadeldia.com.ar/hoy · link en la bio».
- **El texto**: las 10 con precio, descuento y comercio (y el costo puesto en casa de las internacionales), el aviso de
  verificar en la tienda, que el orden no depende de comisiones y cinco etiquetas fijas. En Instagram un link del texto
  no se puede tocar: por eso manda a `/hoy/`, que tiene el de cada tienda. Se achica hasta los 2200 caracteres.
- **Sin ofertas no se publica.**

### 2. Como se publica

- **La imagen tiene que tener direccion publica**: la API de Instagram la baja por su cuenta y solo acepta JPEG.
  - `publicar_instagram.py armar` corre en el build, despues de Telegram: arma la pagina de la tarjeta y la saca con
    Chrome sin interfaz (`--screenshot=<archivo>.jpg`; Chrome elige JPEG por la extension) en
    `_sitio/instagram/AAAA-MM-DD.jpg`. El nombre lleva la fecha, asi la cache del sitio nunca sirve la de otro dia.
  - El texto y la direccion de la imagen viajan en el artefacto `instagram` (`instagram.json`) y no por el sitio, para
    que la cache de GitHub Pages no devuelva el del dia anterior.
- **El job `instagram` corre despues del despliegue** (`needs: [construir, publicar]`): espera a que la imagen
  responda como `image/jpeg` (hasta 10 intentos, 30 segundos entre cada uno), crea el contenedor (`POST /{usuario}/media`),
  espera a que quede `FINISHED` y publica (`POST /{usuario}/media_publish`).
- **No se repite el dia**: si la ultima publicacion de la cuenta es de la misma fecha (hora de Argentina), no publica.
  Asi una corrida manual o un reintento no duplican.
- **Cuando corre**: la corrida programada (09:00) y una manual con la casilla *instagram* tildada; nunca un push ni una
  corrida con alarma de la guardia (lo mismo que Telegram).
- **Si algo falla** (sin token, Instagram rechaza, la imagen no responde) avisa con `::warning::` y la corrida no
  falla: el sitio ya esta publicado. El token nunca se imprime: va en el cuerpo o en la consulta, y un mensaje de error
  que lo trajera se tapa.

### 3. Renovacion del token

- El token del inicio de sesion de Instagram dura 60 dias y se puede estirar otros 60 una vez que tiene 24 horas
  (`GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token`). El job lo renueva en cada corrida,
  antes de publicar; si la renovacion falla, sigue con el que hay.
- **Si Instagram devuelve el mismo token** (lo esperable), no hay nada que guardar.
- **Si devuelve uno distinto**, se usa ese dia y se guarda en `INSTAGRAM_TOKEN` con `gh secret set` (por la entrada
  estandar, nunca en un argumento) usando el secreto opcional `INSTAGRAM_GH_TOKEN`: un token de GitHub con permiso de
  escribir los secretos de este repo. El `GITHUB_TOKEN` de Actions no puede escribir secretos. Sin `INSTAGRAM_GH_TOKEN`
  avisa con `::warning::`.

## Pendiente

- **Primera publicacion**: con el OK del dueño sobre la imagen y el texto. Hasta que se mergee, no corre.
- **La primera renovacion**: el token se genero el 23/10 a las 16:41 y recien tiene 24 horas el 24/10 a esa hora, asi
  que la corrida de las 09:00 del 24/10 avisa que no pudo renovarlo y publica igual; la del 25/10 es la primera que
  renueva. Confirmar en su log si Instagram devuelve el mismo token. Si devuelve otro, hace falta `INSTAGRAM_GH_TOKEN` (lo crea el dueño) o el token vence 60 dias
  despues de generado.

## Tests

`tests/test_publicar_instagram.py` (32): el texto (precio, descuento, comercio, puesto en casa, limite), la tarjeta
(escapado, 5 ofertas, tamaño), `armar` con un Chrome falso (JPEG, sin Chrome, sin ofertas, captura rota), los pedidos
(token en la consulta o el cuerpo, error sin el token), la renovacion (mismo token, nuevo y guardado por la entrada
estandar, nuevo sin con que guardarlo, falla de `gh`, falla de la renovacion), no repetir el dia (hora de Argentina),
esperar la imagen y publicar (contenedor, estados, demora, enlace).
