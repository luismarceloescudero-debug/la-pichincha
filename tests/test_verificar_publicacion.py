"""herramientas/verificar_publicacion.py: la decision de «es seguro publicar» con datos armados a mano."""
import importlib.util
import os
import unittest
from datetime import datetime, timedelta, timezone

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("verificar_publicacion", os.path.join(RAIZ, "herramientas", "verificar_publicacion.py"))
vp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vp)

AHORA = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)
SANO = {"issues_a_revisar": [], "cache_con_indice": True, "indice_modificado": AHORA - timedelta(hours=2),
        "corridas": [{"databaseId": 7, "status": "completed", "conclusion": "success"}]}


def niveles(estado):
    return [n for n, _ in vp.evaluar(estado, AHORA)]


class Evaluar(unittest.TestCase):
    def test_todo_sano_no_frena_ni_avisa(self):
        self.assertEqual(set(niveles(SANO)), {"OK"})

    def test_ultima_corrida_fallida_frena(self):
        e = {**SANO, "corridas": [{"databaseId": 9, "status": "completed", "conclusion": "failure"}]}
        self.assertIn("FRENO", niveles(e))

    def test_una_corrida_cancelada_no_cuenta_como_ultima(self):
        e = {**SANO, "corridas": [{"databaseId": 9, "status": "completed", "conclusion": "cancelled"},
                                  {"databaseId": 8, "status": "completed", "conclusion": "success"}]}
        self.assertNotIn("FRENO", niveles(e))

    def test_sin_indice_en_la_cache_frena(self):
        self.assertIn("FRENO", niveles({**SANO, "cache_con_indice": False}))

    def test_issues_a_revisar_avisan(self):
        e = {**SANO, "issues_a_revisar": [{"number": 8}]}
        self.assertIn("AVISO", niveles(e))
        self.assertNotIn("FRENO", niveles(e))

    def test_indice_viejo_avisa_y_sin_fecha_tambien(self):
        self.assertIn("AVISO", niveles({**SANO, "indice_modificado": AHORA - timedelta(hours=40)}))
        self.assertIn("AVISO", niveles({**SANO, "indice_modificado": None}))


if __name__ == "__main__":
    unittest.main()
