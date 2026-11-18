#!/usr/bin/env python3
"""Salud de las fuentes: avisa con un issue cuando una tienda trae poco.

Uso:
    python salud.py salud.json          # abre, comenta o cierra issues con gh
    python salud.py salud.json --seco   # solo muestra lo que haria

indexar.py escribe salud.json con evaluar(). Una fuente esta sana si no
fallo, trajo al menos un producto y llego al 70% de los productos vivos que
tenia en el historial. Con la misma regla el historial decide si registra las
bajas de esa fuente.

Spec 066: un issue por tienda, sin spam diario. Se abre la primera vez que falla; mientras siga abierto no se
comenta todos los dias. Cada cambio de estado (pausa, baja, alta, de estado_tiendas.py) deja UN comentario; la
baja y la vuelta lo cierran. Lo que se decide sale del estado (no solo del cambio de hoy), asi una corrida manual
que no llama a este script no deja un issue abierto de una tienda que ya volvio o ya se dio de baja.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

UMBRAL = 0.7
ETIQUETA = "salud-fuente"
SALUD = Path(__file__).resolve().parent / "salud.json"


def evaluar(vivos, relevados, nombres, fecha, umbral=UMBRAL, notas=None):
    """Compara lo que trajo cada fuente relevada hoy contra lo que tenia vivo. `notas` (spec 061, de indexar.py): por
    cada fuente, {"motivo", "detalle", "reintentada"}; se copian al informe para que el aviso al dueno diga el porque."""
    notas = notas or {}
    fuentes = {}
    for clave, ahora in relevados.items():
        previo = vivos.get(clave, 0)
        if ahora == 0:
            estado = "fallo"
        elif previo and ahora < umbral * previo:
            estado = "baja"
        else:
            estado = "ok"
        fuentes[clave] = {"nombre": nombres.get(clave, clave), "previo": previo,
                          "ahora": ahora, "estado": estado}
        nota = notas.get(clave)
        if nota:
            fuentes[clave].update({k: nota[k] for k in ("motivo", "detalle", "reintentada", "via")
                                   if k in nota})
    return {"fecha": fecha, "umbral": umbral, "fuentes": fuentes}


def alertas(informe):
    if informe is None:                       # indexar.py se cayo antes de escribirlo
        return [{"clave": "indexado", "nombre": "el indexado", "previo": 0, "ahora": 0,
                 "estado": "caido"}]
    return [dict(f, clave=k) for k, f in informe["fuentes"].items() if f["estado"] != "ok"]


def titulo(alerta):
    if alerta["estado"] == "caido":
        return "El indexado de precios no termino"
    return "Fuente con pocos productos: " + alerta["nombre"]


def cuerpo(alerta, url_corrida):
    if alerta["estado"] == "caido":
        return ("El paso `indexar.py` de la corrida programada fallo antes de escribir "
                "`salud.json`, asi que no hay numeros por fuente. El sitio se publico con "
                "el indice anterior.\n\nCorrida: " + url_corrida)
    pct = round(100 * alerta["ahora"] / alerta["previo"]) if alerta["previo"] else 0
    return "\n".join([
        f"**{alerta['nombre']}** trajo {alerta['ahora']} productos contra {alerta['previo']} "
        f"de la corrida anterior ({pct}%). El umbral es {round(100 * UMBRAL)}%.",
        "",
        "Mientras siga abajo del umbral, el historial no registra sus bajas: una tienda que "
        "bloquea a medias no borra su catalogo.",
        "",
        "Que revisar:",
        "- `python indexar.py --solo " + alerta["clave"] + " --max-paginas 2` para ver si responde.",
        "- `python indexar.py --probar <url de un producto>` si cambio la plantilla.",
        "- `python tests/capturar.py " + alerta["clave"] + "` y los tests, para ver que regex rompio.",
        "",
        "Corrida: " + url_corrida,
    ])


def url_corrida():
    e = os.environ
    if e.get("GITHUB_RUN_ID"):
        return (f"{e.get('GITHUB_SERVER_URL', 'https://github.com')}/{e['GITHUB_REPOSITORY']}"
                f"/actions/runs/{e['GITHUB_RUN_ID']}")
    return "(corrida local)"


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True,
                          timeout=60).stdout


def detalle(e):
    """Una linea con el motivo del fallo de `gh`, para el ::warning:: del workflow."""
    if isinstance(e, subprocess.CalledProcessError):
        texto = e.stderr or e.stdout or f"gh salio con {e.returncode}"
    else:
        texto = str(e)
    return " ".join(str(texto).split())[:500] or "sin detalle"


def titulo_tienda(nombre):
    return "Fuente con pocos productos: " + nombre


def _fecha(iso):
    return "/".join(reversed(str(iso or "")[:10].split("-")[1:])) or "?"


def cuerpo_cambio(cambio, url):
    """El unico comentario que deja un cambio de estado de una tienda (spec 066)."""
    nombre, a = cambio["nombre"], cambio["a"]
    if a == "pausa":
        texto = (f"**{nombre}** pasa a **en pausa** sola (spec 066): no trae productos desde el "
                 f"{_fecha(cambio.get('sin_productos_desde'))} (ultima corrida: {cambio.get('clase')}). Sus precios "
                 "viejos dejan de publicarse y se sigue intentando a diario. Vuelve sola cuando traiga productos. "
                 "Este issue no se comenta mas hasta el proximo cambio.")
    elif a == "baja":
        texto = (f"**{nombre}** queda **dada de baja** sola (spec 066): el dominio no responde (DNS, certificado o "
                 "conexion) en 3 corridas seguidas. Sale del indice publicado y del relevamiento diario; se sondea la "
                 "portada una vez por semana y vuelve sola si revive. Se cierra.")
    else:
        texto = (f"**{nombre}** volvio a traer productos: **alta automatica** (spec 066; estaba en {cambio.get('de')}). "
                 "Sus precios vuelven a publicarse desde esta corrida. Se cierra.")
    if cambio.get("detalle"):
        texto += "\n\nDetalle: " + str(cambio["detalle"])[:200]
    return texto + "\n\nCorrida: " + url


def acciones(informe, abiertos, url):
    """Lo que hay que hacer en GitHub, sin tocarlo: [(verbo, titulo, numero o None, cuerpo)], verbo en crear,
    comentar, cerrar (cerrar con numero None = crear y cerrar). `abiertos`: {titulo: numero}."""
    if informe is None:
        a = alertas(None)[0]
        return [] if titulo(a) in abiertos else [("crear", titulo(a), None, cuerpo(a, url))]
    estados = informe.get("tiendas") or {}
    fuentes = informe.get("fuentes") or {}
    hechos, plan = set(), []
    for c in informe.get("cambios") or []:
        t = titulo_tienda(c["nombre"])
        n, texto = abiertos.get(t), cuerpo_cambio(c, url)
        hechos.add(t)
        if c["a"] == "pausa":
            plan.append(("comentar", t, n, texto) if n else ("crear", t, None, texto))
        elif c["a"] == "baja":
            plan.append(("cerrar", t, n, texto))
        elif n:
            plan.append(("cerrar", t, n, texto))
    for clave, e in estados.items():                # lo que una corrida sin este script dejo sin registrar
        t = titulo_tienda(e.get("nombre", clave))
        if t in hechos:
            continue
        if e.get("estado") == "baja" and t in abiertos:
            hechos.add(t)
            plan.append(("cerrar", t, abiertos[t], cuerpo_cambio(dict(e, a="baja", de="activa"), url)))
        elif e.get("estado") == "pausa" and t not in abiertos:
            hechos.add(t)
            plan.append(("crear", t, None, cuerpo_cambio(dict(e, a="pausa", clase=e.get("ultima")), url)))
    for clave, f in fuentes.items():                # volvio sobre el umbral: el issue se cierra solo
        t = titulo_tienda(f["nombre"])
        if f["estado"] == "ok" and t in abiertos and t not in hechos:
            hechos.add(t)
            plan.append(("cerrar", t, abiertos[t], f"**{f['nombre']}** volvio a traer {f['ahora']} productos "
                         f"(contra {f['previo']} de antes): se cierra solo. Si vuelve a fallar, se abre otro.\n\n"
                         "Corrida: " + url))
    for a in alertas(informe):
        t = titulo(a)
        if estados.get(a["clave"], {}).get("estado") in ("pausa", "baja") or t in abiertos or t in hechos:
            continue                                # ya tiene su issue: nada de un comentario por dia
        hechos.add(t)
        plan.append(("crear", t, None, cuerpo(a, url)))
    return plan


def avisar(informe, url):
    gh("label", "create", ETIQUETA, "--color", "d93f0b",
       "--description", "Una fuente de precios trajo menos de lo esperado", "--force")
    abiertos = {i["title"]: i["number"] for i in json.loads(
        gh("issue", "list", "--label", ETIQUETA, "--state", "open", "--json", "number,title",
           "--limit", "100") or "[]")}
    for verbo, t, n, c in acciones(informe, abiertos, url):
        if verbo == "comentar":
            gh("issue", "comment", str(n), "--body", c)
            print("comentado #" + str(n) + ": " + t)
            continue
        if n is None:
            salida = gh("issue", "create", "--title", t, "--body", c, "--label", ETIQUETA)
            print("abierto: " + t)
            if verbo == "crear":
                continue
            n = (salida or "").strip().rsplit("/", 1)[-1]
            if not n.isdigit():
                print("::warning::No se pudo cerrar el issue recien abierto: " + t)
                continue
            c = "Cerrado solo: el estado ya quedo registrado arriba."
        gh("issue", "close", str(n), "--comment", c)
        print("cerrado #" + str(n) + ": " + t)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Abre issues cuando una fuente trae poco.")
    ap.add_argument("ruta", nargs="?", default=str(SALUD))
    ap.add_argument("--seco", action="store_true", help="muestra lo que haria sin tocar GitHub")
    args = ap.parse_args(argv)

    ruta = Path(args.ruta)
    informe = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None
    url = url_corrida()
    if args.seco:
        plan = acciones(informe, {}, url)
        for verbo, t, n, c in plan:
            print("# [" + verbo + "] " + t + "\n\n" + c + "\n")
        if not plan:
            print("todas las fuentes sanas")
        return 0

    try:
        avisar(informe, url)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        # Un 403/429 de la API de GitHub (o un gh que no contesta) no puede dejar el sitio sin
        # publicar ese dia: se avisa en el resumen y la corrida sigue (P1).
        print("::warning::No se pudo avisar en GitHub: " + detalle(e))
    return 0


if __name__ == "__main__":
    sys.exit(main())
