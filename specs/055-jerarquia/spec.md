# 055 — Jerarquia visual: no todo pesa igual

Pedido del dueño (31/10): mas contraste entre titulos, caracteristicas y precios; bloques de color solido que hagan de
transicion entre productos sin cansar la vista; precios y porcentajes mas grandes en algunos. Aplica a la web
(pestaña Ofertas y /hoy/) y a Telegram. Hecho con las skills impeccable (critique), refactoring-ui y squirrelscan.

## Diagnostico (capturas en `privado/diseno/antes/`)

- Todas las tarjetas pesaban igual: mismo tamaño de precio (1,45 rem, verde), mismo anillo de porcentaje, mismo borde.
- Los botones «Abrir / afiliado / Comparar» se cortaban contra el borde de la tarjeta.
- Telegram: una lista de lineas planas «N. emoji titulo · chips: $precio (−X%) en tienda», todo con el mismo peso.
- squirrel (CLI 0.0.150, `--level quick`) contra el sitio publicado: 79 (C); accesibilidad 75, rendimiento 68, seguridad 46.

## Reglas

1. **Tres pesos por descuento** (`js/indice-ofertas.js`: `cortesDe`, `nivelOferta`). Relativo a la lista que se ve: las 6 mejores
   son **heroe**, las siguientes (el 20 %, al menos 4 mas) son **fuerte**, el resto **normal**. Pisos: 20 % y 15 %; un dia
   flojo no pinta estrellas.
   - heroe: bloque de color solido (`--bloque`, texto blanco), precio de 2,35 rem y porcentaje en una pastilla blanca grande.
   - fuerte: precio de 1,85 rem en verde, anillo mas grande y borde verde.
   - normal: precio de 1,2 rem en tinta (el verde queda para lo que ahorra mucho), anillo de 50 px, nombre sin negrita fuerte.
2. **Bandas de transicion**: cada 8 tarjetas, un bloque de color a todo el ancho (`.o-banda`, azul y violeta alternados) con el
   rango de descuentos de lo que sigue. Es decorativa (`aria-hidden`): el dato esta en cada tarjeta. Los indices de las tarjetas
   (`data-comparar-oferta`, ids de detalle) no cambian.
3. **/hoy/**: la de mayor descuento de la tarjeta es un bloque solido con el porcentaje grande (`.h-top`, `generar_feed.js`).
4. **Telegram** (`publicar_telegram.py`): la de mayor descuento va como «LA MEJOR DEL DÍA» entre dos barras de 🟩, con
   precio y porcentaje en negrita en su linea; el resto en `<blockquote>` compactos, caracteristicas en cursiva, 🔥 desde 30 %
   y ⚡ desde 20 %. Sigue el limite de 4096 (se sacan bloques del final) y conserva el rotulo de afiliado y el «contra» de
   las ofertas contra el mismo modelo.
5. Contraste: los bloques llevan colores propios (no los del tema) para que el texto blanco pase AA en claro y en oscuro
   (`--bloque` #0f5132 ≈ 9:1, `--banda-0` #0b3b9c, `--banda-1` #4c1d95).

## Verificacion

- Tests: `tests/test_publicar_telegram.py` (formato, una sola destacada, limite), `tests/js/ofertas-ui.test.js` (cortes con pisos,
  bandas e indices intactos). Suites completas y e2e (20) en verde.
- Capturas despues en `privado/diseno/despues/` (celular y escritorio, claro y oscuro).
- Pendiente de medir: squirrel contra el sitio ya publicado (el «antes» es 79).
- Conocido y anterior a este cambio: la tarjeta 9:16 de /hoy/ desborda a 360 px de ancho (627 contra 567); con la destacada suma ~30 px.
