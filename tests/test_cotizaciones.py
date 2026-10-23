"""generar_cotizaciones.py (plan v3, K2): la copia de las cotizaciones que escribe el build, para que la calculadora
funcione sin red y la pagina no quede vacia si una API cae. Los tests nunca van a la red: usan las respuestas reales
guardadas en tests/fixtures/monedas."""

import io
import json
import re
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timezone
from pathlib import Path
from unittest import mock

import generar_cotizaciones as gc

RAIZ = Path(__file__).resolve().parent.parent
FIX = RAIZ / "tests" / "fixtures" / "monedas"
AHORA = datetime(2026, 10, 15, 17, 0, tzinfo=timezone.utc)


def fixture(nombre):
    return json.loads((FIX / nombre).read_text(encoding="utf-8"))


BIEN = {gc.URLS["dolarapi"]: fixture("dolarapi-dolares.json"), gc.URLS["erapi"]: fixture("erapi-usd.json"),
        gc.URLS["frankfurter"]: fixture("frankfurter-usd.json")}


def pedir_de(respuestas):
    def pedir(url):
        r = respuestas[url]
        if isinstance(r, Exception):
            raise r
        return r
    return pedir


class Generar(unittest.TestCase):
    def test_trae_las_tres_fuentes_con_la_hora_del_build(self):
        copia = gc.generar(AHORA, pedir=pedir_de(BIEN))
        self.assertEqual(copia["generado"], "2026-10-15T17:00:00Z")
        self.assertEqual(copia["dolarapi"], BIEN[gc.URLS["dolarapi"]])
        self.assertEqual(copia["erapi"]["rates"]["EUR"], BIEN[gc.URLS["erapi"]]["rates"]["EUR"])
        self.assertEqual(copia["frankfurter"]["base"], "USD")

    def test_una_fuente_que_falla_queda_en_null_y_las_demas_siguen(self):
        respuestas = {**BIEN, gc.URLS["dolarapi"]: OSError("sin red")}
        copia = gc.generar(AHORA, pedir=pedir_de(respuestas))
        self.assertIsNone(copia["dolarapi"])
        self.assertIsNotNone(copia["erapi"])
        self.assertIsNotNone(copia["frankfurter"])

    def test_una_respuesta_mal_formada_se_descarta(self):
        malas = {gc.URLS["dolarapi"]: {"no": "es una lista"}, gc.URLS["erapi"]: {"result": "error"},
                 gc.URLS["frankfurter"]: "basura"}
        self.assertIsNone(gc.generar(AHORA, pedir=pedir_de(malas)))

    def test_si_no_anda_ninguna_no_hay_copia(self):
        caidas = {u: OSError("caida") for u in gc.URLS.values()}
        self.assertIsNone(gc.generar(AHORA, pedir=pedir_de(caidas)))

    def test_un_dolar_con_venta_cero_o_negativa_no_se_guarda(self):
        for venta in (0, -5):
            respuestas = {**BIEN, gc.URLS["dolarapi"]: [{"casa": "oficial", "compra": 1, "venta": venta}]}
            copia = gc.generar(AHORA, pedir=pedir_de(respuestas))
            self.assertIsNone(copia["dolarapi"], venta)

    def test_una_respuesta_de_monedas_sin_ninguna_moneda_util_se_descarta(self):
        for rates in ({}, {"EUR": 0, "BRL": -1}, {"ARS": 1500, "USD": 1}):
            respuestas = {**BIEN, gc.URLS["erapi"]: {"result": "success", "rates": rates},
                          gc.URLS["frankfurter"]: {"base": "USD", "rates": rates}}
            copia = gc.generar(AHORA, pedir=pedir_de(respuestas))
            self.assertIsNone(copia["erapi"], rates)
            self.assertIsNone(copia["frankfurter"], rates)

    def test_las_url_son_las_mismas_que_usa_la_pagina(self):
        js = (RAIZ / "js" / "monedas.js").read_text(encoding="utf-8")
        for nombre, url in gc.URLS.items():
            self.assertIn(f'{nombre}: "{url}"', js, nombre)


class Bajar(unittest.TestCase):
    def test_se_identifica_y_pide_json(self):
        class Respuesta:
            def read(self): return b'{"ok": true}'
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with mock.patch("generar_cotizaciones.urllib.request.urlopen", return_value=Respuesta()) as abrir:
            self.assertEqual(gc.bajar("https://x.test/a"), {"ok": True})
        pedido = abrir.call_args.args[0]
        self.assertIn("La Pichincha", pedido.get_header("User-agent"))
        self.assertEqual(abrir.call_args.kwargs["timeout"], gc.TIEMPO_MAXIMO)


class Linea(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)

    def correr(self, argv, respuestas):
        with mock.patch.object(gc, "bajar", pedir_de(respuestas)), redirect_stdout(io.StringIO()) as salida:
            codigo = gc.main(argv)
        return codigo, salida.getvalue()

    def test_escribe_la_copia_donde_se_le_dice_y_crea_las_carpetas(self):
        ruta = self.dir / "sitio" / "cotizaciones.json"
        codigo, salida = self.correr(["--salida", str(ruta)], BIEN)
        self.assertEqual(codigo, 0)
        copia = json.loads(ruta.read_text(encoding="utf-8"))
        self.assertTrue(re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", copia["generado"]))
        self.assertEqual(copia["dolarapi"][0]["casa"], BIEN[gc.URLS["dolarapi"]][0]["casa"])
        self.assertIn("3 fuentes", salida)

    def test_si_todo_falla_no_escribe_nada_y_avisa_sin_romper_el_build(self):
        ruta = self.dir / "cotizaciones.json"
        codigo, salida = self.correr(["--salida", str(ruta)], {u: OSError("x") for u in gc.URLS.values()})
        self.assertEqual(codigo, 0)
        self.assertFalse(ruta.exists())
        self.assertIn("::warning::", salida)

    def test_si_algunas_fallan_escribe_lo_que_hay_y_dice_cuantas(self):
        ruta = self.dir / "c.json"
        codigo, salida = self.correr(["--salida", str(ruta)], {**BIEN, gc.URLS["frankfurter"]: OSError("x")})
        self.assertEqual(codigo, 0)
        self.assertIsNone(json.loads(ruta.read_text(encoding="utf-8"))["frankfurter"])
        self.assertIn("2 fuentes", salida)

    def test_el_workflow_de_publicacion_la_genera_sin_frenar_el_sitio_si_falla(self):
        yml = (RAIZ / ".github" / "workflows" / "actualizar.yml").read_text(encoding="utf-8")
        paso = re.search(r"python generar_cotizaciones\.py[^\n]*", yml)
        self.assertIsNotNone(paso, "falta el paso que genera la copia de las cotizaciones")
        self.assertIn("_sitio/cotizaciones.json", paso.group(0))
        self.assertIn("||", paso.group(0))


class Csp(unittest.TestCase):
    """La pagina solo puede conectarse a los dominios que declara la politica de contenido (CONSTRAINTS.md):
    sumar uno se justifica en el PR. Aca, las tres fuentes de cotizaciones y nada mas."""

    ORIGENES = ("https://dolarapi.com", "https://open.er-api.com", "https://api.frankfurter.dev")

    def connect_src(self, csp):
        return re.search(r"connect-src ([^;]+)", csp).group(1).split()

    def test_la_politica_deja_conectar_a_las_tres_fuentes_y_a_la_analitica(self):
        sitio = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))
        permitidos = self.connect_src(sitio["csp"])
        for origen in self.ORIGENES:
            self.assertIn(origen, permitidos)
        self.assertIn("'self'", permitidos)
        self.assertIn("https://mescudero.goatcounter.com", permitidos)
        # el unico dominio que se suma es el del Worker «Afuera» (spec 022), cuando sitio.json lo tiene
        afuera = [sitio["afuera_url"]] if sitio.get("afuera_url") else []
        for origen in afuera:
            self.assertIn(origen, permitidos)
        self.assertEqual(len(permitidos), 5 + len(afuera), "no se suma ningun otro dominio de conexion")

    def test_las_url_de_js_monedas_estan_dentro_de_esa_politica(self):
        sitio = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))
        permitidos = self.connect_src(sitio["csp"])
        for url in gc.URLS.values():
            origen = re.match(r"https://[^/]+", url).group(0)
            self.assertIn(origen, permitidos, url)


if __name__ == "__main__":
    unittest.main()
