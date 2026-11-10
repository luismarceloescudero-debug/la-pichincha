# Spec 063: buscar sin bajar el índice entero

**Estado**: propuesta. **Necesita una decisión del dueño** antes de escribir código (ver «La decisión»).
**Origen**: hallazgo R1 de `docs/auditorias/2026-11-10.md` (gravedad alta). El dueño pidió que este arreglo vaya en su
propia spec y no en un PR de paso.

## Problema

Cada primera visita a la pestaña Buscar o a Ofertas se baja `/indice.json` completo: **6.689.176 bytes** sin comprimir,
**1.254 KB** por la red (medido hoy contra el sitio publicado, con `curl --compressed`). Son **31.233 filas y 14 campos
por fila**. En un celular con una conexión normal eso son varios segundos antes de que aparezca el primer precio, y es
el techo de todo lo demás: el HTML ya está en pantalla y lo único que falta es el archivo.

La spec 057 ya le sacó el 29 % (las fotos, 9,5 MB → 6,4 MB). Esta spec es la otra mitad, la que 057 dejó anotada como
pendiente.

## Lo que se midió antes de proponer nada

Se bajó el índice publicado y se probaron cuatro cirugías del archivo. El resultado descarta tres de las cuatro, incluida
una que esta misma auditoría había propuesto como «lo primero y más barato».

| Variante | Sin comprimir | gzip | Red |
|---|---|---|---|
| Como está hoy | 6,38 MB | 1.254 KB | — |
| `url` sin esquema ni host (el host sale de `tienda`) | 5,61 MB | 1.232 KB | −1,8 % |
| Solo las columnas que pinta Buscar (nombre, precio, tienda, url) | 5,19 MB | 1.133 KB | −9,7 % |
| + las columnas de Ofertas (lista, antes, desde, baja7, baja31, vendido) | 5,90 MB | 1.192 KB | −5,0 % |
| Nombres en un diccionario de 22.374 palabras | 6,28 MB | 1.288 KB | **+2,7 % (peor)** |

Por qué tan poco:

- **`url` es el 45,2 % del archivo** (2,89 MB, 92 bytes por fila) y **`nombre` el 26,3 %** (1,68 MB). Todo el resto de
  los 14 campos junto es el 28,5 %. Sacar campos que no sean esos dos no puede bajar de 1,1 MB.
- Sacar el host de la url ahorra 12 % sin comprimir pero **1,8 % comprimido**: gzip ya comprime las 26 tiendas
  repetidas.
- El diccionario de palabras **empeora**: gzip ya deduplica las palabras dentro de su ventana, y los identificadores
  numéricos ocupan más que la palabra ya comprimida.
- El parseo **no** es el problema: `JSON.parse` de los 6,4 MB tarda **22 ms** en esta PC (un teléfono de gama media,
  orden de magnitud 150-400 ms, sin medir). El problema es la descarga.

Y un dato que cambia la gravedad para quien vuelve: el archivo se sirve con `Cache-Control: max-age=600` y `ETag`, así
que **la segunda visita no lo vuelve a bajar**. Los 1,3 MB los paga la primera visita y las visitas después de vencer la
caché, no todas. Para un comparador de precios, donde la gente entra cada tanto, eso sigue siendo casi todas las visitas.

## Lo único que cambia el orden de magnitud

**No bajar 31.233 filas para contestar una consulta.** Una respuesta con una página de 24 filas completas pesa
**1.442 bytes comprimidos**: el índice entero entra 891 veces ahí adentro. Ese es el margen, y ninguna poda del archivo
se le acerca.

### Opciones, con lo que cuesta cada una

1. **Buscar en el Worker «Afuera»** (specs 022/023, ya desplegado y con secreto de Cloudflare en el workflow). El índice
   vive en **KV**; el navegador manda la consulta y recibe solo las filas que coinciden, ya calculadas. La primera
   visita baja kilobytes. Es la que más rinde y la que menos cambia el código de la vista: `js/busqueda.js` seguiría
   recibiendo filas con la misma forma.
   - Cuesta: un binding nuevo (`kv_namespaces`) en `worker/wrangler.toml`, un paso que escriba el índice en KV al final
     de `actualizar.yml` (mismo lugar donde hoy corre `adelgazar_indice.js`), y una ruta `/buscar` en el Worker.
   - Depende de la cuenta de Cloudflare y de sus límites de KV (lecturas y escrituras por día, almacenamiento). **No se
     afirman acá: se verifican en el panel antes de aprobar.**
   - Riesgo: si el Worker no contesta, la pestaña tiene que seguir andando. El fallback es el índice completo de hoy,
     bajado solo cuando el Worker falla.
2. **Partir el índice por rubro.** Es la sugerencia 1 de la auditoría y **no sirve para este sitio**: el buscador es de
   texto libre y no se sabe el rubro antes de buscar. Serviría para Ofertas solo si Ofertas se abriera por rubro, y hoy
   no es así.
3. **Guardar el índice en IndexedDB con ETag** (sugerencia 3). Como la caché del navegador ya evita la segunda descarga,
   esto ahorra el viaje de revalidación (unos cientos de bytes), no los 1,3 MB. Sirve como complemento, no como arreglo.
4. **Nombre de archivo atado a la fecha** (`indice-<generado>.json`) para servirlo inmutable. Cambia «revalidar cada 10
   minutos» por «no volver a preguntar», pero no le cambia nada a la primera visita. Complemento barato de la opción 1.

### La decisión

La opción 1 es la única que baja de 1,3 MB a kilobytes. Implica plata y cuentas (Cloudflare KV), que es decisión del
dueño; el resto son complementos de una tarde que no mueven la aguja solos. Si dice que sí, el orden es: KV + ruta en
el Worker, `js/busqueda.js` y `js/indice-ofertas.js` con fallback, y recién al final las sugerencias 3 y 4.

## Qué no resuelve

- **Ofertas** sigue necesitando el índice completo para calcular las ofertas de los 31.233 avisos (el cálculo ya corre
  en un worker del navegador desde la spec 054). Con la opción 1, Ofertas puede pasar a calcular las ofertas en el
  Worker de Cloudflare, pero eso es una spec aparte.
- El bloqueo de CPU al armar las filas (`asegurarIndice` + `calcularOfertas`) es de las specs 037 y 054 y está
  resuelto; no se toca acá.
- El CSS de 85 KB (R2 de la auditoría) y las fotos de las tarjetas (R3) no entran acá.

## Pruebas

- Un test nuevo para el camino del Worker: con el Worker disponible, la búsqueda pide `/buscar` y pinta las filas que
  vuelven; con el Worker caído o lento, baja el índice completo y pinta lo mismo (el fallback no puede dejar la pestaña
  vacía).
- `tests/js/ofertas-ui.test.js` y `tests/js/buscador.test.js`: el recuento y el número de la pestaña siguen saliendo bien
  por los dos caminos.
- Del lado del Worker, `tests/js/worker.test.js` es lo que corre el paso «Tests del Worker» de `worker.yml`, pero hoy
  prueba los adaptadores de tiendas, no las rutas HTTP: la ruta `/buscar` necesita su propio test (mismo archivo o uno
  al lado) con una KV de mentira. Que la ruta conteste bien, rápido y con la misma forma de fila que el índice, y que
  con KV vacía devuelva una lista vacía en vez de un error.
- Medición de cierre, con el método de la 057: Lighthouse móvil contra el sitio servido con gzip, `indice.json` y la
  respuesta del Worker, antes y después, en frío (caché vacía). El número que decide es el **transferido en la primera
  visita a Buscar**, que hoy es 1.254 KB.
- El e2e (`npx playwright test --workers=1`) tiene que seguir pasando **sin** el Worker: el camino del fallback es el
  que corre la CI.
