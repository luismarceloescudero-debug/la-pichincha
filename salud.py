#!/usr/bin/env python3
"""Salud de las fuentes: avisa con un issue cuando una tienda trae poco.

Uso:
    python salud.py salud.json          # abre o comenta issues con gh
    python salud.py salud.json --seco   # solo muestra lo que haria

indexar.py escribe salud.json con evaluar(). Una fuente esta sana si no
fallo, trajo al menos un producto y llego al 70% de los productos vivos que
tenia en el historial. Con la misma regla el historial decide si registra las
bajas de esa fuente.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

UMBRAL = 0.7
ETIQUETA = "salud-fuente"
SALUD = Path(__file__).resolve().parent / "salud.json"


def evaluar(vivos, relevados, nombres, fecha, umbral=UMBRAL):
    """Compara lo que trajo cada fuente relevada hoy contra lo que tenia vivo."""
    fuentes = {}
    for clave, ahora in relevados.items():
        previo = vivos.get(clave, 0)
        if ahora == 0:
            estado = "fallo"
        elif previo and ahora < umbral * previo:
            estado = "baja"
        else:
            estado = "ok"
        fuentes[clave] = {"nombre": nombres.get(clave, clave), "previo": previo,
                          "ahora": ahora, "estado": estado}
    return {"fecha": fecha, "umbral": umbral, "fuentes": fuentes}


def alertas(informe):
    if informe is None:                       # indexar.py se cayo antes de escribirlo
        return [{"clave": "indexado", "nombre": "el indexado", "previo": 0, "ahora": 0,
                 "estado": "caido"}]
    return [dict(f, clave=k) for k, f in informe["fuentes"].items() if f["estado"] != "ok"]


def titulo(alerta):
    if alerta["estado"] == "caido":
        return "El indexado de precios no termino"
    return "Fuente con pocos productos: " + alerta["nombre"]


def cuerpo(alerta, url_corrida):
    if alerta["estado"] == "caido":
        return ("El paso `indexar.py` de la corrida programada fallo antes de escribir "
                "`salud.json`, asi que no hay numeros por fuente. El sitio se publico con "
                "el indice anterior.\n\nCorrida: " + url_corrida)
    pct = round(100 * alerta["ahora"] / alerta["previo"]) if alerta["previo"] else 0
    return "\n".join([
        f"**{alerta['nombre']}** trajo {alerta['ahora']} productos contra {alerta['previo']} "
        f"de la corrida anterior ({pct}%). El umbral es {round(100 * UMBRAL)}%.",
        "",
        "Mientras siga abajo del umbral, el historial no registra sus bajas: una tienda que "
        "bloquea a medias no borra su catalogo.",
        "",
        "Que revisar:",
        "- `python indexar.py --solo " + alerta["clave"] + " --max-paginas 2` para ver si responde.",
        "- `python indexar.py --probar <url de un producto>` si cambio la plantilla.",
        "- `python tests/capturar.py " + alerta["clave"] + "` y los tests, para ver que regex rompio.",
        "",
        "Corrida: " + url_corrida,
    ])


def url_corrida():
    e = os.environ
    if e.get("GITHUB_RUN_ID"):
        return (f"{e.get('GITHUB_SERVER_URL', 'https://github.com')}/{e['GITHUB_REPOSITORY']}"
                f"/actions/runs/{e['GITHUB_RUN_ID']}")
    return "(corrida local)"


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def main(argv=None):
    ap = argparse.ArgumentParser(description="Abre issues cuando una fuente trae poco.")
    ap.add_argument("ruta", nargs="?", default=str(SALUD))
    ap.add_argument("--seco", action="store_true", help="muestra lo que haria sin tocar GitHub")
    args = ap.parse_args(argv)

    ruta = Path(args.ruta)
    informe = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None
    lista = alertas(informe)
    if not lista:
        print("todas las fuentes sanas")
        return 0

    url = url_corrida()
    if args.seco:
        for a in lista:
            print("# " + titulo(a) + "\n\n" + cuerpo(a, url) + "\n")
        return 0

    gh("label", "create", ETIQUETA, "--color", "d93f0b",
       "--description", "Una fuente de precios trajo menos de lo esperado", "--force")
    abiertos = {i["title"]: i["number"] for i in json.loads(
        gh("issue", "list", "--label", ETIQUETA, "--state", "open", "--json", "number,title",
           "--limit", "100") or "[]")}
    for a in lista:
        t, c = titulo(a), cuerpo(a, url)
        if t in abiertos:
            gh("issue", "comment", str(abiertos[t]), "--body", c)
            print("comentado #" + str(abiertos[t]) + ": " + t)
        else:
            gh("issue", "create", "--title", t, "--body", c, "--label", ETIQUETA)
            print("abierto: " + t)
    return 0


if __name__ == "__main__":
    sys.exit(main())
