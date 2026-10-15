# Viabilidad: identidad por GTIN/EAN (B3 del plan v2)

**Fecha**: 2026-10-15

**Decision**: B3 **descartada** tal como esta planteada. La ganancia estimada queda por debajo de 5 puntos de
cobertura en cada rubro (umbral fijado antes de medir). Se propone en su lugar medir el MPN de las fichas
(ver "Alternativa" al final).

## Linea de base

`cobertura.py` sobre el `indice.json` publicado (relevado el 14/10/2026, 9.492 avisos):

| Rubro | Avisos | Con codigo | Agrupados | Grupos |
|---|---:|---:|---:|---:|
| ram | 183 | 70 (38%) | 0 | 0 |
| ssd | 145 | 45 (31%) | 0 | 0 |
| gpu | 506 | 70 (14%) | 4 | 2 |

Casi todo el "con codigo" es de CompraGamer (66 de 70 en RAM, 42 de 45 en SSD, 56 de 70 en GPU), que publica
el part number en su catalogo. Venex y Mexx tienen 0 avisos con codigo: el nombre no lo trae.

## Quien publica GTIN

| Fuente | Donde | GTIN | Comentario |
|---|---|---|---|
| Venex | solo en la ficha (`og:gtin` y "MODELO: ... \| GTIN: ...") | 19 de 19 fichas validas | tambien trae el MPN en la ficha |
| Mexx | solo en la ficha (`<b>UPC : </b>`) | 10 de 14 fichas | a 4 les falta; trae el MPN en "Modelo" (a veces el nombre comercial) |
| CompraGamer | catalogo JSON | no | solo `codigo_principal` = MPN (ya se usa) |
| Gaming City | listado y ficha (fixtures) | no | |
| ComparaYa | API (`specifications.EAN`) | 0 de 100 en placas de video | el EAN aparece solo en algunos comercios VTEX (Carrefour) y en otros rubros |

`robots.txt`: Venex permite las fichas `.html`; Mexx no tiene `robots.txt` (404).

## Muestra

33 pedidos con 4 s de pausa (19 fichas de Venex y 14 de Mexx): 14 pares del mismo producto en las dos tiendas
(4 de RAM, 4 de SSD, 6 de placas de video) y 5 fichas sueltas de Venex. Digito verificador GS1 sobre cada GTIN.

- GTIN valido: Venex 19/19 (100%); Mexx 10/14 (71%). No aparecio el `og:gtin` = "200" del diagnostico del
  14/10: existe, pero en esta muestra no salio ninguno.
- **Mismo GTIN en los dos lados del par: 4 de 14.**
  - RAM 2 de 4 (Corsair Vengeance RS 8GB, Kingston Fury Beast 8GB). Un par sin UPC en Mexx; otro con GTIN y
    MPN distintos (Hiksemi Armor 16GB: HSC416U32I2 contra HSC416U32Z2, probablemente otra variante).
  - SSD 1 de 4 (Kingston A400 240GB). A los otros 3 Mexx no les publica UPC.
  - Placas de video 1 de 6 (ASRock Arc A380). En las otras 5 **el mismo producto tiene otro codigo de
    barras**: Venex publica el EAN-13 de Asia/Europa (4711..., 4719...) y Mexx el UPC-A de EE.UU.
    (199291..., 889523..., 824142...). El GTIN identifica la presentacion regional, no el modelo, asi que en
    placas de video no sirve para cruzar tiendas.

## Estimacion de la ganancia

Solo Venex y Mexx publican GTIN en estos rubros, asi que un grupo por GTIN solo puede juntar esas dos tiendas.
Productos que venden las dos (cruce por marca, capacidad y modelo, revisado a mano): unos 6 en RAM, 11 en SSD
y 14 en placas de video. Aplicando la tasa de coincidencia de la muestra:

| Rubro | Pares Venex-Mexx | Coinciden por GTIN | Avisos agrupados nuevos | Puntos de cobertura |
|---|---:|---:|---:|---:|
| ram | ~6 | ~50% → ~3 | ~6 de 183 | **~3** |
| ssd | ~11 | ~25% → ~3 | ~6 de 145 | **~4** |
| gpu | ~14 | ~17% → ~2 | ~4-5 de 506 | **~1** |

Lejos de la meta de 40% y por debajo del umbral de 5 puntos en los tres rubros. La muestra es chica (14 pares),
pero ni con el doble de tasa de coincidencia RAM o SSD pasan de 8 puntos, y el problema de las placas de video
es estructural (codigos regionales distintos).

## Costo en pedidos

Leer el GTIN exige un pedido por ficha: unas 120 fichas de Venex y 115 de Mexx en RAM, SSD y placas la primera
vez (con 4 s de pausa, ~16 minutos), y despues solo las fichas nuevas (una cache por URL en la rama `historial`,
con tope por corrida). El costo seria razonable y compatible con el principio III; lo que no alcanza es la
ganancia.

## Alternativa que si vale medir: MPN de las fichas

Las mismas fichas traen el part number del fabricante, que es lo que CompraGamer ya publica y lo que hoy agrupa:

- Venex "MODELO:" coincide exacto (sin guiones ni simbolos) con un codigo de CompraGamer en el indice en
  **4 de 19** fichas: 2 de 6 en RAM (Corsair CMG8GX4M1E3200C16, KingDian D4U266616G-B), 2 de 6 en SSD
  (Kingston SNV3S/1000G, Samsung MZ-V9S1T0B/AM) y 0 de 7 en placas de video (ASUS publica el codigo de
  modelo en una tienda y el 90YV... en la otra).
- Venex y Mexx comparten MPN en 3 de 14 pares; GTIN o MPN, en 5 de 14.

Extrapolando con la misma cautela: RAM ~10 puntos y SSD ~15 puntos, con el mismo costo de pedidos que el GTIN.
Es la misma muestra chica, asi que antes de construirlo conviene confirmarla con mas fichas. Queda propuesto
como B3-bis en `docs/plan-v2.md`; no se implementa en este PR.

## Reproducir

Los scripts de la medicion leen el `indice.json` publicado y fichas bajadas a una carpeta temporal; no quedan
en el repo porque no son codigo de produccion. Los pasos: `python cobertura.py indice.json --salida c.json`,
bajar las fichas con pausa de 4 s, extraer `og:gtin`/"MODELO:" (Venex) y "UPC"/"Modelo" (Mexx), validar el
digito verificador GS1 y comparar par por par.
