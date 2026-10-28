# Spec 041 — Los cargos de Tiendamia: datos y lo que se ve

La base es `datos/tiendamia-cargos.json` (una entrada por carrito que arma y pega el dueño; forma en
`tests/js/tiendamia-cargos.test.js`). Acá va la tabla y lo que se puede decir con ella. **Ninguna regla se propone para
estimar sin carrito hasta que explique todos los casos, diciendo con cuántos.**

## Carritos cargados (22, todos del 27/10/2026)

Montos en AR$. «Imp.» es «IVA e impuestos internos» (en el celular, «+ Aranceles y gestión aduanera»); «Local» es «Envío
Estándar a tu dirección». El AeroClip se armó sin dirección cargada: su carrito no mostraba ni el IVA ni el envío local.

| Producto | Cat. | Cant. | price US$ | kg (total) | Aduana | Productos | Envío int. | Servicios | Imp. | Local | Total | Dólar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Soundcore AeroClip 2 | periférico | 1 | 198,88 | 0,05 | AURICULARES | 371.667 | 9.278 | 16.506 | — | — | 397.451 | 1.868,80 |
| Moto G 2025 | smartphone | 2 | 197,72 | 0,80 | CELULARES | 732.435 | 9.250 | 35.569 | 267.023 | 22.231 | 1.066.508 | 1.852,20 |
| Acer Aspire 3 | notebook | 1 | 386,74 | 3,05 | COMPUTADORAS | 714.089 | 9.250 | 143.366 | 77.168 | 22.231 | 968.353 | 1.846,43 |
| Samsung 27" S3 | monitor | 1 | 100,99 | 5,85 | ACC. COMPUTADORA | 187.061 | 9.250 | 267.824 | 41.225 | 22.231 | 527.590 | 1.852,27 |
| Beelink SER3 | pc | 1 | 327,80 | 0,93 | COMPUTADORAS | 607.160 | 9.250 | 49.129 | 65.687 | 22.231 | 753.456 | 1.852,23 |
| Samsung 990 PRO 1 TB | componente | 1 | 285,99 | 0,10 | ACC. COMPUTADORA | 529.719 | 9.250 | 6.661 | 113.180 | 22.231 | 681.041 | 1.852,23 |
| Logitech G305 | periférico | 1 | 27,80 | 0,28 | VIDEOJUEGOS | 51.497 | 9.250 | 12.895 | 12.759 | 22.231 | 108.632 | 1.852,41 |
| Anker USB-C Hub | otro | 1 | 80,79 | 0,46 | ACC. COMPUTADORA | 149.635 | 9.250 | 20.442 | 33.371 | 22.231 | 234.929 | 1.852,15 |
| Patriot Viper Steel DDR4 16 GB | componente | 1 | 138,05 | 0,09 | ACC. COMPUTADORA | 255.695 | 9.250 | 6.661 | 55.636 | 22.231 | 349.472 | 1.852,19 |
| Razer BlackShark V2 X | periférico | 1 | 42,79 | 0,63 | AURICULARES | 79.247 | 9.250 | 35.790 | 18.585 | 22.231 | 165.103 | 1.852,00 |
| MNN 15,6" portátil USB-C | monitor | 1 | 44,25 | 1,88 | ACC. COMPUTADORA | 81.955 | 9.250 | 91.359 | 19.147 | 22.231 | 223.942 | 1.852,09 |
| Anker (cable) | otro | 1 | 8,98 | 0,07 | CABLES. ADAPTADORES | 16.626 | 9.250 | 6.661 | — | — | 32.537 | 1.851,45 |
| Samsung Galaxy A16 5G | smartphone | 1 | 154,44 | 0,46 | CELULARES | 286.051 | 9.250 | 20.442 | 106.315 | 22.231 | 444.289 | 1.852,18 |
| GMKtec M6 Ultra (Ryzen) | pc | 1 | 679,00 | 1,64 | COMPUTADORAS | 1.257.657 | 9.250 | 110.949 | 423.847 | 22.231 | 1.823.934 | 1.852,22 |
| ASUS Vivobook 16 | notebook | 1 | 670,00 | 3,49 | COMPUTADORAS | 1.240.980 | 9.250 | 224.010 | 310.922 | 22.231 | 1.807.393 | 1.852,21 |
| Highwings HDMI 8K | otro | 1 | 6,48 | 0,16 | CABLES. ADAPTADORES | 12.010 | 9.250 | 7.121 | 4.463 | 22.231 | 55.074 | 1.853,40 |
| Logitech G413 SE | periférico | 1 | 80,16 | 1,05 | ACC. COMPUTADORA | 131.817 | 9.250 | 54.461 | 29.624 | 22.231 | 247.382 | 1.644,42 |
| OnePlus 11 256 GB | smartphone | 1 | 518,29 | 0,64 | CELULARES | 959.988 | 9.250 | 49.827 | 348.927 | 22.231 | 1.390.223 | 1.852,22 |
| HP 14 Chromebook | notebook | 2 | 258,25 | 5,02 | COMPUTADORAS | 956.650 | 9.250 | 238.728 | 224.197 | 22.231 | 1.451.055 | 1.852,18 |
| GMKtec Mini PC i7 | pc | 1 | 539,98 | 1,43 | COMPUTADORAS | 1.000.157 | 9.250 | 98.104 | 292.558 | 22.231 | 1.422.300 | 1.852,21 |
| WD_Black SN7100 1 TB | componente | 1 | 221,07 | 0,08 | ACC. COMPUTADORA | 372.265 | 9.250 | 6.661 | 80.115 | 22.231 | 490.522 | 1.683,92 |
| MSI MAG 272QP QD-OLED | monitor | 1 | 353,49 | 9,04 | ACC. COMPUTADORA | 654.739 | 9.250 | 409.640 | 139.431 | 22.231 | 1.235.290 | 1.852,21 |

Rarezas del Acer: el total pegado no es la suma de sus líneas (faltan 2.249) y su dólar da 1.846,43. Con el dólar de los
otros (1.852,2) productos daría 716.338 y el total cerraría exacto: el precio cambió mientras se armaba el carrito. Además
su ficha dice price 386,74, pero merchant + markup dan 371,69 (US$ 15,05 que el markup no explica).

Rarezas de la segunda tanda (14 carritos): el G413 (1.644,42) y el WD SN7100 (1.683,92) dan un dólar más bajo que el
resto (1.852,2): el precio de la ficha cambió entre la lectura y el carrito, o había un descuento. El cable Anker
(US$ 8,98) no trae ni IVA ni envío local. **Las candidatas de abajo se armaron con los 8 primeros: falta revisarlas con
los 22.**

## Lo que se ve (candidatas, no reglas todavía)

| Cargo | Candidata | Casos que explica |
|---|---|---|
| Dólar implícito | Uno solo por día para todos los productos (1.852,2 a la noche) | 6 de 7 del mismo rato (el Acer, por el cambio de precio) |
| Envío internacional | Fijo, ≈ US$ 5 por carrito: 9.250 / 1.852,2 = 4,99; a la mañana 9.278 / 1.868,8 = 4,96 | 8 de 8; no depende del peso ni de la cantidad |
| Envío a tu dirección | Fijo, AR$ 22.231 (seguramente depende de la dirección) | 7 de 7 |
| Servicios de importación | Por peso, ≈ AR$ 44.400 a 47.000 por kg (≈ US$ 24-25/kg) | 5 de 8 (celular, notebook, monitor, G305, hub). No cierran: Beelink 52.800/kg, SSD de 0,1 kg 66.600/kg y AeroClip de 0,05 kg 330.000/kg: hay un mínimo o se usa el peso volumétrico, que la ficha no trae |
| IVA e impuestos | 21 % de (productos + envío internacional) en accesorios de computadora y videojuegos | 4 de 4 (±5 pesos) |
| | ≈ 10,66 % de (productos + envío) en COMPUTADORAS (IVA reducido de 10,5 % más algo) | 2 de 2, sin explicar el 0,16 % de más |
| | 36 % de (productos + envío) en CELULARES (IVA + aranceles) | 1 de 1 |

Con esto **todavía no se puede estimar sin carrito**: los servicios no cierran en 3 de 8 y los impuestos dependen de la
categoría aduanera, de la que hay pocas muestras. Hace falta más de lo mismo: productos livianos (menos de 0,3 kg) para
ver el mínimo de los servicios, más computadoras y celulares, y otras categorías aduaneras. La página «Carritos de
Tiendamia» arma una tanda al azar en cada apertura para eso.

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

## La primera tanda: un link por categoría (ya cargada)

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
