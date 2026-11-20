#!/usr/bin/env python3
"""Diagnostico de una corrida fallida de GitHub Actions.

Uso: python herramientas/ci_diagnostico.py <run_id> [--repo dueno/repo]

Hace tres cosas, sin escribir nada:
1. Lista los pasos que fallaron (`gh run view --json jobs`).
2. Busca en el log de esos pasos las firmas de errores ya conocidos (docs/errores-conocidos.md) y dice cual es,
   o avisa que es un error nuevo (hay que registrarlo: ciclo de CLAUDE.md «Errores que vuelven»).
3. Separa intermitente de real: si OTRA corrida del mismo commit termino en verde, es intermitente.

Solo stdlib y el CLI `gh`.
"""

import argparse
import json
import re
import subprocess
import sys

# (id del registro, expresion que aparece en el log, que significa)
FIRMAS = [
    ("E01", re.compile(r"no tiene indice previo en la cache"),
     "La cache del indice no tiene nada para este codigo: lanzar a mano indexar=true; el restore-key sin hash ya lo evita."),
    ("E02", re.compile(r"sin ofertas"),
     "Alarma de la guardia del indice repetida por categoria (ver issue #217 y tests/js/guardia.test.js)."),
    ("E03", re.compile(r"No jobs were run|duplicate key|mapping key .* already defined", re.I),
     "Workflow invalido por clave repetida: correr tests/test_workflows.py."),
    ("E04", re.compile(r"Chrome (?:failed to launch|did not start)|Unable to connect to Chrome|CHROME_INTERSTITIAL", re.I),
     "Chrome del runner no arranco: es intermitente, tests/test_lighthouse_reintento.py cubre el reintento."),
]


def clasificar(log):
    """Devuelve las (id, significado) de los errores conocidos cuya firma aparece en el log."""
    return [(i, texto) for i, patron, texto in FIRMAS if patron.search(log or "")]


def pasos_fallados(datos):
    """De la salida de `gh run view --json jobs`: lista de (job, paso) con conclusion failure."""
    salida = []
    for job in datos.get("jobs", []):
        for paso in job.get("steps", []):
            if paso.get("conclusion") == "failure":
                salida.append((job.get("name", "?"), paso.get("name", "?")))
    return salida


def es_intermitente(corridas, run_id, sha, workflow):
    """True si otra corrida del MISMO workflow y commit termino en verde: la falla no es del codigo.
    (Mirar solo el commit da falsos positivos: los tests del PR pasan en el mismo commit que una publicacion fallida.)"""
    return any(c.get("headSha") == sha and c.get("workflowName") == workflow and c.get("databaseId") != run_id
               and c.get("conclusion") == "success" for c in corridas)


def gh(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=120)
    return r.stdout


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("run_id", type=int)
    ap.add_argument("--repo", default=None)
    args = ap.parse_args(argv)
    repo = ["--repo", args.repo] if args.repo else []

    datos = json.loads(gh("run", "view", str(args.run_id), "--json", "jobs,headSha,workflowName,event", *repo) or "{}")
    fallados = pasos_fallados(datos)
    print(f"Corrida {args.run_id} ({datos.get('workflowName', '?')}, {datos.get('event', '?')}):")
    if not fallados:
        print("  ningun paso fallo (puede estar en curso o cancelada).")
        return 0
    for job, paso in fallados:
        print(f"  FALLO  {job} > {paso}")

    log = gh("run", "view", str(args.run_id), "--log-failed", *repo)
    conocidos = clasificar(log)
    if conocidos:
        for i, texto in conocidos:
            print(f"  Conocido {i}: {texto}")
    else:
        print("  Error NUEVO: no coincide con docs/errores-conocidos.md. Hallar la causa raiz y registrarlo.")

    otras = json.loads(gh("run", "list", "--commit", datos.get("headSha", ""), "--json", "databaseId,headSha,conclusion,workflowName", *repo) or "[]")
    if es_intermitente(otras, args.run_id, datos.get("headSha"), datos.get("workflowName")):
        print("  Intermitente: otra corrida del mismo workflow y commit termino en verde.")
    else:
        print("  Sin corrida verde del mismo commit: tratarlo como real hasta probar lo contrario.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
