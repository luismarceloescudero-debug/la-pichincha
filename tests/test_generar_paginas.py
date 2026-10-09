import json
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET
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


BASE = "https://ejemplo.test/la-pichincha"
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


class SitemapYRobots(unittest.TestCase):
    PAGINAS = [{"slug": "ssd-1tb", "q": "ssd 1tb", "indexable": True},
               {"slug": "rtx-4060", "q": "rtx 4060", "indexable": True},
               {"slug": "fina", "q": "fina", "indexable": False}]

    def locs(self, xml):
        return {u.find("s:loc", NS).text: (u.find("s:lastmod", NS).text if u.find("s:lastmod", NS) is not None else None)
                for u in ET.fromstring(xml).findall("s:url", NS)}

    def test_lista_la_principal_el_indice_y_solo_las_indexables_con_su_fecha(self):
        xml = generar_paginas.sitemap(self.PAGINAS, "2026-10-09T08:12-03:00", BASE)
        self.assertEqual(self.locs(xml), {
            BASE + "/": "2026-10-09", BASE + "/precios/": "2026-10-09",
            BASE + "/precios/ssd-1tb/": "2026-10-09", BASE + "/precios/rtx-4060/": "2026-10-09"})

    def test_sin_indice_solo_la_pagina_principal_y_sin_fecha(self):
        self.assertEqual(self.locs(generar_paginas.sitemap([], None, BASE)), {BASE + "/": None})

    def test_robots_deja_rastrear_todo_e_indica_el_mapa(self):
        r = generar_paginas.robots(BASE)
        self.assertIn("User-agent: *", r)
        self.assertIn("Allow: /", r)
        self.assertIn("Sitemap: " + BASE + "/sitemap.xml", r)
        self.assertNotRegex(r, r"Disallow:\s*/\s*$")


class Generar(unittest.TestCase):
    """generar_paginas.main() entero, con Node de verdad y un indice minimo."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        productos = [[f"Memoria Kingston {i} DDR4 16GB", 1000 + i, f"https://t.test/{i}", "cg", "", 0, 0, "", ""]
                     for i in range(6)]
        indice = {"generado": "2026-10-09T08:12-03:00", "productos": productos,
                  "tiendas": {"cg": {"nombre": "CompraGamer", "color": "cg", "relevado": "2026-10-09T08:12-03:00"}}}
        self.indice = self.dir / "indice.json"
        self.indice.write_text(json.dumps(indice), encoding="utf-8")
        self.consultas = self.dir / "consultas.json"
        self.consultas.write_text(json.dumps([{"q": "ddr4 16gb"}, {"q": "placa inexistente"}]), encoding="utf-8")
        self.salida = self.dir / "_sitio"

    def correr(self, indice=None):
        return generar_paginas.main(["--indice", str(indice or self.indice), "--consultas", str(self.consultas),
                                     "--salida", str(self.salida)])

    def test_crea_una_pagina_por_consulta(self):
        self.assertEqual(self.correr(), 0)
        buena = (self.salida / "precios" / "ddr4-16gb" / "index.html").read_text(encoding="utf-8")
        self.assertIn("<h1>ddr4 16gb", buena)
        self.assertNotIn("noindex", buena)
        fina = (self.salida / "precios" / "placa-inexistente" / "index.html").read_text(encoding="utf-8")
        self.assertIn("noindex", fina)

    def test_sin_indice_no_hay_paginas_y_no_falla(self):
        self.assertEqual(self.correr(self.dir / "no-esta.json"), 0)
        self.assertFalse((self.salida / "precios").exists())

    def test_publica_sitemap_y_robots_con_solo_las_paginas_indexables(self):
        self.assertEqual(self.correr(), 0)
        mapa = (self.salida / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("/precios/ddr4-16gb/", mapa)
        self.assertNotIn("placa-inexistente", mapa)
        self.assertIn("/precios/</loc>", mapa)
        self.assertIn("Sitemap:", (self.salida / "robots.txt").read_text(encoding="utf-8"))

    def test_el_indice_de_consultas_enlaza_solo_las_indexables(self):
        self.correr()
        hub = (self.salida / "precios" / "index.html").read_text(encoding="utf-8")
        self.assertIn('href="ddr4-16gb/"', hub)
        self.assertNotIn("placa-inexistente", hub)

    def test_agregar_una_consulta_crea_su_pagina_y_su_entrada(self):
        self.correr()
        self.consultas.write_text(json.dumps([{"q": "ddr4 16gb"}, {"q": "memoria kingston"}]), encoding="utf-8")
        shutil.rmtree(self.salida)
        self.correr()
        self.assertTrue((self.salida / "precios" / "memoria-kingston" / "index.html").exists())
        self.assertIn("/precios/memoria-kingston/", (self.salida / "sitemap.xml").read_text(encoding="utf-8"))

    def test_sin_indice_el_sitemap_solo_tiene_la_principal(self):
        self.correr(self.dir / "no-esta.json")
        mapa = (self.salida / "sitemap.xml").read_text(encoding="utf-8")
        self.assertEqual(mapa.count("<url>"), 1)
        self.assertTrue((self.salida / "robots.txt").exists())

    def test_una_lista_invalida_corta_la_publicacion(self):
        self.consultas.write_text(json.dumps([{"q": "ssd 1tb"}, {"q": "SSD 1TB"}]), encoding="utf-8")
        with self.assertRaises(ValueError):
            self.correr()
        self.assertFalse((self.salida / "precios").exists())


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
