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
        self.assertTrue(cuerpo["disable_web_page_preview"])
        self.assertIn("SSD Kingston 1TB", cuerpo["text"])

    def test_si_telegram_falla_la_corrida_sigue_y_el_token_no_se_imprime(self):
        def falla(*a, **k):
            raise urllib.error.URLError("sin red")
        codigo, texto = self.correr({"TELEGRAM_BOT_TOKEN": "123:ABC", "TELEGRAM_CHAT_ID": "@c"}, falla)
        self.assertEqual(codigo, 0)
        self.assertIn("::warning::", texto)
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
