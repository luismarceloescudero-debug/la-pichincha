import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import filtrar_indice as fi

INDICE = {"generado": "2026-10-18", "tiendas": {"cg": {"nombre": "CG"}}, "productos": [
    ["A", 1000, "https://t.test/a", "cg"], ["B", 2000, "https://t.test/b", "cg"], ["C", 3000, "https://t.test/c", "cg"]]}


class Filtrar(unittest.TestCase):
    def test_saca_las_filas_caidas_y_no_toca_el_original(self):
        nuevo, sacadas = fi.filtrar(INDICE, ["https://t.test/b"])
        self.assertEqual([f[0] for f in nuevo["productos"]], ["A", "C"])
        self.assertEqual(sacadas, 1)
        self.assertEqual(len(INDICE["productos"]), 3)
        self.assertEqual(nuevo["generado"], "2026-10-18")

    def test_filas_raras_no_rompen(self):
        nuevo, sacadas = fi.filtrar({"productos": [None, "x", [], ["A", 1]]}, ["https://t.test/a"])
        self.assertEqual(sacadas, 0)
        self.assertEqual(len(nuevo["productos"]), 4)


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.indice = os.path.join(self.dir, "indice.json")
        self.lista = os.path.join(self.dir, "descartadas.json")
        Path(self.indice).write_text(json.dumps(INDICE), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def productos(self):
        return [f[0] for f in json.loads(Path(self.indice).read_text(encoding="utf-8"))["productos"]]

    def test_reescribe_el_indice_sin_las_caidas(self):
        Path(self.lista).write_text(json.dumps(["https://t.test/a", "https://t.test/c"]), encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)
        self.assertEqual(self.productos(), ["B"])

    def test_sin_lista_o_con_lista_rota_o_vacia_no_toca_nada(self):
        antes = Path(self.indice).read_text(encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)                   # no existe
        Path(self.lista).write_text("{roto", encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)
        Path(self.lista).write_text("[]", encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)
        self.assertEqual(Path(self.indice).read_text(encoding="utf-8"), antes)

    def test_un_indice_roto_no_falla(self):
        Path(self.indice).write_text("{roto", encoding="utf-8")
        Path(self.lista).write_text(json.dumps(["https://t.test/a"]), encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)


if __name__ == "__main__":
    unittest.main()
