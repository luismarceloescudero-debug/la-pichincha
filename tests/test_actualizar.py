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

    extraer_lista = False      # si el extractor informa precio_lista (vacio) como Gaming City

    def extraer(self, prod):
        r = self.respuestas[prod["id"]]
        if isinstance(r, Exception):
            raise r
        return dict({"precio": r}, **({"precio_lista": None} if self.extraer_lista else {}))

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

    def test_lista_que_la_tienda_deja_de_publicar_se_borra(self):
        # El extractor informa el campo y viene vacio: el valor guardado esta vencido.
        self.datos["productos"][0]["precio_lista"] = 900
        self.respuestas = {"x": 1000, "y": 2000}
        self.extraer_lista = True
        self.relevar()
        self.assertNotIn("precio_lista", self.prod("x"))

    def test_lista_que_el_extractor_no_maneja_se_conserva(self):
        self.datos["productos"][0]["precio_lista"] = 1200
        self.respuestas = {"x": 1000, "y": 2000}
        self.relevar()
        self.assertEqual(self.prod("x")["precio_lista"], 1200)

    def test_sin_fallas_no_cambia_nada(self):
        self.respuestas = {"x": 1000, "y": 2000}
        self.datos["productos"][1].pop("falla_desde")
        antes = json.dumps(self.datos, sort_keys=True)
        self.relevar()
        self.assertEqual(json.dumps(self.datos, sort_keys=True), antes)


class AnalizarSinVerificar(unittest.TestCase):
    """analizar() no puede apoyar sus conclusiones en un precio que no se verifico."""

    def setUp(self):
        self.datos = {
            "envio": {"zona": "Mendoza", "cp": "5501", "punto": 6639, "domicilio": 11658},
            "tiendas": {"cg": {"nombre": "CG"}, "gc": {"nombre": "GC"}, "fh": {"nombre": "FH"}, "mx": {"nombre": "MX"}},
            "productos": [
                {"id": "adata-d35", "tipo": "ram", "tienda": "cg", "corto": "ADATA", "precio": 221450},
                {"id": "kingston-kvr", "tipo": "ram", "tienda": "gc", "corto": "Kingston", "precio": 299249},
                {"id": "hiker", "tipo": "ram-ref", "tienda": "fh", "corto": "Hiker", "precio": 200000,
                 "falla_desde": "2026-10-08"},
                {"id": "armor", "tipo": "ram-ref", "tienda": "mx", "corto": "Armor", "precio": 214989},
                {"id": "c920s", "tipo": "webcam", "tienda": "gc", "corto": "C920S", "precio": 137749},
            ]}

    def analizar(self):
        with redirect_stdout(io.StringIO()):
            return actualizar.analizar(self.datos)

    def prod(self, i):
        return next(p for p in self.datos["productos"] if p["id"] == i)

    def test_la_mas_barata_no_sale_de_un_precio_sin_verificar(self):
        self.analizar()
        self.assertEqual(self.datos["calculado"]["ram_mas_barata"], "armor")

    def test_si_ninguna_esta_verificada_elige_igual(self):
        for p in self.datos["productos"]:
            p["falla_desde"] = "2026-10-08"
        self.analizar()
        self.assertEqual(self.datos["calculado"]["ram_mas_barata"], "hiker")

    def test_el_podio_apoyado_en_un_precio_sin_verificar_avisa(self):
        self.prod("kingston-kvr")["falla_desde"] = "2026-10-09"
        avisos = self.analizar()
        self.assertTrue(any("sin verificar" in a and "Kingston" in a for a in avisos), avisos)

    def test_con_todo_verificado_no_avisa(self):
        self.assertEqual(self.analizar(), [])
