#!/usr/bin/env python3
"""Relevo desde la PC (spec 067): lee en la PC del dueno las tiendas que bloquean la IP de los runners de GitHub.

Uso:
    python relevo_pc.py                       # releva y deja los JSON en relevo-pc/ (carpeta local, sin publicar)
    python relevo_pc.py --publicar            # releva y los sube a la rama `historial` (relevo-pc/<tienda>.json)
    python relevo_pc.py --solo katech         # una sola
    python relevo_pc.py --publicar --saltar-si-menos-de 12   # lo que corre la tarea programada

Solo releva las tiendas de tiendas.json con "relevo": "pc". Lee igual que el runner (indexar.leer_catalogo: mismos
extractores, mismo User-Agent, mismo ritmo); lo unico que cambia es desde donde. Nada de proxies, navegadores ni otro
User-Agent. El runner (indexar.py) usa el archivo solo si su propio relevo de esa tienda falla y el de la PC tiene menos
de VIGENCIA_HORAS: precios mas viejos no se publican.

Para publicar usa un clon superficial de la rama `historial` en una carpeta de trabajo fuera del repo
(%USERPROFILE%\\.la-pichincha\\relevo-historial): nunca toca el checkout del dueno. pull --rebase antes de escribir y
antes de reintentar el push; nunca --force.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
TIENDAS = RAIZ / "tiendas.json"
VIA = "pc"
CARPETA = "relevo-pc"            # dentro de la rama `historial`
VIGENCIA_HORAS = 36              # un relevo mas viejo no se publica
RAMA = "historial"
AR = timezone(timedelta(hours=-3))
INTENTOS_PUSH = 3

for flujo in (sys.stdout, sys.stderr):
    try:
        flujo.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


def tiendas_con_relevo(fuentes):
    """Las claves activas que se relevan desde la PC, en el orden de tiendas.json."""
    return [k for k, v in fuentes.items()
            if not k.startswith("_") and isinstance(v, dict) and v.get("relevo") == VIA and v.get("activa", True)]


def armar(clave, nombre, items, ahora):
    """El contenido de relevo-pc/<clave>.json: fecha y hora real del relevo, conteo y productos (ordenados por URL)."""
    productos = sorted(items, key=lambda it: it.get("url") or "")
    return {"tienda": clave, "nombre": nombre, "via": VIA, "relevado": ahora.isoformat(timespec="minutes"),
            "cantidad": len(productos), "productos": productos}


def texto(datos):
    """JSON con un producto por linea: el diff diario en la rama `historial` muestra solo lo que cambio."""
    cabeza = {k: v for k, v in datos.items() if k != "productos"}
    lineas = [json.dumps(p, ensure_ascii=False, sort_keys=True, separators=(",", ":")) for p in datos["productos"]]
    cuerpo = json.dumps(cabeza, ensure_ascii=False, separators=(",", ":"))[:-1]
    return cuerpo + ',"productos":[\n' + ",\n".join(lineas) + "\n]}\n"


def escribir(carpeta, datos):
    ruta = Path(carpeta) / CARPETA / (datos["tienda"] + ".json")
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tmp = ruta.with_suffix(".tmp")
    tmp.write_text(texto(datos), encoding="utf-8", newline="\n")
    os.replace(tmp, ruta)
    return ruta


def _cuando(datos):
    try:
        cuando = datetime.fromisoformat(str(datos.get("relevado") or ""))
    except ValueError:
        return None
    return cuando if cuando.tzinfo else cuando.replace(tzinfo=AR)


def leer(carpeta, clave):
    """El relevo guardado de una tienda, o None si no hay o esta roto."""
    ruta = Path(carpeta) / CARPETA / (clave + ".json")
    try:
        datos = json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(datos, dict) or not isinstance(datos.get("productos"), list) or _cuando(datos) is None:
        return None
    return datos


def edad_horas(datos, ahora):
    return (ahora - _cuando(datos)).total_seconds() / 3600


def leer_vigente(carpeta, clave, ahora, horas=VIGENCIA_HORAS):
    """El relevo de la PC si tiene menos de `horas` (y no es del futuro), con solo los productos que pasarian en el
    runner (URL valida y precio positivo). None si no hay, esta roto, es viejo o quedo vacio."""
    import indexar
    datos = leer(carpeta, clave)
    if datos is None:
        return None
    edad = edad_horas(datos, ahora)
    if edad > horas or edad < -1:
        return None
    productos = [p for p in datos["productos"]
                 if isinstance(p, dict) and indexar.url_valida(p.get("url")) and p.get("nombre")
                 and isinstance(p.get("precio"), (int, float)) and p["precio"] > 0]
    if not productos:
        return None
    return dict(datos, productos=productos, cantidad=len(productos))


def relevar(fuentes, claves, max_paginas, leer_catalogo=None, ahora=None):
    """{clave: datos} de las tiendas que trajeron productos. Una que falla o trae 0 no se escribe: queda el archivo
    anterior con su fecha vieja, y el runner decide por la edad."""
    import indexar
    leer_catalogo = leer_catalogo or indexar.leer_catalogo
    salida = {}
    for clave in claves:
        fuente = fuentes[clave]
        print(fuente["nombre"])
        try:
            items = leer_catalogo(fuente, max_paginas)
        except Exception as e:                       # una tienda caida no frena a la otra
            print("  x " + type(e).__name__ + ": " + str(e)[:120])
            continue
        items = [it for it in items if indexar.url_valida(it.get("url"))]
        if not items:
            print("  x no trajo ningun producto")
            continue
        salida[clave] = armar(clave, fuente["nombre"], items, ahora or datetime.now(AR))
        print("  ok " + str(len(items)) + " productos")
    return salida


# --- Publicar en la rama `historial` -------------------------------------------------------------------------------

def git(*args, cwd=None, chequear=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if chequear and r.returncode != 0:
        raise RuntimeError("git " + " ".join(args) + ": " + (r.stderr or r.stdout).strip()[:400])
    return r


def preparar_clon(trabajo, remoto, autor=None):
    """Clon superficial de la rama `historial` en `trabajo` (se crea la primera vez) y al dia con pull --rebase.
    `autor` (nombre, correo) queda en la config del clon: el commit y el rebase lo necesitan."""
    trabajo = Path(trabajo)
    nuevo = not (trabajo / ".git").exists()
    if nuevo:
        trabajo.parent.mkdir(parents=True, exist_ok=True)
        git("clone", "--depth", "1", "--branch", RAMA, "--single-branch", remoto, str(trabajo))
    for campo, valor in zip(("user.name", "user.email"), autor or ()):
        if valor:
            git("config", campo, valor, cwd=trabajo)
    if not nuevo:
        git("pull", "--rebase", "--quiet", "origin", RAMA, cwd=trabajo)
    return trabajo


def publicar(trabajo, datos_por_tienda, remoto, autor=None, fecha=None):
    """Escribe los relevos en el clon, commitea y empuja a `historial`. Si el push choca (el runner empujo en el medio),
    pull --rebase y reintenta. Devuelve el hash del commit, o None si no habia cambios."""
    trabajo = preparar_clon(trabajo, remoto, autor)
    for datos in datos_por_tienda.values():
        escribir(trabajo, datos)
    git("add", CARPETA, cwd=trabajo)
    if git("diff", "--cached", "--quiet", cwd=trabajo, chequear=False).returncode == 0:
        return None
    conteos = ", ".join(k + " " + str(d["cantidad"]) for k, d in datos_por_tienda.items())
    dia = fecha or datetime.now(AR).date().isoformat()
    git("commit", "--quiet", "-m", "Relevo desde la PC del " + dia + ": " + conteos, cwd=trabajo)
    for intento in range(1, INTENTOS_PUSH + 1):
        if git("push", "--quiet", "origin", "HEAD:" + RAMA, cwd=trabajo, chequear=False).returncode == 0:
            return git("rev-parse", "HEAD", cwd=trabajo).stdout.strip()
        if intento == INTENTOS_PUSH:
            raise RuntimeError("el push a " + RAMA + " fallo " + str(INTENTOS_PUSH) + " veces")
        git("pull", "--rebase", "--quiet", "origin", RAMA, cwd=trabajo)
    return None   # no se llega


def reciente(carpeta, claves, ahora, horas):
    """True si todas las tiendas tienen un relevo de hace menos de `horas`: la tarea que arranca al iniciar sesion no
    repite el de la madrugada."""
    for clave in claves:
        datos = leer(carpeta, clave)
        if datos is None or edad_horas(datos, ahora) >= horas:
            return False
    return bool(claves)


def trabajo_por_defecto():
    """En la carpeta del usuario y no en AppData: una app empaquetada (MSIX, como Claude de escritorio) ve AppData
    virtualizado y la tarea programada no veria lo mismo."""
    return Path.home() / ".la-pichincha" / "relevo-historial"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Releva desde la PC las tiendas con \"relevo\": \"pc\".")
    ap.add_argument("--solo", metavar="FUENTE")
    ap.add_argument("--max-paginas", type=int, default=None)
    ap.add_argument("--publicar", action="store_true", help="sube los relevos a la rama historial")
    ap.add_argument("--salida", metavar="DIR", default=str(RAIZ),
                    help="sin --publicar: donde dejar relevo-pc/ (por defecto, la raiz del repo; esta en .gitignore)")
    ap.add_argument("--trabajo", metavar="DIR", default=None, help="clon de trabajo de la rama historial")
    ap.add_argument("--remoto", metavar="URL", default=None, help="por defecto, el origin de este repo")
    ap.add_argument("--saltar-si-menos-de", type=float, metavar="HORAS", default=None,
                    help="con --publicar: no relevar si la rama ya tiene relevos de todas mas nuevos que esto")
    args = ap.parse_args(argv)

    import indexar
    fuentes = json.loads(TIENDAS.read_text(encoding="utf-8"))
    claves = tiendas_con_relevo(fuentes)
    if args.solo:
        if args.solo not in claves:
            print("No se releva desde la PC: " + args.solo + ". Opciones: " + ", ".join(claves))
            return 1
        claves = [args.solo]
    ahora = datetime.now(AR)
    max_paginas = args.max_paginas or indexar.TOPE_PAGINAS

    if not args.publicar:
        relevos = relevar(fuentes, claves, max_paginas, ahora=ahora)
        for datos in relevos.values():
            print("  -> " + str(escribir(args.salida, datos)))
        return 0 if len(relevos) == len(claves) else 2

    remoto = args.remoto or git("remote", "get-url", "origin", cwd=RAIZ).stdout.strip()
    trabajo = Path(args.trabajo) if args.trabajo else trabajo_por_defecto()
    autor = (git("config", "user.name", cwd=RAIZ, chequear=False).stdout.strip() or None,
             git("config", "user.email", cwd=RAIZ, chequear=False).stdout.strip() or None)
    if args.saltar_si_menos_de is not None:
        preparar_clon(trabajo, remoto, autor)
        if reciente(trabajo, claves, ahora, args.saltar_si_menos_de):
            print("Ya hay un relevo de menos de " + format(args.saltar_si_menos_de, "g") + " h de "
                  + ", ".join(claves) + ": no se repite.")
            return 0
    relevos = relevar(fuentes, claves, max_paginas, ahora=ahora)
    if not relevos:
        print("Ninguna tienda trajo productos: no se publica nada.")
        return 2
    commit = publicar(trabajo, relevos, remoto, autor=autor, fecha=ahora.date().isoformat())
    if commit:
        print("Publicado en " + RAMA + ": " + commit[:12] + " ("
              + ", ".join(k + " " + str(d["cantidad"]) for k, d in relevos.items()) + ")")
    else:
        print("Sin cambios contra lo que ya estaba en " + RAMA + ".")
    return 0 if len(relevos) == len(claves) else 2


if __name__ == "__main__":
    sys.exit(main())
