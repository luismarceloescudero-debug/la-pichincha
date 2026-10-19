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

import publicar_telegram as telegram

OFERTAS = {"generado": "2026-10-09T08:12-03:00", "sitio": "https://ejemplo.test/la-pichincha/", "ofertas": [
    {"nombre": "SSD Kingston 1TB", "precio": 90000, "antes": 120000, "descuento": 25, "comercio": "CompraGamer",
     "url": "https://t.test/ssd", "tipo": "propia"},
    {"nombre": "Memoria <b>Fury</b> & Co", "precio": 24000, "antes": 30000, "descuento": 20, "comercio": "Fravega",
     "url": "https://t.test/mem?a=1&b=2", "tipo": "publicada"}]}


class Mensaje(unittest.TestCase):
    def test_trae_las_ofertas_con_precio_descuento_comercio_enlace_y_la_hora(self):
        texto = telegram.mensaje(OFERTAS)
        self.assertIn("<b>Pichinchas del día</b>", texto)
        self.assertIn("precios del 09/10 08:12", texto)
        self.assertIn('1. <a href="https://t.test/ssd">SSD Kingston 1TB</a>: $90.000 (−25%) en CompraGamer', texto)
        self.assertIn('<a href="https://ejemplo.test/la-pichincha/">La Pichincha</a>', texto)
        self.assertIn("Verificá en la tienda antes de comprar", texto)

    def test_escapa_el_texto_de_terceros(self):
        texto = telegram.mensaje(OFERTAS)
        self.assertNotIn("<b>Fury</b>", texto)
        self.assertIn("Memoria &lt;b&gt;Fury&lt;/b&gt; &amp; Co", texto)
        self.assertIn('href="https://t.test/mem?a=1&amp;b=2"', texto)

    def test_si_solo_hay_fecha_sin_hora_dice_la_fecha(self):
        self.assertIn("precios del 07/10" + chr(10), telegram.mensaje({**OFERTAS, "generado": "2026-10-07"}))
        self.assertNotIn("precios del  ", telegram.mensaje({**OFERTAS, "generado": "2026-10-07"}))

    def test_una_compra_internacional_dice_su_costo_puesto_en_casa_y_escapado(self):
        puesto = "costo puesto en casa, estimado: $306.000 a $370.260. Local <b>más</b> barato"
        internacional = {**OFERTAS["ofertas"][0], "comercio": "Mercado Libre · compra internacional", "puesto": puesto}
        texto = telegram.mensaje({**OFERTAS, "ofertas": [internacional, OFERTAS["ofertas"][1]]})
        self.assertIn("costo puesto en casa, estimado: $306.000 a $370.260", texto)
        self.assertIn("Local &lt;b&gt;más&lt;/b&gt; barato", texto)
        self.assertEqual(texto.count("costo puesto en casa"), 1)      # la oferta local no lo trae

    def test_sin_ofertas_no_hay_mensaje(self):
        self.assertIsNone(telegram.mensaje({**OFERTAS, "ofertas": []}))

    def test_no_pasa_el_limite_de_telegram(self):
        muchas = [{**OFERTAS["ofertas"][0], "nombre": "X" * 300, "url": f"https://t.test/{i}"} for i in range(40)]
        texto = telegram.mensaje({**OFERTAS, "ofertas": muchas})
        self.assertLessEqual(len(texto), 4096)
        self.assertIn("La Pichincha", texto)


class Publicacion(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.ruta = self.dir / "ofertas.json"
        self.ruta.write_text(json.dumps(OFERTAS), encoding="utf-8")

    def correr(self, env, urlopen):
        salida = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(telegram.urllib.request, "urlopen", urlopen), \
                redirect_stdout(salida):
            codigo = telegram.main([str(self.ruta)])
        return codigo, salida.getvalue()

    def test_sin_token_o_sin_canal_no_hace_ningun_pedido(self):
        for env in ({}, {"TELEGRAM_BOT_TOKEN": "t"}, {"TELEGRAM_CHAT_ID": "@canal"}):
            abrir = mock.Mock()
            codigo, texto = self.correr(env, abrir)
            self.assertEqual(codigo, 0)
            abrir.assert_not_called()
            self.assertIn("sin configurar", texto)

    def test_con_token_y_canal_manda_un_mensaje_html(self):
        abrir = mock.MagicMock()
        codigo, _ = self.correr({"TELEGRAM_BOT_TOKEN": "123:ABC", "TELEGRAM_CHAT_ID": "@pichinchas"}, abrir)
        self.assertEqual(codigo, 0)
        self.assertEqual(abrir.call_count, 1)
        pedido = abrir.call_args[0][0]
        self.assertEqual(pedido.full_url, "https://api.telegram.org/bot123:ABC/sendMessage")
        cuerpo = json.loads(pedido.data.decode("utf-8"))
        self.assertEqual(cuerpo["chat_id"], "@pichinchas")
        self.assertEqual(cuerpo["parse_mode"], "HTML")
        # La miniatura: la vista previa grande de la pagina /hoy/ del sitio.
        self.assertNotIn("disable_web_page_preview", cuerpo)
        self.assertEqual(cuerpo["link_preview_options"]["url"], OFERTAS["sitio"] + "hoy/")
        self.assertTrue(cuerpo["link_preview_options"]["prefer_large_media"])
        self.assertIn("SSD Kingston 1TB", cuerpo["text"])

    def test_si_telegram_falla_la_corrida_sigue_y_el_token_no_se_imprime(self):
        def falla(*a, **k):
            raise urllib.error.URLError("sin red")
        codigo, texto = self.correr({"TELEGRAM_BOT_TOKEN": "123:ABC", "TELEGRAM_CHAT_ID": "@c"}, falla)
        self.assertEqual(codigo, 0)
        self.assertIn("::warning::", texto)
        self.assertNotIn("123:ABC", texto)

    def test_un_error_de_telegram_muestra_codigo_y_motivo_sin_el_token(self):
        def falla(pedido, timeout=None):
            cuerpo = io.BytesIO(b'{"ok":false,"error_code":403,"description":"Forbidden: bot is not a member of the channel chat 123:ABC"}')
            raise urllib.error.HTTPError(pedido.full_url, 403, "Forbidden", {}, cuerpo)
        codigo, texto = self.correr({"TELEGRAM_BOT_TOKEN": "123:ABC", "TELEGRAM_CHAT_ID": "@c"}, falla)
        self.assertEqual(codigo, 0)
        self.assertIn("403", texto)
        self.assertIn("bot is not a member", texto)
        self.assertNotIn("123:ABC", texto)

    def test_sin_ofertas_no_manda_nada(self):
        self.ruta.write_text(json.dumps({**OFERTAS, "ofertas": []}), encoding="utf-8")
        abrir = mock.Mock()
        codigo, _ = self.correr({"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "c"}, abrir)
        self.assertEqual(codigo, 0)
        abrir.assert_not_called()

    def test_sin_archivo_de_ofertas_no_falla(self):
        self.ruta.unlink()
        abrir = mock.Mock()
        codigo, _ = self.correr({"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_ID": "c"}, abrir)
        self.assertEqual(codigo, 0)
        abrir.assert_not_called()


if __name__ == "__main__":
    unittest.main()


class Categoria(unittest.TestCase):
    def test_la_linea_dice_la_categoria_cuando_el_dato_la_trae(self):
        datos = {**OFERTAS, "ofertas": [{**OFERTAS["ofertas"][0], "categoria": "Notebook"}]}
        self.assertIn('1. <i>Notebook</i> · <a href="https://t.test/ssd">SSD Kingston 1TB</a>', telegram.mensaje(datos))

    def test_sin_categoria_la_linea_queda_como_antes(self):
        self.assertIn('1. <a href="https://t.test/ssd">SSD Kingston 1TB</a>', telegram.mensaje(OFERTAS))


class TitulosLargos(unittest.TestCase):
    """19/10: un titulo de Mercado Libre de 160 caracteres ("... Battery 5160 mah Carga rapida 45 W Diseno Ultrafino De 6.6 mm Ip64") ocupaba cuatro lineas del mensaje."""

    LARGO = ("Celular Infinix Hot 60 Pro Phone Dual Sim Negro 8 GB Ram 256 GB Rom 6.78 Amoled 1.5k 144 Hz Battery 5160 mah "
             "Carga rápida 45 W Diseño Ultrafino De 6.6 mm Ip64")

    def test_un_titulo_largo_se_corta_en_una_palabra_entera_con_puntos_suspensivos(self):
        corto = telegram.acortar(self.LARGO)
        self.assertLessEqual(len(corto), telegram.LARGO_TITULO)
        self.assertTrue(corto.endswith("…"))
        self.assertTrue(self.LARGO.startswith(corto[:-1].rstrip()))
        self.assertNotIn(" 6.78 Amoled 1.5k 144 Hz Battery", corto)
        self.assertFalse(corto[:-1].endswith(" "))

    def test_un_titulo_corto_queda_igual(self):
        self.assertEqual(telegram.acortar("Notebook Lenovo IdeaPad 3 15 16GB 512GB"), "Notebook Lenovo IdeaPad 3 15 16GB 512GB")

    def test_una_palabra_sola_larguisima_se_corta_de_todos_modos(self):
        self.assertEqual(len(telegram.acortar("A" * 300)), telegram.LARGO_TITULO)

    def test_el_mensaje_usa_el_titulo_corto_y_el_enlace_sigue_igual(self):
        datos = {"generado": "2026-10-19T15:53-03:00", "sitio": "https://t.test/", "ofertas": [
            {"nombre": self.LARGO, "precio": 479999, "descuento": 31, "comercio": "Mercado Libre", "url": "https://t.test/p/MLA1",
             "categoria": "Smartphone"}]}
        m = telegram.mensaje(datos)
        self.assertNotIn("Ip64", m)
        self.assertIn('<a href="https://t.test/p/MLA1">Celular Infinix Hot 60 Pro', m)
        self.assertIn("…</a>", m)
