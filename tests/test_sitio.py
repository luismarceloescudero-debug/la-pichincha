import json
import re
import subprocess
import unittest
from pathlib import Path

import actualizar
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
        """La de sitio.json mas los hashes de sus scripts en linea (auditoria B1): sin 'unsafe-inline' en script-src."""
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        metas = re.findall(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
        self.assertEqual(len(metas), 1)
        sin_hashes = re.sub(r" '(?:sha256-[^']+|unsafe-hashes)'", "", metas[0])
        self.assertEqual(sin_hashes, SITIO["csp"])
        self.assertEqual(actualizar.con_hashes(html), html, "index.html con hashes viejos: correr python actualizar.py --build")

    def test_script_src_no_deja_correr_cualquier_script_en_linea(self):
        script_src = re.search(r"script-src ([^;]+)", SITIO["csp"]).group(1).split()
        self.assertNotIn("'unsafe-inline'", script_src)
        self.assertNotIn("https://cdnjs.cloudflare.com", script_src)   # solo la ruta de ExcelJS

    def test_python_y_node_calculan_los_mismos_hashes(self):
        """actualizar.py (index.html del repo) y csp.js (la portada publicada y las demas paginas) aplican la misma regla."""
        html = (RAIZ / "index.html").read_text(encoding="utf-8").replace(" 'unsafe-hashes'", "")
        js = 'let t="";process.stdin.on("data",d=>t+=d).on("end",()=>process.stdout.write(require("./csp.js").conHashes(t)))'
        salida = subprocess.run(["node", "-e", js], cwd=RAIZ, input=html, capture_output=True, text=True, check=True, encoding="utf-8")
        self.assertEqual(salida.stdout, actualizar.con_hashes(html))

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


class Afuera(unittest.TestCase):
    """El Worker «Afuera» (spec 022): su direccion vive en sitio.json, index.html la lleva en un meta y la CSP la deja pasar."""

    def test_la_direccion_del_worker_esta_vacia_o_es_https_sin_ruta(self):
        url = SITIO["afuera_url"]
        self.assertTrue(url == "" or re.fullmatch(r"https://[a-z0-9.-]+", url), url)

    def test_index_html_lleva_la_direccion_del_worker_de_sitio_json(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.assertEqual(re.findall(r'<meta name="afuera-url" content="([^"]*)">', html), [SITIO["afuera_url"]])

    def test_la_politica_deja_conectar_con_el_worker(self):
        if SITIO["afuera_url"]:
            connect = re.search(r"connect-src ([^;]+)", SITIO["csp"]).group(1).split()
            self.assertIn(SITIO["afuera_url"], connect)


class Sentry(unittest.TestCase):
    """Registro de errores (spec 062): el DSN vive en sitio.json, las paginas lo llevan en un meta y la CSP lo deja pasar."""

    def test_el_dsn_esta_vacio_o_es_de_sentry(self):
        dsn = SITIO["sentry_dsn"]
        self.assertTrue(dsn == "" or re.fullmatch(r"https://[0-9a-f]+@o\d+\.ingest(\.[a-z]+)?\.sentry\.io/\d+", dsn), dsn)

    def test_la_politica_deja_bajar_el_programa_y_mandar_los_errores(self):
        script = re.search(r"script-src ([^;]+)", SITIO["csp"]).group(1).split()
        self.assertIn("https://browser.sentry-cdn.com", script)
        connect = re.search(r"connect-src ([^;]+)", SITIO["csp"]).group(1).split()
        # Decision del 20/11: el CDN de Sentry NO entra en connect-src (el aviso del .map es esperado, ver _nota_sentry_mapa).
        self.assertNotIn("https://browser.sentry-cdn.com", connect)
        if SITIO["sentry_dsn"]:
            origen = re.match(r"https://[^@]+@([^/]+)", SITIO["sentry_dsn"]).group(1)
            self.assertIn(f"https://{origen}", connect)

    def test_index_y_las_paginas_generadas_llevan_el_dsn_y_el_script(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.assertEqual(re.findall(r'<meta name="sentry-dsn" content="([^"]*)">', html), [SITIO["sentry_dsn"]])
        self.assertIn('<script defer src="js/errores.js"></script>', html)
        self.assertLess(html.index("js/errores.js"), html.index('"js/buscador.js"'), "va antes que el resto")
        js = 'process.stdout.write(require("./generar_paginas.js").cabeza({titulo:"t",descripcion:"d",canonica:"c",baseUrl:"b",rel:"../"}))'
        salida = subprocess.run(["node", "-e", js], cwd=RAIZ, capture_output=True, text=True, check=True, encoding="utf-8")
        self.assertIn(f'<meta name="sentry-dsn" content="{SITIO["sentry_dsn"]}">', salida.stdout)
        self.assertIn('<script defer src="../js/errores.js"></script>', salida.stdout)


class Icono(unittest.TestCase):
    """Sin <link rel="icon"> el navegador pide /favicon.ico, que no existe: un 404 en cada pagina."""

    def test_index_y_las_paginas_generadas_declaran_el_icono(self):
        self.assertIn('<link rel="icon" type="image/png" href="img/icono-192.png">',
                      (RAIZ / "index.html").read_text(encoding="utf-8"))
        js = 'process.stdout.write(require("./generar_paginas.js").cabeza({titulo:"t",descripcion:"d",canonica:"c",baseUrl:"b",rel:"../"}))'
        salida = subprocess.run(["node", "-e", js], cwd=RAIZ, capture_output=True, text=True, check=True, encoding="utf-8")
        self.assertIn('<link rel="icon" type="image/png" href="../img/icono-192.png">', salida.stdout)
