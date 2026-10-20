# Feature Specification: Importar desde la búsqueda

**Created**: 2026-10-20

**Status**: Implementada en un PR (precarga desde la tarjeta, sección «Importando»); ver `docs/plan-buscador.md`

**Input**: Pendiente del dueño tras la spec 014: que una compra internacional que aparece en la búsqueda lleve directo a la calculadora de costos con su precio cargado, y que la pestaña «Costo de importar» diga dónde comprar afuera (Loquieroaca, Tiendamia, Amazon).

## Decisiones

### 1. «Calcular con este precio» precarga la calculadora

1. En la tarjeta de un aviso internacional con estimación de costo puesto en casa (`js/puesto.js`), el enlace que decía «Calcular con tus datos» (un `#costo` vacío) pasa a **«Calcular con este precio»**: abre la pestaña con el precio del aviso ya cargado.
2. El precio se pasa en **dólares al dólar oficial**, igual que la estimación de la tarjeta (`fobUsd`), con la moneda `USD` y redondeado a centavos. No se convierte nada más: la calculadora ya sabe leer esos parámetros de la URL (`v`, `m`).
3. Se precarga **un peso típico por rubro** (`Importar.PESO_TIPICO`: celular 0,3 kg, notebook 2,5, PC 8, monitor 6, componente 1, periférico 0,5, otro 1). Es una estimación para que el campo no quede vacío; la persona lo cambia. **No es una regla**: `importacion.json` solo fija el tope de 50 kg por paquete (`peso_max_kg`).
4. **Las dimensiones no se precargan**: ninguna regla de `importacion.json` las usa, así que cargarlas sería un dato sin efecto.
5. Si no hay estimación válida (faltan reglas o cotización), el enlace queda como antes: `#costo` sin datos.

### 2. La pestaña «Costo de importar» dice dónde comprar afuera

1. Debajo de la calculadora hay una sección **«Importando: dónde comprar afuera»** con tres enlaces (`Importar.FUENTES`): Amazon (EE.UU.), Tiendamia y Loquieroaca. Cada uno con una línea de qué esperar.
2. **Solo son enlaces.** No leemos esas tiendas ni sacamos precios de ellas: Tiendamia y Loquieroaca bloquean al lector (403) y no se esquiva (ver `docs/referencias.md`). La sección lo dice en el texto.
3. **Amazon** es el único enlace de afiliado: lleva `tag=lapichincha-20`, se rotula «(enlace de afiliado)» y tiene `rel="sponsored"`. Sin scraping de Amazon.
4. Tiendamia y Loquieroaca se enlazan **sin tag** y sin prometer cómo cobran impuestos: la línea pide revisar el resumen de compra antes de pagar.

## Qué no entra

- Leer precios de Tiendamia o Loquieroaca, o compararlos con la búsqueda: hacen falta un feed o un programa de afiliados (pedido enviado el 16/10/2026, sin respuesta).
- Dimensiones, flete real y honorarios del courier: no son reglas firmes en `importacion.json` (ver `honorarios_courier` y `percepciones_courier` pendientes).
- Un «precio final» de cada intermediario: no lo publican en un formato que podamos leer.

## Pruebas

- `tests/js/importar.test.js`: cada rubro tiene peso; el estado precargado y su redondeo; el enlace `#costo` se lee de vuelta con `Calculadora.estadoDeUrl`; solo Amazon lleva el tag; las fuentes son https.
- La suite JS (454) y los tests de sitio, build, páginas y publicación de la app pasan.
- Verificado en el navegador: `index.html?v=250&m=USD&p=0.3#costo` carga el formulario con esos valores y muestra la sección con los tres enlaces (Amazon con `rel="sponsored noopener"`).
