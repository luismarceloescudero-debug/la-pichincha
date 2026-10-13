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
