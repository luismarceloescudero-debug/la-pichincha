# Spec 057: índice del sitio sin fotos

**Estado**: hecha el 02/11/2026. **Origen**: auditoría 2 del 02/11 (Buscar y Ofertas en celular: rendimiento 47-48, ~12 s hasta el
primer resultado) y recomendación (a) del informe.

## Problema

`indice.json` pesa 1,79 MB comprimidos (9,5 MB sin comprimir, 31.019 avisos) y el navegador lo baja entero en cada búsqueda. El campo
`imagen` es el 29 % de ese peso (520 KB comprimidos) y la búsqueda no muestra fotos: solo las usa la pestaña Ofertas.

## Qué hace

- `adelgazar_indice.js` (paso final de `actualizar.yml`, después de todo lo que lee `_sitio/indice.json`):
  - escribe `_sitio/indice.json` con la columna `imagen` vacía (las posiciones no se mueven);
  - escribe `_sitio/imagenes.json` (`{ url: foto }`) solo con lo que la pestaña Ofertas puede mostrar (propias, publicadas, en
    seguimiento y «contra el modelo»): 354 fotos, 15 KB comprimidos.
- El `indice.json` de la raíz (completo) no cambia: lo siguen usando el feed, Telegram, las páginas y las series.
- `js/indice-ofertas.js`: `asegurarImagenes()` pide `imagenes.json` solo al abrir Ofertas, en paralelo con el índice. La tarjeta usa
  `imagenes.json`, y si no está, la foto del propio índice (el índice completo, los fixtures de e2e), y si tampoco, el icono del tipo.
- Si el script falla, el sitio sale con el índice completo y un aviso en el workflow.

## Medición (Lighthouse, celular, índice real servido con gzip)

| | Antes | Después |
|---|---|---|
| `indice.json` comprimido | 1.841 KB | 1.299 KB (−29 %) |
| Buscar: LCP | 11,9 – 12,3 s | 9,3 – 9,6 s |
| Ofertas: LCP | 12,9 s | 11,0 s |
| Rendimiento (Buscar / Ofertas) | 48-50 / 47 | 46-47 / 49 |

El puntaje casi no cambia porque el otro freno es el bloqueo de CPU (TBT ~2 s al armar 31.000 filas), que esta spec no toca.

## Lo que no resuelve

Bajar de 2,5 s hasta el resultado necesita partir el índice por rubro o buscar en el Worker (auditoría 2, opciones b y c).

## Pruebas

`tests/js/adelgazar.test.js` (foto fuera de todas las filas, solo las posibles ofertas en `imagenes.json`, índice original intacto,
índice sin campo de imagen) y `tests/js/ofertas-ui.test.js` (la tarjeta toma la foto de `imagenes.json`, del índice o el icono).
