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


class Acciones(unittest.TestCase):
    """spec 066: un issue por tienda y un solo registro por cambio de estado."""
    URL = "https://github.com/x/y/actions/runs/1"

    def informe(self, relevados, tiendas, cambios=()):
        informe = salud.evaluar({k: 100 for k in relevados}, relevados, {k: k.upper() for k in relevados}, FECHA)
        informe["tiendas"] = {k: dict({"nombre": k.upper(), "ultima": None}, estado=e) for k, e in tiendas.items()}
        informe["cambios"] = [dict(c, nombre=c["clave"].upper()) for c in cambios]
        return informe

    def verbos(self, plan):
        return [(v, t.split(": ")[-1], n) for v, t, n, _ in plan]

    def test_pasa_a_pausa_comenta_el_issue_abierto(self):
        inf = self.informe({"k": 0}, {"k": "pausa"}, [{"clave": "k", "de": "activa", "a": "pausa", "clase": "bloqueo",
                                                         "sin_productos_desde": "2026-10-17"}])
        plan = salud.acciones(inf, {"Fuente con pocos productos: K": 55}, self.URL)
        self.assertEqual(self.verbos(plan), [("comentar", "K", 55)])
        self.assertIn("en pausa", plan[0][3])
        self.assertIn("17/10", plan[0][3])

    def test_en_pausa_no_hay_alerta_diaria(self):
        inf = self.informe({"k": 0}, {"k": "pausa"})
        self.assertEqual(salud.acciones(inf, {"Fuente con pocos productos: K": 55}, self.URL), [])

    def test_en_pausa_sin_issue_lo_abre_una_vez(self):
        # una corrida manual paso la tienda a pausa y no llamo a salud.py: la programada lo registra
        inf = self.informe({"k": 0}, {"k": "pausa"})
        self.assertEqual(self.verbos(salud.acciones(inf, {}, self.URL)), [("crear", "K", None)])

    def test_baja_cierra_con_su_comentario(self):
        inf = self.informe({}, {"c": "baja"}, [{"clave": "c", "de": "activa", "a": "baja", "clase": "muerta"}])
        plan = salud.acciones(inf, {"Fuente con pocos productos: C": 96}, self.URL)
        self.assertEqual(self.verbos(plan), [("cerrar", "C", 96)])
        self.assertIn("dada de baja", plan[0][3])

    def test_los_textos_usan_los_umbrales_de_estado_tiendas(self):
        cambio = {"nombre": "C", "a": salud.estado_tiendas.BAJA, "de": salud.estado_tiendas.ACTIVA}
        with mock.patch.object(salud.estado_tiendas, "CORRIDAS_BAJA", 5):
            self.assertIn("en 5 corridas seguidas", salud.cuerpo_cambio(cambio, self.URL))

    def test_baja_ya_registrada_con_el_issue_abierto_se_cierra(self):
        inf = self.informe({}, {"c": "baja"})
        self.assertEqual(self.verbos(salud.acciones(inf, {"Fuente con pocos productos: C": 96}, self.URL)),
                         [("cerrar", "C", 96)])

    def test_alta_cierra_un_solo_registro(self):
        inf = self.informe({"k": 50}, {"k": "activa"}, [{"clave": "k", "de": "pausa", "a": "activa", "clase": "ok"}])
        plan = salud.acciones(inf, {"Fuente con pocos productos: K": 55}, self.URL)
        self.assertEqual(self.verbos(plan), [("cerrar", "K", 55)])
        self.assertIn("alta automatica", plan[0][3])

    def test_una_tienda_activa_que_falla_abre_uno_solo_la_primera_vez(self):
        inf = self.informe({"m": 0}, {"m": "activa"})
        self.assertEqual(self.verbos(salud.acciones(inf, {}, self.URL)), [("crear", "M", None)])
        self.assertEqual(salud.acciones(inf, {"Fuente con pocos productos: M": 9}, self.URL), [])

    def test_informe_viejo_sin_estados_sigue_andando(self):
        inf = salud.evaluar({"m": 100}, {"m": 0}, {"m": "M"}, FECHA)
        self.assertEqual(self.verbos(salud.acciones(inf, {}, self.URL)), [("crear", "M", None)])


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

    def test_si_ya_hay_uno_abierto_no_comenta_todos_los_dias(self):
        # spec 066: el #96 de Compra Cierta junto 12 comentarios iguales; ahora solo comenta un cambio de estado.
        self.correr(abiertos=[{"number": 7, "title": "Fuente con pocos productos: Mexx"}])
        self.assertEqual([a[:2] for a in self.llamadas], [("label", "create"), ("issue", "list")])

    def test_seco_no_llama_a_gh(self):
        out = self.correr("--seco")
        self.assertEqual(self.llamadas, [])
        self.assertIn("Fuente con pocos productos: Mexx", out)

    def test_todo_sano_no_abre_ni_comenta(self):
        self.ruta.write_text(json.dumps(salud.evaluar({"a": 1}, {"a": 1}, {}, FECHA)), encoding="utf-8")
        self.correr()
        self.assertEqual([a[:2] for a in self.llamadas], [("label", "create"), ("issue", "list")],
                         "solo mira si quedo un issue abierto de una tienda que ya volvio")

    def test_una_tienda_que_volvio_cierra_su_issue(self):
        # Compra Cierta (#96): trae 737 productos desde el 05/11 y el issue seguia abierto.
        self.ruta.write_text(json.dumps(salud.evaluar({"cc": 27}, {"cc": 737}, {"cc": "Compra Cierta"}, FECHA)),
                             encoding="utf-8")
        self.correr(abiertos=[{"number": 96, "title": "Fuente con pocos productos: Compra Cierta"}])
        self.assertEqual(self.llamadas[-1][:4], ("issue", "close", "96", "--comment"))
        self.assertIn("737 productos", self.llamadas[-1][4])

    def test_la_baja_sin_issue_abre_y_cierra_uno(self):
        informe = salud.evaluar({}, {}, {}, FECHA)
        informe["tiendas"] = {"x": {"nombre": "X", "estado": "baja", "ultima": "muerta"}}
        informe["cambios"] = [{"clave": "x", "nombre": "X", "de": "activa", "a": "baja", "clase": "muerta"}]
        self.ruta.write_text(json.dumps(informe), encoding="utf-8")
        self.llamadas = []

        def gh(*args):
            self.llamadas.append(args)
            if args[:2] == ("issue", "create"):
                return "https://github.com/o/r/issues/300\n"
            return "[]" if args[:2] == ("issue", "list") else ""

        with mock.patch.object(salud, "gh", gh), redirect_stdout(io.StringIO()):
            salud.main([str(self.ruta)])
        self.assertEqual([a[:3] for a in self.llamadas[2:]],
                         [("issue", "create", "--title"), ("issue", "close", "300")])
        self.assertIn("dada de baja", self.llamadas[2][5])

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
