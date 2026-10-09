# Research: App instalable que abre sin red

## D1. Red primero, con tiempo limite
- **Decision**: para pedidos GET del mismo origen, el service worker intenta la red; si falla o no responde en 4 segundos, responde con lo guardado. Cada respuesta buena de la red actualiza lo guardado.
- **Rationale**: FR-004 y el principio II piden que con conexion mande siempre el dato nuevo; y 4 segundos evita que una conexion mala deje la pantalla en blanco (edge case de conexion lenta).
- **Alternativas**: cache primero con actualizacion en segundo plano (rapido, pero muestra el precio de ayer con conexion: viola FR-004); solo red (no abre sin conexion).

## D2. Una cache por version, descartada al activar
- **Decision**: la cache se llama `pichincha-<version>`; al activar la nueva se borran las demas. La version la estampa `publicar_app.py` en cada publicacion (fecha del indice + commit).
- **Rationale**: FR-008 y FR-009: nunca se mezclan archivos de dos versiones y cada deploy limpia lo anterior.
- **Alternativas**: version fija en el codigo (hay que acordarse de subirla); hash de cada archivo (mas complejo y sin ganancia a este tamano).

## D3. Que se guarda
- **Decision**: al instalar el service worker se guardan la cascara (principal, `css/`, `js/`, manifiesto, iconos), `sin-red.html` y `indice.json`; en tiempo de ejecucion se guardan las paginas de `/precios/` visitadas. No se guarda nada de otros origenes (fotos, fuentes, GoatCounter, tiendas).
- **Rationale**: FR-003, FR-007 y FR-012; las fotos son de terceros y pesan. Estimado: menos de 3 MB en total.
- **Alternativas**: guardar tambien las 50 paginas de entrada (decenas de pedidos extra al instalar, sin que la persona las pida).

## D4. El aviso de sin conexion no depende de encabezados
- **Decision**: `js/app.js` hace un pedido HEAD sin cache al manifiesto despues de cargar (con limite de 5 segundos) y escucha `online`/`offline`. Si falla, muestra el aviso: "Sin conexion: estas viendo los precios del <fecha y hora>", y desde los 7 dias, "pueden estar viejos".
- **Rationale**: el service worker solo atiende GET, asi que el HEAD llega a la red de verdad y dice si hay conexion, sin trucos con encabezados de lo guardado. La fecha sale de `generado` del indice o de la propia pagina.
- **Alternativas**: leer `navigator.onLine` (miente con redes sin salida a internet); marcar con un encabezado las respuestas guardadas (no sirve para paginas ya cargadas).

## D5. Medicion de instalacion
- **Decision**: el evento `appinstalled` registra `app/instalada` una vez; si la pagina corre en modo app (`display-mode: standalone`), se registra `app/abierta` una vez por sesion. Mismo GoatCounter, sin cookies.
- **Rationale**: FR-011 y principio V. GoatCounter ya agrupa por sesion.

## D6. Sin cartel propio de instalar
- **Decision**: no se escucha `beforeinstallprompt` para mostrar nada; el navegador ofrece su opcion.
- **Rationale**: FR-002; el pedido lo excluye.

## D7. Iconos
- **Decision**: 192, 512, 512 con zona segura (maskable) y 180 para Apple, dibujados con la misma paleta y tipografia que `img/og.png` y renderizados con Edge sin interfaz desde `docs/iconos.html`; se commitean.
- **Rationale**: igual que la imagen para compartir; no hay logo oficial (Assumptions).

## D8. Navegadores sin soporte
- **Decision**: todo detras de `"serviceWorker" in navigator`; si falta, no pasa nada. En iPhone se instala con "Agregar a pantalla de inicio" por las etiquetas `apple-*`.
- **Rationale**: edge cases de la spec; SC-007.

## D9. Alcance (scope)
- **Decision**: `sw.js` y el manifiesto viven en la raiz del sitio, asi el alcance cubre `/` y `/precios/`.
- **Rationale**: un service worker solo controla su carpeta y las de abajo.
