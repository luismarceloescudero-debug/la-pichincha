# Si algo sale mal: como volver atras (25/11)

Una sola hoja. Elegi el sintoma y segui los pasos. `main` esta protegida: todo cambio entra por PR, tambien el que deshace.

## Antes de tocar nada
1. Corre `/verificar-publicacion` (o `python herramientas/verificar_publicacion.py`): dice que esta roto y desde cuando.
2. Mira `docs/errores-conocidos.md`: si el sintoma ya esta, la guardia fallo y se corrige la guardia.

## El sitio (HTML, precios, buscador)
Sintoma: la pagina se ve mal, hay un error en pantalla o los precios no cargan tras una publicacion.
1. Busca el commit malo: `git log --oneline -10`.
2. Deshacelo: `git revert <sha>` en una rama, `git push`, abri el PR con `gh pr create` y mergealo con `gh pr merge N --rebase` cuando los checks esten en verde.
3. El merge publica solo (workflow «Actualizar precios y publicar»). Tarda unos minutos.
4. Verifica: `python herramientas/verificar_publicacion.py` y mira la portada.

## El indice de precios vacio o viejo
Sintoma: el buscador no encuentra nada o el vigia avisa «indice viejo».
1. `gh workflow run actualizar.yml -f indexar=true` (el hook te pide confirmacion: es a proposito).
2. Espera la corrida con `gh run watch` y verifica de nuevo.

## El Worker (buscador Afuera, contacto, vigia)
Sintoma: `/vigia` o `/version` fallan, el formulario no manda o Afuera no responde.
1. Rapido, sin tocar codigo: `cd worker; npx wrangler rollback` (vuelve a la version anterior del Worker en Cloudflare).
2. Definitivo: `git revert <sha>` del cambio en `worker/` y PR; al mergear, `worker.yml` lo despliega.
3. Verifica: `https://pichincha-afuera.mescudero.workers.dev/version` debe devolver el commit esperado y `/vigia` debe responder 200.
4. Si el vigia manda avisos de mas: en `worker/wrangler.toml` poner `VIGIA = "no"` (lo apaga entero) y volver a `"si"` cuando se arregle.

## Cloudflare (proxy y cabeceras)
Sintoma: el sitio no abre, da error de certificado o redirige en bucle.
1. https://dash.cloudflare.com → `pichinchadeldia.com.ar` → **DNS → Records**.
2. En los 4 registros `A` y en el `CNAME www`, poner la nube **gris** (DNS only) y guardar. En segundos el sitio sale directo de GitHub Pages.
3. Detalle y cuidados: `docs/cloudflare-proxy.md`.

## Correo del formulario de contacto
Sintoma: llegan mensajes de mas o ninguno.
1. Spam: bajar el tope en `worker/wrangler.toml` (`[[ratelimits]]`, `limit`) y desplegar.
2. No llega nada: `/contacto/` y los issues de `la-pichincha-correo` dicen si el Worker responde; revisar `CONTACTO_DESTINO` y Resend.

## Tiempos esperados
| Que | Cuanto tarda |
|---|---|
| Nube gris en Cloudflare | segundos |
| `wrangler rollback` del Worker | menos de 1 minuto |
| Revertir el sitio por PR | 5 a 10 minutos (CI + publicacion) |
| Rearmar el indice | varios minutos (depende de las tiendas) |

Despues de cualquier vuelta atras: anotar que paso en `docs/errores-conocidos.md` con su guardia (`/registrar-error`).
