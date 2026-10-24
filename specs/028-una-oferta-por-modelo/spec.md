# Feature Specification: Una oferta por modelo en las ofertas del dia

**Created**: 2026-10-23

**Status**: Implementada. Sale en la corrida programada del 24/10.

**Input**: En la corrida manual del 23/10 (22:06), Telegram publico dos «pichinchas» que eran la misma notebook en la misma
tienda: Mexx, «Notebook Lenovo V15 G5 Core i5 13420H 32Gb Ssd 512Gb 15.6" #» ($1.819.599, aviso 50758) y la misma con
«Wind 11 Pro» ($1.875.109, aviso 50761). En la imagen de Instagram el recorte del nombre escondia la diferencia y se
veian identicas. El dueño: «esto no puede pasar; pierde credibilidad la app, si hay errores tan groseros».

## Causa

`O.destacadas` (`js/ofertas.js`), la seleccion que comparten `/hoy/`, el RSS, Telegram e Instagram, ya dejaba un solo
lugar por codigo de modelo, pero solo si el aviso tenia codigo. Los dos avisos de Mexx no traen codigo (`f[9]` vacio):
cada uno ocupaba su lugar.

## Decisiones

- **`O.familia(fila)`**: que equipo es.
  - Con codigo de modelo, el codigo.
  - Sin codigo, el nombre normalizado como lo compara el buscador (`B.normalBusq`: minusculas, sin tildes, unidades
    pegadas: «16 GB» es «16gb»), sin lo que no cambia el equipo: sistema operativo (Windows 10/11, «Wind 11 Pro», W11,
    FreeDOS, «sin sistema operativo»), color (negro, silver, gris, azul...), «#» y «nuevo».
  - Otra RAM, otro disco u otro procesador siguen siendo otro equipo (la Lenovo de 16 GB no se junta con la de 32 GB).
- **`destacadas`**: un solo lugar por familia, en una tienda o en varias. Gana la mejor ubicada (el mismo orden de
  siempre) y la otra deja lugar a la siguiente.
- **Red de seguridad en la guardia** (`guardia.js --ofertas _sitio/ofertas.json`): si dos ofertas del `ofertas.json` que
  se va a publicar son la misma familia, es una alarma. Con alarma no se manda Telegram (ni Instagram) y se abre o
  comenta el issue `guardia`.
- `ofertas.json` suma el `modelo` de cada oferta cuando lo hay, para que la guardia lo compare.

## Ensayo en seco (indice publicado el 23/10 22:06)

- Con el arreglo: queda la Lenovo de 32 GB sin Windows (16,3% de descuento contra 15,9%) y entra la siguiente. Antes de
  publicar, la verificacion de enlaces todavia puede descartar alguna.
- La guardia sobre el `ofertas.json` publicado ese dia da la alarma: «dos ofertas del día son el mismo modelo».

## Tests

`tests/js/ofertas.test.js`, con los avisos reales de la Lenovo V15 (`tests/fixtures/ofertas/lenovo-v15-2026-10-23.json`):
la misma familia con o sin sistema operativo, color o «#»; otra RAM u otro procesador, otra familia; con codigo manda el
codigo; en `destacadas` la Lenovo ocupa un lugar y queda la de mayor descuento; el mismo nombre en dos tiendas tambien.
`tests/js/guardia.test.js`: `repetidas` y la alarma; `main --ofertas` sale con 3 si se repite un modelo.
