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

Ante la duda se publica: un bloqueo (403, 429), un error del servidor, una pagina de captcha o un fallo de red no
prueban que la publicacion este caida, y descartar por eso vaciaria el resumen cada vez que una tienda nos frena.

Sale con 3 si encontro caidas nuevas (hay que volver a elegir ofertas) y con 0 si no; nunca falla la corrida.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

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
                  r"hubo un error accediendo a esta p", re.I)


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


def revisar(url, desde=None):
    """('caida'|'viva'|'dudosa', etapa que lo decidio). 'desde' es el reloj (time.time()) del inicio de la corrida."""
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


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ruta = argv[0] if argv and not argv[0].startswith("--") else "candidatas.json"
    destino = argv[argv.index("--descartadas") + 1] if "--descartadas" in argv else "descartadas.json"
    datos = leer(ruta, None)
    if not isinstance(datos, dict):
        print(f"No hay {ruta}: no hay nada que verificar")
        return 0
    urls = list(dict.fromkeys(o["url"] for o in datos.get("ofertas") or [] if isinstance(o, dict) and o.get("url")))
    previas = leer(destino, [])
    previas = previas if isinstance(previas, list) else []
    desde = time.time()
    with ThreadPoolExecutor(max_workers=HILOS) as pool:
        resultados = list(pool.map(lambda u: revisar(u, desde), urls))
    juicios = {u: r[0] for u, r in zip(urls, resultados)}
    etapas = {u: r[1] for u, r in zip(urls, resultados)}
    caidas = [u for u in urls if juicios[u] == "caida"]
    dudosas = [u for u in urls if juicios[u] == "dudosa"]
    nuevas = [u for u in caidas if u not in previas]
    for u in caidas:
        print(f"  caída ({etapas[u]}): {u}")
    print(f"Enlaces revisados: {len(urls)}, {len(caidas)} caída(s), {len(dudosas)} sin confirmar")
    if urls:
        print(resumen(urls, juicios, etapas))
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
