# Auditoria 2: pruebas, Lighthouse y Worker (01/11/2026)

Plan de `docs/pruebas-2026-11-01.md` repetido en la nube, mas lectura del Worker con el conector de Cloudflare.

| # | Item | Resultado |
|---|---|---|
| 1 | Tests JS (`node --test "tests/js/*.test.js"`) | 743/743 |
| 2 | Tests Python (`unittest discover`) | 612 OK |
| 3 | e2e Playwright `--workers=1` (indice de prueba) | 21/21 en 28 s |
| 4 | Lighthouse 12.8.2 local (indice de prueba, preset por defecto) | `/` 98/100/100/100, `/hoy/` y `/estado/` 100/100/100/100 (rend./acc./buenas prac./SEO) |
| 5 | Worker `pichincha-afuera` (Cloudflare, solo lectura) | Desplegado, modificado 01/11 14:51 UTC |

## Worker

- El conector lista 3 Workers en la cuenta: `pichincha-afuera`, `guias-minero-despertador`, `remitos-api`. Solo se reviso el primero.
- El codigo desplegado (1.803 lineas empaquetadas) no tiene claves escritas: eBay y AliExpress leen `env.*`.
- `ORIGEN_OK` desplegado es identico al del repo (solo `https://pichinchadeldia.com.ar` y localhost).
- Vivo: `GET /contacto` 405; `OPTIONS /contacto` 204; `GET /buscar` 200 con `cache-control: public, max-age=900`,
  `content-security-policy: default-src 'none'` y `referrer-policy: no-referrer`.
- Origen ajeno (`https://evil.example`): responde 200 pero sin cabeceras CORS, asi que el navegador lo bloquea.
- `GET /enlace?url=` con `http://169.254.169.254/` y `https://localhost/`: 400 «enlace no reconocido» (sin SSRF).
- No se probo `POST /contacto` (mandaria correo) ni los secretos cargados: el conector no los muestra.

## Limites de esta corrida

- Lighthouse sobre el **indice de prueba**, no el publicado (31.019 avisos); los puntajes de la portada con el indice
  real siguen siendo los de `docs/pruebas-2026-11-01.md`.
- No se midieron ofertas contra el indice publicado (`/medir-indice`) ni el cron del 02/11.
- Email Routing y los secretos `CONTACTO_*` no se pueden ver con el conector: siguen en `docs/pendientes-del-dueno.md`.
