import io
import json
import os
import shutil
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import diagnostico_enlaces as d

OMEN = "https://www.mercadolibre.com.ar/notebook-hp-omen-ryzen-9-8940hx-64gb-2tb-rtx-5060-161-fhd/up/MLAU4085787309"
# Lo que Mercado Libre le devolvia a GitHub el 18/10 en vez del aviso.
MURO_ML = '<title>Mercado Libre</title><script src="https://www.mercadolibre.com.ar/gz/account-verification"></script>'


class Respuesta(io.BytesIO):
    def __init__(self, cuerpo, status=200, url="https://t.test/a"):
        super().__init__(cuerpo.encode("utf-8"))
        self.status, self._url = status, url

    def geturl(self):
        return self._url

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Piezas(unittest.TestCase):
    def test_titulo_y_texto_visible(self):
        html = "<html><title> Mi   titulo </title><script>no()</script><style>.x{}</style><h1>Hola</h1> <p>mundo</p></html>"
        self.assertEqual(d.titulo(html), "Mi titulo")
        self.assertEqual(d.titulo(None), "")
        self.assertEqual(d.texto_visible(html), "Mi titulo Hola mundo")

    def test_senales_de_un_muro_y_de_una_caida(self):
        s = d.senales(MURO_ML)
        self.assertTrue(s["muro"])
        self.assertFalse(s["cartel"])
        self.assertEqual(s["titulo"], "Mercado Libre")
        caida = d.senales('<div>Este producto no está disponible</div><script type="application/ld+json">'
                          '{"availability":"https://schema.org/OutOfStock"}</script>')
        self.assertTrue(caida["cartel"])
        self.assertEqual(caida["disponibilidad"], ["OutOfStock"])

    def test_id_de_cada_forma_de_aviso_de_mercado_libre(self):
        self.assertEqual(d.id_ml(OMEN), ("user-products", "MLAU4085787309"))
        self.assertEqual(d.id_ml("https://www.mercadolibre.com.ar/x/p/MLA48893960"), ("products", "MLA48893960"))
        self.assertEqual(d.id_ml("https://www.mercadolibre.com.ar/x/p/MLA4?pdp_filters=item_id:MLA2000111222"),
                         ("items", "MLA2000111222"))
        self.assertEqual(d.id_ml("https://articulo.mercadolibre.com.ar/MLA-1234567890-x-_JM"), ("items", "MLA1234567890"))
        self.assertIsNone(d.id_ml("https://www.fravega.com/p/x"))


class Pedir(unittest.TestCase):
    def test_respuesta_normal(self):
        with mock.patch.object(d.urllib.request, "urlopen", return_value=Respuesta("hola", url="https://t.test/fin")):
            self.assertEqual(d.pedir("https://t.test/a"), (200, "https://t.test/fin", "hola"))

    def test_error_http_devuelve_su_codigo_y_cuerpo(self):
        error = urllib.error.HTTPError("https://t.test/a", 401, "no", {}, io.BytesIO(b'{"message":"sin token"}'))
        with mock.patch.object(d.urllib.request, "urlopen", side_effect=error):
            self.assertEqual(d.pedir("https://t.test/a"), (401, "https://t.test/a", '{"message":"sin token"}'))

    def test_sin_red_devuelve_cero(self):
        with mock.patch.object(d.urllib.request, "urlopen", side_effect=urllib.error.URLError("x")):
            self.assertEqual(d.pedir("https://t.test/a")[0], 0)


class Token(unittest.TestCase):
    def setUp(self):
        d._TOKEN.clear()

    tearDown = setUp

    def test_sin_secretos_no_hay_token_ni_pedido(self):
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(d.urllib.request, "urlopen") as abrir:
            self.assertIsNone(d.token_ml())
            abrir.assert_not_called()

    def test_con_secretos_pide_el_token_una_sola_vez(self):
        entorno = {"ML_CLIENT_ID": "1", "ML_CLIENT_SECRET": "s"}
        with mock.patch.dict(os.environ, entorno, clear=True), \
                mock.patch.object(d.urllib.request, "urlopen", return_value=Respuesta('{"access_token":"T"}')) as abrir:
            self.assertEqual(d.token_ml(), "T")
            self.assertEqual(d.token_ml(), "T")
            self.assertEqual(abrir.call_count, 1)
            pedido = abrir.call_args[0][0]
            self.assertEqual(pedido.full_url, "https://api.mercadolibre.com/oauth/token")
            self.assertIn(b"grant_type=client_credentials", pedido.data)

    def test_si_el_token_falla_avisa_y_sigue_sin_token(self):
        entorno = {"ML_CLIENT_ID": "1", "ML_CLIENT_SECRET": "s"}
        with mock.patch.dict(os.environ, entorno, clear=True), redirect_stdout(io.StringIO()) as salida, \
                mock.patch.object(d.urllib.request, "urlopen", side_effect=urllib.error.URLError("x")):
            self.assertIsNone(d.token_ml())
        self.assertIn("No se obtuvo el token", salida.getvalue())


class Api(unittest.TestCase):
    def setUp(self):
        d._TOKEN.clear()
        d._TOKEN["valor"] = None

    def tearDown(self):
        d._TOKEN.clear()

    def api(self, url, respuesta):
        with mock.patch.object(d, "pedir", return_value=respuesta) as pedir:
            return d.api_ml(url), pedir

    def test_sin_id_no_consulta(self):
        with mock.patch.object(d, "pedir") as pedir:
            self.assertEqual(d.api_ml("https://www.fravega.com/p/x"), {"id": None})
            pedir.assert_not_called()

    def test_sin_token_el_401_queda_anotado(self):
        # Caso real (18/10): la API publica respondia 401 sin token.
        r, _ = self.api("https://www.mercadolibre.com.ar/x/p/MLA48893960",
                        (401, "", '{"message":"authorization value not present","status":401}'))
        self.assertEqual(r["codigo"], 401)
        self.assertEqual(r["error"], "authorization value not present")

    def test_aviso_suelto(self):
        r, _ = self.api("https://articulo.mercadolibre.com.ar/MLA-1234567890-x",
                        (200, "", '{"status":"paused","available_quantity":0,"sub_status":["out_of_stock"]}'))
        self.assertEqual((r["status"], r["disponibles"], r["sub_status"]), ("paused", 0, ["out_of_stock"]))

    def test_aviso_de_catalogo_sin_vendedor(self):
        r, _ = self.api("https://www.mercadolibre.com.ar/x/p/MLA48893960", (200, "", '{"status":"active","buy_box_winner":null}'))
        self.assertEqual((r["status"], r["ganador"], r["ganador_item"]), ("active", False, None))

    def test_user_product_anota_sus_campos(self):
        r, _ = self.api(OMEN, (200, "", '{"status":"inactive","id":"MLAU4085787309","name":"Omen"}'))
        self.assertEqual(r["tipo"], "user-products")
        self.assertEqual(r["status"], "inactive")
        self.assertEqual(r["claves"], ["id", "name", "status"])

    def test_respuesta_que_no_es_json(self):
        r, _ = self.api(OMEN, (0, "", "URLError"))
        self.assertEqual(r["cuerpo"], "URLError")

    def test_con_token_lo_manda(self):
        d._TOKEN["valor"] = "T"
        _, pedir = self.api(OMEN, (200, "", "{}"))
        self.assertEqual(pedir.call_args[0][1]["Authorization"], "Bearer T")


class Diagnostico(unittest.TestCase):
    def setUp(self):
        d._TOKEN.clear()
        d._TOKEN["valor"] = None

    def tearDown(self):
        d._TOKEN.clear()

    def test_un_aviso_de_mercado_libre_bloqueado(self):
        sin = (401, "", '{"message":"sin token"}')
        with mock.patch.object(d, "pedir", side_effect=[(200, OMEN, MURO_ML), sin, sin, sin, sin]), \
                mock.patch.object(d.v, "renderizar", side_effect=[MURO_ML, "<title>Mercado Libre</title>generica"]), \
                mock.patch.object(d.v, "revisar", return_value=("dudosa", "renderizada")):
            fila = d.diagnosticar(OMEN)
        self.assertTrue(fila["html"]["muro"])
        self.assertTrue(fila["render_nuestro"]["muro"])
        self.assertEqual(fila["render_navegador"]["titulo"], "Mercado Libre")
        self.assertEqual(fila["api"]["codigo"], 401)
        texto = d.linea(fila)
        self.assertIn("captcha/muro", texto)
        self.assertIn("veredicto: dudosa", texto)
        self.assertIn("api user-products 401", texto)
        self.assertEqual(sorted(fila["explorar"]), ["/items?user_product_id", "/sites/MLA/search?user_product_id",
                                                    "/user-products/{id}/items"])
        self.assertIn('/user-products/{id}/items: {"codigo": 401', texto)

    def test_explorar_un_producto_de_catalogo_sigue_al_primer_aviso_que_lo_vende(self):
        items = '{"results":[{"item_id":"MLA99","price":1000,"seller_id":5}],"paging":{"total":3}}'
        aviso = '{"id":"MLA99","status":"active","available_quantity":4,"price":1000}'
        with mock.patch.object(d, "pedir", side_effect=[(200, "", items), (200, "", aviso)]) as pedir:
            r = d.explorar_ml("https://www.mercadolibre.com.ar/x/p/MLA61813247")
        self.assertEqual(pedir.call_args_list[0][0][0], d.API_ML + "/products/MLA61813247/items?limit=100")
        self.assertEqual(r["/products/{id}/items"], {"codigo": 200, "minimo": 1000, "leidos": 1, "total": 3,
                                                     "primeros": [{"item_id": "MLA99", "price": 1000, "seller_id": 5}]})
        self.assertEqual(r["/items/{id}"]["item"], "MLA99")
        self.assertEqual((r["/items/{id}"]["status"], r["/items/{id}"]["disponibles"]), ("active", 4))

    def test_explorar_sin_id_de_mercado_libre_no_pide_nada(self):
        with mock.patch.object(d, "pedir") as pedir:
            self.assertEqual(d.explorar_ml("https://otra.test/x"), {})
        pedir.assert_not_called()

    def test_resumen_de_respuestas_raras(self):
        self.assertEqual(d.resumen_ml(500, "no es json"), {"codigo": 500, "cuerpo": "no es json"})
        self.assertEqual(d.resumen_ml(200, "[]"), {"codigo": 200, "minimo": None, "leidos": 0, "total": 0, "primeros": []})

    def test_otro_comercio_sin_navegador_no_consulta_la_api(self):
        with mock.patch.object(d, "pedir", return_value=(200, "https://www.fravega.com/p/x", "<title>Notebook</title>")), \
                mock.patch.object(d.v, "renderizar", return_value=None), \
                mock.patch.object(d.v, "revisar", return_value=("viva", "estatica")):
            fila = d.diagnosticar("https://www.fravega.com/p/x")
        self.assertNotIn("api", fila)
        self.assertIn("no abrió", d.linea(fila))

    def test_comparaya_anota_los_campos_y_encuentra_la_fila(self):
        pagina = json.dumps({"data": [{"title": "Omen", "url": OMEN, "price": 1, "image": "x", "specifications": {"a": 1}}]})
        with mock.patch.object(d, "pedir", return_value=(200, "", pagina)):
            campos, vistas = d.comparaya({OMEN})
        self.assertEqual(campos["title"], "Omen")
        self.assertEqual(campos["specifications"], "dict")
        self.assertNotIn("image", vistas[OMEN])
        with mock.patch.object(d, "pedir", return_value=(0, "", "URLError")):
            self.assertEqual(d.comparaya({OMEN}), (None, {}))


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        d._TOKEN.clear()
        d._TOKEN["valor"] = None

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)
        d._TOKEN.clear()

    def test_ordena_mercado_libre_primero_escribe_los_json_y_el_resumen(self):
        candidatas = os.path.join(self.dir, "c.json")
        salida = os.path.join(self.dir, "diag.json")
        resumen = os.path.join(self.dir, "resumen.md")
        Path(candidatas).write_text(json.dumps({"ofertas": [{"url": "https://www.fravega.com/p/x"}, {"url": OMEN},
                                                            {"url": OMEN}, {"nada": 1}]}), encoding="utf-8")
        vistos = []
        falsa = lambda u: (vistos.append(u), {"url": u, "comercio": d.v.comercio(u), "veredicto": ("viva", "estatica"),
                           "html": {"codigo": 200, "cartel": False, "muro": False, "disponibilidad": [], "titulo": "t"},
                           "render_nuestro": None, "render_navegador": None})[1]
        with mock.patch.object(d, "diagnosticar", side_effect=falsa), \
                mock.patch.object(d, "comparaya", return_value=({"title": "x"}, {})), \
                mock.patch.dict(os.environ, {"GITHUB_STEP_SUMMARY": resumen}), redirect_stdout(io.StringIO()) as log:
            self.assertEqual(d.main([candidatas, "--max", "5", "--salida", salida]), 0)
        self.assertEqual(vistos, [OMEN, "https://www.fravega.com/p/x"])       # sin repetir, Mercado Libre primero
        self.assertEqual(len(json.loads(Path(salida).read_text(encoding="utf-8"))), 2)
        self.assertTrue(Path(salida.replace(".json", "-comparaya.json")).exists())
        self.assertIn("Token de Mercado Libre: no", log.getvalue())
        self.assertIn("Diagnóstico de enlaces", Path(resumen).read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()


class ProbarVtex(unittest.TestCase):
    def test_toma_avisos_vtex_de_comparaya_y_los_verifica(self):
        idx = {"productos": [["Celular A", 1000, "https://www.oncity.com/celular-a/p", "comparaya"],
                             ["Celular B", 2000, "https://www.oncity.com/celular-b/p", "comparaya"],
                             ["Celular C", 3000, "https://www.fravega.com/p/celular-c-1/", "comparaya"],
                             ["Celular D", 4000, "https://articulo.mercadolibre.com.ar/x/p", "comparaya"],
                             ["Celular E", 5000, "https://www.oncity.com/celular-e/p", "venex"]]}
        with mock.patch.object(d.v, "revisar_vtex", return_value=("viva", "api de la tienda")) as revisar:
            lineas = d.probar_vtex(idx, por_tienda=1)
        self.assertEqual(revisar.call_count, 1)
        self.assertIn("- www.oncity.com: ('viva', 'api de la tienda') (publicado 1000)", lineas)

    def test_main_con_vtex(self):
        with mock.patch.object(d, "probar_vtex", return_value=["ok"]), mock.patch.object(d.v, "leer", return_value={}),                 redirect_stdout(io.StringIO()) as salida:
            self.assertEqual(d.main(["--vtex", "indice.json"]), 0)
        self.assertIn("ok", salida.getvalue())


class MedirVtex(unittest.TestCase):
    FIX = Path(__file__).resolve().parent / "fixtures" / "oncity"

    def bajar(self, url):
        if url.endswith("/robots.txt"):
            return (self.FIX / "robots.txt").read_text(encoding="utf-8")
        if "/category/tree/" in url:
            return (self.FIX / "arbol.json").read_text(encoding="utf-8")
        if "fq=C:/14/100/481/&_from=0&" in url:
            return (self.FIX / "busqueda.json").read_text(encoding="utf-8")
        return "[]"

    def test_cuenta_lo_que_suma_contra_comparaya_y_guarda_lo_crudo(self):
        idx = {"productos": [["Moto", 1, "https://www.oncity.com/celular-motorola-moto-g06-4g-4-gb-64-gb-nfc-tapestry-158039/p/",
                              "comparaya"],
                             ["Otro", 1, "https://www.oncity.com/otro/p", "comparaya"]]}
        carpeta = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, carpeta)
        with mock.patch.object(d.indexar, "bajar", side_effect=self.bajar), mock.patch.object(d.indexar.time, "sleep"), \
                redirect_stdout(io.StringIO()) as salida:
            lineas, filas = d.medir_vtex(idx, ["www.oncity.com"], carpeta=carpeta)
        r = filas[0]
        self.assertEqual((r["host"], r["avisos"], r["por_comparaya"], r["comparaya_tambien_directo"], r["nuevos"]),
                         ("www.oncity.com", 4, 2, 1, 3))
        self.assertEqual(r["rebajas"], 4)
        self.assertEqual(r["con_ean"], "3/4", "el iPhone 17 de un tercero no trae EAN")
        self.assertEqual(sorted(os.listdir(os.path.join(carpeta, "www.oncity.com"))), ["arbol.json", "busqueda.json", "robots.txt"])
        self.assertIn("| www.oncity.com |", "\n".join(lineas))
        self.assertIn("categorias", salida.getvalue())

    def test_una_tienda_que_falla_queda_anotada(self):
        with mock.patch.object(d.indexar, "bajar", side_effect=urllib.error.URLError("caida")):
            lineas, filas = d.medir_vtex({"productos": []}, ["www.x.test"])
        self.assertIn("RuntimeError", filas[0]["error"])
        self.assertEqual(filas[0]["avisos"], 0)

    def test_main_con_vtex_catalogo(self):
        carpeta = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, carpeta)
        with mock.patch.object(d, "medir_vtex", return_value=(["tabla"], [{"host": "a"}])) as medir, \
                mock.patch.object(d.v, "leer", return_value={}), redirect_stdout(io.StringIO()) as salida:
            self.assertEqual(d.main(["--vtex-catalogo", "indice.json", "www.a.test", "--crudos", carpeta]), 0)
        self.assertEqual(medir.call_args[0][1], ["www.a.test"])
        self.assertIn("tabla", salida.getvalue())
        self.assertTrue(os.path.exists(os.path.join(carpeta, "medicion.json")))


class MedirVtexSinComparaYa(unittest.TestCase):
    def test_mide_tambien_las_tiendas_vtex_de_tiendas_json_y_crea_la_carpeta(self):
        # Con las tiendas directas, ComparaYa ya no trae sus avisos repetidos: la lista sale tambien de tiendas.json
        raiz = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, raiz, True)
        carpeta = os.path.join(raiz, "no-existe")
        fila = {"host": "", "error": "", "segundos": 0, "categorias": 0, "avisos": 0, "rebajas": 0, "refid_con_forma": 0,
                "refid_ejemplos": [], "con_ean": "0/0", "por_comparaya": 0, "comparaya_tambien_directo": 0, "nuevos": 0}
        with mock.patch.object(d, "medir_tienda_vtex", side_effect=lambda h, cy, c: {**fila, "host": h}) as medir, \
                mock.patch.object(d.v, "leer", side_effect=lambda r, defecto, leer=d.v.leer: {"productos": []}
                                  if r == "indice.json" else leer(r, defecto)), redirect_stdout(io.StringIO()):
            self.assertEqual(d.main(["--vtex-catalogo", "indice.json", "--crudos", carpeta]), 0)
        hosts = {c[0][0] for c in medir.call_args_list}
        self.assertIn("www.oncity.com", hosts)
        self.assertIn("shop.lg.com.ar", hosts)
        self.assertTrue(os.path.exists(os.path.join(carpeta, "medicion.json")))
