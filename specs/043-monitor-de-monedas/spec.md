# Spec 043: monitor de monedas y conversión a pesos

## Problema

El dueño (28/10/2026): «sumar un monitor en vivo del USD, EUR, ARS para tener referencia, y que la misma app vaya
convirtiendo a moneda local». Desde la spec 042 el detalle pegado de Amazon o eBay queda en dólares (o euros) y su «Total
en pesos» dice «sin cotización».

## Antecedente

`js/monedas.js` existió desde la spec 010 (K2: dolarapi.com para el dólar, open.er-api.com y frankfurter.dev para las demás
monedas, con una copia `cotizaciones.json` que escribía el build) y se borró con la calculadora en la spec 040
(`git log --all -- js/monedas.js`: `4bc088d`, `8834f62`). Esta spec vuelve a crearlo, más chico: solo lo que el monitor y
la conversión necesitan, y **sin copia guardada**.

## Fuente

**DolarApi** (`https://dolarapi.com`), pública, gratuita, sin clave y con `Access-Control-Allow-Origin: *` (verificado el
28/10/2026 con `curl -I`):

- `GET /v1/dolares`: un arreglo con `casa` (`oficial`, `blue`, `bolsa`, `contadoconliqui`, `mayorista`, `cripto`,
  `tarjeta`), `compra`, `venta` y `fechaActualizacion`.
- `GET /v1/cotizaciones/eur`: el euro oficial (`moneda: "EUR"`, `venta`, `fechaActualizacion`).

Se suma `https://dolarapi.com` al `connect-src` de la CSP (`sitio.json` e `index.html`).

## Qué dólar usar para comprar afuera (lo decide el dueño)

El monitor muestra **tarjeta, MEP y oficial** (valor de venta) y el **euro**, cada uno con su hora. Para pasar a pesos
se elige uno, y queda recordado en ese navegador:

- **Tarjeta (por defecto)**: lo que cobra el banco al pagar con tarjeta en pesos en una tienda del exterior (Amazon,
  eBay): el oficial más las percepciones. Es el caso más común de quien compra en Amazon o eBay.
- **MEP**: la referencia si se paga con dólares propios (comprados en la bolsa) o con una tarjeta en dólares.
- **Oficial**: el del banco, sin percepciones; sirve como referencia, no es lo que se paga con tarjeta.

El blue, el contado con liqui, el mayorista y el cripto no se ofrecen: no son lo que se cobra en una compra con tarjeta.
Si el dueño prefiere otro por defecto, se cambia `POR_DEFECTO` en `js/monedas.js`.

**Euros**: euro en pesos = euro oficial ÷ dólar oficial × el dólar elegido (el cruce oficial que publica DolarApi). Con el
dólar oficial es el euro oficial tal cual.

## Requisitos funcionales

- **R1** `js/monedas.js` (puro): `normalizar(dolares, eur)` se queda con tarjeta, MEP (`bolsa`) y oficial con venta
  positiva y el euro; sin ningún dólar útil, `null`. Nada se inventa.
- **R2** `cotizacion(tasas, moneda, tipo)` → `{ valor, nombre, fuente, hora }` para `filasDetalle` (spec 042), o `null`
  si falta el dato. La hora es la de Argentina, con la fecha si no es de hoy, y dice «vieja» si tiene más de 96 horas.
- **R3** `monitorHtml(tasas, { esc, tipo, cargando })`: «Monedas en vivo», la fuente, los tres dólares y el euro con su
  hora, y la elección del dólar (radios, tarjeta marcado por defecto). Sin tasas: «Consultando la cotización…» mientras
  pide, y «Sin cotización: DolarApi no respondió. Los totales en dólares o euros no se pasan a pesos.» si falló.
- **R4** El monitor va arriba de «Pegá el link» (`pegarLinkHtml` trae `<div class="pl-monedas">`). `js/vista-afuera.js`
  pide DolarApi cuando aparece el bloque (una vez cada 10 minutos como mucho; un fallo se reintenta al volver a pintarlo)
  y repinta el desglose al llegar la cotización o al cambiar de dólar.
- **R5** Si DolarApi no responde, el total en pesos de un desglose en dólares o euros dice «sin cotización»: no se usa un
  valor anterior sin decirlo.
- **R6** La fila «Total en pesos» cita la cotización usada: «a AR$ 2.028 (dólar tarjeta, 14:00, DolarApi)».

## Criterios de éxito

- Con el checkout real de Amazon (US$ 210,45) y el dólar tarjeta a $ 2.028, el total en pesos es AR$ 426.793.
- `node --test "tests/js/*.test.js"` y `python -m unittest tests.test_sitio` en verde.

## Fuera de alcance

- Una copia de las cotizaciones escrita por el build (la tenía la spec 010): si DolarApi cae, se dice y no se convierte.
- Otras monedas (libra, real, peso mexicano de los Amazon de otros países).
