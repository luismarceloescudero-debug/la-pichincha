# Data Model

## Version guardada
- `version` (texto): `<fecha del indice>-<commit corto>`, estampada en `sw.js` por `publicar_app.py`.
- Cache `pichincha-<version>`: cascara + `indice.json` + paginas de `/precios/` visitadas.
- Invariante: existe una sola cache `pichincha-*` despues de activar.

## Aviso de sin conexion (calculado, no se guarda)
- Entrada: `generado` (ISO con hora, del indice o de la pagina) y `ahora`.
- Salida: `{ texto, viejo }`; `viejo = true` si pasaron mas de 7 dias.
- Sin fecha valida: texto sin fecha ("Sin conexion"), `viejo = false`.

## Eventos de GoatCounter
- `app/instalada` (una vez, al `appinstalled`), `app/abierta` (una vez por sesion en modo app).

## Manifiesto
- `name`, `short_name`, `description`, `lang: es-AR`, `start_url`, `scope`, `display: standalone`,
  `background_color`, `theme_color`, `icons[]` (192, 512, 512 maskable).
