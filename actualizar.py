#!/usr/bin/env python3
"""Actualiza precios, recalcula el analisis y reconstruye el sitio.

Uso:
    python actualizar.py              # releva, actualiza datos.json y reconstruye el HTML
    python actualizar.py --dry-run    # solo releva y muestra el informe, no escribe nada
    python actualizar.py --solo mexx  # releva una sola tienda
    python actualizar.py --build      # reinyecta datos.json en index.html y arma la copia del artifact

Cada tienda expone el precio en un metadato estable, asi que no hace falta
navegador. CompraGamer publica el catalogo entero como JSON; las otras tres lo
dejan en una etiqueta meta o en microdatos schema.org.
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DATOS = RAIZ / "datos.json"
COPIA = RAIZ / "comparativa-ram-ddr4-16gb.html"   # la genera construir(), no se versiona
INDICE = RAIZ / "index.html"
CATALOGO_CG = "https://static.compragamer.com/productos"
AR = timezone(timedelta(hours=-3))   # Argentina no tiene horario de verano
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# La consola de Windows arranca en cp1252: sin esto se rompe con las flechas.
for flujo in (sys.stdout, sys.stderr):
    try:
        flujo.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass


def _soporta(texto):
    try:
        texto.encode(sys.stdout.encoding or "ascii")
        return True
    except (UnicodeEncodeError, LookupError):
        return False


_UNI = _soporta("→▲▼✓✗·")
SUBE, BAJA, IGUAL, OK, FALLA, PUNTO, FLECHA = (
    ("▲", "▼", "=", "✓", "✗", "·", "→") if _UNI else
    ("+", "-", "=", "ok", "x", "-", "->"))

_COLOR = sys.stdout.isatty()
VERDE, ROJO, GRIS, AMAR, NEGRITA, FIN = (
    ("\033[32m", "\033[31m", "\033[90m", "\033[33m", "\033[1m", "\033[0m")
    if _COLOR else ("", "", "", "", "", ""))


def pesos(n):
    return "-" if n is None else "$" + f"{int(n):,}".replace(",", ".")


def bajar(url, binario=False):
    pedido = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/json,*/*",
        "Accept-Language": "es-AR,es;q=0.9",
    })
    with urllib.request.urlopen(pedido, timeout=45) as r:
        crudo = r.read()
    return crudo if binario else crudo.decode("utf-8", "replace")


# --- Extractores por tienda -------------------------------------------------

_cache_cg = {}


def precio_compragamer(prod):
    """CompraGamer publica el catalogo completo como JSON estatico."""
    if not _cache_cg:
        for fila in json.loads(bajar(CATALOGO_CG)):
            _cache_cg[int(fila["id_producto"])] = fila
    fila = _cache_cg.get(int(prod["fuente"]["id_producto"]))
    if fila is None:
        raise LookupError(f"id_producto {prod['fuente']['id_producto']} no esta en el catalogo")
    stock = fila.get("stock")
    return {
        "precio": fila.get("precioEspecial"),
        "precio_lista": fila.get("precioLista"),
        "sin_impuestos": fila.get("precio_sin_impuestos"),
        "stock": "en stock" if (stock or 0) > 0 else "sin stock",
    }


def precio_meta(prod):
    """Gaming City: <meta name="product:price:amount" content="236550">."""
    html = bajar(prod["url"])
    m = re.search(r'name="product:price:amount"\s+content="([\d.]+)"', html)
    if not m:
        raise LookupError("no encontre product:price:amount")
    lista = re.search(r"Precio de lista\s*\$\s*([\d.]+)", html)
    hay = re.search(r'name="product:availability"\s+content="([^"]+)"', html)
    return {
        "precio": int(float(m.group(1))),
        "precio_lista": int(lista.group(1).replace(".", "")) if lista else None,
        "stock": "en stock" if (hay and "in stock" in hay.group(1)) else "sin stock",
    }


def precio_itemprop(prod):
    """Mexx: microdatos schema.org."""
    html = bajar(prod["url"])
    m = re.search(r'itemprop="price"\s+content="([\d.]+)"', html)
    if not m:
        raise LookupError("no encontre itemprop=price")
    return {
        "precio": int(float(m.group(1))),
        "stock": "en stock" if re.search(r"EN STOCK", html, re.I) else "sin stock",
    }


def precio_og(prod):
    """FullH4rd: Open Graph."""
    html = bajar(prod["url"])
    m = re.search(r'property="og:price:amount"\s+content="([\d.]+)"', html)
    if not m:
        raise LookupError("no encontre og:price:amount")
    nivel = re.search(r"Stock (alto|medio|bajo) en la web", html, re.I)
    return {
        "precio": int(float(m.group(1))),
        "stock": f"stock {nivel.group(1).lower()}" if nivel else "sin stock",
    }


EXTRACTORES = {
    "compragamer": precio_compragamer,
    "meta": precio_meta,
    "itemprop": precio_itemprop,
    "og": precio_og,
}


# --- Relevamiento -----------------------------------------------------------

def relevar(datos, solo=None, hoy=None):
    """Releva cada producto seguido. Si uno no se puede verificar conserva su
    precio y queda marcado con `falla_desde`; se desmarca cuando vuelve a andar.
    Se guarda desde cuando falla y no cuando se verifico, asi datos.json cambia
    solo cuando algo cambia y el bot no commitea todos los dias."""
    hoy = hoy or datetime.now(AR).date().isoformat()
    cambios, errores = [], []
    productos = [p for p in datos["productos"]
                 if solo is None or p["tienda"] == solo]

    print(f"\n{NEGRITA}Relevando {len(productos)} productos{FIN}\n")
    for prod in productos:
        tienda = datos["tiendas"][prod["tienda"]]["nombre"]
        etiqueta = f"{prod['corto']} {PUNTO} {tienda}"
        try:
            nuevo = EXTRACTORES[prod["fuente"]["tipo"]](prod)
        except (urllib.error.URLError, LookupError, ValueError, KeyError) as e:
            errores.append((etiqueta, str(e)[:70]))
            print(f"  {ROJO}{FALLA}{FIN} {etiqueta:<42} {ROJO}{str(e)[:46]}{FIN}")
            prod.setdefault("falla_desde", hoy)
            continue

        antes, ahora = prod.get("precio"), nuevo["precio"]
        if ahora is None:
            errores.append((etiqueta, "precio vacio"))
            print(f"  {ROJO}{FALLA}{FIN} {etiqueta:<42} {ROJO}precio vacio{FIN}")
            prod.setdefault("falla_desde", hoy)
            continue
        prod.pop("falla_desde", None)

        if antes != ahora:
            delta = ahora - antes
            pct = delta / antes * 100
            color = ROJO if delta > 0 else VERDE
            flecha = SUBE if delta > 0 else BAJA
            cambios.append((etiqueta, antes, ahora, pct))
            print(f"  {color}{flecha}{FIN} {etiqueta:<42} "
                  f"{GRIS}{pesos(antes)}{FIN} {FLECHA} {NEGRITA}{pesos(ahora)}{FIN} "
                  f"{color}{pct:+.1f}%{FIN}")
        else:
            print(f"  {GRIS}{IGUAL}{FIN} {etiqueta:<42} {GRIS}{pesos(ahora)}{FIN}")

        if nuevo.get("stock") and nuevo["stock"] != prod.get("stock"):
            print(f"    {AMAR}stock: {prod.get('stock')} {FLECHA} {nuevo['stock']}{FIN}")

        # Un campo que el extractor informa vacio ya no lo publica la tienda: el
        # valor guardado esta vencido. Uno que el extractor no maneja se conserva.
        for campo in ("precio", "precio_lista", "sin_impuestos", "stock"):
            if nuevo.get(campo) is not None:
                prod[campo] = nuevo[campo]
            elif campo in nuevo:
                prod.pop(campo, None)

    return cambios, errores


# --- Analisis ---------------------------------------------------------------

def analizar(datos):
    """Recalcula lo que depende de los precios y avisa si cambio el podio."""
    por_id = {p["id"]: p for p in datos["productos"]}
    envio = datos["envio"]
    avisos = []

    # Un precio sin verificar no puede ser "el mas barato": se elige entre los
    # verificados, y solo si no queda ninguno se usa lo que haya.
    def por_precio(tipos):
        todos = [p for p in datos["productos"] if p["tipo"] in tipos]
        return sorted([p for p in todos if not p.get("falla_desde")] or todos, key=lambda p: p["precio"])

    rams = por_precio(("ram", "ram-ref"))
    cams = por_precio(("webcam", "webcam-ref"))

    print(f"\n{NEGRITA}Analisis{FIN}\n")
    print(f"  Memoria mas barata   {rams[0]['corto']} {PUNTO} {pesos(rams[0]['precio'])}")
    print(f"  Webcam mas barata    {cams[0]['corto']} {PUNTO} {pesos(cams[0]['precio'])}")

    # Costo real en Mendoza: las de Gaming City se retiran gratis.
    def puesto(p, modo="punto"):
        if p["tienda"] == "gamingcity":
            return p["precio"]
        return p["precio"] + envio[modo]

    adata, kingston = por_id["adata-d35"], por_id["kingston-kvr"]
    for p in (adata, kingston):
        if p.get("falla_desde"):
            avisos.append(f"El chequeo del podio usa el precio sin verificar de {p['corto']} "
                          f"(falla desde {p['falla_desde']}): no lo des por bueno.")
    a_punto, a_casa = puesto(adata, "punto"), puesto(adata, "domicilio")
    k = kingston["precio"]
    print(f"\n  Puesto en {envio['zona']} (CP {envio['cp']}):")
    print(f"    {adata['corto']:<16} punto {pesos(a_punto)} {PUNTO} domicilio {pesos(a_casa)}")
    print(f"    {kingston['corto']:<16} retiro gratis {pesos(k)}")

    if a_casa < k:
        print(f"    {VERDE}{FLECHA} el ADATA gana aun con envio a domicilio "
              f"({pesos(k - a_casa)} menos){FIN}")
    elif a_punto < k:
        print(f"    {AMAR}{FLECHA} el ADATA gana solo con retiro en punto "
              f"({pesos(k - a_punto)} menos){FIN}")
        avisos.append("El ADATA ya no gana con envio a domicilio. Revisar el veredicto.")
    else:
        print(f"    {ROJO}{FLECHA} el Kingston paso a ser mas barato puesto en Mendoza{FIN}")
        avisos.append("DIO VUELTA EL PODIO: el Kingston quedo mas barato que el ADATA "
                      "puesto en Mendoza. Hay que reescribir el veredicto.")

    # Combo RAM + webcam.
    c920s = por_id["c920s"]
    combo_gc = k + c920s["precio"]
    combo_partido = a_punto + c920s["precio"]
    print(f"\n  Combo RAM + webcam:")
    print(f"    Todo en Gaming City   {pesos(combo_gc)}")
    print(f"    Partido               {pesos(combo_partido)}  "
          f"({pesos(abs(combo_gc - combo_partido))} "
          f"{'menos' if combo_partido < combo_gc else 'mas'})")

    # Que tienda gana cada producto que se vende en mas de una.
    sin_stock = [p for p in datos["productos"] if p.get("stock") == "sin stock"]
    if sin_stock:
        print()
        for p in sin_stock:
            print(f"  {ROJO}sin stock{FIN}  {p['corto']} {PUNTO} {datos['tiendas'][p['tienda']]['nombre']}")
            avisos.append(f"{p['corto']} quedo sin stock en {datos['tiendas'][p['tienda']]['nombre']}.")

    datos["calculado"] = {
        "adata_punto": a_punto, "adata_domicilio": a_casa,
        "kingston_retiro": k, "combo_gc": combo_gc, "combo_partido": combo_partido,
        "ram_mas_barata": rams[0]["id"], "webcam_mas_barata": cams[0]["id"],
    }
    return avisos


# --- Construccion del sitio -------------------------------------------------

INICIO = "/* === DATOS: generado por actualizar.py, no editar a mano === */"
FINAL = "/* === FIN DATOS === */"


SOLO_WEB = re.compile(r"[ \t]*<!-- solo-web -->.*?<!-- /solo-web -->[ \t]*\n?", re.S)
ESQUELETO = re.compile(r"^[ \t]*(?:<!doctype html>|</?(?:html|head|body)\b[^>]*>)[ \t]*\n?", re.I | re.M)
JS_SRC = re.compile(r'<script src="(js/[\w.-]+\.js)"></script>')
CSS_LINK = re.compile(r'<link rel="stylesheet" href="(css/[\w.-]+\.css)">')


def armar_artifact(html, leer):
    """La copia para el artifact: sin el esqueleto ni lo que solo sirve en la web
    (analitica, Open Graph), y con los scripts de js/ adentro, porque el artifact
    es un solo archivo y el visor le pone su propio <head>."""
    html = SOLO_WEB.sub("", html)
    html = ESQUELETO.sub("", html)
    html = CSS_LINK.sub(lambda m: "<style>\n" + leer(m.group(1)).rstrip("\n") + "\n</style>", html)
    html = JS_SRC.sub(lambda m: "<script>\n" + leer(m.group(1)).rstrip("\n") + "\n</script>", html)
    return html.lstrip()


def construir(datos, pagina=INDICE, copia=COPIA, verificado=None):
    """Inyecta datos.json en index.html y arma la copia del artifact.

    index.html es el unico HTML que se edita a mano. `verificado` es la hora del
    relevamiento: va al sitio publicado pero no a datos.json, asi el bot no
    commitea todos los dias aunque no cambie ningun precio."""
    if not pagina.exists():
        print(f"{ROJO}No encuentro {pagina.name}{FIN}")
        return False

    html = pagina.read_text(encoding="utf-8")
    publicados = dict(datos, verificado=verificado) if verificado else datos
    bloque = f"{INICIO}\nconst DATOS = {json.dumps(publicados, ensure_ascii=False, indent=1)};\n{FINAL}"
    patron = re.compile(re.escape(INICIO) + r".*?" + re.escape(FINAL), re.S)
    if not patron.search(html):
        print(f"{ROJO}No encuentro el bloque de datos en {pagina.name}{FIN}")
        return False
    html = patron.sub(lambda _: bloque, html)
    pagina.write_text(html, encoding="utf-8")
    copia.write_text(armar_artifact(html, lambda ruta: (pagina.parent / ruta).read_text(encoding="utf-8")),
                     encoding="utf-8")
    print(f"\n  {VERDE}{OK}{FIN} {pagina.name} y {copia.name} reconstruidos")
    return True


# --- Principal --------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Actualiza precios y reconstruye el sitio.")
    ap.add_argument("--dry-run", action="store_true", help="releva pero no escribe nada")
    ap.add_argument("--solo", metavar="TIENDA", help="compragamer | gamingcity | mexx | fullh4rd")
    ap.add_argument("--build", action="store_true", help="solo reconstruye, no sale a la web")
    args = ap.parse_args()

    datos = json.loads(DATOS.read_text(encoding="utf-8"))

    if args.build:
        return 0 if construir(datos) else 1

    if args.solo and args.solo not in datos["tiendas"]:
        print(f"{ROJO}Tienda desconocida: {args.solo}{FIN}")
        print("Opciones: " + ", ".join(datos["tiendas"]))
        return 1

    antes = {p["id"]: p.get("precio") for p in datos["productos"]}
    cambios, errores = relevar(datos, args.solo)
    avisos = analizar(datos)

    print(f"\n{NEGRITA}Resumen{FIN}")
    print(f"  {len(cambios)} con cambio de precio {PUNTO} "
          f"{len(datos['productos']) - len(cambios) - len(errores)} sin cambio · "
          f"{len(errores)} con error")
    for texto in avisos:
        print(f"  {AMAR}! {texto}{FIN}")
    if errores:
        print(f"\n  {ROJO}Revisar a mano:{FIN}")
        for etiqueta, motivo in errores:
            print(f"    {etiqueta}: {motivo}")

    if args.dry_run:
        print(f"\n{GRIS}--dry-run: no se escribio nada.{FIN}")
        return 0

    if cambios:
        hoy = date.today().isoformat()
        datos["historial"].append({
            "fecha": hoy,
            "cambios": [{"id": p["id"], "antes": antes.get(p["id"]), "ahora": p["precio"]}
                        for p in datos["productos"]
                        if antes.get(p["id"]) != p.get("precio")],
        })
        datos["historial"] = datos["historial"][-24:]
        datos["actualizado"] = hoy

    DATOS.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n  {VERDE}{OK}{FIN} datos.json actualizado")
    construir(datos, verificado=datetime.now(AR).isoformat(timespec="minutes"))

    if cambios:
        print(f"\n{GRIS}Para publicar:{FIN}")
        print('  git add -A && git commit -m "actualizacion de precios" && git push')
    return 0


if __name__ == "__main__":
    sys.exit(main())
