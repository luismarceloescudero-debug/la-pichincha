#!/usr/bin/env python3
"""Publica las "Pichinchas del dia" en un canal de Telegram.

Uso:
    python publicar_telegram.py _sitio/ofertas.json [--previo telegram-previo.json] [--estado _sitio/telegram.json]
                                [--solo-corregir]

Lee ofertas.json (lo escribe generar_feed.js) y manda UN mensaje con hasta 10 ofertas y el enlace al
sitio. Es opcional: sin TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (secretos del repo) no hace ningun
pedido ni falla. Si Telegram falla, avisa con una advertencia y la corrida sigue: el sitio ya esta
publicado. El token nunca se imprime.

Un mensaje por indice (spec 030). --estado guarda que mensaje salio para que indice ({generado, message_id,
texto}); se publica con el sitio y la corrida siguiente lo lee con --previo. Si el sitio se vuelve a publicar
con el mismo indice y otra lista (23/10: el arreglo de la Lenovo repetida republico /hoy/ a las 22:51, pero el
mensaje de las 22:06 siguio con el error), se corrige ese mensaje con editMessageText en lugar de mandar otro.
--solo-corregir (un push) nunca manda un mensaje nuevo: corrige el del mismo indice o, si el indice se rearmo, el del mismo dia.
"""

import html
import json
import os
import sys
import urllib.error
import urllib.request

LIMITE = 4096   # largo maximo de un mensaje de Telegram
LARGO_TITULO = 100   # un titulo de Mercado Libre llega a 160 caracteres con todas sus palabras clave (19/10)


def acortar(nombre):
    """El titulo en una linea legible: se corta en una palabra entera y termina con puntos suspensivos."""
    if len(nombre) <= LARGO_TITULO:
        return nombre
    corte = nombre[:LARGO_TITULO - 1].rsplit(" ", 1)[0] if " " in nombre[:LARGO_TITULO - 1] else nombre[:LARGO_TITULO - 1]
    return corte.rstrip(" ,;:-") + "…"


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
        categoria = f"<i>{html.escape(o['categoria'])}</i> · " if o.get("categoria") else ""
        # `enlace` es el mismo link con el codigo de afiliado (generar_feed.js); se rotula, el orden no cambia.
        lineas.append(f"{i}. {categoria}<a href=\"{html.escape(o.get('enlace') or o['url'], quote=True)}\">{html.escape(acortar(o['nombre']))}</a>: "
                      f"{pesos(o['precio'])} (−{o['descuento']}%"
                      # una oferta contra el mismo modelo dice contra que se compara (spec 035): no es un precio de antes
                      + (f" {html.escape(o['contra'])}" if o.get("contra") else "") + f") en {html.escape(o['comercio'])}"
                      + (" (enlace de afiliado)" if o.get("afiliado") else "")
                      + (f"\n   <i>{html.escape(o['puesto'])}</i>" if o.get("puesto") else ""))
    while lineas and len(cabeza + "\n".join(lineas) + "\n" + pie) > LIMITE:
        lineas.pop()
    return cabeza + "\n".join(lineas) + "\n" + pie if lineas else None


def leer_json(ruta):
    """El contenido de un JSON, o {} si falta, esta roto o no es un objeto."""
    if not ruta:
        return {}
    try:
        with open(ruta, encoding="utf-8") as f:
            datos = json.load(f)
    except (OSError, ValueError):
        return {}
    return datos if isinstance(datos, dict) else {}


def escribir_estado(ruta, estado):
    if ruta and estado:
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(estado, f, ensure_ascii=False)


def pedir(token, metodo, campos):
    """POST a la API de Telegram. Devuelve el `result` de la respuesta ({} si no se pudo leer), o None si fallo,
    con la advertencia ya impresa."""
    cuerpo = json.dumps(campos).encode("utf-8")
    pedido = urllib.request.Request(f"https://api.telegram.org/bot{token}/{metodo}", data=cuerpo,
                                    headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(pedido, timeout=20) as r:
            try:
                resultado = json.loads(r.read().decode("utf-8")).get("result")
            except (ValueError, TypeError, AttributeError):
                resultado = None
        return resultado if isinstance(resultado, dict) else {}
    except urllib.error.HTTPError as e:
        # Telegram explica el rechazo ("chat not found", "bot is not a member..."): se muestra para
        # poder arreglarlo, pero nunca el token, por si apareciera en algun texto.
        try:
            motivo = json.loads(e.read().decode("utf-8", "replace")).get("description", "")
        except (OSError, ValueError, AttributeError):
            motivo = ""
        motivo = motivo.replace(token, "***")[:200]
        print(f"::warning::Telegram rechazo el mensaje: HTTP {e.code} {motivo}".rstrip())
        return None
    except (urllib.error.URLError, OSError) as e:
        print(f"::warning::No se pudo publicar en Telegram ({type(e).__name__})")
        return None


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    opcion = lambda nombre: argv[argv.index(nombre) + 1] if nombre in argv[:-1] else None
    ruta = argv[0] if argv and not argv[0].startswith("--") else "_sitio/ofertas.json"
    previo, ruta_estado, solo_corregir = leer_json(opcion("--previo")), opcion("--estado"), "--solo-corregir" in argv
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
    # El mensaje que ya salio para este mismo indice: se corrige, no se repite. Un push corrige tambien el del mismo dia
    # aunque el indice se haya rearmado (24/10: el merge que cambio indexar.py rearmo el indice y el mensaje de las 15:36
    # quedaba con la lista vieja).
    hoy = str(datos.get("generado", ""))[:10]
    mismo = previo if previo.get("message_id") and (previo.get("generado") == datos.get("generado") or (
        solo_corregir and hoy and str(previo.get("generado", ""))[:10] == hoy)) else None
    texto = mensaje(datos)
    if texto is None:
        print("Sin ofertas hoy: no se publica en Telegram")
        escribir_estado(ruta_estado, mismo)
        return 0
    if mismo and mismo.get("texto") == texto:
        print("El mensaje de este indice ya salio igual: no se toca")
        escribir_estado(ruta_estado, mismo)
        return 0
    if not mismo and solo_corregir:
        print("Sin mensaje de este indice para corregir: un push no manda uno nuevo")
        return 0
    # La miniatura del mensaje es la de la pagina /hoy/ del sitio (su imagen de Open Graph), en grande.
    vista = {"url": datos.get("sitio", "") + "hoy/", "prefer_large_media": True}
    campos = {"chat_id": canal, "text": texto, "parse_mode": "HTML", "link_preview_options": vista}
    if mismo:
        resultado = pedir(token, "editMessageText", {**campos, "message_id": mismo["message_id"]})
        if resultado is None:
            escribir_estado(ruta_estado, mismo)
            return 0
        escribir_estado(ruta_estado, {**mismo, "generado": datos.get("generado"), "texto": texto})
        print(f"Corregido en Telegram el mensaje del {cuando(datos.get('generado', ''))}: {len(datos['ofertas'])} ofertas")
        return 0
    resultado = pedir(token, "sendMessage", campos)
    if resultado is None:
        return 0
    if resultado.get("message_id"):
        escribir_estado(ruta_estado, {"generado": datos.get("generado"), "message_id": resultado["message_id"],
                                      "texto": texto})
    print(f"Publicado en Telegram: {len(datos['ofertas'])} ofertas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
