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

- El 31/10 OnCity bajo casi toda su lista con el mismo porcentaje: 148 avisos −3 %, 62 −5 %, 28 −11 %, 15 −4 % (todos con
  `desde` = 31/10). Eran 58 de las 111 ofertas de la pestaña y 4 de las 10 de `ofertas.json`.
- Regla (`LOTE_MIN` en `js/ofertas.js`): diez o mas bajas de la misma tienda, con el mismo porcentaje entero y la misma fecha de
  cambio, son un cambio de lista y no ofertas (`enLote` cuenta las que habrian sido oferta). Medido el umbral: con 10 junta
  52 de OnCity y una cuna de ComparaYa; ninguna otra tienda tenia mas de 6 ofertas iguales. Contar ±1 punto juntaba
  bajas chicas reales de Venex, Gaming City y ComparaYa: se descarto.
- No se exige una semana de historia para «seguimiento»: el sello «k» es justo lo que tiene menos de una semana, y la
  regla de lote ya saca las 23 de OnCity.
- Medido: con esta regla la pestaña pasa de 109 a 57 (OnCity de 58 a 7: quedan la HP 250 −14 %, las Acer TravelMate −13 % y −9 %, la
  ThinkPad E14 −6 % y las Dell −10 %, que bajaron solas); `ofertas.json` pasa de 4 a 2 de OnCity.

## 4. Baja dudosa de Mercado Libre (PR 2)

- Auriculares Usotso SA-723 «−51 %» ($297.998 -> $147.053), pagina /p/ multivendedor; la verificacion de ML falla en 42/183.
- Las bajas propias de Mercado Libre topan en 40 %, como las de un agregador (`sospechosas`). Medido: sale solo la Usotso (57 -> 56 en la pestaña; deja `ofertas.json`).

## 3. No es hardware (PR 3)

- En «Otros» habia tabletas lavavajilla Sun, una desmalezadora, una cuna, un kit de destornilladores, una tira de LED, un
  sillon «gamer» y un smartwatch; y hardware mal clasificado: una motherboard, dos watercoolings, un kit de teclado y
  mouse y una Lenovo Yoga escrita «Ordenador Portátil» (con tilde).
- `categoriaDe()` (`js/categorias.js`): motherboard, placa madre y watercooling son componentes; «kit … teclado/mouse» es
  periferico; «portátil» con tilde es notebook.
- `esTecnologia()`: lo que queda en «otro» solo es oferta si nombra tecnologia (TV, tablet, consola, proyector, UPS, red,
  audio, almacenamiento, gabinete, procesador o placa). Antes, una lista negra para lo que nombra una consola sin serlo
  («Sillón Gamer Ideal P/ Playstation»). Se cuentan en `noTecnologia`. No cambia el buscador: solo las ofertas.
- Medido: la pestaña pasa de 56 a 46; «Otros» de 29 a 16, todo tecnologia. La motherboard (−15 %), un watercooling
  (−12 %) y la Yoga siguen como oferta, ahora en su rubro.

## 5. Titulos y 6. Premium (PR 4)

Pendiente.
