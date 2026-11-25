#!/usr/bin/env python3
"""Verificar antes de publicar (regla «Correos antes de publicar» del CLAUDE.md, hecha script).

Uso: python herramientas/verificar_publicacion.py

Solo lee. Mira cuatro cosas y dice si es seguro lanzar una corrida manual o mergear algo que publica:
1. Issues `a-revisar` abiertos en luismarceloescudero-debug/la-pichincha-correo (pueden señalar un error real).
2. Las ultimas corridas de `actualizar.yml` en main: si la ultima fallo y no hay una verde despues, no se publica encima.
3. Si la cache de Actions tiene un indice (sin eso un push frena con E01).
4. Que antiguedad tiene el indice publicado (`indice.json` del sitio).

Salida: lineas `OK`, `AVISO` o `FRENO`. Codigo de salida 1 si hay algun FRENO. Solo stdlib y el CLI `gh`.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

REPO = "luismarceloescudero-debug/la-pichincha"
REPO_CORREO = "luismarceloescudero-debug/la-pichincha-correo"
URL_INDICE = "https://pichinchadeldia.com.ar/indice.json"
HORAS_MAX_INDICE = 30
URL_SITIO = "https://pichinchadeldia.com.ar/"
SITIO_JSON = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sitio.json")
# Las pone Cloudflare (proxy activado, ver docs/cloudflare-proxy.md); GitHub Pages solo no puede.
CABECERAS_SEGURIDAD = ("strict-transport-security", "x-frame-options", "x-content-type-options")


def evaluar(estado, ahora=None):
    """De un dict con lo reunido devuelve [(nivel, mensaje)]; nivel = OK | AVISO | FRENO."""
    ahora = ahora or datetime.now(timezone.utc)
    salida = []

    n = len(estado.get("issues_a_revisar") or [])
    if n:
        salida.append(("AVISO", f"{n} issue(s) a-revisar abiertos en el repo de correos: leerlos antes de publicar"))
    else:
        salida.append(("OK", "sin issues a-revisar abiertos"))

    corridas = estado.get("corridas") or []
    cerradas = [c for c in corridas if c.get("status") == "completed" and c.get("conclusion") != "cancelled"]
    if cerradas and cerradas[0].get("conclusion") != "success":
        salida.append(("FRENO", f"la ultima corrida de main ({cerradas[0].get('databaseId')}) fallo y no hay una verde despues: "
                                "diagnosticarla con herramientas/ci_diagnostico.py"))
    elif cerradas:
        salida.append(("OK", f"la ultima corrida de main ({cerradas[0].get('databaseId')}) termino en verde"))
    else:
        salida.append(("AVISO", "no hay corridas cerradas de actualizar.yml para juzgar"))

    if estado.get("cache_con_indice") is False:
        salida.append(("FRENO", "la cache de Actions no tiene indice: un push frena (E01); lanzar indexar=true a mano"))
    elif estado.get("cache_con_indice"):
        salida.append(("OK", "la cache tiene un indice"))

    modificado = estado.get("indice_modificado")
    if modificado is None:
        salida.append(("AVISO", "no pude leer la fecha del indice publicado"))
    else:
        horas = (ahora - modificado).total_seconds() / 3600
        nivel = "OK" if horas <= HORAS_MAX_INDICE else "AVISO"
        salida.append((nivel, f"el indice publicado tiene {horas:.0f} h"))

    cabeceras = estado.get("cabeceras")
    if cabeceras is not None:
        faltan = [c for c in CABECERAS_SEGURIDAD if c not in cabeceras]
        if faltan:
            salida.append(("AVISO", "faltan cabeceras de seguridad (" + ", ".join(faltan) + "): ¿el proxy de Cloudflare esta "
                                    "apagado? ver docs/cloudflare-proxy.md"))
        else:
            salida.append(("OK", "el sitio manda las cabeceras de seguridad (HSTS, X-Frame-Options, nosniff)"))

    afuera = estado.get("afuera")
    if afuera is not None:
        if afuera.get("estado") != 200:
            salida.append(("AVISO", f"el Worker «Afuera» no responde ({afuera.get('url')}, estado {afuera.get('estado')}): "
                                    "¿cambio el subdominio de workers.dev? sitio.json afuera_url y la CSP tienen que coincidir"))
        else:
            salida.append(("OK", "el Worker «Afuera» responde"))
            vigia = afuera.get("vigia") or {}
            if vigia.get("ok") is False:
                for f in vigia.get("fallas") or []:
                    salida.append(("AVISO", f"vigia: {f.get('titulo')}: {f.get('detalle')}"))
            elif vigia.get("ok"):
                salida.append(("OK", "el vigia no ve fallas"))
    return salida


def gh(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, timeout=120)
    return r.stdout


def reunir():
    estado = {}
    try:
        estado["issues_a_revisar"] = json.loads(gh("issue", "list", "--repo", REPO_CORREO, "--label", "a-revisar",
                                                   "--state", "open", "--json", "number,title") or "[]")
        estado["corridas"] = json.loads(gh("run", "list", "--repo", REPO, "--workflow", "actualizar.yml", "--branch", "main",
                                           "--limit", "5", "--json", "databaseId,status,conclusion,event") or "[]")
        estado["cache_con_indice"] = "indice-" in gh("cache", "list", "--repo", REPO, "--limit", "30")
    except (OSError, subprocess.SubprocessError, ValueError):
        pass
    try:
        req = urllib.request.Request(URL_INDICE, method="HEAD", headers={"User-Agent": "verificar-publicacion"})
        with urllib.request.urlopen(req, timeout=20) as r:
            estado["indice_modificado"] = parsedate_to_datetime(r.headers["Last-Modified"])
    except (OSError, KeyError, TypeError, ValueError):
        estado["indice_modificado"] = None
    try:
        req = urllib.request.Request(URL_SITIO, method="HEAD", headers={"User-Agent": "verificar-publicacion"})
        with urllib.request.urlopen(req, timeout=20) as r:
            estado["cabeceras"] = [k.lower() for k in r.headers.keys()]
    except OSError:
        estado["cabeceras"] = None
    try:
        with open(SITIO_JSON, encoding="utf-8") as f:
            base = (json.load(f).get("afuera_url") or "").rstrip("/")
        if base:
            req = urllib.request.Request(base + "/vigia", headers={"User-Agent": "verificar-publicacion"})
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    cuerpo = r.read().decode("utf-8", "replace")
                    estado["afuera"] = {"url": base, "estado": r.status}
                    try:
                        estado["afuera"]["vigia"] = json.loads(cuerpo)
                    except ValueError:
                        pass
            except urllib.error.HTTPError as e:
                estado["afuera"] = {"url": base, "estado": e.code}
            except OSError:
                estado["afuera"] = {"url": base, "estado": 0}
    except (OSError, ValueError):
        pass
    return estado


def main():
    resultado = evaluar(reunir())
    for nivel, mensaje in resultado:
        print(f"{nivel:6} {mensaje}")
    return 1 if any(n == "FRENO" for n, _ in resultado) else 0


if __name__ == "__main__":
    sys.exit(main())
