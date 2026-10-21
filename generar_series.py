#!/usr/bin/env python3
"""Series de precio por aviso para el grafico del detalle (plan v2, D2).

Del historial (CSV mensual `fecha,tienda,id,precio`, solo los cambios) deja en `<salida>/series/NN.json`
la serie de cada aviso que esta en el indice. No sube el CSV entero: son FRAGMENTOS fragmentos y la pagina baja
solo el del aviso que se abre.

    python generar_series.py --indice indice.json --historial historial --salida _sitio

Cada fragmento es `{"v":1,"base":"2026-10-07","hasta":"2026-10-21","s":{clave:[dia,precio,dia,precio,...]}}`:
`dia` son dias desde `base` (el primer dia del historial) y cada par es un cambio de precio, igual que en el CSV; el
precio rige hasta el cambio siguiente y el ultimo, hasta `hasta` (la fecha del indice). La clave es `clave(tienda, url)`
y la misma funcion esta en js/serie-precios.js.

Solo sale lo que se puede afirmar (principio II): un aviso con menos de dos dias de historia, que ya no se publica o
cuyo precio de hoy en el indice no es el ultimo del historial no tiene serie y la pagina dice que todavia no hay
historia suficiente. Solo stdlib.
"""

import argparse
import json
import struct
import sys
from datetime import date
from pathlib import Path

import serie

FRAGMENTOS = 64
VERSION = 1


def _imul(a, b):
    return (a * b) & 0xFFFFFFFF


def hash53(texto):
    """cyrb53 sobre las unidades UTF-16 del texto (lo que ve charCodeAt en JavaScript): 53 bits, entero exacto en JS."""
    h1, h2 = 0xDEADBEEF, 0x41C6CE57
    datos = texto.encode("utf-16-le")
    for (c,) in struct.iter_unpack("<H", datos):
        h1 = _imul(h1 ^ c, 2654435761)
        h2 = _imul(h2 ^ c, 1597334677)
    h1 = _imul(h1 ^ (h1 >> 16), 2246822507)
    h1 ^= _imul(h2 ^ (h2 >> 13), 3266489909)
    h2 = _imul(h2 ^ (h2 >> 16), 2246822507)
    h2 ^= _imul(h1 ^ (h1 >> 13), 3266489909)
    h1 &= 0xFFFFFFFF
    h2 &= 0xFFFFFFFF
    return 4294967296 * (2097151 & h2) + h1


def _numero(tienda, url):
    return hash53(tienda + "\n" + url)


def clave(tienda, url):
    return format(_numero(tienda, url), "x")


def fragmento(tienda, url):
    return _numero(tienda, url) % FRAGMENTOS


def _por_dia(eventos):
    """Un precio por dia (el ultimo, porque el indexador puede correr mas de una vez) y sin repetir el que no cambio."""
    por_dia = {}
    for fecha, precio in eventos:
        por_dia[fecha] = precio
    salida = []
    for fecha in sorted(por_dia):
        if not salida or salida[-1][1] != por_dia[fecha]:
            salida.append((fecha, por_dia[fecha]))
    return salida


def recorte(eventos, hasta):
    """Los eventos del tramo actual (desde la ultima vez que el aviso aparecio), o None si no alcanza para un grafico:
    hacen falta al menos dos puntos, que son los cambios mas el dia `hasta` si el ultimo cambio es anterior."""
    tramo = serie._tramo_actual(eventos)
    if not tramo or tramo[-1][1] is None:
        return None
    tramo = _por_dia(tramo)
    if len(tramo) < 2 and tramo[0][0] >= hasta:
        return None
    return tramo


def compactar(eventos, base):
    plano = []
    for fecha, precio in eventos:
        plano += [(fecha - base).days, precio]
    return plano


def generar(indice, carpeta, salida):
    """Escribe los fragmentos en salida/series. Devuelve {"avisos", "fragmentos", "desparejos", "bytes"}."""
    datos = json.loads(Path(indice).read_text(encoding="utf-8"))
    hasta = date.fromisoformat((datos.get("generado") or "")[:10]) if datos.get("generado") else None
    series = serie.cargar(carpeta)
    destino = Path(salida) / "series"
    resumen = {"avisos": 0, "fragmentos": 0, "desparejos": 0, "bytes": 0}
    if not series or hasta is None:
        return resumen
    base = serie.inicio(series)
    fragmentos = {}
    for f in datos.get("productos", []):
        precio, url, tienda = f[1], f[2], f[3]
        tramo = recorte(series.get((tienda, url), []), hasta)
        if not tramo:
            continue
        if tramo[-1][1] != precio:
            resumen["desparejos"] += 1
            continue
        fragmentos.setdefault(fragmento(tienda, url), {})[clave(tienda, url)] = compactar(tramo, base)
        resumen["avisos"] += 1
    if destino.exists():
        for viejo in destino.glob("*.json"):
            viejo.unlink()
    destino.mkdir(parents=True, exist_ok=True)
    for n, s in sorted(fragmentos.items()):
        texto = json.dumps({"v": VERSION, "base": base.isoformat(), "hasta": hasta.isoformat(), "s": s},
                           separators=(",", ":"))
        (destino / f"{n:02d}.json").write_text(texto, encoding="utf-8")
        resumen["bytes"] += len(texto.encode("utf-8"))
    resumen["fragmentos"] = len(fragmentos)
    return resumen


def main(argv=None):
    ap = argparse.ArgumentParser(description="Series de precio por aviso para el grafico del detalle.")
    ap.add_argument("--indice", default="indice.json")
    ap.add_argument("--historial", default="historial")
    ap.add_argument("--salida", default="_sitio")
    args = ap.parse_args(argv)
    if not Path(args.indice).exists():
        print("sin indice: no se generan series")
        return 0
    r = generar(args.indice, args.historial, args.salida)
    print(f"series: {r['avisos']} avisos en {r['fragmentos']} fragmentos, {r['bytes'] / 1024:.0f} KB sin comprimir "
          f"({r['desparejos']} omitidos porque su precio de hoy no coincide con el historial)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
