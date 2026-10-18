import http.server
import io
import json
import os
import shutil
import tempfile
import threading
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

    def test_el_cartel_con_la_codificacion_mal_leida_tambien_cuenta(self):
        self.assertEqual(v.veredicto(200, "Este producto no estÃ¡ disponible"), "caida")
        self.assertEqual(v.veredicto(200, "PublicaciÃ³n pausada"), "caida")

    def test_una_pagina_normal_esta_viva(self):
        self.assertEqual(v.veredicto(200, "<h1>Notebook Hp Omen</h1><button>Comprar ahora</button>"), "viva")

    def test_una_frase_suelta_con_no_esta_disponible_no_alcanza(self):
        # "Retiro en sucursal no está disponible" es de una pagina que sigue vendiendo.
        self.assertEqual(v.veredicto(200, "Retiro en sucursal no está disponible. Envío a domicilio: $3.000"), "viva")

    def test_un_bloqueo_o_un_error_del_servidor_no_prueba_nada(self):
        for estado in (401, 403, 429, 500, 503):
            self.assertEqual(v.veredicto(estado, "Este producto no está disponible"), "dudosa", estado)


class Estatica(unittest.TestCase):
    def test_un_fallo_de_red_no_descarta_el_enlace(self):
        with mock.patch.object(v, "bajar", side_effect=urllib.error.URLError("sin red")):
            self.assertEqual(v.estatica("https://t.test/a"), "dudosa")
        with mock.patch.object(v, "bajar", side_effect=TimeoutError()):
            self.assertEqual(v.estatica("https://t.test/a"), "dudosa")

    def test_solo_se_abren_enlaces_http_o_https(self):
        with mock.patch.object(v, "bajar") as bajar:
            self.assertEqual(v.estatica("file:///etc/passwd"), "dudosa")
            self.assertEqual(v.estatica("ftp://t.test/a"), "dudosa")
            bajar.assert_not_called()

    def test_un_http_error_se_juzga_por_su_codigo(self):
        error = urllib.error.HTTPError("https://t.test/a", 404, "no", {}, None)
        with mock.patch.object(v, "bajar", side_effect=error):
            self.assertEqual(v.estatica("https://t.test/a"), "caida")

    def test_el_dato_estructurado_de_sin_stock_es_una_caida(self):
        pagina = '<script type="application/ld+json">{"offers":{"availability":"https://schema.org/OutOfStock"}}</script>'
        self.assertEqual(v.veredicto(200, pagina), "caida")
        en_stock = pagina.replace("OutOfStock", "InStock")
        self.assertEqual(v.veredicto(200, en_stock), "viva")


class Revisar(unittest.TestCase):
    """Las dos revisiones juntas: alcanza con que una marque la publicacion como caida."""

    def revisar(self, estatica, dom):
        with mock.patch.object(v, "estatica", return_value=estatica), mock.patch.object(v, "renderizar", return_value=dom):
            return v.revisar("https://t.test/a")

    def test_el_cartel_que_arma_el_javascript_solo_lo_ve_la_revision_renderizada(self):
        # Mercado Libre: el HTML que baja la primera revision no trae el cartel; el navegador si.
        self.assertEqual(self.revisar("viva", "<div>Este producto no está disponible. Elige otra variante.</div>"),
                         ("caida", "renderizada"))

    def test_si_la_estatica_ya_dice_caida_no_se_abre_el_navegador(self):
        with mock.patch.object(v, "estatica", return_value="caida"), mock.patch.object(v, "renderizar") as abrir:
            self.assertEqual(v.revisar("https://t.test/a"), ("caida", "estatica"))
            abrir.assert_not_called()

    def test_en_pie_en_las_dos(self):
        self.assertEqual(self.revisar("viva", "<h1>Notebook</h1><button>Comprar</button>"), ("viva", "renderizada"))

    def test_sin_navegador_queda_lo_que_dijo_la_estatica(self):
        self.assertEqual(self.revisar("viva", None), ("viva", "estatica"))
        self.assertEqual(self.revisar("dudosa", None), ("dudosa", "estatica"))

    def test_una_pagina_de_captcha_no_prueba_nada(self):
        self.assertEqual(self.revisar("viva", "<title>Captcha</title> Este producto no está disponible"), ("viva", "estatica"))

    def test_si_la_estatica_estaba_bloqueada_y_el_navegador_ve_la_pagina_normal_esta_viva(self):
        self.assertEqual(self.revisar("dudosa", "<h1>Notebook</h1>"), ("viva", "renderizada"))

    def test_pasado_el_presupuesto_no_se_abren_mas_navegadores(self):
        with mock.patch.object(v, "estatica", return_value="viva"), mock.patch.object(v, "renderizar") as abrir:
            self.assertEqual(v.revisar("https://t.test/a", desde=0), ("viva", "estatica"))   # desde=0: hace muchisimo
            abrir.assert_not_called()


class Navegador(unittest.TestCase):
    def test_sin_navegador_renderizar_devuelve_none(self):
        with mock.patch.object(v, "navegador", return_value=None):
            self.assertIsNone(v.renderizar("https://t.test/a"))

    def test_un_navegador_que_se_cuelga_o_falla_devuelve_none(self):
        with mock.patch.object(v, "navegador", return_value="/usr/bin/chrome"):
            with mock.patch.object(v.subprocess, "run", side_effect=v.subprocess.TimeoutExpired("chrome", 1)):
                self.assertIsNone(v.renderizar("https://t.test/a"))
            with mock.patch.object(v.subprocess, "run", side_effect=OSError("no existe")):
                self.assertIsNone(v.renderizar("https://t.test/a"))

    def test_solo_abre_enlaces_http_o_https(self):
        with mock.patch.object(v, "navegador", return_value="/usr/bin/chrome"), mock.patch.object(v.subprocess, "run") as correr:
            self.assertIsNone(v.renderizar("file:///etc/passwd"))
            correr.assert_not_called()


@unittest.skipUnless(v.navegador(), "no hay Chrome en este entorno")
class ConChromeReal(unittest.TestCase):
    """Una pagina que arma el cartel con JavaScript, como Mercado Libre: la revision estatica la ve en pie y la
    renderizada la ve caida."""

    PAGINAS = {
        "/caida": "<html><body><div id=a>Cargando...</div><script>setTimeout(()=>{document.getElementById('a').textContent="
                  "['Este producto','no esta','disponible.'].join(' ')},300)</script></body></html>",
        "/viva": "<html><body><h1>Notebook</h1><script>document.body.append(' Comprar ahora')</script></body></html>",
    }

    @classmethod
    def setUpClass(cls):
        paginas = cls.PAGINAS

        class Manejador(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                cuerpo = paginas.get(self.path.split("?")[0], "").encode("utf-8")
                self.send_response(200 if cuerpo else 404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(cuerpo)

            def log_message(self, *a):
                pass

        cls.servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Manejador)
        cls.base = f"http://127.0.0.1:{cls.servidor.server_address[1]}"
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()

    def test_el_cartel_armado_por_javascript_se_detecta_solo_en_el_navegador(self):
        self.assertEqual(v.estatica(self.base + "/caida"), "viva")
        self.assertEqual(v.revisar(self.base + "/caida"), ("caida", "renderizada"))

    def test_una_pagina_en_pie_sigue_en_pie(self):
        self.assertEqual(v.revisar(self.base + "/viva")[0], "viva")

    def test_un_404_se_detecta_sin_abrir_el_navegador(self):
        self.assertEqual(v.revisar(self.base + "/no-existe"), ("caida", "estatica"))


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.ofertas = os.path.join(self.dir, "ofertas.json")
        self.descartadas = os.path.join(self.dir, "descartadas.json")
        Path(self.ofertas).write_text(json.dumps(OFERTAS), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def correr(self, juicios):
        with mock.patch.object(v, "revisar", side_effect=lambda u, desde=None: (juicios[u], "estatica")), \
                redirect_stdout(io.StringIO()) as salida:
            codigo = v.main([self.ofertas, "--descartadas", self.descartadas])
        return codigo, salida.getvalue()

    def test_guarda_las_caidas_y_avisa_con_el_codigo_3(self):
        codigo, salida = self.correr({"https://t.test/a": "viva", "https://t.test/b": "caida", "https://t.test/c": "dudosa"})
        self.assertEqual(codigo, 3)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")), ["https://t.test/b"])
        self.assertIn("1 caída", salida)
        self.assertIn("t.test: 1 en pie, 1 caída(s), 1 sin confirmar", salida)     # el resumen por comercio

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
