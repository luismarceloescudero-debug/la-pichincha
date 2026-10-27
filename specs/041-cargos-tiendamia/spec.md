# Spec 041: Amazon que envía a Argentina y los cargos reales de Tiendamia

## Problema

1. **Amazon en «Buscalo afuera»** abre la búsqueda de amazon.com y, según el dueño, trae productos que dicen «No puede
   enviarse este producto al punto de entrega seleccionado».
2. **La referencia de Tiendamia** (spec 039/040) dice «un 17 % más con envío e impuestos incluidos». No es cierto: la ficha
   `/p/amz/...` trae `price` (USD de Tiendamia), `merchant_price` (USD de Amazon), `markup` y `weight`, pero **no** el envío
   internacional ni los servicios de importación. Esos aparecen solo en el carrito (`/checkout/cart`), que el `robots.txt` de
   Tiendamia **prohíbe**. El Worker no lee el carrito ni simula compras: no se esquiva.
3. No hay datos para saber cómo arma Tiendamia el envío y los servicios (¿por peso?, ¿un porcentaje?, ¿mínimos?).

## Qué se verificó en la fuente (27/10/2026)

- **Amazon** (Playwright contra amazon.com, entrega a Argentina tomada por la IP): la búsqueda muestra «Te estamos
  mostrando productos que se envían a Argentina» y en dos búsquedas (`soundcore aeroclip 2`, `power bank`) **0 de 22**
  resultados decían «No puede enviarse». La barra lateral no tiene un filtro de envío internacional / AmazonGlobal (los
  filtros son «Envío Gratis por Amazon», condición, marcas...); AmazonGlobal solo aparece como enlace del pie
  (`/gp/browse.html?node=20338496011`), que es una página informativa, no un filtro de búsqueda. **No hay un parámetro de
  URL verificado**: lo que decide qué se muestra es la dirección «Enviar a» de quien mira. El mensaje del dueño sale cuando
  su «Enviar a» no es Argentina (por ejemplo, una dirección de EE.UU. en su cuenta).
- **Tiendamia**: el detalle del carrito que pegó el dueño para el Soundcore AeroClip 2 (ficha `price` 198.88,
  `merchant_price` 169.98, `weight` 0.05): productos AR$ 371.667, envío internacional AR$ 9.278, servicios de importación
  AR$ 16.506, subtotal AR$ 397.451.

## Qué se decide

- **Amazon queda** en «Buscalo afuera», con el tag `lapichincha-20`, y su texto dice **«Muchos productos no se envían a
  Argentina»** y cómo verlo bien (elegir «Enviar a: Argentina»). No se agrega un parámetro dudoso a la URL.
- **Opción A**: debajo de la ficha de un link de Tiendamia, un campo «Pegá el detalle de la compra de Tiendamia». El texto
  pegado se parsea en el navegador (no sale a ningún lado) y muestra el total de Tiendamia desglosado y cuánto saldría
  comprado en Amazon con el mismo envío y servicios.
- **Opción C**: un mail para pedirle a Tiendamia autorización (o una API) para leer la cotización del carrito; lo manda el
  dueño (`docs/pendientes-del-dueno.md`, pendiente 10).
- **Base de datos de cargos** `datos/tiendamia-cargos.json`: una entrada por carrito que el dueño arma y pega, para buscar
  la regla del envío y de los servicios. Recién cuando una regla explique todos los casos (diciendo con cuántos) se puede
  proponer estimar sin carrito, y eso lo decide el dueño.
- La línea leída de Tiendamia **ya no dice** «un N % más con envío e impuestos incluidos» ni «con el envío incluido»: dice
  que el envío y los servicios aparecen en el carrito. Lo mismo en «Afuera, en vivo» (`js/afuera.js`).

## Requisitos funcionales

- **R1** El enlace de Amazon en «Buscalo afuera» sigue siendo `https://www.amazon.com/s?k=<término>&tag=lapichincha-20`
  (sin parámetros de filtro no verificados) y su texto dice «Muchos productos no se envían a Argentina».
- **R2** `parsearDetalleTiendamia(texto)` devuelve `{ cantidad, productos, envio, servicios, subtotal }` en pesos, o `null`
  si no encuentra al menos productos. Aguanta saltos de línea, «tooltip», tildes o no, mayúsculas, miles con punto,
  decimales con coma y el texto de alrededor («Comenzar compra», «Ingresar cupón...»). Si falta el subtotal, es la suma.
- **R3** `referenciaCarrito(detalle, item)` arma la línea: «Tiendamia: AR$ T en total (producto P + envío E + servicios de
  importación S). Comprado en Amazon saldría aprox. AR$ A (US$ M al dólar de Tiendamia + el mismo envío y servicios).
  Aproximado: revisalo antes de pagar.» Con `dólar implícito = P / (price × cantidad)` y `A = merchant_price × cantidad ×
  dólar + E + S`. Sin `price` o sin `merchant_price` leídos, solo la primera frase y el «Aproximado».
- **R4** El campo aparece solo en la ficha de un link de Tiendamia; usa lo que el Worker leyó de ese link.
- **R5** La línea leída de Tiendamia no dice «% más» ni «envío incluido».
- **R6** `datos/tiendamia-cargos.json` tiene forma fija (test): `fecha`, `url`, `categoria` (una de `js/categorias.js`),
  `nombre`, `price`, `merchant_price`, `markup`, `weight`, `productos`, `envio`, `servicios`, `subtotal`, `dolar`; y
  `subtotal = productos + envio + servicios`, `dolar = productos / price` (redondeado a 2).

## Criterios de éxito

- Pegar el detalle del ejemplo debajo de la ficha del AeroClip 2 muestra AR$ 397.451 y aprox. AR$ 343.4xx en Amazon.
- `node --test tests/js/*.test.js` y `python -m unittest discover -s tests` en verde.
- El dueño tiene un link de Tiendamia por categoría para armar carritos, y el mail redactado.

## Fuera de alcance

- Leer el carrito desde el Worker (lo prohíbe el `robots.txt`).
- Estimar envío y servicios sin carrito: hasta que la base tenga una regla que explique todos los casos.
