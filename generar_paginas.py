#!/usr/bin/env python3
"""Paginas estaticas por busqueda popular: /precios/<slug>/, indice, sitemap y robots.

Uso:
    python generar_paginas.py --indice indice.json --salida _sitio [--fechas-previas https://.../precios/fechas.json]

La lista de consultas vive en consultas.json: agregar una entrada y publicar crea su pagina.
A esas, curadas a mano y siempre primeras, se suman las que descubre generar_consultas.js en el
indice (las mismas que arma "Comparar"); --sin-auto las apaga.
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
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

RAIZ = Path(__file__).resolve().parent
CONSULTAS = RAIZ / "consultas.json"
LARGO_MIN, LARGO_MAX = 2, 60
# La direccion publica vive en sitio.json (unico lugar; ver tests/test_sitio.py).
BASE_URL = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))["base_url"]


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


def consultas_automaticas(indice, manuales, tope=None):
    """Las consultas que descubre generar_consultas.js en el indice, sin repetir la URL de una manual.
    Si Node falla no se corta nada: las paginas salen solo con las manuales."""
    cmd = ["node", str(RAIZ / "generar_consultas.js"), "--indice", str(indice), "--manuales", str(CONSULTAS)]
    if tope:
        cmd += ["--tope", str(tope)]
    hecho = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if hecho.returncode:
        print("aviso: no se pudieron descubrir consultas automaticas: " + hecho.stderr.strip()[:200])
        return []
    vistos = {c["slug"] for c in manuales}
    autos = []
    for e in json.loads(hecho.stdout or "[]"):
        q = (e.get("q") or "").strip()
        try:
            s = slug(q)
        except ValueError:
            continue
        if LARGO_MIN <= len(q) <= LARGO_MAX and s not in vistos:
            vistos.add(s)
            autos.append({"q": q, "nota": e.get("nota", ""), "slug": s})
    return autos


def fechas_de_las_paginas(paginas, generado, previas=None):
    """{slug: {"huella", "lastmod"}}: la fecha de la ultima corrida en que cambio lo que dice la pagina (su huella, ver
    generar_paginas.js). Si la huella es la de la publicacion anterior, conserva aquella fecha; si cambio, o la pagina es
    nueva, o no hay fechas anteriores, es la fecha de los precios de esta corrida."""
    hoy = (generado or "")[:10]
    previas = previas if isinstance(previas, dict) else {}
    fechas = {}
    for p in paginas:
        antes = previas.get(p["slug"]) if isinstance(previas.get(p["slug"]), dict) else {}
        igual = p.get("huella") and antes.get("huella") == p.get("huella") and antes.get("lastmod")
        fechas[p["slug"]] = {"huella": p.get("huella"), "lastmod": antes["lastmod"] if igual else hoy}
    return fechas


def leer_fechas_previas(origen):
    """Las fechas de la publicacion anterior (una URL del sitio o un archivo); {} si no hay o no se pueden leer."""
    if not origen:
        return {}
    try:
        if re.match(r"https?://", origen):
            with urllib.request.urlopen(origen, timeout=20) as r:
                datos = json.loads(r.read().decode("utf-8"))
        else:
            datos = json.loads(Path(origen).read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001 - sin fechas anteriores, todas llevan la de hoy (como la primera publicacion)
        return {}
    return datos if isinstance(datos, dict) else {}


def sitemap(paginas, generado, base_url=BASE_URL, fechas=None):
    """sitemap.xml: la principal, el indice /precios/ y solo las paginas indexables (sin indice no hay paginas, FR-016).
    lastmod: la portada, la fecha de los precios (cambia cada dia); cada pagina, la del dia en que cambio lo que dice
    (fechas, de fechas_de_las_paginas); /precios/, la mas reciente de esas. Sin fecha confiable no lleva lastmod."""
    hoy = (generado or "")[:10]
    fechas = fechas if fechas is not None else fechas_de_las_paginas(paginas, generado)
    urls = [(base_url + "/", hoy)]
    if paginas or generado:
        propias = [(f"{base_url}/precios/{p['slug']}/", (fechas.get(p["slug"]) or {}).get("lastmod") or "")
                   for p in paginas if p["indexable"]]
        urls.append((base_url + "/precios/", max([f for _, f in propias if f], default=hoy)))
        urls += propias
    filas = [f"  <url><loc>{escape(u)}</loc>" + (f"<lastmod>{f}</lastmod>" if f else "") + "</url>" for u, f in urls]
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
    ap.add_argument("--sin-auto", action="store_true", help="solo las consultas de consultas.json")
    ap.add_argument("--fechas-previas", default=None,
                    help="precios/fechas.json de la publicacion anterior (URL o archivo), para el lastmod del mapa del sitio")
    args = ap.parse_args(argv)

    consultas = cargar_consultas(args.consultas)      # una lista invalida corta antes de generar nada
    if not args.sin_auto and Path(args.indice).exists():
        consultas += consultas_automaticas(args.indice, consultas)
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
    fechas = fechas_de_las_paginas(manifiesto["paginas"], manifiesto["generado"], leer_fechas_previas(args.fechas_previas))
    if manifiesto["paginas"]:
        (salida / "precios").mkdir(parents=True, exist_ok=True)
        (salida / "precios" / "fechas.json").write_text(json.dumps(fechas, ensure_ascii=False, separators=(",", ":")),
                                                        encoding="utf-8")
    (salida / "sitemap.xml").write_text(sitemap(manifiesto["paginas"], manifiesto["generado"], args.base_url, fechas),
                                        encoding="utf-8")
    (salida / "robots.txt").write_text(robots(args.base_url), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
