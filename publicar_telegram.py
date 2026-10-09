#!/usr/bin/env python3
"""Publica las "Pichinchas del dia" en un canal de Telegram.

Uso:
    python publicar_telegram.py _sitio/ofertas.json

Lee ofertas.json (lo escribe generar_feed.js) y manda UN mensaje con hasta 10 ofertas y el enlace al
sitio. Es opcional: sin TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (secretos del repo) no hace ningun
pedido ni falla. Si Telegram falla, avisa con una advertencia y la corrida sigue: el sitio ya esta
publicado. El token nunca se imprime.
"""

import html
import json
import os
import sys
import urllib.error
import urllib.request

LIMITE = 4096   # largo maximo de un mensaje de Telegram


def cuando(iso):
    """09/10 08:12; si el indice solo trae la fecha, 09/10."""
    fecha = f"{iso[8:10]}/{iso[5:7]}" if len(iso) >= 10 else ""
    return f"{fecha} {iso[11:16]}" if len(iso) >= 16 else fecha


def pesos(n):
    return "$" + f"{round(n):,}".replace(",", ".")


def mensaje(datos):
    """El texto (HTML de Telegram) con las ofertas, o None si no hay. Se achica hasta entrar en el limite."""
    ofertas = datos.get("ofertas") or []
    if not ofertas:
        return None
    cabeza = f"<b>Pichinchas del día</b> · precios del {cuando(datos.get('generado', ''))}\n"
    pie = (f"\nMás en <a href=\"{html.escape(datos.get('sitio', ''), quote=True)}\">La Pichincha</a>. "
           "Verificá en la tienda antes de comprar.")
    lineas = []
    for i, o in enumerate(ofertas, 1):
        lineas.append(f"{i}. <a href=\"{html.escape(o['url'], quote=True)}\">{html.escape(o['nombre'])}</a>: "
                      f"{pesos(o['precio'])} (−{o['descuento']}%) en {html.escape(o['comercio'])}")
    while lineas and len(cabeza + "\n".join(lineas) + "\n" + pie) > LIMITE:
        lineas.pop()
    return cabeza + "\n".join(lineas) + "\n" + pie if lineas else None


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    ruta = argv[0] if argv else "_sitio/ofertas.json"
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    canal = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not canal:
        print("Telegram sin configurar (faltan TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID): no se publica")
        return 0
    try:
        with open(ruta, encoding="utf-8") as f:
            datos = json.load(f)
    except (OSError, ValueError):
        print(f"::warning::No hay {ruta}: no se publica en Telegram")
        return 0
    texto = mensaje(datos)
    if texto is None:
        print("Sin ofertas hoy: no se publica en Telegram")
        return 0
    cuerpo = json.dumps({"chat_id": canal, "text": texto, "parse_mode": "HTML",
                         "disable_web_page_preview": True}).encode("utf-8")
    pedido = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=cuerpo,
                                    headers={"Content-Type": "application/json"}, method="POST")
    try:
        urllib.request.urlopen(pedido, timeout=20)
    except (urllib.error.URLError, OSError) as e:
        print(f"::warning::No se pudo publicar en Telegram ({type(e).__name__})")
        return 0
    print(f"Publicado en Telegram: {len(datos['ofertas'])} ofertas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
