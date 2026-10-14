# CONSTRAINTS: la vara de calidad de La Pichincha

Contrato escrito de lo que un cambio no puede empeorar (plan v2, A2). Cada umbral lo hace cumplir la CI
(`.github/workflows/tests.yml`), que corre en cada PR y antes de cada publicacion. **Un umbral nunca se
baja para que un PR pase**: si hace falta cambiarlo, va en un PR propio que diga por que, con el OK del
dueño. Subirlos cuando la medicion real los supera, si.

| Dimension | Umbral | Como se mide | Bloquea |
| --- | --- | --- | --- |
| Tests | 100% en verde | `python -m unittest` y `node --test` | si |
| Cobertura de Python | >= 85% de lineas (hoy 87%) | `coverage report --fail-under=85` | si |
| Cobertura de JS | >= 90% de lineas, >= 85% de ramas y funciones (hoy 95/88/94) | `node --test --test-coverage-*` | si |
| Contraste (WCAG AA) | >= 4,5:1 en todo texto, tema claro y oscuro | `tests/test_contraste.py` sobre las variables de `css/sitio.css` | si |
| Enlaces internos | ninguno roto en el sitio armado | `tests/test_integracion.py` | si |
| Politica de contenido (CSP) | en todas las paginas, sin `unsafe-eval`, con `object-src 'none'` | `tests/test_sitio.py`, `tests/test_integracion.py` | si |
| Lighthouse movil: accesibilidad, buenas practicas, SEO | >= 90 | job `lighthouse` sobre /, /precios/, /hoy/, /estado/ y /legal/ | si |
| Lighthouse movil: rendimiento | >= 90 | el mismo job | aviso, hasta partir el indice (A3) |

## Por que asi

- **Cobertura**: los umbrales estan apenas debajo de lo medido el 14/10/2026, no en el piso de 80% del
  plan: asi no hay margen para que la cobertura retroceda sin que se note.
- **Rendimiento como aviso**: en el runner de GitHub el puntaje varia varios puntos entre corridas, y
  la portada mide 92 con el indice entero de 2,9 MB. Cuando A3 parta el indice por rubro, pasa a
  bloquear.
- **CSP con `unsafe-inline` en scripts**: `index.html` lleva los datos del dia en un script en linea, asi
  que un hash fijo no sirve. Lo que si cierra: scripts solo de los dominios listados, conexiones solo al
  propio sitio y a GoatCounter, sin `object`, sin `base` y sin enviar formularios afuera. Va como
  `<meta>` porque GitHub Pages no deja poner cabeceras.

## Que no es un cambio valido

- Agregar `skip`, borrar un test o vaciar una asercion para que la CI pase.
- Bajar un numero de esta tabla o de `tests.yml` en el mismo PR que lo necesitaria.
- Sumar un dominio a la CSP sin decir en el PR que se carga de el y por que.
