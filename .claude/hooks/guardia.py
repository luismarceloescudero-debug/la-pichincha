#!/usr/bin/env python3
"""Freno antes de cada comando Bash/PowerShell (hook PreToolUse de Claude Code).

Reglas fijas del proyecto que antes cuidaba solo la memoria del modelo:
- Publicar (Telegram, Instagram) o disparar un workflow es decision del dueño: se pide confirmacion.
- Los mensajes de commit van sin tildes ni eñes (compatibilidad de consola): se frena el commit.
- Editar a mano un archivo generado (`package-lock.json`, lo de `_sitio/`) pide confirmacion: se regenera con npm o con
  `tests/e2e/armar-sitio.sh`. `datos.json` y `consultas.json` NO entran: llevan datos curados a mano.

Lee el JSON del hook por stdin y, si no aplica ninguna regla, no dice nada (el comando sigue).
Solo stdlib.
"""

import json
import re
import sys

PUBLICAR = [
    (re.compile(r"\bgh\s+workflow\s+run\b"), "dispara un workflow de GitHub (puede publicar en Telegram)"),
    (re.compile(r"(?<!\w)publicar_telegram\.py\b"), "corre el publicador de Telegram"),
    (re.compile(r"api\.telegram\.org"), "habla directo con la API de Telegram"),
    (re.compile(r"graph\.(?:facebook|instagram)\.com"), "habla directo con la API de Instagram"),
]
COMMIT = re.compile(r"\bgit\b(?:\s+-\S+(?:\s+\S+)?)*\s+commit\b")
TILDES = re.compile(r"[áéíóúüñÁÉÍÓÚÜÑ]")


GENERADOS = re.compile(r"(?:^|[\\/])(?:package-lock\.json|_sitio[\\/].+)$")


def decidir_archivo(ruta):
    """Para Edit/Write: ('ask', motivo) si el archivo es generado, o None."""
    if GENERADOS.search(ruta or ""):
        return "ask", ("Este archivo se genera (npm o armar-sitio.sh), no se edita a mano. Confirmá solo si el dueño "
                       "lo pidio; si no, regeneralo con su comando.")
    return None


def decidir(comando):
    """Devuelve (decision, motivo) o None si el comando puede seguir sin preguntar."""
    if COMMIT.search(comando):
        letras = sorted(set(TILDES.findall(comando)))
        if letras:
            return "deny", ("Mensaje de commit con tildes o eñes (" + " ".join(letras) + "): la regla del "
                            "proyecto es sin tildes. Reescribilo sin esas letras.")
    for patron, que in PUBLICAR:
        if patron.search(comando):
            return "ask", ("Este comando " + que + ". Publicar o disparar workflows es decision del dueño: "
                           "confirmá solo si lo pidió en esta conversacion.")
    return None


def main():
    try:
        datos = json.load(sys.stdin)
    except ValueError:
        return 0
    entrada = datos.get("tool_input") or {}
    resultado = decidir(entrada["command"]) if entrada.get("command") else decidir_archivo(entrada.get("file_path"))
    if resultado:
        decision, motivo = resultado
        json.dump({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": decision,
                                          "permissionDecisionReason": motivo}}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
