import io
import json
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import indexar
import modelo

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

    def test_sellos_marca_con_s_las_cuotas_sin_interes_que_la_fuente_informa(self):
        cfg = {"sellos": {"e": "specifications.Envío gratis", "s": "specifications.Sin interés"}}
        self.assertEqual(indexar.sellos({"specifications": {"Sin interés": True}}, cfg), "s")
        self.assertEqual(indexar.sellos({"specifications": {"Envío gratis": True, "Sin interés": True}}, cfg), "es")
        self.assertEqual(indexar.sellos({"specifications": {"Sin interés": False, "Cuotas": "6 cuotas"}}, cfg), "")
        self.assertEqual(indexar.sellos({"specifications": {"Cuotas": "6 cuotas"}}, cfg), "")    # con recargo o sin dato: no se afirma

    def test_tiendas_json_declara_el_sello_s_en_comparaya(self):
        cfg = json.loads((Path(__file__).resolve().parent.parent / "tiendas.json").read_text(encoding="utf-8"))
        self.assertEqual(cfg["comparaya"]["catalogo"]["sellos"]["s"], "specifications.Sin interés")

    def test_sellos_marca_con_u_lo_que_la_fuente_dice_que_es_usado_o_de_caja_abierta(self):
        cfg = {"sellos": {"e": "specifications.Envio gratis"},
               "usados": {"campo": "condition", "valores": ["open_box", "used", "refurbished", "refurbished_international"]}}
        self.assertEqual(indexar.sellos({"condition": "open_box", "specifications": {"Envio gratis": True}}, cfg), "eu")
        self.assertEqual(indexar.sellos({"condition": "refurbished"}, cfg), "u")
        self.assertEqual(indexar.sellos({"condition": "refurbished_international"}, cfg), "u")
        for normal in ("new", "new_international", None, ""):
            self.assertEqual(indexar.sellos({"condition": normal}, cfg), "", normal)
        self.assertEqual(indexar.sellos({}, cfg), "")
        self.assertEqual(indexar.sellos({"condition": "open_box"}, {}), "")          # sin configuracion no hay sello

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

    def test_venex(self):
        html = ('<div class="product-box" style=""><div class="product-box-media"><a href="https://www.venex.com.ar/x/y/mem.html">'
                '<img src="products_images/thumb/178_mem_4png" class="img-contained" alt="Memoria"></a></div>'
                '<h3 class="product-box-title"><a href="https://www.venex.com.ar/x/y/mem.html" onclick="enhancedClick(1)" >'
                'Memoria RAM Kingston DDR4 16GB 3200MHz</a></h3>'
                '<a class="product-box-price clearfix" href="https://www.venex.com.ar/x/y/mem.html"><span class="current-price" '
                'style="width:100%">$ 45.990</span></a></div>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["venex"]["catalogo"]), [
            {"url": "https://www.venex.com.ar/x/y/mem.html", "nombre": "Memoria RAM Kingston DDR4 16GB 3200MHz",
             "precio": 45990, "lista": None, "imagen": "products_images/thumb/178_mem_4png"}])

    def test_maximus(self):
        html = ('<article class="mxCardProduct"><a class="mxCardProduct__link" target="_self" '
                'href="https://www.maximus.com.ar/Producto/Pendrive-256GB-Kingston/ITEM=9865/maximus.aspx">'
                '<div class="mxCardProduct__media"><div class="mxCardProduct__imageBox"><img class="mxCardProduct__image" '
                'src="https://www.maximus.com.ar/Temp/App_WebSite/App_PictureFiles/Items/DTX-256GB_600.jpg" alt="Pendrive"></div></div>'
                '<div class="mxCardProduct__body"><h3 class="mxCardProduct__title">Pendrive 256GB Kingston Data Traveler Exodia USB 3.2</h3>'
                '<div class="mxCardProduct__prices"><div class="mxCardProduct__price">$61.830</div></div></div></a></article>'
                # La plantilla de Vue usa la misma clase pero con :href: no es un producto y se descarta.
                '<article class="mxCardProduct"><a class="mxCardProduct__link" :href="item.url">'
                '<h3 class="mxCardProduct__title" v-text="item.name"></h3></a></article>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["maximus"]["catalogo"]), [
            {"url": "https://www.maximus.com.ar/Producto/Pendrive-256GB-Kingston/ITEM=9865/maximus.aspx",
             "nombre": "Pendrive 256GB Kingston Data Traveler Exodia USB 3.2", "precio": 61830, "lista": None,
             "imagen": "https://www.maximus.com.ar/Temp/App_WebSite/App_PictureFiles/Items/DTX-256GB_600.jpg"}])

    def test_maximus_recorre_cada_pagina_del_sitemap_una_vez(self):
        # Maximus publica cada pagina de cada categoria en su sitemap (PAGE=1, PAGE=2...): "pagina" es la misma URL y
        # el segundo pedido repite productos, asi que el recorrido pasa al siguiente listado sin inventar paginas.
        cfg = TIENDAS["maximus"]["catalogo"]
        self.assertEqual(cfg["pagina"].format(listado="https://x.test/a/PAGE=2/", n=7), "https://x.test/a/PAGE=2/")

    def test_listados_del_sitemap_con_excluye_y_hojas(self):
        sitemap = ("<urlset>" + "".join(f"<url><loc>{u}</loc></url>" for u in (
            "https://t.test", "https://t.test/comp", "https://t.test/comp/ram", "https://t.test/comp/ram/desktop",
            "https://t.test/comp/ram/desktop/kingston-16gb.html", "https://t.test/comp/ssd",
            "https://t.test/monitores", "https://t.test/quienes-somos.htm")) + "</urlset>")
        tienda = {"catalogo": {"origen": {"tipo": "sitemap", "url": "https://t.test/sitemap.xml",
                                          "contiene": "https://t.test/", "excluye": [".html", ".htm"], "hojas": True}}}
        with mock.patch.object(indexar, "bajar", return_value=sitemap):
            self.assertEqual(sorted(indexar.listados(tienda)),
                             ["https://t.test/comp/ram/desktop", "https://t.test/comp/ssd", "https://t.test/monitores"])

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
                "mexx": r"^https://www\.mexx\.com\.ar/productos-rubro/.+\.html$",
                "venex": r"^https://www\.venex\.com\.ar/.+\.html$",
                "maximus": r"^https://www\.maximus\.com\.ar/Producto/.+/ITEM=\d+/maximus\.aspx$"}
    # Vacia cuando la tienda no tiene foto: Gaming City muestra img-no-disponible.jpg.
    FOTOS = {"gamingcity": r"^(https://www\.gamingcity\.com\.ar/thumb/imagen_\d+_\d+x\d+\.jpg)?$",
             "mexx": r"^(https://mexx-img-2019\.s3\.amazonaws\.com/tumb_\d+_\d+\.\w+(\?\w+)?)?$",
             "venex": r"^(products_images/thumb/[\w.]+)?$",
             "maximus": r"^(https://www\.maximus\.com\.ar/Temp/App_WebSite/App_PictureFiles/Items/[\w.%-]+)?$"}

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
        # Samsung Shop, Naldo y Cetrogar informan "Sin interes" (s). La quinta fila (Mercado Libre) es de tienda oficial y con
        # envio gratis; dice "6 cuotas" sin aclarar interes, y eso no se afirma.
        self.assertEqual([it["sellos"] for it in items], ["", "s", "s", "s", "oe"])

    def test_comparaya_deja_afuera_lo_que_el_propio_agregador_marca_sin_stock(self):
        # Caso real (18/10): ComparaYa informa "availability" por aviso. Lo que dice sin stock no entra; lo que no lo
        # dice, o dice en stock, entra (el dato puede estar viejo: la Omen 16 caida figuraba "in_stock").
        fila = lambda n, disp: {"title": "Notebook " + n, "price": 1000, "url": "https://t.test/" + n,
                                "store_name": "X", **({"availability": disp} if disp else {})}
        cuerpo = {"data": [fila("a", "in_stock"), fila("b", "out_of_stock"), fila("c", None), fila("d", "discontinued")]}

        def bajar(u):
            return json.dumps(cuerpo if "page=1&" in u else {"data": []})

        cfg = json.loads(json.dumps(TIENDAS["comparaya"]))
        cfg["catalogo"]["categorias"] = ["notebooks"]
        with mock.patch.object(indexar, "bajar", bajar), mock.patch.object(indexar.time, "sleep"), \
                redirect_stdout(io.StringIO()):
            items = indexar.indexar_api(cfg, 3)
        self.assertEqual([it["url"][-1] for it in items], ["a", "c"])

    def test_tiendas_json_declara_la_disponibilidad_de_comparaya(self):
        cfg = json.loads((Path(__file__).resolve().parent.parent / "tiendas.json").read_text(encoding="utf-8"))
        self.assertEqual(cfg["comparaya"]["catalogo"]["sin_stock"]["campo"], "availability")
        self.assertIn("out_of_stock", cfg["comparaya"]["catalogo"]["sin_stock"]["valores"])

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


class Woocommerce(unittest.TestCase):
    """Tiendas WooCommerce por su Store API publica (/wp-json/wc/store/v1/products): una sola lectura para todas."""

    TIENDA = {"nombre": "Test", "base": "https://t.test",
              "catalogo": {"tipo": "woocommerce", "por_pagina": 2, "tope_paginas": 10}}

    @staticmethod
    def producto(i, precio="95355400", regular=None, stock=True, nombre=None, imagen=True):
        return {"id": i, "name": nombre or f"Memoria Kingston Fury 16GB DDR4 &#8211; {i}",
                "permalink": f"https://t.test/producto/mem-{i}/", "sku": f"KF432C16BB/{i}",
                "is_in_stock": stock, "is_purchasable": True,
                "prices": {"price": precio, "regular_price": regular or precio, "currency_minor_unit": 2},
                "images": [{"src": f"https://t.test/img/{i}.jpg", "thumbnail": f"https://t.test/img/{i}-300x300.jpg"}] if imagen else []}

    def test_lee_nombre_precio_lista_url_foto_y_sku(self):
        paginas = {1: [self.producto(1, "4599000", "5299000"), self.producto(2, imagen=False)], 2: []}
        with mock.patch.object(indexar, "bajar", side_effect=lambda u: "﻿" + json.dumps(paginas[int(u.rsplit("=", 1)[1])])), \
                mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_woocommerce(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual(items[0], {"nombre": "Memoria Kingston Fury 16GB DDR4 – 1", "precio": 45990, "lista": 52990,
                                    "url": "https://t.test/producto/mem-1/", "imagen": "https://t.test/img/1-300x300.jpg",
                                    "sellos": "", "sku": modelo.sku_de("KF432C16BB/1"), "sku_tienda": None})
        self.assertEqual(items[1]["precio"], 953554)
        self.assertIsNone(items[1]["lista"], "sin rebaja no hay precio de lista")
        self.assertEqual(items[1]["imagen"], "")

    def test_pide_paginas_de_la_store_api_hasta_que_vuelve_vacia(self):
        pedidas = []
        paginas = {1: [self.producto(1), self.producto(2)], 2: [self.producto(3)], 3: []}

        def bajar(url):
            pedidas.append(url)
            return json.dumps(paginas[int(url.rsplit("=", 1)[1])])
        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_woocommerce(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual(len(items), 3)
        self.assertEqual(pedidas[0], "https://t.test/wp-json/wc/store/v1/products?per_page=2&page=1")
        self.assertEqual(len(pedidas), 3)

    def test_saltea_sin_stock_sin_precio_y_repetidos(self):
        paginas = {1: [self.producto(1, stock=False), self.producto(2, precio="0"), self.producto(3), self.producto(3)], 2: []}
        with mock.patch.object(indexar, "bajar", side_effect=lambda u: json.dumps(paginas[int(u.rsplit("=", 1)[1])])), \
                mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_woocommerce(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual([it["url"] for it in items], ["https://t.test/producto/mem-3/"])

    def test_el_tope_es_el_de_la_tienda_y_no_el_de_paginas_por_categoria(self):
        # El workflow indexa con --max-paginas 12 (paginas por categoria de los listados). WooCommerce no tiene
        # categorias y pagina de a 100: aplicarle ese 12 cortaba Max Tecno en 1.200 de 5.954 (corrida del 16/10).
        with mock.patch.object(indexar, "bajar", side_effect=lambda u: json.dumps([self.producto(int(u.rsplit("=", 1)[1]))])), \
                mock.patch.object(indexar.time, "sleep"):
            self.assertEqual(len(indexar.indexar_woocommerce(self.TIENDA, 12)), 10)
            self.assertEqual(len(indexar.indexar_woocommerce(self.TIENDA, 3)), 10)

    def test_una_pagina_que_falla_corta_sin_voltear_lo_ya_leido(self):
        def bajar(url):
            if url.endswith("page=2"):
                raise urllib.error.URLError("caida")
            return json.dumps([self.producto(1)])
        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"):
            self.assertEqual(len(indexar.indexar_woocommerce(self.TIENDA, indexar.TOPE_PAGINAS)), 1)

    def test_paginacion_por_categorias_cuando_la_tienda_la_pide(self):
        # The Gamer Shop corta la paginacion plana con un 400 propio ("usá la búsqueda o las
        # categorías"): con paginacion=categorias se recorren las categorias de la Store API.
        TIENDA = {"nombre": "Test", "base": "https://t.test",
                  "catalogo": {"tipo": "woocommerce", "por_pagina": 2, "tope_paginas": 10,
                               "paginacion": "categorias"}}
        categorias = [{"id": 7, "name": "Memorias", "count": 4},
                      {"id": 9, "name": "Vacia", "count": 0}]
        pedidas = []

        def bajar(url):
            pedidas.append(url)
            if "categories" in url:
                return json.dumps(categorias if url.endswith("page=1") else [])
            cat = int(url.split("category=")[1].split("&")[0])
            n = int(url.rsplit("=", 1)[1])
            return json.dumps([self.producto(10 * cat + n)] if n == 1 else [])

        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_woocommerce(TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual({it["url"] for it in items},
                         {f"https://t.test/producto/mem-{10 * 7 + 1}/"})
        self.assertEqual([u for u in pedidas if "category=" in u],
                         ["https://t.test/wp-json/wc/store/v1/products?category=7&per_page=2&page=1",
                          "https://t.test/wp-json/wc/store/v1/products?category=7&per_page=2&page=2"])
        self.assertTrue(any("categories" in u for u in pedidas), "hay que leer las categorias de la API")

    def test_una_hoja_mas_grande_que_el_tope_se_completa_por_precio_desde_cada_punta(self):
        # The Gamer Shop corta tambien dentro de una categoria desde la pagina 11 (400 tgs_paginacion): Mouse
        # tiene 292 productos y una pasada trae 200. Ordenada por precio de cada punta trae lo que faltaba.
        TIENDA = {"nombre": "Test", "base": "https://t.test",
                  "catalogo": {"tipo": "woocommerce", "por_pagina": 1, "tope_paginas": 10,
                               "paginacion": "categorias"}}
        orden = {"": [3, 1, 4], "asc": [1, 2, 3], "desc": [6, 5, 4]}   # la tienda deja ver 2 por listado
        pedidas = []

        def bajar(url):
            pedidas.append(url)
            if "categories" in url:
                return json.dumps([{"id": 7, "name": "Mouse", "count": 6}] if url.endswith("page=1") else [])
            n = int(url.rsplit("=", 1)[1])
            if n > 2:
                raise urllib.error.HTTPError(url, 400, "tgs_paginacion", {}, None)
            clave = url.split("order=")[1].split("&")[0] if "order=" in url else ""
            return json.dumps([self.producto(orden[clave][n - 1])])

        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_woocommerce(TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual(sorted(it["url"] for it in items),
                         [f"https://t.test/producto/mem-{i}/" for i in (1, 2, 3, 5, 6)])
        self.assertEqual(len(items), 5, "un producto visto en dos pasadas va una sola vez")
        self.assertIn("https://t.test/wp-json/wc/store/v1/products?category=7&per_page=1&orderby=price&order=desc&page=1",
                      pedidas)

    def test_lo_mas_vendido_sale_del_orden_por_popularidad_de_la_tienda(self):
        # Spec 019: el puesto de cada aviso en el orden «mas vendidos» de la propia tienda (orderby=popularity, ventas
        # totales). Solo los primeros TOPE_VENDIDOS: mas abajo el orden ya no dice nada.
        pedidas = []

        def bajar(url):
            pedidas.append(url)
            n = int(url.rsplit("=", 1)[1])
            return json.dumps([self.producto(10 * n + i) for i in range(2)] if n <= 2 else [])

        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"), \
                mock.patch.object(indexar, "TOPE_VENDIDOS", 3):
            puestos = indexar.vendidos(dict(self.TIENDA, catalogo={"tipo": "woocommerce", "por_pagina": 2}))
        self.assertEqual(puestos, {"https://t.test/producto/mem-10/": 1, "https://t.test/producto/mem-11/": 2,
                                   "https://t.test/producto/mem-20/": 3})
        self.assertEqual(pedidas[0], "https://t.test/wp-json/wc/store/v1/products?orderby=popularity&per_page=2&page=1")
        self.assertEqual(len(pedidas), 2, "con el tope cubierto no se piden mas paginas")

    def test_sin_orden_de_mas_vendidos_no_hay_puestos(self):
        with mock.patch.object(indexar, "bajar", side_effect=urllib.error.HTTPError("u", 400, "no", {}, None)):
            self.assertEqual(indexar.vendidos(self.TIENDA), {})
        self.assertEqual(indexar.vendidos({"nombre": "X", "base": "https://x.test", "catalogo": {"tipo": "json"}}), {})

    def test_el_sku_con_prefijo_de_mayorista_del_json_real(self):
        # GoldenTech publica "IC_RE305" (TP-Link RE305); Katech, codigos internos ("CM5012") que no son part number
        for clave, esperado in (("goldentech", "RE305"), ("katech", None)):
            with self.subTest(clave), mock.patch.object(indexar, "bajar", side_effect=[leer(clave, "store-api.json"), "[]"]),                     mock.patch.object(indexar.time, "sleep"):
                items = indexar.indexar_woocommerce(TIENDAS[clave], indexar.TOPE_PAGINAS)
            skus = {it["sku_tienda"] for it in items}
            self.assertIn(esperado, skus) if esperado else self.assertEqual(skus, {None})

    def test_el_json_real_guardado_de_cada_tienda_woocommerce(self):
        for clave, t in TIENDAS.items():
            if clave.startswith("_") or t["catalogo"]["tipo"] != "woocommerce":
                continue
            with self.subTest(clave):
                crudo = leer(clave, "store-api.json")
                if t["catalogo"].get("paginacion") == "categorias":
                    # con paginacion por categorias, la primera lectura es la de las categorias;
                    # despues cada categoria pide su pagina 1 (el crudo) y mas paginas que vuelven vacias
                    effects = [leer(clave, "categorias.json"), crudo] + ["[]"] * 50
                else:
                    effects = [crudo, "[]"]
                with mock.patch.object(indexar, "bajar", side_effect=effects), mock.patch.object(indexar.time, "sleep"):
                    items = indexar.indexar_woocommerce(t, indexar.TOPE_PAGINAS)
                self.assertGreaterEqual(len(items), 3)
                for it in items:
                    self.assertTrue(it["url"].startswith(t["base"].replace("://www.", "://")) or it["url"].startswith(t["base"]), it["url"])
                    self.assertGreaterEqual(it["precio"], 1000)
                    self.assertNotRegex(it["nombre"], r"[<>]|&[a-z#0-9]+;")


class Robots(unittest.TestCase):
    """robots.txt manda: la API de una tienda se lee solo si el grupo de cualquier robot (*) no la prohibe."""

    BUSQUEDA = "/api/catalog_system/pub/products/search"

    def test_robots_reales(self):
        self.assertFalse(indexar.robots_permite(leer("cetrogar", "robots.txt"), self.BUSQUEDA), "Cetrogar: Disallow /api/")
        # OnCity prohibe todo a ClaudeBot y otros por nombre, pero no al grupo *: la API queda permitida
        self.assertTrue(indexar.robots_permite(leer("oncity", "robots.txt"), self.BUSQUEDA))
        self.assertFalse(indexar.robots_permite(leer("oncity", "robots.txt"), "/checkout/cart"))

    def test_comodines_fin_de_ruta_y_la_regla_mas_larga(self):
        texto = "User-agent: *\nDisallow: /*api*\nAllow: /api/catalog_system/pub/\nDisallow: /x$\n"
        self.assertTrue(indexar.robots_permite(texto, self.BUSQUEDA), "Allow mas largo gana")
        self.assertFalse(indexar.robots_permite(texto, "/otra/api/"))
        self.assertFalse(indexar.robots_permite(texto, "/x"))
        self.assertTrue(indexar.robots_permite(texto, "/xy"))

    def test_un_robots_con_bom_se_lee_igual(self):
        self.assertFalse(indexar.robots_permite("\ufeffUser-agent: *\nDisallow: /\n", self.BUSQUEDA))

    def test_solo_cuenta_el_grupo_de_cualquier_robot(self):
        texto = ("User-agent: Googlebot\nDisallow: /api/\n\n# comentario\nUser-agent: *\nUser-agent: GPTBot\n"
                 "Disallow: /api/  # todo\nDisallow:\n")
        self.assertFalse(indexar.robots_permite(texto, self.BUSQUEDA))
        self.assertTrue(indexar.robots_permite("User-agent: Googlebot\nDisallow: /\n", self.BUSQUEDA))
        self.assertTrue(indexar.robots_permite("", self.BUSQUEDA))
        self.assertTrue(indexar.robots_permite("User-agent: *\nDisallow:\n", self.BUSQUEDA))


class Vtex(unittest.TestCase):
    """Tiendas VTEX por su API publica de catalogo: una sola lectura para todas (OnCity, Naldo, Pardo...)."""

    TIENDA = {"nombre": "OnCity", "base": "https://www.oncity.com", "catalogo": {"tipo": "vtex"}}

    def test_categorias_de_tecnologia_del_arbol_real(self):
        cats = indexar.categorias_vtex(json.loads(leer("oncity", "arbol.json")))
        self.assertIn("/14/100/481/", cats, "celulares")
        self.assertIn("/14/102/484/", cats, "notebooks")
        self.assertIn("/14/105/501/", cats, "monitores")
        self.assertIn("/14/103/493/", cats, "monitores gamer")
        self.assertIn("/14/106/510/", cats, "perifericos: placas de video")
        self.assertIn("/14/106/508/", cats, "perifericos: mouse")
        self.assertNotIn("/14/100/483/", cats, "accesorios para celulares: no")
        self.assertNotIn("/14/100/482/", cats, "cargadores y cables: no")
        self.assertNotIn("/14/103/495/", cats, "videojuegos: no")
        self.assertFalse([c for c in cats if c.startswith("/566/")], "compra internacional: no")
        self.assertEqual(len(cats), len(set(cats)))

    def test_categorias_de_los_arboles_reales_sin_falsos_positivos(self):
        """Lo que se colaba con la primera regla, medido desde GitHub el 19/10."""
        def rutas(clave):
            arbol, url = json.loads(leer(clave, "arbol.json")), {}

            def recorrer(nodos, ids):
                for n in nodos:
                    url["/" + "/".join(ids + [str(n["id"])]) + "/"] = n["url"].split("/", 3)[-1]
                    recorrer(n.get("children") or [], ids + [str(n["id"])])
            recorrer(arbol, [])
            return [url[c] for c in indexar.categorias_vtex(arbol)]
        self.assertEqual(rutas("easy"), [], "Easy: 'almacenamiento' son frascos de cocina")
        self.assertEqual(rutas("authogar"), ["tv-y-celulares/celulares-libres/celulares-libres",
                                             "tecnologia-e-informatica/informatica/all-in-one",
                                             "tecnologia-e-informatica/informatica/notebooks",
                                             "tecnologia-e-informatica/informatica/pc-y-monitores",
                                             "tecnologia-e-informatica/informatica/tablets"],
                         "ni televisores (tv-y-celulares), ni consolas, ni escritorios-pc de muebles")
        self.assertEqual(rutas("compracierta"), ["tecnologia/monitores", "tecnologia/pc", "tecnologia/notebooks"],
                         "los procesadores de alimentos no")
        self.assertNotIn("seguros---garantias/garex-max-celulares", rutas("pardo"))
        self.assertIn("telefonia/celulares", rutas("pardo"))
        self.assertFalse([r for r in rutas("bringeri") if "componentes" in r], "minicomponentes de audio no")
        self.assertNotIn("electro-y-tecnologia/informatica-y-gaming/consolas-y-joysticks", rutas("carrefour"))
        self.assertIn("electro-y-tecnologia/informatica-y-gaming/teclados-y-mouse", rutas("carrefour"))

    def test_una_madre_que_mezcla_accesorios_con_celulares_no_corta_sus_hojas(self):
        # Coppel: "celulares-telefonos-y-accesorios" contiene "accesorios" y se perdia la rama entera (revision del 19/10)
        cats = indexar.categorias_vtex(json.loads(leer("coppel", "arbol.json")))
        self.assertIn("/133909/134389/", cats, "celulares")
        self.assertNotIn("/133909/134417/134419/", cats, "smartwatch no nombra un rubro y su madre mezcla: no arrastra")
        self.assertNotIn("/133909/133910/", cats, "fundas y accesorios: no")
        self.assertNotIn("/133909/134348/", cats, "telefonos fijos: no")
        oncity = indexar.categorias_vtex(json.loads(leer("oncity", "arbol.json")))
        self.assertNotIn("/14/109/517/", oncity, "tecnologia/accesorios/bases-para-notebooks: la madre de accesorios corta")

    def test_las_categorias_se_pueden_elegir_por_tienda(self):
        cats = indexar.categorias_vtex(json.loads(leer("oncity", "arbol.json")), rubros=("drones",), ambiguos=())
        self.assertEqual(cats, ["/14/108/"], "una categoria sin hijas se pide entera")

    def bajar_falso(self, paginas, robots="User-agent: *\nDisallow: /checkout/\n", pedidas=None):
        arbol = json.dumps([{"id": 1, "name": "Tecnologia", "url": "https://www.oncity.com/tecnologia", "children": [
            {"id": 2, "name": "Celulares", "url": "https://www.oncity.com/tecnologia/celulares", "children": []},
            {"id": 3, "name": "Notebooks", "url": "https://www.oncity.com/tecnologia/notebooks", "children": []}]}])

        def bajar(url):
            if pedidas is not None:
                pedidas.append(url)
            if url.endswith("/robots.txt"):
                if isinstance(robots, Exception):
                    raise robots
                return robots
            if "/category/tree/" in url:
                return arbol
            cat = url.split("fq=C:")[1].split("&")[0]
            desde = int(url.split("_from=")[1].split("&")[0])
            return json.dumps(paginas.get((cat, desde), []))
        return bajar

    def test_lee_el_json_real_guardado(self):
        crudo = json.loads(leer("oncity", "busqueda.json"))
        with mock.patch.object(indexar, "bajar", side_effect=self.bajar_falso({("/1/2/", 0): crudo})), \
                mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual(len(items), 4)
        moto = items[0]
        self.assertEqual(moto["nombre"], "Celular Motorola Moto G06 4G 4 Gb 64 Gb Nfc Tapestry")
        self.assertEqual(moto["precio"], 199999)
        self.assertEqual(moto["lista"], 259999, "ListPrice mayor que Price: rebaja")
        self.assertEqual(moto["url"], "https://www.oncity.com/celular-motorola-moto-g06-4g-4-gb-64-gb-nfc-tapestry-158039/p")
        self.assertTrue(moto["imagen"].startswith("https://"))
        self.assertIsNone(moto["sku_tienda"], "OnCity usa un numero interno como RefId: no es part number")
        # el iPhone lo vende un tercero (el vendedor por defecto) y el segundo vendedor no tiene stock
        self.assertEqual(items[2]["precio"], 4149999)
        for it in items:
            self.assertTrue(indexar.url_valida(it["url"]))

    def test_lo_mas_vendido_de_cada_categoria_vtex(self):
        # Spec 019: en VTEX el orden «mas vendidos» (O=OrderByTopSaleDESC) es por categoria; un aviso en dos categorias
        # se queda con su mejor puesto. Cuenta el puesto aunque el aviso no tenga stock: es el orden de la tienda.
        por_categoria = {"/14/100/481/": [{"link": "/celu-a/p"}, {"link": "/celu-b/p"}],
                         "/14/102/484/": [{"link": "/note-a/p"}, {"link": "/celu-b/p"}]}
        pedidas = []

        def bajar(url):
            pedidas.append(url)
            if "/category/tree/" in url:
                return leer("oncity", "arbol.json")
            if url.endswith("/robots.txt"):
                return ""
            return json.dumps(por_categoria.get(url.split("fq=C:")[1].split("&")[0], []))

        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"):
            puestos = indexar.vendidos(self.TIENDA)
        self.assertEqual(puestos, {"https://www.oncity.com/celu-a/p": 1, "https://www.oncity.com/celu-b/p": 2,
                                   "https://www.oncity.com/note-a/p": 1})
        self.assertIn("https://www.oncity.com/api/catalog_system/pub/products/search?fq=C:/14/100/481/&O=OrderByTopSaleDESC"
                      f"&_from=0&_to={indexar.POR_PEDIDO_VTEX - 1}", pedidas)

    def test_el_json_real_guardado_de_cada_tienda_vtex(self):
        """robots.txt, arbol y primera busqueda tal como los vio GitHub el 19/10 (diagnostico --vtex-catalogo)."""
        vtex = {k: t for k, t in TIENDAS.items() if not k.startswith("_") and t["catalogo"]["tipo"] == "vtex"}
        self.assertGreaterEqual(len(vtex), 13)
        con_busqueda = 0
        for clave, t in vtex.items():
            with self.subTest(clave):
                self.assertEqual(t["color"], "vt")
                self.assertTrue(indexar.robots_permite(leer(clave, "robots.txt"), indexar.API_VTEX + "products/search"))
                self.assertTrue(indexar.categorias_vtex(json.loads(leer(clave, "arbol.json"))))
                if not (FIX / clave / "busqueda.json").exists():
                    continue        # BGH: la primera categoria de su arbol estaba vacia
                con_busqueda += 1
                crudo = json.loads(leer(clave, "busqueda.json"))
                items = [it for it in (indexar.item_vtex(p, t["base"]) for p in crudo) if it]
                self.assertGreaterEqual(len(items), 3)
                for it in items:
                    self.assertTrue(it["url"].startswith(t["base"] + "/"), it["url"])
                    self.assertTrue(indexar.url_valida(it["url"]))
                    self.assertGreaterEqual(it["precio"], 10000)
                    self.assertNotRegex(it["nombre"], r"[<>]|&[a-z#0-9]+;")
        self.assertGreaterEqual(con_busqueda, 12)

    def test_el_refid_vale_como_part_number_solo_con_forma_de_codigo(self):
        def skus(clave):
            return {it["sku_tienda"] for it in (indexar.item_vtex(p, "https://x") for p in json.loads(leer(clave, "busqueda.json"))) if it}
        self.assertIn("NP940XFG-KA1AR", skus("pardo"), "Samsung Galaxy Book3 Pro")
        self.assertIn("27GS60F", skus("lg"))
        self.assertEqual(skus("naldo"), {None}, "Naldo: numeros internos")

    def test_saltea_sin_stock_sin_precio_repetidos_y_sin_lista_si_no_hay_rebaja(self):
        crudo = json.loads(leer("oncity", "busqueda.json"))
        sin_stock, sin_precio, igual = (json.loads(json.dumps(crudo[i])) for i in (0, 1, 2))
        sin_stock["items"][0]["sellers"][0]["commertialOffer"]["AvailableQuantity"] = 0
        sin_precio["items"][0]["sellers"][0]["commertialOffer"]["Price"] = 0
        oferta = igual["items"][0]["sellers"][0]["commertialOffer"]
        oferta["ListPrice"] = oferta["Price"]
        paginas = {("/1/2/", 0): [sin_stock, sin_precio, igual], ("/1/3/", 0): [igual, crudo[3]]}
        with mock.patch.object(indexar, "bajar", side_effect=self.bajar_falso(paginas)), mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual([it["precio"] for it in items], [4149999, 2520000])
        self.assertIsNone(items[0]["lista"])

    def test_pagina_de_a_50_por_categoria_hasta_que_vuelve_corta(self):
        fila = json.loads(leer("oncity", "busqueda.json"))[0]

        def copia(i):
            f = json.loads(json.dumps(fila))
            f["link"] = f"https://www.oncity.com/cel-{i}/p"
            return f
        pedidas = []
        paginas = {("/1/2/", 0): [copia(i) for i in range(50)], ("/1/2/", 50): [copia(50 + i) for i in range(3)]}
        with mock.patch.object(indexar, "bajar", side_effect=self.bajar_falso(paginas, pedidas=pedidas)), \
                mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual(len(items), 53)
        busquedas = [u for u in pedidas if "/products/search" in u]
        self.assertEqual(busquedas[0], "https://www.oncity.com/api/catalog_system/pub/products/search?fq=C:/1/2/&_from=0&_to=49")
        self.assertEqual(busquedas[1], "https://www.oncity.com/api/catalog_system/pub/products/search?fq=C:/1/2/&_from=50&_to=99")
        self.assertEqual(len(busquedas), 3, "la segunda pagina vino corta: no se pide una tercera; despues, notebooks")

    def test_si_robots_lo_prohibe_no_se_lee_nada(self):
        pedidas = []
        with mock.patch.object(indexar, "bajar", side_effect=self.bajar_falso({}, robots=leer("cetrogar", "robots.txt"),
                                                                             pedidas=pedidas)):
            with self.assertRaisesRegex(RuntimeError, "robots.txt"):
                indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual(len(pedidas), 1)

    def test_robots_que_no_existe_permite_y_uno_que_no_responde_frena(self):
        no_existe = urllib.error.HTTPError("u", 404, "no", {}, None)
        with mock.patch.object(indexar, "bajar", side_effect=self.bajar_falso({}, robots=no_existe)), \
                mock.patch.object(indexar.time, "sleep"):
            self.assertEqual(indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS), [])
        for error in (urllib.error.HTTPError("u", 403, "no", {}, None), urllib.error.URLError("caida")):
            with self.subTest(error), mock.patch.object(indexar, "bajar", side_effect=self.bajar_falso({}, robots=error)):
                with self.assertRaises(RuntimeError):
                    indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)

    def test_un_bloqueo_falla_la_tienda_y_un_error_solo_corta_la_categoria(self):
        # Un catalogo a medias no puede entrar como relevamiento del dia: el historial veria como bajas todo lo que no
        # se llego a leer. Que falle: main reusa lo anterior de la tienda (revision del 19/10).
        fila = json.loads(leer("oncity", "busqueda.json"))[0]
        base = self.bajar_falso({("/1/2/", 0): [fila]})

        def con_error(error):
            def bajar(url):
                if "C:/1/3/" in url:
                    raise error
                return base(url)
            return bajar
        with mock.patch.object(indexar, "bajar", side_effect=con_error(urllib.error.HTTPError("u", 429, "no", {}, None))), \
                mock.patch.object(indexar.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "429"):
                indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)
        with mock.patch.object(indexar, "bajar", side_effect=con_error(urllib.error.URLError("caida"))), \
                mock.patch.object(indexar.time, "sleep"):
            self.assertEqual(len(indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)), 1)

    def test_json_con_bom_o_con_formas_raras_no_tumba_la_tienda(self):
        fila = json.loads(leer("oncity", "busqueda.json"))[0]
        rara = {"items": [{"sellers": [{"commertialOffer": {"Price": 1000, "AvailableQuantity": 1}}],
                           "images": "x", "referenceId": [None]}], "link": "https://www.oncity.com/r/p", "productName": "Raro"}
        raras = [{"items": [None]}, {"items": {"a": 1}}, {"items": [{"sellers": [{"commertialOffer": "x"}]}]},
                 {"items": [{"sellers": "x"}]}, rara]
        base = self.bajar_falso({("/1/2/", 0): raras + [fila]})
        with mock.patch.object(indexar, "bajar", side_effect=lambda u: "\ufeff" + base(u)), \
                mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_vtex(self.TIENDA, indexar.TOPE_PAGINAS)
        self.assertEqual([it["nombre"] for it in items], ["Raro", "Celular Motorola Moto G06 4G 4 Gb 64 Gb Nfc Tapestry"])

    def test_oferta_vtex_elige_el_vendedor_por_defecto_de_la_primera_variante_con_stock(self):
        p = {"items": [{"sellers": [{"sellerDefault": True, "commertialOffer": {"Price": 0, "AvailableQuantity": 0}}]},
                       {"sellers": [{"sellerDefault": False, "commertialOffer": {"Price": 0, "AvailableQuantity": 0}},
                                    {"sellerDefault": True, "commertialOffer": {"Price": 4149999.0, "ListPrice": 6484042.0,
                                                                                 "AvailableQuantity": 10}}]}]}
        precio, lista, variante = indexar.oferta_vtex(p)
        self.assertEqual((precio, lista), (4149999, 6484042))
        self.assertIs(variante, p["items"][1])
        self.assertIsNone(indexar.oferta_vtex({"items": [p["items"][0]]}))

    def test_el_tope_de_paginas_es_el_de_la_tienda(self):
        fila = json.loads(leer("oncity", "busqueda.json"))[0]

        def bajar(url):
            if "/products/search" not in url:
                return self.bajar_falso({})(url)
            desde = int(url.split("_from=")[1].split("&")[0])
            filas = []
            for i in range(50):
                f = json.loads(json.dumps(fila))
                f["link"] = f"https://www.oncity.com/{url.split('C:')[1][:6]}-{desde + i}/p"
                filas.append(f)
            return json.dumps(filas)
        tienda = {**self.TIENDA, "catalogo": {"tipo": "vtex", "tope_paginas": 3}}
        with mock.patch.object(indexar, "bajar", side_effect=bajar), mock.patch.object(indexar.time, "sleep"):
            self.assertEqual(len(indexar.indexar_vtex(tienda, 12)), 300, "3 paginas por categoria, 2 categorias")


class Descarga(unittest.TestCase):
    def test_un_corte_a_mitad_de_respuesta_se_reintenta_una_vez(self):
        # Gaming City cayo entera el 16/10 por un IncompleteRead: un corte de red no es un bloqueo.
        import http.client
        respuesta = mock.MagicMock()
        respuesta.__enter__.return_value.read.side_effect = [http.client.IncompleteRead(b"x"), "ok".encode()]
        with mock.patch.object(indexar.urllib.request, "urlopen", return_value=respuesta), mock.patch.object(indexar.time, "sleep"):
            self.assertEqual(indexar.bajar("https://t.test/"), "ok")

    def test_dos_cortes_seguidos_se_informan_como_error_de_red(self):
        import http.client
        respuesta = mock.MagicMock()
        respuesta.__enter__.return_value.read.side_effect = http.client.IncompleteRead(b"x")
        with mock.patch.object(indexar.urllib.request, "urlopen", return_value=respuesta), mock.patch.object(indexar.time, "sleep"):
            with self.assertRaises(OSError):
                indexar.bajar("https://t.test/")


class NombreEnriquecido(unittest.TestCase):
    """ComparaYa publica la marca y las especificaciones en campos aparte; muchos titulos no las dicen."""

    def test_agrega_la_marca_que_el_titulo_no_dice(self):
        self.assertEqual(indexar.nombre_enriquecido('Monitor Gaming 25" FHD 240Hz con panel IPS', "Samsung"),
                         'Monitor Gaming 25" FHD 240Hz con panel IPS Samsung')

    def test_la_marca_va_al_final_para_no_partir_el_rubro_ni_el_chip(self):
        import modelo
        for titulo, rubro in (("Placa de Video RTX 4060 8GB", "gpu"), ("Disco Solido SSD 1TB NVMe", "ssd"), ("Placa Madre B650M AM5", "mb")):
            n = indexar.nombre_enriquecido(titulo, "MSI")
            self.assertTrue(n.startswith(titulo), n)
            self.assertEqual(modelo.rubro_de(n), rubro, n)
        self.assertIn("RTX 4060", indexar.nombre_enriquecido("RTX 4060 8GB", "MSI"))

    def test_no_repite_la_marca_ni_la_agrega_si_es_generica(self):
        self.assertEqual(indexar.nombre_enriquecido("Monitor Samsung Odyssey G3", "SAMSUNG"), "Monitor Samsung Odyssey G3")
        self.assertEqual(indexar.nombre_enriquecido("Monitor Hp 6N4E8AA 21", "HP"), "Monitor Hp 6N4E8AA 21")
        for marca in (None, "", "Genérico", "Sin marca", "N/A"):
            self.assertEqual(indexar.nombre_enriquecido("Monitor 24", marca), "Monitor 24")

    def test_agrega_los_hz_y_las_pulgadas_que_faltan(self):
        self.assertEqual(indexar.nombre_enriquecido("Monitor Samsung LS25BG400ELXZB", "Samsung",
                                                    {"screen_inches": 25, "refresh_rate_hz": 240}),
                         'Monitor Samsung LS25BG400ELXZB 240Hz 25"')

    def test_no_agrega_lo_que_el_titulo_ya_dice_con_otra_tipografia(self):
        for titulo, pulgadas in (("Monitor Hp 21,5'' E22 G5", 21.5), ("Monitor Noblex 27 Pulgadas Nxsm2700", 27),
                                 ("Monitor 27\u2033 Gamer", 27), ("Monitor Gamer 21.5 FHD", 21.5), ('Monitor 27" Led', 27)):
            self.assertEqual(indexar.nombre_enriquecido(titulo, None, {"screen_inches": pulgadas}), titulo, titulo)
        for titulo in ('Monitor 27" 144 hz', "Monitor 27 144Hz", "Monitor 27 144HZ"):
            self.assertEqual(indexar.nombre_enriquecido(titulo, None, {"refresh_rate_hz": 144}), titulo, titulo)

    def test_especificaciones_raras_no_rompen(self):
        self.assertEqual(indexar.nombre_enriquecido("Monitor 24", "Lg", {"screen_inches": None, "refresh_rate_hz": "x"}), "Monitor 24 Lg")
        self.assertEqual(indexar.nombre_enriquecido("Monitor 24", None, "no es un dict"), "Monitor 24")

    def test_comparaya_trae_el_modelo_y_los_hz_en_el_indice(self):
        cuerpo = json.loads(leer("comparaya", "api.json"))

        def bajar(u):
            return json.dumps(cuerpo if "page=1&" in u else {"data": []})

        with mock.patch.object(indexar, "bajar", bajar), mock.patch.object(indexar.time, "sleep"), \
                redirect_stdout(io.StringIO()):
            items = indexar.indexar_api(TIENDAS["comparaya"], 3)
        por_url = {it["url"]: it for it in items}
        hp = [it for it in items if "6N4E8AA" in it["nombre"].upper()][0]
        self.assertEqual(hp["sku"], "6N4E8AA")
        samsung = [it for it in items if "Gaming 25" in it["nombre"]][0]
        self.assertIn("Samsung", samsung["nombre"])
        self.assertIn("240Hz", samsung["nombre"])
        self.assertIsNone(samsung["sku"])
        self.assertEqual(len(por_url), len(items))


class UrlValida(unittest.TestCase):
    """La URL de un aviso viene de la tienda o de ComparaYa y termina en un href del sitio."""

    def test_solo_http_sin_comillas(self):
        for u in ("https://www.tienda.test/p/1", "http://tienda.test/a?b=1&c=2"):
            self.assertTrue(indexar.url_valida(u), u)
        for u in ("javascript:alert(1)", 'https://x.test/" onmouseover="alert(1)', "https://x.test/a b", "https://x.test/<script>",
                  "data:text/html,hola", "//x.test/a", "", None, 42, "https://x.test/'a'"):
            self.assertFalse(indexar.url_valida(u), u)


class RobustezDeComparaYa(unittest.TestCase):
    def test_una_marca_que_no_es_texto_o_un_numero_raro_no_tumba_la_fuente(self):
        for marca, specs in ((42, None), ({"x": 1}, None), (["Lg"], None), ("Lg", {"refresh_rate_hz": float("inf")}),
                             ("Lg", {"refresh_rate_hz": float("nan")}), ("Lg", {"refresh_rate_hz": True}), ("Lg", {"screen_inches": 10 ** 9})):
            n = indexar.nombre_enriquecido("Monitor 24", marca, specs)
            self.assertTrue(n.startswith("Monitor 24"), (marca, specs, n))
            self.assertNotIn("inf", n.lower())

    def test_la_barra_invertida_y_los_caracteres_de_control_no_pasan(self):
        for u in ("https://evil\\@good.com/x", "https://x.test/a\x00b", "https://x.test/\tb"):
            self.assertFalse(indexar.url_valida(u), repr(u))


class SinRepetirAgregador(unittest.TestCase):
    """El aviso que llega directo de la tienda y por ComparaYa va una sola vez al indice: gana el directo."""

    def test_url_clave_como_en_el_buscador(self):
        self.assertEqual(indexar.url_clave("https://WWW.OnCity.com/cel-a/p/?utm_source=x&gclid=1"), "oncity.com/cel-a/p")
        self.assertEqual(indexar.url_clave("http://oncity.com/cel-a/p?b=2&a=1#x"), "oncity.com/cel-a/p?a=1&b=2")
        self.assertEqual(indexar.url_clave("no es url"), "no es url")

    def test_saca_la_fila_del_agregador_que_repite_una_directa(self):
        directa = ["Cel A", 100, "https://www.oncity.com/cel-a/p", "oncity", ""]
        repetida = ["Cel A", 120, "https://oncity.com/cel-a/p/?utm_medium=cy", "comparaya", "OnCity"]
        otra = ["Cel B", 90, "https://www.oncity.com/cel-b/p", "comparaya", "OnCity"]
        ml = ["Cel A", 80, "https://www.mercadolibre.com.ar/cel-a/p", "comparaya", "Mercado Libre"]
        filas = [repetida, directa, otra, ml]
        self.assertEqual(indexar.sin_repetir_agregador(filas, {"comparaya"}), [directa, otra, ml])
        self.assertEqual(indexar.sin_repetir_agregador(filas, set()), filas)
