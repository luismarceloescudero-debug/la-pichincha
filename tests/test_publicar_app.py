import json
import struct
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def medida_png(ruta):
    cabecera = Path(ruta).read_bytes()[:24]
    return struct.unpack(">II", cabecera[16:24])


class Manifiesto(unittest.TestCase):
    def setUp(self):
        self.m = json.loads((RAIZ / "manifest.webmanifest").read_text(encoding="utf-8"))

    def test_datos_de_la_app(self):
        self.assertEqual(self.m["name"], "La Pichincha")
        self.assertEqual(self.m["lang"], "es-AR")
        self.assertEqual(self.m["display"], "standalone")
        self.assertTrue(self.m["description"])

    def test_rutas_relativas_para_que_ande_bajo_cualquier_dominio_o_carpeta(self):
        for clave in ("start_url", "scope"):
            self.assertFalse(self.m[clave].startswith(("/", "http")), clave)
        for icono in self.m["icons"]:
            self.assertFalse(icono["src"].startswith(("/", "http")), icono["src"])

    def test_los_colores_son_los_del_sitio(self):
        css = (RAIZ / "css" / "sitio.css").read_text(encoding="utf-8")
        self.assertIn(self.m["theme_color"].lower(), css.lower())
        self.assertIn(self.m["background_color"].lower(), css.lower())

    def test_los_iconos_existen_y_miden_lo_que_declaran(self):
        declarados = {(i["sizes"], i.get("purpose", "any")) for i in self.m["icons"]}
        self.assertEqual(declarados, {("192x192", "any"), ("512x512", "any"), ("512x512", "maskable")})
        for icono in self.m["icons"]:
            ancho, alto = (int(n) for n in icono["sizes"].split("x"))
            ruta = RAIZ / icono["src"]
            self.assertTrue(ruta.exists(), icono["src"])
            self.assertEqual(medida_png(ruta), (ancho, alto), icono["src"])
            self.assertLess(ruta.stat().st_size, 60 * 1024, icono["src"])

    def test_el_icono_de_apple_mide_180(self):
        self.assertEqual(medida_png(RAIZ / "img" / "apple-touch-icon.png"), (180, 180))


class SinRed(unittest.TestCase):
    """sin-red.html se sirve en la URL de OTRA pagina: nada puede depender de rutas relativas."""

    def setUp(self):
        self.html = (RAIZ / "sin-red.html").read_text(encoding="utf-8")

    def test_dice_que_no_esta_disponible_y_ofrece_volver(self):
        self.assertIn("no está disponible sin conexión", self.html)
        self.assertIn("La Pichincha", self.html)
        self.assertIn('id="volver"', self.html)

    def test_no_depende_de_rutas_relativas(self):
        import re
        self.assertNotRegex(self.html, r'(?:src|href)="(?!#|https?:)[^"]*\.(?:css|js|png)"')
        self.assertIn("<style>", self.html)

    def test_el_enlace_de_volver_se_arma_con_el_alcance_del_service_worker(self):
        self.assertIn("serviceWorker", self.html)
        self.assertIn("scope", self.html)

    def test_tiene_tema_oscuro_y_no_indexa(self):
        self.assertIn("prefers-color-scheme: dark", self.html)
        self.assertIn('name="robots" content="noindex"', self.html)


class Publicar(unittest.TestCase):
    def setUp(self):
        import shutil
        import tempfile
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.salida = self.dir / "_sitio"
        self.indice = self.dir / "indice.json"
        self.indice.write_text(json.dumps({"generado": "2026-10-09T08:12-03:00", "productos": []}), encoding="utf-8")

    def correr(self, *extra, indice=True):
        import publicar_app
        argv = ["--salida", str(self.salida), "--commit", "abc1234def"] + (["--indice", str(self.indice)] if indice else []) + list(extra)
        self.assertEqual(publicar_app.main(argv), 0)
        return (self.salida / "sw.js").read_text(encoding="utf-8")

    def test_estampa_la_version_con_la_fecha_del_indice_y_el_commit(self):
        sw = self.correr()
        self.assertIn('const VERSION = "20261009T0812-abc1234";', sw)
        self.assertNotIn("__VERSION__", sw)

    def test_sin_indice_la_version_es_solo_el_commit(self):
        self.assertIn('const VERSION = "abc1234";', self.correr(indice=False))

    def test_dos_publicaciones_con_indices_distintos_dan_versiones_distintas(self):
        a = self.correr()
        self.indice.write_text(json.dumps({"generado": "2026-10-10T08:15-03:00"}), encoding="utf-8")
        b = self.correr()
        self.assertNotEqual(a, b)

    def test_copia_manifiesto_pagina_de_sin_red_e_iconos(self):
        self.correr()
        for ruta in ("manifest.webmanifest", "sin-red.html", "img/icono-192.png", "img/icono-512.png",
                     "img/icono-maskable-512.png", "img/apple-touch-icon.png"):
            self.assertTrue((self.salida / ruta).exists(), ruta)

    def test_correrlo_dos_veces_no_falla(self):
        self.correr()
        self.correr()

    def test_el_peso_de_la_cascara_sin_el_indice_es_chico(self):
        # SC-005: menos de 10 MB sin contar el indice.
        import publicar_app
        total = sum((RAIZ / r).stat().st_size for r in publicar_app.ARCHIVOS_DE_LA_CASCARA if (RAIZ / r).exists())
        self.assertLess(total, 10 * 1024 * 1024)
