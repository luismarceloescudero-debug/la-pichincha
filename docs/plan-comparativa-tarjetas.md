# Plan: Comparativa en una tarjeta por pantalla y Pichinchas del día (14/11/2026)

Pedido del dueño (captura del 14/11): (1) la tarjeta grande de «Pichinchas del día» destacaba un mousepad de $7.990 (−27 %)
y dos notebooks Acer TravelMate de la misma línea ocupaban dos lugares; (2) la Comparativa en el celular es un scroll
infinito de productos: quiere **una tarjeta grande por pantalla**, números y rasgos premium grandes, miniatura del producto,
gestos para pasar de tarjeta y para seguir un producto, etiquetas flotantes para cambiar de sección. Fuera de la Comparativa
no hace falta cambiar nada. Maqueta aprobada: video de Remotion del 14/11 (no está en el repo).

Decisiones del dueño: seguimiento **solo en el celular** (sin cuenta ni avisos); dos PRs separados (Pichinchas primero, porque
publica); **3 lugares por categoría principal** en las Pichinchas.

## Fase 1 — Pichinchas del día (HECHA en la rama, falta PR)
- `js/ofertas.js`: `puntaje` (ahorro en pesos × peso de categoría × bono de gama alta), `mejorDelDia`, `linea` y `unaPorLinea`
  (una oferta por línea de equipo: celulares, notebooks, PCs, monitores; componentes y periféricos no se agrupan).
  El % solo desempata. La cinta «Súper oferta» sigue pidiendo 20 % o más; si no, «La mejor del día».
- `js/categorias.js`: `CUPO.reservado` de 2 a 3 (tres lugares por categoría principal).
- `generar_feed.js` (/hoy/), `generar_vista_hoy.js` (imagen) y `publicar_telegram.py` (mensaje) usan el mismo criterio;
  `listaParaCanal` suma `nivel`. Tests: `tests/js/ofertas.test.js`, `feed.test.js`, `vista-hoy.test.js`, `tests/test_publicar_telegram.py`.
- **Antes del PR**: correr `/medir-indice` (cuántas ofertas, repetidas y premium cambian contra el índice publicado) y mirar
  los correos e issues de la regla «Correos antes de publicar» del CLAUDE.md. No se hizo en esta sesión.

## Fase 2 — Carrusel de la Comparativa (HECHA la primera versión, falta PR)
- `js/carrusel.js` (nuevo): lógica pura probada en Node (`gesto`, `mover`, `diferencia`, seguidos en localStorage) y comportamiento
  del navegador (scroll-snap nativo, deslizar arriba = ficha, mantener = seguir con vibración, etiquetas flotantes, teclado).
  Todo gesto tiene su botón.
- `js/consulta.js`: `cardGrande`, `vistaComparativaCarrusel`; con pantalla chica y táctil se usa el carrusel, si no la grilla de siempre.
- `css/sitio.css`: sección «Comparativa en el celular»; el tamaño se mide contra la tarjeta (container queries) para que
  entre entera en el alto visible, en un celular chico y en uno grande.
- Tests: `tests/js/carrusel.test.js`, `tests/e2e/carrusel.spec.js` (móvil 412×915). Verificado a mano en 412×915 y 360×640.

## Pendiente (no hecho todavía)
1. **PRs**: no se abrió ninguno (lo decide el dueño). Dos ramas o PRs: Fase 1 y Fase 2.
2. **Probar en un celular real**: los gestos con el dedo (mantener apretado y deslizar arriba) solo se probaron con eventos de puntero
   emulados. Mirar sobre todo que deslizar arriba no choque con el scroll de la página.
3. **Fotos reales**: el índice publicado va sin fotos (spec 057); la miniatura es el ícono de la categoría, como en las otras pestañas.
4. **Sección «Dónde»** del video: hoy está dentro de «Tiendas» (precio por tienda + ranking de comercios).
5. **Skills**: `web-design-guidelines` y `web-quality-audit` están en `skills-lock.json`, pero su carpeta `.agents/` no se commitea;
   hace falta reinstalarlas en cada clon. `impeccable` ya está en `.claude/skills/` (commit 0052bc7) y su hook de diseño quedó activo.
   Falta pasar `critique` de impeccable sobre la vista y una auditoría de accesibilidad con lector de pantalla.
6. Lista de seguidos: simple, sin orden ni avisos de baja (la decisión del dueño fue solo local).
