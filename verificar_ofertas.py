#!/usr/bin/env python3
"""Verifica que las publicaciones de las ofertas sigan en pie.

Uso:
    python verificar_ofertas.py candidatas.json --descartadas descartadas.json

Lee una lista {"ofertas": [{"url": ...}, ...]} (la escribe generar_feed.js) y suma a descartadas.json las
publicaciones caidas. El indice solo sabe del stock en el momento en que lo leyo, y los avisos de un agregador
(ComparaYa) no traen esa senal: una publicacion de Mercado Libre puede estar caida el mismo dia.

Cada enlace pasa por dos revisiones, y alcanza con que una lo marque caido:
  1. Estatica: el codigo HTTP (404/410), los carteles de la tienda en el HTML ("Este producto no esta
     disponible", "Publicacion pausada/finalizada") y el dato estructurado de disponibilidad (schema.org OutOfStock).
  2. Renderizada: la pagina abierta en un Chrome sin interfaz, que ejecuta el JavaScript, y lo que ve una persona.
     Mercado Libre arma su cartel de "no esta disponible" en el navegador: no esta en el HTML que baja la primera.

Mercado Libre se decide por su API oficial, con el token de aplicacion (secretos ML_CLIENT_ID y ML_CLIENT_SECRET):
a los servidores de GitHub su pagina les muestra un captcha, y ComparaYa trae precios viejos (19/10: la Zenbook a
$2.383.703 cuando el vendedor mas barato pedia $2.999.999). Un producto de catalogo (/p/MLA...) esta en pie si
alguien lo vende al precio publicado (con 2% de tolerancia); si nadie lo vende, o todos piden mas, se descarta.
Lo que la API no deja ver (/up/MLAU..., avisos sueltos) o no pudo responder tampoco se publica: una oferta de
Mercado Libre sale solo si se pudo comprobar.

Las tiendas WooCommerce se verifican por su Store API publica (precio y existencias), y las VTEX (las que se leen directo,
`"tipo": "vtex"` en tiendas.json, y las que llegan por ComparaYa: Carrefour, OnCity, Naldo, Dricco, Compra Cierta) por su
API publica de catalogo. Lo demas que llega por un agregador
(ComparaYa) desde otra tienda tiene que mostrar el precio publicado en la pagina de esa tienda (en el HTML o ya
armada en el navegador): si no aparece, o la tienda no se pudo abrir, no se publica (19/10: Fravega bloquea su API,
pero su pagina armada muestra el precio).

En las tiendas que se leen directo, ante la duda se publica: su precio se lee de su propio sitio el mismo dia, y un
bloqueo (403, 429), un error del servidor, una pagina de captcha o un fallo de red no prueban que este caida.

Con --telemetria RUTA anota el veredicto de cada enlace (comercio, juicio, motivo) para fiabilidad.py, que lo cuenta por
comercio y lo guarda en la rama `historial`.

Sale con 3 si encontro caidas nuevas (hay que volver a elegir ofertas) y con 0 si no; nunca falla la corrida.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import indexar

UA = "Mozilla/5.0 (compatible; LaPichincha-verificador/1.0; +https://pichinchadeldia.com.ar)"
TIMEOUT = 15
MAX_BYTES = 400_000     # alcanza para el cartel; una ficha de Mercado Libre pesa mas y no hace falta leerla entera
HILOS = 4
RENDER_TIMEOUT = 45     # segundos por pagina abierta en Chrome
RENDER_ESPERA_MS = 9000   # tiempo virtual que se le da a la pagina para armarse
PRESUPUESTO = 600       # segundos en total para los renderizados; pasado eso queda lo que dijo la revision estatica
NAVEGADORES = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome")

# Frases propias de una publicacion caida. Nada generico: "no esta disponible" a secas aparece en paginas que
# siguen vendiendo ("retiro en sucursal no esta disponible").
# Las vocales con tilde se aceptan de 1 a 3 caracteres: una pagina mal declarada llega como "estÃ¡" y sigue siendo el cartel.
CAIDA = re.compile(
    r"este producto (ya )?no est\S{1,3} disponible"
    r"|esta publicaci\S{1,3}n (ya )?no est\S{1,3} disponible"
    r"|publicaci\S{1,3}n (pausada|finalizada)"
    r"|schema\.org/(OutOfStock|SoldOut|Discontinued)", re.I)

# Paginas que nos frenan en vez de mostrar la publicacion: no dicen nada de ella.
MURO = re.compile(r"captcha|verific[aá] que (sos|eres) (un )?(humano|persona)|account-verification|"
                  r"access denied|attention required|are you a robot|suspicious-traffic|/gz/webdevice|"
                  r"hubo un error accediendo a esta p|request could not be satisfied|request blocked|just a moment\.\.\.", re.I)


API_ML = "https://api.mercadolibre.com"
TOLERANCIA_PRECIO = 0.02    # redondeos y diferencias de centavos entre lo que leyo el agregador y el vendedor
_TOKEN = {}
_TOKEN_CANDADO = threading.Lock()     # los hilos de la verificacion piden el token a la vez


def id_ml(url):
    """('items'|'products'|'user-products', 'MLA123...') del aviso de Mercado Libre, o None."""
    m = re.search(r"/up/(MLAU\d{6,})", url)
    if m:
        return "user-products", m.group(1)
    m = re.search(r"item_id[:=](MLA\d{6,})", url)
    if m:
        return "items", m.group(1)
    m = re.search(r"/p/(MLA\d{6,})", url)
    if m:
        return "products", m.group(1)
    m = re.search(r"\b(MLA)-?(\d{6,})", url)
    return ("items", m.group(1) + m.group(2)) if m else None


def token_ml():
    """Token de aplicacion de Mercado Libre (client_credentials) con los secretos ML_CLIENT_ID y ML_CLIENT_SECRET,
    o None si no estan. Se pide una vez por corrida."""
    with _TOKEN_CANDADO:
        if "valor" not in _TOKEN:
            _TOKEN["valor"] = _pedir_token()
        return _TOKEN["valor"]


def _pedir_token():
    cid, secreto = os.environ.get("ML_CLIENT_ID"), os.environ.get("ML_CLIENT_SECRET")
    if cid and secreto:
        datos = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": cid,
                                        "client_secret": secreto}).encode()
        pedido = urllib.request.Request(f"{API_ML}/oauth/token", data=datos, method="POST", headers={
            "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(pedido, timeout=TIMEOUT) as r:
                return json.loads(r.read().decode("utf-8")).get("access_token")
        except (urllib.error.URLError, OSError, ValueError) as e:
            print(f"::warning::No se obtuvo el token de Mercado Libre ({type(e).__name__})")
    return None


def pedir_api(url, cabeceras):
    """(codigo, texto) de la API sin levantar excepciones; codigo 0 si no hubo respuesta."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=cabeceras), timeout=TIMEOUT) as r:
            return r.status, r.read(MAX_BYTES).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read(4000).decode("utf-8", "replace")
        except OSError:
            return e.code, ""
    except (urllib.error.URLError, OSError, ValueError):
        return 0, ""


def pesos(n):
    return f"${n:,.0f}".replace(",", ".")


def revisar_ml(url, precio=None):
    """('caida'|'viva', motivo) segun la API de Mercado Libre, o None si no es de Mercado Libre o no hay token (sin
    token no se puede verificar y queda la revision de la pagina, como antes)."""
    if "mercadolibre." not in comercio(url) or not token_ml():
        return None
    ref = id_ml(url)
    if not ref or ref[0] != "products":
        return "caida", "api: no se puede verificar"
    codigo, cuerpo = pedir_api(f"{API_ML}/products/{ref[1]}/items?limit=100",
                               {"Accept": "application/json", "Authorization": "Bearer " + token_ml()})
    try:
        filas = json.loads(cuerpo).get("results") if codigo == 200 else None
    except (ValueError, AttributeError):
        filas = None
    if not isinstance(filas, list):
        return "caida", f"api: no se pudo verificar ({codigo})"
    precios = [f["price"] for f in filas if isinstance(f, dict) and isinstance(f.get("price"), (int, float))]
    if not precios:
        return "caida", "api: nadie lo vende"
    if precio and min(precios) > precio * (1 + TOLERANCIA_PRECIO):
        return "caida", f"api: el precio publicado ya no existe (el mas barato pide {pesos(min(precios))})"
    return "viva", "api"


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


def estatica(url):
    if not re.match(r"https?://", url or "", re.I):
        return "dudosa"
    try:
        estado, cuerpo = bajar(url)
    except urllib.error.HTTPError as e:
        return veredicto(e.code, "")
    except (urllib.error.URLError, OSError, ValueError):
        return "dudosa"
    juicio = veredicto(estado, cuerpo)
    # Una pagina de verificacion (captcha) responde 200 pero no es la publicacion: no prueba que este en pie.
    # Mercado Libre se la muestra a los servidores de GitHub en vez del aviso (diagnostico del 18/10).
    if juicio == "viva" and MURO.search(cuerpo[:20000]):
        return "dudosa"
    return juicio


def navegador():
    for nombre in NAVEGADORES:
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return os.environ.get("CHROME_BIN") or None


def renderizar(url, ua=UA):
    """El DOM de la pagina ya armada por el navegador (con su JavaScript), o None si no se pudo abrir.
    ua=None deja el que trae el navegador."""
    exe = navegador()
    if not exe or not re.match(r"https?://", url or "", re.I):
        return None
    cmd = [exe, "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--hide-scrollbars",
           f"--virtual-time-budget={RENDER_ESPERA_MS}", "--lang=es-AR", "--dump-dom", url]
    if ua:
        cmd.insert(-2, f"--user-agent={ua}")
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=RENDER_TIMEOUT, check=False)
    except (subprocess.TimeoutExpired, OSError):
        return None
    texto = r.stdout.decode("utf-8", "replace") if r.stdout else ""
    return texto or None


def revisar(url, desde=None, precio=None, tienda=None):
    """('caida'|'viva'|'dudosa', etapa que lo decidio). 'desde' es el reloj (time.time()) del inicio de la corrida;
    'precio', el que se va a publicar; 'tienda', la fuente del indice que lo trajo."""
    api = revisar_ml(url, precio)
    if api:
        return api
    if tienda and tienda in bases_woo():
        api = revisar_woo(url, precio, bases_woo()[tienda])
        if api:
            return api
    if tienda and tienda in tiendas_vtex():
        api = revisar_vtex(url, precio)
        if api:
            return api
    if tienda == "comparaya" and "mercadolibre." not in comercio(url):
        return revisar_vtex(url, precio) or revisar_agregador(url, precio)
    previo = estatica(url)
    if previo == "caida":
        return previo, "estatica"
    if desde is not None and time.time() - desde > PRESUPUESTO:
        return previo, "estatica"       # se acabo el tiempo para abrir navegadores: queda lo que se sabia
    dom = renderizar(url)
    if dom is None or MURO.search(dom[:20000]):
        return previo, "estatica"
    # El navegador solo puede sumar una caida. Que muestre una pagina sin cartel no prueba que sea la publicacion:
    # a los servidores de GitHub Mercado Libre les devuelve la misma pagina generica para todos los avisos.
    if veredicto(200, dom) == "caida":
        return "caida", "renderizada"
    return previo, "renderizada"


def precio_visible(texto, precio):
    """Si el precio aparece en el texto como lo escribe una tienda ("$1.833.999", "1.833.999,00") o en un dato
    ("price":1833999). Otro numero que lo contiene no cuenta."""
    if not precio or not texto:
        return False
    n = int(round(precio))
    miles = f"{n:,}".replace(",", ".")
    # Despues del numero puede venir un decimal en cero (".0", ",00": el mismo precio escrito como decimal, comun en un
    # JSON-LD); un decimal que no es cero (",50") o un grupo de tres cifras (".000") es otro numero.
    return bool(re.search(r"(?<![\d.])(?:" + re.escape(miles) + "|" + str(n) + r")(?!\d)(?![.,](?!0{1,2}(?!\d))\d)", texto))


TIENDAS_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tiendas.json")


def bases_woo():
    """{clave: base} de las tiendas que se leen por la Store API de WooCommerce (tiendas.json)."""
    tiendas = leer(TIENDAS_JSON, {})
    return {k: t.get("base") for k, t in tiendas.items() if isinstance(t, dict)
            and (t.get("catalogo") or {}).get("tipo") == "woocommerce" and t.get("base")}


def tiendas_vtex():
    """Las claves de las tiendas que se leen por la API de catalogo de VTEX (tiendas.json)."""
    return {k for k, t in leer(TIENDAS_JSON, {}).items() if isinstance(t, dict) and (t.get("catalogo") or {}).get("tipo") == "vtex"}


def revisar_woo(url, precio, base):
    """('caida'|'viva', motivo) segun la Store API publica de la tienda, o None si no respondio (queda la pagina)."""
    m = re.search(r"/producto/([^/?#]+)", url or "")
    if not m:
        return None
    codigo, cuerpo = pedir_api(f"{base}/wp-json/wc/store/v1/products?slug={m.group(1)}", {"Accept": "application/json"})
    try:
        filas = json.loads(cuerpo) if codigo == 200 else None
    except ValueError:
        filas = None
    if not isinstance(filas, list) or not filas or not isinstance(filas[0], dict):
        return None
    p = filas[0]
    if not p.get("is_in_stock"):
        return "caida", "api de la tienda: sin stock"
    try:
        actual = int((p.get("prices") or {}).get("price")) / 10 ** int((p.get("prices") or {}).get("currency_minor_unit", 0))
    except (TypeError, ValueError):
        return None
    if precio and actual > precio * (1 + TOLERANCIA_PRECIO):
        return "caida", f"api de la tienda: el precio publicado ya no existe (pide {pesos(actual)})"
    return "viva", "api de la tienda"


def revisar_vtex(url, precio):
    """('caida'|'viva', motivo) segun la API publica de catalogo de una tienda VTEX (Carrefour, OnCity, Naldo, Dricco...),
    o None si la URL no es de producto VTEX ("/slug/p") o la API no respondio. La misma que usa ratoneando.ar."""
    m = re.match(r"(https?://[^/]+)/([^/?#]+)/p/?(?:[?#].*)?$", url or "")
    if not m:
        return None
    codigo, cuerpo = pedir_api(f"{m.group(1)}/api/catalog_system/pub/products/search/{m.group(2)}/p",
                               {"Accept": "application/json"})
    try:
        productos = indexar.json_vtex(cuerpo) if codigo == 200 else None
    except ValueError:
        productos = None
    if not isinstance(productos, list) or not productos or not isinstance(productos[0], dict):
        return None
    # el mismo vendedor y la misma variante que publico el indice (indexar.oferta_vtex)
    elegida = indexar.oferta_vtex(productos[0])
    if not elegida:
        return "caida", "api de la tienda: sin stock"
    actual = elegida[0]
    if precio and actual > precio * (1 + TOLERANCIA_PRECIO):
        return "caida", f"api de la tienda: el precio publicado ya no existe (pide {pesos(actual)})"
    return "viva", "api de la tienda"


def revisar_agregador(url, precio):
    """Lo que llega por un agregador puede traer un precio viejo: tiene que verse en la pagina de la tienda."""
    html = ""
    try:
        _, html = bajar(url)
    except (urllib.error.URLError, OSError, ValueError):
        html = ""
    if html and CAIDA.search(html):
        return "caida", "estatica"
    if html and not MURO.search(html[:20000]) and precio_visible(html, precio):
        return "viva", "precio confirmado en la tienda"
    dom = renderizar(url)
    if dom and CAIDA.search(dom):
        return "caida", "renderizada"
    if not dom or MURO.search(dom[:20000]):
        return "caida", "agregador: no se pudo abrir la tienda"
    if precio_visible(dom, precio):
        return "viva", "precio confirmado en la tienda (renderizada)"
    vistos = list(dict.fromkeys(re.findall(r"\$\s?\d{1,3}(?:\.\d{3})+", dom)))[:4]
    return "caida", "agregador: el precio no aparece en la tienda" + (
        f" (muestra {', '.join(vistos)})" if vistos else f" (sin precios en {len(dom)} caracteres: «{titulo(dom)}»)")


def titulo(html):
    m = re.search(r"<title[^>]*>([^<]{0,80})", html or "", re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def leer(ruta, defecto):
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def comercio(url):
    return urllib.parse.urlparse(url).netloc.removeprefix("www.") or "?"


def resumen(urls, juicios, etapas):
    """Una linea por comercio: cuantas se revisaron y con que resultado. Para ver en el log si una tienda nos bloquea."""
    por = {}
    for u in urls:
        por.setdefault(comercio(u), Counter())[juicios[u]] += 1
    lineas = [f"  {host}: {c['viva']} en pie, {c['caida']} caída(s), {c['dudosa']} sin confirmar"
              for host, c in sorted(por.items())]
    renderizadas = sum(1 for u in urls if etapas[u] == "renderizada")
    lineas.append(f"  abiertas en navegador: {renderizadas} de {len(urls)}"
                  + ("" if navegador() else " (no hay Chrome: solo revisión estática)"))
    return "\n".join(lineas)


def guardar_telemetria(ruta, urls, juicios, etapas):
    """Suma a `ruta` el veredicto de cada enlace ({url: {comercio, juicio, motivo}}) para fiabilidad.py. Entre rondas y
    entre los dos pasos del workflow gana la ultima revision de cada enlace; un archivo previo roto se reemplaza.
    Es telemetria: si no se puede escribir, la corrida sigue."""
    previa = leer(ruta, {})
    datos = previa if isinstance(previa, dict) else {}
    for u in urls:
        datos[u] = {"comercio": comercio(u), "juicio": juicios[u], "motivo": etapas[u]}
    try:
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(datos, f)
    except OSError as e:
        print(f"::warning::No se guardo la telemetria ({type(e).__name__})")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ruta = argv[0] if argv and not argv[0].startswith("--") else "candidatas.json"
    destino = argv[argv.index("--descartadas") + 1] if "--descartadas" in argv else "descartadas.json"
    telemetria = argv[argv.index("--telemetria") + 1] if "--telemetria" in argv else None
    datos = leer(ruta, None)
    if not isinstance(datos, dict):
        print(f"No hay {ruta}: no hay nada que verificar")
        return 0
    ofertas = [o for o in datos.get("ofertas") or [] if isinstance(o, dict) and o.get("url")]
    urls = list(dict.fromkeys(o["url"] for o in ofertas))
    precios = {o["url"]: o.get("precio") for o in ofertas}
    fuentes = {o["url"]: o.get("tienda") for o in ofertas}
    previas = leer(destino, [])
    previas = previas if isinstance(previas, list) else []
    desde = time.time()
    if any("mercadolibre." in comercio(u) for u in urls):
        print("Mercado Libre: " + ("se verifica por su API" if token_ml() else "sin token, solo la revision de la pagina"))
    with ThreadPoolExecutor(max_workers=HILOS) as pool:
        resultados = list(pool.map(lambda u: revisar(u, desde, precio=precios.get(u), tienda=fuentes.get(u)), urls))
    juicios = {u: r[0] for u, r in zip(urls, resultados)}
    etapas = {u: r[1] for u, r in zip(urls, resultados)}
    caidas = [u for u in urls if juicios[u] == "caida"]
    dudosas = [u for u in urls if juicios[u] == "dudosa"]
    nuevas = [u for u in caidas if u not in previas]
    for u in caidas:
        print(f"  descartada ({etapas[u]}): {u}")
    print(f"Enlaces revisados: {len(urls)}, {len(caidas)} caída(s), {len(dudosas)} sin confirmar")
    if urls:
        print(resumen(urls, juicios, etapas))
    if urls and len(dudosas) == len(urls):
        print("::warning::No se pudo confirmar ningun enlace (bloqueo o sin red): se publican tal cual")
        print("no se pudo confirmar ningún enlace")
    if telemetria:
        guardar_telemetria(telemetria, urls, juicios, etapas)
    if not nuevas:
        return 0
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(previas + nuevas, f)
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
