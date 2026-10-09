import json
import shutil
import tempfile
import unittest
from pathlib import Path

import generar_paginas


class Slug(unittest.TestCase):
    def test_minusculas_sin_acentos_y_con_guiones(self):
        self.assertEqual(generar_paginas.slug('Monitor 27" 144hz'), "monitor-27-144hz")
        self.assertEqual(generar_paginas.slug("Placa de video Ñandú"), "placa-de-video-nandu")
        self.assertEqual(generar_paginas.slug("  SSD   1TB  "), "ssd-1tb")
        self.assertEqual(generar_paginas.slug("rtx 4060+ti / 8gb"), "rtx-4060-ti-8gb")

    def test_solo_letras_numeros_y_guiones(self):
        self.assertRegex(generar_paginas.slug("a&b#c%d?e=f"), r"^[a-z0-9-]+$")

    def test_sin_nada_que_usar_es_un_error(self):
        with self.assertRaises(ValueError):
            generar_paginas.slug("¿¿??")


class CargarConsultas(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)

    def escribir(self, datos):
        ruta = self.dir / "consultas.json"
        ruta.write_text(json.dumps(datos), encoding="utf-8")
        return ruta

    def test_devuelve_consulta_nota_y_slug(self):
        ruta = self.escribir([{"q": "ssd 1tb", "nota": "170 avisos"}, {"q": "RTX 4060"}])
        self.assertEqual(generar_paginas.cargar_consultas(ruta), [
            {"q": "ssd 1tb", "nota": "170 avisos", "slug": "ssd-1tb"},
            {"q": "RTX 4060", "nota": "", "slug": "rtx-4060"}])

    def test_dos_consultas_con_el_mismo_slug_nombran_a_las_dos(self):
        ruta = self.escribir([{"q": "ssd 1tb"}, {"q": "SSD  1TB"}])
        with self.assertRaises(ValueError) as e:
            generar_paginas.cargar_consultas(ruta)
        self.assertIn("ssd 1tb", str(e.exception))
        self.assertIn("SSD  1TB", str(e.exception))

    def test_largo_de_la_consulta(self):
        for q in ("a", "x" * 61, ""):
            with self.subTest(q=q[:8]), self.assertRaises(ValueError):
                generar_paginas.cargar_consultas(self.escribir([{"q": q}]))

    def test_entrada_sin_q_o_archivo_invalido(self):
        with self.assertRaises(ValueError):
            generar_paginas.cargar_consultas(self.escribir([{"nota": "sin consulta"}]))
        with self.assertRaises(ValueError):
            generar_paginas.cargar_consultas(self.escribir({"q": "no es una lista"}))
