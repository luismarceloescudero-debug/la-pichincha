# La Pichincha Constitution

## Core Principles

### I. Estatico primero

- El sitio es estatico: GitHub Pages sirve los archivos y una GitHub Action los arma. No hay
  backend mientras no se dispare un gatillo de la Fase 4 de `docs/plan-de-escalado.md`
  (indice mayor a 1,5 MB gzip, bloqueos de dos o mas tiendas, 300 usuarios por semana o
  busquedas lentas en telefonos de gama baja).
- Python usa solo la biblioteca estandar. El sitio no suma dependencias JS: los modulos de
  `js/` son scripts comunes, sin build. La unica libreria externa permitida es la que ya se
  carga bajo demanda (ExcelJS) y solo cuando la persona la pide.
- Razon: el cuello de botella son los usuarios, no la tecnologia; cada dependencia es costo
  de mantenimiento para un solo desarrollador.

### II. Datos honestos y verificables

- Cada precio muestra de donde sale y cuando se verifico, en hora argentina. No se muestran
  precios viejos como si fueran del dia.
- El orden de los resultados NUNCA depende de una comision. Todo enlace de afiliado se rotula.
- Una rebaja publicada cuenta solo entre 15% y 60%; la baja propia se mide contra el
  historial, no contra el precio tachado de la tienda.
- Lo que no es comparable se separa y se dice cuanto quedo afuera: equipos completos,
  usados, accesorios, "simil", compras internacionales.
- Razon: la confianza es el producto; un comparador que miente una vez pierde a la persona.

### III. Respeto a las fuentes

- Se releva con pausas entre pedidos y una sola vez por dia por fuente.
- Un desafio antibots, un bloqueo o un `robots.txt` que excluye la ruta NUNCA se esquivan:
  se avisa (issue `salud-fuente`), se conserva el dato anterior y se pide permiso o un feed.
- Una fuente caida o bajo el 70% de lo que tenia no borra su catalogo del historial.
- Razon: sin las tiendas no hay datos; el acceso acordado vale mas que el acceso forzado.

### IV. Pruebas antes de publicar (NO NEGOCIABLE)

- La logica nueva se escribe con TDD: test que falla, codigo minimo, test que pasa.
- Los tests de Python (`python -m unittest discover -s tests -t .`) y de JS
  (`node --test "tests/js/*.test.js"`) corren en cada PR y antes de cada despliegue.
  Si uno falla, no se commitea ni se publica nada.
- Los extractores se prueban contra HTML guardado de cada tienda (`tests/fixtures/`), nunca
  contra la red.
- Todo bug arreglado deja un test que lo reproducia.

### V. Medir antes de agregar UI

- La analitica es sin cookies y sin banner (GoatCounter); no se guardan datos personales.
- No se suman pantallas ni funciones de UI que la analitica no justifique. La metrica norte
  son los clics salientes a tiendas por semana.
- Un cambio visible se muestra con capturas de antes y despues, en tema claro y oscuro.

## Restricciones tecnicas

- `index.html` es el unico HTML que se edita a mano; la copia del artifact
  (`comparativa-ram-ddr4-16gb.html`) la genera `python actualizar.py --build`.
- La logica pura vive en `js/buscador.js`, `js/pagina.js`, `historial.py` y `salud.py`, con tests.
- El indice es posicional; los campos nuevos van al final y `FILA_VACIA` en `indexar.py`
  define el valor por defecto de cada uno para filas de indices viejos.
- El historial de precios vive en la rama huerfana `historial`, un CSV por mes, solo cambios.
- Todo color sale de variables CSS definidas en tema claro y en tema oscuro; ninguna pantalla
  puede verse mal en oscuro.
- La hora es la argentina (UTC-3 fijo).

## Flujo de trabajo

- Idioma: español rioplatense en la conversacion y en la documentacion; commits en español
  sin tildes; identificadores y comandos sin traducir.
- Todo cambio va por rama y PR con CI en verde. Mergear a `main` despliega el sitio: requiere
  el OK explicito del dueño.
- Herramientas, sin pisarse:
  - spec-kit define el que y el por que: esta constitucion y, por feature,
    `/speckit-specify` -> `/speckit-clarify` -> `/speckit-plan` -> `/speckit-tasks`.
  - Superpowers define el como: TDD para implementar, `systematic-debugging` para bugs y
    `verification-before-completion` antes de dar algo por terminado.
  - addyosmani/agent-skills queda para auditorias puntuales (`/review`, `/webperf`,
    `/ship`, revision de seguridad) antes de publicar.
  - ECC no se instala: sus agentes, hooks y memoria se pisan con Superpowers y spec-kit.
- Se anuncia el inicio y el fin de cada fase o tarea.

## Governance

- Esta constitucion prevalece sobre cualquier otra practica del repo. Cada plan de feature
  verifica su cumplimiento en la seccion "Constitution Check" y justifica toda excepcion.
- Una enmienda se hace por PR, con el cambio de version y la razon en la descripcion.
- Versionado semantico: MAJOR si se quita o redefine un principio, MINOR si se agrega uno o
  se amplia materialmente, PATCH si se aclara la redaccion.
- La guia operativa del dia a dia esta en `README.md` y `docs/plan-de-escalado.md`.

**Version**: 1.0.1 | **Ratified**: 2026-10-08 | **Last Amended**: 2026-10-09
