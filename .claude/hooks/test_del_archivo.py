#!/usr/bin/env python3
"""Despues de editar js/<nombre>.js corre solo tests/js/<nombre>.test.js (hook PostToolUse).

Un .json editado que no se puede leer tambien se avisa (una coma de mas rompe el sitio y la CI se entera tarde).
Tambien para los .py de la raiz: al editar modelo.py corre `python -m unittest tests.test_modelo`.
Si el test falla, devuelve el error al modelo (codigo 2) para que lo vea al instante, sin esperar a la CI.
Si pasa, o el archivo no tiene test propio, no dice nada. Solo stdlib.
"""

import json
import os
import subprocess
import sys


def test_de(ruta):
    """El test de un js/<nombre>.js del repo (node --test) o de un <nombre>.py de la raiz (unittest), o None.

    Devuelve la ruta del archivo de test; quien lo corre decide el comando por la extension.
    """
    ruta = os.path.abspath(ruta or "")
    carpeta, archivo = os.path.split(ruta)
    if archivo.endswith(".py") and not archivo.startswith("test_"):
        test = os.path.join(carpeta, "tests", "test_" + archivo)
        return test if os.path.isfile(test) else None
    if os.path.basename(carpeta) != "js" or not archivo.endswith(".js") or archivo.endswith(".test.js"):
        return None
    test = os.path.join(os.path.dirname(carpeta), "tests", "js", archivo[:-3] + ".test.js")
    return test if os.path.isfile(test) else None


def json_roto(ruta):
    """El mensaje de error si `ruta` es un .json que ya no se puede leer, o None (no es .json, no existe o esta bien)."""
    if not (ruta or "").endswith(".json") or "node_modules" in ruta or not os.path.isfile(ruta):
        return None
    try:
        with open(ruta, encoding="utf-8") as f:
            json.load(f)
    except (ValueError, OSError) as e:
        return os.path.basename(ruta) + " quedo con JSON invalido despues de la edicion: " + str(e)
    return None


def main():
    try:
        datos = json.load(sys.stdin)
    except ValueError:
        return 0
    ruta = (datos.get("tool_input") or {}).get("file_path")
    roto = json_roto(ruta)
    if roto:
        print(roto, file=sys.stderr)
        return 2
    test = test_de(ruta)
    if not test:
        return 0
    try:
        comando = [sys.executable, "-m", "unittest", test] if test.endswith(".py") else ["node", "--test", test]
        raiz = os.path.dirname(os.path.dirname(test)) if test.endswith(".py") else os.path.dirname(os.path.dirname(os.path.dirname(test)))
        r = subprocess.run(comando, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=60, cwd=raiz)
    except (OSError, subprocess.TimeoutExpired) as e:
        print("No se pudo correr " + test + ": " + str(e), file=sys.stderr)
        return 0
    if r.returncode != 0:
        salida = [l for l in (r.stdout + r.stderr).strip().splitlines() if not l.lstrip().startswith("✔")]
        print("Fallo " + os.path.basename(test) + " despues de la edicion:\n" + "\n".join(salida[-40:]), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
