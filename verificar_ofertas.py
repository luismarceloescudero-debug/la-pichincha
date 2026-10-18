#!/usr/bin/env python3
"""Verifica que las publicaciones de las "Pichinchas del dia" sigan en pie antes de publicarlas.

Uso:
    python verificar_ofertas.py _sitio/ofertas.json --descartadas descartadas.json

Abre el enlace de cada oferta de ofertas.json (lo escribe generar_feed.js) y suma a descartadas.json
las que estan caidas: un 404 o un 410, o el cartel de la tienda ("Este producto no esta disponible",
"Publicacion pausada", "Publicacion finalizada"). Despues generar_feed.js se vuelve a correr con
--descartadas y entra la siguiente candidata. El indice solo sabe del stock en el momento en que lo
leyo; los avisos de un agregador (ComparaYa) no traen esa senal y pueden caerse en el medio.

Ante la duda se publica: un bloqueo (403, 429), un error del servidor o un fallo de red no prueban que
la publicacion este caida, y descartar por eso vaciaria el resumen cada vez que una tienda nos frena.

Sale con 3 si encontro caidas nuevas (hay que volver a armar el feed) y con 0 si no; nunca falla la corrida.
"""

import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = "Mozilla/5.0 (compatible; LaPichincha-verificador/1.0; +https://pichinchadeldia.com.ar)"
TIMEOUT = 15
MAX_BYTES = 400_000     # alcanza para el cartel; una ficha de Mercado Libre pesa mas y no hace falta leerla entera
HILOS = 5

# Frases propias de una publicacion caida. Nada generico: "no esta disponible" a secas aparece en paginas que
# siguen vendiendo ("retiro en sucursal no esta disponible").
CAIDA = re.compile(
    r"este producto (ya )?no est[aá] disponible"
    r"|publicaci[oó]n (pausada|finalizada)"
    r"|esta publicaci[oó]n (ya )?no est[aá] disponible", re.I)


def veredicto(estado, cuerpo):
    """'caida', 'viva' o 'dudosa' a partir del codigo HTTP y el texto de la pagina."""
    if estado in (404, 410):
        return "caida"
    if estado != 200:
        return "dudosa"                 # bloqueo, limite de pedidos o error del servidor: no prueba nada
    return "caida" if CAIDA.search(cuerpo or "") else "viva"


def bajar(url):
    """(codigo, texto) de la pagina; los errores HTTP salen como urllib.error.HTTPError."""
    pedido = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,*/*", "Accept-Language": "es-AR,es;q=0.9"})
    with urllib.request.urlopen(pedido, timeout=TIMEOUT) as r:
        return r.status, r.read(MAX_BYTES).decode("utf-8", "replace")


def revisar(url):
    if not re.match(r"https?://", url or "", re.I):
        return "dudosa"
    try:
        estado, cuerpo = bajar(url)
    except urllib.error.HTTPError as e:
        return veredicto(e.code, "")
    except (urllib.error.URLError, OSError, ValueError):
        return "dudosa"
    return veredicto(estado, cuerpo)


def leer(ruta, defecto):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ruta = argv[0] if argv and not argv[0].startswith("--") else "_sitio/ofertas.json"
    destino = argv[argv.index("--descartadas") + 1] if "--descartadas" in argv else "descartadas.json"
    datos = leer(ruta, None)
    if not isinstance(datos, dict):
        print(f"No hay {ruta}: no hay nada que verificar")
        return 0
    urls = [o["url"] for o in datos.get("ofertas") or [] if isinstance(o, dict) and o.get("url")]
    previas = leer(destino, [])
    previas = previas if isinstance(previas, list) else []
    with ThreadPoolExecutor(max_workers=HILOS) as pool:
        juicios = dict(zip(urls, pool.map(revisar, urls)))
    caidas = [u for u in urls if juicios[u] == "caida"]
    dudosas = [u for u in urls if juicios[u] == "dudosa"]
    nuevas = [u for u in caidas if u not in previas]
    for u in caidas:
        print(f"  caída: {u}")
    print(f"Enlaces de las ofertas: {len(urls)} revisados, {len(caidas)} caída(s), {len(dudosas)} sin confirmar")
    if urls and len(dudosas) == len(urls):
        print("::warning::No se pudo confirmar ningun enlace (bloqueo o sin red): se publican tal cual")
        print("no se pudo confirmar ningún enlace")
    if not nuevas:
        return 0
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(previas + nuevas, f)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
