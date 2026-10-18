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
                                    "sellos": "", "sku": modelo.sku_de("KF432C16BB/1")})
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

    def test_el_json_real_guardado_de_cada_tienda_woocommerce(self):
        for clave, t in TIENDAS.items():
            if clave.startswith("_") or t["catalogo"]["tipo"] != "woocommerce":
                continue
            with self.subTest(clave):
                crudo = leer(clave, "store-api.json")
                with mock.patch.object(indexar, "bajar", side_effect=[crudo, "[]"]), mock.patch.object(indexar.time, "sleep"):
                    items = indexar.indexar_woocommerce(t, indexar.TOPE_PAGINAS)
                self.assertGreaterEqual(len(items), 3)
                for it in items:
                    self.assertTrue(it["url"].startswith(t["base"].replace("://www.", "://")) or it["url"].startswith(t["base"]), it["url"])
                    self.assertGreaterEqual(it["precio"], 1000)
                    self.assertNotRegex(it["nombre"], r"[<>]|&[a-z#0-9]+;")


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
