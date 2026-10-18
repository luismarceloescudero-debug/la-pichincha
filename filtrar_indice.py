#!/usr/bin/env python3
"""Saca del indice las publicaciones que verificar_ofertas.py encontro caidas.

Uso:
    python filtrar_indice.py indice.json descartadas.json

Reescribe indice.json sin esas filas (se reconocen por el enlace, que es el tercer campo de cada fila), asi no
aparecen ni en la pestana Ofertas ni en el buscador ni en el feed. Sin lista, o con la lista rota, no toca nada.
"""

import json
import sys


def filtrar(datos, caidas):
    """(datos sin las filas caidas, cuantas se sacaron). No modifica 'datos'."""
    caidas = set(caidas)
    filas = datos.get("productos") or []
    quedan = [f for f in filas if not (isinstance(f, list) and len(f) > 2 and f[2] in caidas)]
    return {**datos, "productos": quedan}, len(filas) - len(quedan)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) < 2:
        print("uso: filtrar_indice.py indice.json descartadas.json")
        return 0
    try:
        with open(argv[1], encoding="utf-8") as f:
            caidas = json.load(f)
        with open(argv[0], encoding="utf-8") as f:
            datos = json.load(f)
    except (OSError, ValueError):
        print("Sin lista de caídas o sin índice legible: el índice queda como está")
        return 0
    if not isinstance(caidas, list) or not isinstance(datos, dict) or not caidas:
        return 0
    nuevo, sacadas = filtrar(datos, caidas)
    if sacadas:
        with open(argv[0], "w", encoding="utf-8") as f:
            json.dump(nuevo, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Índice sin publicaciones caídas: {sacadas} fila(s) sacada(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
