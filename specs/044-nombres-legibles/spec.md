# Spec 044: nombres legibles

## Problema

El dueño, 30/10/2026, al revisar el ensayo de la imagen de Instagram con las ofertas del 29/10: los nombres salen como los
publica cada tienda. «NOTEBOOK HP PROBOOK G10 14″ RYZEN 5 16GB RAM, 512GB WIFI6-E WIN11P», «MOUSE WIRELESS LOGITECH M190
005904 RED/BLACK Rojo», `6.7''` con dos apostrofes, y el corte de la Lenovo Legion 5 dejaba afuera la RTX 5050. Pidió:

1. sustituir la palabra del tipo («NOTEBOOK») por un icono, hacer mas grande el titulo importante (marca y modelo) y
   separar los datos (`27″ UHD 4K QD-OLED 240Hz`) en otro tamaño y color, dejando solo lo relevante;
2. lo mismo en todos los productos, y omitir los codigos internos de la tienda (no los universales del modelo);
3. normalizar a mayusculas y convertir a ″ las comillas que indican pulgadas.

## Que se hizo

`js/titulo.js` (puro, sin DOM ni red) parte cada nombre en tres:

| Parte | Como | Ejemplo |
|---|---|---|
| **Tipo** | `TIPOS` (principio del titulo) y la categoria de `js/categorias.js` como respaldo; un icono SVG de trazo por tipo (`ICONOS`) y un emoji para el texto plano (`EMOJI`) | notebook → 💻 |
| **Titulo** | se saca del principio lo que el icono ya dice y el relleno (`PREFIJO`: «Notebook Gamer», «Mouse Inalambrico»), el procesador y la placa de video de un equipo (van en las chips), colores, codigos internos (6+ cifras, 5 que empiezan con 0, `941-000111`), y se corta en el primer dato despues de la marca y el modelo; si no quedo un codigo de modelo, se busca uno corto mas adelante. En MAYUSCULAS, hasta 5 palabras | «LENOVO LEGION 5 15AKP10» |
| **Chips** | lo que define la compra segun el tipo: monitor (pulgadas, resolucion, panel con zonas de Mini LED, Hz), notebook/PC (CPU, GPU, RAM, disco, pantalla), celular (RAM/almacenamiento, 5G, pulgadas), componentes (socket, DDR, MHz, W, 80+, NVMe…), perifericos (inalambrico, Bluetooth, USB-C, DPI…). Unidades bien escritas (GB, Hz, 4K) | «Ryzen AI 7 350 · RTX 5050 · 16 GB RAM · 512 GB SSD · 15.1″ OLED 165 Hz» |

- Lo **usado o reacondicionado** se saca del titulo pero va como **primera chip** (principio II: no se esconde).
- El **nombre completo** de la tienda no se pierde: `completo` (con las pulgadas como ″) va en el `title` del nombre, en la
  ficha y en el link; el RSS abre la descripcion con el.
- Lo que el titulo no dice no se inventa: sin dato, no hay chip.

## Donde se usa

- Sitio: filas de Buscar (`js/busqueda.js`), tarjetas de Ofertas (`js/indice-ofertas.js`, que dejan de repetir las specs
  como chips) y el resumen «Mejor compra». Estilos `.tit*` en `css/sitio.css`.
- `generar_feed.js`: `/hoy/` (tarjeta e indice), el titulo de cada item del RSS (`Titulo.linea`) y `ofertas.json`, que suma
  `titulo`, `chips`, `icono` (el tipo; `tipo` ya era propia/publicada) y `emoji`.
- `publicar_telegram.py`: «💻 LENOVO LEGION 5 15AKP10 · Ryzen AI 7 350 · …»; un `ofertas.json` sin `titulo` sigue con el
  nombre de la tienda.
- La imagen de Instagram (PR #126, frenado) los toma de `ofertas.json`.

## Medido

Contra 150 nombres repartidos del indice del 22/10 y las 10 ofertas del 29/10 (tests en `tests/js/titulo.test.js`). Quedan
casos de «otro» (tarjetas de video sin la palabra adelante, accesorios) con el icono generico y el titulo recortado: no
pierden datos, solo no tienen chips.
