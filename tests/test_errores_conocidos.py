"""El registro docs/errores-conocidos.md no puede mentir: cada guardia citada tiene que existir."""
import re
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REGISTRO = RAIZ / "docs" / "errores-conocidos.md"


def filas(texto):
    """Devuelve (id, guardia) de cada fila E## de la tabla."""
    salida = []
    for linea in texto.splitlines():
        celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
        if len(celdas) >= 5 and re.fullmatch(r"E\d+", celdas[0]):
            salida.append((celdas[0], celdas[4].strip("`")))
    return salida


class ErroresConocidos(unittest.TestCase):
    def test_hay_filas(self):
        self.assertGreaterEqual(len(filas(REGISTRO.read_text(encoding="utf-8"))), 6)

    def test_cada_fila_tiene_una_guardia_que_existe(self):
        for id_, guardia in filas(REGISTRO.read_text(encoding="utf-8")):
            with self.subTest(id_):
                self.assertIn("::", guardia, f"{id_}: la guardia tiene que ser ruta::fragmento")
                ruta, fragmento = guardia.split("::", 1)
                archivo = RAIZ / ruta
                self.assertTrue(archivo.is_file(), f"{id_}: no existe {ruta}")
                self.assertIn(fragmento, archivo.read_text(encoding="utf-8"),
                              f"{id_}: {ruta} ya no contiene «{fragmento}»")

    def test_los_ids_no_se_repiten(self):
        ids = [i for i, _ in filas(REGISTRO.read_text(encoding="utf-8"))]
        self.assertEqual(len(ids), len(set(ids)))


if __name__ == "__main__":
    unittest.main()
