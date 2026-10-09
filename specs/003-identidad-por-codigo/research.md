# Research

## Que traen los nombres hoy (indice real, 8.506 avisos)
Sondeo con una regex generica de "letras y numeros de 6 o mas caracteres":

| Rubro | Avisos | Con algo que parece codigo | Codigos en mas de una tienda |
|---|---|---|---|
| RAM | 800 | 536 | 85 |
| SSD | 854 | 490 | 60 |
| Placa de video | 839 | 255 | 29 |

La mayoria de esos "codigos" son basura: `3200MHZ`, `2X16GB`, `2400MB/S`, `A520M-K`, `B650M-A`, `8640HS`,
`83LK007QAR`. Una regex generica **no sirve**: agruparia por especificaciones. Hacen falta reglas por
rubro que acepten solo la forma de un part number de ese fabricante.

## Decisiones

- **Reglas por rubro, lista blanca de formas conocidas.** RAM: Kingston `KF4xxC..`/`KF5xx`, `KVR..`,
  Corsair `CM[A-Z]\d+..`, Crucial `CT\d+..`/`CT\d+[A-Z]+\d`, G.Skill `F4-`/`F5-`, TeamGroup `T[A-Z]..`.
  SSD: Kingston `SNV\d..`/`SFYR..`, Crucial `CT\d+P\d+..`, WD `WDS\d+..`, Samsung `MZ-..`, Seagate `ZP..`.
  Placas de video: codigos de fabricante del tipo `RTX4060-O8G`, `GV-N4060..`, `ZT-..`, `90YV..`. Se
  arranca con las marcas que mas aparecen en los fixtures y se agregan con test.
  *Alternativa descartada*: regex generica con lista negra de falsos positivos; cada tienda inventa
  uno nuevo y el error se paga en grupos mal armados.
- **El codigo se normaliza** (mayusculas, sin espacios; `/` y `-` se conservan porque cambian el modelo:
  `KF432C16BB/16` no es `KF432C16BB1/16`).
- **Capacidad y cantidad como guarda**: si dos avisos tienen el mismo codigo pero el nombre dice
  capacidades distintas (por ejemplo kit 2x8 y 1x16), no se agrupan.
- **Usado, reacondicionado, bulk/OEM**: palabras marcadoras en el nombre impiden agrupar con nuevo.
- **Columna `modelo` en el indice.** La extraccion se hace una vez al indexar; el navegador solo compara.
  *Alternativa*: extraer en el navegador (mas codigo JS y mas lento) o tabla aparte (mas pedidos).
- **Agrupado = igualdad de `modelo`**, funcion pura en `js/buscador.js`; la comparten el navegador y
  `generar_paginas.js`.
- **Cobertura**: `cobertura.py` calcula el informe a partir del indice, compara con el `cobertura.json`
  publicado en la corrida anterior (se baja del sitio; si falla, sin comparacion) y escribe el resumen
  de la Action.
- **Tamano**: 8.506 filas x ~30% con codigo x ~12 caracteres = ~30 KB (1,6%), bajo el 5%.
