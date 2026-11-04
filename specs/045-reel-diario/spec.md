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
- v4: ~43 s a 30 fps con el ritmo ágil (v3: ~29 s): intro (3 s) · 10 ofertas (3,4 s cada una, la súper oferta un poco más) · cierre (4,2 s). Barras de progreso como las historias.
- Cada oferta: el descuento se estampa, el icono del tipo se dibuja, el nombre legible (spec 044) se escribe en vivo con
  cursor, las chips aparecen de a una, el precio cuenta del de antes al de hoy y el de antes se tacha. Si la oferta es
  contra el mismo modelo (spec 035) lo dice.
- **Números y símbolos enormes (v4)**: el descuento va a 230-260 px con el «−» en acento3, el número en acento y el «%» en
  acento2; el precio ocupa todo el ancho de la tarjeta (hasta 260 px, se achica si no entra) con el «$» en acento3. La intro
  dice «HASTA −N%» con el mayor descuento del día.
- **Súper oferta (v4)**: la de mayor descuento del Reel, si llega al 20 % (el piso de los «héroes» de la pestaña Ofertas,
  spec 055); una sola. Lleva una cinta «★ SÚPER OFERTA ★» con un destello que la cruza, su barra en otro color, el descuento
  late con brillo y sus características se escriben letra por letra: la que se forma brilla con dos chispas que giran, y
  cuando termina una **premium** (OLED o Mini-LED, 4K, 144 Hz o más, RTX x060 o más de la serie 40/50, RX alta, procesador
  7/9 o con NPU, DDR5, 1 TB o más, 32 GB o más, PCIe 5, Wi-Fi 7, mecánico: `chipPremium`) pasa un destello y queda en un
  degradado. El precio cuenta después del tipeo, que suma 55 unidades de armado por letra (entre 600 y 1300). Es la portada.
- Cierre: `pichinchadeldia.com.ar/hoy` se escribe, se «toca» (onda) y aparece «Link en la bio», con el aviso de siempre
  (IVA, sin envío, verificá en la tienda, el orden no depende de comisiones).
- **Un estilo por día** (`estilo(fecha)`): 6 paletas con contraste para el celular (v4: cada una combina tres acentos y una
  tarjeta de dos tonos; la marca, el «%», las características y la tienda van en acento2, el precio en acento y lo premium en
  acento3; la prueba exige 3:1 sobre los dos tonos de la tarjeta), 6 juegos de letras de Google Fonts
  (Plex, Bebas Neue, Anton, Archivo Black, Oswald, Barlow), 3 ritmos (v4, 04/11: ágil 3,4 s, normal 3,9 s, pausado 4,4 s por
  oferta; v3 era 2,3/2,7/3,1. El armado se estira `paso` veces y el resto de la tarjeta queda quieta para leerla), 3 fondos, 3 transiciones y 2 disposiciones (tarjeta con la foto chica, o
  «plena» con la foto grande arriba). Cada parte avanza a su propio paso: dos días seguidos no se parecen y la misma fecha
  da siempre el mismo Reel.
- **La foto del producto** (la de la tienda, que `generar_feed.js` suma a `ofertas.json` como `imagen`, solo https limpia):
  de fondo, desenfocada bajo un velo del color del día, y nítida en la tarjeta, con un acercamiento lento. Se espera a que
  baje (8 s de tope por foto); si no baja, esa oferta va sin foto.

## Cómo se arma

`generar_reel.js` (Node, sin dependencias):

1. Escribe `instagram/reel-AAAA-MM-DD.html`: la página se pinta con `pintar(ms)`; el mismo tiempo da siempre el mismo cuadro.
2. Abre Chrome sin interfaz con el puerto de DevTools y, por el WebSocket de Node 22+, saca un JPEG por cuadro.
3. ffmpeg los une en `instagram/AAAA-MM-DD.mp4` (H.264 high, yuv420p, AAC mudo, faststart) y deja la portada
   `AAAA-MM-DD-portada.jpg` (la primera oferta ya armada).

`--ritmo agil|normal|pausado` fuerza un ritmo (para comparar); `--solo-html` arma solo la página; `--fotos 1900,8800` saca cuadros sueltos para revisar el diseño. Sin Chrome o sin ofertas
avisa y sale con 0. En la PC del dueño tarda unos minutos (v4: ~1300-1700 cuadros).

## Lo que falta (cuando el dueño destrabe el #126)

- El job de Instagram publica con `media_type=REELS`, `video_url` y `cover_url` en lugar de la imagen 4:5, y espera a que
  el contenedor quede `FINISHED` antes de `media_publish`.
- En Actions: `sudo apt-get install -y ffmpeg` si el runner no lo trae, y `node generar_reel.js _sitio/ofertas.json` en el
  build.
