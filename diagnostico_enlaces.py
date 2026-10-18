#!/usr/bin/env python3
"""Diagnostico de la verificacion de enlaces contra el caso real: que ve el servidor en cada publicacion.

Uso:
    python diagnostico_enlaces.py candidatas.json [--max 15] [--salida diagnostico.json]

No descarta nada: por cada enlace anota la respuesta del HTML (codigo, URL final, titulo, carteles, dato de
disponibilidad), lo que devuelve el navegador sin interfaz (con nuestra identificacion y con la que trae el
navegador: largo, titulo, si es un captcha, si aparece el cartel) y, para Mercado Libre, lo que responde su API
publica para ese aviso. Sirve para decidir con datos reales como verificar, en vez de suponer. Escribe el
resumen en el log (y en el resumen del paso si corre en GitHub Actions) y el detalle en un JSON.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request

import verificar_ofertas as v

API_ML = "https://api.mercadolibre.com"
DISPONIBILIDAD = re.compile(r'"availability"\s*:\s*"(?:https?://schema\.org/)?(\w+)"', re.I)


def titulo(html):
    m = re.search(r"<title[^>]*>([^<]{0,160})", html or "", re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def pedir(url, cabeceras=None):
    """(codigo, url final, texto) sin levantar excepciones; el codigo es 0 si no hubo respuesta."""
    pedido = urllib.request.Request(url, headers={"User-Agent": v.UA, "Accept-Language": "es-AR,es;q=0.9",
                                                  **(cabeceras or {})})
    try:
        with urllib.request.urlopen(pedido, timeout=v.TIMEOUT) as r:
            return r.status, r.geturl(), r.read(v.MAX_BYTES).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        try:
            cuerpo = e.read(4000).decode("utf-8", "replace")
        except OSError:
            cuerpo = ""
        return e.code, url, cuerpo
    except (urllib.error.URLError, OSError, ValueError) as e:
        return 0, url, type(e).__name__


def senales(html):
    disp = DISPONIBILIDAD.findall(html or "")
    return {"largo": len(html or ""), "titulo": titulo(html), "cartel": bool(v.CAIDA.search(html or "")),
            "muro": bool(v.MURO.search((html or "")[:20000])), "disponibilidad": sorted(set(disp))[:3]}


def id_ml(url):
    """('items'|'products', 'MLA123...') del aviso de Mercado Libre, o None."""
    m = re.search(r"item_id[:=](MLA\d{6,})", url)
    if m:
        return "items", m.group(1)
    m = re.search(r"/p/(MLA\d{6,})", url)
    if m:
        return "products", m.group(1)
    m = re.search(r"\b(MLA)-?(\d{6,})", url)
    return ("items", m.group(1) + m.group(2)) if m else None


def api_ml(url):
    ref = id_ml(url)
    if not ref:
        return {"id": None}
    tipo, ident = ref
    codigo, _, cuerpo = pedir(f"{API_ML}/{tipo}/{ident}", {"Accept": "application/json"})
    salida = {"id": ident, "tipo": tipo, "codigo": codigo}
    try:
        datos = json.loads(cuerpo)
    except ValueError:
        return {**salida, "cuerpo": cuerpo[:160]}
    if codigo != 200:
        return {**salida, "error": str(datos.get("message") or datos.get("error") or "")[:160]}
    if tipo == "items":
        return {**salida, "status": datos.get("status"), "disponibles": datos.get("available_quantity"),
                "sub_status": datos.get("sub_status")}
    ganador = datos.get("buy_box_winner")
    return {**salida, "status": datos.get("status"), "ganador": bool(ganador),
            "ganador_item": (ganador or {}).get("item_id")}


def diagnosticar(url):
    codigo, final, html = pedir(url)
    fila = {"url": url, "comercio": v.comercio(url), "html": {"codigo": codigo, "final": final[:200], **senales(html)}}
    for nombre, ua in (("render_nuestro", v.UA), ("render_navegador", None)):
        dom = v.renderizar(url, ua=ua)
        fila[nombre] = None if dom is None else senales(dom)
    if "mercadolibre" in fila["comercio"]:
        fila["api"] = api_ml(url)
    fila["veredicto"] = v.revisar(url)
    return fila


def linea(f):
    h, rn, rv = f["html"], f["render_nuestro"], f["render_navegador"]
    corto = lambda r: "no abrió" if r is None else ("captcha/muro" if r["muro"] else
                                                    ("CARTEL" if r["cartel"] else f"ok {r['largo']}b"))
    api = f.get("api")
    api_txt = "" if not api else (f" | api {api.get('codigo')} {api.get('status', '')} "
                                  f"{api.get('disponibles', api.get('ganador', ''))} {api.get('error', '')}".rstrip())
    return (f"- {f['comercio']}: html {h['codigo']} {'CARTEL' if h['cartel'] else ''}{' muro' if h['muro'] else ''}"
            f" disp={h['disponibilidad']} «{h['titulo'][:60]}» | render nuestro: {corto(rn)} | render navegador: "
            f"{corto(rv)}{api_txt} | veredicto: {f['veredicto'][0]} ({f['veredicto'][1]})\n  {f['url'][:140]}")


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ruta = argv[0] if argv else "candidatas.json"
    maximo = int(argv[argv.index("--max") + 1]) if "--max" in argv else 15
    salida = argv[argv.index("--salida") + 1] if "--salida" in argv else "diagnostico.json"
    datos = v.leer(ruta, {}) or {}
    urls = [o["url"] for o in datos.get("ofertas") or [] if isinstance(o, dict) and o.get("url")]
    # Primero Mercado Libre (es lo que interesa), despues el resto, hasta --max.
    urls = sorted(dict.fromkeys(urls), key=lambda u: "mercadolibre" not in u)[:maximo]
    filas = [diagnosticar(u) for u in urls]
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(filas, f, ensure_ascii=False, indent=1)
    texto = "### Diagnóstico de enlaces (caso real)\n\n" + "\n".join(linea(f) for f in filas) + "\n"
    print(texto)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
