# Errores conocidos y su guardia

Registro de errores que ya pasaron una vez. Cada fila apunta a la guardia (un test, un hook o una regla)
que impide que vuelva. `tests/test_errores_conocidos.py` falla si una guardia citada no existe: el registro
no puede mentir.

Formato de la columna **Guardia**: `ruta::fragmento`. La ruta tiene que existir y el fragmento tiene que
aparecer en ese archivo (nombre del test, constante o frase de la regla).

## Ciclo para un error nuevo

1. Buscar el sintoma en esta tabla. Si ya esta, fallo la guardia: se arregla la guardia, no se pone un parche al lado.
2. Hallar la causa raiz (`superpowers:systematic-debugging`), no el sintoma.
3. Escribir primero un test que falle sin el arreglo; despues el arreglo.
4. Sumar la fila aca y cerrar el issue de origen con el enlace al PR.
5. Una vez por semana, juntar las filas parecidas en una regla (`ecc:rules-distill`).

Regla de formato del indice: las columnas se agregan o se renombran, nunca se les cambia el sentido.

| ID | Clase | Sintoma | Causa raiz | Guardia | PR | Fecha |
|----|-------|---------|------------|---------|----|-------|
| E01 | cache de CI | La publicacion de `main` frena con «Este push no tiene indice previo» (issue #24) | La key de la cache lleva el hash de `indexar.py`; un cambio del indexador deja al push sin indice | `tests/test_workflows.py::test_la_cache_del_indice_cae_a_cualquier_version` | #311 | 20/11/2026 |
| E02 | alarma repetida | La guardia del indice repite cada categoria como «sin ofertas» (issue #217) | Con 0 bajas propias en todo el indice, cada categoria disparaba su alarma | `tests/js/guardia.test.js::no se repite cada categoria` | #310 | 19/11/2026 |
| E03 | workflow invalido | `actualizar.yml` «No jobs were run» en 4 corridas (issue #10) | Clave repetida (`continue-on-error`) en el YAML | `tests/test_workflows.py::test_ningun_workflow_repite_una_clave` | #274 | 13/11/2026 |
| E04 | intermitente | Lighthouse falla en PR sin relacion con el cambio (issues #5, #6, #12, #16) | Chrome del runner no arranca a veces | `tests/test_lighthouse_reintento.py::test_reintenta_cuando_chrome_no_arranca_y_termina_bien` | — | 18/11/2026 |
| E05 | commit | Mensajes de commit con tildes o enies rompen la consola | Nadie lo miraba antes de commitear | `.claude/hooks/guardia.py::TILDES` | — | 01/11/2026 |
| E06 | issues | Issues de `la-pichincha-correo` abiertos semanas despues de arreglados | No habia regla de cierre | `CLAUDE.md::Cada issue de` | — | 20/11/2026 |
| E07 | worker celular | Sentry LA-PICHINCHA-4: `NetworkError: Load failed` en `js/ofertas-worker.js:6` en iPhone con red inestable | `importScripts` falla en top-level sin catch; el worker muere sin responder y dispara `window.onerror` | `tests/js/ofertas-worker-fallback.test.js::importScripts esta dentro de un try-catch` | — | 21/11/2026 |
| E08 | guardia | La misma alarma de categoria bloquea Telegram indefinidamente (issue #320) | `base()` preserva la ultima medicion limpia; cada corrida compara 0 vs esa base fija → alarma infinita | `tests/js/guardia.test.js::alarma repetida no bloquea segunda vez` | — | 22/11/2026 |
| E09 | cabeceras | Mozilla Observatory dio 55/100: faltaban HSTS, X-Frame-Options y X-Content-Type-Options (auditoria externa del 20/11) | GitHub Pages no deja poner cabeceras y el dominio estaba en Cloudflare solo como DNS (nube gris), asi que ninguna regla se aplicaba | `tests/test_verificar_publicacion.py::test_sin_cabeceras_de_seguridad_avisa` | — | 25/11/2026 |
| E10 | URL externa | El sitio apuntaba a `pichincha-afuera.mescudero-remitos-internos.workers.dev`, que ya no existe: el subdominio de workers.dev de la cuenta pasó a `mescudero` y fallaban la búsqueda Afuera y el formulario de contacto | Nadie comprobaba en vivo que `afuera_url` respondiera | `tests/test_verificar_publicacion.py::test_si_el_worker_no_responde_avisa_del_subdominio` | — | 25/11/2026 |
| E11 | script inyectado | Lighthouse «buenas practicas» 93 en `/?q=...`: error de CSP por `static.cloudflareinsights.com/beacon.min.js` | El proxy de Cloudflare inyecta Web Analytics en el HTML aunque el panel lo muestre apagado; nuestra CSP lo bloquea | `tests/test_verificar_publicacion.py::test_el_script_de_web_analytics_de_cloudflare_en_el_html_avisa` | — | 25/11/2026 |
