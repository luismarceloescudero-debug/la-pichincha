#!/usr/bin/env python3
"""Cobertura de la identidad por codigo de modelo: cuanto del indice se pudo agrupar, por rubro.

Uso:
    python cobertura.py indice.json --salida cobertura.json [--previa RUTA_O_URL] [--resumen RUTA]

Por rubro (ram, ssd, gpu): avisos totales, cuantos tienen codigo de modelo, cuantos quedaron en un grupo
(mismo codigo en 2 o mas tiendas) y cuantos grupos son. Con --previa compara con la corrida anterior y
marca una caida de mas de 10 puntos de cobertura: suele ser una tienda que cambio sus nombres.
Nunca hace fallar la corrida por la comparacion.
"""

import argparse
import csv
import json
import urllib.request
from datetime import date
from collections import defaultdict
from pathlib import Path

import historial
import modelo

CAIDA_MAXIMA = 10  # puntos de cobertura


def codigo_de(fila):
    """La columna `modelo` si el indice la trae; si no (indice viejo), se calcula del nombre."""
    return fila[9] if len(fila) > 9 else modelo.modelo_de(fila[0])


def informe(filas):
    rubros = {r: {"avisos": 0, "con_codigo": 0, "agrupados": 0, "grupos": 0} for r in modelo.RUBROS}
    tiendas_por_codigo = defaultdict(set)
    avisos_por_codigo = defaultdict(int)
    rubro_por_codigo = {}
    for f in filas:
        rubro = modelo.rubro_de(f[0])
        if rubro is None:
            continue
        rubros[rubro]["avisos"] += 1
        codigo = codigo_de(f)
        if not codigo:
            continue
        rubros[rubro]["con_codigo"] += 1
        tiendas_por_codigo[codigo].add(f[3])
        avisos_por_codigo[codigo] += 1
        rubro_por_codigo[codigo] = rubro
    for codigo, tiendas in tiendas_por_codigo.items():
        if len(tiendas) > 1:
            r = rubros[rubro_por_codigo[codigo]]
            r["grupos"] += 1
            r["agrupados"] += avisos_por_codigo[codigo]
    return {"rubros": rubros}


def sellos_de_serie(filas):
    """Cuantos avisos llevan cada sello de la serie de precios (letras m, h, x de la columna sellos)."""
    sellos = [f[8] for f in filas if len(f) > 8 and isinstance(f[8], str)]
    return {"minimo30": sum("m" in s for s in sellos), "minimo90": sum("h" in s for s in sellos),
            "subio_antes": sum("x" in s for s in sellos)}


def dias_de_historia(carpeta, generado):
    """Dias entre el primer cambio registrado en el historial y la fecha del indice (0 sin historial)."""
    primeras = []
    for ruta in historial.archivos(carpeta):
        with Path(ruta).open(encoding="utf-8", newline="") as f:
            primeras += [fila["fecha"] for fila in csv.DictReader(f)]
    if not primeras or len(generado) < 10:
        return 0
    return (date.fromisoformat(generado[:10]) - date.fromisoformat(min(primeras))).days


def porcentaje(r):
    return 100.0 * r["con_codigo"] / r["avisos"] if r["avisos"] else 0.0


def caidas(actual, previa):
    """[(rubro, antes, ahora)] de los rubros cuya cobertura bajo mas de CAIDA_MAXIMA puntos."""
    if not previa:
        return []
    salida = []
    for rubro, r in actual["rubros"].items():
        antes = (previa.get("rubros") or {}).get(rubro)
        if antes and antes.get("avisos") and porcentaje(antes) - porcentaje(r) > CAIDA_MAXIMA:
            salida.append((rubro, porcentaje(antes), porcentaje(r)))
    return salida


def leer_previa(origen):
    try:
        if origen.startswith("http"):
            with urllib.request.urlopen(origen, timeout=15) as r:
                return json.loads(r.read().decode("utf-8"))
        return json.loads(Path(origen).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def resumen_md(datos, alertas):
    lineas = ["### Identidad por codigo de modelo", "",
              "| Rubro | Avisos | Con codigo | Agrupados | Grupos |", "|---|---:|---:|---:|---:|"]
    for rubro, r in datos["rubros"].items():
        lineas.append(f"| {rubro} | {r['avisos']} | {r['con_codigo']} ({porcentaje(r):.0f}%) "
                      f"| {r['agrupados']} | {r['grupos']} |")
    s = datos.get("serie")
    if s:
        lineas += ["", f"Serie de precios: {s['dias_de_historia']} días de historia · avisos con mínimo de 30 días: "
                       f"{s['minimo30']} · de 90 días: {s['minimo90']} · subió antes de la oferta: {s['subio_antes']}"]
    for rubro, antes, ahora in alertas:
        lineas += ["", f"**{rubro}**: la cobertura bajo de {antes:.0f}% a {ahora:.0f}%: "
                       f"revisar nombres de tiendas."]
    return "\n".join(lineas) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("indice")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--previa")
    ap.add_argument("--resumen")
    ap.add_argument("--historial", help="carpeta del historial, para contar los dias de historia")
    args = ap.parse_args(argv)

    idx = json.loads(Path(args.indice).read_text(encoding="utf-8"))
    filas = idx.get("productos", [])
    datos = dict(generado=idx.get("generado", ""), **informe(filas))
    datos["serie"] = dict(dias_de_historia=dias_de_historia(args.historial, idx.get("generado", "")) if args.historial else 0,
                          **sellos_de_serie(filas))
    Path(args.salida).write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")

    alertas = caidas(datos, leer_previa(args.previa) if args.previa else None)
    texto = resumen_md(datos, alertas)
    print(texto)
    if args.resumen:
        with open(args.resumen, "a", encoding="utf-8") as f:
            f.write(texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
