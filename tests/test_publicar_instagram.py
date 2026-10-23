import io
import json
import os
import shutil
import subprocess
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import publicar_instagram as ig

OFERTAS = {"generado": "2026-10-23T14:18-03:00", "sitio": "https://ejemplo.test/", "ofertas": [
    {"nombre": "SSD Kingston 1TB", "precio": 90000, "antes": 120000, "descuento": 25, "comercio": "CompraGamer",
     "url": "https://t.test/ssd", "tipo": "propia", "categoria": "SSD"},
    {"nombre": "Memoria <b>Fury</b> & Co", "precio": 24000, "antes": 30000, "descuento": 20, "comercio": "Fravega",
     "url": "https://t.test/mem", "tipo": "publicada"}]}
POST = {"fecha": "2026-10-23", "imagen": "https://ejemplo.test/instagram/2026-10-23.jpg", "texto": "Pichinchas"}


class Texto(unittest.TestCase):
    def test_trae_cada_oferta_con_precio_descuento_y_comercio_y_manda_a_hoy(self):
        t = ig.texto(OFERTAS)
        self.assertTrue(t.startswith("Pichinchas del día · precios del 23/10 14:18"))
        self.assertIn("1. SSD Kingston 1TB\n$90.000 (−25%) en CompraGamer", t)
        self.assertIn("2. Memoria <b>Fury</b> & Co\n$24.000 (−20%) en Fravega", t)   # texto plano: Instagram no interpreta HTML
        self.assertIn("ejemplo.test/hoy (link en la bio)", t)
        self.assertIn("verificá en la tienda antes de comprar", t)
        self.assertTrue(t.endswith(ig.ETIQUETAS))

    def test_una_compra_internacional_dice_su_costo_puesto_en_casa(self):
        puesto = {**OFERTAS["ofertas"][0], "puesto": "costo puesto en casa, estimado: $306.000 a $370.260"}
        self.assertIn("en CompraGamer\ncosto puesto en casa", ig.texto({**OFERTAS, "ofertas": [puesto]}))

    def test_sin_ofertas_no_hay_texto(self):
        self.assertIsNone(ig.texto({**OFERTAS, "ofertas": []}))

    def test_no_pasa_el_limite_de_instagram(self):
        muchas = [{**OFERTAS["ofertas"][0], "nombre": "X" * 300} for _ in range(40)]
        t = ig.texto({**OFERTAS, "ofertas": muchas})
        self.assertLessEqual(len(t), ig.LIMITE)
        self.assertIn("link en la bio", t)

    def test_la_fecha_sale_del_indice_o_de_hoy(self):
        self.assertEqual(ig.fecha_de(OFERTAS), "2026-10-23")
        self.assertRegex(ig.fecha_de({}), r"^\d{4}-\d\d-\d\d$")


class Tarjeta(unittest.TestCase):
    def test_lleva_las_primeras_ofertas_escapadas_con_la_fecha_y_el_sitio(self):
        pagina = ig.tarjeta(OFERTAS)
        self.assertIn("<span>23/10</span>", pagina)
        self.assertIn("−25%", pagina)
        self.assertIn("$90.000", pagina)
        self.assertIn("<s>$120.000</s>", pagina)
        self.assertIn("CompraGamer · SSD", pagina)
        self.assertIn("Memoria &lt;b&gt;Fury&lt;/b&gt; &amp; Co", pagina)
        self.assertNotIn("<b>Fury</b>", pagina)
        self.assertIn("<b>ejemplo.test/hoy</b>", pagina)
        self.assertIn(f"width:{ig.ANCHO}px;height:{ig.ALTO}px", pagina)

    def test_no_pasa_de_cinco_ofertas(self):
        muchas = [{**OFERTAS["ofertas"][0], "nombre": f"Oferta {i}"} for i in range(9)]
        self.assertEqual(ig.tarjeta({**OFERTAS, "ofertas": muchas}).count('class="pct"'), ig.EN_TARJETA)


class Armar(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.ofertas = self.dir / "ofertas.json"
        self.ofertas.write_text(json.dumps(OFERTAS), encoding="utf-8")
        self.post = self.dir / "instagram.json"

    def correr(self, chrome="chrome", run=None, ofertas=None):
        salida = io.StringIO()
        with mock.patch.object(ig, "navegador", return_value=chrome), mock.patch.object(ig.subprocess, "run", run or mock.Mock()), \
                redirect_stdout(salida):
            codigo = ig.armar(str(ofertas or self.ofertas), str(self.dir / "_sitio"), str(self.post))
        return codigo, salida.getvalue()

    @staticmethod
    def chrome_que_saca(contenido):
        def run(cmd, **_):
            destino = next(a for a in cmd if a.startswith("--screenshot=")).split("=", 1)[1]
            Path(destino).write_bytes(contenido)
        return run

    def test_saca_la_imagen_y_escribe_la_direccion_publica_y_el_texto(self):
        codigo, salida = self.correr(run=self.chrome_que_saca(b"\xff\xd8\xff\xe0jpeg"))
        self.assertEqual(codigo, 0)
        self.assertTrue((self.dir / "_sitio" / "instagram" / "2026-10-23.jpg").is_file())
        post = json.loads(self.post.read_text(encoding="utf-8"))
        self.assertEqual(post["imagen"], "https://ejemplo.test/instagram/2026-10-23.jpg")
        self.assertEqual(post["fecha"], "2026-10-23")
        self.assertEqual(post["texto"], ig.texto(OFERTAS))
        self.assertIn("instagram/2026-10-23.jpg", salida)

    def test_chrome_recibe_el_tamano_y_un_jpg(self):
        run = mock.Mock(side_effect=self.chrome_que_saca(b"\xff\xd8\xff"))
        self.correr(run=run)
        cmd = run.call_args.args[0]
        self.assertIn(f"--window-size={ig.ANCHO},{ig.ALTO}", cmd)
        self.assertTrue(any(a.startswith("--screenshot=") and a.endswith(".jpg") for a in cmd))

    def test_si_chrome_no_deja_un_jpeg_avisa_y_no_escribe_la_publicacion(self):
        for run in (self.chrome_que_saca(b"\x89PNG"), mock.Mock(side_effect=subprocess.CalledProcessError(1, "chrome")),
                    mock.Mock()):
            codigo, salida = self.correr(run=run)
            self.assertEqual(codigo, 0)
            self.assertIn("::warning::No se pudo sacar la imagen", salida)
            self.assertFalse(self.post.exists())

    def test_sin_chrome_sin_ofertas_o_sin_archivo_no_arma_nada(self):
        vacio = self.dir / "vacio.json"
        vacio.write_text(json.dumps({**OFERTAS, "ofertas": []}), encoding="utf-8")
        for kwargs, aviso in (({"chrome": None}, "No hay Chrome"), ({"ofertas": vacio}, "Sin ofertas hoy"),
                              ({"ofertas": self.dir / "no-esta.json"}, "No hay ")):
            codigo, salida = self.correr(**kwargs)
            self.assertEqual(codigo, 0)
            self.assertIn(aviso, salida)
            self.assertFalse(self.post.exists())

    def test_el_navegador_sale_de_chrome_bin_o_del_path(self):
        with mock.patch.dict(os.environ, {"CHROME_BIN": "/opt/chrome"}):
            self.assertEqual(ig.navegador(), "/opt/chrome")
        with mock.patch.dict(os.environ, {}, clear=True), mock.patch.object(ig.shutil, "which", lambda n: n == "chromium"):
            self.assertEqual(ig.navegador(), "chromium")


class Respuesta(io.BytesIO):
    def __init__(self, cuerpo, status=200, tipo="application/json"):
        super().__init__(json.dumps(cuerpo).encode() if not isinstance(cuerpo, bytes) else cuerpo)
        self.status, self.headers = status, {"Content-Type": tipo}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


def rechazo(codigo, cuerpo):
    return urllib.error.HTTPError("https://graph.instagram.com", codigo, "x", {}, io.BytesIO(cuerpo))


class Pedir(unittest.TestCase):
    def test_get_lleva_el_token_en_la_consulta_y_post_en_el_cuerpo(self):
        abrir = mock.Mock(side_effect=[Respuesta({"id": "1"}), Respuesta({"id": "2"})])
        with mock.patch.object(ig.urllib.request, "urlopen", abrir):
            self.assertEqual(ig.pedir("GET", "123/media", "tok", fields="timestamp"), {"id": "1"})
            ig.pedir("POST", "123/media_publish", "tok", creation_id="9")
        get, post = abrir.call_args_list[0].args[0], abrir.call_args_list[1].args[0]
        self.assertEqual(get.full_url, f"{ig.API}/123/media?fields=timestamp&access_token=tok")
        self.assertEqual(post.full_url, f"{ig.API}/123/media_publish")
        self.assertEqual(post.data, b"creation_id=9&access_token=tok")

    def test_un_rechazo_trae_el_mensaje_de_instagram_sin_el_token(self):
        cuerpo = json.dumps({"error": {"message": "Invalid token tok-secreto"}}).encode()
        with mock.patch.object(ig.urllib.request, "urlopen", mock.Mock(side_effect=rechazo(400, cuerpo))):
            with self.assertRaises(ig.ErrorInstagram) as e:
                ig.pedir("GET", "me", "tok-secreto")
        self.assertEqual(str(e.exception), "HTTP 400 Invalid token ***")

    def test_un_rechazo_sin_json_dice_solo_el_codigo(self):
        with mock.patch.object(ig.urllib.request, "urlopen", mock.Mock(side_effect=rechazo(500, b"<html>"))):
            with self.assertRaisesRegex(ig.ErrorInstagram, r"^HTTP 500$"):
                ig.pedir("GET", "me", "tok")


class Renovar(unittest.TestCase):
    def correr(self, respuesta, repo="dueno/repo", gh_token=None, run=None):
        salida = io.StringIO()
        pedir = mock.Mock(side_effect=respuesta) if isinstance(respuesta, Exception) else mock.Mock(return_value=respuesta)
        with mock.patch.object(ig, "pedir", pedir), mock.patch.object(ig.subprocess, "run", run or mock.Mock()), \
                redirect_stdout(salida):
            token = ig.renovar("viejo", repo, gh_token)
        return token, salida.getvalue()

    def test_si_vuelve_el_mismo_token_no_guarda_nada(self):
        run = mock.Mock()
        token, salida = self.correr({"access_token": "viejo", "expires_in": 5184000}, gh_token="pat", run=run)
        self.assertEqual(token, "viejo")
        self.assertIn("vence en 60 dias", salida)
        run.assert_not_called()

    def test_si_vuelve_uno_nuevo_lo_guarda_en_el_secreto_por_la_entrada_estandar(self):
        run = mock.Mock()
        token, salida = self.correr({"access_token": "IGQ-secreto", "expires_in": 5184000}, gh_token="pat", run=run)
        self.assertEqual(token, "IGQ-secreto")
        args, kwargs = run.call_args
        self.assertEqual(args[0], ["gh", "secret", "set", "INSTAGRAM_TOKEN", "--repo", "dueno/repo"])
        self.assertEqual(kwargs["input"], "IGQ-secreto")
        self.assertEqual(kwargs["env"]["GH_TOKEN"], "pat")
        self.assertNotIn("IGQ-secreto", salida)
        self.assertIn("guardado", salida)

    def test_uno_nuevo_sin_con_que_guardarlo_se_usa_y_avisa(self):
        token, salida = self.correr({"access_token": "IGQ-secreto", "expires_in": 5184000})
        self.assertEqual(token, "IGQ-secreto")
        self.assertIn("::warning::Instagram devolvio un token nuevo", salida)
        self.assertNotIn("IGQ-secreto", salida)

    def test_si_gh_falla_avisa_y_sigue_con_el_nuevo(self):
        token, salida = self.correr({"access_token": "nuevo"}, gh_token="pat",
                                    run=mock.Mock(side_effect=subprocess.CalledProcessError(1, "gh")))
        self.assertEqual(token, "nuevo")
        self.assertIn("::warning::No se pudo guardar", salida)

    def test_si_la_renovacion_falla_sigue_con_el_que_hay(self):
        token, salida = self.correr(ig.ErrorInstagram("HTTP 400 token muy nuevo"))
        self.assertEqual(token, "viejo")
        self.assertIn("::warning::No se pudo renovar el token de Instagram: HTTP 400 token muy nuevo", salida)


class PublicadoEl(unittest.TestCase):
    def ultima(self, data):
        with mock.patch.object(ig, "pedir", return_value={"data": data}):
            return ig.publicado_el("tok", "123", "2026-10-23")

    def test_compara_la_fecha_en_argentina(self):
        self.assertTrue(self.ultima([{"timestamp": "2026-10-23T15:00:00+0000"}]))
        self.assertFalse(self.ultima([{"timestamp": "2026-10-23T01:00:00+0000"}]))   # 22/10 a las 22 en Argentina
        self.assertFalse(self.ultima([]))
        self.assertFalse(self.ultima([{"timestamp": "raro"}]))


class EsperarImagen(unittest.TestCase):
    def test_espera_hasta_que_responde_un_jpeg(self):
        respuestas = [urllib.error.URLError("x"), Respuesta(b"", tipo="text/html"), Respuesta(b"", tipo="image/jpeg")]
        dormir = mock.Mock()
        with mock.patch.object(ig.urllib.request, "urlopen", mock.Mock(side_effect=respuestas)):
            self.assertTrue(ig.esperar_imagen(POST["imagen"], dormir))
        self.assertEqual(dormir.call_count, 2)

    def test_se_rinde_despues_de_los_intentos(self):
        dormir = mock.Mock()
        with mock.patch.object(ig.urllib.request, "urlopen", mock.Mock(side_effect=urllib.error.URLError("x"))):
            self.assertFalse(ig.esperar_imagen(POST["imagen"], dormir, intentos=3))
        self.assertEqual(dormir.call_count, 2)


class Publicar(unittest.TestCase):
    def api(self, estados, permalink=True):
        """Una API falsa: crea el contenedor, devuelve los estados en orden y publica."""
        estados = iter(estados)

        def pedir(metodo, ruta, token, **p):
            if ruta == "123/media":
                self.assertEqual((p["image_url"], p["caption"]), (POST["imagen"], POST["texto"]))
                return {"id": "c1"}
            if ruta == "c1":
                return {"status_code": next(estados)}
            if ruta == "123/media_publish":
                self.assertEqual(p["creation_id"], "c1")
                return {"id": "m1"}
            if not permalink:
                raise ig.ErrorInstagram("HTTP 500")
            return {"permalink": "https://www.instagram.com/p/abc/"}
        return pedir

    def test_crea_espera_a_que_termine_y_publica(self):
        dormir = mock.Mock()
        with mock.patch.object(ig, "pedir", self.api(["IN_PROGRESS", "FINISHED"])):
            self.assertEqual(ig.publicar(POST, "tok", "123", dormir), "https://www.instagram.com/p/abc/")
        dormir.assert_called_once_with(5)

    def test_sin_enlace_devuelve_el_numero(self):
        with mock.patch.object(ig, "pedir", self.api(["FINISHED"], permalink=False)):
            self.assertEqual(ig.publicar(POST, "tok", "123", mock.Mock()), "m1")

    def test_un_error_de_proceso_o_la_demora_cortan(self):
        with mock.patch.object(ig, "pedir", self.api(["ERROR"])):
            with self.assertRaisesRegex(ig.ErrorInstagram, "ERROR"):
                ig.publicar(POST, "tok", "123", mock.Mock())
        with mock.patch.object(ig, "pedir", self.api(["IN_PROGRESS"] * 12)):
            with self.assertRaisesRegex(ig.ErrorInstagram, "a tiempo"):
                ig.publicar(POST, "tok", "123", mock.Mock())


class Subir(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.post = self.dir / "instagram.json"
        self.post.write_text(json.dumps(POST), encoding="utf-8")
        self.env = {"INSTAGRAM_TOKEN": "tok", "INSTAGRAM_USER_ID": "123"}

    def correr(self, env=None, publicado=False, imagen=True, publicar=None, ruta=None):
        salida = io.StringIO()
        publicar = publicar or mock.Mock(return_value="https://www.instagram.com/p/abc/")
        with mock.patch.dict(os.environ, self.env if env is None else env, clear=True), \
                mock.patch.object(ig, "renovar", side_effect=lambda t, r, g: t), \
                mock.patch.object(ig, "publicado_el", return_value=publicado) as ya, \
                mock.patch.object(ig, "esperar_imagen", return_value=imagen), \
                mock.patch.object(ig, "publicar", publicar), redirect_stdout(salida):
            codigo = ig.subir(str(ruta or self.post), dormir=mock.Mock())
        return codigo, salida.getvalue(), ya, publicar

    def test_sin_token_o_sin_cuenta_no_hace_ningun_pedido(self):
        for env in ({}, {"INSTAGRAM_TOKEN": "tok"}, {"INSTAGRAM_USER_ID": "123"}):
            codigo, salida, ya, publicar = self.correr(env=env)
            self.assertEqual(codigo, 0)
            self.assertIn("sin configurar", salida)
            ya.assert_not_called()
            publicar.assert_not_called()

    def test_sin_publicacion_armada_no_publica(self):
        codigo, salida, ya, publicar = self.correr(ruta=self.dir / "no-esta.json")
        self.assertIn("no se publica en Instagram", salida)
        publicar.assert_not_called()

    def test_publica_y_muestra_el_enlace(self):
        codigo, salida, ya, publicar = self.correr()
        self.assertEqual(codigo, 0)
        self.assertIn("Publicado en Instagram: https://www.instagram.com/p/abc/", salida)
        ya.assert_called_once_with("tok", "123", "2026-10-23")
        self.assertEqual(publicar.call_args.args[:3], (POST, "tok", "123"))

    def test_no_repite_el_dia_ni_publica_sin_imagen(self):
        codigo, salida, ya, publicar = self.correr(publicado=True)
        self.assertIn("no se repite", salida)
        publicar.assert_not_called()
        codigo, salida, ya, publicar = self.correr(imagen=False)
        self.assertIn("::warning::La imagen", salida)
        publicar.assert_not_called()

    def test_un_rechazo_o_un_corte_de_red_avisan_y_no_fallan(self):
        for error, aviso in ((ig.ErrorInstagram("HTTP 400 x"), "rechazo la publicacion: HTTP 400 x"),
                             (urllib.error.URLError("x"), "No se pudo publicar en Instagram (URLError)")):
            codigo, salida, *_ = self.correr(publicar=mock.Mock(side_effect=error))
            self.assertEqual(codigo, 0)
            self.assertIn("::warning::", salida)
            self.assertIn(aviso, salida)
            self.assertNotIn("tok", salida)


class Main(unittest.TestCase):
    def test_reparte_los_comandos(self):
        with mock.patch.object(ig, "armar", return_value=0) as armar, mock.patch.object(ig, "subir", return_value=0) as subir:
            ig.main(["armar", "o.json", "--salida", "s", "--post", "p.json"])
            ig.main(["publicar", "p.json"])
        armar.assert_called_once_with("o.json", "s", "p.json")
        subir.assert_called_once_with("p.json")
        with redirect_stdout(io.StringIO()):
            self.assertEqual(ig.main([]), 2)


if __name__ == "__main__":
    unittest.main()
