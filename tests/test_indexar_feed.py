"""Tiendas que dan su catalogo como feed de Google Merchant (Katech, 04/11): un pedido, con permiso, sin fichas."""
import io
import json
import shutil
import tempfile
import unittest
import xml.etree.ElementTree as ET
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from unittest import mock

import indexar


def setUpModule():
    # spec 061: el reintento unico de una fuente espera ESPERA_REINTENTO segundos; en los tests no se espera
    parche = mock.patch.object(indexar, "ESPERA_REINTENTO", 0)
    parche.start()
    unittest.addModuleCleanup(parche.stop)

RAIZ = Path(__file__).resolve().parent.parent
FEED = (RAIZ / "tests" / "fixtures" / "katech" / "feed.xml").read_text(encoding="utf-8")
TIENDAS = json.loads((RAIZ / "tiendas.json").read_text(encoding="utf-8"))
DIA_DEL_FEED = datetime(2026, 11, 4, 18, 0, tzinfo=indexar.AR)   # el fixture dice «Generado: 2026-11-04 16:32:59»


def leer_feed(crudo=FEED, ahora=DIA_DEL_FEED):
    return indexar.indexar_feed(TIENDAS["katech"], pedir=lambda u: crudo, ahora=ahora)


def item(**campos):
    """Un <item> del feed con los campos pedidos (None lo saca) sobre uno valido."""
    base = {"g:title": "MEMORIA RAM 16GB DDR5", "link": "https://kt.test/producto/mem/", "g:availability": "in_stock",
            "g:condition": "new", "g:price": "100000.00 ARS", "g:image_link": "https://kt.test/m.png"}
    base.update(campos)
    xml = "".join(f"<{k}>{v}</{k}>" for k, v in base.items() if v is not None)
    return ET.fromstring(f'<item xmlns:g="http://base.google.com/ns/1.0">{xml}</item>')


def correr(carpeta, tiendas, bajar, **parches):
    """indexar.main() entero en una carpeta temporal; devuelve (indice, salud)."""
    (carpeta / "tiendas.json").write_text(json.dumps(tiendas), encoding="utf-8")
    with mock.patch.object(indexar, "TIENDAS", carpeta / "tiendas.json"), \
            mock.patch.object(indexar, "INDICE", carpeta / "indice.json"), \
            mock.patch.object(indexar, "SALUD", carpeta / "salud.json"), \
            mock.patch.object(indexar, "FEED_VIEJO_DIAS", parches.get("viejo", indexar.FEED_VIEJO_DIAS)), \
            mock.patch.object(indexar, "bajar", bajar), redirect_stdout(io.StringIO()):
        assert indexar.main(["--historial", str(carpeta / "historial")]) == 0
    return (json.loads((carpeta / "indice.json").read_text(encoding="utf-8")),
            json.loads((carpeta / "salud.json").read_text(encoding="utf-8")))


KT = {"nombre": "Katech", "color": "kt", "activa": True, "base": "https://katech.com.ar",
      "catalogo": {"tipo": "feed", "url": "https://katech.com.ar/feed/productos/"}}


class FeedReal(unittest.TestCase):
    def test_lee_los_productos_del_feed_real(self):
        items = leer_feed()
        self.assertEqual(len(items), 9, "los nueve del fixture estan en stock y son nuevos")
        pc = items[0]
        self.assertEqual(pc["nombre"], "PC GAMER RYZEN 5 3400G 16GB 1TB M2 GAB KIT MONITOR 27")
        self.assertEqual(pc["precio"], 943277, "943277.00 ARS: el punto es el decimal, no el separador de miles")
        self.assertEqual(pc["url"], "https://katech.com.ar/producto/pc-gamer-ryzen-5-3400g-16gb-1tb-m2-gab-kit-monitor-27/")
        self.assertTrue(pc["imagen"].startswith("https://katech.com.ar/wp-content/uploads/"))
        self.assertIsNone(pc["lista"])

    def test_el_precio_rebajado_manda_y_el_de_lista_queda_aparte(self):
        rtx = next(it for it in leer_feed() if "RTX 5070" in it["nombre"])
        self.assertEqual((rtx["precio"], rtx["lista"]), (1583868, 1770630))

    def test_sin_foto_queda_vacia(self):
        sin = next(it for it in leer_feed() if "FLOODLIGHT" in it["nombre"])
        self.assertEqual(sin["imagen"], "")

    def test_el_mpn_de_katech_es_un_codigo_interno_y_no_se_usa(self):
        # PCG586, MEM1263...: el codigo de la tienda, no el part number del fabricante
        self.assertEqual({it["sku"] for it in leer_feed()}, {None})

    def test_katech_se_lee_por_su_feed(self):
        self.assertEqual(TIENDAS["katech"]["catalogo"]["tipo"], "feed")
        self.assertEqual(TIENDAS["katech"]["catalogo"]["url"], "https://katech.com.ar/feed/productos/")

    def test_un_feed_viejo_falla_como_fuente(self):
        with self.assertRaisesRegex(RuntimeError, "hace 5 dias"):
            leer_feed(ahora=datetime(2026, 11, 9, 12, 0, tzinfo=indexar.AR))
        self.assertEqual(len(leer_feed(ahora=datetime(2026, 11, 7, 12, 0, tzinfo=indexar.AR))), 9, "tres dias todavia vale")

    def test_un_feed_roto_falla(self):
        with self.assertRaises(ET.ParseError):
            leer_feed(crudo="<html>Cloudflare</html><")


class ItemDelFeed(unittest.TestCase):
    def test_solo_en_stock(self):
        self.assertIsNone(indexar.item_feed(item(**{"g:availability": "out_of_stock"})))
        self.assertIsNone(indexar.item_feed(item(**{"g:availability": "preorder"})))
        self.assertIsNotNone(indexar.item_feed(item(**{"g:availability": "in stock"})))

    def test_solo_nuevos(self):
        self.assertIsNone(indexar.item_feed(item(**{"g:condition": "used"})))
        self.assertIsNone(indexar.item_feed(item(**{"g:condition": "refurbished"})))

    def test_solo_en_pesos_y_con_precio(self):
        self.assertIsNone(indexar.item_feed(item(**{"g:price": "100.00 USD"})))
        self.assertIsNone(indexar.item_feed(item(**{"g:price": "0.00 ARS"})))
        self.assertIsNone(indexar.item_feed(item(**{"g:price": None})))
        self.assertEqual(indexar.item_feed(item(**{"g:price": "1234.56 ARS"}))["precio"], 1235)

    def test_un_precio_rebajado_mayor_al_de_lista_no_cuenta(self):
        it = indexar.item_feed(item(**{"g:sale_price": "120000.00 ARS"}))
        self.assertEqual((it["precio"], it["lista"]), (100000, None))

    def test_la_foto_solo_https(self):
        self.assertEqual(indexar.item_feed(item(**{"g:image_link": "http://kt.test/m.png"}))["imagen"], "")

    def test_sin_titulo_o_sin_enlace_no_entra(self):
        self.assertIsNone(indexar.item_feed(item(**{"g:title": None})))
        self.assertIsNone(indexar.item_feed(item(link=None)))


class FeedEnLaCorrida(unittest.TestCase):
    def setUp(self):
        self.carpeta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.carpeta)

    def test_un_feed_caido_no_voltea_el_indice(self):
        uno = {"nombre": "Uno", "color": "cg", "activa": True, "base": "https://uno.test",
               "catalogo": {"tipo": "json", "url": "https://uno.test/cat", "ruta": "p/{slug}_{id}",
                            "campos": {"id": "id", "nombre": "nombre", "precio": "precio", "lista": "lista"}}}

        def bajar(u):
            if u == "https://uno.test/cat":
                return json.dumps([{"id": 1, "nombre": "Memoria 16GB", "precio": 50000}])
            raise OSError("403 desde los servidores de GitHub: " + u)

        indice, salud = correr(self.carpeta, {"uno": uno, "kt": KT}, bajar)
        self.assertEqual({f[3] for f in indice["productos"]}, {"uno"})
        self.assertIn("kt", json.dumps(salud))

    def test_lo_que_trae_el_feed_entra_sin_bajas_inventadas(self):
        indice, _ = correr(self.carpeta, {"kt": KT}, lambda u: FEED, viejo=100000)
        filas = indice["productos"]
        self.assertEqual(len(filas), 9)
        self.assertTrue(all(f[3] == "kt" for f in filas))
        # una tienda nueva no tiene historial: ningun «antes» (columna 6) ni baja de 7 o 31 dias
        self.assertEqual([f for f in filas if f[6] or f[11] or f[12]], [])


if __name__ == "__main__":
    unittest.main()
