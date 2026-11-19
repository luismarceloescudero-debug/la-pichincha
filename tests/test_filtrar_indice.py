import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path

import filtrar_indice as fi

INDICE = {"generado": "2026-10-18", "tiendas": {"cg": {"nombre": "CG"}}, "productos": [
    ["A", 1000, "https://t.test/a", "cg"], ["B", 2000, "https://t.test/b", "cg"], ["C", 3000, "https://t.test/c", "cg"]]}


def indice_grande(n_ml=60, n_cg=40):
    """Un indice lo bastante grande para que una saca chica no pase los topes de D3."""
    def filas(n, tienda, base):
        return [[f"{tienda}-{i}", base + i, f"https://t.test/{tienda}/{i}", tienda] for i in range(n)]
    return {"generado": "2026-10-18", "tiendas": {"ml": {"nombre": "ML"}, "cg": {"nombre": "CG"}},
            "productos": filas(n_ml, "ml", 1000) + filas(n_cg, "cg", 2000)}


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


class Exceso(unittest.TestCase):
    def _indice(self, n_ml=90, n_cg=10):
        def filas(n, tienda):
            return [[f"{tienda}-{i}", 1000 + i, f"https://t.test/{tienda}/{i}", tienda] for i in range(n)]
        return {"productos": filas(n_ml, "ml") + filas(n_cg, "cg")}

    def test_una_saca_chica_no_excede(self):
        self.assertIsNone(fi.exceso(self._indice(), ["https://t.test/ml/0", "https://t.test/ml/1"]))

    def test_frena_mas_del_cinco_por_ciento_del_indice(self):
        msg = fi.exceso(self._indice(100, 0), [f"https://t.test/ml/{i}" for i in range(6)])
        self.assertIn("indice", msg)

    def test_frena_mas_del_treinta_por_ciento_de_una_tienda(self):
        # 4 de 10 de 'cg' (40% de esa tienda) pero solo 4% del indice: tiene que frenar por tienda.
        msg = fi.exceso(self._indice(90, 10), [f"https://t.test/cg/{i}" for i in range(4)])
        self.assertIn("'cg'", msg)

    def test_filas_raras_no_rompen_exceso(self):
        # Filas sin el cuarto campo (tienda) no se cuentan ni rompen el chequeo por tienda.
        filas = [None, "x", [], ["sin-tienda", 1]] + \
                [[f"cg-{i}", 1000 + i, f"https://t.test/cg/{i}", "cg"] for i in range(30)]
        self.assertIsNone(fi.exceso({"productos": filas}, ["https://t.test/cg/0"]))


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.indice = os.path.join(self.dir, "indice.json")
        self.lista = os.path.join(self.dir, "descartadas.json")
        Path(self.indice).write_text(json.dumps(indice_grande()), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def productos(self):
        return [f[0] for f in json.loads(Path(self.indice).read_text(encoding="utf-8"))["productos"]]

    def test_reescribe_el_indice_sin_las_caidas(self):
        Path(self.lista).write_text(json.dumps(["https://t.test/ml/0", "https://t.test/cg/0"]), encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)
        self.assertEqual(len(self.productos()), 98)

    def test_no_reescribe_una_borradura_masiva(self):
        antes = Path(self.indice).read_text(encoding="utf-8")
        Path(self.lista).write_text(json.dumps([f"https://t.test/ml/{i}" for i in range(6)]), encoding="utf-8")
        self.assertEqual(fi.main([self.indice, self.lista]), 0)
        self.assertEqual(Path(self.indice).read_text(encoding="utf-8"), antes)

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
