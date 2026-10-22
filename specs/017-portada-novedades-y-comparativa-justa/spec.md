# Feature Specification: Portada con novedades y comparativa justa por especificaciones

**Created**: 2026-10-21

**Status**: Fases 1 y 2 implementadas. Fase 3 implementada para «más buscados» (falta activar el token de GoatCounter); «más vendidos» sigue sin fuente de datos y no se inventa

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

1. **Más buscados (hecho, 21/10/2026; decisión del dueño: «usá las buenas costumbres en el uso de datos»)**. Sale de los conteos AGREGADOS que GoatCounter ya tiene (el sitio ya envía cada búsqueda como evento, sin cookies): `generar_buscadas.js` pide `GET /api/v0/stats/hits` (visitantes distintos por búsqueda, últimos 30 días) y `js/buscadas.js` deja pasar solo lo que no puede identificar a nadie. Buenas costumbres aplicadas: (a) **mínimo de personas distintas**: una búsqueda solo se publica si la hicieron al menos 5 (`MINIMO_VISITANTES`); (b) **solo productos**: el término tiene que devolver al menos 3 resultados en el catálogo, así el texto libre queda afuera; (c) **filtro de datos personales**: se descartan mails, direcciones web, teléfonos, números largos y palabras como DNI, CBU, CVU o contraseña (los dígitos de un producto, como «i7 14700 32gb», sí pasan); (d) **minimización**: lo que se escribe (`buscadas.json`) es solo la lista de términos, sin conteos, sin fechas y sin nada de quién buscó; el panel tampoco muestra conteos; (e) **defensa en profundidad**: `generar_portada.js` vuelve a pasar cada término por el filtro antes de ponerlo en la página, y los términos se escapan al pintarlos; (f) **token de solo lectura** guardado en los secretos de GitHub (`GOATCOUNTER_TOKEN`), que nunca se imprime; los errores del servicio se informan con el código, nunca con el cuerpo; (g) **sin token, sin catálogo o con cualquier fallo no se publica nada** y la portada sigue con las sugerencias fijas; (h) la política de privacidad (`/legal/#privacidad`) lo explica con el mismo mínimo y la misma ventana que usa el código. La portada muestra «Lo más buscado» primero (cada término abre su comparativa) y las sugerencias de Buscar usan la misma lista. **Para activarlo**: en GoatCounter (Configuración → API) crear un token con permiso solo de lectura de estadísticas y cargarlo con `gh secret set GOATCOUNTER_TOKEN` (nunca por el chat). El paso «Armar lo mas buscado» de `actualizar.yml` lo usa en la próxima publicación.
2. **Más vendidos**: hoy **no hay fuente de datos de ventas** en el índice ni en ninguna tienda que se lea. No se inventa. Se pide al dueño de dónde saldría (por ejemplo, un ranking que publique una tienda o un dato propio de ventas). Hasta que haya fuente, la portada muestra solo más buscados.

## Qué no entra

- Ranking de ventas inventado o estimado.
- Seguimiento de personas (cookies, IP, perfiles) para las búsquedas.
- Cambios al orden por defecto del buscador (spec 014): la portada usa su propio bloque.

## Plan por fases

1. **Fase 1 (hecha, 21/10/2026)**: comparación justa por especificaciones clave (decisión 1), con el aviso de pocos comparables. `js/especificaciones.js` (`clavesDe`, `mismas`, `resumen`) lee las claves del título; `Analisis.analizarConsulta` recibe una `referencia` y filtra; el banner de la Comparativa dice contra qué se compara. **Alcance real**: el botón «Comparar» de las **ofertas** pasa su tarjeta como referencia. La lista de **Buscar** también tiene su «Comparar con las mismas especificaciones» por fila (`compararFila(url)` en `js/historial.js`), solo cuando el título dice al menos dos especificaciones; el botón «Comparativa» de toda la consulta sigue comparando la búsqueda completa. La referencia no va en la URL: al recargar la página la comparativa vuelve a la búsqueda completa. Medido en el índice real (21/10): desde el monitor Samsung Odyssey G3 27" VA 180 Hz Full HD, la comparativa pasó de 25 avisos mezclados a 5 con exactamente esas especificaciones. Tests: `tests/js/especificaciones.test.js` (13).
2. **Fase 2 (hecha, 21/10/2026)**: portada con novedades premium y su comparativa directa (decisión 2). `js/novedades.js` elige, por categoría (celulares, notebooks, monitores y PCs armadas), hasta 3 equipos de lo más nuevo (`Modos.novedadDe`) y premium (`Premium.puntaje`) que pasan el mínimo de su gama, sin usados, internacionales ni el mismo modelo repetido, y los compara de frente: especificaciones clave (`Especificaciones.resumen`), precio y cuánto más caro es cada uno contra el más barato. Lo calcula el build (`generar_portada.js`, con el `indice.json` de la carpeta de salida o `--indice`) y lo incrusta como `NOVEDADES`; `vistaComparativa` lo antepone a la comparativa curada, y sin índice la portada sale como siempre. Cada fila tiene su «Comparar» (`compararFila`, fase 1). En el celular cada fila es una ficha apilada, sin scroll horizontal. Los monitores de modo dual muestran todas sus frecuencias («160 / 320 Hz»), no solo la mayor. Medido: Lighthouse local sin diferencia contra la portada anterior (83 contra 82; el runner de la CI mide 99). Tests: `tests/js/novedades.test.js` y `tests/js/portada.test.js`.
3. **Fase 3 (hecha para más buscados, 21/10/2026)**: ver la decisión 3.1. Tests: `tests/js/buscadas.test.js` (filtro de privacidad, umbral, solo productos, el script con GoatCounter simulado: paginación, token que no se imprime, errores sin cuerpo), `portada.test.js`, `novedades.test.js`, `filtros-ui.test.js` e `info.test.js`. «Más vendidos» queda pendiente de una fuente de datos (decisión 3.2). Además se corrigió un hueco de la fase 2: el build pre-renderiza la portada antes de copiar `datos/ganadores.json` a la salida, así que las novedades ahora leen los ganadores del repo si no están en la salida.

## Criterios de aceptación

- Un monitor 27" OLED de 300 Hz se compara solo con monitores 27" OLED de 300 Hz (o con la nota de «pocos avisos» si hay menos de 3).
- Una PC con 32 GB de RAM y 1 TB de SSD se compara solo con PC de 32 GB y 1 TB, del mismo procesador (familia y generación).
- La portada no muestra ningún producto que no llegue al mínimo de su gama.
- No hay búsquedas fijas en la portada cuando exista el dato de más buscados.
- `python -m unittest discover -s tests -t .` y `node --test tests/js/*.test.js` pasan, y los umbrales de `CONSTRAINTS.md` no se bajan.

## Preguntas abiertas para el dueño

1. ~~**Más buscados**~~ Resuelta el 21/10: sí, con agregación, mínimo de personas y filtro de datos personales (decisión 3.1). Falta que el dueño cree el token de solo lectura de GoatCounter y lo cargue como secreto.
2. **Más vendidos**: ¿de dónde sale el dato de ventas? Sin fuente, la portada muestra solo más buscados.
