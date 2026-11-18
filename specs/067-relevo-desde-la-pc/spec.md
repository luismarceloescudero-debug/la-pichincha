# Spec 067: relevo desde la PC

## Problema

FullH4rd (listados de búsqueda, `robots.txt` permite `/buscar` y `/prod/`) y Katech (feed oficial que la tienda nos dio
el 04/11) contestan **403 a la IP de los runners de GitHub Actions**. Desde la PC del dueño (conexión domiciliaria)
las dos dan 200 sin ningún truco: el 17-18/11, Katech 2.044 productos y FullH4rd ~1.554. Con la spec 066, una tienda
bloqueada 14 días pasa a pausa y sale del índice.

## Qué se hace

La misma lectura, desde otro lugar. **No** se usan proxies, rotación de IPs, servicios «stealth», navegadores
automatizados para pasar desafíos ni otro User-Agent: `relevo_pc.py` llama a `indexar.leer_catalogo` (los mismos
extractores, el mismo `UA` y la misma `PAUSA` que el runner). Si la tienda bloquea también a la PC, no se insiste.

1. **`tiendas.json`**: `"relevo": "pc"` marca las tiendas que se relevan desde la PC (hoy `fullh4rd` y `katech`).
2. **`relevo_pc.py`** (en la PC) releva solo esas y arma, por tienda, `relevo-pc/<tienda>.json`:
   `{"tienda", "nombre", "via": "pc", "relevado": "AAAA-MM-DDTHH:MM-03:00", "cantidad", "productos": [...]}`, un
   producto por línea (diff chico). Una tienda que falla o trae 0 no se escribe: queda el archivo anterior con su fecha.
3. **Publicación** (`--publicar`): clon superficial de la rama `historial` en
   `%USERPROFILE%\.la-pichincha\relevo-historial` (fuera del repo; nunca toca el checkout del dueño), `pull --rebase`
   antes de escribir, commit «Relevo desde la PC del AAAA-MM-DD: fullh4rd N, katech M» y push; si el push choca con el
   del runner, `pull --rebase` y reintenta (3 veces). Nunca `--force`. Usa las credenciales de git de la PC.
4. **`indexar.py`** (en el runner): para una tienda con `relevo: pc`, primero intenta el relevo directo. Si da error
   (bloqueo, red...) o 0 productos y `historial/relevo-pc/<tienda>.json` tiene **menos de 36 h**
   (`relevo_pc.VIGENCIA_HORAS`), usa esos productos (`relevo_pc.leer_vigente`: solo filas con URL válida, nombre y
   precio > 0):
   - `indice.tiendas.<clave>.relevado` lleva la **hora real** del relevo de la PC, no la de la corrida.
   - Estado (spec 066): cuenta como `ok`; `salud.json` anota en `fuentes.<clave>` `"via": "pc"`, `"motivo": "relevo pc"`
     y el detalle («directo: bloqueo; relevo de la PC del ...»). `/estado/` no tiene hoy un lugar para la vía: muestra
     la fecha del último dato, que ya es la del relevo de la PC.
   - Historial de precios: se anota solo si el relevo es **del mismo día** de la corrida; uno de ayer se publica pero no
     se registra como precio de hoy (ni bajas).
   - Un relevo de más de 36 h (o del futuro, o roto) **no se usa**: la tienda sigue el camino de siempre (bloqueo,
     reuso E1 mientras esté activa, pausa a los 14 días).
5. **Tarea programada** «La Pichincha relevo PC» (`herramientas/instalar-relevo-pc.ps1`): diaria a las **05:30** y al
   iniciar sesión, solo con red, `StartWhenAvailable` (si la PC estaba apagada, corre apenas puede). Ejecuta
   `herramientas/relevo-pc.ps1` (log en `%USERPROFILE%\.la-pichincha\relevo-pc.log`), que no repite si la rama ya tiene
   relevos de las dos tiendas de menos de 12 h (`--saltar-si-menos-de 12`; `-Forzar` lo saltea).
   La tarea corre desde un **clon propio de `main`** en `%USERPROFILE%\.la-pichincha\relevo-codigo` (lo crea el
   instalador; `relevo-pc.ps1` le hace `pull --ff-only` antes de cada corrida): no depende de que el checkout del dueño
   esté en `main` ni al día, y nunca lo toca. Todo va en `%USERPROFILE%\.la-pichincha` y no en AppData: Claude de
   escritorio es una app MSIX y ve `AppData\Local` virtualizado; la tarea no encontraba el script (0x8007010B).

La corrida programada de la mañana (03:23 y 05:47 UTC en el cron; GitHub la arranca de hecho entre las 09 y las 12 de
Argentina) encuentra el relevo de las 05:30 con pocas horas. Las corridas de los push del día también (< 36 h).

## Comandos

```
python relevo_pc.py                         # releva y deja relevo-pc/ en la raiz (ignorado por git), sin publicar
python relevo_pc.py --solo katech
python relevo_pc.py --publicar              # releva y sube a la rama historial
powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\instalar-relevo-pc.ps1          # registra la tarea
powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\instalar-relevo-pc.ps1 -Desinstalar
Start-ScheduledTask -TaskName 'La Pichincha relevo PC'                                            # correrla ya
```

## Tests

`tests/test_relevo_pc.py`: archivo (formato, vigencia de 36 h, roto, futuro, filas inválidas), `relevar` con el
extractor común, publicación contra un repo bare local (commit en `historial`, rebase cuando el runner empujó en el
medio, push que choca y se reintenta, sin `--force`) y la corrida de `indexar.main()` (bloqueada + relevo fresco = ok
con su fecha y `via: pc`; relevo viejo = no se publica; relevo de ayer = sin historial; si el runner puede leer, no se
usa el relevo).

## Límites

- Depende de que la PC esté prendida con sesión iniciada algún momento del día. Si no, a las 36 h la tienda deja de
  publicarse y sigue la spec 066 (pausa a los 14 días sin productos).
- Si FullH4rd o Katech desbloquean al runner, el relevo directo manda y el de la PC queda sin usar; se puede sacar la
  marca `relevo` y desinstalar la tarea.
