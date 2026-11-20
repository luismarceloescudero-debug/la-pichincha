"""herramientas/ci_diagnostico.py: clasifica una corrida fallida contra los errores conocidos."""
import importlib.util
import os
import unittest

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ci_diagnostico", os.path.join(RAIZ, "herramientas", "ci_diagnostico.py"))
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class Clasificar(unittest.TestCase):
    def test_reconoce_la_cache_sin_indice(self):
        log = "##[error]Este push no tiene indice previo en la cache: no se publica"
        self.assertEqual([i for i, _ in ci.clasificar(log)], ["E01"])

    def test_reconoce_el_workflow_invalido(self):
        self.assertEqual([i for i, _ in ci.clasificar("No jobs were run")], ["E03"])

    def test_un_error_nuevo_no_coincide_con_nada(self):
        self.assertEqual(ci.clasificar("KeyError: 'precio' en indexar.py"), [])
        self.assertEqual(ci.clasificar(None), [])

    def test_las_firmas_apuntan_a_filas_del_registro(self):
        registro = open(os.path.join(RAIZ, "docs", "errores-conocidos.md"), encoding="utf-8").read()
        for i, _, _ in ci.FIRMAS:
            self.assertIn("| " + i + " |", registro, i)


class Pasos(unittest.TestCase):
    def test_lista_solo_los_pasos_que_fallaron(self):
        datos = {"jobs": [{"name": "construir", "steps": [{"name": "A", "conclusion": "success"},
                                                          {"name": "Frenar", "conclusion": "failure"}]},
                          {"name": "tests", "steps": [{"name": "B", "conclusion": "success"}]}]}
        self.assertEqual(ci.pasos_fallados(datos), [("construir", "Frenar")])

    def test_intermitente_si_otra_corrida_del_mismo_commit_paso(self):
        corridas = [{"databaseId": 1, "headSha": "abc", "conclusion": "failure", "workflowName": "Publicar"},
                    {"databaseId": 2, "headSha": "abc", "conclusion": "success", "workflowName": "Publicar"}]
        self.assertTrue(ci.es_intermitente(corridas, 1, "abc", "Publicar"))
        self.assertFalse(ci.es_intermitente(corridas, 2, "abc", "Publicar"))
        self.assertFalse(ci.es_intermitente(corridas, 1, "otro", "Publicar"))

    def test_un_verde_de_otro_workflow_no_cuenta(self):
        """Falso positivo real (corrida 44607390849): los tests del PR pasaron en el mismo commit."""
        corridas = [{"databaseId": 9, "headSha": "abc", "conclusion": "success", "workflowName": "Tests"}]
        self.assertFalse(ci.es_intermitente(corridas, 1, "abc", "Actualizar precios y publicar"))


if __name__ == "__main__":
    unittest.main()
