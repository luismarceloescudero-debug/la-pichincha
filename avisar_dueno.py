#!/usr/bin/env python3
"""Aviso privado al dueno por Telegram, al instante (spec 061, etapa 1).

Uso (lo llama .github/workflows/actualizar.yml):
    python avisar_dueno.py --salud salud.json --indexado success [--alarma alarma.md]
    python avisar_dueno.py --corrida-fallida            (con NECESIDADES = toJSON(needs) en el entorno)
    python avisar_dueno.py ... --seco                    (muestra el mensaje y no manda nada)

Avisa cuando:
  - una tienda trajo 0 productos o menos del 70 % de lo que tenia (salud.json, con el motivo que deja indexar.py);
  - el indexado no termino (no hay salud.json);
  - salto una alarma de la guardia del indice (alarma.md, guardia.js);
  - fallo la corrida entera (algun job en failure).

El mensaje va al chat PRIVADO del dueno (secreto TELEGRAM_CHAT_DUENO), con el mismo bot del canal (TELEGRAM_BOT_TOKEN).
NUNCA al canal: si TELEGRAM_CHAT_DUENO es igual a TELEGRAM_CHAT_ID no se manda. Sin el secreto, el paso no falla: deja
un ::warning:: y el texto del aviso en el log. El token nunca se imprime (lo tapa publicar_telegram.pedir).
"""

import argparse
import html
import json
import os
import re
import sys
from pathlib import Path

import publicar_telegram

for flujo in (sys.stdout, sys.stderr):   # los emojis del aviso en una consola de Windows (cp1252)
    try:
        flujo.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

LIMITE = 3800         # por debajo de los 4096 de Telegram, con margen para el pie
LARGO_ALARMA = 1200    # la alarma de la guardia se resume: el detalle completo esta en el issue y en la corrida

# Que quiere decir cada motivo de indexar.motivo_de(), dicho simple, y que hizo el sistema solo (catalogo de la spec 061).
MOTIVOS = {
    "cloudflare": "bloqueo de Cloudflare (pide «verificar que sos humano»). No se esquiva: la tienda se saltea hoy (E3)",
    "bloqueo": "la tienda nos bloqueo (403/429/503). No se insiste hoy (principio III)",
    "red": "se corto la conexion, tambien en el reintento",
    "sin productos": "trajo 0 productos, tambien en el reintento (E1)",
    "error": "error al leer la tienda",
}


def url_corrida(entorno=None):
    e = os.environ if entorno is None else entorno
    if e.get("GITHUB_RUN_ID") and e.get("GITHUB_REPOSITORY"):
        return f"{e.get('GITHUB_SERVER_URL', 'https://github.com')}/{e['GITHUB_REPOSITORY']}/actions/runs/{e['GITHUB_RUN_ID']}"
    return ""


def leer_salud(ruta):
    """El informe de salud, o None si no esta o no se puede leer (el indexado no termino)."""
    try:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def lineas_salud(informe, indexado="success"):
    """Una linea por fuente con problemas. Sin informe y con el indexado corrido, una linea de que no termino."""
    if informe is None:
        if indexado in ("success", "failure"):
            return ["🔴 <b>El indexado de precios no termino</b>. El sitio salio con el indice anterior."]
        return []
    salida = []
    for f in (informe.get("fuentes") or {}).values():
        nombre = html.escape(str(f.get("nombre", "?")))
        estado, ahora, previo = f.get("estado"), f.get("ahora", 0), f.get("previo", 0)
        if estado == "fallo":
            motivo = MOTIVOS.get(f.get("motivo") or "sin productos", MOTIVOS["error"])
            if f.get("motivo") == "error" and f.get("detalle"):
                motivo += ": " + str(f["detalle"])[:120]
            queda = ("se muestran los precios de la corrida anterior, marcados con su fecha vieja" if previo
                     else "no aparece en el buscador hasta que vuelva")
            salida.append(f"🔴 <b>{nombre}: 0 productos</b>. Motivo: {html.escape(motivo)}. Arreglo: {queda}.")
        elif estado == "baja":
            pct = round(100 * ahora / previo) if previo else 0
            salida.append(f"🟡 <b>{nombre}</b> trajo {ahora} productos contra {previo} ({pct} %). "
                          "Sus bajas de precio no se registran hasta que se recupere.")
    return salida


def resumen_alarma(texto):
    """La alarma de la guardia (markdown) en texto plano corto."""
    plano = re.sub(r"[*_`#>]+", "", texto or "").strip()
    plano = re.sub(r"\n{3,}", "\n\n", plano)
    if len(plano) > LARGO_ALARMA:
        plano = plano[:LARGO_ALARMA].rsplit("\n", 1)[0] + "\n…"
    return plano


def jobs_fallidos(necesidades):
    """Los jobs en failure del contexto `needs` de Actions (JSON)."""
    try:
        datos = json.loads(necesidades or "{}")
    except ValueError:
        return []
    return [k for k, v in datos.items() if isinstance(v, dict) and v.get("result") == "failure"]


def mensaje(partes, corrida=""):
    """El mensaje entero en HTML de Telegram, o "" si no hay nada que avisar."""
    partes = [p for p in partes if p]
    if not partes:
        return ""
    texto = "⚠️ <b>La Pichincha: aviso de la corrida</b>\n\n" + "\n\n".join(partes)
    if len(texto) > LIMITE:
        texto = texto[:LIMITE].rsplit("\n", 1)[0] + "\n…"
    if corrida:
        texto += f"\n\n<a href=\"{html.escape(corrida, quote=True)}\">Ver la corrida</a>"
    return texto


def mandar(texto, entorno=None):
    """Manda el aviso al chat privado. Devuelve 0 siempre: un aviso que no sale nunca frena la corrida."""
    e = os.environ if entorno is None else entorno
    token, chat, canal = e.get("TELEGRAM_BOT_TOKEN"), e.get("TELEGRAM_CHAT_DUENO"), e.get("TELEGRAM_CHAT_ID")
    if not chat or not token:
        falta = "TELEGRAM_CHAT_DUENO" if not chat else "TELEGRAM_BOT_TOKEN"
        print(f"::warning::Falta el secreto {falta}: el aviso al dueno no se mando (spec 061). Texto del aviso:")
        print(re.sub(r"<[^>]+>", "", texto))
        return 0
    if canal and chat.strip() == canal.strip():
        print("::warning::TELEGRAM_CHAT_DUENO es el canal publico: el aviso privado no se manda ahi (spec 061)")
        return 0
    r = publicar_telegram.pedir(token, "sendMessage", {"chat_id": chat, "text": texto, "parse_mode": "HTML",
                                                       "disable_web_page_preview": True})
    print("Aviso al dueno mandado por Telegram" if r is not None else "El aviso al dueno no salio (ver la advertencia)")
    return 0


def main(argv=None, entorno=None):
    ap = argparse.ArgumentParser(description="Aviso privado al dueno por Telegram.")
    ap.add_argument("--salud", help="salud.json que deja indexar.py")
    ap.add_argument("--indexado", default="success", help="outcome del paso de indexar (success, failure, skipped)")
    ap.add_argument("--alarma", help="alarma.md que deja guardia.js")
    ap.add_argument("--corrida-fallida", action="store_true", help="avisa que fallo la corrida (lee NECESIDADES)")
    ap.add_argument("--seco", action="store_true", help="muestra el mensaje y no manda nada")
    args = ap.parse_args(argv)
    e = os.environ if entorno is None else entorno

    partes = []
    if args.corrida_fallida:
        jobs = jobs_fallidos(e.get("NECESIDADES"))
        cuales = ", ".join(jobs) if jobs else "un paso"
        partes.append(f"🔴 <b>Fallo la corrida de «Actualizar precios y publicar»</b> ({html.escape(cuales)}). "
                      "El sitio sigue con la ultima version publicada.")
    if args.salud:
        partes.extend(lineas_salud(leer_salud(args.salud), args.indexado))
    if args.alarma:
        try:
            alarma = Path(args.alarma).read_text(encoding="utf-8")
        except OSError:
            alarma = ""
        if alarma.strip():
            partes.append("🚨 <b>Alarma de la guardia del indice</b>\n" + html.escape(resumen_alarma(alarma)))

    texto = mensaje(partes, url_corrida(e))
    if not texto:
        print("Nada que avisar al dueno")
        return 0
    if args.seco:
        print(texto)
        return 0
    return mandar(texto, e)


if __name__ == "__main__":
    sys.exit(main())
