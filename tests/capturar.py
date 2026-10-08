#!/usr/bin/env python3
"""Baja y recorta el HTML guardado que usan los tests de los extractores.

Uso, desde la raiz del repo:
    python tests/capturar.py              # todas las fuentes
    python tests/capturar.py mexx         # una sola

Los tests no salen a la red: leen lo que deja este script en tests/fixtures/.
Se vuelve a correr cuando una tienda cambia su plantilla (la Action abre un
issue "Fuente con pocos productos"): el test falla contra el HTML nuevo y se
corrige la regex en tiendas.json.
"""

import json
import re
import sys
import urllib.error
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import actualizar  # noqa: E402
import indexar  # noqa: E402

FIXTURES = RAIZ / "tests" / "fixtures"
TARJETAS = 4          # tarjetas por listado
FILAS = 5             # filas de los catalogos JSON
SIN_CODIGO = re.compile(r"<(script|style|svg)\b[\s\S]*?</\1>", re.I)
DATOS = json.loads((RAIZ / "datos.json").read_text(encoding="utf-8"))
TIENDAS = json.loads((RAIZ / "tiendas.json").read_text(encoding="utf-8"))


def guardar(clave, nombre, texto):
    ruta = FIXTURES / clave / nombre
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(texto, encoding="utf-8", newline="\n")
    print(f"  {ruta.relative_to(RAIZ).as_posix()} · {len(texto.encode()) // 1024} KB")


def listado(clave, tienda):
    """Las primeras tarjetas que se leen enteras, tal como las parte tarjetas()."""
    cfg = tienda["catalogo"]
    for fuente in indexar.listados(tienda)[:15]:
        html = indexar.bajar(cfg["pagina"].format(listado=fuente, n=cfg.get("desde", 1)))
        # tarjetas() solo mira los primeros 6000 caracteres de cada una: el resto sobra.
        buenas = [t[:6000] for t in html.split(cfg["tarjeta"])[1:]
                  if len(indexar.tarjetas(cfg["tarjeta"] + t, cfg)) == 1]
        if len(buenas) >= TARJETAS:
            guardar(clave, "listado.html", "".join(cfg["tarjeta"] + t for t in buenas[:TARJETAS]))
            return
    raise SystemExit(f"{clave}: ningun listado trajo {TARJETAS} tarjetas legibles")


def producto(clave):
    """La pagina de un producto curado, sin scripts ni estilos si el extractor lee lo mismo."""
    prod = next(p for p in DATOS["productos"] if p["tienda"] == clave and p["fuente"]["tipo"] != "compragamer")
    extractor = actualizar.EXTRACTORES[prod["fuente"]["tipo"]]
    html = actualizar.bajar(prod["url"])
    chico = SIN_CODIGO.sub("", html)

    def leer_con(texto):
        original = actualizar.bajar
        actualizar.bajar = lambda url, binario=False: texto
        try:
            return extractor(prod)
        finally:
            actualizar.bajar = original

    completo = leer_con(html)
    guardar(clave, "producto.html", chico if leer_con(chico) == completo else html)


def compragamer():
    filas = json.loads(indexar.bajar(actualizar.CATALOGO_CG))
    curados = {int(p["fuente"]["id_producto"]) for p in DATOS["productos"]
               if p["fuente"]["tipo"] == "compragamer"}
    elegidas = [f for f in filas if int(f["id_producto"]) in curados]
    elegidas += [f for f in filas if int(f["id_producto"]) not in curados and f.get("imagenes")][:FILAS]
    guardar("compragamer", "catalogo.json", json.dumps(elegidas, ensure_ascii=False, indent=1))


def comparaya(tienda):
    cfg = tienda["catalogo"]
    cuerpo = json.loads(indexar.bajar(cfg["plantilla"].format(categoria=cfg["categorias"][0], n=1)))
    guardar("comparaya", "api.json",
            json.dumps({cfg["lista"]: cuerpo[cfg["lista"]][:FILAS]}, ensure_ascii=False, indent=1))


def main(argv):
    pedidas = set(argv) or {k for k in TIENDAS if not k.startswith("_")}
    fallidas = []
    for clave in sorted(pedidas):
        print(clave)
        tienda = TIENDAS[clave]
        try:
            if clave == "compragamer":
                compragamer()
            elif clave == "comparaya":
                comparaya(tienda)
            else:
                listado(clave, tienda)
                producto(clave)
        except urllib.error.HTTPError as e:
            # Un 403 suele ser un desafio antibots (Cloudflare): no se esquiva,
            # se deja el fixture que habia y se sigue con las demas.
            print(f"  no respondio ({e.code}): queda el fixture anterior, si habia")
            fallidas.append(clave)
    return 1 if fallidas else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
