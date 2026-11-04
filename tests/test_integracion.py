"""Integracion: arma el sitio entero como la Action (actualizar.yml, paso "Preparar el sitio" y los
generadores que le siguen) con un indice chico y revisa que cada enlace interno de cada pagina lleve a un
archivo que existe. Asi una pagina nueva que no se publica, o un enlace mal relativo, se ve en el PR."""

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

RAIZ = Path(__file__).resolve().parent.parent
CAMPOS = ["nombre", "precio", "url", "tienda", "via", "lista", "antes", "imagen", "sellos", "modelo", "desde"]


def fila(nombre, precio, tienda, antes=0):
    return [nombre, precio, "https://t.test/" + nombre.replace(" ", "-"), tienda, "", 0, antes, "", "", ""]


INDICE = {
    "generado": "2026-10-14T09:10-03:00",
    "tiendas": {"compragamer": {"nombre": "CompraGamer", "color": "cg", "segunda": False,
                                "relevado": "2026-10-14T09:10-03:00"},
                "venex": {"nombre": "Venex", "color": "vx", "segunda": False,
                          "relevado": "2026-10-12T09:00-03:00"}},
    "campos": CAMPOS,
    "productos": [fila(f"Memoria Kingston Fury DDR4 16GB 3200 v{i}", 30000 + i * 500, "compragamer", 40000)
                  for i in range(6)] + [fila("SSD Kingston NV2 1TB", 70000, "venex")],
}


class Enlaces(HTMLParser):
    def __init__(self):
        super().__init__()
        self.enlaces = []

    def handle_starttag(self, tag, attrs):
        for nombre, valor in attrs:
            if nombre in ("href", "src") and valor:
                self.enlaces.append(valor)


def correr(*comando):
    subprocess.run(comando, cwd=RAIZ, check=True, capture_output=True, encoding="utf-8")


class SitioArmado(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        sitio = cls.sitio = Path(cls.tmp) / "_sitio"
        sitio.mkdir()
        shutil.copy(RAIZ / "index.html", sitio)
        for carpeta in ("img", "js", "css"):
            shutil.copytree(RAIZ / carpeta, sitio / carpeta)
        indice = sitio / "indice.json"
        indice.write_text(json.dumps(INDICE), encoding="utf-8")
        salud = Path(cls.tmp) / "salud.json"
        correr(sys.executable, "generar_paginas.py", "--indice", str(indice), "--salida", str(sitio))
        correr(sys.executable, "publicar_app.py", "--salida", str(sitio), "--indice", str(indice))
        correr("node", "generar_feed.js", "--indice", str(indice), "--salida", str(sitio))
        correr("node", "generar_info.js", "--indice", str(indice), "--salud", str(salud), "--salida", str(sitio))
        correr("node", "generar_portada.js", "--salida", str(sitio))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def paginas(self):
        return sorted(self.sitio.rglob("*.html"))

    def test_se_publican_todas_las_paginas(self):
        for ruta in ("index.html", "precios/index.html", "hoy/index.html", "estado/index.html",
                     "legal/index.html", "404.html", "sin-red.html", "sitemap.xml", "robots.txt", "ofertas.xml",
                     "manifest.webmanifest", "sw.js"):
            self.assertTrue((self.sitio / ruta).exists(), ruta)

    def test_la_portada_publicada_trae_la_vista_inicial(self):
        portada = (self.sitio / "index.html").read_text(encoding="utf-8")
        self.assertIn('<div id="vista" data-pre="comparativa:ram" role="tabpanel" aria-labelledby="tab-comparativa">', portada)
        self.assertIn('id="ultimas"', portada)          # spec 021: la portada termina con tus busquedas, sin lo curado
        self.assertNotIn('Memorias DDR4 16GB', portada)
        self.assertNotIn('id="tablist"></div>', portada)

    def test_el_repo_y_la_copia_del_artifact_quedan_sin_pre_renderizar(self):
        self.assertIn('<div id="vista" role="tabpanel" aria-labelledby="tab-comparativa"></div>', (RAIZ / "index.html").read_text(encoding="utf-8"))

    def test_cada_enlace_interno_lleva_a_un_archivo_que_existe(self):
        rotos = []
        for pagina in self.paginas():
            lector = Enlaces()
            lector.feed(pagina.read_text(encoding="utf-8"))
            for enlace in lector.enlaces:
                partes = urlsplit(enlace)
                if partes.scheme or enlace.startswith(("#", "//")) or not partes.path:
                    continue
                if partes.path.startswith("/"):          # desde la raiz del sitio (la 404 se sirve en cualquier URL)
                    destino = (self.sitio / unquote(partes.path).lstrip("/")).resolve()
                else:
                    destino = (pagina.parent / unquote(partes.path)).resolve()
                if partes.path.endswith("/"):
                    destino = destino / "index.html"
                if not destino.exists():
                    rotos.append(f"{pagina.relative_to(self.sitio)} -> {enlace}")
        self.assertEqual(rotos, [])

    def test_la_404_tiene_la_marca_y_lleva_a_la_portada_y_al_buscador(self):
        html = (self.sitio / "404.html").read_text(encoding="utf-8")
        self.assertIn('href="/css/sitio.css"', html)     # rutas desde la raiz: se sirve en cualquier URL que no existe
        self.assertIn('<a class="marca-sitio" href="/"', html)
        self.assertIn('href="/#buscar"', html)
        self.assertIn('name="robots" content="noindex', html)
        self.assertNotIn('rel="canonical"', html)
        self.assertNotIn('href="../', html)

    def test_ninguna_pagina_queda_sin_la_politica_de_contenido(self):
        for pagina in self.paginas():
            if pagina.name == "sin-red.html":          # sin archivos externos: la sirve el service worker
                continue
            with self.subTest(pagina=str(pagina.relative_to(self.sitio))):
                self.assertIn('http-equiv="Content-Security-Policy"', pagina.read_text(encoding="utf-8"))

    def test_toda_pagina_dice_su_politica_de_referrer(self):
        # No filtra la busqueda a las tiendas: el navegador ya lo hace por defecto, esto lo deja escrito (auditoria 054).
        for pagina in self.paginas():
            with self.subTest(pagina=str(pagina.relative_to(self.sitio))):
                self.assertIn('<meta name="referrer" content="strict-origin-when-cross-origin">', pagina.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
