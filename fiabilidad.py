#!/usr/bin/env python3
"""Fiabilidad del dato por comercio, con telemetria propia de la verificacion.

Uso:
    python fiabilidad.py --telemetria telemetria.json --historial historial --salida _sitio/fiabilidad.json

`verificar_ofertas.py --telemetria` anota, por enlace, el comercio, el veredicto y el motivo. Este modulo:
  1. cuenta por comercio cuantas ofertas estaban en pie, cuantas estaban caidas o con otro precio y cuantas no se
     pudieron comprobar, y agrega una fila por comercio y dia a `historial/verificacion/AAAA-MM.csv` (rama `historial`,
     como el historial de precios: no ensucia main ni depende de la cache de Actions);
  2. resume los ultimos DIAS dias y lo escribe en fiabilidad.json, que lee /estado/ (generar_info.js).

Es dato propio, no opinion: solo cuenta lo que este sitio reviso. Cuenta como "caida o con otro precio" lo que se
probo (404/410, cartel de la tienda, sin stock, el precio publicado ya no existe); lo que no se pudo comprobar (un
bloqueo, la API que no respondio) se descarta igual pero va aparte, porque no prueba nada contra la tienda. Con menos
de MINIMO ofertas verificadas en la ventana no se dice nada de un comercio.

Nunca hace fallar la corrida.
"""

import argparse
import csv
import json
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

CAMPOS = ["fecha", "comercio", "en_pie", "caidas", "sin_comprobar"]
CARPETA = "verificacion"
DIAS = 30        # ventana del resumen
MINIMO = 30      # ofertas verificadas en la ventana para decir algo de un comercio

# Descartes que no prueban nada contra la tienda: la API no pudo responder o la tienda no se pudo abrir.
NO_COMPROBADO = ("no se puede verificar", "no se pudo verificar", "no se pudo abrir")

# Revisiones que no valen porque el error era del verificador, no de la tienda: {comercio: ultimo dia que no cuenta}.
# Quedan en el historial (es lo que paso) pero no entran al resumen que publica /estado/.
ANULADAS = {
    # Spec 032: sin user-agent la API de Carrefour daba 403 y la pagina traia la plantilla «Este producto no está
    # disponible en este momento» de VTEX; /estado/ decia 39 de 39 caidas, y no lo estaban.
    "carrefour.com.ar": "2026-10-24",
}


def hoy():
    """La fecha de hoy en Argentina (UTC-3 fijo, sin horario de verano)."""
    return datetime.now(timezone(timedelta(hours=-3))).date().isoformat()


def clasificar(juicio, motivo=""):
    """'en_pie', 'caida' (probada) o 'sin_comprobar' a partir del veredicto de verificar_ofertas.revisar."""
    if juicio == "viva":
        return "en_pie"
    if juicio == "caida" and not any(t in (motivo or "") for t in NO_COMPROBADO):
        return "caida"
    return "sin_comprobar"


def contar(telemetria):
    """{comercio: {en_pie, caidas, sin_comprobar}} de {url: {comercio, juicio, motivo}}."""
    por = {}
    for r in (telemetria or {}).values():
        if not isinstance(r, dict) or not r.get("comercio") or not r.get("juicio"):
            continue
        clase = clasificar(r["juicio"], r.get("motivo"))
        c = por.setdefault(r["comercio"], Counter())
        c["caidas" if clase == "caida" else clase] += 1
    return {k: {"en_pie": c["en_pie"], "caidas": c["caidas"], "sin_comprobar": c["sin_comprobar"]}
            for k, c in por.items()}


def filas(telemetria, fecha):
    return [dict(fecha=fecha, comercio=k, **c) for k, c in sorted(contar(telemetria).items())]


def escribir(carpeta, nuevas):
    """Agrega las filas al CSV del mes (carpeta/verificacion/AAAA-MM.csv). Devuelve la ruta, o None si no habia nada."""
    if not nuevas:
        return None
    destino = Path(carpeta) / CARPETA
    destino.mkdir(parents=True, exist_ok=True)
    for fecha in sorted({n["fecha"][:7] for n in nuevas}):
        ruta = destino / (fecha + ".csv")
        nuevo = not ruta.exists()
        with ruta.open("a", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=CAMPOS, lineterminator="\n")
            if nuevo:
                w.writeheader()
            w.writerows(n for n in nuevas if n["fecha"][:7] == fecha)
    return ruta


def leer(carpeta):
    """Todas las filas guardadas, con los numeros como enteros; las rotas se saltean."""
    salida = []
    carpeta = Path(carpeta) / CARPETA
    for ruta in sorted(carpeta.glob("[0-9][0-9][0-9][0-9]-[0-9][0-9].csv")) if carpeta.is_dir() else []:
        with ruta.open(encoding="utf-8", newline="") as f:
            for fila in csv.DictReader(f):
                try:
                    date.fromisoformat(fila["fecha"])
                    salida.append({"fecha": fila["fecha"], "comercio": fila["comercio"] or None,
                                   **{k: int(fila[k]) for k in CAMPOS[2:]}})
                except (KeyError, TypeError, ValueError):
                    continue
    return [s for s in salida if s["comercio"]]


def resumen(todas, hasta, dias=DIAS, minimo=MINIMO, anuladas=None):
    """Por comercio, lo verificado en los ultimos `dias` dias hasta `hasta` (inclusive) y la ultima revision. Las filas de
    `anuladas` (por defecto ANULADAS) no cuentan."""
    anuladas = ANULADAS if anuladas is None else anuladas
    desde = (date.fromisoformat(hasta) - timedelta(days=dias - 1)).isoformat()
    comercios = {}
    for fila in sorted(todas, key=lambda x: x["fecha"]):
        if fila["fecha"] > hasta or fila["fecha"] <= anuladas.get(fila["comercio"], ""):
            continue
        c = comercios.setdefault(fila["comercio"], {"verificadas": 0, "caidas": 0, "sin_comprobar": 0, "ultima": None})
        c["ultima"] = fila["fecha"]
        if fila["fecha"] >= desde:
            c["verificadas"] += fila["en_pie"] + fila["caidas"]
            c["caidas"] += fila["caidas"]
            c["sin_comprobar"] += fila["sin_comprobar"]
    for c in comercios.values():
        c["suficiente"] = c["verificadas"] >= minimo
    return {"hasta": hasta, "dias": dias, "minimo": minimo, "comercios": comercios}


def leer_json(ruta):
    try:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--telemetria", help="telemetria.json de verificar_ofertas.py; sin ella solo se resume lo guardado")
    ap.add_argument("--historial", required=True, help="carpeta de la rama historial")
    ap.add_argument("--salida", required=True)
    ap.add_argument("--fecha", default=None, help="AAAA-MM-DD (por defecto, hoy en Argentina)")
    args = ap.parse_args(argv)

    fecha = args.fecha or hoy()
    if args.telemetria:
        nuevas = filas(leer_json(args.telemetria), fecha)
        escribir(args.historial, nuevas)
        print(f"fiabilidad: {len(nuevas)} comercio(s) agregados a la historia del {fecha}")
    datos = resumen(leer(args.historial), fecha)
    Path(args.salida).parent.mkdir(parents=True, exist_ok=True)
    Path(args.salida).write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    for k, c in sorted(datos["comercios"].items()):
        print(f"  {k}: {c['caidas']} de {c['verificadas']} caidas o con otro precio en {datos['dias']} dias"
              + ("" if c["suficiente"] else f" (menos de {datos['minimo']}: sin veredicto)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
