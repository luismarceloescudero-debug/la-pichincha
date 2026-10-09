# Quickstart: validar la feature

1. `python -m unittest discover -s tests -t .` y `node --test "tests/js/*.test.js"`: todo verde.
2. `python generar_paginas.py --indice indice.json --salida _sitio`: crea `_sitio/precios/ssd-1tb/index.html`, `_sitio/precios/index.html`, `sitemap.xml` y `robots.txt`.
3. Abrir una pagina con scripts desactivados: se ve el contenido completo (SC-002).
4. Comparar la mejor compra y la mediana con `/?q=ssd+1tb#comparativa` (SC-004).
5. Pasar 5 paginas por el validador de datos estructurados de Google (SC-003).
6. Capturas en tema claro, oscuro y telefono (SC-006).
7. Tras publicar: alta del sitemap en Search Console y Bing (la hace el dueño).
