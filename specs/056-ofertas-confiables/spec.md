# 056 — Ofertas confiables

Revision completa del 01/11 contra el indice publicado el 31/10 13:36 (31.028 avisos; la pestaña Ofertas mostraba 111 y
`ofertas.json` 10). Regla del dueño: la oferta es contra el mismo modelo, y premium es por especificaciones reales, no por
marca (memoria `buscador-vision-del-dueno`). Cada arreglo tiene su test con filas reales (`tests/fixtures/ofertas/`).

Como se mide: `calcularOfertas` + `unico` (la lista de la pestaña) y `destacadas(idx, 10)` (`ofertas.json` y Telegram)
sobre `https://pichinchadeldia.com.ar/indice.json`, antes y despues de cada PR.

## 1. Repetidas (PR 1)

- La fuente ASUS Prime 750W Gold salio dos veces: Mexx («Fuente Asus Prime 750W 80 Plus Gold Modular», sin codigo de modelo,
  $149.999) y CompraGamer («… AP-750G …», 90YE00U1-B0SA00, $148.000). `ficha()` pedia un numero en el titulo.
  Ahora, en componentes y perifericos, el codigo que solo repite un dato («AP-750G» con 750 W) no cuenta, y sin numero en el
  titulo alcanzan tres datos («ASUS PRIME · 750 W · 80+ Gold · Modular»). Dos datos siguen sin alcanzar («KINGSTON · 1 TB»).
- El Corsair SCUF Envision Pro blanco y naranja de FullH4rd: `familia()` ya ignoraba blanco/negro/gris/azul/rojo; suma naranja,
  verde, acero, rosa, violeta, lila, amarillo, celeste, turquesa y grafito (y sus nombres en ingles). «Gold» no: es la
  certificacion de una fuente.
- Medido: la pestaña pasa de 111 a 109 (salen justo esas dos); `ofertas.json` deja de repetir la fuente.

## 7. Orden (PR 1)

- «Mayor descuento» (y los otros ordenes) ordenaba primero las bajas y despues las rebajas publicadas, asi que al cargar mas
  aparecian tarjetas de 26 % y 19 % detras de las de 3 %. Ahora es un solo orden; a igual valor, las bajas primero.

## 2. OnCity en masa (PR 2)

Pendiente.

## 4. Baja dudosa de Mercado Libre (PR 2)

Pendiente.

## 3. No es hardware (PR 3)

Pendiente.

## 5. Titulos y 6. Premium (PR 4)

Pendiente.
