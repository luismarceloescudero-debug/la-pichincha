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
