#!/usr/bin/env python3
"""Deja en la carpeta del sitio lo que necesita la app instalable.

Uso:
    python publicar_app.py --salida _sitio --indice indice.json

Estampa la version en sw.js (reemplaza __VERSION__ por <fecha del indice>-<commit corto>), asi cada
publicacion tiene su propia cache y el service worker descarta las de las versiones anteriores, y
copia el manifiesto, la pagina de "sin conexion" y los iconos. Solo stdlib.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
# Lo que se copia tal cual; sw.js va aparte porque lleva la version estampada.
ARCHIVOS_DE_LA_CASCARA = [
    "manifest.webmanifest", "sin-red.html",
    "img/icono-192.png", "img/icono-512.png", "img/icono-maskable-512.png", "img/apple-touch-icon.png",
]


def commit_corto():
    """El commit de la publicacion: GITHUB_SHA en la Action, git en tu maquina, 'local' si no hay ninguno."""
    sha = os.environ.get("GITHUB_SHA")
    if not sha:
        try:
            sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=RAIZ, capture_output=True, text=True,
                                 check=True).stdout.strip()
        except (OSError, subprocess.CalledProcessError):
            sha = "local"
    return sha[:7]


def version(indice, commit):
    """'20261009T0812-abc1234': la fecha y hora del indice (si hay) y el commit."""
    generado = ""
    if indice and Path(indice).exists():
        try:
            generado = json.loads(Path(indice).read_text(encoding="utf-8")).get("generado") or ""
        except ValueError:
            generado = ""
    fecha = re.sub(r"[^0-9T]", "", generado[:16])       # 2026-10-09T08:12 -> 20261009T0812
    return f"{fecha}-{commit}" if fecha else commit


def main(argv=None):
    ap = argparse.ArgumentParser(description="Deja la app instalable en la carpeta del sitio.")
    ap.add_argument("--salida", default=str(RAIZ / "_sitio"))
    ap.add_argument("--indice", default=None, help="indice.json, para fechar la version")
    ap.add_argument("--commit", default=None, help="commit de la publicacion (por defecto, el actual)")
    args = ap.parse_args(argv)

    salida = Path(args.salida)
    v = version(args.indice, (args.commit or commit_corto())[:7])
    plantilla = (RAIZ / "sw.js").read_text(encoding="utf-8")
    if "__VERSION__" not in plantilla:
        raise RuntimeError("sw.js no tiene el marcador __VERSION__: no se puede estampar la version")
    salida.mkdir(parents=True, exist_ok=True)
    (salida / "sw.js").write_text(plantilla.replace("__VERSION__", v), encoding="utf-8")
    for ruta in ARCHIVOS_DE_LA_CASCARA:
        destino = salida / ruta
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(RAIZ / ruta, destino)
    print(f"app instalable: version {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
