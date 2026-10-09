# Quickstart: validar la feature

1. `python -m unittest discover -s tests -t .` y `node --test "tests/js/*.test.js"`: todo verde.
2. `python publicar_app.py --salida _sitio`: deja `sw.js` con la version estampada, el manifiesto, `sin-red.html` y los iconos.
3. Servir `_sitio/` y abrirlo en un navegador compatible: el menu ofrece instalar; no aparece ningun cartel propio.
4. Instalar y abrir desde el icono: ventana propia, nombre, icono y color (SC-001).
5. Con DevTools en "Sin conexion", recargar: abre la principal con el aviso y la fecha de los precios (SC-002).
6. Con conexion, comprobar que los precios son los nuevos y no hay aviso (SC-003).
7. Publicar un cambio visible, abrir la app dos veces y verlo (SC-004).
8. Medir el peso de la cache (SC-005) y confirmar el evento `app/instalada` en GoatCounter.
