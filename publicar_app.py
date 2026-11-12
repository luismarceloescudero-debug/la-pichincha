#!/usr/bin/env python3
"""Deja en la carpeta del sitio lo que necesita la app instalable.

Uso:
    python publicar_app.py --salida _sitio --indice indice.json

Estampa la version en sw.js (reemplaza __VERSION__ por <fecha del indice>-<commit corto>), asi cada
publicacion tiene su propia cache y el service worker descarta las de las versiones anteriores, y
copia el manifiesto, la pagina de "sin conexion" y los iconos.

Desde la fase 3 del plan v4 tambien deja lo que necesita la app Android (TWA): /.well-known/assetlinks.json
(la prueba de que la app es nuestra, armada con el paquete y las huellas SHA-256 de sitio.json) y
.nojekyll, sin el cual GitHub Pages no sirve las carpetas que empiezan con punto. Solo stdlib.
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
# Datos que la pagina pide cuando hacen falta (no son de la cascara: el service worker no los guarda de entrada).
ARCHIVOS_DE_DATOS = ["datos/ganadores.json"]

# La app Android (TWA): el paquete y las huellas SHA-256 de los certificados de firma. Sin `app_android` en
# sitio.json se usan estos valores; la huella no es un secreto (es la parte publica del certificado).
PAQUETE_POR_DEFECTO = "ar.com.pichinchadeldia.app"
RELACION_DE_LA_APP = "delegate_permission/common.handle_all_urls"
HUELLA_SHA256 = re.compile(r"^([0-9A-F]{2}:){31}[0-9A-F]{2}$")


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


def leer_sitio(ruta=None):
    """sitio.json, o {} si no esta o no se puede leer: la app no puede frenar la publicacion del sitio."""
    try:
        return json.loads(Path(ruta or RAIZ / "sitio.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def app_android(sitio):
    """El bloque `app_android` de sitio.json, con el paquete por defecto y sin huellas si falta."""
    bloque = (sitio or {}).get("app_android") or {}
    return {
        "paquete": bloque.get("paquete") or PAQUETE_POR_DEFECTO,
        "huellas_sha256": list(bloque.get("huellas_sha256") or []),
    }


def escribir_assetlinks(salida, app):
    """Deja /.well-known/assetlinks.json (y .nojekyll) y devuelve las huellas que publico.

    Sin huellas cargadas el archivo se escribe igual (la ruta queda armada y el vigia no ve un 404), pero la app
    no verifica el dominio hasta que se cargue la del certificado de firma: se avisa para que no pase inadvertido.
    """
    salida = Path(salida)
    huellas = []
    for huella in app["huellas_sha256"]:
        if HUELLA_SHA256.match(huella):
            huellas.append(huella)
        else:
            print(f"::warning::assetlinks: la huella {huella!r} no es un SHA-256 de certificado: no se publica")
    declaracion = [{
        "relation": [RELACION_DE_LA_APP],
        "target": {
            "namespace": "android_app",
            "package_name": app["paquete"],
            "sha256_cert_fingerprints": huellas,
        },
    }]
    destino = salida / ".well-known"
    destino.mkdir(parents=True, exist_ok=True)
    (destino / "assetlinks.json").write_text(json.dumps(declaracion, indent=2, ensure_ascii=False) + "\n",
                                             encoding="utf-8")
    # GitHub Pages no sirve las carpetas que empiezan con punto si el sitio se arma con Jekyll.
    (salida / ".nojekyll").write_text("", encoding="utf-8")
    if not huellas:
        print("::warning::assetlinks sin huellas: la app Android todavia no va a verificar el dominio. "
              "La huella SHA-256 del certificado de firma se carga en app_android.huellas_sha256 de sitio.json "
              "(la imprime el workflow app.yml).")
    return huellas


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
    for ruta in ARCHIVOS_DE_LA_CASCARA + ARCHIVOS_DE_DATOS:
        destino = salida / ruta
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(RAIZ / ruta, destino)
    print(f"app instalable: version {v}")
    huellas = escribir_assetlinks(salida, app_android(leer_sitio()))
    print(f"assetlinks: {len(huellas)} huella(s) de firma de la app Android")
    return 0


if __name__ == "__main__":
    sys.exit(main())
