#!/usr/bin/env python3
"""Saca del indice las publicaciones que verificar_ofertas.py encontro caidas.

Uso:
    python filtrar_indice.py indice.json descartadas.json

Reescribe indice.json sin esas filas (se reconocen por el enlace, que es el tercer campo de cada fila), asi no
aparecen ni en la pestana Ofertas ni en el buscador ni en el feed. Sin lista, o con la lista rota, no toca nada.

D3: si sacar las caidas pasaria el 5% del indice o el 30% de una sola tienda, no se saca nada (frena el borrado
en masa sin aviso) y se deja un ::warning:: para que el paso lo avise.
"""

import json
import sys

import archivos

TOPE_INDICE = 0.05    # no sacar mas del 5% del indice de una sola vez
TOPE_TIENDA = 0.30    # ni mas del 30% de los productos de una tienda


def _es_caida(f, caidas):
    return isinstance(f, list) and len(f) > 2 and f[2] in caidas


def _por_tienda(filas):
    """{tienda: cantidad} de las filas que tienen tienda (cuarto campo)."""
    cuentas = {}
    for f in filas:
        if isinstance(f, list) and len(f) > 3:
            tienda = f[3]
            cuentas[tienda] = cuentas.get(tienda, 0) + 1
    return cuentas


def filtrar(datos, caidas):
    """(datos sin las filas caidas, cuantas se sacaron). No modifica 'datos'."""
    caidas = set(caidas)
    filas = datos.get("productos") or []
    quedan = [f for f in filas if not _es_caida(f, caidas)]
    return {**datos, "productos": quedan}, len(filas) - len(quedan)


def exceso(datos, caidas, tope_indice=TOPE_INDICE, tope_tienda=TOPE_TIENDA):
    """Un mensaje si sacar las caidas pasa un tope, o None si esta bien (D3)."""
    filas = datos.get("productos") or []
    caidas = set(caidas)
    total = len(filas)
    sacadas = sum(1 for f in filas if _es_caida(f, caidas))
    if not total or not sacadas:
        return None
    if sacadas > tope_indice * total:
        return (f"se sacarian {sacadas} de {total} filas ({sacadas / total:.0%}), mas del "
                f"{tope_indice:.0%} del indice")
    por_tienda = _por_tienda(filas)
    sacadas_tienda = _por_tienda([f for f in filas if _es_caida(f, caidas)])
    for tienda, n in sacadas_tienda.items():
        previo = por_tienda.get(tienda, 0)
        if previo and n > tope_tienda * previo:
            return (f"la tienda '{tienda}' perderia {n} de {previo} productos ({n / previo:.0%}), mas del "
                    f"{tope_tienda:.0%} de esa tienda")
    return None


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
    problema = exceso(datos, caidas)
    if problema:
        print(f"::warning::Filtrado frenado: {problema}. El índice queda como está.")
        return 0
    nuevo, sacadas = filtrar(datos, caidas)
    if sacadas:
        archivos.escribir_atomico(argv[0], json.dumps(nuevo, ensure_ascii=False, separators=(",", ":")))
    print(f"Índice sin publicaciones caídas: {sacadas} fila(s) sacada(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
