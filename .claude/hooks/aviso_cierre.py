#!/usr/bin/env python3
"""Al terminar un turno (hook Stop) avisa si quedaron cambios sin commitear: la regla global es que nada queda suelto.

Solo muestra un mensaje; no frena ni obliga a seguir. Si git falla o no hay nada, no dice nada. Solo stdlib.
"""

import json
import subprocess
import sys


def pendientes(cwd=None):
    """Lineas de `git status --porcelain`, o [] si no hay cambios o git no responde."""
    try:
        r = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=15, cwd=cwd)
    except (OSError, subprocess.TimeoutExpired):
        return []
    return r.stdout.splitlines() if r.returncode == 0 else []


def main():
    lineas = pendientes()
    if lineas:
        json.dump({"systemMessage": "Quedan " + str(len(lineas)) + " archivo(s) sin commitear (git status). "
                   "La regla es no dejar nada suelto: commitealos o decidi que hacer."}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
