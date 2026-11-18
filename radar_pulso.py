#!/usr/bin/env python3
"""Pulso diario del radar: confirma que las claves de Tavily y Firecrawl andan, sin gastar creditos.

Uso:
    python radar_pulso.py

Consulta los endpoints de uso (no cobran creditos):
- Tavily: GET https://api.tavily.com/usage
- Firecrawl: GET https://api.firecrawl.dev/v2/team/credit-usage

Sale con 1 (corrida en rojo, GitHub avisa por mail) si falta una clave, si da 401/403 o si el servicio no contesta
tras un reintento. Deja los creditos usados/restantes en el resumen de la corrida ($GITHUB_STEP_SUMMARY) y una
::warning:: si quedan menos de MINIMO creditos. Nunca imprime las claves.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

TAVILY_USO = "https://api.tavily.com/usage"
FIRECRAWL_USO = "https://api.firecrawl.dev/v2/team/credit-usage"
MINIMO = 100
UA = "la-pichincha-radar/1.0"


class FallaPulso(Exception):
    pass


def _get_json(url, clave, timeout=20):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {clave}", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def consultar(url, clave, get=_get_json, dormir=time.sleep, espera=10):
    """GET con un reintento ante red caida, timeout o 5xx/429; 401/403 falla de una (la clave no sirve)."""
    ultimo = None
    for intento in range(2):
        try:
            return get(url, clave)
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):
                raise FallaPulso(f"HTTP {e.code}: clave rechazada")
            ultimo = f"HTTP {e.code}"
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            ultimo = f"{type(e).__name__}: {getattr(e, 'reason', e)}"
        if intento == 0:
            dormir(espera)
    raise FallaPulso(f"no contesta tras 1 reintento ({ultimo})")


def creditos_tavily(datos):
    """(usados, restantes) del plan de la cuenta; si la clave tiene tope propio, el menor de los dos."""
    cuenta = datos.get("account") or {}
    if cuenta.get("plan_limit") is None:
        raise FallaPulso("respuesta sin account.plan_limit")
    usados = cuenta.get("plan_usage") or 0
    restantes = cuenta["plan_limit"] - usados
    clave = datos.get("key") or {}
    if clave.get("limit") is not None:
        restantes = min(restantes, clave["limit"] - (clave.get("usage") or 0))
    return usados, restantes


def creditos_firecrawl(datos):
    """(usados, restantes): usados = creditos del plan menos los que quedan (sin cupones ni pago por uso)."""
    d = datos.get("data") or {}
    if "remainingCredits" not in d:
        raise FallaPulso("respuesta sin data.remainingCredits")
    restantes = d["remainingCredits"]
    usados = max((d.get("planCredits") or 0) - restantes, 0)
    return usados, restantes


SERVICIOS = [
    ("Tavily", "TAVILY_API_KEY", TAVILY_USO, creditos_tavily),
    ("Firecrawl", "FIRECRAWL_API_KEY", FIRECRAWL_USO, creditos_firecrawl),
]


def pulso(entorno=None, get=None, dormir=time.sleep):
    """Devuelve (filas del resumen, avisos, errores). Cada fila: (servicio, estado, usados, restantes)."""
    entorno = os.environ if entorno is None else entorno
    get = get or _get_json
    filas, avisos, errores = [], [], []
    for nombre, var, url, leer in SERVICIOS:
        clave = (entorno.get(var) or "").strip()
        if not clave:
            errores.append(f"{nombre}: falta {var}")
            filas.append((nombre, "sin clave", "-", "-"))
            continue
        try:
            usados, restantes = leer(consultar(url, clave, get=get, dormir=dormir))
        except FallaPulso as e:
            errores.append(f"{nombre}: {e}")
            filas.append((nombre, "falla", "-", "-"))
            continue
        filas.append((nombre, "ok", usados, restantes))
        if restantes < MINIMO:
            avisos.append(f"{nombre}: quedan {restantes} creditos (menos de {MINIMO})")
    return filas, avisos, errores


def resumen_md(filas, avisos, errores):
    lineas = ["## Pulso del radar", "", "| Servicio | Estado | Creditos usados | Creditos restantes |",
              "| --- | --- | --- | --- |"]
    lineas += [f"| {s} | {e} | {u} | {r} |" for s, e, u, r in filas]
    lineas += [""] + [f"- Aviso: {a}" for a in avisos] + [f"- Error: {e}" for e in errores]
    return "\n".join(lineas).rstrip() + "\n"


def main():
    filas, avisos, errores = pulso()
    md = resumen_md(filas, avisos, errores)
    print(md)
    for a in avisos:
        print(f"::warning::{a}")
    for e in errores:
        print(f"::error::{e}")
    destino = os.environ.get("GITHUB_STEP_SUMMARY")
    if destino:
        with open(destino, "a", encoding="utf-8") as f:
            f.write(md)
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
