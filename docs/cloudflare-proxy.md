# Cloudflare delante del sitio (25/11/2026)

El sitio se sirve desde GitHub Pages, que no deja poner cabeceras de seguridad. Desde el 25/11 el dominio pasa por el
proxy de Cloudflare (nube naranja) solo para agregarlas. Resultado en Mozilla Observatory: de 55/100 a **A+ (105/100)**.

## Que quedo configurado (zona `pichinchadeldia.com.ar`, plan Free)

| Que | Valor |
|---|---|
| DNS | Los 4 registros `A` del dominio y el `CNAME www` van **proxied**. Los `MX`, `TXT` y los `CNAME send`/`rsend` (Resend) siguen **solo DNS** (el correo no pasa por el proxy). |
| Cache Rule | «no cachear en Cloudflare» para el dominio y `www`: el sitio ya se publica fresco desde GitHub Pages y asi no se mezclan versiones de `js/` o `css/` con un `index.html` nuevo. Estado `cf-cache-status: DYNAMIC`. |
| HSTS | `max-age=604800` (1 semana), **sin** `includeSubDomains` y sin preload. Para endurecerlo: subir `max-age` de a poco (1 mes, 6 meses) mirando que nada falle. |
| `X-Content-Type-Options` | `nosniff` (viene con el ajuste de HSTS de Cloudflare). |
| `X-Frame-Options` | `SAMEORIGIN`, por una Transform Rule (modificar cabeceras de respuesta). |
| SSL/TLS | `full` (no `strict`): si GitHub Pages renovara tarde su certificado no se cae el sitio con un 526. |

## Como se comprueba

- `python herramientas/verificar_publicacion.py` avisa si faltan las tres cabeceras (el proxy podria estar apagado).
- `curl -sI https://pichinchadeldia.com.ar/` tiene que mostrar `Server: cloudflare`, `Strict-Transport-Security`,
  `X-Frame-Options` y `X-Content-Type-Options`.
- https://developer.mozilla.org/en-US/observatory/analyze?host=pichinchadeldia.com.ar

## Como volver atras (si algo se rompe)

1. https://dash.cloudflare.com → `pichinchadeldia.com.ar` → **DNS → Records**.
2. En los 4 registros `A` del dominio y en el `CNAME www`, tocar la nube naranja para dejarla **gris** (DNS only) y guardar.
   En segundos el sitio vuelve a salir directo de GitHub Pages. Las reglas de cabeceras y de cache quedan inactivas sin dañar nada.

## Cuidados

- No activar el proxy en `send` ni `rsend` (Resend necesita DNS puro).
- Si GitHub Pages muestra «DNS check unsuccessful» al renovar el certificado, es por el proxy: poner la nube en gris unos minutos.
- Un error nuevo de este tema se registra en `docs/errores-conocidos.md` (E09).
