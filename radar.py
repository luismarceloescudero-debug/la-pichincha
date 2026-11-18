#!/usr/bin/env python3
"""Radar de cobertura semanal: que productos de nuestras tiendas faltan en el indice y que tiendas nuevas aparecen.

Uso:
    python radar.py --indice indice.json --salida radar [--consultas consultas.json] [--tope-creditos 60]

NO es una fuente de precios: no escribe en el indice, no publica nada y el precio del texto de un buscador no se usa
(no es confiable: la prueba del 17/11 trajo listados viejos de Cybermonday). Solo deja un informe para el dueno:

- huecos: fichas de producto de tiendas que YA relevamos y que no estan en el indice publicado, por tienda;
- candidatas: dominios que no relevamos con fichas de producto, sin redes, medios, comparadores ni listados.

Tavily (TAVILY_API_KEY) busca; cada busqueda basica cuesta 1 credito y se corta al llegar a --tope-creditos.
Firecrawl (FIRECRAWL_API_KEY, opcional) confirma que la primera ficha de cada candidata trae JSON-LD Product: solo con
proxy "basic", solo si robots.txt lo permite y nunca sobre una tienda que bloquea robots (si responde con un desafio
o un 403, queda anotada como bloqueada y no se insiste). Sin clave, ese paso se saltea.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

from indexar import robots_permite

TAVILY_URL = "https://api.tavily.com/search"
FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape"
TOPE_CREDITOS = 60
MAX_CONSULTAS = 40
MAX_FIRECRAWL = 10
ESPERA_FIRECRAWL = 7  # segundos: el plan gratis deja 10 scrapes por minuto
UA = "la-pichincha-radar/1.0"
AGENTE_FIRECRAWL = "FirecrawlAgent"  # el User-agent con el que Firecrawl pide la pagina: robots.txt puede nombrarlo

# Terminos que consultas.json no tiene y que el indice si vende (celulares, la prueba del 17/11 los encontro).
EXTRA = ["celular samsung galaxy", "iphone", "motorola moto g", "notebook ryzen 7", "pc armada"]

# Dominios que nunca son una tienda: redes, video, medios, foros, comparadores, fabricantes que solo informan.
NO_TIENDAS = (
    "youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com", "reddit.com",
    "linkedin.com", "pinterest.com", "wikipedia.org", "tavily.com", "clarin.com", "infobae.com", "lanacion.com.ar",
    "pagina12.com.ar", "tn.com.ar", "ambito.com", "cronista.com", "iprofesional.com", "xataka.com", "xataka.com.ar",
    "soloprecio.com.ar", "exxit.com.ar", "solotodo.com", "preciosya.com.ar", "comparaya.com.ar", "google.com",
    "news.samsung.com", "soundcore.com",
)

# Listados, categorias, marcas, etiquetas, buscadores internos y filtros: no son una ficha de un producto.
LISTADO = re.compile(
    r"/(categoria|categorias|category|categories|categoria-producto|product-category|tag|tags|marca|marcas|brand|"
    r"listado|l|e|plp|buscar|busqueda|search|collections|coleccion|prods|lanzamiento[^/]*|ofertas?|cybermonday)(/|$)"
    r"|--prod--|/productos-rubro/[^/]+/?$|/productos/?$|/Productos/|/blog/|/mejores-[^/]*$|/guia[^/]*$",
    re.I,
)
# /productos/<slug> es la ficha de Tiendanube, pero /Productos/ con mayuscula es el listado de Maximus.
FICHA_TIENDANUBE = re.compile(r"/productos/[^/]+")
FICHA = re.compile(
    r"/(producto|product|prod|item|pdp|ProductDetail|articulo)/[^/]+"
    r"|/p/?$|/p/[^/]+|-det--|ITEM=\d+|-\d{4,}\.html?$|/\d{4,}-[^/]+$|/MLA-?\d+",
    re.I,
)


def dominio(url):
    try:
        host = urllib.parse.urlsplit(url).hostname or ""
    except ValueError:
        return ""
    return host.lower().removeprefix("www.")


def normalizar(url):
    """Host sin www + ruta, sin barra final ni query, en minusculas: la misma URL con otro filtro es la misma ficha."""
    p = urllib.parse.urlsplit(url)
    return (dominio(url) + p.path).rstrip("/").lower()


def _es_de(d, lista):
    return any(d == x or d.endswith("." + x) for x in lista)


def clasificar(url, titulo=""):
    """'no-tienda', 'listado' o 'ficha' para un resultado del buscador."""
    d = dominio(url)
    if not d or _es_de(d, NO_TIENDAS):
        return "no-tienda"
    if d.startswith("listado.") or "mercadolibre" in titulo.lower():
        return "listado"
    p = urllib.parse.urlsplit(url)
    ruta = p.path + ("?" + p.query if p.query else "")
    ficha = FICHA.search(p.path) or FICHA_TIENDANUBE.search(p.path)
    if LISTADO.search(ruta) and not ficha:
        return "listado"
    if ficha or FICHA.search(ruta):
        return "ficha"
    # Sin marca clara: una ruta larga con un numero en el ultimo tramo suele ser una ficha (tiendas sin /producto/).
    ultimo = p.path.rstrip("/").rsplit("/", 1)[-1]
    if ultimo.count("-") >= 4 and re.search(r"\d", ultimo):
        return "ficha"
    return "listado"


def conocidas(indice, tiendas=None):
    """URLs normalizadas del indice y {dominio: fuente}. La fuente es la columna 3 del indice (comparaya para lo que
    llega por el agregador); tiendas.json suma las que hoy no tienen filas (por ejemplo una bloqueada)."""
    urls, doms = set(), {}
    for f in indice.get("productos", []):
        if len(f) >= 4 and isinstance(f[2], str) and f[2].startswith("http"):
            urls.add(normalizar(f[2]))
            d = dominio(f[2])
            if doms.get(d) in (None, "comparaya"):  # la fuente directa gana a la del agregador
                doms[d] = f[3]
    for clave, t in (tiendas or {}).items():
        if isinstance(t, dict) and t.get("base"):
            doms.setdefault(dominio(t["base"]), clave)
    doms.pop("", None)
    return urls, doms


def elegir_consultas(consultas, semana, maximo=MAX_CONSULTAS):
    """Hasta `maximo` terminos, rotando por semana para cubrir toda la lista en pocas corridas."""
    terminos = list(dict.fromkeys([c["q"] if isinstance(c, dict) else c for c in consultas] + EXTRA))
    if len(terminos) <= maximo:
        return terminos
    inicio = (semana * maximo) % len(terminos)
    return (terminos + terminos)[inicio:inicio + maximo]


def tienda_de(d, doms):
    """El dominio conocido que cubre a `d` (el mismo o su padre: listado.mercadolibre.com.ar) o None."""
    if d in doms:
        return d
    return next((k for k in doms if d.endswith("." + k)), None)


def comparar(resultados, urls, doms):
    """Arma huecos por tienda y candidatas por dominio con los resultados crudos [{q, url, title}]."""
    huecos, candidatas, vistos = defaultdict(dict), defaultdict(lambda: {"fichas": {}, "apariciones": 0}), set()
    cuenta = defaultdict(int)
    for r in resultados:
        url, titulo = r.get("url", ""), r.get("title", "")
        n = normalizar(url)
        if n in vistos:
            continue
        vistos.add(n)
        tipo = clasificar(url, titulo)
        d = dominio(url)
        tienda = tienda_de(d, doms)
        if n in urls:
            cuenta["en_indice"] += 1
        elif tipo == "no-tienda":
            cuenta["no_tienda"] += 1
        elif tienda:
            if tipo == "ficha":
                cuenta["huecos"] += 1
                huecos[(tienda, doms[tienda])][n] = {"url": url, "titulo": titulo, "consulta": r.get("q", "")}
            else:
                cuenta["listado_conocida"] += 1
        else:
            c = candidatas[d]
            c["apariciones"] += 1
            if tipo == "ficha":
                cuenta["ficha_nueva"] += 1
                c["fichas"].setdefault(n, {"url": url, "titulo": titulo, "consulta": r.get("q", "")})
            else:
                cuenta["listado_nueva"] += 1
    lista_huecos = sorted(
        ({"tienda": t, "fuente": f, "faltan": len(v), "ejemplos": list(v.values())[:5]} for (t, f), v in huecos.items()),
        key=lambda x: (-x["faltan"], x["tienda"]))
    # Una candidata necesita al menos una ficha: un dominio que solo aparece con listados no dice que venda.
    lista_cand = sorted(
        ({"dominio": d, "fichas": len(c["fichas"]), "apariciones": c["apariciones"],
          "ejemplos": list(c["fichas"].values())[:3]} for d, c in candidatas.items() if c["fichas"]),
        key=lambda x: (-x["fichas"], -x["apariciones"], x["dominio"]))
    return {"conteo": dict(cuenta), "huecos": lista_huecos, "candidatas": lista_cand}


def _post(url, cuerpo, clave, timeout=60):
    req = urllib.request.Request(url, data=json.dumps(cuerpo).encode(), method="POST", headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {clave}", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def _get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def buscar(terminos, clave, tope=TOPE_CREDITOS, post=_post):
    """Busca cada termino en Tavily (basica, Argentina, 10 resultados) hasta gastar `tope` creditos."""
    resultados, creditos, hechas, errores = [], 0, 0, []
    for q in terminos:
        if creditos >= tope:
            break
        try:
            j = post(TAVILY_URL, {"query": f"{q} precio Argentina", "search_depth": "basic", "max_results": 10,
                                  "country": "argentina", "include_usage": True}, clave)
        except urllib.error.HTTPError as e:
            errores.append(f"{q}: HTTP {e.code}")
            if e.code in (401, 403, 429, 432, 433):  # clave mala, sin creditos o tope del plan: no se insiste
                break
            continue
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            errores.append(f"{q}: {e}")
            continue
        hechas += 1
        creditos += (j.get("usage") or {}).get("credits", 1)
        resultados += [{"q": q, "url": it.get("url", ""), "title": it.get("title", "")} for it in j.get("results", [])]
    return {"resultados": resultados, "creditos": creditos, "consultas": hechas, "errores": errores}


def tiene_product(html):
    """Si el HTML trae un bloque JSON-LD con un @type Product (tambien dentro de @graph o de una lista)."""
    for bloque in re.findall(r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", html or "", re.S | re.I):
        try:
            datos = json.loads(bloque.strip())
        except ValueError:
            continue
        pila = [datos]
        while pila:
            x = pila.pop()
            if isinstance(x, list):
                pila += x
            elif isinstance(x, dict):
                t = x.get("@type")
                if t == "Product" or (isinstance(t, list) and "Product" in t):
                    return True
                pila += [v for v in x.values() if isinstance(v, (list, dict))]
    return False


def confirmar(candidatas, clave, maximo=MAX_FIRECRAWL, post=_post, get=_get, dormir=time.sleep):
    """Con Firecrawl (proxy basic) mira la primera ficha de cada candidata. Devuelve los creditos usados.
    Respeta robots.txt; un 403, 429 o un desafio anti robots deja la candidata como 'bloqueada' y no se insiste."""
    usados = 0
    for c in candidatas:
        if usados >= maximo or not c["ejemplos"]:
            break
        url = c["ejemplos"][0]["url"]
        p = urllib.parse.urlsplit(url)
        try:
            robots = get(f"{p.scheme}://{p.netloc}/robots.txt")
        except urllib.error.HTTPError as e:
            robots = "" if e.code == 404 else None
        except (urllib.error.URLError, TimeoutError, ValueError):
            robots = None
        if robots is None:
            c["firecrawl"] = "sin-robots"
            continue
        if not robots_permite(robots, p.path or "/", agente=AGENTE_FIRECRAWL):
            c["firecrawl"] = "robots-prohibe"
            continue
        if usados:
            dormir(ESPERA_FIRECRAWL)
        try:
            j = post(FIRECRAWL_URL, {"url": url, "formats": ["rawHtml"], "proxy": "basic", "onlyMainContent": False,
                                     "timeout": 30000}, clave, timeout=60)
        except urllib.error.HTTPError as e:
            usados += 1
            c["firecrawl"] = "bloqueada" if e.code in (403, 429) else f"error-{e.code}"
            continue
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            usados += 1  # conservador: Firecrawl pudo haber hecho (y cobrado) el scrape aunque la respuesta no llego
            c["firecrawl"] = f"error-red: {e}"
            continue
        datos = j.get("data") or {}
        meta = datos.get("metadata") or {}
        usados += meta.get("creditsUsed", 1)  # lo que informa Firecrawl; 1 por pagina con proxy basic
        estado = meta.get("statusCode", 200)
        html = datos.get("rawHtml") or ""
        if estado in (403, 429, 503) or "cf-chl" in html or "challenge-platform" in html:
            c["firecrawl"] = "bloqueada"
        else:
            c["firecrawl"] = "ficha-confirmada" if tiene_product(html) else "sin-json-ld"
    return usados


def informe_md(r):
    c = r["conteo"]
    lineas = [
        f"# Radar de cobertura ({r['fecha']})", "",
        f"Indice: {r['indice']}. Tavily: {r['consultas']} consultas, **{r['creditos']} creditos** "
        f"(tope {r['tope']}). Firecrawl: {r['firecrawl']}.", "",
        "No es una fuente de precios: el precio del texto del buscador no se usa.", "",
        f"Resultados unicos: {sum(c.values())} | ya en el indice {c.get('en_indice', 0)} | "
        f"huecos {c.get('huecos', 0)} | fichas de tiendas nuevas {c.get('ficha_nueva', 0)} | "
        f"listados {c.get('listado_conocida', 0) + c.get('listado_nueva', 0)} | no tiendas {c.get('no_tienda', 0)}", "",
        "## Huecos por tienda (fichas que el indice no tiene)", "",
    ]
    if not r["huecos"]:
        lineas.append("Ninguno.")
    for h in r["huecos"][:15]:
        lineas.append(f"- **{h['tienda']}** (fuente {h['fuente']}): {h['faltan']}")
        lineas += [f"  - [{e['titulo'][:80] or e['url']}]({e['url']}) ({e['consulta']})" for e in h["ejemplos"][:3]]
    lineas += ["", "## Tiendas candidatas", ""]
    if not r["candidatas"]:
        lineas.append("Ninguna.")
    for k in r["candidatas"][:15]:
        extra = f", firecrawl: {k['firecrawl']}" if k.get("firecrawl") else ""
        lineas.append(f"- **{k['dominio']}**: {k['fichas']} fichas, {k['apariciones']} apariciones{extra}")
        lineas += [f"  - [{e['titulo'][:80] or e['url']}]({e['url']})" for e in k["ejemplos"][:2]]
    if r["errores"]:
        lineas += ["", "## Errores", ""] + [f"- {e}" for e in r["errores"]]
    return "\n".join(lineas) + "\n"


def correr(indice, consultas, tiendas, clave_tavily, clave_firecrawl=None, tope=TOPE_CREDITOS, hoy=None,
           post=_post, get=_get, dormir=time.sleep, tope_firecrawl=MAX_FIRECRAWL):
    hoy = hoy or date.today()
    # Los topes tienen techo: ni un input del workflow ni un argumento gastan mas que el plan gratis por corrida.
    tope = max(0, min(tope, TOPE_CREDITOS))
    tope_firecrawl = max(0, min(tope_firecrawl, MAX_FIRECRAWL))
    urls, doms = conocidas(indice, tiendas)
    terminos = elegir_consultas(consultas, hoy.isocalendar()[1])
    b = buscar(terminos, clave_tavily, tope, post)
    r = comparar(b["resultados"], urls, doms)
    if clave_firecrawl:
        usados = confirmar(r["candidatas"], clave_firecrawl, tope_firecrawl, post=post, get=get, dormir=dormir)
        fc = f"{usados} creditos (tope {tope_firecrawl})"
    else:
        fc = "sin clave, salteado"
    r.update(fecha=hoy.isoformat(), indice=indice.get("generado", "?"), creditos=b["creditos"], tope=tope,
             consultas=b["consultas"], errores=b["errores"], firecrawl=fc)
    return r


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--indice", required=True)
    ap.add_argument("--consultas", default="consultas.json")
    ap.add_argument("--tiendas", default="tiendas.json")
    ap.add_argument("--salida", default="radar")
    ap.add_argument("--tope-creditos", type=int, default=TOPE_CREDITOS, help="creditos de Tavily por corrida")
    ap.add_argument("--tope-firecrawl", type=int, default=MAX_FIRECRAWL, help="creditos de Firecrawl por corrida")
    a = ap.parse_args(argv)
    clave = os.environ.get("TAVILY_API_KEY")
    if not clave:
        print("Falta TAVILY_API_KEY: no se corre el radar.", file=sys.stderr)
        return 1
    leer = lambda ruta: json.loads(Path(ruta).read_text(encoding="utf-8"))
    tiendas = leer(a.tiendas) if Path(a.tiendas).exists() else {}
    r = correr(leer(a.indice), leer(a.consultas), tiendas, clave, os.environ.get("FIRECRAWL_API_KEY") or None,
               a.tope_creditos, tope_firecrawl=a.tope_firecrawl)
    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    (salida / "radar.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    (salida / "radar.md").write_text(informe_md(r), encoding="utf-8")
    print(f"Radar: {r['consultas']} consultas, {r['creditos']} creditos de Tavily, {len(r['huecos'])} tiendas con "
          f"huecos, {len(r['candidatas'])} candidatas. Firecrawl: {r['firecrawl']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
