# Spec 041 — Los cargos de Tiendamia: datos y lo que se ve

La base es `datos/tiendamia-cargos.json` (una entrada por carrito que arma y pega el dueño; forma en
`tests/js/tiendamia-cargos.test.js`). Acá va la tabla y lo que se puede decir con ella. **Ninguna regla se propone para
estimar sin carrito hasta que explique todos los casos, diciendo con cuántos.**

## Carritos cargados

| Fecha | Producto | Cat. | price US$ | merchant US$ | markup (regla) | kg | Productos AR$ | Envío AR$ | Servicios AR$ | Subtotal AR$ | Dólar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 27/10 | Soundcore AeroClip 2 | periférico | 198,88 | 169,98 | 28,9 (150-175 USD - USA) | 0,05 | 371.667 | 9.278 | 16.506 | 397.451 | 1.868,80 |

Con una sola entrada no se ve ninguna regla. Solo cuentas: el envío es el 2,5 % de productos y los servicios el 4,4 %;
en dólares de Tiendamia, envío ≈ US$ 4,96 y servicios ≈ US$ 8,83.

## Lo que ya dice la ficha (sin carrito)

La ficha `/p/amz/...` trae, dentro de `pricing_rules`, la regla del **markup** (la diferencia entre el precio de
Tiendamia y el de Amazon) y, en `category_information`, la **categoría aduanera**. Leídas el 27/10/2026:

| Producto | merchant US$ | markup US$ | % | Regla |
|---|---|---|---|---|
| Soundcore AeroClip 2 | 169,98 | 28,90 | 17,0 | 150-175 USD - USA |
| Moto G 2025 | 163,40 | 27,78 | 17,0 | 150-175 USD - USA |
| Moto G Play | 112,09 | 19,06 | 17,0 | 100-125 USD - USA |
| Anker power bank 20.000 mAh | 69,98 | 11,20 | 16,0 | 50-75 USD - USA |
| Samsung 990 PRO 1 TB | 259,84 | 25,98 | 10,0 | 250-275 USD - USA |
| Beelink SER3 | 298,00 | 29,80 | 10,0 | 275-300 USD - USA |
| Acer Aspire 3 | 353,99 | 17,70 | 5,0 | 350-380 USD - USA |
| Logitech G305 | 26,99 | 0,81 | 3,0 | Category Markup Game Hardware - 0+ - USA |
| Samsung 27" S3 | 99,99 | 1,00 | 1,0 | Category Markup Monitors & Accessories - 0+ - USA |
| Anker USB-C Hub (docking) | 79,99 | 0,80 | 1,0 | Category Markup Networking Products - 0+ - USA |

O sea: el markup va por **tramos del precio de Amazon** (el porcentaje baja a medida que sube el precio) y algunas
categorías tienen su propia regla. El markup ya está en `price`; el envío y los servicios del carrito van aparte.

## Carritos que faltan: un link por categoría

Productos de Amazon (`/p/amz/`) buscados en `tiendamia.com.ar/search/amazon/...` el 27/10/2026, con pesos de 0,1 a
5,85 kg para ver el envío contra el peso. El dueño agrega cada uno al carrito y pega el «Detalle de la compra»; con cada
pegado se vuelve a leer la ficha (el precio cambia) y se suma la entrada.

| Categoría | Producto | price US$ | kg | Link |
|---|---|---|---|---|
| smartphone | Moto G 2025 | 196,17 | 0,40 | https://tiendamia.com.ar/p/amz/b0dnrk51qq/moto-g-2025-desbloqueado-hecho-para-us |
| notebook | Acer Aspire 3 A315-24P | 386,74 | 3,05 | https://tiendamia.com.ar/p/amz/b0bs4bp8fb/acer-aspire-3-a315-24p-r7vh-laptop-delgada-full-hd-de |
| monitor | Samsung 27" S3 (S32GF) | 100,99 | 5,85 | https://tiendamia.com.ar/p/amz/b0f8dy4qkq/samsung-27-s3-s32gf-series-fhd-monitor-de-alta-resolucion |
| pc | Beelink SER3 mini PC | 327,80 | 0,93 | https://tiendamia.com.ar/p/amz/b09syspssm/beelink-ser3-mini-pc-amd-ryzen-3-3200u-2c-4t-16g |
| componente | Samsung 990 PRO 1 TB | 285,82 | 0,10 | https://tiendamia.com.ar/p/amz/b0bhjf2vrn/samsung-ssd-990-pro-1tb-pcie-4-0-m-2-2280-hasta |
| periférico | Logitech G305 | 27,80 | 0,28 | https://tiendamia.com.ar/p/amz/b07cms5q6p/logitech-g-raton-inalambrico-para-juegos-305-lightspeed-negro |
| otro | Anker USB-C Hub (docking dual monitor) | 80,79 | 0,46 | https://tiendamia.com.ar/p/amz/b0h36fv12q/anker-usb-c-hub-smart-display-hub-docking-station-dual |

El primer «otro» era el power bank Anker 20.000 mAh (B0CXDXP8VR, US$ 81,18, 0,43 kg): el carrito lo rechazó con
«NO PERMITIDO · ADUANA» («este producto no puede ingresar al país por restricciones de aduana», 27/10/2026). Las baterías
sueltas no pasan; la ficha no lo avisa. Se cambió por un hub USB-C de Anker de precio y peso parecidos, sin batería.

Pares útiles para separar efectos: el Moto G 2025 y el AeroClip 2 tienen casi el mismo precio y distinto peso (0,40 y
0,05 kg); el monitor es barato y pesado; el SSD es caro y liviano.

## Qué se busca con los datos

- **Envío** contra `weight` (¿por kilo?, ¿mínimo?, ¿tramos?) y contra la categoría aduanera.
- **Servicios de importación** contra `price`, `productos` o `productos + envío` (¿porcentaje fijo?, ¿mínimo?, ¿tramos?,
  ¿depende de la categoría aduanera?).
- Si el **dólar implícito** (productos / price) es el mismo en todos los carritos del mismo día.
