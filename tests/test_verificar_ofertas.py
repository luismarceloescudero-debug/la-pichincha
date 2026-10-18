import io
import json
import os
import shutil
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import verificar_ofertas as v

OFERTAS = {"ofertas": [{"url": "https://t.test/a"}, {"url": "https://t.test/b"}, {"url": "https://t.test/c"}]}


class Veredicto(unittest.TestCase):
    def test_un_404_o_un_410_es_una_publicacion_caida(self):
        self.assertEqual(v.veredicto(404, ""), "caida")
        self.assertEqual(v.veredicto(410, ""), "caida")

    def test_el_cartel_de_mercado_libre_es_una_publicacion_caida(self):
        self.assertEqual(v.veredicto(200, "<h2>Este producto no está disponible</h2><p>Elige otra variante.</p>"), "caida")
        self.assertEqual(v.veredicto(200, "ESTE PRODUCTO NO ESTA DISPONIBLE"), "caida")
        self.assertEqual(v.veredicto(200, "<span>Publicación pausada</span>"), "caida")
        self.assertEqual(v.veredicto(200, "<span>Publicación finalizada</span>"), "caida")

    def test_una_pagina_normal_esta_viva(self):
        self.assertEqual(v.veredicto(200, "<h1>Notebook Hp Omen</h1><button>Comprar ahora</button>"), "viva")

    def test_una_frase_suelta_con_no_esta_disponible_no_alcanza(self):
        # "Retiro en sucursal no está disponible" es de una pagina que sigue vendiendo.
        self.assertEqual(v.veredicto(200, "Retiro en sucursal no está disponible. Envío a domicilio: $3.000"), "viva")

    def test_un_bloqueo_o_un_error_del_servidor_no_prueba_nada(self):
        for estado in (401, 403, 429, 500, 503):
            self.assertEqual(v.veredicto(estado, "Este producto no está disponible"), "dudosa", estado)


class Revisar(unittest.TestCase):
    def test_un_fallo_de_red_no_descarta_el_enlace(self):
        with mock.patch.object(v, "bajar", side_effect=urllib.error.URLError("sin red")):
            self.assertEqual(v.revisar("https://t.test/a"), "dudosa")
        with mock.patch.object(v, "bajar", side_effect=TimeoutError()):
            self.assertEqual(v.revisar("https://t.test/a"), "dudosa")

    def test_solo_se_abren_enlaces_http_o_https(self):
        with mock.patch.object(v, "bajar") as bajar:
            self.assertEqual(v.revisar("file:///etc/passwd"), "dudosa")
            self.assertEqual(v.revisar("ftp://t.test/a"), "dudosa")
            bajar.assert_not_called()

    def test_un_http_error_se_juzga_por_su_codigo(self):
        error = urllib.error.HTTPError("https://t.test/a", 404, "no", {}, None)
        with mock.patch.object(v, "bajar", side_effect=error):
            self.assertEqual(v.revisar("https://t.test/a"), "caida")


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.ofertas = os.path.join(self.dir, "ofertas.json")
        self.descartadas = os.path.join(self.dir, "descartadas.json")
        Path(self.ofertas).write_text(json.dumps(OFERTAS), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def correr(self, juicios):
        with mock.patch.object(v, "revisar", side_effect=lambda u: juicios[u]), redirect_stdout(io.StringIO()) as salida:
            codigo = v.main([self.ofertas, "--descartadas", self.descartadas])
        return codigo, salida.getvalue()

    def test_guarda_las_caidas_y_avisa_con_el_codigo_3(self):
        codigo, salida = self.correr({"https://t.test/a": "viva", "https://t.test/b": "caida", "https://t.test/c": "dudosa"})
        self.assertEqual(codigo, 3)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")), ["https://t.test/b"])
        self.assertIn("1 caída", salida)

    def test_si_no_hay_caidas_sale_con_0_y_no_toca_lo_anterior(self):
        Path(self.descartadas).write_text(json.dumps(["https://t.test/vieja"]), encoding="utf-8")
        codigo, _ = self.correr({u["url"]: "viva" for u in OFERTAS["ofertas"]})
        self.assertEqual(codigo, 0)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")), ["https://t.test/vieja"])

    def test_suma_a_las_descartadas_de_la_ronda_anterior_sin_repetir(self):
        Path(self.descartadas).write_text(json.dumps(["https://t.test/vieja", "https://t.test/b"]), encoding="utf-8")
        codigo, _ = self.correr({"https://t.test/a": "caida", "https://t.test/b": "caida", "https://t.test/c": "viva"})
        self.assertEqual(codigo, 3)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")),
                         ["https://t.test/vieja", "https://t.test/b", "https://t.test/a"])

    def test_sin_ofertas_json_no_falla(self):
        os.remove(self.ofertas)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(v.main([self.ofertas, "--descartadas", self.descartadas]), 0)

    def test_si_todas_quedan_dudosas_lo_dice(self):
        _, salida = self.correr({u["url"]: "dudosa" for u in OFERTAS["ofertas"]})
        self.assertIn("no se pudo confirmar", salida)


if __name__ == "__main__":
    unittest.main()
