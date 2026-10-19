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
import urllib.parse
import urllib.request

import verificar_ofertas as v

API_ML = v.API_ML
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


def texto_visible(html):
    sin = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html or "", flags=re.S | re.I)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", sin)).strip()


def senales(html):
    disp = DISPONIBILIDAD.findall(html or "")
    return {"largo": len(html or ""), "titulo": titulo(html), "cartel": bool(v.CAIDA.search(html or "")),
            "muro": bool(v.MURO.search((html or "")[:20000])), "disponibilidad": sorted(set(disp))[:3],
            "texto": texto_visible(html)[:160], "scripts": re.findall(r'src="(https?://[^"]{0,80})', html or "")[:3]}


# Lo comparte con la verificacion que decide que se publica.
id_ml, token_ml, _TOKEN = v.id_ml, v.token_ml, v._TOKEN


def api_ml(url):
    ref = id_ml(url)
    if not ref:
        return {"id": None}
    tipo, ident = ref
    cabeceras = {"Accept": "application/json"}
    if token_ml():
        cabeceras["Authorization"] = "Bearer " + token_ml()
    codigo, _, cuerpo = pedir(f"{API_ML}/{tipo}/{ident}", cabeceras)
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
    if tipo == "user-products":
        return {**salida, "status": datos.get("status"), "claves": sorted(datos)[:20]}
    ganador = datos.get("buy_box_winner")
    return {**salida, "status": datos.get("status"), "ganador": bool(ganador),
            "ganador_item": (ganador or {}).get("item_id")}


def resumen_ml(codigo, cuerpo):
    """Lo justo de una respuesta de la API para decidir: codigo, error o los primeros resultados con su estado."""
    try:
        datos = json.loads(cuerpo)
    except ValueError:
        return {"codigo": codigo, "cuerpo": (cuerpo or "")[:120]}
    if codigo != 200:
        return {"codigo": codigo, "error": str(datos.get("message") or datos.get("error") or "")[:120]}
    filas = datos.get("results") if isinstance(datos, dict) else datos
    if isinstance(filas, list):
        precios = [f["price"] for f in filas if isinstance(f, dict) and isinstance(f.get("price"), (int, float))]
        return {"codigo": codigo, "minimo": min(precios) if precios else None, "leidos": len(filas),
                "total": (datos.get("paging") or {}).get("total", len(filas)) if isinstance(datos, dict) else len(filas),
                "primeros": [{k: f.get(k) for k in ("item_id", "id", "price", "status", "available_quantity", "seller_id")
                              if isinstance(f, dict) and k in f} for f in filas[:3]]}
    return {"codigo": codigo, "status": datos.get("status"), "disponibles": datos.get("available_quantity"),
            "precio": datos.get("price"), "claves": sorted(datos)[:15]}


def explorar_ml(url):
    """Prueba los endpoints oficiales que podrian decir si alguien vende el aviso y a que precio (19/10: con el
    token de aplicacion, /products da la ficha 'active' sin ganador y /user-products da 403)."""
    ref = id_ml(url)
    if not ref:
        return {}
    tipo, ident = ref
    cab = {"Accept": "application/json", **({"Authorization": "Bearer " + token_ml()} if token_ml() else {})}
    # (como se anota, que se pide)
    rutas = {"products": [("/products/{id}/items", f"/products/{ident}/items?limit=100")],
             "user-products": [("/user-products/{id}/items", f"/user-products/{ident}/items"),
                               ("/sites/MLA/search?user_product_id", f"/sites/MLA/search?user_product_id={ident}"),
                               ("/items?user_product_id", f"/items?user_product_id={ident}")],
             "items": [("/items/{id}", f"/items/{ident}")]}.get(tipo, [])
    salida = {}
    for clave, ruta in rutas:
        codigo, _, cuerpo = pedir(API_ML + ruta, cab)
        salida[clave] = r = resumen_ml(codigo, cuerpo)
        # el primer aviso que aparezca: su estado y stock son lo que de verdad dice si esta en pie
        item = next((f.get("item_id") or f.get("id") for f in r.get("primeros") or [] if f.get("item_id") or f.get("id")), None)
        if item and "/items/{id}" not in salida:
            salida["/items/{id}"] = {"item": item, **resumen_ml(*pedir(f"{API_ML}/items/{item}", cab)[::2])}
    return salida


def diagnosticar(url):
    codigo, final, html = pedir(url)
    fila = {"url": url, "comercio": v.comercio(url), "html": {"codigo": codigo, "final": final[:200], **senales(html)}}
    for nombre, ua in (("render_nuestro", v.UA), ("render_navegador", None)):
        dom = v.renderizar(url, ua=ua)
        fila[nombre] = None if dom is None else senales(dom)
    if "mercadolibre" in fila["comercio"]:
        fila["api"] = api_ml(url)
        fila["explorar"] = explorar_ml(url)
    fila["veredicto"] = v.revisar(url)
    return fila


def linea(f):
    h, rn, rv = f["html"], f["render_nuestro"], f["render_navegador"]
    corto = lambda r: "no abrió" if r is None else ("captcha/muro" if r["muro"] else
                                                    ("CARTEL" if r["cartel"] else
                                                     f"sin cartel {r['largo']}b «{r['titulo'][:40]}» {r['texto'][:90]!r}"))
    api = f.get("api")
    api_txt = "" if not api else (f" | api {api.get('tipo', '')} {api.get('codigo')} {api.get('status', '')} "
                                  f"{api.get('disponibles', api.get('ganador', ''))} {api.get('error', '')}"
                                  f"{' ' + str(api['claves']) if api.get('claves') else ''}".rstrip())
    return (f"- {f['comercio']}: html {h['codigo']} {'CARTEL' if h['cartel'] else ''}{' muro' if h['muro'] else ''}"
            f" disp={h['disponibilidad']} «{h['titulo'][:60]}» | render nuestro: {corto(rn)} | render navegador: "
            f"{corto(rv)}{api_txt} | veredicto: {f['veredicto'][0]} ({f['veredicto'][1]})\n  {f['url'][:140]}"
            + "".join(f"\n    {ruta}: {json.dumps(r, ensure_ascii=False)[:300]}" for ruta, r in (f.get("explorar") or {}).items()))


def comparaya(urls):
    """Que campos trae ComparaYa por aviso (por si alguno dice stock o fecha) y la fila de los enlaces candidatos."""
    vistas, campos = {}, None
    for cat in ("notebooks", "celulares", "monitores"):
        for n in (1, 2, 3):
            codigo, _, cuerpo = pedir(f"https://api.comparaya.net/api/products/category/{cat}?page={n}&limit=100",
                                      {"Accept": "application/json"})
            try:
                filas = json.loads(cuerpo).get("data") or []
            except ValueError:
                filas = []
            for fila in filas:
                if campos is None:
                    campos = {k: (str(val)[:60] if not isinstance(val, (dict, list)) else type(val).__name__)
                              for k, val in fila.items()}
                if fila.get("url") in urls:
                    vistas[fila["url"]] = {k: val for k, val in fila.items() if k not in ("image", "images", "description")}
    return campos, vistas


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
    campos, vistas = comparaya(set(urls))
    texto = ("### Diagnóstico de enlaces (caso real)\n\n"
             f"Token de Mercado Libre: {'sí' if token_ml() else 'no (faltan los secretos ML_CLIENT_ID y ML_CLIENT_SECRET)'}\n\n"
             + "\n".join(linea(f) for f in filas) + "\n\n"
             f"ComparaYa, campos de un aviso: {json.dumps(campos, ensure_ascii=False)[:1500]}\n\n"
             f"ComparaYa, filas de las candidatas encontradas: {len(vistas)}\n"
             + "\n".join(f"- {json.dumps(fila, ensure_ascii=False)[:700]}" for fila in list(vistas.values())[:3]) + "\n")
    with open(salida.replace(".json", "-comparaya.json"), "w", encoding="utf-8") as f:
        json.dump({"campos": campos, "filas": vistas}, f, ensure_ascii=False, indent=1)
    print(texto)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(texto)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
