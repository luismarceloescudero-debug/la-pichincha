#!/usr/bin/env python3
"""Publica las "Pichinchas del dia" en un canal de Telegram.

Uso:
    python publicar_telegram.py _sitio/ofertas.json [--previo telegram-previo.json] [--estado _sitio/telegram.json]
                                [--solo-corregir]
    python publicar_telegram.py _sitio/ofertas.json --vista telegram.json   (despues de publicar el sitio)

Lee ofertas.json (lo escribe generar_feed.js) y manda UN mensaje con hasta 10 ofertas y el enlace al
sitio. Es opcional: sin TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID (secretos del repo) no hace ningun
pedido ni falla. Si Telegram falla, avisa con una advertencia y la corrida sigue: el sitio ya esta
publicado. El token nunca se imprime.

Un mensaje por indice (spec 030). --estado guarda que mensaje salio para que indice ({generado, message_id,
texto}); se publica con el sitio y la corrida siguiente lo lee con --previo. Si el sitio se vuelve a publicar
con el mismo indice y otra lista (23/10: el arreglo de la Lenovo repetida republico /hoy/ a las 22:51, pero el
mensaje de las 22:06 siguio con el error), se corrige ese mensaje con editMessageText en lugar de mandar otro.
--solo-corregir (un push) nunca manda un mensaje nuevo: corrige el del mismo indice o, si el indice se rearmo, el del mismo dia.

La imagen grande (spec 059): el mensaje sale antes de que el sitio nuevo este publicado, asi que su vista previa es la del
inicio del sitio (la imagen general). Ya publicado, --vista edita ese mismo mensaje (mismo texto) para que la vista previa
sea /hoy/?v=<version>, cuya imagen (hoy/og.png, generar_vista_hoy.js) muestra la super oferta del dia con el diseño del
Reel. La version cambia con la lista: Telegram guarda las vistas previas por direccion y si no mostraria la de ayer.
"""

import hashlib
import html
import json
import os
import sys
import time
import urllib.error
import urllib.request

# Segundos de espera entre reintentos cuando la red falla antes de llegar a Telegram (04/11: un URLError
# suelto dejo la corrida manual sin mensaje). Tres intentos en total.
ESPERAS = (5, 15)

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


# Abre y cierra la oferta destacada, el resto va en citas (jerarquia, spec 055). Con los colores del Reel v4 (spec 059).
BARRA = "🟪🟨🟦🟪🟨🟦🟪🟨"
# La mejor del dia (14/11): por ahorro real y categoria, no por el % mas alto (un mousepad de $7.990 con -27 % le ganaba a una
# notebook). Espejo de js/ofertas.js (puntaje y mejorDelDia): si cambia uno, cambia el otro; lo cubre tests/test_publicar_telegram.py.
PESO_CATEGORIA = {"Smartphone": 1, "Notebook": 1, "PC completa": 1, "Monitor": 1, "Componente": 0.7, "Periférico": 0.3, "Otro": 0.25}
BONO_NIVEL = {"alta": 1.25, "media": 1}


def _puntaje(o):
    ahorro = max(0, (o.get("antes") or 0) - (o.get("precio") or 0))
    return ahorro * PESO_CATEGORIA.get(o.get("categoria"), 0.25) * BONO_NIVEL.get(o.get("nivel"), 1)


PISO_SUPER = 20   # como en /hoy/ y el Reel: con 20 % o mas es «Súper oferta»; un dia flojo, «La mejor del día»


def _marca(o):
    """El emoji del tipo y el nombre (ya sin chips): MARCA Y MODELO (spec 044) o, de un ofertas.json viejo, categoria y titulo."""
    if o.get("titulo"):
        # spec 059: con pocas palabras el titulo lleva el tipo adelante («Teclado VSG ALNILAM»), lo decide titulo.js
        return (f"{o['emoji']} " if o.get("emoji") else ""), (f"{o['prefijo']} " if o.get("prefijo") else "") + o["titulo"]
    return (f"<i>{html.escape(o['categoria'])}</i> · " if o.get("categoria") else ""), o["nombre"]


def _enlace(o, texto):
    # `enlace` es el mismo link con el codigo de afiliado (generar_feed.js); se rotula, el orden no cambia.
    return f"<a href=\"{html.escape(o.get('enlace') or o['url'], quote=True)}\">{html.escape(acortar(texto))}</a>"


def _precio(o, punta="", separador=" · "):
    """El precio y, si tiene, el porcentaje en negrita: una publicacion a precio de siempre sale igual, sin inventar un −0 %."""
    if o.get("sinRebaja") or not o.get("descuento"):
        return f"<b>{pesos(o['precio'])}</b>"
    return f"<b>{pesos(o['precio'])}</b>{separador}{punta}<b>−{o['descuento']}%</b>"


def _pie_oferta(o):
    # una oferta contra el mismo modelo dice contra que se compara (spec 035): no es un precio de antes
    contra = f" {html.escape(o['contra'])}" if o.get("contra") else ""
    return (f"en {html.escape(o['comercio'])}" + (" (enlace de afiliado)" if o.get("afiliado") else ""), contra)


def _heroe(o):
    """La mejor del dia: titulo en mayusculas ya viene de titulo.js; precio y porcentaje en su propia linea, entre dos barras."""
    emoji, nombre = _marca(o)
    donde, contra = _pie_oferta(o)
    cinta = "SÚPER OFERTA" if (o.get("descuento") or 0) >= PISO_SUPER and not o.get("sinRebaja") else "LA MEJOR DEL DÍA"
    lineas = [BARRA, f"<b>★ {cinta} ★</b>",
              f"{html.escape(emoji) if o.get('titulo') else emoji}<b>{_enlace(o, nombre)}</b>"]
    if o.get("chips"):
        lineas.append("<i>✦ " + html.escape(" · ".join(o["chips"])) + "</i>")
    lineas.append(_precio(o, separador="  ·  ") + contra)
    lineas.append(donde)
    lineas.append(BARRA)
    return "\n".join(lineas)


def _compacta(o):
    """El resto: una cita con el nombre, las caracteristicas en cursiva (mas apagadas) y el precio con el porcentaje en negrita."""
    emoji, nombre = _marca(o)
    donde, contra = _pie_oferta(o)
    punta = "🔥 " if o.get("descuento", 0) >= 30 else "⚡ " if o.get("descuento", 0) >= 20 else ""
    cuerpo = [f"{html.escape(emoji) if o.get('titulo') else emoji}{_enlace(o, nombre)}"]
    if o.get("chips"):
        cuerpo.append("<i>" + html.escape(" · ".join(o["chips"])) + "</i>")
    cuerpo.append(_precio(o, punta) + f"{contra} {donde}")
    return "<blockquote>" + "\n".join(cuerpo) + "</blockquote>"


def mensaje(datos):
    """El texto (HTML de Telegram) con las ofertas, o None si no hay. Jerarquia (spec 055): la de mayor descuento va grande
    entre dos barras de color y el resto en citas compactas; no todo pesa igual. Se achica hasta entrar en el limite."""
    ofertas = datos.get("ofertas") or []
    fecha = cuando(datos.get("generado", ""))
    sitio = html.escape(datos.get("sitio", ""), quote=True)
    if not ofertas:
        # Sin nada para destacar el mensaje sale igual: la publicacion no depende de que hoy haya rebajas (dueno, 04/11).
        return (f"<b>Pichinchas del día</b> · precios del {fecha}\n"
                "Hoy no hay bajas para destacar. Precios y comparador actualizados en "
                f"<a href=\"{sitio}\">La Pichincha</a>.")
    cabeza = f"<b>Pichinchas del día</b> · precios del {fecha}\n"
    pie = (f"\nMás en <a href=\"{html.escape(datos.get('sitio', ''), quote=True)}\">La Pichincha</a>. "
           "Verificá en la tienda antes de comprar.")
    mejor = max(range(len(ofertas)), key=lambda i: (_puntaje(ofertas[i]), ofertas[i].get("descuento") or 0, -i))
    bloques = [_heroe(ofertas[mejor])] + [_compacta(o) for i, o in enumerate(ofertas) if i != mejor]
    while bloques and len(cabeza + "\n".join(bloques) + "\n" + pie) > LIMITE:
        if len(bloques) == 1:
            return None
        bloques.pop()
    return cabeza + "\n".join(bloques) + "\n" + pie if bloques else None


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


def version(datos):
    """Cambia si cambia la lista de ofertas: la direccion de la vista previa es otra y Telegram no reusa la de ayer."""
    lista = json.dumps(datos.get("ofertas") or [], sort_keys=True, ensure_ascii=False)
    return hashlib.sha1(lista.encode("utf-8")).hexdigest()[:10]


def pedir(token, metodo, campos, tolerar=""):
    """POST a la API de Telegram. Devuelve el `result` de la respuesta ({} si no se pudo leer), o None si fallo,
    con la advertencia ya impresa. `tolerar`: un rechazo que no es una falla (se avisa sin advertencia y da {})."""
    cuerpo = json.dumps(campos).encode("utf-8")
    pedido = urllib.request.Request(f"https://api.telegram.org/bot{token}/{metodo}", data=cuerpo,
                                    headers={"Content-Type": "application/json"}, method="POST")
    intentos = len(ESPERAS) + 1
    for intento in range(1, intentos + 1):
        try:
            with urllib.request.urlopen(pedido, timeout=20) as r:
                try:
                    resultado = json.loads(r.read().decode("utf-8")).get("result")
                except (ValueError, TypeError, AttributeError):
                    resultado = None
            return resultado if isinstance(resultado, dict) else {}
        except urllib.error.HTTPError as e:
            # Telegram explica el rechazo ("chat not found", "bot is not a member..."): se muestra para
            # poder arreglarlo, pero nunca el token, por si apareciera en algun texto. No se reintenta.
            try:
                motivo = json.loads(e.read().decode("utf-8", "replace")).get("description", "")
            except (OSError, ValueError, AttributeError):
                motivo = ""
            motivo = motivo.replace(token, "***")[:200]
            if tolerar and tolerar in motivo:
                print(f"Telegram: {motivo}")
                return {}
            print(f"::warning::Telegram rechazo el mensaje: HTTP {e.code} {motivo}".rstrip())
            return None
        except (urllib.error.URLError, OSError) as e:
            razon = getattr(e, "reason", e)
            # Un corte por tiempo pudo llegar a publicar: reintentar duplicaria el mensaje en el canal.
            # Una falla al conectar (DNS, red caida, conexion rechazada) no llego a Telegram: se reintenta.
            por_tiempo = isinstance(razon, TimeoutError) or isinstance(e, TimeoutError)
            if por_tiempo or intento == intentos:
                detalle = str(razon).replace(token, "***")[:200]
                cuantos = f", {intento} intentos" if intento > 1 else ""
                print(f"::warning::No se pudo publicar en Telegram ({type(e).__name__}: {detalle}{cuantos})")
                return None
            time.sleep(ESPERAS[intento - 1])


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    opcion = lambda nombre: argv[argv.index(nombre) + 1] if nombre in argv[:-1] else None
    ruta = argv[0] if argv and not argv[0].startswith("--") else "_sitio/ofertas.json"
    previo, ruta_estado, solo_corregir = leer_json(opcion("--previo")), opcion("--estado"), "--solo-corregir" in argv
    vista = leer_json(opcion("--vista")) if "--vista" in argv else None
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
    if vista is not None:
        return poner_vista(datos, vista, token, canal)
    # El mensaje que ya salio para este mismo indice: se corrige, no se repite. Un push corrige tambien el del mismo dia
    # aunque el indice se haya rearmado (24/10: el merge que cambio indexar.py rearmo el indice y el mensaje de las 15:36
    # quedaba con la lista vieja).
    hoy = str(datos.get("generado", ""))[:10]
    mismo = previo if previo.get("message_id") and (previo.get("generado") == datos.get("generado") or (
        solo_corregir and hoy and str(previo.get("generado", ""))[:10] == hoy)) else None
    texto = mensaje(datos)
    if texto is None:
        print("Sin ofertas hoy: no hay mensaje para Telegram")
        escribir_estado(ruta_estado, mismo)
        return 0
    if mismo and mismo.get("texto") == texto:
        print("El mensaje de este indice ya salio igual: no se toca")
        escribir_estado(ruta_estado, mismo)
        return 0
    if not mismo and solo_corregir:
        print("Sin mensaje de este indice para corregir: un push no manda uno nuevo")
        return 0
    # La vista previa, por ahora, es la del inicio del sitio (la imagen general): el /hoy/ publicado todavia es el de la
    # corrida anterior. Ya publicado el sitio nuevo, --vista la cambia por la imagen del dia (spec 059).
    previa = {"url": datos.get("sitio", ""), "prefer_large_media": True}
    campos = {"chat_id": canal, "text": texto, "parse_mode": "HTML", "link_preview_options": previa}
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


def campos_vista(datos, estado, canal):
    """La edicion que le pone al mensaje de este indice la imagen del dia, o None si no hay mensaje de este indice."""
    if not estado.get("message_id") or not estado.get("texto") or estado.get("generado") != datos.get("generado"):
        return None
    previa = {"url": f"{datos.get('sitio', '')}hoy/?v={version(datos)}", "prefer_large_media": True, "show_above_text": True}
    return {"chat_id": canal, "message_id": estado["message_id"], "text": estado["texto"], "parse_mode": "HTML",
            "link_preview_options": previa}


def poner_vista(datos, estado, token, canal):
    """Despues de publicar el sitio: el mismo mensaje, con la imagen de /hoy/ arriba y en grande (spec 059)."""
    campos = campos_vista(datos, estado, canal)
    if campos is None:
        print("Sin mensaje de este indice en Telegram: no hay vista previa para poner")
        return 0
    if pedir(token, "editMessageText", campos, tolerar="message is not modified") is not None:
        print("Vista previa del mensaje: la imagen de /hoy/ de este indice")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
