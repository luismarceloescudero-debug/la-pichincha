#!/usr/bin/env python3
"""Paginas estaticas por busqueda popular: /precios/<slug>/, indice, sitemap y robots.

Uso:
    python generar_paginas.py --indice indice.json --salida _sitio

La lista de consultas vive en consultas.json: agregar una entrada y publicar crea su pagina.
El analisis de cada consulta lo hace js/analisis.js, el mismo modulo que usa la Comparativa
del sitio, asi que pagina y comparativa dan siempre lo mismo.
"""

import json
import re
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
CONSULTAS = RAIZ / "consultas.json"
LARGO_MIN, LARGO_MAX = 2, 60


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
