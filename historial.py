"""Historial de precios del indice: un CSV por mes con solo los cambios.

Vive en la rama huerfana `historial` (en la Action se saca en la carpeta
historial/), asi no depende de la cache de Actions, que GitHub puede desalojar.

Columnas: fecha,tienda,id,precio. id es la URL del producto. Se escribe una
fila cuando un producto aparece o cambia de precio, y una con el precio vacio
cuando deja de publicarse: si vuelve, cuenta como nuevo y no se lo compara
contra un precio de hace meses.
"""

import csv
from collections import Counter
from pathlib import Path

CAMPOS = ["fecha", "tienda", "id", "precio"]
PATRON = "[0-9][0-9][0-9][0-9]-[0-9][0-9].csv"


def archivos(carpeta):
    carpeta = Path(carpeta)
    return sorted(carpeta.glob(PATRON)) if carpeta.is_dir() else []


def leer(carpeta):
    """Ultimo precio conocido de cada (tienda, id) que sigue publicado."""
    estado = {}
    for ruta in archivos(carpeta):
        with ruta.open(encoding="utf-8", newline="") as f:
            for fila in csv.DictReader(f):
                clave = (fila["tienda"], fila["id"])
                if fila["precio"]:
                    estado[clave] = int(fila["precio"])
                else:
                    estado.pop(clave, None)
    return estado


def vivos_por_tienda(estado):
    return Counter(tienda for tienda, _ in estado)


def cambios(estado, actuales, sanas, fecha):
    """Las filas nuevas de esta corrida.

    actuales trae solo las fuentes relevadas hoy. Las bajas se escriben solo
    para las fuentes sanas: una tienda que bloqueo a medias no borra su
    catalogo del historial.
    """
    filas = []
    for (tienda, id_), precio in sorted(actuales.items()):
        if estado.get((tienda, id_)) != precio:
            filas.append({"fecha": fecha, "tienda": tienda, "id": id_, "precio": precio})
    for (tienda, id_) in sorted(estado):
        if tienda in sanas and (tienda, id_) not in actuales:
            filas.append({"fecha": fecha, "tienda": tienda, "id": id_, "precio": ""})
    return filas


def escribir(carpeta, fecha, filas):
    """Agrega las filas al CSV del mes de `fecha`. Devuelve la ruta, o None si no habia nada."""
    if not filas:
        return None
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / (fecha[:7] + ".csv")
    nuevo = not ruta.exists()
    with ruta.open("a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS, lineterminator="\n")
        if nuevo:
            w.writeheader()
        w.writerows(filas)
    return ruta
