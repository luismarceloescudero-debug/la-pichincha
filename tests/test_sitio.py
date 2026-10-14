import json
import re
import subprocess
import unittest
from pathlib import Path

import generar_paginas

RAIZ = Path(__file__).resolve().parent.parent
SITIO = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))


class DireccionUnica(unittest.TestCase):
    """La direccion del sitio sale de sitio.json: cambiar de dominio es cambiarla ahi (y en index.html)."""

    def test_index_html_usa_la_direccion_de_sitio_json(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        urls = re.findall(r'(?:href|content)="(https://[^"]+)"', html)
        propias = [u for u in urls if "github.io" in u or u.startswith(SITIO["base_url"])]
        self.assertTrue(propias)
        for u in propias:
            self.assertTrue(u.startswith(SITIO["base_url"] + "/"), u)

    def test_los_generadores_toman_la_direccion_de_sitio_json(self):
        self.assertEqual(generar_paginas.BASE_URL, SITIO["base_url"])
        for modulo in ("./generar_paginas.js", "./generar_feed.js"):
            js = f'process.stdout.write(require("{modulo}").BASE_URL)'
            salida = subprocess.run(["node", "-e", js], cwd=RAIZ, capture_output=True, text=True, check=True)
            self.assertEqual(salida.stdout, SITIO["base_url"], modulo)

    def test_ningun_archivo_de_codigo_escribe_la_direccion_a_mano(self):
        for nombre in ("generar_paginas.py", "generar_paginas.js", "generar_feed.js", ".github/workflows/actualizar.yml"):
            texto = (RAIZ / nombre).read_text(encoding="utf-8")
            self.assertNotIn("github.io/la-pichincha", texto, nombre)


class PoliticaDeContenido(unittest.TestCase):
    """La CSP vive en sitio.json; index.html y las paginas generadas la llevan igual."""

    def test_la_politica_cierra_lo_que_no_se_usa(self):
        csp = SITIO["csp"]
        for directiva in ("default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"):
            self.assertIn(directiva, csp)
        self.assertNotIn("unsafe-eval", csp)

    def test_index_html_lleva_la_politica_de_sitio_json(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        metas = re.findall(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
        self.assertEqual(metas, [SITIO["csp"]])

    def test_las_paginas_generadas_llevan_la_politica_de_sitio_json(self):
        js = 'process.stdout.write(require("./generar_paginas.js").cabeza({titulo:"t",descripcion:"d",canonica:"c",baseUrl:"b"}))'
        salida = subprocess.run(["node", "-e", js], cwd=RAIZ, capture_output=True, text=True, check=True, encoding="utf-8")
        self.assertIn(f'<meta http-equiv="Content-Security-Policy" content="{SITIO["csp"]}">', salida.stdout)

    def test_todo_origen_externo_del_sitio_esta_permitido(self):
        """Si alguien suma un script o una fuente de otro dominio sin tocar la CSP, el navegador lo bloquea."""
        csp = SITIO["csp"]
        textos = [(RAIZ / "index.html").read_text(encoding="utf-8")] + \
            [p.read_text(encoding="utf-8") for p in (RAIZ / "js").glob("*.js")]
        for texto in textos:
            for origen in re.findall(r'<script[^>]+src="(https://[^/"]+)', texto) + \
                    re.findall(r'"(https://cdnjs\.cloudflare\.com)/', texto):
                self.assertIn(origen, csp)


class Icono(unittest.TestCase):
    """Sin <link rel="icon"> el navegador pide /favicon.ico, que no existe: un 404 en cada pagina."""

    def test_index_y_las_paginas_generadas_declaran_el_icono(self):
        self.assertIn('<link rel="icon" type="image/png" href="img/icono-192.png">',
                      (RAIZ / "index.html").read_text(encoding="utf-8"))
        js = 'process.stdout.write(require("./generar_paginas.js").cabeza({titulo:"t",descripcion:"d",canonica:"c",baseUrl:"b",rel:"../"}))'
        salida = subprocess.run(["node", "-e", js], cwd=RAIZ, capture_output=True, text=True, check=True, encoding="utf-8")
        self.assertIn('<link rel="icon" type="image/png" href="../img/icono-192.png">', salida.stdout)
