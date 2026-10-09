import io
import json
import unittest
from contextlib import redirect_stdout
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

    def test_sellos_lee_las_senales_declaradas(self):
        cfg = {"sellos": {"i": "specifications.is_international", "o": "specifications.Tienda oficial",
                          "e": "specifications.Envío gratis"}}
        fila = {"specifications": {"is_international": True, "Envío gratis": True, "Tienda oficial": None}}
        self.assertEqual(indexar.sellos(fila, cfg), "ie")
        self.assertEqual(indexar.sellos({"specifications": {"is_international": "false"}}, cfg), "")
        self.assertEqual(indexar.sellos({"specifications": None}, cfg), "")
        self.assertEqual(indexar.sellos({}, cfg), "")
        self.assertEqual(indexar.sellos(fila, {}), "")

    def test_imagen_toma_la_de_menor_orden(self):
        cfg = {"campos": {"imagen": "imagenes"}, "imagen_url": "https://img.test/{nombre}"}
        fila = {"imagenes": [{"nombre": "b.jpg", "orden": 2}, {"nombre": "a.jpg", "orden": 1}]}
        self.assertEqual(indexar.imagen(fila, cfg), "https://img.test/a.jpg")
        self.assertEqual(indexar.imagen({}, cfg), "")


class TarjetasSinteticas(unittest.TestCase):
    """HTML minimo escrito a mano con la forma de cada tienda: valores exactos."""

    def test_gamingcity_precio_especial_alternativas_y_alt(self):
        html = ('<div class="product"><a href="memoria-kingston--det--123">'
                '<img src="https://www.gamingcity.com.ar/img/logo-envio.png" alt="x">'
                '<img data-src="https://www.gamingcity.com.ar/thumb/imagen_123_400x400.jpg" alt="x"></a>'
                '<p class="titprod">Memoria Kingston Fury 16GB DDR4</p>'
                '<span class="price-sales">$ 45.990</span><span class="price-standard">$ 52.000</span></div>'
                '<div class="product"><a href="mouse-x--det--9"><img alt="Mouse &amp; Pad"></a>'
                '<div class="price"><span>$ 9.500</span></div></div>'
                '<div class="product"><a href="sin-precio--det--5">Sin precio</a></div>')
        items = indexar.tarjetas(html, TIENDAS["gamingcity"]["catalogo"])
        self.assertEqual(items, [
            {"url": "memoria-kingston--det--123", "nombre": "Memoria Kingston Fury 16GB DDR4",
             "precio": 45990, "lista": 52000,
             "imagen": "https://www.gamingcity.com.ar/thumb/imagen_123_400x400.jpg"},
            {"url": "mouse-x--det--9", "nombre": "Mouse & Pad", "precio": 9500, "lista": None, "imagen": ""},
        ])

    def test_mexx(self):
        html = ('<div class="productos col"><a href="https://www.mexx.com.ar/productos-rubro/memorias/'
                'kingston-16gb.html"><img src="https://mexx-img-2019.s3.amazonaws.com/tumb_1_2.jpeg" '
                'class="img-fluid"></a><a href="https://www.mexx.com.ar/productos-rubro/memorias/'
                'kingston-16gb.html">Memoria Kingston 16GB</a><div class="price"><b>$45.000</b></div></div>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["mexx"]["catalogo"]), [
            {"url": "https://www.mexx.com.ar/productos-rubro/memorias/kingston-16gb.html",
             "nombre": "Memoria Kingston 16GB", "precio": 45000, "lista": None,
             "imagen": "https://mexx-img-2019.s3.amazonaws.com/tumb_1_2.jpeg"}])

    def test_fullh4rd(self):
        html = ('<article class="results-card"><h3 class="results-card__title">'
                '<a href="/prod/123/ssd-kingston-1tb">SSD Kingston 1TB</a></h3>'
                '<span class="results-card__price-current">$89.999</span>'
                '<span class="results-card__price-list">$99.999</span></article>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["fullh4rd"]["catalogo"]), [
            {"url": "/prod/123/ssd-kingston-1tb", "nombre": "SSD Kingston 1TB",
             "precio": 89999, "lista": 99999, "imagen": ""}])


class TarjetasReales(unittest.TestCase):
    """El HTML guardado de cada tienda con la configuracion real de tiendas.json.

    FullH4rd no esta: el 2026-10-08 respondia con un desafio de Cloudflare a
    la IP desde donde se capturo, y queda cubierta solo con HTML sintetico.
    Cuando `python tests/capturar.py fullh4rd` funcione, se suma aca."""

    PATRONES = {"gamingcity": r"^[a-z0-9-]+--det--\d+$",
                "mexx": r"^https://www\.mexx\.com\.ar/productos-rubro/.+\.html$"}
    # Vacia cuando la tienda no tiene foto: Gaming City muestra img-no-disponible.jpg.
    FOTOS = {"gamingcity": r"^(https://www\.gamingcity\.com\.ar/thumb/imagen_\d+_\d+x\d+\.jpg)?$",
             "mexx": r"^(https://mexx-img-2019\.s3\.amazonaws\.com/tumb_\d+_\d+\.\w+(\?\w+)?)?$"}

    def test_listados_guardados(self):
        for clave, patron in self.PATRONES.items():
            with self.subTest(clave):
                html = leer(clave, "listado.html")
                items = indexar.tarjetas(html, TIENDAS[clave]["catalogo"])
                self.assertEqual(len(items), 4)
                self.assertGreaterEqual(sum(1 for it in items if it["imagen"]), 3)
                for it in items:
                    self.assertRegex(it["url"], patron)
                    self.assertRegex(it["imagen"], self.FOTOS[clave])
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

    def test_compragamer_trae_el_part_number_de_su_catalogo(self):
        filas = [{"id_producto": 7411, "nombre": "Disco Solido SSD Kingston 480GB A400 SATA 500MB/s",
                  "precioEspecial": 136300, "precioLista": 151444, "codigo_principal": ["SKU: SA400S37/480G"]},
                 {"id_producto": 7412, "nombre": "Mouse", "precioEspecial": 100, "codigo_principal": None}]
        with mock.patch.object(indexar, "bajar", return_value=json.dumps(filas)):
            items = indexar.indexar_json(TIENDAS["compragamer"])
        self.assertEqual([i.get("sku") for i in items], ["SA400S37/480G", None])

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

        with mock.patch.object(indexar, "bajar", bajar), mock.patch.object(indexar.time, "sleep"), \
                redirect_stdout(io.StringIO()):
            items = indexar.indexar_api(TIENDAS["comparaya"], 3)
        esperadas = [f for f in cuerpo["data"] if f.get("url") and f.get("price") and f.get("title")]
        self.assertGreaterEqual(len(esperadas), 3)
        self.assertEqual(len(items), len(esperadas))
        for it, f in zip(items, esperadas):
            self.assertEqual((it["url"], it["precio"], it["via"]), (f["url"], int(f["price"]), f.get("store_name")))
            self.assertEqual(it["imagen"], f["image"])
        self.assertTrue(all(it["imagen"].startswith("https://") for it in items))
        # La quinta fila (Mercado Libre) es de tienda oficial y con envio gratis.
        self.assertEqual([it["sellos"] for it in items], ["", "", "", "", "oe"])

    def test_listados_completan_la_foto_relativa(self):
        cfg = json.loads(json.dumps(TIENDAS["gamingcity"]))
        cfg["catalogo"]["origen"] = {"tipo": "terminos", "plantilla": "https://gc.test/{termino}", "terminos": ["x"]}
        cfg["catalogo"]["re"]["imagen"] = 'data-src="([^"]+)"'
        html = ('<div class="product"><a href="mem--det--1"><img data-src="/thumb/imagen_1_400x400.jpg"></a>'
                '<p class="titprod">Memoria Kingston 16GB</p><span class="price-sales">$ 45.990</span></div>')
        with mock.patch.object(indexar, "bajar", side_effect=[html, ""]), mock.patch.object(indexar.time, "sleep"), \
                redirect_stdout(io.StringIO()):
            items = indexar.indexar_listados(cfg, 2)
        self.assertEqual(items[0]["imagen"], "https://www.gamingcity.com.ar/thumb/imagen_1_400x400.jpg")
