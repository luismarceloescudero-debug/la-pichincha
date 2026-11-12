import json
import os
import tempfile
import unittest
from pathlib import Path

import archivos


class EscrituraAtomica(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_escribe_y_reemplaza(self):
        ruta = self.dir / "indice.json"
        archivos.escribir_atomico(ruta, '{"a":1}')
        archivos.escribir_atomico(ruta, '{"a":2}')
        self.assertEqual(json.loads(ruta.read_text(encoding="utf-8")), {"a": 2})

    def test_no_deja_temporales(self):
        archivos.escribir_atomico(self.dir / "x.json", "{}")
        self.assertEqual([p.name for p in self.dir.iterdir()], ["x.json"])

    def test_si_falla_a_la_mitad_el_archivo_viejo_queda_intacto(self):
        ruta = self.dir / "indice.json"
        archivos.escribir_atomico(ruta, '{"viejo":true}')
        original = os.replace

        def falla(*a, **k):
            raise OSError("corte")
        os.replace = falla
        try:
            with self.assertRaises(OSError):
                archivos.escribir_atomico(ruta, '{"nuevo":true}')
        finally:
            os.replace = original
        self.assertEqual(ruta.read_text(encoding="utf-8"), '{"viejo":true}')
        self.assertEqual([p.name for p in self.dir.iterdir()], ["indice.json"])

    def test_una_excepcion_al_serializar_no_toca_el_destino(self):
        ruta = self.dir / "indice.json"
        archivos.escribir_atomico(ruta, '{"viejo":true}')
        with self.assertRaises(TypeError):
            archivos.escribir_atomico(ruta, json.dumps({"x": object()}))
        self.assertEqual(ruta.read_text(encoding="utf-8"), '{"viejo":true}')


if __name__ == "__main__":
    unittest.main()
