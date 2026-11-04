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

    def test_borrar_historia_se_frena(self):
        for comando in ["git push --force origin main", "git push -f", "git push origin x --force-with-lease", "git reset --hard HEAD~1"]:
            self.assertEqual(guardia.decidir(comando)[0], "deny", comando)
        for comando in ["git push -u origin claude/x", "git reset --soft HEAD~1", "git status"]:
            self.assertIsNone(guardia.decidir(comando), comando)

    def test_push_a_main_se_frena(self):
        for comando in ["git push origin main", "git push origin  main", "git push -u origin main"]:
            self.assertEqual(guardia.decidir(comando)[0], "deny", comando)
        for comando in ["git push origin main-backup", "git push origin feature/main-fix"]:
            self.assertIsNone(guardia.decidir(comando), comando)

    def test_secretos_se_frenan(self):
        for ruta in ["worker/.dev.vars", ".env", "app/.env.local", "C:\repo\.env"]:
            self.assertEqual(guardia.decidir_archivo(ruta)[0], "deny", ruta)
        self.assertIsNone(guardia.decidir_archivo("js/env.js"))


class JsonRoto(unittest.TestCase):
    def test_avisa_si_el_json_quedo_invalido(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            malo, bueno = os.path.join(d, "malo.json"), os.path.join(d, "bueno.json")
            open(malo, "w", encoding="utf-8").write('{"a": 1,}')
            open(bueno, "w", encoding="utf-8").write('{"a": 1}')
            self.assertIn("JSON invalido", test_del_archivo.json_roto(malo))
            self.assertIsNone(test_del_archivo.json_roto(bueno))
            self.assertIsNone(test_del_archivo.json_roto(os.path.join(d, "no_existe.json")))
        self.assertIsNone(test_del_archivo.json_roto("js/x.js"))


def correr(modulo, entrada):
    """Corre el main() del hook con `entrada` por stdin; devuelve (codigo, stdout, stderr)."""
    salida, error = io.StringIO(), io.StringIO()
    with mock.patch("sys.stdin", io.StringIO(entrada)), mock.patch("sys.stdout", salida), mock.patch("sys.stderr", error):
        codigo = modulo.main()
    return codigo, salida.getvalue(), error.getvalue()


class GuardiaArchivos(unittest.TestCase):
    def test_generados_piden_confirmacion(self):
        for ruta in ["package-lock.json", "/repo/package-lock.json", "_sitio/index.html", "C:\\repo\\_sitio\\x.json"]:
            self.assertEqual(guardia.decidir_archivo(ruta)[0], "ask", ruta)

    def test_lo_curado_a_mano_no_se_frena(self):
        for ruta in ["datos.json", "consultas.json", "js/titulo.js", "package.json", "docs/x.md", None]:
            self.assertIsNone(guardia.decidir_archivo(ruta), ruta)

    def test_main_con_file_path(self):
        codigo, salida, _ = correr(guardia, json.dumps({"tool_input": {"file_path": "package-lock.json"}}))
        self.assertEqual(codigo, 0)
        self.assertEqual(json.loads(salida)["hookSpecificOutput"]["permissionDecision"], "ask")
        self.assertEqual(correr(guardia, json.dumps({"tool_input": {"file_path": "datos.json"}})), (0, "", ""))


class GuardiaMain(unittest.TestCase):
    def test_responde_en_el_formato_del_hook(self):
        codigo, salida, _ = correr(guardia, json.dumps({"tool_input": {"command": "gh workflow run x.yml"}}))
        self.assertEqual(codigo, 0)
        self.assertEqual(json.loads(salida)["hookSpecificOutput"]["permissionDecision"], "ask")

    def test_omitir_permisos_no_pregunta_pero_sigue_frenando(self):
        modo = {"permission_mode": "bypassPermissions"}
        self.assertEqual(correr(guardia, json.dumps({**modo, "tool_input": {"command": "gh workflow run x.yml"}})), (0, "", ""))
        self.assertEqual(correr(guardia, json.dumps({**modo, "tool_input": {"file_path": "package-lock.json"}})), (0, "", ""))
        # lo que se frena se sigue frenando, e Instagram pregunta siempre
        for entrada in [{"command": "git push " + "--force"}, {"command": "curl https://graph.instagram.com/me"}, {"file_path": ".env"}]:
            _, salida, _ = correr(guardia, json.dumps({**modo, "tool_input": entrada}))
            self.assertIn(json.loads(salida)["hookSpecificOutput"]["permissionDecision"], ("deny", "ask"), entrada)
        with mock.patch.dict(os.environ, {"PICHINCHA_GUARDIA": "omitir"}):
            self.assertEqual(correr(guardia, json.dumps({"tool_input": {"command": "python publicar_telegram.py x"}})), (0, "", ""))
        with mock.patch.dict(os.environ, {"PICHINCHA_GUARDIA": ""}):
            _, salida, _ = correr(guardia, json.dumps({"permission_mode": "default", "tool_input": {"command": "gh workflow run x.yml"}}))
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

    def test_py_de_la_raiz_con_su_test(self):
        self.assertEqual(test_del_archivo.test_de(os.path.join(RAIZ, "modelo.py")),
                         os.path.join(RAIZ, "tests", "test_modelo.py"))
        self.assertIsNone(test_del_archivo.test_de(os.path.join(RAIZ, "tests", "test_modelo.py")))
        self.assertIsNone(test_del_archivo.test_de(os.path.join(RAIZ, "archivo_sin_test.py")))

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
