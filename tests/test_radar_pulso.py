import io
import json
import os
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

import radar_pulso as rp

FIX = Path(__file__).parent / "fixtures" / "radar"
TAVILY = json.loads((FIX / "tavily-usage.json").read_text(encoding="utf-8"))
FIRECRAWL = json.loads((FIX / "firecrawl-credit-usage.json").read_text(encoding="utf-8"))
CLAVES = {"TAVILY_API_KEY": "tvly-secreta", "FIRECRAWL_API_KEY": "fc-secreta"}
SIN_ESPERA = lambda s: None  # noqa: E731


def get_ok(url, clave):
    return TAVILY if url == rp.TAVILY_USO else FIRECRAWL


def http(code):
    return urllib.error.HTTPError("u", code, "x", {}, None)


def contador(efecto):
    llamadas = []

    def get(url, clave):
        llamadas.append(url)
        return efecto(len(llamadas))
    return get, llamadas


class Creditos(unittest.TestCase):
    def test_tavily(self):
        self.assertEqual(rp.creditos_tavily(TAVILY), (150, 850))

    def test_tavily_con_tope_de_clave(self):
        self.assertEqual(rp.creditos_tavily({**TAVILY, "key": {"usage": 40, "limit": 100}}), (150, 60))

    def test_tavily_sin_plan_limit_falla(self):
        # un 200 sin account.plan_limit no es "0 creditos": la respuesta cambio y el pulso tiene que fallar a la vista
        for datos in ({}, {"account": {"plan_usage": 3}}, {"account": {"plan_limit": None}}):
            with self.assertRaisesRegex(rp.FallaPulso, "plan_limit"):
                rp.creditos_tavily(datos)

    def test_firecrawl(self):
        self.assertEqual(rp.creditos_firecrawl(FIRECRAWL), (940, 60))

    def test_firecrawl_sin_datos_falla(self):
        with self.assertRaises(rp.FallaPulso):
            rp.creditos_firecrawl({"success": False, "error": "x"})


class Consultar(unittest.TestCase):
    def test_reintenta_una_vez_y_sale_bien(self):
        def efecto(n):
            if n == 1:
                raise urllib.error.URLError("timeout")
            return {"ok": 1}
        get, llamadas = contador(efecto)
        self.assertEqual(rp.consultar("u", "k", get=get, dormir=SIN_ESPERA), {"ok": 1})
        self.assertEqual(len(llamadas), 2)

    def test_falla_tras_un_reintento(self):
        def efecto(n):
            raise http(503)
        get, llamadas = contador(efecto)
        with self.assertRaisesRegex(rp.FallaPulso, "1 reintento"):
            rp.consultar("u", "k", get=get, dormir=SIN_ESPERA)
        self.assertEqual(len(llamadas), 2)

    def test_401_no_reintenta(self):
        def efecto(n):
            raise http(401)
        get, llamadas = contador(efecto)
        with self.assertRaisesRegex(rp.FallaPulso, "401"):
            rp.consultar("u", "k", get=get, dormir=SIN_ESPERA)
        self.assertEqual(len(llamadas), 1)


class Pulso(unittest.TestCase):
    def test_todo_bien_con_aviso_de_pocos_creditos(self):
        filas, avisos, errores = rp.pulso(CLAVES, get=get_ok, dormir=SIN_ESPERA)
        self.assertEqual(errores, [])
        self.assertEqual(filas, [("Tavily", "ok", 150, 850), ("Firecrawl", "ok", 940, 60)])
        self.assertEqual(len(avisos), 1)
        self.assertIn("Firecrawl", avisos[0])

    def test_falta_clave_es_error(self):
        _, _, errores = rp.pulso({"TAVILY_API_KEY": "x"}, get=get_ok, dormir=SIN_ESPERA)
        self.assertEqual(errores, ["Firecrawl: falta FIRECRAWL_API_KEY"])

    def test_403_es_error(self):
        def get(url, clave):
            if url == rp.FIRECRAWL_USO:
                raise http(403)
            return TAVILY
        _, _, errores = rp.pulso(CLAVES, get=get, dormir=SIN_ESPERA)
        self.assertEqual(len(errores), 1)
        self.assertIn("403", errores[0])


class Main(unittest.TestCase):
    def correr(self, get):
        with tempfile.TemporaryDirectory() as d:
            resumen = os.path.join(d, "resumen.md")
            with mock.patch.dict(os.environ, {**CLAVES, "GITHUB_STEP_SUMMARY": resumen}, clear=True), \
                    mock.patch.object(rp, "_get_json", get), \
                    mock.patch("sys.stdout", new_callable=io.StringIO) as out:
                codigo = rp.main()
            return codigo, out.getvalue(), Path(resumen).read_text(encoding="utf-8")

    def test_verde_con_numeros_y_aviso(self):
        codigo, texto, resumen = self.correr(get_ok)
        self.assertEqual(codigo, 0)
        self.assertIn("::warning::Firecrawl", texto)
        self.assertIn("| Tavily | ok | 150 | 850 |", resumen)
        self.assertNotIn("secreta", texto + resumen)

    def test_rojo_con_clave_rechazada_sin_imprimirla(self):
        def get(url, clave):
            raise http(401)
        codigo, texto, resumen = self.correr(get)
        self.assertEqual(codigo, 1)
        self.assertIn("::error::Tavily: HTTP 401", texto)
        self.assertNotIn("secreta", texto + resumen)


if __name__ == "__main__":
    unittest.main()
