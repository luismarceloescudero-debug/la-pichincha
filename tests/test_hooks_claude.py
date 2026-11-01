"""Hooks de Claude Code del repo (.claude/hooks/): el freno de publicacion/commits y el test del archivo editado."""

import importlib.util
import io
import json
import os
import tempfile
import unittest
from unittest import mock

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(RAIZ, ".claude", "hooks", nombre + ".py"))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


guardia = cargar("guardia")
test_del_archivo = cargar("test_del_archivo")


class Guardia(unittest.TestCase):
    def test_publicar_pide_confirmacion(self):
        for comando in ["gh workflow run actualizar.yml -f indexar=true",
                        "python publicar_telegram.py _sitio/ofertas.json",
                        "python ./publicar_telegram.py --solo-corregir",
                        "curl -s https://api.telegram.org/bot123/sendMessage",
                        "curl https://graph.instagram.com/v21.0/me/media"]:
            self.assertEqual(guardia.decidir(comando)[0], "ask", comando)

    def test_lo_de_todos_los_dias_sigue_sin_preguntar(self):
        for comando in ["gh run list --workflow actualizar.yml --limit 5",
                        "gh pr checks 206 --watch",
                        "python -m unittest tests/test_publicar_telegram.py",
                        "node --test tests/js/titulo.test.js",
                        'git commit -m "fix(titulo): SUPER en placas"',
                        "echo pestaña"]:
            self.assertIsNone(guardia.decidir(comando), comando)

    def test_commit_con_tildes_se_frena(self):
        for comando in ['git commit -m "fix: la pestaña"', 'git -C repo commit -m "docs: guía"',
                        "git commit -F - <<'X'\nCanción\nX"]:
            decision, motivo = guardia.decidir(comando)
            self.assertEqual(decision, "deny", comando)
            self.assertIn("sin tildes", motivo)


def correr(modulo, entrada):
    """Corre el main() del hook con `entrada` por stdin; devuelve (codigo, stdout, stderr)."""
    salida, error = io.StringIO(), io.StringIO()
    with mock.patch("sys.stdin", io.StringIO(entrada)), mock.patch("sys.stdout", salida), mock.patch("sys.stderr", error):
        codigo = modulo.main()
    return codigo, salida.getvalue(), error.getvalue()


class GuardiaMain(unittest.TestCase):
    def test_responde_en_el_formato_del_hook(self):
        codigo, salida, _ = correr(guardia, json.dumps({"tool_input": {"command": "gh workflow run x.yml"}}))
        self.assertEqual(codigo, 0)
        self.assertEqual(json.loads(salida)["hookSpecificOutput"]["permissionDecision"], "ask")

    def test_callado_si_no_aplica_o_la_entrada_es_rara(self):
        for entrada in [json.dumps({"tool_input": {"command": "ls"}}), json.dumps({}), "no es json"]:
            self.assertEqual(correr(guardia, entrada), (0, "", ""), entrada)


class TestDelArchivo(unittest.TestCase):
    def test_solo_js_del_sitio_con_su_test(self):
        self.assertEqual(test_del_archivo.test_de(os.path.join(RAIZ, "js", "titulo.js")),
                         os.path.join(RAIZ, "tests", "js", "titulo.test.js"))
        self.assertIsNone(test_del_archivo.test_de(os.path.join(RAIZ, "tests", "js", "titulo.test.js")))
        self.assertIsNone(test_del_archivo.test_de(os.path.join(RAIZ, "css", "sitio.css")))
        self.assertIsNone(test_del_archivo.test_de(None))
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "js"))
            self.assertIsNone(test_del_archivo.test_de(os.path.join(tmp, "js", "sin_test.js")))


    def test_main_corre_el_test_y_avisa_si_falla(self):
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "js"))
            os.makedirs(os.path.join(tmp, "tests", "js"))
            fuente, test = os.path.join(tmp, "js", "x.js"), os.path.join(tmp, "tests", "js", "x.test.js")
            open(fuente, "w").close()
            entrada = json.dumps({"tool_input": {"file_path": fuente}})
            with open(test, "w") as f:
                f.write('require("node:test")("anda", () => {});')
            self.assertEqual(correr(test_del_archivo, entrada)[0], 0)
            with open(test, "w") as f:
                f.write('require("node:test")("roto", () => { throw new Error("se rompio"); });')
            codigo, _, error = correr(test_del_archivo, entrada)
            self.assertEqual(codigo, 2)
            self.assertIn("se rompio", error)
            self.assertEqual(correr(test_del_archivo, "no es json"), (0, "", ""))


if __name__ == "__main__":
    unittest.main()
