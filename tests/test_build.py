import io
import json
import re
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import actualizar

RAIZ = Path(__file__).resolve().parent.parent


class ArmarArtifact(unittest.TestCase):
    def test_saca_lo_que_solo_va_en_la_web_y_mete_los_scripts(self):
        html = ('<!doctype html>\n<html lang="es">\n<head>\n<!-- solo-web -->\n<meta charset="utf-8">\n'
                '<!-- /solo-web -->\n<title>T</title>\n<!-- solo-web -->\n<script id="gc" data-goatcounter="x"></script>\n'
                '<!-- /solo-web -->\n<style>a{}</style>\n</head>\n<body>\n<header>h</header>\n'
                '<div class="wrap">hola</div>\n<script src="js/uno.js"></script>\n'
                '<script>\nconst A = 1;\n</script>\n</body>\n</html>\n')
        copia = actualizar.armar_artifact(html, {"js/uno.js": "var UNO = 1;\n"}.__getitem__)
        self.assertTrue(copia.startswith("<title>T</title>"))
        for resto in ("solo-web", "doctype", "<html", "<head>", "</head>", "<body>", "</body>",
                      "</html>", "data-goatcounter", 'src="js/'):
            self.assertNotIn(resto, copia)
        for queda in ("<script>\nvar UNO = 1;\n</script>", "<style>a{}</style>", "<header>h</header>",
                      '<div class="wrap">hola</div>', "const A = 1;"):
            self.assertIn(queda, copia)


class ArmarArtifactConCss(unittest.TestCase):
    def test_los_link_a_css_se_meten_adentro_como_style(self):
        html = ('<title>T</title>\n<link rel="stylesheet" href="css/sitio.css">\n'
                '<div class="wrap">hola</div>\n')
        copia = actualizar.armar_artifact(html, {"css/sitio.css": "body{margin:0}\n"}.__getitem__)
        self.assertIn("<style>\nbody{margin:0}\n</style>", copia)
        self.assertNotIn("<link", copia)

    def test_no_toca_los_link_a_otros_sitios(self):
        html = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">\n'
        self.assertEqual(actualizar.armar_artifact(html, {}.__getitem__).strip(), html.strip())


class PaginaPrincipal(unittest.TestCase):
    def test_enlaza_al_indice_de_precios_sin_depender_de_scripts(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        # Fuera de los <script>: un buscador que no ejecuta JavaScript tiene que verlo.
        sin_scripts = re.sub(r"<script.*?</script>", "", html, flags=re.S)
        self.assertIn('<a href="precios/">', sin_scripts)


class Construir(unittest.TestCase):
    """construir() sobre una copia del index.html real."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        real = (RAIZ / "index.html").read_text(encoding="utf-8")
        (self.dir / "index.html").write_text(real, encoding="utf-8")
        for ruta in actualizar.JS_SRC.findall(real) + actualizar.CSS_LINK.findall(real):
            destino = self.dir / ruta
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(RAIZ / ruta, destino)
        self.datos = json.loads((RAIZ / "datos.json").read_text(encoding="utf-8"))

    def construir(self, **kw):
        with redirect_stdout(io.StringIO()):
            ok = actualizar.construir(self.datos, pagina=self.dir / "index.html",
                                      copia=self.dir / "copia.html", **kw)
        self.assertTrue(ok)
        return ((self.dir / "index.html").read_text(encoding="utf-8"),
                (self.dir / "copia.html").read_text(encoding="utf-8"))

    def test_inyecta_datos_en_index_y_arma_la_copia(self):
        self.datos["actualizado"] = "2099-01-02"
        pagina, copia = self.construir()
        self.assertIn('"actualizado": "2099-01-02"', pagina)
        self.assertIn('"actualizado": "2099-01-02"', copia)
        self.assertTrue(pagina.lower().startswith("<!doctype html>"))
        self.assertIn("<!-- solo-web -->", pagina)
        self.assertTrue(copia.startswith("<title>"))
        for resto in ('<script src="js/', "solo-web", "data-goatcounter", "og:image", "</head>"):
            self.assertNotIn(resto, copia)

    def test_verificado_va_al_html_y_no_a_los_datos(self):
        pagina, copia = self.construir(verificado="2026-10-08T15:25-03:00")
        self.assertIn('"verificado": "2026-10-08T15:25-03:00"', pagina)
        self.assertIn('"verificado": "2026-10-08T15:25-03:00"', copia)
        self.assertNotIn("verificado", self.datos)

    def test_sin_verificado_no_queda_uno_viejo(self):
        self.construir(verificado="2026-10-08T15:25-03:00")
        pagina, _ = self.construir()
        self.assertNotIn('"verificado"', pagina)

    def test_construir_dos_veces_da_lo_mismo(self):
        self.assertEqual(self.construir(), self.construir())
