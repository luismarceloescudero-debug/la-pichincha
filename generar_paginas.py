#!/usr/bin/env python3
"""Paginas estaticas por busqueda popular: /precios/<slug>/, indice, sitemap y robots.

Uso:
    python generar_paginas.py --indice indice.json --salida _sitio

La lista de consultas vive en consultas.json: agregar una entrada y publicar crea su pagina.
El analisis de cada consulta lo hace js/analisis.js, el mismo modulo que usa la Comparativa
del sitio, asi que pagina y comparativa dan siempre lo mismo.
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path
from xml.sax.saxutils import escape

RAIZ = Path(__file__).resolve().parent
CONSULTAS = RAIZ / "consultas.json"
LARGO_MIN, LARGO_MAX = 2, 60
# Unico lugar con el dominio: con el .com.ar (F1.4) se cambia aca y se reenvia el sitemap.
BASE_URL = "https://luismarceloescudero-debug.github.io/la-pichincha"


def slug(consulta):
    """'Monitor 27" 144hz' -> 'monitor-27-144hz': minusculas, sin acentos, solo letras, numeros y guiones."""
    sin_acentos = unicodedata.normalize("NFD", consulta).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", sin_acentos.lower()).strip("-")
    if not s:
        raise ValueError(f"la consulta {consulta!r} no deja ningun caracter para la URL")
    return s


def cargar_consultas(ruta=CONSULTAS):
    """Lee y valida consultas.json (contracts/consultas.schema.md). Devuelve [{q, nota, slug}]."""
    datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    if not isinstance(datos, list):
        raise ValueError("consultas.json tiene que ser una lista de objetos {q, nota}")
    salida, vistos = [], {}
    for i, e in enumerate(datos, 1):
        q = e.get("q") if isinstance(e, dict) else None
        if not isinstance(q, str):
            raise ValueError(f"la entrada {i} de consultas.json no tiene 'q'")
        if not LARGO_MIN <= len(q.strip()) <= LARGO_MAX:
            raise ValueError(f"la consulta {q!r} tiene que medir entre {LARGO_MIN} y {LARGO_MAX} caracteres")
        s = slug(q)
        if s in vistos:
            raise ValueError(f"las consultas {vistos[s]!r} y {q!r} dan la misma URL: /precios/{s}/")
        vistos[s] = q
        salida.append({"q": q, "nota": e.get("nota", ""), "slug": s})
    return salida


def sitemap(paginas, generado, base_url=BASE_URL):
    """sitemap.xml: la principal, el indice /precios/ y solo las paginas indexables.
    lastmod es la fecha de los precios; sin indice no hay fecha ni paginas (FR-016)."""
    fecha = (generado or "")[:10]
    urls = [base_url + "/"]
    if paginas or generado:
        urls.append(base_url + "/precios/")
        urls += [f"{base_url}/precios/{p['slug']}/" for p in paginas if p["indexable"]]
    filas = [f"  <url><loc>{escape(u)}</loc>" + (f"<lastmod>{fecha}</lastmod>" if fecha else "") + "</url>" for u in urls]
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(filas) + "\n</urlset>\n")


def robots(base_url=BASE_URL):
    return f"User-agent: *\nAllow: /\n\nSitemap: {base_url}/sitemap.xml\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Genera las paginas por busqueda popular.")
    ap.add_argument("--indice", default=str(RAIZ / "indice.json"))
    ap.add_argument("--consultas", default=str(CONSULTAS))
    ap.add_argument("--salida", default=str(RAIZ / "_sitio"))
    ap.add_argument("--base-url", default=BASE_URL)
    args = ap.parse_args(argv)

    consultas = cargar_consultas(args.consultas)      # una lista invalida corta antes de generar nada
    manifiesto = {"generado": None, "paginas": []}
    with tempfile.TemporaryDirectory() as tmp:
        validadas = Path(tmp) / "consultas-validadas.json"
        validadas.write_text(json.dumps(consultas, ensure_ascii=False), encoding="utf-8")
        salida_manifiesto = Path(tmp) / "manifiesto.json"
        hecho = subprocess.run(
            ["node", str(RAIZ / "generar_paginas.js"), "--indice", args.indice, "--consultas", str(validadas),
             "--salida", args.salida, "--base-url", args.base_url, "--datos", str(RAIZ / "datos.json"),
             "--manifiesto", str(salida_manifiesto)],
            capture_output=True, text=True, encoding="utf-8")
        if salida_manifiesto.exists():
            manifiesto = json.loads(salida_manifiesto.read_text(encoding="utf-8"))
    sys.stdout.write(hecho.stdout)
    if hecho.returncode:
        sys.stderr.write(hecho.stderr)
        return hecho.returncode
    if Path(args.indice).exists():
        faltan = [c["slug"] for c in consultas if not (Path(args.salida) / "precios" / c["slug"] / "index.html").exists()]
        if faltan:
            raise RuntimeError("no se generaron las paginas de: " + ", ".join(faltan))
    else:
        print("aviso: sin indice de precios, el mapa del sitio lista solo la pagina principal")
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    (salida / "sitemap.xml").write_text(sitemap(manifiesto["paginas"], manifiesto["generado"], args.base_url), encoding="utf-8")
    (salida / "robots.txt").write_text(robots(args.base_url), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
