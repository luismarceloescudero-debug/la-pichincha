import http.server
import io
import json
import os
import shutil
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import verificar_ofertas as v

OFERTAS = {"ofertas": [{"url": "https://t.test/a"}, {"url": "https://t.test/b"}, {"url": "https://t.test/c"}]}


class Veredicto(unittest.TestCase):
    def test_un_404_o_un_410_es_una_publicacion_caida(self):
        self.assertEqual(v.veredicto(404, ""), "caida")
        self.assertEqual(v.veredicto(410, ""), "caida")

    def test_el_cartel_de_mercado_libre_es_una_publicacion_caida(self):
        self.assertEqual(v.veredicto(200, "<h2>Este producto no está disponible</h2><p>Elige otra variante.</p>"), "caida")
        self.assertEqual(v.veredicto(200, "ESTE PRODUCTO NO ESTA DISPONIBLE"), "caida")
        self.assertEqual(v.veredicto(200, "<span>Publicación pausada</span>"), "caida")
        self.assertEqual(v.veredicto(200, "<span>Publicación finalizada</span>"), "caida")

    def test_el_cartel_con_la_codificacion_mal_leida_tambien_cuenta(self):
        self.assertEqual(v.veredicto(200, "Este producto no estÃ¡ disponible"), "caida")
        self.assertEqual(v.veredicto(200, "PublicaciÃ³n pausada"), "caida")

    def test_una_pagina_normal_esta_viva(self):
        self.assertEqual(v.veredicto(200, "<h1>Notebook Hp Omen</h1><button>Comprar ahora</button>"), "viva")

    def test_una_frase_suelta_con_no_esta_disponible_no_alcanza(self):
        # "Retiro en sucursal no está disponible" es de una pagina que sigue vendiendo.
        self.assertEqual(v.veredicto(200, "Retiro en sucursal no está disponible. Envío a domicilio: $3.000"), "viva")

    def test_un_bloqueo_o_un_error_del_servidor_no_prueba_nada(self):
        for estado in (401, 403, 429, 500, 503):
            self.assertEqual(v.veredicto(estado, "Este producto no está disponible"), "dudosa", estado)


class Estatica(unittest.TestCase):
    def test_un_fallo_de_red_no_descarta_el_enlace(self):
        with mock.patch.object(v, "bajar", side_effect=urllib.error.URLError("sin red")):
            self.assertEqual(v.estatica("https://t.test/a"), "dudosa")
        with mock.patch.object(v, "bajar", side_effect=TimeoutError()):
            self.assertEqual(v.estatica("https://t.test/a"), "dudosa")

    def test_solo_se_abren_enlaces_http_o_https(self):
        with mock.patch.object(v, "bajar") as bajar:
            self.assertEqual(v.estatica("file:///etc/passwd"), "dudosa")
            self.assertEqual(v.estatica("ftp://t.test/a"), "dudosa")
            bajar.assert_not_called()

    def test_un_http_error_se_juzga_por_su_codigo(self):
        error = urllib.error.HTTPError("https://t.test/a", 404, "no", {}, None)
        with mock.patch.object(v, "bajar", side_effect=error):
            self.assertEqual(v.estatica("https://t.test/a"), "caida")

    def test_el_dato_estructurado_de_sin_stock_es_una_caida(self):
        pagina = '<script type="application/ld+json">{"offers":{"availability":"https://schema.org/OutOfStock"}}</script>'
        self.assertEqual(v.veredicto(200, pagina), "caida")
        en_stock = pagina.replace("OutOfStock", "InStock")
        self.assertEqual(v.veredicto(200, en_stock), "viva")


class Muro(unittest.TestCase):
    def test_una_pagina_de_verificacion_con_200_queda_sin_confirmar(self):
        # Caso real (18/10): los avisos de Mercado Libre respondian 200 con una pagina de verificacion.
        pagina = '<title>Mercado Libre</title><script src="https://www.mercadolibre.com.ar/gz/account-verification"></script>'
        with mock.patch.object(v, "bajar", return_value=(200, pagina)):
            self.assertEqual(v.estatica("https://www.mercadolibre.com.ar/x/p/MLA1"), "dudosa")

    def test_la_pagina_de_error_de_mercado_libre_es_un_muro(self):
        # Caso real (18/10): lo que el navegador recibia con su identificacion propia.
        self.assertTrue(v.MURO.search("Mercado Libre - Donde comprar y vender de todo Hubo un error accediendo a esta pagina..."))
        self.assertTrue(v.MURO.search("Hubo un error accediendo a esta página"))

    def test_un_muro_con_el_cartel_igual_cuenta_como_caida(self):
        with mock.patch.object(v, "bajar", return_value=(200, "captcha ... Este producto no está disponible")):
            self.assertEqual(v.estatica("https://t.test/a"), "caida")


class Revisar(unittest.TestCase):
    """Las dos revisiones juntas: alcanza con que una marque la publicacion como caida."""

    def revisar(self, estatica, dom):
        with mock.patch.object(v, "estatica", return_value=estatica), mock.patch.object(v, "renderizar", return_value=dom):
            return v.revisar("https://t.test/a")

    def test_el_cartel_que_arma_el_javascript_solo_lo_ve_la_revision_renderizada(self):
        # Mercado Libre: el HTML que baja la primera revision no trae el cartel; el navegador si.
        self.assertEqual(self.revisar("viva", "<div>Este producto no está disponible. Elige otra variante.</div>"),
                         ("caida", "renderizada"))

    def test_si_la_estatica_ya_dice_caida_no_se_abre_el_navegador(self):
        with mock.patch.object(v, "estatica", return_value="caida"), mock.patch.object(v, "renderizar") as abrir:
            self.assertEqual(v.revisar("https://t.test/a"), ("caida", "estatica"))
            abrir.assert_not_called()

    def test_en_pie_en_las_dos(self):
        self.assertEqual(self.revisar("viva", "<h1>Notebook</h1><button>Comprar</button>"), ("viva", "renderizada"))

    def test_sin_navegador_queda_lo_que_dijo_la_estatica(self):
        self.assertEqual(self.revisar("viva", None), ("viva", "estatica"))
        self.assertEqual(self.revisar("dudosa", None), ("dudosa", "estatica"))

    def test_una_pagina_de_captcha_no_prueba_nada(self):
        self.assertEqual(self.revisar("viva", "<title>Captcha</title> Este producto no está disponible"), ("viva", "estatica"))

    def test_si_la_estatica_estaba_bloqueada_una_pagina_sin_cartel_no_la_da_por_viva(self):
        # Caso real (18/10): Mercado Libre le muestra a GitHub una pagina generica igual para todos los avisos.
        self.assertEqual(self.revisar("dudosa", "<h1>Mercado Libre</h1>"), ("dudosa", "renderizada"))

    def test_pasado_el_presupuesto_no_se_abren_mas_navegadores(self):
        with mock.patch.object(v, "estatica", return_value="viva"), mock.patch.object(v, "renderizar") as abrir:
            self.assertEqual(v.revisar("https://t.test/a", desde=0), ("viva", "estatica"))   # desde=0: hace muchisimo
            abrir.assert_not_called()


class Navegador(unittest.TestCase):
    def test_sin_navegador_renderizar_devuelve_none(self):
        with mock.patch.object(v, "navegador", return_value=None):
            self.assertIsNone(v.renderizar("https://t.test/a"))

    def test_un_navegador_que_se_cuelga_o_falla_devuelve_none(self):
        with mock.patch.object(v, "navegador", return_value="/usr/bin/chrome"):
            with mock.patch.object(v.subprocess, "run", side_effect=v.subprocess.TimeoutExpired("chrome", 1)):
                self.assertIsNone(v.renderizar("https://t.test/a"))
            with mock.patch.object(v.subprocess, "run", side_effect=OSError("no existe")):
                self.assertIsNone(v.renderizar("https://t.test/a"))

    def test_solo_abre_enlaces_http_o_https(self):
        with mock.patch.object(v, "navegador", return_value="/usr/bin/chrome"), mock.patch.object(v.subprocess, "run") as correr:
            self.assertIsNone(v.renderizar("file:///etc/passwd"))
            correr.assert_not_called()


@unittest.skipUnless(v.navegador(), "no hay Chrome en este entorno")
class ConChromeReal(unittest.TestCase):
    """Una pagina que arma el cartel con JavaScript, como Mercado Libre: la revision estatica la ve en pie y la
    renderizada la ve caida."""

    PAGINAS = {
        "/caida": "<html><body><div id=a>Cargando...</div><script>setTimeout(()=>{document.getElementById('a').textContent="
                  "['Este producto','no esta','disponible.'].join(' ')},300)</script></body></html>",
        "/viva": "<html><body><h1>Notebook</h1><script>document.body.append(' Comprar ahora')</script></body></html>",
    }

    @classmethod
    def setUpClass(cls):
        paginas = cls.PAGINAS

        class Manejador(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                cuerpo = paginas.get(self.path.split("?")[0], "").encode("utf-8")
                self.send_response(200 if cuerpo else 404)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(cuerpo)

            def log_message(self, *a):
                pass

        cls.servidor = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Manejador)
        cls.base = f"http://127.0.0.1:{cls.servidor.server_address[1]}"
        threading.Thread(target=cls.servidor.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.servidor.shutdown()

    def test_el_cartel_armado_por_javascript_se_detecta_solo_en_el_navegador(self):
        self.assertEqual(v.estatica(self.base + "/caida"), "viva")
        self.assertEqual(v.revisar(self.base + "/caida"), ("caida", "renderizada"))

    def test_una_pagina_en_pie_sigue_en_pie(self):
        self.assertEqual(v.revisar(self.base + "/viva")[0], "viva")

    def test_un_404_se_detecta_sin_abrir_el_navegador(self):
        self.assertEqual(v.revisar(self.base + "/no-existe"), ("caida", "estatica"))


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.ofertas = os.path.join(self.dir, "ofertas.json")
        self.descartadas = os.path.join(self.dir, "descartadas.json")
        Path(self.ofertas).write_text(json.dumps(OFERTAS), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def correr(self, juicios):
        with mock.patch.object(v, "revisar", side_effect=lambda u, desde=None, precio=None, tienda=None: (juicios[u], "estatica")), \
                redirect_stdout(io.StringIO()) as salida:
            codigo = v.main([self.ofertas, "--descartadas", self.descartadas])
        return codigo, salida.getvalue()

    def test_guarda_las_caidas_y_avisa_con_el_codigo_3(self):
        codigo, salida = self.correr({"https://t.test/a": "viva", "https://t.test/b": "caida", "https://t.test/c": "dudosa"})
        self.assertEqual(codigo, 3)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")), ["https://t.test/b"])
        self.assertIn("1 caída", salida)
        self.assertIn("t.test: 1 en pie, 1 caída(s), 1 sin confirmar", salida)     # el resumen por comercio

    def test_a_cada_enlace_le_pasa_su_precio(self):
        Path(self.ofertas).write_text(json.dumps({"ofertas": [{"url": "https://t.test/a", "precio": 900}]}), encoding="utf-8")
        with mock.patch.object(v, "revisar", return_value=("viva", "api")) as revisar, redirect_stdout(io.StringIO()):
            v.main([self.ofertas, "--descartadas", self.descartadas])
        self.assertEqual(revisar.call_args[1]["precio"], 900)

    def test_si_no_hay_caidas_sale_con_0_y_no_toca_lo_anterior(self):
        Path(self.descartadas).write_text(json.dumps(["https://t.test/vieja"]), encoding="utf-8")
        codigo, _ = self.correr({u["url"]: "viva" for u in OFERTAS["ofertas"]})
        self.assertEqual(codigo, 0)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")), ["https://t.test/vieja"])

    def test_suma_a_las_descartadas_de_la_ronda_anterior_sin_repetir(self):
        Path(self.descartadas).write_text(json.dumps(["https://t.test/vieja", "https://t.test/b"]), encoding="utf-8")
        codigo, _ = self.correr({"https://t.test/a": "caida", "https://t.test/b": "caida", "https://t.test/c": "viva"})
        self.assertEqual(codigo, 3)
        self.assertEqual(json.loads(Path(self.descartadas).read_text(encoding="utf-8")),
                         ["https://t.test/vieja", "https://t.test/b", "https://t.test/a"])

    def test_sin_ofertas_json_no_falla(self):
        os.remove(self.ofertas)
        with redirect_stdout(io.StringIO()):
            self.assertEqual(v.main([self.ofertas, "--descartadas", self.descartadas]), 0)

    def test_si_todas_quedan_dudosas_lo_dice(self):
        _, salida = self.correr({u["url"]: "dudosa" for u in OFERTAS["ofertas"]})
        self.assertIn("no se pudo confirmar", salida)


if __name__ == "__main__":
    unittest.main()


CATALOGO = "https://www.mercadolibre.com.ar/notebook-asus-zenbook-14-oled/p/MLA61813247"
UP = "https://www.mercadolibre.com.ar/notebook-hp-omen/up/MLAU4085787309"


def vendedores(*precios):
    return 200, json.dumps({"results": [{"item_id": f"MLA{i}", "price": p} for i, p in enumerate(precios)],
                            "paging": {"total": len(precios)}})


class Respuesta(io.BytesIO):
    def __init__(self, texto):
        super().__init__(texto.encode("utf-8"))

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class ApiMercadoLibre(unittest.TestCase):
    """Casos reales del 19/10: ComparaYa publicaba la Zenbook a $2.383.703 y el vendedor mas barato de Mercado Libre
    la tenia a $2.999.999; la Omen (/up/) estaba caida y ninguna API la deja ver con el token de aplicacion."""

    def setUp(self):
        v._TOKEN.clear()
        v._TOKEN["valor"] = "T"
        self.addCleanup(v._TOKEN.clear)

    def juzgar(self, url, precio, respuesta):
        with mock.patch.object(v, "pedir_api", return_value=respuesta) as pedir:
            return v.revisar_ml(url, precio), pedir

    def test_un_precio_que_ningun_vendedor_tiene_ya_no_es_la_oferta(self):
        (juicio, motivo), pedir = self.juzgar(CATALOGO, 2383703, vendedores(3588563, 2999999, 4125409))
        self.assertEqual(juicio, "caida")
        self.assertIn("2.999.999", motivo)
        self.assertEqual(pedir.call_args[0][0], v.API_ML + "/products/MLA61813247/items?limit=100")
        self.assertEqual(pedir.call_args[0][1]["Authorization"], "Bearer T")

    def test_con_el_precio_de_algun_vendedor_esta_en_pie(self):
        self.assertEqual(self.juzgar(CATALOGO, 2144983, vendedores(2190399, 2144983))[0], ("viva", "api"))

    def test_una_diferencia_chica_de_redondeo_no_la_descarta(self):
        self.assertEqual(self.juzgar(CATALOGO, 530000, vendedores(534000))[0], ("viva", "api"))     # 0,75%

    def test_sin_vendedores_esta_caida(self):
        self.assertEqual(self.juzgar(CATALOGO, 1000, vendedores())[0], ("caida", "api: nadie lo vende"))

    def test_sin_precio_alcanza_con_que_alguien_lo_venda(self):
        self.assertEqual(self.juzgar(CATALOGO, None, vendedores(5000))[0], ("viva", "api"))

    def test_un_aviso_que_la_api_no_deja_ver_no_se_publica(self):
        (juicio, motivo), pedir = self.juzgar(UP, 2956771, vendedores(1))
        self.assertEqual((juicio, motivo), ("caida", "api: no se puede verificar"))
        pedir.assert_not_called()

    def test_si_la_api_falla_no_se_publica_lo_que_no_se_pudo_verificar(self):
        self.assertEqual(self.juzgar(CATALOGO, 1000, (503, "caida"))[0], ("caida", "api: no se pudo verificar (503)"))
        self.assertEqual(self.juzgar(CATALOGO, 1000, (200, "no es json"))[0], ("caida", "api: no se pudo verificar (200)"))

    def test_sin_token_no_se_decide_por_la_api(self):
        v._TOKEN["valor"] = None
        self.assertIsNone(self.juzgar(CATALOGO, 1000, vendedores(1))[0])

    def test_lo_que_no_es_de_mercado_libre_sigue_con_la_revision_de_la_pagina(self):
        self.assertIsNone(self.juzgar("https://www.fravega.com/p/x-123/", 1000, vendedores(1))[0])

    def test_revisar_usa_la_api_antes_que_la_pagina(self):
        with mock.patch.object(v, "revisar_ml", return_value=("caida", "api: nadie lo vende")), \
                mock.patch.object(v, "estatica") as estatica:
            self.assertEqual(v.revisar(CATALOGO, precio=1000), ("caida", "api: nadie lo vende"))
        estatica.assert_not_called()

    def test_hilos_a_la_vez_reciben_el_mismo_token_y_se_pide_una_sola_vez(self):
        # 19/10: con 4 hilos, los que llegaban mientras el primero pedia el token lo veian vacio y caian en la
        # revision de la pagina: un aviso de Mercado Libre salio "sin confirmar" en vez de verificado.
        v._TOKEN.clear()
        llamadas = []

        def lento(*_a, **_k):
            llamadas.append(1)
            threading.Event().wait(0.05)
            return Respuesta('{"access_token":"T"}')
        entorno = {"ML_CLIENT_ID": "1", "ML_CLIENT_SECRET": "s"}
        with mock.patch.dict(os.environ, entorno), mock.patch.object(v.urllib.request, "urlopen", side_effect=lento):
            with ThreadPoolExecutor(max_workers=4) as pool:
                tokens = list(pool.map(lambda _: v.token_ml(), range(8)))
        self.assertEqual(tokens, ["T"] * 8)
        self.assertEqual(len(llamadas), 1)

    def test_pedir_api_no_levanta_excepciones(self):
        error = urllib.error.HTTPError("https://t.test", 403, "no", {}, io.BytesIO(b'{"message":"forbidden"}'))
        with mock.patch.object(v.urllib.request, "urlopen", side_effect=error):
            self.assertEqual(v.pedir_api("https://t.test", {}), (403, '{"message":"forbidden"}'))
        with mock.patch.object(v.urllib.request, "urlopen", side_effect=urllib.error.URLError("sin red")):
            self.assertEqual(v.pedir_api("https://t.test", {}), (0, ""))


MAXTECNO = "https://maxtecno.com.ar/producto/mfl-pantum-m6509nw-22ppm-1200-x-1200-dpi-wifi-red/"
FRAVEGA = "https://www.fravega.com/p/celular-xiaomi-poco-f8-ultra-12gb-ram-256gb-rom-black-negro-23003846/"


def woo(precio_centavos, en_stock=True):
    return 200, json.dumps([{"name": "MFL PANTUM M6509NW", "is_in_stock": en_stock,
                             "prices": {"price": str(precio_centavos), "currency_minor_unit": 2}}])


class PrecioVisible(unittest.TestCase):
    def test_el_precio_con_puntos_de_miles_como_lo_escribe_la_tienda(self):
        self.assertTrue(v.precio_visible("Precio $1.833.999 antes $2.898.146", 1833999))
        self.assertTrue(v.precio_visible("$ 1.833.999,00", 1833999))
        self.assertTrue(v.precio_visible('"price":1833999,', 1833999))

    def test_otro_numero_que_lo_contiene_no_cuenta(self):
        self.assertFalse(v.precio_visible("$11.833.999", 1833999))
        self.assertFalse(v.precio_visible("$1.833.9990", 1833999))
        self.assertFalse(v.precio_visible("$1.833.998", 1833999))
        self.assertFalse(v.precio_visible("", 1833999))
        self.assertFalse(v.precio_visible("$1.833.999", None))


class WooCommerce(unittest.TestCase):
    """Maxtecno, 19/10: su Store API publica dio $274.116,63 y 'Hay existencias' para lo publicado a $274.116."""

    def juzgar(self, precio, respuesta):
        with mock.patch.object(v, "pedir_api", return_value=respuesta) as pedir:
            return v.revisar_woo(MAXTECNO, precio, "https://maxtecno.com.ar"), pedir

    def test_al_precio_publicado_y_con_stock_esta_en_pie(self):
        juicio, pedir = self.juzgar(274116, woo(27411663))
        self.assertEqual(juicio, ("viva", "api de la tienda"))
        self.assertEqual(pedir.call_args[0][0], "https://maxtecno.com.ar/wp-json/wc/store/v1/products"
                                                "?slug=mfl-pantum-m6509nw-22ppm-1200-x-1200-dpi-wifi-red")

    def test_sin_stock_esta_caida(self):
        self.assertEqual(self.juzgar(274116, woo(27411663, en_stock=False))[0], ("caida", "api de la tienda: sin stock"))

    def test_mas_cara_que_lo_publicado_ya_no_es_la_oferta(self):
        juicio, _ = self.juzgar(274116, woo(31428200))
        self.assertEqual(juicio[0], "caida")
        self.assertIn("$314.282", juicio[1])

    def test_si_la_api_no_responde_o_no_la_encuentra_queda_la_revision_de_la_pagina(self):
        self.assertIsNone(self.juzgar(274116, (503, ""))[0])
        self.assertIsNone(self.juzgar(274116, (200, "[]"))[0])
        self.assertIsNone(self.juzgar(274116, (200, "no es json"))[0])

    def test_una_url_que_no_es_de_producto_no_se_consulta(self):
        with mock.patch.object(v, "pedir_api") as pedir:
            self.assertIsNone(v.revisar_woo("https://maxtecno.com.ar/categoria/x/", 1, "https://maxtecno.com.ar"))
        pedir.assert_not_called()


class Agregador(unittest.TestCase):
    """Lo que llega por ComparaYa desde otra tienda: el precio tiene que verse en la pagina de esa tienda.
    19/10: Fravega bloquea su API (CloudFront 403) y su HTML no trae el precio; ya armada en el navegador muestra
    $1.833.999, el mismo que trajo ComparaYa."""

    def juzgar(self, html=None, dom=None, error=None):
        bajar = mock.patch.object(v, "bajar", side_effect=error) if error else \
            mock.patch.object(v, "bajar", return_value=(200, html or ""))
        with bajar, mock.patch.object(v, "renderizar", return_value=dom) as abrir:
            return v.revisar_agregador(FRAVEGA, 1833999), abrir

    def test_el_precio_en_el_html_alcanza_sin_abrir_el_navegador(self):
        juicio, abrir = self.juzgar(html="<span>$1.833.999</span>")
        self.assertEqual(juicio, ("viva", "precio confirmado en la tienda"))
        abrir.assert_not_called()

    def test_el_precio_que_arma_el_javascript_se_confirma_en_el_navegador(self):
        juicio, _ = self.juzgar(html="<div id=app></div>", dom="Xiaomi Poco F8 Ultra $2.898.146 $1.833.999")
        self.assertEqual(juicio, ("viva", "precio confirmado en la tienda (renderizada)"))

    def test_otro_precio_en_la_tienda_no_confirma_la_oferta(self):
        juicio, _ = self.juzgar(html="", dom="Xiaomi Poco F8 Ultra $1.999.999")
        self.assertEqual(juicio, ("caida", "agregador: el precio no aparece en la tienda (muestra $1.999.999)"))
        juicio, _ = self.juzgar(html="", dom="<div>cargando</div>")
        self.assertEqual(juicio, ("caida", "agregador: el precio no aparece en la tienda (sin precios en 19 caracteres: «»)"))

    def test_el_cartel_de_sin_stock_la_da_por_caida(self):
        self.assertEqual(self.juzgar(html="Este producto no está disponible $1.833.999")[0], ("caida", "estatica"))
        self.assertEqual(self.juzgar(html="", dom="Este producto no está disponible")[0], ("caida", "renderizada"))

    def test_el_bloqueo_de_cloudfront_es_no_poder_abrirla(self):
        # 19/10: a los servidores de GitHub Fravega les devuelve esta pagina de 925 caracteres en vez de la ficha
        cloudfront = "<TITLE>ERROR: The request could not be satisfied</TITLE> 403 ERROR Request blocked."
        self.assertEqual(self.juzgar(html="", dom=cloudfront)[0], ("caida", "agregador: no se pudo abrir la tienda"))

    def test_el_desafio_de_cloudflare_es_no_poder_abrirla(self):
        # 19/10: DHgate respondia "Just a moment..." a los servidores de GitHub
        self.assertEqual(self.juzgar(html="", dom="<title>Just a moment...</title>")[0],
                         ("caida", "agregador: no se pudo abrir la tienda"))

    def test_bloqueada_o_sin_red_no_se_publica(self):
        error = urllib.error.HTTPError(FRAVEGA, 403, "no", {}, None)
        self.assertEqual(self.juzgar(error=error, dom=None)[0], ("caida", "agregador: no se pudo abrir la tienda"))
        self.assertEqual(self.juzgar(html="captcha", dom="captcha $1.833.999")[0],
                         ("caida", "agregador: no se pudo abrir la tienda"))


class Despacho(unittest.TestCase):
    def test_cada_fuente_se_verifica_a_su_manera(self):
        with mock.patch.object(v, "revisar_ml", return_value=None), \
                mock.patch.object(v, "revisar_woo", return_value=("viva", "api de la tienda")) as woo_, \
                mock.patch.object(v, "revisar_agregador", return_value=("viva", "precio confirmado en la tienda")) as agr, \
                mock.patch.object(v, "estatica", return_value="viva"), mock.patch.object(v, "renderizar", return_value=None):
            self.assertEqual(v.revisar(MAXTECNO, precio=274116, tienda="maxtecno"), ("viva", "api de la tienda"))
            self.assertEqual(v.revisar(FRAVEGA, precio=1833999, tienda="comparaya"), ("viva", "precio confirmado en la tienda"))
            self.assertEqual(v.revisar("https://compragamer.com/producto/x", precio=1, tienda="compragamer"), ("viva", "estatica"))
        self.assertEqual(woo_.call_args[0][2], "https://maxtecno.com.ar")
        agr.assert_called_once_with(FRAVEGA, 1833999)

    def test_main_pasa_la_tienda_de_cada_oferta(self):
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, True)
        ruta = os.path.join(d, "o.json")
        Path(ruta).write_text(json.dumps({"ofertas": [{"url": FRAVEGA, "precio": 1, "tienda": "comparaya"}]}), encoding="utf-8")
        with mock.patch.object(v, "revisar", return_value=("viva", "x")) as revisar, redirect_stdout(io.StringIO()):
            v.main([ruta, "--descartadas", os.path.join(d, "d.json")])
        self.assertEqual(revisar.call_args[1]["tienda"], "comparaya")
