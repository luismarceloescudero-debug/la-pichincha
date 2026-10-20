#!/usr/bin/env python3
"""Valida datos/ganadores.json (ganadores por categoria con pruebas de laboratorio) y mide su cobertura.

El archivo lo arma una persona a mano contra la fuente (ver docs/ganadores-referencia.md): este script no lee
ningun sitio. Solo comprueba el esquema y, con --cobertura, cuantos ganadores existen en el indice publicado.

    python generar_ganadores.py                       # valida
    python generar_ganadores.py --cobertura indice.json
"""

import argparse
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

RUTA = Path(__file__).resolve().parent / "datos" / "ganadores.json"
CATEGORIAS = ("smartphone", "notebook", "monitor", "gpu", "procesador", "ssd", "auriculares")
CRITERIOS = ("rendimiento", "duracion", "pantalla", "materiales", "tecnologia")
CONFIANZA = ("confirmado", "sin confirmar")
OBLIGATORIOS = ("modelo", "categoria", "puntaje", "escala", "criterios", "fuente", "fecha", "confianza")


def validar(datos):
    """Devuelve la lista de errores del documento (vacia si esta bien)."""
    errores = []
    if not isinstance(datos, dict):
        return ["el documento no es un objeto"]
    if not str(datos.get("_nota", "")).strip():
        errores.append("falta _nota (fecha de generacion y esquema)")
    try:
        date.fromisoformat(str(datos.get("generado", "")))
    except ValueError:
        errores.append("generado no es una fecha ISO")
    lista = datos.get("ganadores")
    if not isinstance(lista, list) or not lista:
        return errores + ["ganadores debe ser una lista no vacia"]
    vistos = set()
    for i, g in enumerate(lista):
        errores += _validar_ganador(g, f"ganadores[{i}]", vistos)
    return errores


def _validar_ganador(g, donde, vistos):
    if not isinstance(g, dict):
        return [f"{donde}: no es un objeto"]
    errores = [f"{donde}: falta {c}" for c in OBLIGATORIOS if c not in g]
    if errores:
        return errores
    donde = f"{donde} ({g['modelo']})"
    if not str(g["modelo"]).strip():
        errores.append(f"{donde}: modelo vacio")
    if g["categoria"] not in CATEGORIAS:
        errores.append(f"{donde}: categoria desconocida {g['categoria']!r}")
    clave = (g["categoria"], str(g["modelo"]).strip().lower())
    if clave in vistos:
        errores.append(f"{donde}: duplicado en la categoria")
    vistos.add(clave)
    p = g["puntaje"]
    if isinstance(p, bool) or not isinstance(p, (int, float)) or not 0 <= p <= 100:
        errores.append(f"{donde}: puntaje fuera de 0-100")
    if not str(g["escala"]).strip():
        errores.append(f"{donde}: falta explicar la escala del puntaje")
    errores += _validar_criterios(g["criterios"], donde)
    f = g["fuente"]
    if not (isinstance(f, dict) and str(f.get("nombre", "")).strip() and str(f.get("url", "")).startswith("https://")):
        errores.append(f"{donde}: fuente necesita nombre y url https")
    try:
        date.fromisoformat(str(g["fecha"]))
    except ValueError:
        errores.append(f"{donde}: fecha no es ISO")
    if g["confianza"] not in CONFIANZA:
        errores.append(f"{donde}: confianza debe ser una de {CONFIANZA}")
    return errores


def _validar_criterios(c, donde):
    if not isinstance(c, dict) or not c:
        return [f"{donde}: criterios vacios"]
    errores = []
    for k, v in c.items():
        if k not in CRITERIOS:
            errores.append(f"{donde}: criterio desconocido {k!r}")
        elif not (isinstance(v, dict) and "valor" in v and str(v.get("unidad", "")).strip()):
            errores.append(f"{donde}: criterio {k} necesita valor y unidad")
    return errores


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def cobertura(datos, indice):
    """Por ganador: cuantos avisos del indice lo nombran (por su modelo o alias, en el campo modelo o el titulo)."""
    campos = indice["campos"]
    inom, imod = campos.index("nombre"), campos.index("modelo")
    textos = [(" " + _norm(p[inom]) + " ", _norm(p[imod])) for p in indice["productos"]]
    filas = []
    for g in datos["ganadores"]:
        claves = [_norm(a) for a in [g["modelo"]] + list(g.get("alias", []))]
        n = sum(1 for t, m in textos if any(m == k or f" {k} " in t for k in claves if k))
        filas.append((g["categoria"], g["modelo"], n))
    return filas


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--cobertura", metavar="INDICE", help="indice.json publicado")
    args = ap.parse_args(argv)
    datos = json.loads(RUTA.read_text(encoding="utf-8"))
    errores = validar(datos)
    for e in errores:
        print("ERROR", e)
    if errores:
        return 1
    print(f"OK: {len(datos['ganadores'])} ganadores")
    if args.cobertura:
        indice = json.loads(Path(args.cobertura).read_text(encoding="utf-8"))
        filas = cobertura(datos, indice)
        for cat, mod, n in filas:
            print(f"{cat:12} {mod:40} {n:5} avisos")
        print(f"{sum(1 for f in filas if f[2])} de {len(filas)} ganadores estan en el indice; {sum(f[2] for f in filas)} avisos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
