#!/usr/bin/env python3
"""Busca en las paginas de /precios/ los enlaces a tiendas que ya no existen (404 o 410).

Uso:
    python enlaces_rotos.py --sitio _sitio --salida rotos.json [--presupuesto 300] [--hilos 16]

Un producto puede desaparecer de la tienda entre el relevamiento y la publicacion (el 31/10 una RTX 3050 de Max Tecno
salio de su catalogo horas despues del indice de las 13:36), y un push a main vuelve a publicar con el indice de la
cache. Este paso abre cada enlace de las paginas armadas y escribe la lista de los que la tienda contesta 404 o 410;
filtrar_indice.py los saca del indice y el build rearma las paginas. Ante cualquier otra respuesta (un bloqueo, una
demora, un error de red) el enlace se deja: solo sale lo que la tienda dice que no existe. Mercado Libre no se abre
(su web responde a los robots con bloqueos y se verifica por su API en verificar_ofertas.py). Hay un tope de tiempo:
lo que no llega a revisarse se publica como estaba. Solo stdlib.
"""

import argparse
import html
import json
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit

from verificar_ofertas import UA

# Los enlaces a tiendas de las paginas llevan data-rubro (generar_paginas.js); los de navegacion no.
ENLACE = re.compile(r'<a href="(https?://[^"]+)"[^>]*\bdata-rubro=')
NO_ABRIR = ("mercadolibre.com", "mercadolibre.com.ar", "meli.la")
ROTO = {404, 410}
POR_TIENDA = 4           # pedidos a la vez a una misma tienda: revisar no puede parecer un ataque (Max Tecno tiene ~450)


def enlaces(sitio):
    """Los enlaces a tiendas de /precios/, sin repetir y en orden de aparicion."""
    vistos = {}
    for pagina in sorted(Path(sitio, "precios").rglob("index.html")):
        for m in ENLACE.finditer(pagina.read_text(encoding="utf-8")):
            vistos.setdefault(html.unescape(m.group(1)), None)
    return [u for u in vistos if not any(h == host(u) or host(u).endswith("." + h) for h in NO_ABRIR)]


def host(url):
    return (urlsplit(url).hostname or "").lower()


def estado(url, timeout=12):
    """El codigo HTTP final (siguiendo redirecciones), 0 si no hubo respuesta. No baja el cuerpo."""
    pedido = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9"})
    try:
        with urllib.request.urlopen(pedido, timeout=timeout) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:  # noqa: BLE001 - red, TLS, tiempo: no dice que el producto no exista
        return 0


def intercalar(urls):
    """Uno de cada tienda por vuelta: si no, los hilos hacen fila en la tienda con mas enlaces y las demas esperan."""
    por_tienda = {}
    for u in urls:
        por_tienda.setdefault(host(u), []).append(u)
    filas, salida = list(por_tienda.values()), []
    for i in range(max(map(len, filas), default=0)):
        salida.extend(f[i] for f in filas if i < len(f))
    return salida


def revisar(urls, pedir=estado, presupuesto=300.0, hilos=16, reloj=time.monotonic):
    """(rotos, revisados): los que dieron 404/410 y cuantos se llegaron a abrir antes del tope de tiempo."""
    fin = reloj() + presupuesto
    candados, guardia = {}, threading.Lock()
    rotos, revisados = [], [0]

    def uno(url):
        if reloj() > fin:
            return
        with guardia:
            candado = candados.setdefault(host(url), threading.BoundedSemaphore(POR_TIENDA))
        with candado:
            if reloj() > fin:
                return
            codigo = pedir(url)
        with guardia:
            revisados[0] += 1
            if codigo in ROTO:
                rotos.append(url)

    with ThreadPoolExecutor(max_workers=hilos) as ex:
        list(ex.map(uno, intercalar(urls)))
    orden = {u: i for i, u in enumerate(urls)}
    return sorted(rotos, key=orden.get), revisados[0]


def main(argv=None):
    ap = argparse.ArgumentParser(description="Lista los enlaces de /precios/ que la tienda contesta 404 o 410.")
    ap.add_argument("--sitio", default="_sitio")
    ap.add_argument("--salida", default="rotos.json")
    ap.add_argument("--presupuesto", type=float, default=300.0, help="segundos como maximo")
    ap.add_argument("--hilos", type=int, default=16)
    args = ap.parse_args(argv)

    urls = enlaces(args.sitio)
    rotos, revisados = revisar(urls, pedir=estado, presupuesto=args.presupuesto, hilos=args.hilos)
    Path(args.salida).write_text(json.dumps(rotos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"enlaces a tiendas en /precios/: {len(urls)}, revisados {revisados}, rotos (404/410) {len(rotos)}")
    for u in rotos:
        print(f"  roto: {u}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
