import io
import json
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import actualizar

FIX = Path(__file__).resolve().parent / "fixtures"


def leer(clave, nombre):
    return (FIX / clave / nombre).read_text(encoding="utf-8")


def con_html(extractor, html):
    with mock.patch.object(actualizar, "bajar", return_value=html):
        return extractor({"url": "https://ejemplo.test/p"})


class Sinteticos(unittest.TestCase):
    def test_meta_de_gaming_city(self):
        html = ('<meta name="product:price:amount" content="236550.00"> Precio de lista $ 260.000 '
                '<meta name="product:availability" content="in stock">')
        self.assertEqual(con_html(actualizar.precio_meta, html),
                         {"precio": 236550, "precio_lista": 260000, "stock": "en stock"})

    def test_itemprop_de_mexx(self):
        self.assertEqual(con_html(actualizar.precio_itemprop, '<span itemprop="price" content="45000"> EN STOCK'),
                         {"precio": 45000, "stock": "en stock"})

    def test_og_de_fullh4rd(self):
        html = '<meta property="og:price:amount" content="89999"> Stock alto en la web'
        self.assertEqual(con_html(actualizar.precio_og, html), {"precio": 89999, "stock": "stock alto"})

    def test_sin_metadato_es_lookup_error(self):
        for extractor in (actualizar.precio_meta, actualizar.precio_itemprop, actualizar.precio_og):
            with self.subTest(extractor.__name__), self.assertRaises(LookupError):
                con_html(extractor, "<html>nada</html>")


class Reales(unittest.TestCase):
    """Paginas de producto guardadas. FullH4rd falta por el desafio de
    Cloudflare (ver test_indexar.TarjetasReales)."""

    def test_paginas_guardadas(self):
        casos = {"gamingcity": actualizar.precio_meta, "mexx": actualizar.precio_itemprop}
        for clave, extractor in casos.items():
            with self.subTest(clave):
                html = leer(clave, "producto.html")
                r = con_html(extractor, html)
                self.assertIsInstance(r["precio"], int)
                self.assertGreaterEqual(r["precio"], 1000)
                self.assertIn(str(r["precio"]), html)
                self.assertRegex(r["stock"], r"^(en stock|sin stock|stock (alto|medio|bajo))$")

    def test_catalogo_compragamer_guardado(self):
        filas = json.loads(leer("compragamer", "catalogo.json"))
        actualizar._cache_cg.clear()
        self.addCleanup(actualizar._cache_cg.clear)
        with mock.patch.object(actualizar, "bajar", return_value=json.dumps(filas)):
            for f in filas:
                r = actualizar.precio_compragamer({"fuente": {"id_producto": f["id_producto"]}})
                self.assertEqual(r["precio"], f.get("precioEspecial"))
                self.assertEqual(r["stock"], "en stock" if (f.get("stock") or 0) > 0 else "sin stock")

    def test_producto_que_no_esta_en_el_catalogo(self):
        actualizar._cache_cg.clear()
        self.addCleanup(actualizar._cache_cg.clear)
        with mock.patch.object(actualizar, "bajar", return_value="[]"), self.assertRaises(LookupError):
            actualizar.precio_compragamer({"fuente": {"id_producto": 1}})


class FallaDesde(unittest.TestCase):
    """Un producto que no se puede verificar guarda desde cuando falla. Solo cambia
    cuando empieza a fallar o se recupera, asi datos.json no se commitea todos los dias."""

    def setUp(self):
        self.datos = {"tiendas": {"a": {"nombre": "A"}}, "productos": [
            {"id": "x", "corto": "X", "tienda": "a", "fuente": {"tipo": "prueba"}, "precio": 1000},
            {"id": "y", "corto": "Y", "tienda": "a", "fuente": {"tipo": "prueba"}, "precio": 2000,
             "falla_desde": "2026-10-05"}]}
        self.respuestas = {}
        p = mock.patch.dict(actualizar.EXTRACTORES, {"prueba": self.extraer})
        p.start()
        self.addCleanup(p.stop)

    def extraer(self, prod):
        r = self.respuestas[prod["id"]]
        if isinstance(r, Exception):
            raise r
        return {"precio": r}

    def relevar(self):
        with redirect_stdout(io.StringIO()):
            return actualizar.relevar(self.datos, hoy="2026-10-09")

    def prod(self, i):
        return next(p for p in self.datos["productos"] if p["id"] == i)

    def test_el_que_empieza_a_fallar_queda_marcado_desde_hoy(self):
        self.respuestas = {"x": urllib.error.HTTPError("u", 403, "Forbidden", None, None), "y": 2000}
        self.relevar()
        self.assertEqual(self.prod("x")["falla_desde"], "2026-10-09")
        self.assertEqual(self.prod("x")["precio"], 1000)          # conserva el precio anterior

    def test_el_que_sigue_fallando_conserva_su_fecha(self):
        self.respuestas = {"x": 1000, "y": urllib.error.URLError("sin red")}
        self.relevar()
        self.assertEqual(self.prod("y")["falla_desde"], "2026-10-05")

    def test_el_que_se_recupera_pierde_la_marca(self):
        self.respuestas = {"x": 1000, "y": 1900}
        self.relevar()
        self.assertNotIn("falla_desde", self.prod("y"))
        self.assertEqual(self.prod("y")["precio"], 1900)

    def test_precio_vacio_tambien_es_una_falla(self):
        self.respuestas = {"x": None, "y": 2000}
        self.relevar()
        self.assertEqual(self.prod("x")["falla_desde"], "2026-10-09")

    def test_sin_fallas_no_cambia_nada(self):
        self.respuestas = {"x": 1000, "y": 2000}
        self.datos["productos"][1].pop("falla_desde")
        antes = json.dumps(self.datos, sort_keys=True)
        self.relevar()
        self.assertEqual(json.dumps(self.datos, sort_keys=True), antes)
