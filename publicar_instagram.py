#!/usr/bin/env python3
"""Publica las "Pichinchas del dia" en Instagram (spec 025).

Uso:
    python publicar_instagram.py armar _sitio/ofertas.json --salida _sitio --post instagram.json
    python publicar_instagram.py publicar instagram.json

`armar` (en el build, antes de desplegar): con las ofertas ya verificadas de ofertas.json (las mismas de Telegram) arma
la tarjeta 4:5 de las mejores, la saca como JPEG con Chrome sin interfaz en <salida>/instagram/AAAA-MM-DD.jpg y escribe
<post>: la direccion publica de esa imagen y el texto de la publicacion.

`publicar` (despues del despliegue, cuando la imagen ya tiene direccion publica, que es lo que pide Instagram): renueva
el token, no publica si ya hay una publicacion de ese dia, espera a que la imagen responda y la publica con la API de
Instagram (inicio de sesion de Instagram, permiso instagram_business_content_publish).

Es opcional: sin INSTAGRAM_TOKEN e INSTAGRAM_USER_ID no hace ningun pedido ni falla. Si Instagram falla, avisa con una
advertencia y la corrida sigue: el sitio ya esta publicado. El token nunca se imprime.
"""

import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from publicar_telegram import acortar, cuando, pesos

API = "https://graph.instagram.com/v23.0"
EN_TARJETA = 5          # ofertas en la imagen; el texto lleva todas las de ofertas.json (hasta 10)
LIMITE = 2200           # largo maximo del texto de una publicacion de Instagram
ANCHO, ALTO = 1080, 1350   # 4:5, el formato mas alto que Instagram acepta en el feed sin recortar
ARGENTINA = timezone(timedelta(hours=-3))
ETIQUETAS = "#hardware #tecnologia #ofertas #argentina #pcgamer"
LARGO_NOMBRE = 80       # lo que entra en los dos renglones del nombre en la tarjeta
# Lo que se saca primero si el nombre no entra: no distingue un equipo de otro. Modelo, CPU, RAM, disco y sistema quedan.
RELLENO = re.compile(r"\s*\([^)]*\)|\s+#|\s+(?:gamer|gaming|nuev[oa]|frameless|reclinable|con|para|de|y|pc|consolas|"
                     r"negr[oa]|black|blanc[oa]|white|gris|grey|gray|platead[oa]|silver|azul|blue|color)(?=\s|$)", re.I)
NAVEGADORES = ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome")


def fecha_de(datos):
    """AAAA-MM-DD de los precios; si el indice no la trae, la de hoy en Argentina."""
    generado = datos.get("generado") or ""
    return generado[:10] if len(generado) >= 10 else datetime.now(ARGENTINA).strftime("%Y-%m-%d")


def texto(datos):
    """El texto de la publicacion, o None si no hay ofertas. Se achica hasta entrar en el limite."""
    ofertas = datos.get("ofertas") or []
    if not ofertas:
        return None
    sitio = (datos.get("sitio") or "").rstrip("/")
    dominio = sitio.split("://", 1)[-1]
    cabeza = f"Pichinchas del día · precios del {cuando(datos.get('generado', ''))}\n"
    # En Instagram un link del texto no se puede tocar: se manda a /hoy/, que esta en la bio y tiene el de cada tienda.
    pie = (f"\nTodas con su link a la tienda en {dominio}/hoy (link en la bio).\n"
           "Precios con IVA y sin envío; cambian rápido: verificá en la tienda antes de comprar. "
           "El orden no depende de comisiones.\n\n" + ETIQUETAS)
    lineas = []
    for i, o in enumerate(ofertas, 1):
        lineas.append(f"{i}. {acortar(sin_numeral(o['nombre']))}\n{pesos(o['precio'])} (−{o['descuento']}%) en {o['comercio']}"
                      + (f"\n{o['puesto']}" if o.get("puesto") else ""))
    while lineas and len(cabeza + "\n\n".join(lineas) + "\n" + pie) > LIMITE:
        lineas.pop()
    return cabeza + "\n" + "\n\n".join(lineas) + "\n" + pie if lineas else None


def sin_numeral(nombre):
    """Mexx termina sus titulos con « #»: no dice nada y en Instagram parece una etiqueta a medias."""
    return re.sub(r"\s+#+\s*$", "", nombre)


def nombre_tarjeta(nombre):
    """El nombre para los dos renglones de la tarjeta: si no entra, primero se saca el relleno (colores, «Gamer»,
    codigos entre parentesis, «#»); si aun no entra, se corta en una palabra entera."""
    nombre = sin_numeral(nombre)
    if len(nombre) <= LARGO_NOMBRE:
        return nombre
    nombre = re.sub(r"\s+", " ", RELLENO.sub("", nombre)).strip()
    if len(nombre) <= LARGO_NOMBRE:
        return nombre
    return nombre[:LARGO_NOMBRE - 1].rsplit(" ", 1)[0].rstrip(" ,;:-") + "…"


def tarjeta(datos):
    """La pagina de la imagen: 1080x1350, con los colores del sitio y todo el texto de terceros escapado."""
    esc = html.escape
    fecha = fecha_de(datos)
    dominio = (datos.get("sitio") or "").rstrip("/").split("://", 1)[-1]
    filas = []
    for o in (datos.get("ofertas") or [])[:EN_TARJETA]:
        antes = f'<s>{esc(pesos(o["antes"]))}</s>' if o.get("antes") else ""
        filas.append(f'<li><span class="pct">−{o["descuento"]}%</span><div><p class="nom">{esc(nombre_tarjeta(o["nombre"]))}</p>'
                     f'<p class="pre"><b>{esc(pesos(o["precio"]))}</b> {antes}</p>'
                     f'<p class="com">{esc(o["comercio"])}{" · " + esc(o["categoria"]) if o.get("categoria") else ""}</p></div></li>')
    return f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;700&family=IBM+Plex+Sans:wght@500;600;700&display=block" rel="stylesheet">
<style>
*{{box-sizing:border-box}}
html,body{{margin:0;width:{ANCHO}px;height:{ALTO}px;overflow:hidden}}
body{{background:#f4f6f9;color:#14181f;font-family:"IBM Plex Sans",system-ui,sans-serif;padding:60px 60px 52px;display:flex;flex-direction:column}}
.cab{{display:flex;justify-content:space-between;font:700 30px "IBM Plex Mono",monospace;color:#0b4fd8;letter-spacing:.02em}}
h1{{font-size:86px;line-height:1;letter-spacing:-.03em;margin:18px 0 30px}}
ol{{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;flex:1}}
li{{display:grid;grid-template-columns:150px 1fr;gap:26px;align-items:center;background:#fff;border:2px solid #d9dfe8;border-radius:26px;padding:18px 26px}}
.pct{{font:700 44px "IBM Plex Mono",monospace;color:#117a4a;background:#dff3e8;border-radius:18px;padding:16px 0;text-align:center}}
li p{{margin:0}}
.nom{{font-weight:600;font-size:31px;line-height:1.2;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
.pre{{font:500 30px "IBM Plex Mono",monospace;margin-top:6px!important}}
.pre b{{font-weight:700}}
.pre s{{color:#626b7e;font-size:25px}}
.com{{font-size:24px;color:#4e5767;margin-top:2px!important}}
.pie{{margin:26px 0 0;font-size:30px;color:#4e5767}}
.pie b{{color:#0b4fd8}}
</style></head>
<body>
<div class="cab"><span>LA PICHINCHA</span><span>{esc(fecha[8:10] + "/" + fecha[5:7])}</span></div>
<h1>Pichinchas del día</h1>
<ol>
{chr(10).join(filas)}
</ol>
<p class="pie">Todas con su link en <b>{esc(dominio)}/hoy</b> · link en la bio</p>
</body></html>
"""


def navegador():
    return os.environ.get("CHROME_BIN") or next((n for n in NAVEGADORES if shutil.which(n)), None)


def sacar_jpeg(pagina, destino, chrome):
    """Abre la pagina en Chrome sin interfaz y guarda la captura; Chrome elige JPEG por la extension del archivo."""
    with tempfile.TemporaryDirectory() as tmp:
        archivo = Path(tmp) / "tarjeta.html"
        archivo.write_text(pagina, encoding="utf-8")
        # El tiempo virtual deja que carguen las fuentes antes de la captura; sin red sale con las del sistema.
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
                        f"--window-size={ANCHO},{ALTO}", "--virtual-time-budget=8000",
                        f"--screenshot={destino}", archivo.as_uri()], check=True, capture_output=True, timeout=120)
    if not Path(destino).is_file() or Path(destino).read_bytes()[:3] != b"\xff\xd8\xff":
        raise RuntimeError("Chrome no dejo un JPEG")


def armar(ruta_ofertas, salida, ruta_post):
    try:
        datos = json.loads(Path(ruta_ofertas).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print(f"::warning::No hay {ruta_ofertas}: no se arma la publicacion de Instagram")
        return 0
    leyenda = texto(datos)
    if leyenda is None:
        print("Sin ofertas hoy: no se arma la publicacion de Instagram")
        return 0
    chrome = navegador()
    if not chrome:
        print("::warning::No hay Chrome: no se arma la imagen de Instagram")
        return 0
    fecha = fecha_de(datos)
    carpeta = Path(salida) / "instagram"
    carpeta.mkdir(parents=True, exist_ok=True)
    try:
        sacar_jpeg(tarjeta(datos), str(carpeta / f"{fecha}.jpg"), chrome)
    except (OSError, subprocess.SubprocessError, RuntimeError) as e:
        print(f"::warning::No se pudo sacar la imagen de Instagram ({type(e).__name__})")
        return 0
    sitio = (datos.get("sitio") or "").rstrip("/")
    Path(ruta_post).write_text(json.dumps({"fecha": fecha, "imagen": f"{sitio}/instagram/{fecha}.jpg", "texto": leyenda},
                                          ensure_ascii=False), encoding="utf-8")
    print(f"Publicacion de Instagram armada: instagram/{fecha}.jpg, {len(leyenda)} caracteres de texto")
    return 0


class ErrorInstagram(Exception):
    """Un rechazo de la API, con su mensaje y sin el token."""


def pedir(metodo, ruta, token, **parametros):
    """GET o POST a la API de Instagram; devuelve el JSON. El token viaja en el cuerpo o la consulta y nunca se muestra."""
    datos = urllib.parse.urlencode({**parametros, "access_token": token})
    url = ruta if ruta.startswith("https://") else f"{API}/{ruta}"
    if metodo == "GET":
        pedido = urllib.request.Request(f"{url}?{datos}")
    else:
        pedido = urllib.request.Request(url, data=datos.encode("utf-8"), method="POST")
    try:
        with urllib.request.urlopen(pedido, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            motivo = json.loads(e.read().decode("utf-8", "replace")).get("error", {}).get("message", "")
        except (OSError, ValueError, AttributeError):
            motivo = ""
        raise ErrorInstagram(f"HTTP {e.code} {str(motivo).replace(token, '***')[:200]}".rstrip()) from None


def renovar(token, repo, gh_token):
    """Estira el token otros 60 dias (Instagram lo permite desde que tiene 24 horas). Si vuelve uno distinto y hay con
    que guardarlo (INSTAGRAM_GH_TOKEN, con permiso de escribir secretos del repo) lo guarda; el que sirve sigue en uso."""
    try:
        r = pedir("GET", "https://graph.instagram.com/refresh_access_token", token, grant_type="ig_refresh_token")
    except (ErrorInstagram, urllib.error.URLError, OSError) as e:
        print(f"::warning::No se pudo renovar el token de Instagram: {e}")
        return token
    nuevo, dias = r.get("access_token") or token, int(r.get("expires_in") or 0) // 86400
    print(f"Token de Instagram renovado: vence en {dias} dias")
    if nuevo == token:
        return token
    if not (repo and gh_token):
        print("::warning::Instagram devolvio un token nuevo y no hay INSTAGRAM_GH_TOKEN para guardarlo: el actual vence en "
              "60 dias desde que se genero (spec 025)")
        return nuevo
    try:
        subprocess.run(["gh", "secret", "set", "INSTAGRAM_TOKEN", "--repo", repo], input=nuevo, text=True, check=True,
                       capture_output=True, timeout=60, env={**os.environ, "GH_TOKEN": gh_token})
        print("Token nuevo guardado en INSTAGRAM_TOKEN")
    except (OSError, subprocess.SubprocessError):
        print("::warning::No se pudo guardar el token nuevo de Instagram en INSTAGRAM_TOKEN")
    return nuevo


def publicado_el(token, usuario, fecha):
    """Si la ultima publicacion de la cuenta es de esa fecha (en Argentina), para no repetir el dia."""
    ultima = (pedir("GET", f"{usuario}/media", token, fields="timestamp", limit=1).get("data") or [{}])[0]
    marca = ultima.get("timestamp") or ""
    try:
        cuando_fue = datetime.strptime(marca, "%Y-%m-%dT%H:%M:%S%z").astimezone(ARGENTINA)
    except ValueError:
        return False
    return cuando_fue.strftime("%Y-%m-%d") == fecha


def esperar_imagen(url, dormir, intentos=10):
    """El despliegue tarda en llegar a todos lados: Instagram baja la imagen por su cuenta y tiene que estar."""
    for i in range(intentos):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD"), timeout=20) as r:
                if r.status == 200 and r.headers.get("Content-Type", "").startswith("image/jpeg"):
                    return True
        except (urllib.error.URLError, OSError):
            pass
        if i < intentos - 1:
            dormir(30)
    return False


def publicar(post, token, usuario, dormir=time.sleep):
    """Crea el contenedor con la imagen y el texto, espera a que Instagram lo procese y lo publica. Devuelve el enlace."""
    contenedor = pedir("POST", f"{usuario}/media", token, image_url=post["imagen"], caption=post["texto"])["id"]
    for _ in range(12):
        estado = pedir("GET", contenedor, token, fields="status_code").get("status_code")
        if estado == "FINISHED":
            break
        if estado in ("ERROR", "EXPIRED"):
            raise ErrorInstagram(f"Instagram no pudo procesar la imagen ({estado})")
        dormir(5)
    else:
        raise ErrorInstagram("Instagram no termino de procesar la imagen a tiempo")
    publicacion = pedir("POST", f"{usuario}/media_publish", token, creation_id=contenedor)["id"]
    try:
        return pedir("GET", publicacion, token, fields="permalink").get("permalink") or publicacion
    except (ErrorInstagram, urllib.error.URLError, OSError):
        return publicacion


def subir(ruta_post, dormir=time.sleep):
    token = os.environ.get("INSTAGRAM_TOKEN")
    usuario = os.environ.get("INSTAGRAM_USER_ID")
    if not token or not usuario:
        print("Instagram sin configurar (faltan INSTAGRAM_TOKEN e INSTAGRAM_USER_ID): no se publica")
        return 0
    try:
        post = json.loads(Path(ruta_post).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print(f"No hay {ruta_post} (sin ofertas o sin imagen): no se publica en Instagram")
        return 0
    token = renovar(token, os.environ.get("GITHUB_REPOSITORY"), os.environ.get("INSTAGRAM_GH_TOKEN"))
    try:
        if publicado_el(token, usuario, post["fecha"]):
            print(f"Ya hay una publicacion del {post['fecha']} en Instagram: no se repite")
            return 0
        if not esperar_imagen(post["imagen"], dormir):
            print(f"::warning::La imagen {post['imagen']} no responde: no se publica en Instagram")
            return 0
        enlace = publicar(post, token, usuario, dormir)
    except ErrorInstagram as e:
        print(f"::warning::Instagram rechazo la publicacion: {e}")
        return 0
    except (urllib.error.URLError, OSError, KeyError, ValueError) as e:
        print(f"::warning::No se pudo publicar en Instagram ({type(e).__name__})")
        return 0
    print(f"Publicado en Instagram: {enlace}")
    return 0


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    arg = lambda nombre, defecto: argv[argv.index(nombre) + 1] if nombre in argv else defecto
    if argv[:1] == ["armar"] and len(argv) > 1:
        return armar(argv[1], arg("--salida", "_sitio"), arg("--post", "instagram.json"))
    if argv[:1] == ["publicar"] and len(argv) > 1:
        return subir(argv[1])
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
