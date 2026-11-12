"""Escritura atomica de archivos publicados (plan v4, auditoria A7).

Se escribe en un archivo temporal de la MISMA carpeta y recien despues se reemplaza el destino con `os.replace`,
que es una sola operacion del sistema: quien lee ve el archivo viejo entero o el nuevo entero, nunca la mitad.
Si algo falla antes del reemplazo, el destino queda como estaba y el temporal se borra.
"""
import os
import tempfile
from pathlib import Path


def escribir_atomico(ruta, texto, encoding="utf-8"):
    ruta = Path(ruta)
    fd, tmp = tempfile.mkstemp(dir=ruta.parent, prefix=ruta.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding=encoding, newline="") as f:
            f.write(texto)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, ruta)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
