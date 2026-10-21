# Feature Specification: Portada con novedades y comparativa justa por especificaciones

**Created**: 2026-10-21

**Status**: Fase 1 implementada (comparación justa por especificaciones clave). Fases 2 y 3 pendientes de dos decisiones del dueño (ver «Preguntas abiertas»)

**Input**: Pedido del dueño el 21/10/2026, en dos puntos. (1) La portada arranca con búsquedas fijas (webcams, RAM, SSD) que escribimos a mano en `js/indice-ofertas.js` (`SUGERIDAS`), no con lo que se busca de verdad. (2) Al elegir una tarjeta (por ejemplo un monitor 27" OLED de 300 Hz, o una PC con 32 GB de RAM y 1 TB de SSD), la comparación se hace con toda la familia o categoría y no con las mismas especificaciones. Decisión del dueño: **la comparación se arma a partir de las novedades** (lo último en tecnología y las especificaciones premium) y eso aparece **ya en la portada, con su comparativa directa**. Más buscados y más vendidos, por igual.

## Decisiones

### 1. La comparación justa: solo contra avisos con las mismas especificaciones clave

1. Al elegir un aviso, la comparativa compara solo contra avisos que coinciden en las **especificaciones clave** de su categoría. Si una especificación no está en el título, no se afirma que coincide.
2. Especificaciones clave por categoría (se extienden las que ya existen en `js/analisis.js`, que hoy compara por capacidad):
   - **Monitor**: tamaño, tipo de panel (OLED, QD-OLED, IPS, VA), frecuencia de refresco y resolución.
   - **Notebook y PC completa**: procesador (familia y generación), RAM, almacenamiento y GPU.
   - **Componentes de memoria y almacenamiento**: capacidad, interfaz o tipo (DDR4/DDR5, SATA/NVMe) y velocidad.
   - **Celular**: RAM, almacenamiento y chip.
3. Si hay menos de **3 avisos** con las mismas especificaciones, la comparativa **lo dice** («hay pocos avisos con esta configuración; esto es lo más parecido») y muestra la diferencia en vez de mezclar familias. No se llena con otras familias sin avisar.
4. Se muestra qué especificaciones coinciden y cuáles no, en la fila (por ejemplo «OLED 27" 300 Hz · coincide: tamaño, panel, Hz»).

### 2. La portada: novedades y premium con su comparativa directa

1. La portada muestra, por categoría, las **novedades premium**: lo último que hay a la venta (`Modos.novedadDe`, spec 013) con mejor puntaje premium (`Premium.puntaje`, spec 014). Cada una con su comparativa directa (decisión 1).
2. Un producto solo aparece si pasa el **mínimo de su gama** (`Categorias.evaluar(...).pasa`, spec 014). Lo que no llega al mínimo no entra en la portada, igual que en los modos del buscador.
3. Las búsquedas sugeridas dejan de ser una lista fija: se reemplazan por las más buscadas (decisión 3).

### 3. Más buscados y más vendidos

1. **Más buscados**: se cuentan las búsquedas que hace la gente, de forma **agregada** (texto de la búsqueda y cantidad, sin identificar a nadie, sin guardar la IP ni cookies de seguimiento). Requiere decidir el mecanismo de conteo y actualizar la política de privacidad (`/legal/`). **Pendiente de decisión del dueño.**
2. **Más vendidos**: hoy **no hay fuente de datos de ventas** en el índice ni en ninguna tienda que se lea. No se inventa. Se pide al dueño de dónde saldría (por ejemplo, un ranking que publique una tienda o un dato propio de ventas). Hasta que haya fuente, la portada muestra solo más buscados.

## Qué no entra

- Ranking de ventas inventado o estimado.
- Seguimiento de personas (cookies, IP, perfiles) para las búsquedas.
- Cambios al orden por defecto del buscador (spec 014): la portada usa su propio bloque.

## Plan por fases

1. **Fase 1 (hecha, 21/10/2026)**: comparación justa por especificaciones clave (decisión 1), con el aviso de pocos comparables. `js/especificaciones.js` (`clavesDe`, `mismas`, `resumen`) lee las claves del título; `Analisis.analizarConsulta` recibe una `referencia` y filtra; el banner de la Comparativa dice contra qué se compara. **Alcance real**: el botón «Comparar» de las **ofertas** pasa su tarjeta como referencia. La lista de **Buscar** no tiene un botón «Comparar» por fila, solo el de toda la consulta («Comparativa»), que sigue comparando la búsqueda completa; cuando se agregue uno por fila, usa `compararConsulta(q, fila)`. La referencia no va en la URL: al recargar la página la comparativa vuelve a la búsqueda completa. Medido en el índice real (21/10): desde el monitor Samsung Odyssey G3 27" VA 180 Hz Full HD, la comparativa pasó de 25 avisos mezclados a 5 con exactamente esas especificaciones. Tests: `tests/js/especificaciones.test.js` (13).
2. **Fase 2**: portada con novedades premium y su comparativa directa (decisión 2), en el mismo lugar que hoy tienen las sugerencias.
3. **Fase 3**: más buscados, cuando el dueño decida el conteo y la política de privacidad (decisión 3.1). Más vendidos, cuando haya fuente (decisión 3.2).

## Criterios de aceptación

- Un monitor 27" OLED de 300 Hz se compara solo con monitores 27" OLED de 300 Hz (o con la nota de «pocos avisos» si hay menos de 3).
- Una PC con 32 GB de RAM y 1 TB de SSD se compara solo con PC de 32 GB y 1 TB, del mismo procesador (familia y generación).
- La portada no muestra ningún producto que no llegue al mínimo de su gama.
- No hay búsquedas fijas en la portada cuando exista el dato de más buscados.
- `python -m unittest discover -s tests -t .` y `node --test tests/js/*.test.js` pasan, y los umbrales de `CONSTRAINTS.md` no se bajan.

## Preguntas abiertas para el dueño

1. **Más buscados**: ¿te sirve contar búsquedas de forma agregada (texto y cantidad, sin identificar a nadie)? Eso cambia la política de privacidad. ¿Sí o no?
2. **Más vendidos**: ¿de dónde sale el dato de ventas? Sin fuente, la portada muestra solo más buscados.
