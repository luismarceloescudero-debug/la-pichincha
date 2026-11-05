"""spec 061: catalogo de errores conocidos (E1 tienda en 0, E2 429 de Mercado Libre, E3 Cloudflare) y aviso al dueno."""
import email.message
import io
import json
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import avisar_dueno
import indexar
import mercadolibre as ml
import salud


def http_error(codigo, cabeceras=None, cuerpo=b""):
    h = email.message.Message()
    for k, v in (cabeceras or {}).items():
        h[k] = v
    return urllib.error.HTTPError("https://tienda.test/", codigo, "x", h, io.BytesIO(cuerpo))


class Respuesta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def callado(f, *a, **k):
    with redirect_stdout(io.StringIO()):
        return f(*a, **k)


class Reintento(unittest.TestCase):
    """E1: una tienda en 0 (o con la red cortada) se reintenta una vez; un bloqueo nunca."""

    def test_cero_y_despues_productos_se_recupera(self):
        leer, dormir = mock.Mock(side_effect=[[], [{"url": "u"}]]), mock.Mock()
        self.assertEqual(callado(indexar.relevar, leer, 7, dormir), ([{"url": "u"}], None, True))
        dormir.assert_called_once_with(7)

    def test_cero_dos_veces_queda_en_cero_sin_error(self):
        leer = mock.Mock(return_value=[])
        self.assertEqual(callado(indexar.relevar, leer, 0, mock.Mock()), ([], None, True))
        self.assertEqual(leer.call_count, 2)

    def test_con_productos_no_se_reintenta(self):
        leer, dormir = mock.Mock(return_value=[1]), mock.Mock()
        self.assertEqual(callado(indexar.relevar, leer, 0, dormir), ([1], None, False))
        dormir.assert_not_called()

    def test_un_corte_de_red_se_reintenta_una_vez(self):
        leer = mock.Mock(side_effect=[urllib.error.URLError("dns"), [1]])
        self.assertEqual(callado(indexar.relevar, leer, 0, mock.Mock()), ([1], None, True))
        leer = mock.Mock(side_effect=OSError("sin red"))
        items, error, reintentada = callado(indexar.relevar, leer, 0, mock.Mock())
        self.assertEqual((items, reintentada, leer.call_count), ([], True, 2))
        self.assertIsInstance(error, OSError)

    def test_un_bloqueo_no_se_reintenta(self):
        for error in (indexar.BloqueoCloudflare("cf"), http_error(403), http_error(429),
                      RuntimeError("la tienda respondio 503 en 1/2: no se insiste hoy"), ValueError("plantilla")):
            leer = mock.Mock(side_effect=error)
            items, devuelto, reintentada = callado(indexar.relevar, leer, 0, mock.Mock())
            self.assertEqual((items, reintentada, leer.call_count), ([], False, 1), error)
            self.assertIs(devuelto, error)

    def test_la_espera_por_defecto_es_la_constante(self):
        leer, dormir = mock.Mock(side_effect=[[], [1]]), mock.Mock()
        with mock.patch.object(indexar, "ESPERA_REINTENTO", 3):
            callado(indexar.relevar, leer, dormir=dormir)
        dormir.assert_called_once_with(3)


class Motivo(unittest.TestCase):
    def test_cada_error_con_su_motivo(self):
        casos = [(indexar.BloqueoCloudflare("x"), "cloudflare"),
                 (http_error(403, {"cf-mitigated": "challenge"}), "cloudflare"),
                 (http_error(403), "bloqueo"), (http_error(429), "bloqueo"), (http_error(500), "error"),
                 (RuntimeError("Mercado Libre respondio 429: no se insiste hoy"), "bloqueo"),
                 (urllib.error.URLError("dns"), "red"), (TimeoutError(), "red"), (OSError("x"), "red"),
                 (ValueError("x"), "error"), (KeyError("x"), "error")]
        for error, motivo in casos:
            self.assertEqual(indexar.motivo_de(error), motivo, error)

    def test_mira_la_causa_encadenada(self):
        try:
            try:
                raise http_error(403, {"cf-mitigated": "challenge"})
            except urllib.error.HTTPError as e:
                raise RuntimeError("la tienda respondio 403 en 1/2: no se insiste hoy") from e
        except RuntimeError as e:
            self.assertEqual(indexar.motivo_de(e), "cloudflare")
        try:
            try:
                raise OSError("corte")
            except OSError as e:
                raise KeyError("x") from e
        except KeyError as e:
            self.assertEqual(indexar.motivo_de(e), "red")


class Cloudflare(unittest.TestCase):
    """E3: el desafio de Cloudflare no se esquiva; se saltea la tienda entera."""

    def test_por_la_cabecera_o_por_la_pagina(self):
        self.assertTrue(indexar._desafio_cloudflare(http_error(403, {"Cf-Mitigated": "challenge"})))
        self.assertTrue(indexar._desafio_cloudflare(
            http_error(503, {"Server": "cloudflare"}, b"<title>Just a moment...</title>")))
        self.assertFalse(indexar._desafio_cloudflare(http_error(403, {"Server": "cloudflare"}, b"Forbidden")))
        self.assertFalse(indexar._desafio_cloudflare(http_error(403, {"Server": "nginx"}, b"Just a moment")))
        self.assertFalse(indexar._desafio_cloudflare(http_error(404, {"Cf-Mitigated": "challenge"})))
        self.assertFalse(indexar._desafio_cloudflare(ValueError("x")))

    def test_bajar_lo_convierte_en_bloqueo_cloudflare(self):
        with mock.patch("urllib.request.urlopen", side_effect=http_error(403, {"cf-mitigated": "challenge"})):
            with self.assertRaises(indexar.BloqueoCloudflare):
                indexar.bajar("https://fullh4rd.test/")

    def test_bajar_deja_pasar_otro_http_error(self):
        with mock.patch("urllib.request.urlopen", side_effect=http_error(404)):
            with self.assertRaises(urllib.error.HTTPError):
                indexar.bajar("https://tienda.test/")

    def test_no_lo_atrapan_los_lectores_que_cortan_por_red(self):
        # _paginar_woocommerce corta ante errores de red; el desafio tiene que llegar a relevar() para saltear la tienda.
        with mock.patch.object(indexar, "bajar", side_effect=indexar.BloqueoCloudflare("cf")):
            with self.assertRaises(indexar.BloqueoCloudflare):
                indexar._paginar_woocommerce("https://t.test/p?page={n}", 3)


class MercadoLibre429(unittest.TestCase):
    """E2: el 429 se resuelve esperando y reintentando (30 s y 90 s, o lo que diga Retry-After)."""

    def test_espera_lo_que_dice_retry_after_con_tope(self):
        self.assertEqual(ml.espera_429(http_error(429, {"Retry-After": "45"}), 0), 45)
        self.assertEqual(ml.espera_429(http_error(429, {"Retry-After": "9999"}), 0), ml.TOPE_RETRY_AFTER)
        self.assertEqual(ml.espera_429(http_error(429, {"Retry-After": "0"}), 0), 1)
        self.assertEqual(ml.espera_429(http_error(429, {"Retry-After": "mañana"}), 1), ml.ESPERAS_429[1])
        self.assertEqual(ml.espera_429(http_error(429, {"Retry-After": "nan"}), 0), ml.ESPERAS_429[0])
        self.assertEqual(ml.espera_429(http_error(429), 0), ml.ESPERA_429)
        self.assertEqual(ml.espera_429(http_error(429), 5), ml.ESPERAS_429[-1])

    def test_dos_429_y_despues_responde(self):
        abrir = mock.Mock(side_effect=[http_error(429), http_error(429), Respuesta(b'{"ok": 1}')])
        dormir = mock.Mock()
        self.assertEqual(ml.pedidor("t", abrir, dormir)("/x"), {"ok": 1})
        esperas = [c.args[0] for c in dormir.call_args_list if c.args[0] != ml.PAUSA]
        self.assertEqual(esperas, list(ml.ESPERAS_429))

    def test_tres_429_cortan_la_fuente(self):
        abrir = mock.Mock(side_effect=[http_error(429)] * 3)
        with self.assertRaises(RuntimeError):
            ml.pedidor("t", abrir, mock.Mock())("/x")
        self.assertEqual(abrir.call_count, 3)


class Salud(unittest.TestCase):
    def test_el_informe_lleva_el_motivo(self):
        informe = salud.evaluar({"a": 10}, {"a": 0, "b": 5}, {"a": "A"}, "hoy",
                                notas={"a": {"motivo": "cloudflare", "detalle": "x", "reintentada": False, "otra": 1}})
        self.assertEqual(informe["fuentes"]["a"]["motivo"], "cloudflare")
        self.assertNotIn("otra", informe["fuentes"]["a"])
        self.assertNotIn("motivo", informe["fuentes"]["b"])


class AvisoAlDueno(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: [p.unlink() for p in self.dir.iterdir()] and None)

    def escribir(self, nombre, contenido):
        ruta = self.dir / nombre
        ruta.write_text(contenido if isinstance(contenido, str) else json.dumps(contenido), encoding="utf-8")
        return str(ruta)

    def test_katech_en_cero_dice_el_motivo_y_el_arreglo(self):
        lineas = avisar_dueno.lineas_salud({"fuentes": {
            "katech": {"nombre": "Katech", "estado": "fallo", "ahora": 0, "previo": 2094, "motivo": "sin productos"},
            "fullh4rd": {"nombre": "FullH4rd", "estado": "fallo", "ahora": 0, "previo": 0, "motivo": "cloudflare"},
            "mexx": {"nombre": "Mexx", "estado": "baja", "ahora": 50, "previo": 100},
            "cg": {"nombre": "CG", "estado": "ok", "ahora": 10, "previo": 10, "motivo": "recuperada"},
            "rara": {"nombre": "Rara <b>", "estado": "fallo", "ahora": 0, "previo": 3, "motivo": "error", "detalle": "KeyError: 'precio'"},
        }})
        self.assertEqual(len(lineas), 4)
        self.assertIn("Katech: 0 productos", lineas[0])
        self.assertIn("corrida anterior", lineas[0])
        self.assertIn("Cloudflare", lineas[1])
        self.assertIn("no aparece en el buscador", lineas[1])
        self.assertIn("50 %", lineas[2])
        self.assertIn("Rara &lt;b&gt;", lineas[3])
        self.assertIn("KeyError", lineas[3])

    def test_sin_salud_avisa_que_el_indexado_no_termino(self):
        self.assertIn("no termino", avisar_dueno.lineas_salud(None, "failure")[0])
        self.assertEqual(avisar_dueno.lineas_salud(None, "skipped"), [])
        self.assertIsNone(avisar_dueno.leer_salud(self.dir / "no-esta.json"))

    def test_nada_que_avisar_no_manda_nada(self):
        ruta = self.escribir("salud.json", {"fuentes": {"a": {"nombre": "A", "estado": "ok", "ahora": 1, "previo": 1}}})
        with mock.patch.object(avisar_dueno.publicar_telegram, "pedir") as pedir:
            salida = io.StringIO()
            with redirect_stdout(salida):
                self.assertEqual(avisar_dueno.main(["--salud", ruta], {"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_DUENO": "1"}), 0)
        pedir.assert_not_called()
        self.assertIn("Nada que avisar", salida.getvalue())

    def test_manda_al_chat_privado_con_el_enlace_a_la_corrida(self):
        ruta = self.escribir("salud.json", {"fuentes": {"k": {"nombre": "Katech", "estado": "fallo", "ahora": 0, "previo": 9}}})
        alarma = self.escribir("alarma.md", "## Alarma\n\n**Placas de video**: sin ofertas\n")
        entorno = {"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_DUENO": "42", "TELEGRAM_CHAT_ID": "@canal",
                   "GITHUB_RUN_ID": "7", "GITHUB_REPOSITORY": "o/r"}
        with mock.patch.object(avisar_dueno.publicar_telegram, "pedir", return_value={}) as pedir:
            callado(avisar_dueno.main, ["--salud", ruta, "--alarma", alarma], entorno)
        token, metodo, campos = pedir.call_args.args
        self.assertEqual((token, metodo, campos["chat_id"], campos["parse_mode"]), ("t", "sendMessage", "42", "HTML"))
        self.assertIn("Katech: 0 productos", campos["text"])
        self.assertIn("Placas de video", campos["text"])
        self.assertNotIn("**", campos["text"])
        self.assertIn("https://github.com/o/r/actions/runs/7", campos["text"])

    def test_nunca_al_canal(self):
        ruta = self.escribir("salud.json", {"fuentes": {"k": {"nombre": "K", "estado": "fallo", "ahora": 0, "previo": 0}}})
        salida = io.StringIO()
        with mock.patch.object(avisar_dueno.publicar_telegram, "pedir") as pedir, redirect_stdout(salida):
            avisar_dueno.main(["--salud", ruta], {"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_DUENO": "@canal ",
                                                  "TELEGRAM_CHAT_ID": "@canal"})
        pedir.assert_not_called()
        self.assertIn("::warning::", salida.getvalue())

    def test_sin_el_secreto_deja_un_warning_y_no_falla(self):
        ruta = self.escribir("salud.json", {"fuentes": {"k": {"nombre": "Katech", "estado": "fallo", "ahora": 0, "previo": 0}}})
        for entorno, falta in (({"TELEGRAM_BOT_TOKEN": "t"}, "TELEGRAM_CHAT_DUENO"),
                               ({"TELEGRAM_CHAT_DUENO": "1"}, "TELEGRAM_BOT_TOKEN")):
            salida = io.StringIO()
            with mock.patch.object(avisar_dueno.publicar_telegram, "pedir") as pedir, redirect_stdout(salida):
                self.assertEqual(avisar_dueno.main(["--salud", ruta], entorno), 0)
            pedir.assert_not_called()
            self.assertIn("::warning::Falta el secreto " + falta, salida.getvalue())
            self.assertIn("Katech: 0 productos", salida.getvalue())
            self.assertNotIn("<b>", salida.getvalue())

    def test_corrida_fallida_nombra_los_jobs(self):
        necesidades = json.dumps({"tests": {"result": "success"}, "construir": {"result": "failure"},
                                  "publicar": {"result": "skipped"}})
        with mock.patch.object(avisar_dueno.publicar_telegram, "pedir", return_value=None) as pedir:
            callado(avisar_dueno.main, ["--corrida-fallida"], {"TELEGRAM_BOT_TOKEN": "t", "TELEGRAM_CHAT_DUENO": "1",
                                                               "NECESIDADES": necesidades})
        texto = pedir.call_args.args[2]["text"]
        self.assertIn("Fallo la corrida", texto)
        self.assertIn("(construir)", texto)
        self.assertEqual(avisar_dueno.jobs_fallidos("no es json"), [])

    def test_seco_muestra_y_no_manda(self):
        salida = io.StringIO()
        with mock.patch.object(avisar_dueno.publicar_telegram, "pedir") as pedir, redirect_stdout(salida):
            avisar_dueno.main(["--corrida-fallida", "--seco", "--alarma", str(self.dir / "no-esta.md")], {})
        pedir.assert_not_called()
        self.assertIn("un paso", salida.getvalue())

    def test_alarma_larga_y_mensaje_largo_se_cortan(self):
        larga = "\n".join("linea " + str(i) + " " + "x" * 50 for i in range(200))
        self.assertLessEqual(len(avisar_dueno.resumen_alarma(larga)), avisar_dueno.LARGO_ALARMA + 2)
        texto = avisar_dueno.mensaje(["a" * 5000 + "\nfin"], "https://x.test/r")
        self.assertLess(len(texto), 4096)
        self.assertEqual(avisar_dueno.mensaje([None, ""]), "")
        self.assertEqual(avisar_dueno.url_corrida({}), "")


if __name__ == "__main__":
    unittest.main()
