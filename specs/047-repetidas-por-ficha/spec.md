# Spec 047: repetidas por ficha legible

## Problema

Las Pichinchas del 30/10 (12:58) publicaron dos veces el mismo producto, en el sitio y en Telegram:

- Memoria Corsair Vengeance DDR5 64GB 6000MHz CL40 **Black** y **Grey**: mismo precio y misma tienda, pero cada color trae
  su codigo de modelo, asi que `familia` (que con codigo usa el codigo) los separaba, y los «gemelos» (mismo precio,
  casi el mismo nombre) se comparaban por `familia` y no por el nombre.
- Notebook HP 250 con Intel Core 5 120U, 16 GB, 512 GB, en Max Tecno («C5-120U») y en Click Gaming («Core 5 120U»):
  los nombres no coincidian.

Ademas salia la de Max Tecno ($1.596.165) aunque Click Gaming la tenia a $1.545.000.

## Que se hizo

- `ficha(f)` en `js/ofertas.js`: tipo + titulo legible + datos (spec 044, `js/titulo.js`), sin pulgadas ni estado. Si
  dos ofertas tienen la misma ficha, son el mismo producto. Solo cuenta con un modelo en el titulo (un numero) y al
  menos dos datos, para no juntar productos distintos de la misma marca.
- Los gemelos se comparan por el nombre aunque haya codigo de modelo.
- Entre las del mismo producto (familia o ficha) queda **la mas barata**; a igual precio, la mejor ubicada.
- La guardia (`guardia.js`, `repetidas`) tambien mira la ficha: si algo se escapa, es alarma y no sale Telegram.
- `js/titulo.js` reconoce los Intel Core 5/7 de la serie 1 («Core 5 120U», «C5-120U») y saca «Smartphone» del titulo.

## Verificado

Con el indice publicado el 30/10: queda una sola Corsair Vengeance y una sola HP 250, la de Click Gaming. Tests en
`tests/js/ofertas.test.js`, `tests/js/guardia.test.js` y `tests/js/titulo.test.js`.
