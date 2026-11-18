#!/usr/bin/env python3
"""Estado de salud de cada tienda entre corridas: alta, pausa y baja AUTOMATICAS (spec 066).

Dar de baja una tienda que no existe o no tiene actividad no es una decision humana: es logica, como reparar algo
roto. Y si revive, vuelve sola. Cada corrida del indexador clasifica lo que trajo cada tienda:

    ok       trajo productos
    vacia    0 productos sin bloqueo (tambien un error de lectura o un corte de red que no se recupero)
    bloqueo  la tienda dijo que no: 403/429/503 o el desafio de Cloudflare (no se esquiva, principio III)
    muerta   el dominio no existe (NXDOMAIN) o Cloudflare dice que el origen esta caido (521/522/523/530), y el ping a
             la portada lo CONFIRMA. Un DNS temporal (EAI_AGAIN), un tiempo agotado, una conexion rechazada o un
             certificado invalido son la red (puede ser el runner): cuentan como vacia, nunca como muerta.

y con eso decide el estado, con reglas fijas:

    muerta CORRIDAS_BAJA corridas seguidas (en dias distintos)  -> baja: fuera del indice y del relevamiento
        diario; solo un ping barato (la portada) cada DIAS_PING_BAJA dias para ver si revive.
    sin productos (vacia, bloqueo o muerta) DIAS_PAUSA dias seguidos  -> pausa: sus precios viejos no se publican
        y se sigue intentando a diario.
    vuelve a traer productos  -> activa (alta) en la misma corrida.

Freno global: si en una corrida FRENO_PROPORCION (30 %) o mas de las tiendas relevadas caen por la red o por muerte,
el problema es del runner o de un bug, no de las tiendas: esa corrida no suma contadores (ver `frenar`).

El estado vive en la carpeta del historial (rama `historial`, junto a fichas.json), que es donde el indexador ya
persiste lo que tiene que sobrevivir entre corridas; el paso «Guardar el historial de precios» lo commitea.
"""

import json
import socket
import ssl
import urllib.error
from datetime import date, timedelta
from pathlib import Path

import archivos

ARCHIVO = "tiendas-salud.json"
CORRIDAS_BAJA = 3          # corridas seguidas (dias distintos) con el dominio muerto para dar de baja
DIAS_PAUSA = 14            # dias seguidos sin productos (vacia, bloqueo o muerta) para poner en pausa
DIAS_PING_BAJA = 7         # una tienda dada de baja se sondea una vez por semana
MUERTE_HTTP = (521, 522, 523, 530)   # Cloudflare: el servidor de origen esta caido o el dominio ya no apunta a nada
FRENO_PROPORCION = 0.30    # caidas por red o muerte sobre relevadas que frenan los contadores de toda la corrida
FRENO_MINIMO = 5           # con menos tiendas relevadas (una corrida --solo) no hay freno: no se distingue el runner
EAI_AGAIN = getattr(socket, "EAI_AGAIN", -3)   # DNS temporal: el resolvedor no contesto, el dominio puede existir

OK, VACIA, BLOQUEO, MUERTA = "ok", "vacia", "bloqueo", "muerta"
RED, VIVA = "red", "viva"   # lo que dice un sondeo ademas de MUERTA
ACTIVA, PAUSA, BAJA = "activa", "pausa", "baja"


def registro_nuevo():
    return {"estado": ACTIVA, "ultima": None, "ultima_corrida": None, "ultimo_ok": None,
            "sin_productos_desde": None, "muertas_seguidas": 0, "ultimo_ping": None, "cambio": None}


def _cadena(error):
    """El error, sus causas (raise ... from e) y el motivo de un URLError."""
    vistos, pendientes = [], [error]
    while pendientes:
        e = pendientes.pop()
        if e is None or any(e is v for v in vistos) or not isinstance(e, BaseException):
            continue
        vistos.append(e)
        pendientes += [e.__cause__, e.__context__]
        if isinstance(e, urllib.error.URLError) and not isinstance(e, urllib.error.HTTPError):
            pendientes.append(e.reason if isinstance(e.reason, BaseException) else None)
    return vistos


def es_muerta(error):
    """True solo si el error dice que la tienda NO EXISTE: NXDOMAIN (un gaierror que no es EAI_AGAIN) o Cloudflare con el
    origen caido (521/522/523/530). Lo demas (tiempo agotado, conexion rechazada, certificado) puede ser el runner."""
    for e in _cadena(error):
        if isinstance(e, urllib.error.HTTPError):
            return e.code in MUERTE_HTTP
        if isinstance(e, socket.gaierror):
            return e.errno != EAI_AGAIN
    return False


def es_red(error):
    """True si el error es de la red (corte, tiempo, DNS temporal, conexion, certificado) y no una respuesta."""
    cadena = _cadena(error)
    if any(isinstance(e, urllib.error.HTTPError) for e in cadena):
        return False
    return any(isinstance(e, (OSError, TimeoutError)) for e in cadena)


def sondeo(pedir, base):
    """Ping barato a la portada con `pedir(url)`: MUERTA (NXDOMAIN o 52x), RED (no se pudo saber) o VIVA (cualquier
    respuesta, un 403 tambien). None si la fuente no tiene portada."""
    if not base:
        return None
    try:
        pedir(base)
    except Exception as e:
        if es_muerta(e):
            return MUERTA
        return RED if es_red(e) else VIVA
    return VIVA


def sondear(pedir, base):
    """True si el ping confirma que la tienda esta muerta."""
    return sondeo(pedir, base) == MUERTA


def frenar(relevadas, caidas):
    """True si las caidas por red o muerte de una corrida son tantas que el problema es del runner (o un bug): esa
    corrida no suma contadores. Con pocas tiendas relevadas no se frena."""
    return relevadas >= FRENO_MINIMO and caidas >= FRENO_PROPORCION * relevadas


def clasificar(productos, motivo, muerta):
    if productos > 0:
        return OK
    if muerta:
        return MUERTA
    if motivo in ("bloqueo", "cloudflare"):
        return BLOQUEO
    return VACIA


def toca_ping(reg, hoy):
    if reg.get("estado") != BAJA:
        return False
    ultimo = reg.get("ultimo_ping")
    return not ultimo or (hoy - date.fromisoformat(ultimo)).days >= DIAS_PING_BAJA


def observar(reg, clase, hoy, detalle=""):
    """Aplica lo que trajo una corrida. Devuelve (registro nuevo, cambio o None); hay cambio solo cuando cambia el
    estado, asi cada pasaje deja un unico registro."""
    r = dict(registro_nuevo(), **(reg or {}))
    misma_fecha = r["ultima_corrida"] == hoy.isoformat()
    r["ultima"], r["ultima_corrida"] = clase, hoy.isoformat()
    if clase == OK:
        r.update(ultimo_ok=hoy.isoformat(), sin_productos_desde=None, muertas_seguidas=0)
        nuevo = ACTIVA
    else:
        r["sin_productos_desde"] = r["sin_productos_desde"] or hoy.isoformat()
        if clase == MUERTA:
            if not misma_fecha or not r["muertas_seguidas"]:     # dos corridas el mismo dia cuentan una
                r["muertas_seguidas"] += 1
        else:
            r["muertas_seguidas"] = 0
        dias = (hoy - date.fromisoformat(r["sin_productos_desde"])).days
        if r["muertas_seguidas"] >= CORRIDAS_BAJA or (r["estado"] == BAJA and clase == MUERTA):
            nuevo = BAJA
        elif dias >= DIAS_PAUSA or r["estado"] == BAJA:     # revivio el dominio sin productos: se releva, sin publicar
            nuevo = PAUSA
        else:
            nuevo = r["estado"]
    cambio = None
    if nuevo != r["estado"]:
        cambio = {"de": r["estado"], "a": nuevo, "clase": clase, "detalle": detalle,
                  "sin_productos_desde": r["sin_productos_desde"]}
        r["estado"], r["cambio"] = nuevo, hoy.isoformat()
    if r["estado"] == BAJA:
        r["ultimo_ping"] = hoy.isoformat()       # la corrida de hoy ya vio que no responde: el proximo ping, en una semana
    return r, cambio


def sembrar(claves, ultimo_ok, inicio, hoy):
    """El estado de la primera vez, sacado de la historia que ya hay: `ultimo_ok` {clave: date} es el ultimo dia con
    productos de cada tienda (el `relevado` del indice anterior o su ultimo precio en el historial); una tienda que
    no figura en ninguno de los dos no trajo nada desde que empezo el historial (`inicio`). Nadie arranca en baja:
    la muerte se mide corrida a corrida."""
    estados = {}
    for clave in claves:
        reg = registro_nuevo()
        ok = ultimo_ok.get(clave)
        if ok:
            reg["ultimo_ok"] = ok.isoformat()
            if ok < hoy:
                reg["sin_productos_desde"] = (ok + timedelta(days=1)).isoformat()
        elif inicio:
            reg["sin_productos_desde"] = inicio.isoformat()
        estados[clave] = reg
    return estados


def leer(carpeta):
    """{clave: registro}, o None si no hay archivo o esta roto (entonces se siembra)."""
    try:
        datos = json.loads((Path(carpeta) / ARCHIVO).read_text(encoding="utf-8"))
        tiendas = datos["tiendas"]
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return tiendas if isinstance(tiendas, dict) else None


def escribir(carpeta, estados, hoy):
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    texto = json.dumps({"actualizado": hoy.isoformat(), "reglas": {
        "corridas_baja": CORRIDAS_BAJA, "dias_pausa": DIAS_PAUSA, "dias_ping_baja": DIAS_PING_BAJA},
        "tiendas": dict(sorted(estados.items()))}, ensure_ascii=False, indent=1)
    archivos.escribir_atomico(carpeta / ARCHIVO, texto + "\n")
