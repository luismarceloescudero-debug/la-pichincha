# Spec 045: el Reel de las Pichinchas del día

## Problema

El dueño, 30/10/2026, al ver el ensayo de la imagen 4:5 del PR #126: «la imagen debe mantener la mejor relación de aspecto
respecto de todas las formas de publicación de Instagram», animada, «con enlaces que se escriben en vivo y abren con
efectos», «colores, estilos, diseños diferentes para cada publicación», y publicar **siempre como Reel**. El #126 sigue
frenado: esta spec solo arma el video, no publica.

## Límites de Instagram (verificados, no se esquivan)

- No acepta GIF: lo animado se publica como **Reel** (MP4 H.264 + AAC, 1080x1920, 3 s a 15 min).
- **No hay links que se toquen** dentro de una publicación ni en su texto, y la API no pone el sticker de link en las
  historias. El link se «escribe y se toca» en el video como efecto y lleva a `/hoy/` por el **link de la bio**.

## Formato

- **9:16, 1080x1920**: se ve entero como Reel y como historia. Lo importante va en la franja y 250-1500 (arriba y abajo
  están los controles de Instagram; la grilla del perfil recorta a 3:4).
- ~22 s a 30 fps: intro (2,2 s) · 10 ofertas (1,7 s cada una) · cierre (3 s). Barras de progreso como las historias.
- Cada oferta: el descuento se estampa, el icono del tipo se dibuja, el nombre legible (spec 044) se escribe en vivo con
  cursor, las chips aparecen de a una, el precio cuenta del de antes al de hoy y el de antes se tacha. Si la oferta es
  contra el mismo modelo (spec 035) lo dice.
- Cierre: `pichinchadeldia.com.ar/hoy` se escribe, se «toca» (onda) y aparece «Link en la bio», con el aviso de siempre
  (IVA, sin envío, verificá en la tienda, el orden no depende de comisiones).
- **Un estilo por día** (`estilo(fecha)`): 6 paletas con contraste para el celular × 3 fondos (grilla, rayas, puntos) × 3
  transiciones (deslizar, zoom, cortina). La misma fecha da siempre el mismo estilo.

## Cómo se arma

`generar_reel.js` (Node, sin dependencias):

1. Escribe `instagram/reel-AAAA-MM-DD.html`: la página se pinta con `pintar(ms)`; el mismo tiempo da siempre el mismo cuadro.
2. Abre Chrome sin interfaz con el puerto de DevTools y, por el WebSocket de Node 22+, saca un JPEG por cuadro.
3. ffmpeg los une en `instagram/AAAA-MM-DD.mp4` (H.264 high, yuv420p, AAC mudo, faststart) y deja la portada
   `AAAA-MM-DD-portada.jpg` (la primera oferta ya armada).

`--solo-html` arma solo la página; `--fotos 1900,8800` saca cuadros sueltos para revisar el diseño. Sin Chrome o sin ofertas
avisa y sale con 0. En la PC del dueño tarda ~2 min (666 cuadros).

## Lo que falta (cuando el dueño destrabe el #126)

- El job de Instagram publica con `media_type=REELS`, `video_url` y `cover_url` en lugar de la imagen 4:5, y espera a que
  el contenedor quede `FINISHED` antes de `media_publish`.
- En Actions: `sudo apt-get install -y ffmpeg` si el runner no lo trae, y `node generar_reel.js _sitio/ofertas.json` en el
  build.
