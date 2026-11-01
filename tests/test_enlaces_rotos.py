import json
import shutil
import tempfile
import unittest
from unittest import mock
from pathlib import Path

import enlaces_rotos as er

PAGINA = """<a href="../../">Volver</a>
<a href="https://maxtecno.com.ar/producto/rtx-3050/" target="_blank" rel="noopener" data-rubro="placa">RTX 3050</a>
<a href="https://tienda.test/a?x=1&amp;y=2" target="_blank" rel="noopener" data-rubro="memoria">A</a>
<a href="https://www.mercadolibre.com.ar/p/MLA1" target="_blank" rel="sponsored" data-rubro="memoria">ML</a>
<a href="https://articulo.mercadolibre.com.ar/MLA-2" target="_blank" rel="sponsored" data-rubro="memoria">ML 2</a>
<a href="https://pichinchadeldia.com.ar/legal/">Legal</a>
"""


class Enlaces(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        for slug in ("rtx-3050", "rtx-3050-6gb"):
            d = Path(self.tmp, "precios", slug)
            d.mkdir(parents=True)
            (d / "index.html").write_text(PAGINA, encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_toma_solo_los_enlaces_a_tiendas_sin_repetir_y_sin_mercado_libre(self):
        self.assertEqual(er.enlaces(self.tmp), ["https://maxtecno.com.ar/producto/rtx-3050/", "https://tienda.test/a?x=1&y=2"])

    def test_main_escribe_la_lista_de_rotos(self):
        salida = Path(self.tmp, "rotos.json")
        with mock.patch.object(er, "estado", lambda url, timeout=12: 404 if "rtx-3050" in url else 200):
            er.main(["--sitio", self.tmp, "--salida", str(salida)])
        self.assertEqual(json.loads(salida.read_text(encoding="utf-8")), ["https://maxtecno.com.ar/producto/rtx-3050/"])


class Revisar(unittest.TestCase):
    def test_solo_404_y_410_cuentan_como_rotos(self):
        codigos = {"https://a.test/1": 404, "https://a.test/2": 410, "https://b.test/3": 403, "https://b.test/4": 0,
                   "https://c.test/5": 200, "https://c.test/6": 500, "https://c.test/7": 429}
        rotos, revisados = er.revisar(list(codigos), pedir=codigos.get)
        self.assertEqual(rotos, ["https://a.test/1", "https://a.test/2"])
        self.assertEqual(revisados, 7)

    def test_pasado_el_tope_de_tiempo_lo_que_falta_se_publica_como_estaba(self):
        ahora = [0.0]

        def pedir(url):
            ahora[0] += 10
            return 404

        rotos, revisados = er.revisar([f"https://a.test/{i}" for i in range(10)], pedir=pedir, presupuesto=25,
                                      hilos=1, reloj=lambda: ahora[0])
        self.assertEqual(revisados, 3)
        self.assertEqual(len(rotos), 3)

    def test_intercala_las_tiendas(self):
        urls = ["https://a.test/1", "https://a.test/2", "https://a.test/3", "https://b.test/1", "https://c.test/1"]
        self.assertEqual(er.intercalar(urls), ["https://a.test/1", "https://b.test/1", "https://c.test/1",
                                               "https://a.test/2", "https://a.test/3"])

    def test_sin_respuesta_da_cero_y_no_se_toca(self):
        self.assertEqual(er.estado("http://127.0.0.1:9/no-hay-nadie", timeout=2), 0)


if __name__ == "__main__":
    unittest.main()
