"""Mercado Libre como fuente directa del indice, por su API oficial (spec 026).

Con el token de aplicacion (client_credentials, secretos ML_CLIENT_ID y ML_CLIENT_SECRET) la busqueda general
(/sites/MLA/search) responde 403 desde 2025; el catalogo si responde (medido el 23/10):
  - /products/search?site_id=MLA&domain_id=...&q=...  productos de catalogo de un rubro, hasta 100 por pedido;
  - /products/{id}/items                               quien lo vende, a que precio y con que precio anterior.
Cada producto entra una vez, con el vendedor mas barato que lo vende nuevo, en pesos y desde Argentina: es el mismo
criterio con el que verificar_ofertas.py decide si una oferta de Mercado Libre sigue en pie. El precio anterior es el
`original_price` de ese vendedor, nunca uno inventado. Un bloqueo (403, 429) corta la fuente sin insistir: indexar.py
reusa lo de la corrida anterior.
"""

import json
import os
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import modelo

API = "https://api.mercadolibre.com"
SITIO = "https://www.mercadolibre.com.ar"
POR_PEDIDO = 100      # lo maximo que acepta /products/search por pedido
POR_RUBRO = 300       # productos por rubro: los primeros de la busqueda del catalogo (de cada 100, 5 a 30 tienen vendedor)
HILOS = 4             # pedidos de vendedores en paralelo
TIMEOUT = 30
BLOQUEOS = (403, 429)
UA = "Mozilla/5.0 (compatible; LaPichincha-indexador/1.0; +https://pichinchadeldia.com.ar)"


def token(entorno=None, abrir=None):
    """Token de aplicacion de Mercado Libre. Sin los secretos no hay fuente: se avisa con una excepcion."""
    entorno = os.environ if entorno is None else entorno
    abrir = abrir or urllib.request.urlopen
    cid, secreto = entorno.get("ML_CLIENT_ID"), entorno.get("ML_CLIENT_SECRET")
    if not cid or not secreto:
        raise RuntimeError("faltan ML_CLIENT_ID y ML_CLIENT_SECRET")
    datos = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": cid,
                                    "client_secret": secreto}).encode()
    pedido = urllib.request.Request(f"{API}/oauth/token", data=datos, method="POST", headers={
        "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"})
    with abrir(pedido, timeout=TIMEOUT) as r:
        valor = json.loads(r.read().decode("utf-8")).get("access_token")
    if not valor:
        raise RuntimeError("Mercado Libre no dio un token")
    return valor


def pedidor(clave, abrir=None):
    """Una funcion que pide una ruta de la API con el token y devuelve el JSON. Un bloqueo corta la fuente."""
    abrir = abrir or urllib.request.urlopen

    def pedir(ruta):
        pedido = urllib.request.Request(API + ruta, headers={"Authorization": f"Bearer {clave}",
                                                             "Accept": "application/json", "User-Agent": UA})
        try:
            with abrir(pedido, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in BLOQUEOS:
                raise RuntimeError(f"Mercado Libre respondio {e.code}: no se insiste hoy") from e
            raise
    return pedir


def slug(nombre):
    """La parte legible de la direccion, como la escribe Mercado Libre: sin tildes ni signos, palabras con guiones."""
    s = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", "-", re.sub(r"[^a-z0-9\s-]", "", s)).strip("-") or "producto"


def atributo(producto, clave):
    for a in producto.get("attributes") or []:
        if isinstance(a, dict) and a.get("id") == clave and isinstance(a.get("value_name"), str):
            return a["value_name"]
    return None


def mejor_vendedor(vendedores):
    """(precio, precio anterior o None) del vendedor mas barato que lo vende nuevo, en pesos y desde Argentina."""
    validos = [v for v in vendedores if isinstance(v, dict) and v.get("condition") == "new"
               and v.get("currency_id") == "ARS" and v.get("international_delivery_mode", "none") == "none"
               and isinstance(v.get("price"), (int, float)) and v["price"] > 0]
    if not validos:
        return None
    v = min(validos, key=lambda x: x["price"])
    precio = round(v["price"])
    antes = v.get("original_price")
    return precio, (round(antes) if isinstance(antes, (int, float)) and round(antes) > precio else None)


def aviso(producto, vendedores):
    """Un producto del catalogo como aviso del indice, o None si nadie lo vende nuevo en pesos."""
    oferta = mejor_vendedor(vendedores)
    pid, nombre = producto.get("id"), producto.get("name")
    if not oferta or not isinstance(pid, str) or not re.fullmatch(r"MLA\d+", pid) or not isinstance(nombre, str):
        return None
    fotos = [f.get("url") for f in producto.get("pictures") or [] if isinstance(f, dict) and isinstance(f.get("url"), str)]
    codigo = atributo(producto, "PART_NUMBER") or atributo(producto, "ALPHANUMERIC_MODEL")
    precio, antes = oferta
    return {"nombre": nombre, "marca": atributo(producto, "BRAND"), "precio": precio, "lista": antes,
            "url": f"{SITIO}/{slug(nombre)}/p/{pid}", "imagen": fotos[0] if fotos else "", "sellos": "",
            "sku": modelo.modelo_de_api(codigo)}


def vendedores(pedir, pid):
    """Quien vende un producto. Un producto que no responde queda afuera; un bloqueo (RuntimeError) corta la fuente."""
    try:
        return (pedir(f"/products/{pid}/items?limit=100") or {}).get("results") or []
    except (urllib.error.URLError, OSError, ValueError):
        return []


def productos(pedir, rubro, tope):
    """Los primeros `tope` productos activos de un rubro: un termino y el dominio de Mercado Libre que le corresponde."""
    vistos, lista = set(), []
    for desde in range(0, tope, POR_PEDIDO):
        q = urllib.parse.urlencode({"status": "active", "site_id": "MLA", "domain_id": rubro["dominio"],
                                    "q": rubro["q"], "limit": min(POR_PEDIDO, tope - desde), "offset": desde})
        try:
            filas = (pedir("/products/search?" + q) or {}).get("results") or []
        except urllib.error.HTTPError as e:
            if e.code != 400:
                raise
            break       # la API no deja paginar mas hondo: queda lo que se leyo
        for p in filas:
            if isinstance(p, dict) and p.get("domain_id") == rubro["dominio"] and p.get("id") not in vistos:
                vistos.add(p.get("id"))
                lista.append(p)
        if len(filas) < POR_PEDIDO:
            break
    return lista


def indexar(tienda, max_paginas, pedir=None, hilos=HILOS):
    """Todos los rubros de tiendas.json (`catalogo.rubros`). `pedir` reemplaza a la API (los tests la simulan).
    --max-paginas achica el recorrido para probar: 50 productos por pagina."""
    cfg = tienda["catalogo"]
    pedir = pedir or pedidor(token())
    tope = min(cfg.get("por_rubro", POR_RUBRO), max(1, max_paginas) * 50)
    items, vistos = [], set()
    for rubro in cfg["rubros"]:
        lista = [p for p in productos(pedir, rubro, tope) if p.get("id") not in vistos]
        vistos.update(p.get("id") for p in lista)
        with ThreadPoolExecutor(max_workers=hilos) as pool:
            ventas = list(pool.map(lambda p: vendedores(pedir, p["id"]), lista))
        nuevos = [a for a in (aviso(p, v) for p, v in zip(lista, ventas)) if a]
        items.extend(nuevos)
        print(f"    {rubro['q']}: {len(nuevos)} de {len(lista)} productos con vendedor")
    return items
