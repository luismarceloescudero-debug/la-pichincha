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
import math
import http.client
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import historial
import modelo
import salud
import serie

RAIZ = Path(__file__).resolve().parent
TIENDAS = RAIZ / "tiendas.json"
INDICE = RAIZ / "indice.json"
HISTORIAL = RAIZ / "historial"    # la rama `historial`: un CSV por mes con los cambios
SALUD = RAIZ / "salud.json"       # cuanto trajo cada fuente, para avisar si se cae
AR = timezone(timedelta(hours=-3))  # Argentina no tiene horario de verano
# Valor por defecto de cada campo de una fila del indice, en orden: nombre, precio,
# url, tienda, via, lista, antes, imagen, sellos, modelo, desde. Completa filas de indices viejos.
FILA_VACIA = ["", 0, "", "", "", 0, 0, "", "", "", ""]
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
PAUSA = 0.35          # segundos entre pedidos, para no castigar a las tiendas
TOPE_PAGINAS = 40     # paginas por listado antes de cortar
PAUSA_FICHA = 4       # segundos entre fichas de producto: son paginas pesadas, una por aviso nuevo
REINTENTO_DIAS = 30   # una ficha que no trajo codigo se vuelve a mirar pasado este tiempo
PODA_DIAS = 60        # lo guardado de un aviso que ya no se publica se descarta pasado este tiempo
BLOQUEOS = (403, 429, 503)   # un bloqueo no se esquiva: se corta y se retoma otro dia (principio III)
FICHAS = "fichas.json"       # la cache de part numbers vive junto al historial, en su rama

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
    """Una pagina como texto. Un corte a mitad de respuesta (IncompleteRead) se reintenta una vez:
    es la red, no la tienda negandose; si se repite, sale como error de red (OSError) y la fuente
    lo maneja como cualquier caida. Un 403 o un 429 no se reintentan: son una respuesta."""
    pedido = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,application/json,*/*",
        "Accept-Language": "es-AR,es;q=0.9"})
    for intento in (1, 2):
        try:
            with urllib.request.urlopen(pedido, timeout=45) as r:
                return r.read().decode("utf-8", "replace")
        except http.client.IncompleteRead as e:
            if intento == 2:
                raise OSError("respuesta cortada dos veces: " + url) from e
            time.sleep(PAUSA * 4)


def numero(texto):
    """'284.050' y '23.450,01' -> 284050 / 23450."""
    if texto is None:
        return None
    t = str(texto).strip().replace(".", "").split(",")[0]
    return int(t) if t.isdigit() else None


def _clave(texto):
    sin_acentos = unicodedata.normalize("NFD", str(texto).lower()).encode("ascii", "ignore").decode()
    return " " + re.sub(r"[^a-z0-9]+", " ", sin_acentos).strip() + " "


_SIN_MARCA = {"", "generico", "generica", "sin marca", "otro", "otra", "otros", "varios", "n a", "na"}


def _numero_razonable(x, minimo, maximo):
    """Un numero de verdad y en rango: el JSON de una API puede traer Infinity, NaN, un booleano o un texto."""
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) and minimo <= x <= maximo


def nombre_enriquecido(titulo, marca=None, specs=None):
    """El titulo de un agregador con lo que sabe y el titulo no dice. ComparaYa publica la marca y las especificaciones
    en campos aparte, y muchas tiendas escriben el titulo sin la marca ("Monitor Gaming 25\" FHD 240Hz con panel IPS",
    marca Samsung) o sin los Hz: sin eso el aviso no aparece al buscar por marca, no se reconoce la marca para ordenarlo
    y los minimos de gama (Hz, pulgadas) no lo ven. Solo agrega lo que falta, al final; nunca cambia lo que el titulo ya dice."""
    nombre = limpio(titulo)
    if isinstance(marca, str) and _clave(marca).strip() not in _SIN_MARCA:
        primera = _clave(marca).split()[0]
        if " " + primera + " " not in _clave(nombre):
            # al final: en el medio partiria "Placa de Video", "Disco Solido" o "RTX 4060" y el rubro dejaria de reconocerse
            nombre = f"{nombre} {limpio(marca)}"
    specs = specs if isinstance(specs, dict) else {}
    hz = specs.get("refresh_rate_hz")
    if _numero_razonable(hz, 30, 1000) and not re.search(r"\d\s?hz", nombre, re.I):
        nombre += f" {int(hz)}Hz"
    pulgadas = specs.get("screen_inches")
    if _numero_razonable(pulgadas, 5, 120):
        cifra = format(float(pulgadas), "g")
        dicho = re.search(r"\d\s?(?:\"|''|\u2033|\u201d|pulg)", nombre, re.I) or re.search(
            r"\b" + re.escape(cifra).replace(r"\.", "[.,]") + r"\b", nombre)
        if not dicho:
            nombre += f' {cifra}"'
    return nombre


def url_valida(url):
    """Una URL http(s) sin comillas, espacios ni corchetes angulares: lo unico que puede ir a un enlace del sitio."""
    return isinstance(url, str) and re.fullmatch(r"https?://[^\s\"'<>`\\\x00-\x1f]+", url, re.I) is not None


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
        urls = [u for u in urls if o["contiene"] in u and not any(x in u for x in o.get("excluye", []))]
        if o.get("hojas"):
            # Solo las categorias que no tienen subcategorias: la de arriba ya las lista a todas, repetidas.
            urls = [u for u in urls if not any(v.startswith(u.rstrip("/") + "/") for v in urls)]
        return urls
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
                       "precio": precio, "lista": numero(campos.get("lista")),
                       "imagen": limpio(campos.get("imagen") or "")})
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
                if t["imagen"]:
                    t["imagen"] = absoluta(tienda["base"], t["imagen"])
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


def valor(fila, ruta):
    """El valor de un campo anidado: valor(fila, "specifications.Modelo")."""
    for parte in ruta.split("."):
        fila = fila.get(parte) if isinstance(fila, dict) else None
    return fila


def sellos(fila, cfg):
    """Letras de las senales que publica la fuente: i internacional, o tienda
    oficial, e envio gratis. 'sellos' en tiendas.json dice donde esta cada una,
    con puntos para entrar en objetos ("specifications.is_international"). 'usados' dice en que campo
    viene la condicion y que valores cuentan como usado (u)."""
    salida = ""
    for letra, ruta in (cfg.get("sellos") or {}).items():
        dato = valor(fila, ruta)
        if dato and str(dato).lower() not in ("false", "no", "0"):
            salida += letra
    usados = cfg.get("usados")        # la condicion que publica la fuente: u = usado, reacondicionado o caja abierta
    if usados and fila.get(usados["campo"]) in usados["valores"]:
        salida += "u"
    return salida


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
            sin_stock = cfg.get("sin_stock")   # lo que la propia fuente dice que no tiene stock no entra
            for f in nuevas:
                if not f.get(c["precio"]) or not f.get(c["nombre"]):
                    continue
                if sin_stock and f.get(sin_stock["campo"]) in sin_stock["valores"]:
                    continue
                vistos.add(f[c["url"]])
                items.append({"nombre": nombre_enriquecido(f[c["nombre"]], f.get(c.get("marca")), f.get(c.get("specs"))),
                              "precio": int(f[c["precio"]]),
                              "lista": f.get(c.get("lista")), "url": f[c["url"]],
                              "via": f.get(c.get("via")), "imagen": imagen(f, cfg),
                              "sellos": sellos(f, cfg),
                              "sku": modelo.modelo_de_api(valor(f, c["modelo"])) if c.get("modelo") else None})
            n += 1
            time.sleep(PAUSA)
        print("    " + str(i) + "/" + str(len(cats)) + " categorias " + PUNTO
              + " " + str(len(items)) + " productos")
    return items


def indexar_woocommerce(tienda, max_paginas):
    """Tienda WooCommerce por su Store API publica, la que usa el propio carrito del sitio:
    /wp-json/wc/store/v1/products, de a 'por_pagina' (hasta 100) y en orden, hasta que vuelve vacia.
    Una sola lectura para todas: sumar una tienda es configuracion. Solo lo que esta en stock; los
    precios vienen en centavos ('currency_minor_unit'). Se usa solo donde robots.txt no prohibe /wp-json/wc/."""
    cfg = tienda["catalogo"]
    por_pagina = cfg.get("por_pagina", 100)
    # El tope es el de la tienda: --max-paginas es por categoria de los listados (el workflow usa 12) y aca
    # no hay categorias; con ese 12, Max Tecno quedaba en 1.200 de 5.954 (16/10). max_paginas no se usa.
    limite = cfg.get("tope_paginas", TOPE_PAGINAS)
    plantilla = tienda["base"].rstrip("/") + "/wp-json/wc/store/v1/products?per_page=" + str(por_pagina) + "&page={n}"
    vistos, items = set(), []
    for n in range(1, limite + 1):
        try:
            filas = json.loads(bajar(plantilla.format(n=n)).lstrip("\ufeff"))   # algunas tiendas mandan BOM
        except (urllib.error.URLError, OSError, ValueError):
            break
        if not filas:
            break
        for f in filas:
            precios = f.get("prices") or {}
            divisor = 10 ** int(precios.get("currency_minor_unit") or 0)
            try:
                precio = int(precios.get("price") or 0) // divisor
                regular = int(precios.get("regular_price") or 0) // divisor
            except (TypeError, ValueError):
                continue
            url, nombre = f.get("permalink"), f.get("name")
            if not f.get("is_in_stock") or precio <= 0 or not url or not nombre or url in vistos:
                continue
            vistos.add(url)
            foto = (f.get("images") or [{}])[0]
            items.append({"nombre": limpio(nombre), "precio": precio, "lista": regular if regular > precio else None,
                          "url": url, "imagen": foto.get("thumbnail") or foto.get("src") or "", "sellos": "",
                          "sku": modelo.sku_de(f.get("sku")) if f.get("sku") else None})
        if n % 10 == 0:
            print("    pagina " + str(n) + " " + PUNTO + " " + str(len(items)) + " productos")
        time.sleep(PAUSA)
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
                      "imagen": imagen(fila, cfg), "sellos": sellos(fila, cfg),
                      "sku": modelo.sku_de(fila.get(c["sku"])) if c.get("sku") else None})
    return items


# --- Part number desde la ficha del producto (B3-bis) ----------------------------------------------------------

def _dias(entrada, hoy):
    try:
        return (hoy - date.fromisoformat(entrada["dia"])).days
    except (KeyError, TypeError, ValueError):
        return 10 ** 6          # una entrada ilegible cuenta como vieja


def leer_fichas(carpeta):
    """La cache {url: {"mpn": codigo o None, "dia": fecha}} que dejo la corrida anterior; vacia si falta o esta rota."""
    try:
        datos = json.loads((Path(carpeta) / FICHAS).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return datos if isinstance(datos, dict) else {}


def escribir_fichas(carpeta, cache):
    """Guarda la cache ordenada (diffs chicos en la rama `historial`) y no toca el archivo si no cambio nada."""
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / FICHAS
    texto = json.dumps(cache, ensure_ascii=False, sort_keys=True, indent=0)
    try:
        if ruta.read_text(encoding="utf-8") == texto:
            return
    except OSError:
        pass
    ruta.write_text(texto, encoding="utf-8")


def completar_con_fichas(tienda, items, cache, hoy, pedir=None, dormir=time.sleep):
    """Las tiendas que no publican el part number en el listado lo traen en la ficha de cada producto. Esto pide
    la ficha de los avisos de los rubros de `tienda["ficha"]["rubros"]` que todavia no la tienen y completa
    `it["sku"]`, que es lo que despues agrupa el mismo modelo entre tiendas.

    Cuesta un pedido por aviso, una sola vez: el resultado (tambien "sin codigo") queda en `cache` y se reintenta a
    los REINTENTO_DIAS. Se piden como mucho `tope` fichas por corrida, con pausa; si la tienda bloquea (403, 429,
    503) no se insiste esa corrida. Devuelve {"pedidas", "pendientes", "bloqueada"}."""
    resumen = {"pedidas": 0, "pendientes": 0, "bloqueada": False}
    cfg = tienda.get("ficha")
    if not cfg:
        return resumen
    pedir = pedir or bajar
    rubros, tope = set(cfg.get("rubros", ())), cfg.get("tope", 40)
    for it in items:
        if it.get("sku") or modelo.rubro_de(it["nombre"]) not in rubros or modelo.bloqueado_para_agrupar(it["nombre"]):
            continue
        guardada = cache.get(it["url"])
        if guardada and (guardada.get("mpn") or _dias(guardada, hoy) < REINTENTO_DIAS):
            if guardada.get("mpn"):
                it["sku"] = guardada["mpn"]
            continue
        if resumen["bloqueada"] or resumen["pedidas"] >= tope:
            resumen["pendientes"] += 1
            continue
        try:
            pagina = pedir(it["url"])
        except urllib.error.HTTPError as e:
            if e.code in BLOQUEOS:
                resumen["bloqueada"] = True
                resumen["pendientes"] += 1
            continue            # un 404 u otro error: no se guarda, se prueba en la proxima
        except (urllib.error.URLError, OSError):
            continue
        mpn = modelo.mpn_de_ficha(pagina, cfg["extractor"])
        cache[it["url"]] = {"mpn": mpn, "dia": hoy.isoformat()}
        if mpn:
            it["sku"] = mpn
        resumen["pedidas"] += 1
        dormir(PAUSA_FICHA)
    vivas = {it["url"] for it in items}
    for url in [u for u, e in cache.items() if u.startswith(tienda["base"]) and u not in vivas and _dias(e, hoy) > PODA_DIAS]:
        del cache[url]
    return resumen


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

    previo, relevado = {}, {}
    if INDICE.exists():
        anterior = json.loads(INDICE.read_text(encoding="utf-8"))
        for fila in anterior.get("productos", []):
            fila = list(fila)[:11] + FILA_VACIA[len(fila):]   # filas viejas: cada faltante con su valor
            if not url_valida(fila[2]):                       # un indice viejo no reintroduce una URL que hoy no pasa
                continue
            fila[9] = fila[9] or modelo.modelo_de(fila[0])    # lo que vino de un catalogo se conserva
            previo.setdefault(fila[3], []).append(fila)
        # Cuando se relevo por ultima vez cada fuente. Lo que se reusa de una
        # fuente caida conserva esa hora: no es un precio de hoy. Un indice
        # anterior a este campo usa la fecha en que se genero.
        for clave in previo:
            relevado[clave] = ((anterior.get("tiendas") or {}).get(clave, {}).get("relevado")
                               or anterior.get("generado"))

    # El historial vive en su propia rama y no en la cache de Actions. La clave
    # es (tienda, url): CompraGamer y ComparaYa publican las mismas URLs con
    # precios distintos, y con la URL sola una pisaba a la otra.
    carpeta = Path(args.historial)
    estado = historial.leer(carpeta)
    series = serie.cargar(carpeta)               # para los sellos de minimo y de rebaja inflada
    hoy = datetime.now(AR).date()
    # La baja propia se mide contra el precio de antes de hoy: si el indexador corre dos veces en el dia,
    # la segunda no compara contra lo que guardo la primera (18/10: 29 bajas en el historial, 0 en el indice).
    ayeres = historial.leer(carpeta, antes_de=hoy.isoformat())
    vivos = historial.vivos_por_tienda(estado)

    salida, resumen, relevados, actuales, frescas = [], {}, {}, {}, set()
    fichas = leer_fichas(carpeta)                # part numbers ya leidos de las fichas (B3-bis)
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
            elif tipo == "woocommerce":
                items = indexar_woocommerce(fuente, args.max_paginas)
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
        # Ni "javascript:" ni comillas: la URL va a un href del sitio. Se filtra antes de contar, asi la salud de la fuente
        # mide lo que de verdad entra al indice, y se avisa cuanto se descarto.
        validos = [it for it in items if url_valida(it.get("url"))]
        if len(validos) < len(items):
            print("  " + AMAR + "! " + str(len(items) - len(validos)) + " avisos con una URL invalida, descartados" + FIN)
        items = validos
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
        if fuente.get("ficha"):
            f = completar_con_fichas(fuente, items, fichas, hoy)
            print("  " + VERDE + OK + FIN + " fichas " + PUNTO + " " + str(f["pedidas"]) + " pedidas, "
                  + str(f["pendientes"]) + " pendientes para otra corrida")
            if f["bloqueada"]:
                print("  " + AMAR + "! la tienda bloqueo las fichas: no se insiste hoy" + FIN)
        rebaja_real = bool(fuente.get("lista_es_oferta"))
        relevados[clave] = len(items)
        frescas.add(clave)
        bajaron = 0
        for it in items:
            lista = it.get("lista") or 0
            # Solo guardo el tachado si es una rebaja de verdad: en varias tiendas
            # el "precio de lista" es apenas el precio sin transferencia.
            if not rebaja_real or not lista or lista <= it["precio"]:
                lista = 0
            # Baja propia: lo que valia segun el historial. Este dato no depende
            # de lo que publique la tienda, asi que vale para todas.
            ayer = ayeres.get((clave, it["url"])) or 0
            propia = ayer if ayer > it["precio"] else 0
            if propia:
                bajaron += 1
            actuales[(clave, it["url"])] = it["precio"]
            desde = serie.desde_cuando(series.get((clave, it["url"]), []), hoy, it["precio"])
            salida.append([it["nombre"], it["precio"], it["url"], clave,
                           str(it.get("via") or ""), lista, propia,
                           it.get("imagen") if url_valida(it.get("imagen")) else "",   # la foto va a un CSS del sitio
                           (it.get("sellos") or "")
                           + serie.sellos_de(series.get((clave, it["url"]), []), hoy, it["precio"]),
                           modelo.modelo_de(it["nombre"], it.get("sku")),
                           desde.isoformat() if desde else ""])
        if bajaron:
            print("  " + VERDE + str(bajaron) + " bajaron de precio" + FIN)
        resumen[clave] = (len(items), format(time.time() - t0, ".0f") + "s")
        print("  " + VERDE + OK + FIN + " " + str(len(items)) + " productos")

    modelo.completar_con_conocidos(salida)     # los avisos que nombran un codigo ya conocido
    if fichas or (carpeta / FICHAS).exists():
        escribir_fichas(carpeta, fichas)
    generado = datetime.now(AR).isoformat(timespec="minutes")
    relevado.update(dict.fromkeys(frescas, generado))
    informe = salud.evaluar(vivos, relevados, {k: v["nombre"] for k, v in fuentes.items()}, generado)
    sanas = {k for k, f in informe["fuentes"].items() if f["estado"] == "ok"}
    filas = historial.cambios(estado, actuales, sanas, generado[:10])
    ruta_csv = historial.escribir(carpeta, generado[:10], filas)
    SALUD.write_text(json.dumps(informe, ensure_ascii=False, indent=1), encoding="utf-8")

    datos = {
        "generado": generado,
        "tiendas": {k: dict({"nombre": v["nombre"], "color": v["color"],
                             "segunda": bool(v.get("segunda_opinion"))},
                            **({"relevado": relevado[k]} if relevado.get(k) else {}))
                    for k, v in fuentes.items()},
        "campos": ["nombre", "precio", "url", "tienda", "via", "lista", "antes", "imagen", "sellos", "modelo", "desde"],
        # desde cuando se siguen los precios: "sin cambios desde" no puede ir mas atras que esta fecha
        "historial": {"inicio": (serie.inicio(series) or date.min).isoformat() if series else ""},
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
