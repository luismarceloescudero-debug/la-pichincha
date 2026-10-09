#!/usr/bin/env python3
"""Serie de precios de cada producto, a partir del historial, y los sellos que salen de ella.

Del historial (CSV mensual `fecha,tienda,id,precio`, solo los cambios) se reconstruye el precio de cada
dia llevando el ultimo cambio hacia adelante. Con eso, tres sellos, que van como letras en la columna
`sellos` del indice:

    m  minimo de 30 dias   (con al menos 30 dias de historia)
    h  minimo de 90 dias   (con al menos 90 dias; reemplaza a `m`)
    x  subio antes de la oferta: la ultima baja es reciente y el producto habia estado 10% o mas por
       debajo de su precio previo, sin que la baja llegue 3% por debajo de ese piso

Principio II: sin historia suficiente no se afirma nada.
"""

import csv
from datetime import date, timedelta
from pathlib import Path

import historial

DIAS_MINIMO = 30
DIAS_MINIMO_LARGO = 90
DIAS_MINIMOS_INFLADA = 14
VENTANA_BAJA = 30             # la baja tiene que ser de los ultimos 30 dias
SUBA_MINIMA = 1.10            # el precio previo era 10% o mas que el piso
TOLERANCIA_PISO = 0.97        # la baja no pasa 3% por debajo del piso


def cargar(carpeta):
    """{(tienda, id): [(fecha, precio o None)]} de todos los CSV del historial, en orden."""
    series = {}
    for ruta in historial.archivos(carpeta):
        with Path(ruta).open(encoding="utf-8", newline="") as f:
            for fila in csv.DictReader(f):
                precio = int(fila["precio"]) if fila["precio"] else None
                series.setdefault((fila["tienda"], fila["id"]), []).append(
                    (date.fromisoformat(fila["fecha"]), precio))
    for eventos in series.values():
        eventos.sort(key=lambda e: e[0])
    return series


def precio_el(eventos, dia):
    """Precio vigente al final de `dia`, o None si todavia no estaba o ya no se publicaba."""
    vigente = None
    for fecha, precio in eventos:
        if fecha > dia:
            break
        vigente = precio
    return vigente


def _tramo_actual(eventos):
    """Los eventos desde la ultima vez que el producto aparecio: si dejo de publicarse y volvio, cuenta
    como nuevo (igual que en el historial)."""
    inicio = 0
    for i, (_, precio) in enumerate(eventos):
        if precio is None:
            inicio = i + 1
    return eventos[inicio:]


def dias_de_historia(eventos, hoy):
    tramo = _tramo_actual(eventos)
    return (hoy - tramo[0][0]).days if tramo else 0


def _minimo(eventos, hoy, dias, precio_hoy):
    """El menor precio de los ultimos `dias` dias, contando el de hoy."""
    precios = [precio_el(eventos, hoy - timedelta(days=n)) for n in range(1, dias + 1)]
    return min([p for p in precios if p is not None] + [precio_hoy])


def _inflada(eventos, hoy):
    if len(eventos) < 2 or eventos[-1][1] is None or eventos[-2][1] is None:
        return False
    fecha_baja, precio = eventos[-1]
    previo = eventos[-2][1]
    if precio >= previo or (hoy - fecha_baja).days > VENTANA_BAJA:
        return False
    antes = [precio_el(eventos, fecha_baja - timedelta(days=n)) for n in range(1, VENTANA_BAJA + 1)]
    antes = [p for p in antes if p is not None]
    if not antes:
        return False
    piso = min(antes)
    return previo >= piso * SUBA_MINIMA and precio >= piso * TOLERANCIA_PISO


def sellos_de(eventos, hoy, precio_hoy):
    """Letras de sello de un producto. `eventos` es su serie hasta la ultima corrida; `precio_hoy`, el
    precio relevado hoy, que todavia no esta en el historial."""
    tramo = _tramo_actual(eventos)
    if not tramo:
        return ""
    if tramo[-1][1] != precio_hoy:
        tramo = tramo + [(hoy, precio_hoy)]
    dias = dias_de_historia(tramo, hoy)
    letras = ""
    if dias >= DIAS_MINIMO_LARGO and precio_hoy <= _minimo(tramo, hoy, DIAS_MINIMO_LARGO, precio_hoy):
        letras += "h"
    elif dias >= DIAS_MINIMO and precio_hoy <= _minimo(tramo, hoy, DIAS_MINIMO, precio_hoy):
        letras += "m"
    if dias >= DIAS_MINIMOS_INFLADA and _inflada(tramo, hoy):
        letras += "x"
    return letras
