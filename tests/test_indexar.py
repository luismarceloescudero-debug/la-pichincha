import json
import unittest
from pathlib import Path
from unittest import mock

import indexar

RAIZ = Path(__file__).resolve().parent.parent
FIX = RAIZ / "tests" / "fixtures"
TIENDAS = json.loads((RAIZ / "tiendas.json").read_text(encoding="utf-8"))


def leer(clave, nombre):
    return (FIX / clave / nombre).read_text(encoding="utf-8")


def miles(n):
    return f"{n:,}".replace(",", ".")


class Utilidades(unittest.TestCase):
    def test_numero(self):
        self.assertEqual(indexar.numero("284.050"), 284050)
        self.assertEqual(indexar.numero("23.450,01"), 23450)
        self.assertIsNone(indexar.numero(None))
        self.assertIsNone(indexar.numero("consultar"))

    def test_absoluta(self):
        self.assertEqual(indexar.absoluta("https://x.com", "/a/b"), "https://x.com/a/b")
        self.assertEqual(indexar.absoluta("https://x.com", "a-b--det--1"), "https://x.com/a-b--det--1")
        self.assertEqual(indexar.absoluta("https://x.com", "https://y.com/z"), "https://y.com/z")

    def test_limpio_decodifica_entidades(self):
        self.assertEqual(indexar.limpio('SSD 2.5&quot;  Kingston\n &amp; más'), 'SSD 2.5" Kingston & más')

    def test_imagen_toma_la_de_menor_orden(self):
        cfg = {"campos": {"imagen": "imagenes"}, "imagen_url": "https://img.test/{nombre}"}
        fila = {"imagenes": [{"nombre": "b.jpg", "orden": 2}, {"nombre": "a.jpg", "orden": 1}]}
        self.assertEqual(indexar.imagen(fila, cfg), "https://img.test/a.jpg")
        self.assertEqual(indexar.imagen({}, cfg), "")


class TarjetasSinteticas(unittest.TestCase):
    """HTML minimo escrito a mano con la forma de cada tienda: valores exactos."""

    def test_gamingcity_precio_especial_alternativas_y_alt(self):
        html = ('<div class="product"><a href="memoria-kingston--det--123"><img alt="x"></a>'
                '<p class="titprod">Memoria Kingston Fury 16GB DDR4</p>'
                '<span class="price-sales">$ 45.990</span><span class="price-standard">$ 52.000</span></div>'
                '<div class="product"><a href="mouse-x--det--9"><img alt="Mouse &amp; Pad"></a>'
                '<div class="price"><span>$ 9.500</span></div></div>'
                '<div class="product"><a href="sin-precio--det--5">Sin precio</a></div>')
        items = indexar.tarjetas(html, TIENDAS["gamingcity"]["catalogo"])
        self.assertEqual(items, [
            {"url": "memoria-kingston--det--123", "nombre": "Memoria Kingston Fury 16GB DDR4",
             "precio": 45990, "lista": 52000},
            {"url": "mouse-x--det--9", "nombre": "Mouse & Pad", "precio": 9500, "lista": None},
        ])

    def test_mexx(self):
        html = ('<div class="productos col"><a href="https://www.mexx.com.ar/productos-rubro/memorias/'
                'kingston-16gb.html">Memoria Kingston 16GB</a><div class="price"><b>$45.000</b></div></div>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["mexx"]["catalogo"]), [
            {"url": "https://www.mexx.com.ar/productos-rubro/memorias/kingston-16gb.html",
             "nombre": "Memoria Kingston 16GB", "precio": 45000, "lista": None}])

    def test_fullh4rd(self):
        html = ('<article class="results-card"><h3 class="results-card__title">'
                '<a href="/prod/123/ssd-kingston-1tb">SSD Kingston 1TB</a></h3>'
                '<span class="results-card__price-current">$89.999</span>'
                '<span class="results-card__price-list">$99.999</span></article>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["fullh4rd"]["catalogo"]), [
            {"url": "/prod/123/ssd-kingston-1tb", "nombre": "SSD Kingston 1TB",
             "precio": 89999, "lista": 99999}])


class TarjetasReales(unittest.TestCase):
    """El HTML guardado de cada tienda con la configuracion real de tiendas.json.

    FullH4rd no esta: el 2026-10-08 respondia con un desafio de Cloudflare a
    la IP desde donde se capturo, y queda cubierta solo con HTML sintetico.
    Cuando `python tests/capturar.py fullh4rd` funcione, se suma aca."""

    PATRONES = {"gamingcity": r"^[a-z0-9-]+--det--\d+$",
                "mexx": r"^https://www\.mexx\.com\.ar/productos-rubro/.+\.html$"}

    def test_listados_guardados(self):
        for clave, patron in self.PATRONES.items():
            with self.subTest(clave):
                html = leer(clave, "listado.html")
                items = indexar.tarjetas(html, TIENDAS[clave]["catalogo"])
                self.assertEqual(len(items), 4)
                for it in items:
                    self.assertRegex(it["url"], patron)
                    self.assertGreater(len(it["nombre"]), 3)
                    self.assertNotRegex(it["nombre"], r"[<>]|&[a-z]+;")
                    self.assertGreaterEqual(it["precio"], 1000)
                    self.assertIn(miles(it["precio"]), html)


class Catalogos(unittest.TestCase):
    def test_compragamer_sintetico_arma_la_url_y_la_foto(self):
        filas = [{"id_producto": 7913, "nombre": "Auriculares Redragon Ares H120 PC", "precioEspecial": 21350,
                  "precioLista": 24990, "imagenes": [{"nombre": "b", "orden": 2}, {"nombre": "a", "orden": 1}]},
                 {"id_producto": 1, "nombre": "Solo lista", "precioEspecial": None, "precioLista": 5000},
                 {"id_producto": 2, "nombre": "", "precioEspecial": 10}]
        with mock.patch.object(indexar, "bajar", return_value=json.dumps(filas)):
            items = indexar.indexar_json(TIENDAS["compragamer"])
        self.assertEqual([i["url"] for i in items], [
            "https://compragamer.com/producto/Auriculares_Redragon_Ares_H120_PC_7913",
            "https://compragamer.com/producto/Solo_lista_1"])
        self.assertEqual([i["precio"] for i in items], [21350, 5000])
        self.assertTrue(items[0]["imagen"].endswith("_a-grn.jpg"))

    def test_compragamer_guardado(self):
        filas = json.loads(leer("compragamer", "catalogo.json"))
        with mock.patch.object(indexar, "bajar", return_value=json.dumps(filas)):
            items = indexar.indexar_json(TIENDAS["compragamer"])
        esperadas = [f for f in filas if (f.get("precioEspecial") or f.get("precioLista")) and f.get("nombre")]
        self.assertGreaterEqual(len(esperadas), 5)
        self.assertEqual(len(items), len(esperadas))
        for it, f in zip(items, esperadas):
            self.assertEqual(it["precio"], int(f.get("precioEspecial") or f.get("precioLista")))
            self.assertTrue(it["url"].startswith("https://compragamer.com/producto/"))
            self.assertTrue(it["url"].endswith("_" + str(f["id_producto"])))

    def test_comparaya_guardado(self):
        cuerpo = json.loads(leer("comparaya", "api.json"))

        def bajar(u):
            return json.dumps(cuerpo if "page=1&" in u else {"data": []})

        with mock.patch.object(indexar, "bajar", bajar), mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_api(TIENDAS["comparaya"], 3)
        esperadas = [f for f in cuerpo["data"] if f.get("url") and f.get("price") and f.get("title")]
        self.assertGreaterEqual(len(esperadas), 3)
        self.assertEqual(len(items), len(esperadas))
        for it, f in zip(items, esperadas):
            self.assertEqual((it["url"], it["precio"], it["via"]), (f["url"], int(f["price"]), f.get("store_name")))
