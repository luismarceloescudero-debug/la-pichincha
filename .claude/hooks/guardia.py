#!/usr/bin/env python3
"""Freno antes de cada comando Bash/PowerShell (hook PreToolUse de Claude Code).

Reglas fijas del proyecto que antes cuidaba solo la memoria del modelo:
- Publicar (Telegram, Instagram) o disparar un workflow es decision del dueño: se pide confirmacion.
- Los mensajes de commit van sin tildes ni eñes (compatibilidad de consola): se frena el commit.
- Borrar historia (`git push --force`, `git reset --hard`) o tocar archivos de secretos (`.env*`, `.dev.vars`) pide confirmacion.
- Editar a mano un archivo generado (`package-lock.json`, lo de `_sitio/`) pide confirmacion: se regenera con npm o con
  `tests/e2e/armar-sitio.sh`. `datos.json` y `consultas.json` (datos curados a mano) tambien piden confirmacion: un error
  ahi rompe el sitio y la CI se entera tarde.

«Omitir permisos» (04/11, pedido del dueño): si la sesion corre en ese modo (`permission_mode` = `bypassPermissions`)
o la variable `PICHINCHA_GUARDIA=omitir` esta puesta, lo que solo pedia confirmacion (workflows, Telegram, generados)
sigue sin preguntar. Lo que se frena (tildes, historia, secretos) se sigue frenando, e Instagram sigue preguntando
siempre: esta en pausa hasta que el dueño apruebe la app.

Trabajo en la app (04/11, pedido del dueño): mirar, buscar, testear y armar el sitio local no preguntan nunca, aunque el
comando nombre a Telegram o a un workflow (`grep publicar_telegram.py`, `node --test`, `python -m unittest`,
`npx playwright test`, `bash tests/e2e/armar-sitio.sh`, `gh run view`...). Editar lo de `_sitio/` (el sitio armado en
local, que no se sube) tampoco pregunta.

Lee el JSON del hook por stdin y, si no aplica ninguna regla, no dice nada (el comando sigue).
Solo stdlib.
"""

import json
import os
import re
import subprocess
import sys

PUBLICAR = [
    (re.compile(r"\bgh\s+workflow\s+run\b"), "dispara un workflow de GitHub (puede publicar en Telegram)"),
    (re.compile(r"(?<!\w)publicar_telegram\.py\b"), "corre el publicador de Telegram"),
    (re.compile(r"api\.telegram\.org"), "habla directo con la API de Telegram"),
    (re.compile(r"graph\.(?:facebook|instagram)\.com"), "habla directo con la API de Instagram"),
]
COMMIT = re.compile(r"\bgit\b(?:\s+-\S+(?:\s+\S+)?)*\s+commit\b")
TILDES = re.compile(r"[áéíóúüñÁÉÍÓÚÜÑ]")


DESTRUCTIVOS = [
    (re.compile(r"\bgit\b[^|;&\n]*\bpush\b[^|;&\n]*(?:--force\b|--force-with-lease\b|\s-f\b)"), "push con --force/-f borra historia del remoto de forma irreversible"),
    (re.compile(r"\bgit\b[^|;&\n]*\bpush\b[^|;&\n]*\borigin\s+main(?![-\w])"), "push directo a main (usa una rama y un PR)"),
    (re.compile(r"\bgit\b[^|;&\n]*\breset\b[^|;&\n]*--hard\b"), "reset --hard descarta cambios sin commitear de forma irreversible"),
]
SECRETOS = re.compile(r"(?:^|[\\/])(?:\.env(?:\.[^\\/]*)?|\.dev\.vars)$")
GENERADOS = re.compile(r"(?:^|[\\/])package-lock\.json$")
CURADOS = re.compile(r"(?:^|[\\/])(?:datos|consultas)\.json$")

# Cada tramo del comando (separado por ; && || |) empieza con algo que solo mira, busca, testea o arma en local.
TRABAJO = re.compile(r"^\s*(?:cd|ls|cat|head|tail|wc|grep|rg|find|echo|printf|sort|uniq|less|diff|"
                     r"sed\s+-n|git\s+(?:status|diff|log|show|grep|fetch|branch)|"
                     r"node\s+--test|python3?\s+-m\s+(?:unittest|pytest)|npx\s+playwright\s+test|npm\s+(?:ci|test)|"
                     r"bash\s+tests/e2e/armar-sitio\.sh|gh\s+(?:run\s+(?:view|list|watch)|pr\s+(?:view|checks|list)|workflow\s+(?:view|list)))\b")


MERGE = re.compile(r"\bgh\s+pr\s+merge\s+(\d+)")
WATCH_Y_MERGE = re.compile(r"\bgh\s+pr\s+checks\b[^;|\n]*--watch\b[^;|\n]*&&[^;|\n]*\bgh\s+pr\s+merge\b")
WATCH_CON_TUBERIA = re.compile(r"\bgh\s+pr\s+checks\b[^|;&\n]*--watch\b[^;&\n]*\|")
WORKFLOW = re.compile(r"(?:^|[\\/])\.github[\\/]workflows[\\/][^\\/]+\.ya?ml$")
MCP_JSON = re.compile(r"(?:^|[\\/])\.mcp\.json$")


def checks_no_verdes(numero):
    """Estados de los checks del PR que no son pass/skipping; None si no se pudo consultar (no frena)."""
    try:
        r = subprocess.run(["gh", "pr", "checks", numero], capture_output=True, text=True, timeout=25)
    except (OSError, subprocess.SubprocessError):
        return None
    estados = [c.split("\t")[1].strip().lower() for c in r.stdout.splitlines() if "\t" in c]
    return [e for e in estados if e not in ("pass", "skipping")] if estados else None


def es_trabajo(comando):
    """True si todo el comando es trabajo en la app: mirar, buscar, testear o armar el sitio local."""
    tramos = [t for t in re.split(r"&&|\|\||;|\||\n", comando or "") if t.strip()]
    return bool(tramos) and all(TRABAJO.match(t) for t in tramos)


def decidir_contenido(ruta, texto):
    """Para Edit/Write: ('deny', motivo) si .mcp.json llevaria npx o @latest (version sin fijar)."""
    if MCP_JSON.search(ruta or "") and re.search(r"@latest\b|\"npx\"", texto or ""):
        return "deny", "Bloqueado: .mcp.json con npx o @latest. Los MCP van con la version fija (uv o npm con numero)."
    return None


def decidir_archivo(ruta):
    """Para Edit/Write: ('ask', motivo) si el archivo es generado o curado a mano, o None."""
    if SECRETOS.search(ruta or ""):
        return "deny", "Bloqueado: este archivo guarda secretos (.env / .dev.vars). No se edita; pediselo al dueño."
    if WORKFLOW.search(ruta or ""):
        return "ask", ("Cambio de workflow: tiene que haber un test que lo cubra en tests/test_workflows.py y conviene "
                       "correr actionlint. Confirmá si ya lo pensaste.")
    if GENERADOS.search(ruta or ""):
        return "ask", ("Este archivo se genera (npm o armar-sitio.sh), no se edita a mano. Confirmá solo si el dueño "
                       "lo pidio; si no, regeneralo con su comando.")
    if CURADOS.search(ruta or ""):
        return "ask", ("Este archivo lleva datos curados a mano (tiendas o consultas): un error aca rompe el sitio y "
                       "la CI se entera tarde. Confirmá solo si es un cambio puntual que ya revisaste.")
    return None


def decidir(comando, verificar=checks_no_verdes):
    """Devuelve (decision, motivo) o None si el comando puede seguir sin preguntar."""
    if COMMIT.search(comando):
        letras = sorted(set(TILDES.findall(comando)))
        if letras:
            return "deny", ("Mensaje de commit con tildes o eñes (" + " ".join(letras) + "): la regla del "
                            "proyecto es sin tildes. Reescribilo sin esas letras.")
    for patron, que in DESTRUCTIVOS:
        if patron.search(comando):
            return "deny", "Bloqueado: " + que + ". Solo el dueño puede pedirlo directamente."
    if WATCH_CON_TUBERIA.search(comando):
        return "deny", ("Bloqueado: `gh pr checks --watch` con tuberia. El codigo de salida es el del ultimo comando y "
                        "se puede mergear con un check pending. Correlo sin tuberia.")
    m = MERGE.search(comando)
    if m and not WATCH_Y_MERGE.search(comando):
        malos = verificar(m.group(1))
        if malos:
            return "deny", ("Bloqueado: el PR " + m.group(1) + " tiene checks sin verde (" + ", ".join(sorted(set(malos))) +
                            "). Esperalos con `gh pr checks " + m.group(1) + " --watch` y recien ahi mergea.")
    if es_trabajo(comando):
        return None
    for patron, que in PUBLICAR:
        if patron.search(comando):
            return "ask", ("Este comando " + que + ". Publicar o disparar workflows es decision del dueño: "
                           "confirmá solo si lo pidió en esta conversacion.")
    return None


INSTAGRAM = re.compile(r"graph\.(?:facebook|instagram)\.com")


def omitir(datos, comando=""):
    """True si el dueño dijo «Omitir permisos»: la sesion en ese modo o la variable PICHINCHA_GUARDIA=omitir.
    Instagram no se omite nunca."""
    if INSTAGRAM.search(comando or ""):
        return False
    return datos.get("permission_mode") == "bypassPermissions" or os.environ.get("PICHINCHA_GUARDIA", "").lower() == "omitir"


def main():
    try:
        datos = json.load(sys.stdin)
    except ValueError:
        return 0
    entrada = datos.get("tool_input") or {}
    if entrada.get("command"):
        resultado = decidir(entrada["command"])
    else:
        resultado = (decidir_archivo(entrada.get("file_path"))
                     or decidir_contenido(entrada.get("file_path"), entrada.get("content") or entrada.get("new_string")))
    if resultado:
        decision, motivo = resultado
        if decision == "ask" and omitir(datos, entrada.get("command")):
            return 0
        json.dump({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": decision,
                                          "permissionDecisionReason": motivo}}, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
