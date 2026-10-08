#!/usr/bin/env python3
"""Arma indice.json recorriendo los catalogos declarados en tiendas.json.

Uso:
    python indexar.py                   # indexa todas las fuentes activas
    python indexar.py --solo mexx       # una sola
    python indexar.py --max-paginas 5   # corta antes, para probar
    python indexar.py --probar URL      # dice que extractor sirve para una fuente nueva

Las fuentes son configuracion, no codigo: viven en tiendas.json. Sumar una nueva
es agregar un bloque ahi; --probar te dice cual de los extractores genericos le
funciona sin que tengas que leer el HTML a mano. Hay tres formas de enumerar un
catalogo (json, api y listados) y cualquier tienda nueva cae en alguna.
"""

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import historial
import salud

RAIZ = Path(__file__).resolve().parent
TIENDAS = RAIZ / "tiendas.json"
INDICE = RAIZ / "indice.json"
HISTORIAL = RAIZ / "historial"    # la rama `historial`: un CSV por mes con los cambios
SALUD = RAIZ / "salud.json"       # cuanto trajo cada fuente, para avisar si se cae
AR = timezone(timedelta(hours=-3))  # Argentina no tiene horario de verano
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
PAUSA = 0.35          # segundos entre pedidos, para no castigar a las tiendas
TOPE_PAGINAS = 40     # paginas por listado antes de cortar

for flujo in (sys.stdout, sys.stderr):
    try:
        flujo.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


def _soporta(t):
    try:
        t.encode(sys.stdout.encoding or "ascii")
        return True
    except (UnicodeEncodeError, LookupError):
        return False


OK, FALLA, PUNTO = ("ok", "x", "-") if not _soporta("✓✗·") else ("✓", "✗", "·")
_C = sys.stdout.isatty()
VERDE, ROJO, GRIS, AMAR, NEG, FIN = (
    ("\033[32m", "\033[31m", "\033[90m", "\033[33m", "\033[1m", "\033[0m")
    if _C else ("", "", "", "", "", ""))


def bajar(url):
    pedido = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,application/json,*/*",
        "Accept-Language": "es-AR,es;q=0.9"})
    with urllib.request.urlopen(pedido, timeout=45) as r:
        return r.read().decode("utf-8", "replace")


def numero(texto):
    """'284.050' y '23.450,01' -> 284050 / 23450."""
    if texto is None:
        return None
    t = str(texto).strip().replace(".", "").split(",")[0]
    return int(t) if t.isdigit() else None


def absoluta(base, ruta):
    return ruta if ruta.startswith("http") else urllib.parse.urljoin(base + "/", ruta.lstrip("/"))


def limpio(t):
    # Varias tiendas dejan entidades HTML en el alt o el title del producto
    # ('2.5&quot;', 'Memoria &amp; Disco'). Sin esto se veian crudas en la web.
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


# --- Enumeracion de listados ------------------------------------------------

def listados(tienda):
    """Las URLs de listado que hay que recorrer, segun como declare la fuente."""
    o = tienda["catalogo"]["origen"]
    if o["tipo"] == "sitemap":
        urls = re.findall(r"<loc>(.*?)</loc>", bajar(o["url"]))
        return [u for u in urls if o["contiene"] in u]
    if o["tipo"] == "enlaces":
        return sorted(set(re.findall(o["re"], bajar(o["url"]))))
    if o["tipo"] == "terminos":
        return [o["plantilla"].format(termino=urllib.parse.quote(t)) for t in o["terminos"]]
    raise ValueError("origen desconocido: " + o["tipo"])


def tarjetas(html, cfg):
    """Parte el HTML en tarjetas y saca url, nombre y precio de cada una.

    Un campo puede declarar varias alternativas: gana la primera que pegue. Hace
    falta porque muchas tiendas marcan distinto el producto en oferta.
    """
    salida = []
    for trozo in html.split(cfg["tarjeta"])[1:]:
        trozo = trozo[:6000]
        campos = {}
        for clave, patron in cfg["re"].items():
            alternativas = patron if isinstance(patron, list) else [patron]
            campos[clave] = None
            for alt in alternativas:
                m = re.search(alt, trozo)
                if m:
                    campos[clave] = m.group(1)
                    break
        precio = numero(campos.get("precio"))
        if not campos.get("url") or not campos.get("nombre") or precio is None:
            continue
        salida.append({"url": campos["url"], "nombre": limpio(campos["nombre"]),
                       "precio": precio, "lista": numero(campos.get("lista"))})
    return salida


def indexar_listados(tienda, max_paginas):
    cfg = tienda["catalogo"]
    vistos, items = set(), []
    fuentes = listados(tienda)
    print("  " + str(len(fuentes)) + " listados")
    for i, listado in enumerate(fuentes, 1):
        n = cfg.get("desde", 1)
        paginas = 0
        while paginas < min(max_paginas, TOPE_PAGINAS):
            try:
                html = bajar(cfg["pagina"].format(listado=listado, n=n))
            except (urllib.error.URLError, OSError):
                break
            nuevos = [t for t in tarjetas(html, cfg) if t["url"] not in vistos]
            if not nuevos:
                break
            for t in nuevos:
                vistos.add(t["url"])
                t["url"] = absoluta(tienda["base"], t["url"])
                items.append(t)
            n += 1
            paginas += 1
            time.sleep(PAUSA)
        if i % 20 == 0 or i == len(fuentes):
            print("    " + str(i) + "/" + str(len(fuentes)) + " listados " + PUNTO
                  + " " + str(len(items)) + " productos")
    return items


def imagen(fila, cfg):
    """URL de la primera foto del producto, o "" si la fuente no publica fotos.

    Las APIs suelen dar solo el nombre del archivo ([{"nombre": ..., "orden": 1}]):
    'imagen_url' de la fuente dice como convertirlo en una URL que se pueda mostrar.
    """
    campo = cfg["campos"].get("imagen")
    fotos = fila.get(campo) if campo else None
    if not fotos:
        return ""
    if isinstance(fotos, list):
        fotos = sorted(fotos, key=lambda x: x.get("orden", 0) if isinstance(x, dict) else 0)
        fotos = fotos[0]
    nombre = fotos.get("nombre") if isinstance(fotos, dict) else fotos
    if not nombre:
        return ""
    plantilla = cfg.get("imagen_url")
    return plantilla.format(nombre=nombre) if plantilla else str(nombre)


def indexar_api(tienda, max_paginas):
    """Catalogo servido por una API JSON paginada, categoria por categoria."""
    cfg = tienda["catalogo"]
    c = cfg["campos"]
    vistos, items = set(), []
    cats = cfg["categorias"]
    print("  " + str(len(cats)) + " categorias")
    for i, cat in enumerate(cats, 1):
        n = 1
        while n <= min(max_paginas, TOPE_PAGINAS):
            try:
                cuerpo = json.loads(bajar(cfg["plantilla"].format(categoria=cat, n=n)))
            except (urllib.error.URLError, OSError, ValueError):
                break
            filas = cuerpo.get(cfg["lista"]) or []
            nuevas = [f for f in filas if f.get(c["url"]) and f[c["url"]] not in vistos]
            if not nuevas:
                break
            for f in nuevas:
                if not f.get(c["precio"]) or not f.get(c["nombre"]):
                    continue
                vistos.add(f[c["url"]])
                items.append({"nombre": limpio(f[c["nombre"]]), "precio": int(f[c["precio"]]),
                              "lista": f.get(c.get("lista")), "url": f[c["url"]],
                              "via": f.get(c.get("via")), "imagen": imagen(f, cfg)})
            n += 1
            time.sleep(PAUSA)
        print("    " + str(i) + "/" + str(len(cats)) + " categorias " + PUNTO
              + " " + str(len(items)) + " productos")
    return items


def indexar_json(tienda):
    """Catalogo entero servido como un unico JSON estatico."""
    cfg = tienda["catalogo"]
    c = cfg["campos"]
    items = []
    for fila in json.loads(bajar(cfg["url"])):
        precio = fila.get(c["precio"]) or fila.get(c["lista"])
        nombre = fila.get(c["nombre"])
        if not precio or not nombre:
            continue
        slug = re.sub(r"[^A-Za-z0-9]+", "_", nombre).strip("_")
        items.append({"nombre": limpio(nombre), "precio": int(precio),
                      "lista": fila.get(c["lista"]),
                      "url": absoluta(tienda["base"], cfg["ruta"].format(slug=slug, id=fila[c["id"]])),
                      "imagen": imagen(fila, cfg)})
    return items


# --- Diagnostico de una fuente nueva ---------------------------------------

SONDAS = {
    "og": (r'property="og:price:amount"\s+content="([\d.]+)"', "Open Graph"),
    "meta": (r'name="product:price:amount"\s+content="([\d.]+)"', "meta product:price"),
    "itemprop": (r'itemprop="price"\s+content="([\d.]+)"', "microdatos schema.org"),
    "jsonld": (r'"@type"\s*:\s*"Offer"[\s\S]{0,300}?"price"\s*:\s*"?([\d.]+)"?', "JSON-LD"),
    "twitter": (r'name="twitter:data1"\s+content="[^\d]*([\d.,]+)"', "Twitter card"),
}


def probar(url):
    print("\n" + NEG + "Probando" + FIN + " " + url + "\n")
    try:
        html = bajar(url)
    except (urllib.error.URLError, OSError) as e:
        print("  " + ROJO + FALLA + " no pude bajarla: " + str(e) + FIN)
        return 1
    print("  " + format(len(html), ",") + " bytes\n")
    sirve = []
    for clave, (patron, desc) in SONDAS.items():
        m = re.search(patron, html)
        if m:
            print("  " + VERDE + OK + FIN + " " + clave.ljust(10) + desc.ljust(24)
                  + NEG + "$" + m.group(1) + FIN)
            sirve.append(clave)
        else:
            print("  " + GRIS + FALLA + " " + clave.ljust(10) + desc + FIN)
    print()
    if sirve:
        print("  " + VERDE + "Usa" + FIN + '  "extractor": "' + sirve[0] + '"  en tiendas.json')
        print("  " + GRIS + "Falta solo declarar como enumerar el catalogo: "
              "sitemap, enlaces, terminos o api." + FIN)
    else:
        print("  " + AMAR + "Ningun extractor generico funciona: la fuente arma el precio con")
        print("  JavaScript. Fijate si publica un catalogo o una API JSON, como CompraGamer")
        print("  y ComparaYa, y usa \"tipo\": \"json\" o \"api\"." + FIN)
    return 0


# --- Principal --------------------------------------------------------------

def main(argv=None):
    ap = argparse.ArgumentParser(description="Arma el indice de busqueda.")
    ap.add_argument("--solo", metavar="FUENTE")
    ap.add_argument("--max-paginas", type=int, default=TOPE_PAGINAS)
    ap.add_argument("--probar", metavar="URL", help="diagnostica una fuente nueva")
    ap.add_argument("--historial", metavar="DIR", default=str(HISTORIAL),
                    help="carpeta del historial de precios")
    args = ap.parse_args(argv)

    if args.probar:
        return probar(args.probar)

    fuentes = {k: v for k, v in json.loads(TIENDAS.read_text(encoding="utf-8")).items()
               if not k.startswith("_")}
    if args.solo and args.solo not in fuentes:
        print(ROJO + "Fuente desconocida: " + args.solo + FIN)
        print("Opciones: " + ", ".join(fuentes))
        return 1

    previo = {}
    if INDICE.exists():
        for fila in json.loads(INDICE.read_text(encoding="utf-8")).get("productos", []):
            fila = (list(fila) + ["", 0, 0])[:7]     # filas viejas de 4, 5 o 6 campos
            previo.setdefault(fila[3], []).append(fila)

    # El historial vive en su propia rama y no en la cache de Actions. La clave
    # es (tienda, url): CompraGamer y ComparaYa publican las mismas URLs con
    # precios distintos, y con la URL sola una pisaba a la otra.
    carpeta = Path(args.historial)
    estado = historial.leer(carpeta)
    vivos = historial.vivos_por_tienda(estado)

    salida, resumen, relevados, actuales = [], {}, {}, {}
    for clave, fuente in fuentes.items():
        if not fuente.get("activa", True) or (args.solo and clave != args.solo):
            if clave in previo:                      # conservo lo que ya tenia indexado
                salida.extend(previo[clave])
                resumen[clave] = (len(previo[clave]), "sin tocar")
            continue
        print("\n" + NEG + fuente["nombre"] + FIN)
        t0 = time.time()
        tipo = fuente["catalogo"]["tipo"]
        try:
            if tipo == "json":
                items = indexar_json(fuente)
            elif tipo == "api":
                items = indexar_api(fuente, args.max_paginas)
            else:
                items = indexar_listados(fuente, args.max_paginas)
        except Exception as e:                       # una fuente caida no voltea el indice
            print("  " + ROJO + FALLA + " " + type(e).__name__ + ": " + str(e)[:70] + FIN)
            if clave in previo:
                salida.extend(previo[clave])
                resumen[clave] = (len(previo[clave]), "fallo, uso el anterior")
            else:
                resumen[clave] = (0, "fallo")
            relevados[clave] = 0
            continue
        if not items:
            # Un bloqueo en los listados no tira excepcion: cada pagina falla y se
            # corta. Cero productos es una fuente caida, no un catalogo vacio.
            print("  " + ROJO + FALLA + " no trajo ningun producto" + FIN)
            if clave in previo:
                salida.extend(previo[clave])
                resumen[clave] = (len(previo[clave]), "sin productos, uso el anterior")
            else:
                resumen[clave] = (0, "sin productos")
            relevados[clave] = 0
            continue
        rebaja_real = bool(fuente.get("lista_es_oferta"))
        relevados[clave] = len(items)
        bajaron = 0
        for it in items:
            lista = it.get("lista") or 0
            # Solo guardo el tachado si es una rebaja de verdad: en varias tiendas
            # el "precio de lista" es apenas el precio sin transferencia.
            if not rebaja_real or not lista or lista <= it["precio"]:
                lista = 0
            # Baja propia: lo que valia segun el historial. Este dato no depende
            # de lo que publique la tienda, asi que vale para las cinco.
            ayer = estado.get((clave, it["url"])) or 0
            propia = ayer if ayer > it["precio"] else 0
            if propia:
                bajaron += 1
            actuales[(clave, it["url"])] = it["precio"]
            salida.append([it["nombre"], it["precio"], it["url"], clave,
                           it.get("via") or "", lista, propia, it.get("imagen") or ""])
        if bajaron:
            print("  " + VERDE + str(bajaron) + " bajaron de precio" + FIN)
        resumen[clave] = (len(items), format(time.time() - t0, ".0f") + "s")
        print("  " + VERDE + OK + FIN + " " + str(len(items)) + " productos")

    generado = datetime.now(AR).isoformat(timespec="minutes")
    informe = salud.evaluar(vivos, relevados, {k: v["nombre"] for k, v in fuentes.items()}, generado)
    sanas = {k for k, f in informe["fuentes"].items() if f["estado"] == "ok"}
    filas = historial.cambios(estado, actuales, sanas, generado[:10])
    ruta_csv = historial.escribir(carpeta, generado[:10], filas)
    SALUD.write_text(json.dumps(informe, ensure_ascii=False, indent=1), encoding="utf-8")

    datos = {
        "generado": generado,
        "tiendas": {k: {"nombre": v["nombre"], "color": v["color"],
                        "segunda": bool(v.get("segunda_opinion"))} for k, v in fuentes.items()},
        "campos": ["nombre", "precio", "url", "tienda", "via", "lista", "antes", "imagen"],
        "productos": salida,
    }
    INDICE.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print("\n" + NEG + "Resumen" + FIN)
    for clave, (n, nota) in resumen.items():
        print("  " + fuentes[clave]["nombre"].ljust(14) + str(n).rjust(6)
              + " productos  " + GRIS + nota + FIN)
    kb = INDICE.stat().st_size / 1024
    bajaron = sum(1 for f in salida if len(f) > 6 and f[6])
    print("\n  " + VERDE + OK + FIN + " indice.json " + PUNTO + " " + str(len(salida))
          + " productos " + PUNTO + " " + format(kb, ".0f") + " KB")
    if estado:
        print("  " + VERDE + OK + FIN + " " + str(bajaron) + " bajaron de precio segun el historial")
    else:
        print("  " + GRIS + "historial vacio: las bajas propias empiezan a contar "
              "desde la proxima corrida" + FIN)
    if ruta_csv:
        print("  " + VERDE + OK + FIN + " historial " + PUNTO + " " + str(len(filas))
              + " filas nuevas en " + ruta_csv.name)
    for clave, f in informe["fuentes"].items():
        if f["estado"] != "ok":
            print("  " + AMAR + "! " + f["nombre"] + ": " + str(f["ahora"]) + " productos contra "
                  + str(f["previo"]) + " (" + f["estado"] + ")" + FIN)
    return 0


if __name__ == "__main__":
    sys.exit(main())
