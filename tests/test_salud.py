import io
import json
import shutil
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import salud

FECHA = "2026-10-08T15:25-03:00"


class Evaluar(unittest.TestCase):
    def test_estados_con_el_umbral_justo(self):
        informe = salud.evaluar({"a": 100, "b": 100, "c": 100}, {"a": 70, "b": 69, "c": 0, "d": 5},
                                {"a": "A", "b": "B", "c": "C"}, FECHA)
        estados = {k: v["estado"] for k, v in informe["fuentes"].items()}
        self.assertEqual(estados, {"a": "ok", "b": "baja", "c": "fallo", "d": "ok"})
        self.assertEqual(informe["fuentes"]["d"], {"nombre": "d", "previo": 0, "ahora": 5, "estado": "ok"})
        self.assertEqual((informe["fecha"], informe["umbral"]), (FECHA, 0.7))

    def test_fuente_nueva_sin_productos_es_fallo(self):
        informe = salud.evaluar({}, {"nueva": 0}, {"nueva": "Nueva"}, FECHA)
        self.assertEqual(informe["fuentes"]["nueva"]["estado"], "fallo")


class Alertas(unittest.TestCase):
    def test_solo_las_que_no_estan_ok(self):
        informe = salud.evaluar({"a": 100, "b": 100}, {"a": 90, "b": 10}, {"a": "A", "b": "Mexx"}, FECHA)
        lista = salud.alertas(informe)
        self.assertEqual([a["clave"] for a in lista], ["b"])
        self.assertEqual(salud.titulo(lista[0]), "Fuente con pocos productos: Mexx")
        texto = salud.cuerpo(lista[0], "https://github.com/x/y/actions/runs/1")
        for parte in ("**Mexx**", "10 productos", "contra 100", "10%", "actions/runs/1",
                      "indexar.py --probar", "tests/capturar.py"):
            self.assertIn(parte, texto)

    def test_sin_informe_es_el_indexado_caido(self):
        lista = salud.alertas(None)
        self.assertEqual(len(lista), 1)
        self.assertEqual(salud.titulo(lista[0]), "El indexado de precios no termino")
        self.assertIn("actions/runs/9", salud.cuerpo(lista[0], "https://github.com/x/y/actions/runs/9"))


class Main(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.ruta = self.dir / "salud.json"
        informe = salud.evaluar({"mexx": 900, "cg": 1500}, {"mexx": 100, "cg": 1500},
                                {"mexx": "Mexx", "cg": "CompraGamer"}, FECHA)
        self.ruta.write_text(json.dumps(informe), encoding="utf-8")
        self.llamadas = []

    def falso_gh(self, abiertos):
        def gh(*args):
            self.llamadas.append(args)
            return json.dumps(abiertos) if args[:2] == ("issue", "list") else ""
        return gh

    def correr(self, *argv, abiertos=()):
        with mock.patch.object(salud, "gh", self.falso_gh(list(abiertos))), redirect_stdout(io.StringIO()) as out:
            self.assertEqual(salud.main([str(self.ruta), *argv]), 0)
        return out.getvalue()

    def test_abre_un_issue_por_fuente_caida(self):
        self.correr()
        verbos = [a[:2] for a in self.llamadas]
        self.assertEqual(verbos, [("label", "create"), ("issue", "list"), ("issue", "create")])
        crear = self.llamadas[-1]
        self.assertIn("Fuente con pocos productos: Mexx", crear)
        self.assertIn(salud.ETIQUETA, crear)

    def test_si_ya_hay_uno_abierto_comenta(self):
        self.correr(abiertos=[{"number": 7, "title": "Fuente con pocos productos: Mexx"}])
        self.assertEqual(self.llamadas[-1][:3], ("issue", "comment", "7"))

    def test_seco_no_llama_a_gh(self):
        out = self.correr("--seco")
        self.assertEqual(self.llamadas, [])
        self.assertIn("Fuente con pocos productos: Mexx", out)

    def test_todo_sano_no_hace_nada(self):
        self.ruta.write_text(json.dumps(salud.evaluar({"a": 1}, {"a": 1}, {}, FECHA)), encoding="utf-8")
        self.correr()
        self.assertEqual(self.llamadas, [])

    def test_si_gh_falla_avisa_y_la_corrida_sigue(self):
        # P1: un 403/429 de la API de GitHub (o un gh que no contesta) no puede cortar la publicacion.
        fallos = [subprocess.CalledProcessError(1, ["gh", "issue", "create"], output="", stderr="HTTP 403"),
                  subprocess.TimeoutExpired(["gh", "issue", "create"], 60)]

        def gh_roto(e):
            def gh(*args):
                self.llamadas.append(args)
                raise e
            return gh

        for fallo in fallos:
            with self.subTest(fallo=type(fallo).__name__):
                self.llamadas = []
                with mock.patch.object(salud, "gh", gh_roto(fallo)), redirect_stdout(io.StringIO()) as out:
                    self.assertEqual(salud.main([str(self.ruta)]), 0)
                self.assertIn("::warning::No se pudo avisar en GitHub", out.getvalue())

    def test_la_lista_que_falla_no_abre_issues_de_mas(self):
        def gh(*args):
            if args[:2] == ("issue", "list"):
                raise subprocess.CalledProcessError(1, ["gh", *args], output="", stderr="HTTP 429")
            self.llamadas.append(args)
            return ""

        with mock.patch.object(salud, "gh", gh), redirect_stdout(io.StringIO()):
            self.assertEqual(salud.main([str(self.ruta)]), 0)
        self.assertEqual(self.llamadas, [("label", "create", salud.ETIQUETA, "--color", "d93f0b",
                                          "--description", "Una fuente de precios trajo menos de lo esperado",
                                          "--force")])

    def test_sin_archivo_avisa_el_indexado_caido(self):
        self.ruta.unlink()
        self.correr()
        self.assertIn("El indexado de precios no termino", self.llamadas[-1])
